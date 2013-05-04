var util = require('./util');
var networks = require('../../model/networks');
var publications = require('../../model/publications');
var versions = require('../../model/versions');
var authorizations = require('../../model/authorizations');
var collaborators = require('../../model/collaborators');
var errors = require('../../errors');
var HubStore = require('../../model/hubstore');

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

  app.get('/collaborators',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.query.document
      };
      global.api.execute("collaborators", "find", args, req.user, function(err, collaborators) {
        if (err) return res.json(500, err);
        res.json(collaborators);
      });
    });

  // Create a new collaborator
  // -----------

  app.post('/collaborators',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.body.document,
        collaborator: req.body.collaborator
      };
      global.api.execute("collaborators", "create", args, req.user, function(err) {
        if (err) return res.json(500, err);
        else res.json({"status": "ok"});
      });
    });


  // Deletes a collaboration for a given document
  // -----------

  app.delete('/collaborators/:id',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        id: req.params.id
      };
      global.api.execute("collaborators", "delete", args, req.user, function(err) {
        if (err) return res.json(500, err);
        else res.json({"status": "ok"});
      });
    });


  // Query documents for which the authenticated user is registered as collaborator
  // -----------

  app.get('/collaborations',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username
      };
      global.api.execute("hubstore", "collaborations", args, req.user, function(err, collaborations) {
        if (err) return res.json(500, err);
        else res.json(collaborations);
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
};