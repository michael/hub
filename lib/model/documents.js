var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var collaborators = require('./collaborators');
var Store = require('substance-store');

var DOCUMENT_BY_ID = 'SELECT * FROM Documents WHERE id = $1',
    INSERT_DOCUMENT_SQL = 'INSERT INTO Documents (id, name, creator, latest_version) VALUES ($1, $2, $3, $4);',
    DELETE_DOCUMENT_SQL = 'DELETE FROM Documents WHERE id = $1',
    UPDATE_DOCUMENT_VERSION_SQL = 'UPDATE Documents SET latest_version = $1 WHERE id = $2';

var documents = module.exports = {};

/**
  Refactoring plan (hub #65):

- split db stuff (aim is to have a db only documents.js plus hub_store.js as aggregate)
- hub_store should expose the same API as RedisStore (= Store interface)
- use the global.api protocol for handling rights
- simplify the Store API on the way

*/

documents.get = function(document, cb) {
  db.query(DOCUMENT_BY_ID, [document], db.one(cb, "Could not find document " + document));
};

documents.create = function(document, cb) {
  db.query(INSERT_DOCUMENT_SQL, [document.id, null, document.creator, 0], cb);
};

documents.delete = function(document, cb) {
  db.query(DELETE_DOCUMENT_SQL, [document.id], function (err, results) {
    if (err) cb(new error.InternalServerError("SQL error: could not delete document."));
    else cb(null);
  });
};

// Checks if a user is the owner of a document
// --------------

documents.isCreator = function(user, document, cb) {
  documents.get(document, function(err, doc) {
    if(err) cb(err);
    else if(doc.creator !== user) cb("User is not creator.");
    else cb(null);
  });
};

documents.incrementVersion = function(document, cb) {
  documents.get(document, function(err, doc) {
    if (err) return cb(err);
    db.query(UPDATE_DOCUMENT_VERSION_SQL, [doc.latest_version+1, document], function (err, results) {
      return cb(err, doc.latest_version+1);
    });
  });
};
