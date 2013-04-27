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

  app.get('/documents/:document/publications', function(req, res, next) {
    var username = req.params.username;
    var document = req.params.document;

    publications.findByDocument(document, function(err, publications) {
      if (err) return res.json(500, err);
      res.json(publications);
    });
  });


  // Create publication for document
  // -----------

  app.post('/documents/:document/publications',
    util.requires('user'),
    function(req, res, next) {
      var pub = {
        creator: req.user.username,
        document: req.params.document,
        network: req.body.network
      };

      publications.create(pub, function(err) {
        if (err) return res.json(500, err);
        res.json(pub.network);
      });
    });

  // Remove publication from document
  // -----------

  app.delete('/documents/:document/publications/:network', function(req, res, next) {
    var username = req.params.username;
    var document = req.params.document;
    var network = req.params.network;

    publications.delete(network, document, function(err, network) {
      res.json(network);
    });
  });


  // Versions
  // ============

  // Create new version for document
  // -----------

  app.post('/documents/:document/versions',
    util.requires('user'),
    function(req, res, next) {
      var creator  = req.user.username;
      var document = req.params.document;
      var data     = JSON.parse(req.body.data);

      versions.create(document, creator, data, function(err, version) {
        if (err) return res.json(500, err);
        res.json(version);
      });
    });


  // Remove all published versions from document
  // -----------

  app.delete('/documents/:document/versions',
    util.requires('user'),
    function(req, res, next) {
      var creator  = req.user.username;
      var document = req.params.document;

      versions.deleteAll(document, function(err) {
        if (err) return res.json(500, err);
        res.json({"status": "ok"});
      });
    });

}

