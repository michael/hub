var db = require('./db');
var bcrypt = require('bcrypt');

var errors = require('./errors');

var BY_DOCUMENT_SQL = 'SELECT * FROM Publications WHERE document = $1';

var DELETE_BY_DOCUMENT_SQL = 'DELETE FROM Publications WHERE document = $1';

var BY_ID_SQL = 'SELECT * FROM Publications WHERE document = $1';
var INSERT_SQL = 'INSERT INTO Publications (uuid, document, data, created_at) VALUES ($1, $2, $3, NOW());';


var SALT_ROUNDS = 10;

var publications = module.exports = {};

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

publications.findByDocument = function(id, callback) {
  db.query(BY_DOCUMENT_SQL, [id], many(callback, 'No publications found'));
};

// publications.findById = function (id, callback) {
//   db.query(BY_ID_SQL, [id], one(callback, 'No user found for '+id));
// };

// users.findByLogin = function (login, callback) {
//   db.query(AUTHENTICATE_SQL, [login], one(callback, 'No user found for '+login));
// };

// Delete all publications that belong to the provided document

publications.clear = function (document, callback) {
  db.query(DELETE_BY_DOCUMENT_SQL, [document], callback);
};

publications.create = function (document, data, callback) {
  var uuid = db.uuid();

  db.query(INSERT_SQL, [uuid, document, data], function (err, results) {
    console.log('INSERTING..', err);
    if (err) return callback(err, null);
    else return callback(null, uuid);
  });
};

