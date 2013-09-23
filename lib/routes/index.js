var _ = require('underscore');
var csrf = require('../csrf');
var users = require('../model/users');

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

};
