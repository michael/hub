var util = require('./util');
var HubStore = require('../../model/hubstore');

// Document API
// ===================
//
// Used by Substance.RemoteStore for replication

module.exports = function(app) {

  // Delete an existing document
  // -----------

  app.delete('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.params.document
      };
      global.api.execute("hubstore", "delete", args, req.user, function(err) {
        if (err) return res.json(500, err);
        else res.json({"status": "ok"});
      });
    });

  // Update an existing document
  // -----------

  app.put('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.params.document,
        commits: req.body.commits,
        meta: req.body.meta,
        refs: req.body.refs,
      };
      global.api.execute("hubstore", "update", args, req.user, function(err) {
        if (err) return res.json(500, err);
        else res.json({"status": "ok"});
      });
    });

  // Get document by document id including content
  // -----------

  app.get('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.params.document
      };
      global.api.execute("hubstore", "get", args, req.user, function(err, doc) {
        if (err) return res.json(500, err);
        else res.json(doc);
      });
    });


  // Commits (Pull)
  // -----------
  //
  // Returns all commits that happened after ?since=

  app.get('/documents/:document/commits',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.params.document,
        startCommit: req.query.since
      }
      global.api.execute("hubstore", "commits", args, req.user, function(err, commits) {
        if (err) return res.json(500, err);
        else res.json(commits);
      });
    });


  // List documents (header only) of the authenticated user
  // -----------

  app.get('/documents',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username
      }
      global.api.execute("hubstore", "find", args, req.user, function(err, docs) {
        if (err) return res.json(500, err);
        else res.json(docs);
      });
    });


  // Create a fresh new document
  // -----------

  // TODO add to JSON docs

  app.post('/documents',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        creator: req.user.username,
        document: req.body.id || db.uuid(),
        meta: req.body.meta
      }
      global.api.execute("hubstore", "create", args, req.user, function(err, doc) {
        if (err) return res.json(500, err);
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