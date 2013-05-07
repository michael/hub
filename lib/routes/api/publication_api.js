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
      // Who should be able to do that?
    });


  // Publications
  // ============

  // List publications for a particular document
  // -----------

  app.get('/publications',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.query.document
      };
      global.api.execute("publications", "find", args, req.user, function(err, publications) {
        if (err) return res.json(500, err);
        res.json(publications);
      });
    });


  // Create publication for document
  // -----------

  app.post('/publications',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        creator: req.user.username,
        document: req.body.document,
        network: req.body.network
      };
      global.api.execute("publications", "create", args, req.user, function(err) {
        if (err) return res.json(500, err);
        res.json(args.network);
      });
    });


  // Remove publication from document
  // -----------
  //

  app.delete('/publications/:id',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        publication: req.params.id
      };
      global.api.execute("publications", "delete", args, req.user, function(err, network) {
        if (err) return res.json(500, err);
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
      var args = {
        document: req.body.document,
        data: JSON.parse(req.body.data),
        creator: req.user.username
      };
      global.api.execute("versions", "create", args, req.user, function(err, version) {
        if (err) return res.json(500, err);
        res.json(version);
      });
    });


  // Remove all published versions from document
  // -----------

  app.delete('/versions',
    util.requires('user'),
    function(req, res, next) {
      var args = {
        document: req.query.document,
        creator: req.user.username,
      };
      global.api.execute("versions", "deleteAll", args, req.user, function(err) {
        if (err) return res.json(500, err);
        res.json({"status": "ok"});
      });
    });
}
