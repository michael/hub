var _ = require('underscore');
var csrf = require('../csrf');
var users = require('../users');
var publications = require('../publications');
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
    user: req.user || null/*,
    section: 'undefined'*/
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

  app.get('/', function(req, res) {
    res.render('info', {
      section: 'info',
      util: util
    });
  });


  // Blog
  // -----------

  app.get('/blog', function(req, res) {
    res.render('blog', {
      section: 'blog',
      util: util
    });
  });

  // Temp permalink
  // -----------

  app.get('/blog/2013/02/01/the-new-substane-is-here', function(req, res) {
    res.render('blog', {
      section: 'blog',
      util: util
    });
  });
  
  app.get('/blog/2013/02/01/the-new-substance-is-here', function(req, res) {
    res.render('blog', {
      section: 'blog',
      util: util
    });
  });


  // Explore
  // -----------

  app.get('/explore', function(req, res) {
    publications.findAll(function(err, documents) {
      res.render('documents', {
        documents: documents,
        section: 'explore',
        util: util
      });
    });
  });


  // User profile for user :username
  // -----------

  app.get('/:username', function(req, res, next) {
    var username = req.params.username;

    publications.findDocumentsByUser(username, function(err, documents) {
      if (err) next(err);
      else res.render('profile', {
        username: username,
        documents: documents,
        section: 'explore',
        util: util
      });
    });
  });


  // Homepage
  // -----------

  app.get('/home', render('index', {
    section: 'home'
  }));

  // Show Document
  // -----------

  app.get('/documents/:document', function(req, res) {
    publications.findByDocument(req.params.document, function(err, publications) {

      var doc = _.last(publications);
      if (!doc) return res.send(404, "Document Not found");

      users.findById(doc.creator, function(err, user) {

        var html = DocumentRenderer.render({
          content: JSON.parse(doc.data),
          creator: {
            username: doc.creator,
            name: user ? user.name : doc.creator
          },
          created_at: doc.created_at
        });

        res.render('document', {
          content: html,
          section: 'login',
          util: util
        });
      });
    });
  });

  // Expose JSON for Document
  // -----------

  app.get('/documents/json/:document', function(req, res) {
    publications.findByDocument(req.params.document, function(err, publications) {
      var doc = _.last(publications);
      doc.data = JSON.parse(doc.data);
      if (!doc) return res.send(404, "Document Not found");
      res.json(doc);
    });
  });

};
