var util = require('./util');

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
        if (err) return res.json(err);
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

  app.get('/documents/:document/info',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.params.document
      };
      global.api.execute("hubstore", "info", args, req.user, function(err, info) {
        console.log("/documents/"+args.document+"/info", info);
        if (err) return res.json(500, err);
        else res.json(info);
      });
    });

  // Create a fresh new document
  // -----------

  // TODO add to JSON docs

  app.post('/documents',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
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

  app.get('/documents/:document/blobs/:blob',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
        document: req.params.document,
        blob: req.params.blob
      }
      global.api.execute("hubstore", "getBlob", args, req.user, function(err, blob) {
        if (err) return res.json(500, err);
        else res.json(blob);
      });
    });

  app.get('/documents/:document/blobs',
    util.requires('user'),
    function(req, res, next) {

      var args = {
        username: req.user.username,
        document: req.params.document
      }
      global.api.execute("hubstore", "findBlobs", args, req.user, function(err, blobIds) {
        if (err) return res.json(500, err);
        else res.json(blobIds);
      });
    });

  // Create a new blob
  // -----------

  app.post('/documents/:document/blobs/:blob',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
        document: req.params.document,
        blob: req.params.blob,
        data: req.body.data
      };
      global.api.execute("hubstore", "createBlob", args, req.user, function(err, blob) {
        if (err) return res.json(500, err);
        else res.json({"status": "ok"});
      });
    });
};
