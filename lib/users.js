
var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');

var reserved = require('./reserved');

var AUTHENTICATE_SQL = 'SELECT * FROM Users WHERE (email = $1 OR username = $1);',
    ALL_USERS_SQL = 'SELECT * FROM Users;',
    BY_EMAIL_SQL = 'SELECT * FROM Users WHERE email = $1;'
    BY_ID_SQL = 'SELECT * FROM Users WHERE username = $1;',
    INSERT_SQL = 'INSERT INTO Users (username, email, name, hash, created_at) VALUES ($1, $2, $3, $4, NOW());';

var SALT_ROUNDS = 10;
var users = module.exports = {};

users.findAll = function(callback) {
  db.query(ALL_USERS_SQL, db.many(callback, 'No users found'));
};

users.findById = function (id, callback) {
  db.query(BY_ID_SQL, [id], db.one(callback, 'No user found for '+id));
};

users.findByEmail = function (email, callback) {
  db.query(BY_EMAIL_SQL, [email], db.one(callback, 'No user found for '+email));
};

users.findByLogin = function (login, callback) {
  db.query(AUTHENTICATE_SQL, [login], db.one(callback, 'No user found for '+login));
};

// Gosh, something better?
users.validate = function (email, username, name, password, callback) {

  try {
    username = ((username || '') + '').trim();

    if (!email || email.indexOf('@') < 0) {
      throw new errors.WrongFieldValue('email', email);
    }

    if (!username || !/^[a-z0-9\_\-]{2,}$/i.test(username)) {
      throw new errors.WrongFieldValue('username', username);
    }

    if (!name || name.length < 4) {
      throw new errors.WrongFieldValue('name', name);
    }

    if (!password || password.length < 6) {
      throw new errors.WrongFieldValue('password', "");
    }

    if (reserved.usernames.indexOf(username) >= 0) {
      throw new errors.WrongValue("Username '"+username+"' is reserved");
    }
  }
  catch (err) {
    return callback(err, false);
  }

  users.findByEmail(email, function (err, user) {
    if (!(err instanceof errors.NoRecordFound)) {
      callback(new errors.WrongValue("Duplicate email"));
    } else users.findById(username, function (err, user) {
      if (!(err instanceof errors.NoRecordFound)) {
        callback(new errors.WrongValue("Duplicate username"));
      } else callback(null, true);
    });
  });
};

users.create = function (email, username, name, password, callback) {
  users.validate(email, username, name, password, function (err, valid) {
    if (err) callback(err, null);
    else users.insert(email, username, name, password, callback);
  });
};

users.insert = function (email, username, name, password, callback) {
  bcrypt.hash(password, SALT_ROUNDS, function (err, hash) {
    if (err) callback(err, null);
    else db.query(INSERT_SQL, [username, email, name, hash], function (err, results) {
      callback(err, username);
    });
  });
};
