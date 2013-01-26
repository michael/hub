
var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');

var errors = require('./errors');

var AUTHENTICATE_SQL = 'SELECT * FROM Users WHERE (email = $1 OR username = $1);',
    ALL_USERS_SQL = 'SELECT * FROM Users;',
    BY_ID_SQL = 'SELECT * FROM Users WHERE uuid = $1;',
    INSERT_SQL = 'INSERT INTO Users (uuid, email, username, hash, created_at) VALUES ($1, $2, $3, $4, NOW());';

var SALT_ROUNDS = 10;

var users = module.exports = {};

users.findAll = function(callback) {
  db.query(ALL_USERS_SQL, db.many(callback, 'No users found'));
};

users.findById = function (id, callback) {
  db.query(BY_ID_SQL, [id], db.one(callback, 'No user found for '+id));
};

users.findByLogin = function (login, callback) {
  db.query(AUTHENTICATE_SQL, [login], db.one(callback, 'No user found for '+login));
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
