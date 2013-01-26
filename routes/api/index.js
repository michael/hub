var _ = require('underscore');
var passport = require('passport');

var dir = '../../lib/';

var errors = require(dir + 'errors');
var csrf = require(dir + 'csrf');
var users = require(dir + 'users');
var publications = require(dir + 'publications');
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
  return authenticate('oauth2-client-password', function (req, res, next, err, client) {
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
    res.json({});
  });

  app.post('/authorization',
    authenticateUser(),
    authenticateApplication(),
    function (req, res) {
      var user = req.user;
      var application = req.client;
      authorizations.findOrCreate(user.uuid, application.uuid, 'all', out(res));
    });

  app.get('/authorization',
    authenticateUser(),
    authenticateApplication(),
    function (req, res) {
      var user = req.user;
      var application = req.client;
      authorizations.findByUserAndApplication(user.uuid, application.uuid, out(res));
    });

  app.get('/authorizations',
    authenticateCommon(),
    function (req, res) {
      authorizations.findByUser(req.user.uuid, out(res));
    });

  app.get('/authorizations/:uuid',
    passport.authenticate(['local', 'basic', 'hash'], {
      session: false
    }),
    function (req, res) {
      authorizations.secureFindById(req.user.uuid, req.params.uuid, out(res));
    });


  // Create Publication
  // -----------

  app.post('/publications', function(req, res) {
    publications.create(req.body.document, req.body.data, function() {
      console.log('CREATED PUblication');
    });
    res.json({"status": "ok"});
  });


  // Clear publications
  // -----------

  app.delete('/publications/:document', 
    authenticateCommon(),
    function(req, res) {
      console.log('deleting...', req.params.document);
      publications.clear(req.params.document, function(err) {
        if (err) console.log('ERROR', err);
        res.json({"status": "ok"});
      });
    });


  // List all users
  // -----------

  app.get('/users', function(req, res) {
    users.findAll(function (err, users) {
      res.json(_.map(users, function (user) {
        return _.omit(user, 'hash');
      }));
    });
  });

};
