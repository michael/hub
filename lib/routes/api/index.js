var _ = require('underscore');
var passport = require('passport');

// Redis DocStore instance
// var store = new Store.RedisStore();

var errors = require('../../errors');
var csrf = require('../../csrf');
var users = require('../../users');
var documents = require('../../documents');
var publications = require('../../publications');
var collaborators = require('../../collaborators');

var db = require('../../db');

var authorizations = require('../../authorizations');

var apis = module.exports = {};

/*function authenticate (types, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  return function (req, res, next) {
    // Signature: req, res, next, err, user, info
    var cb = _.bind(callback, null, req, res, next);
    passport.authenticate(types, options, cb).call(this, req, res, next);
  };
}*/

function authentication (app) {
  return function (req, res, next) {
    var tokenData;
    var basicData;
    var authorization = (req.get('authorization') || '').trim();
    var client_id = req.query.client_id || req.body.client_id;
    var client_secret = req.query.client_secret || req.body.client_secret;

    var checkToken = 0;
    var checkBasic = 0;
    var checkClient = 0;

    if (!authorization) {
      checkToken = 0;
      checkBasic = 0;
    }
    else if (authorization.slice(0, 6).trim() === 'token') {
      tokenData = authorization.slice(6).trim();
      checkToken = 1;
      checkBasic = 0;
      checkClient = 0;
    }
    else if (authorization.slice(0, 6).toLowerCase().trim() === 'basic') {
      basicData = authorization.slice(6).trim();
      checkBasic = 1;
      checkToken = 0;
    }
    else {
      checkToken = 0;
      checkBasic = 0;
    }

    if (!checkToken && client_id) {
      checkClient = 1;
    }

    var authErrors = [];
    var foundUser = null;
    var foundClient = null;
    var foundAuthorization = null;

    var conclude = _.after(checkToken + checkBasic + checkClient, function () {
      if (authErrors.length) next(new errors.MaybeParallel(authErrors));
      else {
        req.user = foundUser;
        req.client = foundClient;
        req.authorization = foundAuthorization;
        next();
      }
    });

    // ATTENTION: If more than one authentication strategy challenges for a property
    // (user or client) then it must be not overwritten!

    if (checkBasic) {
      app.authentication.authenticateBasic(basicData, function (err, user) {
        if (err) authErrors.push(err);
        if (!user) authErrors.push(new errors.Unauthorized("Basic Authentication failed"));
        if (!foundUser) foundUser = user;
        conclude();
      });
    }

    if (checkToken) {
      app.authentication.authenticateFullToken(tokenData, function (err, authorization, user, client) {
        if (err) authErrors.push(err);
        if (!authorization || !user || !client) authErrors.push(new errors.Unauthorized("Token Authentication failed"));
        if (!foundAuthorization) foundAuthorization = authorization;
        if (!foundUser) foundUser = user;
        if (!foundClient) foundClient = client;
        conclude();
      });
    }

    if (checkClient) {
      app.authentication.authenticateApplication(client_id, client_secret, function (err, client) {
        if (err) authErrors.push(err);
        if (!client) authErrors.push(new errors.Unauthorized("Client Authentication failed"));
        if (!foundClient) foundClient = client;
        conclude();
      });
    }
  };
}

var slice = Array.prototype.slice;

function requires () {
  var props = slice.call(arguments);
  var length = props.length;
  return function (req, res, next) {
    for (var i = 0; i<length; ++i) {
      if (!req[props[i]]) return next(new errors.Unauthorized("Authentication for "+props[i]+" not found"));
    }
    next();
  };
}

function out (res, next) {
  return function (err, data) {
    if (err) next(err);
    else res.json(data);
  };
}

apis.configure = function (app) {

  app.namespace('/api/v1',
    authentication(app),
    apis.routes.bind(null, app));

};

apis.routes = function (app) {

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
    requires('user', 'client'),
    function (req, res, next) {
      var user = req.user;
      var application = req.client;

      authorizations.findOrCreate(user.username, application.uuid, 'all', out(res, next));
    });

  app.get('/authorizations',
    requires('user'),
    function (req, res, next) {
      authorizations.findByUser(req.user.username, out(res, next));
    });

  app.put('/authorizations/:uuid',
    errors.NotImplemented.asMiddleware());

  app.delete('/authorizations/:uuid',
    errors.NotImplemented.asMiddleware());

  // Was GET /authorization

  app.get('/authorizations/current',
    requires('user', 'client'),
    function (req, res, next) {
      var user = req.user;
      var application = req.client;
      authorizations.findByUserAndApplication(user.username, application.uuid, out(res, next));
    });

  app.get('/authorizations/:uuid',
    requires('user'),
    function (req, res, next) {
      authorizations.secureFindById(req.user.username, req.params.uuid, out(res, next));
    });



  // Networks
  // ============

  // List all networks
  app.get('/networks',
    function(req, res) {

    });

  // Create a new network
  app.post('/networks',
    function(req, res) {

    });

  // Network Documents
  // ============

  app.post('/network_documents',
    requires('user'),
    function(req, res) {

    })

  app.get('/network_documents',
    requires('user'),
    function(req, res) {

    });

  // Publications
  // ============

  app.post('/publications',
    requires('user'),
    function(req, res) {
      var document = req.body.document;
      var username = req.body.username;
      var data     = req.body.data;

      publications.create(document, username, data, function() {
        res.json({"status": "ok"});
      });
    });

  app.delete('/publications/:document',
    requires('user'),
    function(req, res, next) {
      publications.clear(req.params.document, function(err) {
        if (err) next(err);
        else res.json({"status": "ok"});
      });
    });


  // Users
  // =====

  function sanitizeUser (user) {
    return _.omit(user, 'hash', 'data');
  }

  app.get('/users',
    function(req, res, next) {
      users.findAll(function (err, users) {
        if (err) next(err);
        else res.json(_.map(users, sanitizeUser));
      });
    });

  app.get('/users/:username',
    function (req, res, next) {
      users.findById(req.params.username, function (err, user) {
        if (err) next(err);
        else res.json(sanitizeUser(user));
      });
    });

  // Register user
  // -----------

  app.post('/register',
    requires('client'),
    function(req, res, next) {
      var body = req.body;

      var client = req.client;

      users.create(body.email, body.username, body.name, body.password, function (err, username) {
        if (err) next(err);
        else authorizations.findOrCreate(username, client.uuid, 'all', function(err, authorization) {
          if (err) next(err);
          else res.json({
            "status": "ok",
            "token": authorization.token,
            "username": body.username
          });
        });
      });
    });

  // Replication API
  // ===================

  // Testing the API
  // Use CURL:
  // curl -v -X POST -H "Content-Type: application/json" -d '{"username": "michael"}' curl -X POST http://duese.quasipartikel.at:3000/api/v1/documents/create


  // List documents (header only) of the authenticated user
  // -----------

  function internalError(err, next) {
    console.log("Error during replication: " + err);
    if (next) next(new errors.InternalServerError(JSON.stringify(err)));
  }

  app.get('/documents',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;

      documents.documents(username, function(err, docs) {
        if (err) internalError(err, next);
        else res.json(docs);
      });
    });

  // Create a fresh new document
  // -----------

  // TODO add to JSON docs

  app.post('/documents',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.body.id || db.uuid();
      var meta = req.body.meta;

      documents.create(username, document, meta, function(err, doc) {
        if (err) internalError(err, next);
        else res.json(doc);
      });
    });

  // Query documents for which the authenticated user is registered as collaborator
  // -----------

  app.get('/collaborations',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;

      documents.collaborations(username, function(err, collaborations){
        if (err) internalError(err, next);
        else res.json(collaborations);
      });

    });

  // Delete an existing document
  // -----------

  // TODO add to JSON docs

  app.delete('/documents/:document',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;

      console.log("Deleting document...");

      documents.getDocumentAccess(username, document, function(err, doc) {
        if (err) internalError(err, next);
        else documents.delete(doc, function(err, result) {
          if (err) internalError(err, next);
          else res.json({"status": "ok"});
        });
      });
    });

  // Update an existing document
  // -----------
  //
  // Test Example
  // curl -X POST -H "Content-Type: application/json" -d '{"username": "michael", "id": "dd9e821d5e01300cf06a4c61477d18a9", "commits": [{"op": ["insert", {"id": "heading:42c72d87e40f529dba27a9970c0a6ef3","type": "heading","data": { "content": "Hello World" }}], "sha": "b0a4df43adba704eaef6809ada25bc4a"}]}' curl -X POST http://duese.quasipartikel.at:3000/api/v1/documents/update

  app.put('/documents/:document',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;
      var commits = req.body.commits;
      var meta = req.body.meta;
      var refs = req.body.refs;

      console.log("Updating document: " + username + ", " + document);

      documents.getDocumentAccess(username, document, 'write', function(err, doc) {
        if(err) internalError(err, next);
        else documents.update(doc, commits, meta, refs, function(err, results) {
          if (err) internalError(err, next);
          else res.json({"status": "ok"});
        });
      });
    });

  // Get document by document id including content
  // -----------

  app.get('/documents/:document',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;

      console.log("Retrieving document...");

      documents.getDocumentAccess(username, document, 'read', function(err, doc) {
        documents.get(doc, function(err, fullDoc) {
          if (err) internalError(err, next);
          else res.json(fullDoc);
        });
      });
    });

  // Commits (Pull)
  // -----------
  //
  // Returns all commits that happened after ?since=

  app.get('/documents/:document/commits',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;
      var startCommit = req.query.since;

      // TODO check the absence of query.since

      console.log("Retrieving commits...");

      documents.getDocumentAccess(username, document, 'read', function(err, doc) {
        if (err) next(err);
        else documents.commits(doc, startCommit, function(err, result) {
          res.json(result);
        });
      });
    });

  // Register a collaboration for a given document
  // -----------

  app.post('/documents/:document/collaborator/:collaborator',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;
      var collaborator = req.params.collaborator;

      documents.getDocumentAccess(username, document, 'manage', function(err, doc) {
        documents.addCollaborator(doc, collaborator, function(err, results) {
          if (err) internalError(err, next);
          else res.json({"status": "ok"});
        });
      });
    });

  // Deletes a collaboration for a given document
  // -----------

  app.delete('/documents/:document/collaborator/:collaborator',
    requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var docId = req.params.document;
      var collaborator = req.params.collaborator;

      documents.getPermission(username, document, 'manage', function(err, doc) {
        documents.deleteCollaborator(doc, collaborator, function(err, results) {
          if (err) internalError(err, next);
          else res.json({"status": "ok"});
        });
      });
    });

}; // authentication
