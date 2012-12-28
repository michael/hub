
var pg = require('pg');
var bcrypt = require('bcrypt');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

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
}

authentication.configure = function (app) {
  passport.use(new LocalStrategy(authenticate));

  passport.serializeUser(function (user, done) {
    done(null, user.uuid);
  });

  passport.deserializeUser(function (id, done) {
    users.findById(id, done);
  });
}
