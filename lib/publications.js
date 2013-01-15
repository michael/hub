
var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');

var errors = require('./errors');

var BY_DOCUMENT_SQL = 'SELECT * FROM Publications WHERE document = $1',
    ALL_DOCUMENTS = 'SELECT * FROM Publications ORDER BY document ASC, created_at DESC',
    DELETE_BY_DOCUMENT_SQL = 'DELETE FROM Publications WHERE document = $1',
    INSERT_SQL = 'INSERT INTO Publications (uuid, document, username, data, created_at) VALUES ($1, $2, $3, $4, NOW());';

var SALT_ROUNDS = 10;

var publications = module.exports = {};

// List most recent publications of all documents

publications.findAll = function(callback) {
  db.query(ALL_DOCUMENTS, db.many(function(err, docs) {
    if (err) return callback(err);

    var prevDoc = null;
    var result = [];
    _.each(docs, function(doc, index) {
      if (doc.document !== prevDoc) {
        var content = JSON.parse(doc.data);

        result.push({
          id: doc.document,
          created_at: doc.created_at, // latest publication
          title: content.properties.title,
          abstract: content.properties.abstract,
          creator: "michael"
        });
      }
      prevDoc = doc.document;
    });

    callback(null, result);
  }));
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
  var uuid = db.uuid();

  db.query(INSERT_SQL, [uuid, document, username, data], function (err, results) {
    console.log('INSERTING..', err);
    if (err) return callback(err, null);
    else return callback(null, uuid);
  });
};

