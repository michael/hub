
var _ = require('underscore');

var dir = '../../lib/';

var csrf = require(dir + 'csrf');
var users = require(dir + 'users');
var publications = require(dir + 'publications');

var apis = module.exports = {};


apis.configure = function (app) {

  app.get('/', function (req, res) {
    res.json({});
  });


  // Create Publication
  // -----------

  app.post('/publications', function(req, res) {
    publications.create(req.body.document, req.body.data, function() {
      console.log('CREATED PUblication');
    });
    res.json({"status": "ok"});
  });


  // Clear publications
  // -----------

  app.delete('/publications/:document', function(req, res) {
    console.log('deleting...', req.params.document);
    publications.clear(req.params.document, function(err) {
      if (err) console.log('ERROR', err);
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

};
