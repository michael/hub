var _ = require('underscore');
var passport = require('passport');

var dir = '../../lib/';

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
    console.log('deleting...', req.params.document);
    publications.clear(req.params.document, function(err) {
      if (err) {
        console.log('ERROR', err);
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


  // Query document states by username
  // -----------

  app.post('/document_states/:user', function(req, res, next) {
    var user = req.params.user;
    store.getDocStates(function(err, documents) {
      res.json(documents);
    });
  });


  // Pull Commits
  // -----------

  app.post('/pull_commits/:document/:synced_commit', function(req, res, next) {
    var synced_commit = req.params.synced_commit;

    // Returns all commits after synced_commit
    store.getCommits(synced_commit, function(err, commits) {
      res.json(commits);
    });

  });

  // Push Commits
  // -----------

  app.post('/push_commits', function(req, res, next) {
    var commits = JSON.parse(req.body.data);
    var document = req.body.document;
    var synced_commit = req.body.synced_commit;
    store.update(document, commits, function(err) {
      res.json({"status": "ok"});
    });
  });

};
