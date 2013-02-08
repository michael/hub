var _ = require('underscore');
var passport = require('passport');
var Store = require('substance-store');

// Redis DocStore instance
// var store = new Store.RedisStore();

function getStore(username) {
  return new Store.RedisStore({scope: username, port: 6380});
}

var errors = require('../../errors');
var csrf = require('../../csrf');
var users = require('../../users');
var publications = require('../../publications');

var db = require('../../db');

var authorizations = require('../../authorizations');

var apis = module.exports = {};

function authenticate (types, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  return function (req, res, next) {
    // Signature: req, res, next, err, user, info
    var cb = _.bind(callback, null, req, res, next);
    passport.authenticate(types, options, cb).call(this, req, res, next);
  };
}

function createCommonCallback (loose, property, message) {
  if (!property) property = 'user';
  if (!message) message = 'Authentication failed';
  return function (req, res, next, err, object, info) {
    if (err || !object) {
      if (loose) next();
      else next(new errors.Unauthorized(err ? err.message : message));
    } else {
      req[property] = object;
      next();
    }
  };
}

function authenticateCommon (loose) {
  return authenticate(['hash', 'basic'], {
    session: false
  }, createCommonCallback(loose, 'user'));
}

function authenticateUser (loose) {
  return authenticate('basic', {
    session: false
  }, createCommonCallback(loose, 'user'));
}

function authenticateApplication (loose) {
  return authenticate(['oauth2-client-password'], {
    session: false
  }, createCommonCallback(loose, 'client', 'Wrong Application credentials'));
}

function out (res) {
  return function (err, data) {

    var status = 200;
    if (err instanceof errors.NoRecordFound) status = 404;
    else if (err) status = 500;

    if (err) res.json(status, {
      type: err.name,
      message: err.message
    });
    else if (data) res.json(status, data);
    else res.json(status, {});
  };
}

apis.configure = function (app) {

  app.get('/', function (req, res) {
    res.json({
      "name": "Substance API",
      "version": "1.0-alpha",
      "authorization_url": "/authorizations/{authorization}",
      "current_authorization_url": "/authorizations/current",
      "publication_url": "/publications/{document}",
      "user_url": "/users/{user}",
      "register_user_url": "/register",
      "document_url": "/users/{owner}/documents/{document}",
      "document_commits_url": "/users/{owner}/documents/{document}/commits",
      "documents_status_url": "/users/{owner}/documents/statuses"
    });
  });

  // Authentication / Authorization
  // ==============================

  app.post('/authorizations',
    authenticateUser(),
    authenticateApplication(),
    function (req, res) {
      var user = req.user;
      var application = req.client;

      authorizations.findOrCreate(user.username, application.uuid, 'all', out(res));
    });

  app.get('/authorizations',
    authenticateCommon(),
    function (req, res) {
      authorizations.findByUser(req.user.username, out(res));
    });

  // Was GET /authorization

  app.get('/authorizations/current',
    authenticateUser(),
    authenticateApplication(),
    function (req, res) {
      var user = req.user;
      var application = req.client;
      authorizations.findByUserAndApplication(user.username, application.uuid, out(res));
    });

  app.get('/authorizations/:uuid',
    passport.authenticate(['local', 'basic', 'hash'], {
      session: false
    }),
    function (req, res) {
      authorizations.secureFindById(req.user.username, req.params.uuid, out(res));
    });

  // Publications
  // ============

  app.post('/publications',
    authenticateCommon(),
    function(req, res) {
      var document = req.body.document;
      var username = req.body.username;
      var data     = req.body.data;

      publications.create(document, username, data, function() {
        res.json({"status": "ok"});
      });
    });

  app.delete('/publications/:document',
    authenticateCommon(),
    function(req, res) {
      publications.clear(req.params.document, function(err) {
        if (err) {
          res.json({"status": "error", "error": err});
        }
        res.json({"status": "ok"});
      });
    });


  // Users
  // =====

  function sanitizeUser (user) {
    return _.omit(user, 'hash', 'data');
  }

  app.get('/users',
    authenticateCommon(true),
    function(req, res) {
      users.findAll(function (err, users) {
        res.json(_.map(users, sanitizeUser));
      });
    });

  app.get('/users/:username',
    authenticateCommon(true),
    function (req, res, next) {
      users.findById(req.params.username, function (err, user) {
        if (err) next(err);
        else res.json(sanitizeUser(user));
      });
    });

  // Register user
  // -----------

  app.post('/register',
    authenticateApplication(),
    function(req, res, next) {
      var params = req.body;

      users.create(params.email, params.username, params.name, params.password, function (err, uuid) {
        if (err) return res.json(500, err);
        authorizations.findOrCreate(params.username, params.client_id, 'all', function(err, authorization) {
          res.json({"status": "ok", "token": authorization.token, "username": params.username});
        });
      });
    });


  // Replication API
  // ===================
  //
  // TODO: Move to separate file
  //
  // Testing the API
  // Use CURL:
  // curl -v -X POST -H "Content-Type: application/json" -d '{"username": "michael"}' curl -X POST http://duese.quasipartikel.at:3000/api/v1/documents/create

  // Helper to access commit ranges
  function extractCommits(doc, start, end) {
    var skip = false;
    
    if (start === end) return [];
    var commit = doc.commits[start];

    if (!commit) return [];
    commit.sha = start;

    var commits = [commit];
    var prev = commit;

    while (!skip && (commit = doc.commits[commit.parent])) {
      if (end && commit.sha === end) {
        skip = true;
      } else {
        commit.sha = prev.parent;
        commits.push(commit);
        prev = commit;
      }
    }

    return commits.reverse();
  }


  // Get document by user and id
  // -----------

  // Was GET /documents/get/:username/:document

  app.get('/users/:username/documents/:document', function(req, res, next) {
    var username = req.params.username;
    var id = req.params.document;

    getStore(username).get(id, function(err, doc) {
      if (err) return res.json(500, { error: err });
      res.json(doc);
    });
  });


  // List documents for a particular user
  // -----------

  // Was GET documents/list/:username

  app.get('/users/:username/documents', function(req, res, next) {
    var username = req.params.username;
    users.findById(req.params.username, function (err, user) {
      if (err) next(err);
      else getStore(username).list(function(err, docs) {
        if (err) next(err);
        else res.json(docs);
      });
    });
  });


  // Create a fresh new document
  // -----------

  // Was POST /documents/create

  // TODO add to JSON docs

  app.post('/documents',
    authenticateCommon(),
    function(req, res, next) {
      var username = req.body.username;
      var id = req.body.id || db.uuid();
      var meta = req.body.meta;

      var store = getStore(username);
      store.create(id, function(err, doc) {
        if (err) next(err);
        else if (meta) store.updateMeta(id, meta, function(err) {
          if (err) next(err);
          else res.json(doc);
        });
        else res.json(doc);
      });
    });


  // Delete an existing document
  // -----------

  // Was POST /documents/delete

  // TODO add to JSON docs

  app.delete('/documents/:document',
    authenticateCommon(),
    function(req, res, next) {
      var username = req.body.username;
      var id = req.params.document;

      getStore(username).delete(id, function(err) {
        if (err) return res.json(500, { error: err });
        res.json({"status": "ok"});
      });
    });


  // Update an existing document
  // -----------
  //
  // Test Example
  // curl -X POST -H "Content-Type: application/json" -d '{"username": "michael", "id": "dd9e821d5e01300cf06a4c61477d18a9", "commits": [{"op": ["insert", {"id": "heading:42c72d87e40f529dba27a9970c0a6ef3","type": "heading","data": { "content": "Hello World" }}], "sha": "b0a4df43adba704eaef6809ada25bc4a"}]}' curl -X POST http://duese.quasipartikel.at:3000/api/v1/documents/update

  // Was POST /documents/update

  // TODO add to JSON docs

  app.put('/documents/:document',
    authenticateCommon(),
    function(req, res, next) {
      var username = req.body.username;
      var id = req.params.document;
      var commits = req.body.commits;
      var meta = req.body.meta;
      var refs = req.body.refs;

      var store = getStore(username);
      store.update(id, commits, function(err) {
        if (err) return res.json(500, { error: err });
   
        store.updateMeta(id, meta, function(err) {
          // Update master ref
          if (refs && refs["master"]) {
            store.setRef(id, 'master', refs.master);
            console.log('master ref has been updated to', refs.master);
          }
          
          res.json({"status": "ok"});
        });
      });
    });


  // Query documents status
  // -----------
  //
  // Example
  // curl http://duese.quasipartikel.at:3000/api/v1/documents/status/username

  // Was GET /documents/status/:username

  app.get('/users/:username/documents/statuses', function(req, res, next) {
    var username = req.params.username;

    getStore(username).list(function (err, docs) {
      var result;
      if (err) next(err);
      else {
        result = {};
        _.each(docs, function(doc) {
          // doc.id was omitted
          result[doc.id] = doc;
        });
        res.json(result);
      }
    });
  });


  // Commits (Pull)
  // -----------
  //
  // Returns all commits that happed after :synced_commit
  //
  // Example
  // curl http://duese.quasipartikel.at:3000/api/v1/documents/commits/michael/doc-1-/commit-15

  // Was GET /documents/commits/:username/:document/:start_commit
  // now requires the query parameter "since"

  app.get('/users/:username/documents/:document/commits',
    authenticateCommon(),
    function(req, res, next) {
      var username = req.params.username;
      var document = req.params.document;

      var startCommit = req.query.since;

      // TODO check the absence of query.since

      var store = getStore(username);
      store.get(document, function(err, doc) {
        var tailCommit, commits;
        if (err) next(err);
        else {
          tailCommit = store.getRef(document, 'tail');

          // TODO: we could have a low level interface for commit ranges
          commits = store.commits(document, tailCommit, startCommit);
          res.json({
            commits: commits,
            refs: doc.refs,
            meta: doc.meta
          });
        }
      });
    });

};
