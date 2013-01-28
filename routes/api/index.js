var _ = require('underscore');
var passport = require('passport');
var dir = '../../lib/';
var Store = require('substance-store');

// Redis DocStore instance
// var store = new Store.RedisStore();

function getStore(username) {
  console.log('getting store for', username);
  return new Store.RedisStore({scope: username, port: 6380});
}

var errors = require(dir + 'errors');
var csrf = require(dir + 'csrf');
var users = require(dir + 'users');
var publications = require(dir + 'publications');

var db = require(dir + 'db');

var authorizations = require(dir + 'authorizations');

var apis = module.exports = {};

function authenticate (types, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  return function (req, res, next) {
    passport.authenticate(types, options, function (err, user, info) {
      var args = Array.prototype.slice.call(arguments);
      callback.apply(this, [req, res, next].concat(args));
    }).apply(passport, arguments);
  };
}

function authenticateCommon () {
  return passport.authenticate(['hash', 'basic'], {
    session: false
  });
}

function authenticateUser () {
  return passport.authenticate('basic', {
    session: false
  });
}


function authenticateApplication () {
  return authenticate(['oauth2-client-password'], function (req, res, next, err, client) {
    if (err) {
      next(err);
    } else if (!client) {
      res.status(401).end('Unauthorized');
    } else {
      req.client = client;
      next();
    }
  });
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
      "version": "1.0-alpha"
    });
  });

  app.post('/authorizations',
    authenticateUser(),
    authenticateApplication(),
    function (req, res) {
      var user = req.user;
      var application = req.client;

      authorizations.findOrCreate(user.username, application.uuid, 'all', out(res));
    });

  app.get('/authorization',
    authenticateUser(),
    authenticateApplication(),
    function (req, res) {
      var user = req.user;
      var application = req.client;
      authorizations.findByUserAndApplication(user.username, application.uuid, out(res));
    });

  app.get('/authorizations',
    authenticateCommon(),
    function (req, res) {
      authorizations.findByUser(req.user.username, out(res));
    });

  app.get('/authorizations/:uuid',
    passport.authenticate(['local', 'basic', 'hash'], {
      session: false
    }),
    function (req, res) {
      authorizations.secureFindById(req.user.username, req.params.uuid, out(res));
    });

  // Create Publication
  // -----------

  app.post('/publications', function(req, res) {
    var token    = req.get('Authorization').split(' ')[1];
    var document = req.body.document;
    var username = req.body.username;
    var data     = req.body.data;

    // TODO: Check if authorized, using token from the header
    publications.create(document, username, data, function() {
      res.json({"status": "ok"});
    });
  });




  // Clear publications
  // -----------

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


  // List all users
  // -----------

  app.get('/users', 
    authenticateCommon(),
    function(req, res) {
      users.findAll(function (err, users) {
        res.json(_.map(users, function (user) {
          return _.omit(user, 'hash');
        }));
      });
    });


  // Authenticate user
  // -----------

  app.post('/authenticate', function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    res.json({"status": "ok", "token": db.uuid(), "username": username});
  });


  // Register user
  // -----------

  app.post('/register', function(req, res, next) {
    var params = req.body;

    users.create(params.email, params.username, params.name, params.password, function (err, uuid) {
      if (err) return res.json({"status": "error"});
      res.json({"status": "ok", "token": db.uuid(), "username": params.username});
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

  app.get('/documents/get/:username/:document', function(req, res, next) {
    var username = req.params.username;
    var id = req.params.document;

    getStore(username).get(id, function(err, doc) {
      if (err) return res.json(500, { error: err });
      res.json(doc);
    });
  });


  // List documents for a particular user
  // -----------

  app.get('/documents/list/:username', function(req, res, next) {
    var username = req.params.username;

    getStore(username).list(function(err, docs) {
      if (err) return res.json(500, { error: err });
      res.json(docs);
    });
  });


  // Create a fresh new document
  // -----------

  app.post('/documents/create', function(req, res, next) {
    var username = req.body.username;
    var id = req.body.id || db.uuid();
    var meta = req.body.meta;

    var store = getStore(username);
    store.create(id, function(err, doc) {
      if (err) return res.json(500, { error: err });

      if (meta) {
        console.log('with metainfo');
        store.updateMeta(id, meta, function(err) {
          res.json(doc);
        });
      } else {
        console.log('without metainfo');
        res.json(doc);
      }
    });
  });  


  // Delete an existing document
  // -----------

  app.post('/documents/delete', function(req, res, next) {
    var username = req.body.username;
    var id = req.body.id;

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

  app.post('/documents/update', function(req, res, next) {
    var username = req.body.username;
    var id = req.body.id;
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
  // Example
  // curl http://duese.quasipartikel.at:3000/api/v1/documents/status/username

  app.get('/documents/status/:username', function(req, res, next) {
    var username = req.params.username;

    getStore(username).list(function(err, docs) {
      if (err) return res.json(500, { error: err });
      var result = {};
      _.each(docs, function(doc) {
        result[doc.id] = doc;
        delete result[doc.id].id;
      });
      res.json(result);
    });
  });  


  // Commits (Pull)
  // -----------
  // 
  // Returns all commits that happed after :synced_commit
  // 
  // Example
  // curl http://duese.quasipartikel.at:3000/api/v1/documents/commits/michael/doc-1-/commit-15


  app.get('documents/commits/:username/:document/:start_commit', function(req, res, next) {
    var username = req.params.username;
    var document = req.params.document;
    var startCommit = req.params.start_commit;

    var store = getStore(username);
    store.get(document, function(err, doc) {
      if (err) return res.json(500, { error: err });

      var tailCommit = store.getRef(document, 'tail');

      // TODO: we could have a low level interface for commit ranges
      var commits = store.commits(document, tailCommit, startCommit);
      res.json({
        commits: commits,
        refs: doc.refs,
        meta: doc.meta
      });
    });
  });

};
