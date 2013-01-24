var _ = require('underscore');
var passport = require('passport');
var dir = '../../lib/';
var Store = require('../../store/src/store');

// Redis DocStore instance
// var store = new Store.RedisStore();

function getStore(username) {
  console.log('getting store for', username);
  return new Store.RedisStore({scope: username});
}

var csrf = require(dir + 'csrf');
var users = require(dir + 'users');
var publications = require(dir + 'publications');
var db = require(dir + 'db');

var apis = module.exports = {};


apis.configure = function (app) {

  app.get('/', function (req, res) {
    res.json({
      "name": "Substance API",
      "version": "1.0-alpha"
    });
  });


  app.post('/token',
    passport.authenticate('oauth2-client-password', {
      session: false
    }),
    app.oauth.token(),
    app.oauth.errorHandler(),
    function (req, res) {
      res.json({ ok: '?' });
    });


  // Create Publication
  // -----------

  app.post('/publications', function(req, res) {
    var token    = req.get('Authorization').split(' ')[1];
    var document = req.body.document;
    var username = req.body.username;
    var data     = req.body.data;

    // TODO: Check if authorized, using token from the header
    publications.create(document, username, data, function() {
      res.json({"status": "ok"});
    });
  });


  // Clear publications
  // -----------

  app.delete('/publications/:document', function(req, res) {
    publications.clear(req.params.document, function(err) {
      if (err) {
        res.json({"status": "error", "error": err});
      }
      res.json({"status": "ok"});
    });
  });


  // List all users
  // -----------

  app.get('/users', function(req, res) {
    users.findAll(function (err, users) {
      res.json(_.map(users, function (user) {
        return _.omit(user, 'hash');
      }));
    });
  });


  // Authenticate user
  // -----------

  app.post('/authenticate', function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    res.json({"status": "ok", "token": db.uuid(), "username": username});
  });


  // Register user
  // -----------

  app.post('/register', function(req, res, next) {
    var params = req.body;

    users.create(params.email, params.username, params.name, params.password, function (err, uuid) {
      if (err) return res.json({"status": "error"});
      res.json({"status": "ok", "token": db.uuid(), "username": params.username});
    });
  });


  // Replication API
  // ===================
  // 
  // TODO: Move to separate file
  // 
  // Testing the API
  // Use CURL:
  // curl -v -X POST -H "Content-Type: application/json" -d '{"username": "michael"}' curl -X POST http://duese.quasipartikel.at:3000/api/v1/documents/create


  // Get document by user and id
  // -----------

  app.get('/documents/get/:username/:document', function(req, res, next) {
    var username = req.params.username;
    var id = req.params.document;

    getStore(username).get(id, function(err, doc) {
      if (err) return res.json({"status": "error"});
      res.json(doc);
    });
  });


  // List documents for a particular user
  // -----------

  app.get('/documents/list/:username', function(req, res, next) {
    var username = req.params.username;

    getStore(username).list(function(err, docs) {
      if (err) return res.json({"status": "error"});
      res.json(docs);
    });
  });


  // Create a fresh new document
  // -----------

  app.post('/documents/create', function(req, res, next) {
    var username = req.body.username;

    getStore(username).create(db.uuid(), function(err, doc) {
      if (err) return res.json({"status": "error"});
      res.json(doc);
    });
  });  


  // Update an existing document
  // -----------
  // 
  // Test Example
  // curl -X POST -H "Content-Type: application/json" -d '{"username": "michael", "id": "dd9e821d5e01300cf06a4c61477d18a9", "commits": [{"op": ["insert", {"id": "heading:42c72d87e40f529dba27a9970c0a6ef3","type": "heading","data": { "content": "Hello World" }}], "sha": "b0a4df43adba704eaef6809ada25bc4a"}]}' curl -X POST http://duese.quasipartikel.at:3000/api/v1/documents/update

  app.post('/documents/update', function(req, res, next) {
    var username = req.body.username;
    var id = req.body.id;
    var commits = req.body.commits;

    getStore(username).update(id, commits, function(err) {
      if (err) return res.json({"status": "error", "error": err});
      res.json({"status": "ok"});
    });
  });


  // Query documents status
  // -----------
  // Example
  // curl http://duese.quasipartikel.at:3000/api/v1/documents/status/username

  app.get('/documents/status/:username', function(req, res, next) {
    var username = req.params.username;

    getStore(username).list(function(err, docs) {
      if (err) return res.json({"status": "error"});
      var result = {};
      _.each(docs, function(doc) {
        result[doc.id] = doc;
        delete result[doc.id].id;
      });
      res.json(result);
    });
  });  


  // Pull Commits
  // -----------
  // 
  // Returns all commits that happed after :synced_commit
  // 
  // Example
  // curl http://duese.quasipartikel.at:3000/api/v1/documents/pull_commits/michael/doc-1-/commit-15

  app.get('documents/commits/:username/:document/:start_commit', function(req, res, next) {
    var document = req.params.document;
    var synced_commit = req.params.synced_commit;

    // Returns all commits after synced_commit
    store.getCommits(synced_commit, function(err, commits) {
      res.json(commits);
    });
  });


  // Push Commits
  // -----------
  // Redundant (update does it already)

  // app.post('/write_commits', function(req, res, next) {
  //   var commits = JSON.parse(req.body.data);
  //   var document = req.body.document;
  //   var synced_commit = req.body.synced_commit;
  //   store.update(document, commits, function(err) {
  //     res.json({"status": "ok"});
  //   });
  // });
};
