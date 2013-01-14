
var pg = require('pg');
var bcrypt = require('bcrypt');
var passport = require('passport');
var oauth2orize = require('oauth2orize');

var LocalStrategy = require('passport-local').Strategy;
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;

var applications = require('./applications');
var users = require('./users');
var errors = require('./errors');

var authentication = module.exports = {};

var authenticate = function (login, password, callback) {

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

var authenticateClient = function (clientId, clientSecret, done) {

  applications.findById(clientId, function (err, application) {
    if (err) done(err);
    else if (application.secret === clientSecret) done(null, application);
    else done(null, false);
  });

};

authentication.configure = function (app) {

  var oauth = oauth2orize.createServer();

  passport.use(new LocalStrategy(authenticate));

  passport.serializeUser(function (user, done) {
    done(null, user.uuid);
  });

  passport.deserializeUser(function (id, done) {
    users.findById(id, done);
  });

  passport.use(new ClientPasswordStrategy(authenticateClient));

  oauth.serializeClient(function (client, done) {
    done(null, client.uuid);
  });

  oauth.deserializeClient(function (id, done) {
    applications.findById(id, done);
  });

  app.oauth = oauth;

};
