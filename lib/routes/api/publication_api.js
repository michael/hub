var util = require('./util');

var networks = require('../../model/networks');
var publications = require('../../model/publications');
var versions = require('../../model/versions');

// Publication API
// ===================
//
// All publication related stuff like networks, publications and versions

module.exports = function(app) {

  // List all available networks
  // -----------

  app.get('/networks', function(req, res, next) {
    networks.list(function(err, networks) {
      res.json(networks);
    });
  });

  // Create a new network
  // -----------

  app.post('/networks',
    function(req, res) {
      // TODO: implement
    });


  // Publications
  // ============

  // List publications for a particular document
  // -----------

  app.get('/publications',
    util.requires('user'),
    function(req, res, next) {
      var document = req.query.document;

      publications.findByDocument(document, function(err, publications) {
        if (err) return res.json(500, err);
        res.json(publications);
      });
    });


  // Create publication for document
  // -----------

  app.post('/publications',
    util.requires('user'),
    function(req, res, next) {
      var pub = {
        creator: req.user.username,
        document: req.body.document,
        network: req.body.network
      };

      publications.create(pub, function(err) {
        if (err) return res.json(500, err);
        res.json(pub.network);
      });
    });


  // Remove publication from document
  // -----------
  //
  // TODO: Check if authorized!

  app.delete('/publications/:id',
    util.requires('user'),
    function(req, res, next) {
      publications.delete(req.params.id, function(err, network) {
        res.json(network);
      });
    });

  // Versions
  // ============

  // Create new version for a document
  // -----------

  app.post('/versions',
    util.requires('user'),
    function(req, res, next) {
      var version = {
        document: req.body.document,
        data: JSON.parse(req.body.data),
        creator: req.user.username
      };

      versions.create(version, function(err, version) {
        if (err) return res.json(500, err);
        res.json(version);
      });
    });


  // Remove all published versions from document
  // -----------

  app.delete('/versions',
    util.requires('user'),
    function(req, res, next) {
      var creator  = req.user.username;
      var document = req.query.document;

      versions.deleteAll(document, function(err) {
        if (err) return res.json(500, err);
        res.json({"status": "ok"});
      });
    });
}
