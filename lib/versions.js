
var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');

var BY_DOCUMENT_SQL = 'SELECT * FROM Publications WHERE document = $1',
    INSERT_VERSION_SQL = 'INSERT INTO Versions (document, version, creator, data, created_at) VALUES ($1, $2, $3, $4, NOW());';
    DELETE_VERSION_SQL = 'DELETE FROM Versions WHERE network = $1 AND document = $2';

var SALT_ROUNDS = 10;
var versions = module.exports = {};

// Create a new version
versions.create = function(document, version, creator, data, callback) {
  db.query(INSERT_VERSION_SQL, [document, version, creator, data], function(err) {
    console.log('creating version', err);
    if (err) return callback(err);
    callback(null);
  });
};

// List a given version for a particular document
versions.delete = function(document, version, callback) {
  db.query(DELETE_VERSION_SQL, [username], db.many(function(err, docs) {
    if (err) return callback(err);
    callback(null, convertDocs(docs));
  }, 'No publications found'));
};