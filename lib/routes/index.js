var _ = require('underscore');
var csrf = require('../csrf');
var users = require('../users');
var networks = require('../networks');

var publications = require('../publications');
var versions = require('../versions');

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

  // Blog
  // -----------

  // app.get('/blog', function(req, res) {
  //   res.render('blog', {
  //     section: 'blog',
  //     util: util
  //   });
  // });

  // Temp permalink
  // -----------

  // app.get('/blog/2013/02/01/the-new-substane-is-here', function(req, res) {
  //   res.render('blog', {
  //     section: 'blog',
  //     util: util
  //   });
  // });
  
  // app.get('/blog/2013/02/01/the-new-substance-is-here', function(req, res) {
  //   res.render('blog', {
  //     section: 'blog',
  //     util: util
  //   });
  // });


  // Recent Documents
  // -----------

  // app.get('/recent', function(req, res) {
  //   publications.findAll(function(err, documents) {
  //     res.render('documents', {
  //       documents: documents,
  //       section: 'explore',
  //       util: util
  //     });
  //   });
  // });


  // Homepage
  // -----------

  // app.get('/home', render('index', {
  //   section: 'home'
  // }));




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

};
