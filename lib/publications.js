
var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');

var BY_DOCUMENT_SQL = 'SELECT * FROM Publications WHERE document = $1',
    DOCUMENT_BY_ID = 'SELECT * FROM Documents WHERE id = $1',
    ALL_DOCUMENTS_SQL = 'select d.id as id, p.created_at as created_at, p.creator as creator, p.data as data from documents d, publications p WHERE p.document=d.id AND p.revision = d.latest_revision ORDER BY p.created_at DESC;',
    DOCUMENTS_BY_USER_SQL = 'select d.id as id, p.created_at as created_at, p.creator as creator, p.data as data from documents d, publications p WHERE p.creator = $1 AND p.document=d.id AND p.revision = d.latest_revision ORDER BY p.created_at DESC;',
    DELETE_BY_DOCUMENT_SQL = 'DELETE FROM Publications WHERE document = $1',
    INSERT_DOCUMENT_SQL = 'INSERT INTO Documents (id, name, creator, latest_revision) VALUES ($1, $2, $3, $4);';
    UPDATE_DOCUMENT_SQL = 'UPDATE Documents SET latest_revision = $1 WHERE id = $2';
    INSERT_PUBLICATION_SQL = 'INSERT INTO Publications (document, revision, creator, data, created_at) VALUES ($1, $2, $3, $4, NOW());';

var SALT_ROUNDS = 10;
var publications = module.exports = {};


function convertDocs(docs) {
  var result = [];
  _.each(docs, function(doc, index) {
    var content = JSON.parse(doc.data);
    result.push({
      id: doc.id,
      created_at: doc.created_at, // latest publication
      title: content.properties.title,
      abstract: content.properties.abstract,
      creator: doc.creator
    });
  });
  return result;
}

// List all publications for a given user
publications.findDocumentsByUser = function(username, callback) {
  db.query(DOCUMENTS_BY_USER_SQL, [username], db.many(function(err, docs) {
    if (err) return callback(err);
    callback(null, convertDocs(docs));
  }, 'No publications found'));
};

// List all documents
publications.findAll = function(callback) {
  db.query(ALL_DOCUMENTS_SQL, db.many(function(err, docs) {
    if (err) return callback(err);
    callback(null, convertDocs(docs));
  }, 'No publications found'));
};

// List all publications for a given document
publications.findByDocument = function(id, callback) {
  db.query(BY_DOCUMENT_SQL, [id], db.many(callback, 'No publications found'));
};

// Delete all publications that belong to the provided document
publications.clear = function (document, callback) {
  db.query(DELETE_BY_DOCUMENT_SQL, [document], callback);
};


publications.create = function (document, username, data, callback) {

  function getDocument(callback) {
    db.query(DOCUMENT_BY_ID, [document], db.one(callback, 'Document not found'));
  }

  function createDocument(callback) { 
    db.query(INSERT_DOCUMENT_SQL, [document, null, username, 1], function (err, results) {
      return callback(null, results);
    });
  }

  function updateDocument(latest_revision, callback) {
    db.query(UPDATE_DOCUMENT_SQL, [latest_revision, document], function (err, results) {
      return callback(null, results);
    });
  }

  function createOrUpdateDocument(callback) {
    getDocument(function(err, doc) {
      if (err) {
        // Document does not exist -> create
        createDocument(function(err) {
          callback(err, 1);
        });
      } else {
        // Increment revision counter
        updateDocument(doc.latest_revision + 1, function(err) {
          callback(err, doc.latest_revision + 1);
        });
      }
    });
  }

  // 1. Get Document (if exists) and retrieve latest_revision_number
  createOrUpdateDocument(function(err, revision) {
    db.query(INSERT_PUBLICATION_SQL, [document, revision, username, data], function (err, results) {
      callback(err, revision);
    });
  });
};