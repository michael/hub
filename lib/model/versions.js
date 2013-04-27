
var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var documents = require('./documents');
var blobs = require('./blobs');
var util = require ('../../util/util');

var BY_DOCUMENT_SQL = 'SELECT * FROM Versions WHERE document = $1 ORDER BY created_at DESC',
    INSERT_VERSION_SQL = 'INSERT INTO Versions (document, version, creator, data, created_at) VALUES ($1, $2, $3, $4, NOW());',
    DELETE_VERSIONS_SQL = 'DELETE FROM Versions WHERE document = $1';

var SALT_ROUNDS = 10;
var versions = module.exports = {};

// Create a new version
// -----------

versions.create = function(document, creator, data, callback) {
  var funcs = [];
  _.each(data.blobs, function(blobData, blobId) {
    funcs.push(function(data, cb) {
      blobs.create({docId: document, id: blobId, data: blobData}, cb);
    });
  });

  delete data.blobs;

  // Create blobs, then increment version count, then insert version
  util.async(funcs, null, function(err) {
    documents.incrementVersion(document, function(err, version) {
      if (err) return callback(err);
      db.query(INSERT_VERSION_SQL, [document, version, creator, JSON.stringify(data)], function(err) {
        if (err) return callback(err);
        callback(null, version);
      });
    });
  });
};

// Remove all published versions from document
// -----------
// 
// TODO: Also remove associated blobs

versions.deleteAll = function(document, callback) {
  db.query(DELETE_VERSIONS_SQL, [document], db.many(function(err) {
    callback(err);
  }, 'Error when deleting versions'));
};

// Find most recent version of a document
// -----------

versions.findLatest = function(document, callback) {
  db.query(BY_DOCUMENT_SQL, [document], db.one(function(err, document) {
    if (err) return callback(err);
    document.data = JSON.parse(document.data);
    callback(null, document);
  }, 'No version found'));
};