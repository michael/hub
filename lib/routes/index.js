var _ = require('underscore');
var csrf = require('../csrf');
var users = require('../model/users');
var networks = require('../model/networks');

var publications = require('../model/publications');
var versions = require('../model/versions');

var DocumentRenderer = require('../document_renderer');
var passport = require('passport');
var moment = require('moment');

var routes = module.exports = {};


function redirect (where) {
  return function (req, res) {
    return res.redirect(where);
  };
}

function render (view, locals) {
  return function (req, res) {
    res.render(view, locals);
  };
}

function logged () {
  return function (req, res, next) {
    if (req.user) {
      next();
    } else {
      res.redirect('/login?redirect=' + csrf.enable(req.url));
    }
  };
}

routes.commonHelper = function (req, res, next) {
  var path = req.path;

  var query = req.query;
  var body = req.body;

  res.locals({
    redirect: query.redirect || '',
    title: '',
    user: req.user || null
  });

  next();
};

// View Helpers

var util = {
  timeago: function(date) {
    return moment(date).fromNow();
  }
};


routes.configure = function (app) {

  // API v1
  // ===========

  require('./api').configure(app);


  // Administration
  // ===========

  require('./admin').configure(app);


  // Views
  // ===========

  // Startpage
  // -----------

  app.get('/info', function(req, res) {
    res.render('info', {
      section: 'info',
      util: util
    });
  });


  // Composer
  // -----------

  app.get('/config.json', function(req, res) {
    app.env
    var config = {
      "env": app.env,
    };

    config[app.env] = {
      hub: "",
      hub_api: "/api/v1",
      client_id: "hello-kitty",
      client_secret: "abcd"
    };
    res.json(config);
  });

  // Explore
  // -----------

  app.get('/', function(req, res) {
    networks.list(function(err, networks) {
      res.render('networks', {
        section: 'explore',
        util: util,
        networks: networks
      });
    });
  });



  // User profile for user :username
  // -----------

  app.get('/users/:username', function(req, res) {
    var username = req.params.username;

    publications.findDocumentsByUser(username, function(err, documents) {
      res.render('profile', {
        username: username,
        documents: documents,
        section: 'explore',
        util: util
      });
    });
  });


  // Expose JSON for Document
  // -----------

  app.get('/documents/json/:document', function(req, res) {
    versions.findLatest(req.params.document, function(err, doc) {
      if (!doc) return res.send(404, "Document Not found");
      res.json(doc);
    });
  });


  // Show Document
  // -----------

  app.get('/:network/:document', function(req, res) {
    var network = req.params.network;
    var document = req.params.document;

    networks.findById(network, function(err, network) {
      if (err) return res.send(404, "Network not found");
      versions.findLatest(document, function(err, doc) {
        if (!doc) return res.send(404, "Document Not found");

        users.findById(doc.creator, function(err, user) {
          var html = DocumentRenderer.render({
            data: doc.data,
            creator: {
              username: doc.creator,
              name: user ? user.name : doc.creator
            },
            created_at: doc.created_at
          });

          res.render('document', {
            content: html,
            network: network,
            section: 'login',
            util: util,
            document: {
              title: doc.data.properties.title
            }
          });
        });
      });
    });
  });


  // Network (if nothing else matches)
  // -----------

  app.get('/:network', function(req, res) {
    var id = req.params.network;

    networks.findById(id, function(err, network) {
      if (err) return res.send(404, "Network not found");
      publications.findDocumentsByNetwork(id, function(err, documents) {
        res.render('network', {
          section: 'networks',
          util: util,
          network: network,
          documents: documents
        });
      });
    });
  });

  app.get('/blobs/:document/:blob', function(req, res, next) {
    var args = {
      document: req.params.document,
      blob: req.params.blob,
    };
    global.api.execute("blobs", "binary", args, null, function(err, blob) {
      if (err) return res.json(500, err);
      res.writeHead(200, {
        'Content-Type': blob.type,
        'Content-Length': blob.binaryData.length
      });
      res.end(blob.binaryData, 'binary');
    })
  });

};
