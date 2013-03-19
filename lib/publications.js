var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');
var versions = require('./versions');

var BY_DOCUMENT_SQL = 'SELECT * FROM Publications WHERE document = $1',
    DOCUMENT_BY_ID = 'SELECT * FROM Documents WHERE id = $1',
    ALL_DOCUMENTS_SQL = 'SELECT d.id as id, p.created_at as created_at, p.creator as creator, p.data as data from documents d, publications p WHERE p.document=d.id AND p.revision = d.latest_revision ORDER BY p.created_at DESC;',
    DOCUMENTS_BY_USER_SQL = 'SELECT d.id as id, p.created_at as created_at, p.creator as creator, p.data as data from documents d, publications p WHERE p.creator = $1 AND p.document=d.id AND p.revision = d.latest_revision ORDER BY p.created_at DESC;',
    DOCUMENTS_BY_NETWORK_SQL = 'SELECT d.id as id, p.created_at as created_at, p.creator as creator, p.data as data FROM documents d, publications p, network_documents nd WHERE nd.network = $1 AND nd.document=d.id AND p.document=d.id AND p.revision = d.latest_revision ORDER BY p.created_at DESC;',
    DELETE_PUBLICATION_SQL = 'DELETE FROM Publications WHERE network = $1 AND document = $2 AND revision = $3',
    UPDATE_DOCUMENT_SQL = 'UPDATE Documents SET latest_version = $1 WHERE id = $2',
    INSERT_PUBLICATION_SQL = 'INSERT INTO Publications (network, document, version, creator, state) VALUES ($1, $2, $3, $4, $5);',
    UPDATE_PUBLICATION_SQL = 'UPDATE Publications SET version = $1, state = $2 WHERE network = $3 AND document = $4;',
    DELETE_PUBLICATION_SQL = 'DELETE FROM Publications WHERE network = $1 AND document = $2';

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

publications.findDocumentsByNetwork = function(network, callback) {
  db.query(DOCUMENTS_BY_NETWORK_SQL, [network], db.many(function(err, docs) {
    console.log('ERR', err);
    if (err) return callback(err);
    callback(null, convertDocs(docs));
  }, 'No publications found'));
};

// List all publications for a given user
publications.findDocumentsByUser = function(username, callback) {
  db.query(DOCUMENTS_BY_USER_SQL, [username], db.many(function(err, docs) {
    if (err) return callback(err);
    callback(null, convertDocs(docs));
  }, 'No publications found'));
};

// List all documents
// Move to documents.js?
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


var documents = {};
documents.updateDocument = function(document, latest_version, callback) {
  console.log('updating doc to version', latest_version);
  db.query(UPDATE_DOCUMENT_SQL, [latest_version, document], function (err, results) {
    return callback(err, latest_version);
  });
};

documents.incrementVersion = function(document, callback) {
  db.query(DOCUMENT_BY_ID, [document], db.one(function(err, doc) {
    console.log('fetched doc', doc);
    documents.updateDocument(document, doc.latest_version+1, callback);
  }, 'Document not found'));
};

publications.create = function(network, document, creator, callback) {
  db.query(INSERT_PUBLICATION_SQL, [network, document, 0, creator, 'active'], function (err, results) {
    console.log('created publication', err);
    if (err) return callback(err);
    callback(err, network);
  });
};


// Update Publication
// publications.update = function(network, document, creator, data, callback) {
//   // 1. Create version if data present

//   // given that data is preset
//   documents.incrementVersion(document, function(err, version) {
//     // 1. create version base don data
//     versions.create(document, version, creator, data, function(err) {
//       console.log('created version');

//       // 2. update publication entry which connects the document and network
//       db.query(UPDATE_PUBLICATION_SQL, [version, 'active', network, document], function (err) {
//         console.log('updated publication', err);
//         if (err) return callback(err);
//         callback(err, network);
//       });
//     });
//   });
// };


// Delete publication

publications.delete = function(network, document, callback) {
  db.query(DELETE_PUBLICATION_SQL, [network, document], function (err) {
    console.log('MEEH', network, document, err);
    if (err) return callback(err);
    callback(err);
  });
};