var util = require('./util');
var _ = require('underscore');

// Document API
// ===================
//
// Used by Substance.RemoteStore for replication

module.exports = function(app) {

  // Get document by document id including content
  // -----------

  app.get('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.params.document
      };
      global.api.execute("hubstore", "get", args, req.user, function(err, doc) {
        if (err) return res.json(err.status || 500, err);
        else res.json(doc);
      });
    });

  // Create a fresh new document
  // -----------

  app.post('/documents',
    util.requires('user'),
    function(req, res, next) {

      var id = req.body.id || db.uuid();
      var args = _.extend(req.body, {
        document: id,
        username: req.user.username
      });

      global.api.execute("hubstore", "create", args, req.user, function(err, doc) {
        if (err) return res.json(err.status || 500, err);
        else res.json(doc);
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
        if (err) return res.json(err.status || 500, err);
        else res.json({"status": "ok"});
      });
    });


  // Delete an existing document
  // -----------

  app.delete('/documents/:document',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.params.document
      };
      global.api.execute("hubstore", "delete", args, req.user, function(err) {
        if (err) return res.json(err.status || 500, err);
        else res.json({"status": "ok"});
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
        options: req.query
      }
      global.api.execute("hubstore", "commits", args, req.user, function(err, commits) {
        if (err) return res.json(err.status || 500, err);
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
        if (err) return res.json(err.status || 500, err);
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
        if (err) return res.json(err.status || 500, err);
        else res.json(info);
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
        if (err) return res.json(err.status || 500, err);
        else res.json(blob);
      });
    });

  // List blobs
  // -----------

  app.get('/documents/:document/blobs',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
        document: req.params.document
      }
      global.api.execute("hubstore", "listBlobs", args, req.user, function(err, blobIds) {
        if (err) return res.json(err.status || 500, err);
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
        if (err) return res.json(err.status || 500, err);
        else res.json({"status": "ok"});
      });
    });

  // Delete a blob
  // -----------

  app.delete('/documents/:document/blobs/:blob',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
        document: req.params.document,
        blob: req.params.blob
      };
      global.api.execute("hubstore", "deleteBlob", args, req.user, function(err, blob) {
        if (err) return res.json(err.status || 500, err);
        else res.json({"status": "ok"});
      });
    });

  // Changes API
  // ========

  app.get('/changes/:track',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
        track: req.params.track,
        last: req.body.last,
        since: req.body.since
      };
      global.api.execute("hubstore", "getChanges", args, req.user, function(err, changes) {
        if (err) return res.json(err.status || 500, err);
        else res.json(changes);
      });
    });

  app.get('/changes/:track/last',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
        track: req.params.track
      };
      global.api.execute("hubstore", "getLastChange", args, req.user, function(err, last) {
        if (err) return res.json(err.status || 500, err);
        else res.json(last);
      });
    });

  app.put('/changes/:track',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        username: req.user.username,
        track: req.params.track,
        command: req.body.command
      };
      global.api.execute("hubstore", "applyChange", args, req.user, function(err) {
        if (err) return res.json(err.status || 500, err);
        else res.json({"status": "ok"});
      });
    });

};
