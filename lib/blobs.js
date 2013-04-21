var _ = require('underscore');
var db = require('./db');
var errors = require('./errors');

var BLOB_BY_ID = 'SELECT * FROM Blobs WHERE document = $1 AND id = $2',
    BLOB_OF_DOCUMENTS = 'SELECT * FROM Blobs WHERE document = $1'
    INSERT_BLOB = 'INSERT INTO Blobs (document, id, data) VALUES ($1, $2, $3);',
    UPDATE_BLOB = 'UPDATE Blobs SET data = $3 WHERE document = $1 AND id = $2',
    DELETE_BLOB = 'DELETE FROM Blobs WHERE document = $1 AND id = $2';

var blobs = module.exports = {};

blobs.create = function(blob, cb) {
  // Always overwrite
  blobs.delete(blob.docId, blob.id, function(err) {
    db.query(INSERT_BLOB, [blob.docId, blob.id, blob.data], function (err, results) {
      return cb(err, !err);
    });
  });
};

blobs.get = function(docId, blobId, cb) {
  db.query(BLOB_BY_ID, [docId, blobId], db.one(cb, "Could not find blob " + docId + ":" + blobId));
};


blobs.delete = function(docId, blobId, cb) {
  db.query(DELETE_BLOB, [docId, blobId], function(err) {
    cb(null); // silent for now
  });
};