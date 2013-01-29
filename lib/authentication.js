
var pg = require('pg');
var bcrypt = require('bcrypt');
var passport = require('passport');

var BasicStrategy = require('passport-http').BasicStrategy;
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;
var HashStrategy = require('passport-hash').Strategy;
var LocalStrategy = require('passport-local').Strategy;

var authorizations = require('./authorizations');
var applications = require('./applications');
var users = require('./users');
var errors = require('./errors');

var authentication = module.exports = {};

var authenticateLogin = function (login, password, callback) {
  users.findByLogin(login, function (err, user) {
    if (err instanceof errors.NoRecordFound) return callback(null, false, err);
    if (err) return callback(err);

    bcrypt.compare(password, user.hash, function (err, result) {
      if (result) {
        callback(null, user);
      } else {
        callback(null, false, new Error('Password mismatch'));
      }
    });
  });
};

var authenticateApplication = function (applicationId, applicationSecret, done) {
  applications.findById(applicationId, function (err, application) {
    if (err) done(err);
    else if (application.secret === applicationSecret) done(null, application);
    else done(null, false);
  });
};

var authenticateTokenOptions = {
  hashParam: 'token',
  headerField: 'Authorization'
};


var authenticateToken = function (param, done) {
  var token = (param || '').trim().split(/\s*token\s*/).join('');

  authorizations.findByToken(token, function (err, authorization) {
    if (err instanceof errors.NoRecordFound) done(null, false);
    else if (err) done(err);
    else if (!authorization) done(null, false);
    else users.findById(authorization.user_uuid, function (err, user) {
      if (err instanceof errors.NoRecordFound) done(null, false);
      if (err) done(err);
      else if (!user) done(null, false);
      else done(null, user);
    });
  });

};

authentication.configure = function (app) {

  // Web client authentication
  passport.use(new LocalStrategy(authenticateLogin));

  passport.serializeUser(function (user, done) {
    done(null, user.username);
  });

  passport.deserializeUser(function (id, done) {
    users.findById(id, done);
  });

  passport.use(new BasicStrategy(authenticateLogin));

  passport.use(new HashStrategy(authenticateTokenOptions, authenticateToken));

  passport.use(new ClientPasswordStrategy(authenticateApplication));

};
