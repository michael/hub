
var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');

var documents = require('./documents');

var BY_DOCUMENT_SQL = 'SELECT * FROM Publications WHERE document = $1',
    INSERT_VERSION_SQL = 'INSERT INTO Versions (document, version, creator, data, created_at) VALUES ($1, $2, $3, $4, NOW());',
    DELETE_VERSIONS_SQL = 'DELETE FROM Versions WHERE document = $1';

var SALT_ROUNDS = 10;
var versions = module.exports = {};


// Create a new version
versions.create = function(document, creator, data, callback) {
  documents.incrementVersion(document, function(err, version) {
    db.query(INSERT_VERSION_SQL, [document, version, creator, data], function(err) {
      if (err) return callback(err);
      callback(null, version);
    });
  });
};

// List a given version for a particular document
versions.deleteAll = function(document, callback) {
  db.query(DELETE_VERSIONS_SQL, [document], db.many(function(err) {
    callback(err);
  }, 'Error when deleting versions'));
};