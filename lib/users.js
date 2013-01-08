
var db = require('./db');
var bcrypt = require('bcrypt');

var errors = require('./errors');

var AUTHENTICATE_SQL = 'SELECT * FROM Users WHERE (email = $1 OR username = $1);';
var ALL_USERS_SQL = 'SELECT * FROM Users';
var BY_ID_SQL = 'SELECT * FROM Users WHERE uuid = $1';
var INSERT_SQL = 'INSERT INTO Users (uuid, email, username, hash) VALUES ($1, $2, $3, $4);';

var SALT_ROUNDS = 10;

var users = module.exports = {};

var one = function (callback, message) {
  return function (err, results) {
    if (err) return callback(err);
    else if (results && results.rows && results.rows.length) return callback(null, results.rows[0]);
    else return callback(new errors.NoRecordFound(message));
  };
};

var many = function(callback, message) {
  return function(err, results) {
    if (err) return callback(err);
    else if (results && results.rows && results.rows.length) return callback(null, results.rows);
    else return callback(new errors.NoRecordFound(message));
  }
};

users.findAll = function(callback) {
  db.query(ALL_USERS_SQL, many(callback, 'No users found'));
};

users.findById = function (id, callback) {
  db.query(BY_ID_SQL, [id], one(callback, 'No user found for '+id));
};

users.findByLogin = function (login, callback) {
  db.query(AUTHENTICATE_SQL, [login], one(callback, 'No user found for '+login));
};

users.create = function (email, username, password, callback) {
  var uuid = db.uuid();
  bcrypt.hash(password, SALT_ROUNDS, function (err, hash) {
    if (err) return callback(err, null);
    else db.query(INSERT_SQL, [uuid, email, username, hash], function (err, results) {
      if (err) return callback(err, null);
      else return callback(null, uuid);
    });
  });
};
