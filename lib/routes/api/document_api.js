var util = require('./util');
var documents = require('../../documents');

// Document API
// ===================
// 
// Used by Substance.RemoteStore for replication

module.exports = function(app) {

  // Delete an existing document
  // -----------

  // TODO add to JSON docs

  app.delete('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;

      documents.getDocumentAccess(username, document, 'delete', function(err, doc) {
        if (err) res.json(err.status, err);
        else documents.delete(doc, function(err, result) {
          if (err) next(err);
          else res.json({"status": "ok"});
        });
      });
    });

  // Update an existing document
  // -----------

  app.put('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;
      var commits = req.body.commits;
      var meta = req.body.meta;
      var refs = req.body.refs;

      documents.getDocumentAccess(username, document, 'write', function(err, doc) {
        if(err) next(err);
        else documents.update(doc, commits, meta, refs, function(err, results) {
          if (err) next(err);
          else res.json({"status": "ok"});
        });
      });
    });

  // Get document by document id including content
  // -----------

  app.get('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;

      documents.getDocumentAccess(username, document, 'read', function(err, doc) {
        if (err) next(err);
        else documents.get(doc, function(err, fullDoc) {
          if (err) next(err);
          else res.json(fullDoc);
        });
      });
    });


  // Commits (Pull)
  // -----------
  //
  // Returns all commits that happened after ?since=

  app.get('/documents/:document/commits',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.params.document;
      var startCommit = req.query.since;

      // TODO check the absence of query.since
      documents.getDocumentAccess(username, document, 'read', function(err, doc) {
        if (err) next(err);
        else documents.commits(doc, startCommit, function(err, result) {
          res.json(result);
        });
      });
    });


  // List documents (header only) of the authenticated user
  // -----------

  app.get('/documents',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;

      documents.documents(username, function(err, docs) {
        if (err) next(err);
        else res.json(docs);
      });
    });


  // Create a fresh new document
  // -----------

  // TODO add to JSON docs

  app.post('/documents',
    util.requires('user'),
    function(req, res, next) {
      var username = req.user.username;
      var document = req.body.id || db.uuid();
      var meta = req.body.meta;

      documents.create(username, document, meta, function(err, doc) {
        if (err) next(err);
        else res.json(doc);
      });
    });



  // Blobs
  // ============

  // Get blob by id
  // -----------

  app.get('/documents/:docId/blob/:blobId', function(req, res, next) {
    throw "Needs to be reimplemented talking to the new HubStore interface";
    // var username = req.params.username;
    // var docId = req.params.docId;
    // var blobId = req.params.blobId;
  });


  // Get blob as image
  // -----------
  // TODO: move to frontend - this doesn't need to be an API service

  app.get('/documents/:docId/image/:blobId', function(req, res, next) {
    throw "Needs to be reimplemented talking to the new HubStore interface";
    var username = req.params.username;
    var docId = req.params.docId;
    var blobId = req.params.blobId.replace('_', ':');

    blobs.get(docId, blobId, function(err, blob) {
      if (err) return res.json(500, err);
      var base64data = blob.data;
      var data = base64data.replace(/^data:image\/png;base64,/,"");
      var buf = new Buffer(data, 'base64');
      var binaryData = buf.toString('binary');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': binaryData.length
      });
      res.end(binaryData, 'binary');
    });
  });


  // Post a new blob
  // -----------

  app.post('/documents/:docId/blob/:blobId', function(req, res, next) {
    throw "Needs to be reimplemented talking to the new HubStore interface";
    var username = req.params.username;
    var docId = req.params.docId;
    var blobId = req.params.blobId;
    // should be base64
    var data = req.body.data;

    var blob = {
      id: blobId,
      docId: docId,
      data: data
    }

    blobs.create(blob, function(err, success) {
      if (err) return res.json(500, err);
      res.json({"status": "ok"});
    });
  });


};