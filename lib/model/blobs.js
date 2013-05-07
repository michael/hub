var _ = require('underscore');
var db = require('../db');
var errors = require('../errors');
var util = require('../../util/util');

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

// Get blob as image
// -----------

function getBlobBinary(args, cb) {

  console.log("blobs", "binary", args);

  var documentId = args.document;
  var blobId = args.blob;
  var blob;

  function getBlob(cb) {
    blobs.get(documentId, blobId, function(err, data) {
      blob = data;
      //console.log("publications.getBlobAsImage", blob);
      cb(err);
    });
  }

  function toBinary(cb) {
    // TODO: dispatch by type
    //  This needs a refactor of the blob api first.
    blob.type = "image/png";
    var base64data = blob.data;
    var data = base64data.replace(/^data:image\/png;base64,/,"");
    var buf = new Buffer(data, 'base64');
    blob.binaryData = buf.toString('binary');

    cb(null, blob);
  }

  util.async.sequential([getBlob, toBinary], cb);
}

var api = {
  "binary": {
    method: getBlobBinary
  }
};
global.api.register("blobs", api);
