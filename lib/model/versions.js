
var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var documents = require('./documents');
var blobs = require('./blobs');
var util = require ('../../util/util');

var BY_DOCUMENT_SQL = 'SELECT * FROM Versions WHERE document = $1 ORDER BY created_at DESC',
    INSERT_VERSION_SQL = 'INSERT INTO Versions (id, document, version, creator, data, created_at) VALUES ($1, $2, $3, $4, $5, NOW());',
    DELETE_VERSIONS_SQL = 'DELETE FROM Versions WHERE document = $1';

var SALT_ROUNDS = 10;
var versions = module.exports = {};

// Create a new version
// -----------

versions.create = function(version, cb) {
  if (!version.id) version.id = db.uuid();

  var funcs = [];
  _.each(version.data.blobs, function(blob) {
    funcs.push(function(cb) {
      blobs.create({docId: version.document, id: blob.id, data: blob.data}, cb);
    });
  });

  // we remove the blobs to be able to store the versions object
  // as it is into the db
  delete version.data.blobs;

  // then increment version count, then insert version
  util.async.sequential(funcs, function(err) {
    documents.incrementVersion(version.document, function(err, versionNumber) {
      if (err) return cb(err);
      db.query(INSERT_VERSION_SQL, [version.id, version.document, versionNumber, version.creator, JSON.stringify(version.data)], function(err) {
        if (err) return cb(err);
        cb(null, versionNumber);
      });
    });
  });
};

// Remove all published versions from document
// -----------
//
// TODO: Also remove associated blobs

versions.deleteAll = function(document, cb) {
  db.query(DELETE_VERSIONS_SQL, [document], db.many(function(err) {
    cb(err);
  }, 'Error when deleting versions'));
};

// Find most recent version of a document
// -----------

versions.findLatest = function(document, cb) {
  db.query(BY_DOCUMENT_SQL, [document], db.one(function(err, document) {
    if (err) return cb(err);
    document.data = JSON.parse(document.data);
    cb(null, document);
  }, 'No version found'));
};

// Declare how this model is used by the hub
var api = {
  "create": {
    ensure: global.api.isCollaboratorOrCreator,
    method: function(args, cb) {
      versions.create(args, cb);
    }
  },
  "deleteAll": {
    ensure: global.api.isCreator,
    method: function(args, cb) {
      versions.deleteAll(args.document, cb);
    }
  }

}
global.api.register("versions", api);