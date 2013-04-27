var util = require('./util');
var networks = require('../../networks');
var publications = require('../../publications');
var versions = require('../../versions');
var authorizations = require('../../authorizations');
var collaborators = require('../../collaborators');
var errors = require('../../errors');

// User API
// ===================
// 
// All authentication-related stuff

module.exports = function(app) {

  // Authentication / Authorization
  // -----------

  app.post('/authorizations',
    util.requires('user', 'client'),
    function (req, res, next) {
      var user = req.user;
      var application = req.client;
      authorizations.findOrCreate(user.username, application.uuid, 'all', util.out(res, next));
    });

  app.get('/authorizations',
    util.requires('user'),
    function (req, res, next) {
      authorizations.findByUser(req.user.username, util.out(res, next));
    });

  app.put('/authorizations/:uuid',
    errors.NotImplemented.asMiddleware());

  app.delete('/authorizations/:uuid',
    errors.NotImplemented.asMiddleware());

  // Was GET /authorization
  app.get('/authorizations/current',
    util.requires('user', 'client'),
    function (req, res, next) {
      var user = req.user;
      var application = req.client;
      authorizations.findByUserAndApplication(user.username, application.uuid, util.out(res, next));
    });

  app.get('/authorizations/:uuid',
    util.requires('user'),
    function (req, res, next) {
      authorizations.secureFindById(req.user.username, req.params.uuid, util.out(res, next));
    });


  // Collaborators
  // ============

  // List collaborators for a particular document
  // -----------

  app.get('/documents/:document/collaborators',
    // requires('user'),
    function(req, res, next) {
      var document = req.params.document;

      collaborators.listCollaborators(document, function(err, collaborators) {
        if (err) return res.json(500, err);
        res.json(collaborators);
      });
    });


  // Add new collaborator to document
  // -----------

  app.post('/documents/:document/collaborators',
    // requires('user'),
    function(req, res, next) {
      var document = req.params.document;
      var collaborator = req.body.collaborator;

      collaborators.add(document, collaborator, function(err) {
        if (err) return res.json(500, err);
        res.json({"status": "ok"});
      });
    });


  // Remove existing collaborator from document
  // -----------

  app.delete('/documents/:document/collaborators/:collaborator',
    // requires('user'),
    function(req, res, next) {
      var document = req.params.document;
      var collaborator = req.params.collaborator;

      collaborators.delete(document, collaborator, function(err) {
        if (err) return res.json(500, err);
        res.json({"status": "ok"});
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
    util.requires('client'),
    function(req, res, next) {
      var body = req.body;

      var client = req.client;

      var user = {
        email: body.email,
        username: body.username,
        name: body.name,
        password: body.password
      };

      users.createSafe(user, function (err, username) {
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


  // Query documents for which the authenticated user is registered as collaborator
  // -----------

  app.get('/collaborations',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;

      documents.collaborations(username, function(err, collaborations) {
        if (err) next(err);
        else res.json(collaborations);
      });
    });


  // Create a new collaborator
  // -----------

  app.post('/documents/:document/collaborator/:collaborator',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;
      var collaborator = req.params.collaborator;

      documents.getDocumentAccess(username, document, 'manage', function(err, doc) {
        if (err) next(err);
        else documents.addCollaborator(doc, collaborator, function(err, results) {
          if (err) next(err);
          else res.json({"status": "ok"});
        });
      });
    });


  // Deletes a collaboration for a given document
  // -----------

  app.delete('/documents/:document/collaborator/:collaborator',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var docId = req.params.document;
      var collaborator = req.params.collaborator;

      documents.getDocumentAccess(username, document, 'manage', function(err, doc) {
        if (err) next(err);
        else documents.deleteCollaborator(doc, collaborator, function(err, results) {
          if (err) next(err);
          else res.json({"status": "ok"});
        });
      });
    });
};