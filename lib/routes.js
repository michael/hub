var _ = require('underscore');
var csrf = require('./csrf');
var users = require('./users');
var publications = require('./publications');
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



var DocumentRenderer = function(doc) {
  this.content = doc;
};

DocumentRenderer.prototype.nodes = function() {
  var result = [];
  var doc = this.content;

  function node(id) {
    return doc.nodes[id];
  }

  if (!doc.head) return;
  var current = node(doc.head);
  var index = 0;

  result.push(current);
  while (current = node(current.next)) {
    index += 1;
    result.push(current);
  }
  return result;
};

DocumentRenderer.prototype.render = function() {
  var html = '<div class="title">'+this.content.properties.title+'</div>';
  
  html += '<div class="author">Michael Aufreiter</div>';
  html += '<div class="date">Fri Apr 20 2012</div>';
  html += '<div class="abstract">'+this.content.properties.abstract+'</div>';

  _.each(this.nodes(), function(node) {
    if (node.type === "heading") {
      html += '<h2>'+node.content+'</h2>'
    } else {
      html += '<p>'+node.content+'</p>'
    }
  });
  return html;
};


// View Helpers

var util = {
  timeago: function(date) {
    return moment(date).fromNow();
  }
};


routes.configure = function (app) {

  // Views
  // ===========


  // Index
  // -----------

  app.get('/', function(req, res) {
    publications.findAll(function(err, documents) {
      // res.json(documents);
      res.render('documents', {
        documents: documents,
        section: 'login',
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
      var renderer = new DocumentRenderer(JSON.parse(_.last(publications).data));
      // var nodes = doc.nodes();

      var html = renderer.render();

      res.render('document', {
        content: html,
        section: 'login',
        util: util
      });

      // res.send(html);  
    });
  });


  // Login Form
  // -----------

  app.get('/login', render('login', {
    section: 'login'
  }));


  // Signup Form
  // -----------

  app.get('/signup', function (req, res) {
    var view;
    if (req.query.success !== 'true') {
      view = 'signup';
    } else {
      view = 'signup-success';
    }

    res.render(view, {
      section: 'signup'
    }, next);
  });


  // Logout action
  // -----------

  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });


  // API
  // ===========

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
      res.json(users);
    });
  });


  // Login Action
  // -----------

  app.post('/login', function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {

      console.log('')

      // TODO CSRF!!!!
      var redirect;
      var redirectKey = req.body.redirect;

      if (err) {
        return next(err);
      } else if (!user) {
        return res.redirect('/login?redirect=' + redirectKey);
      }

      req.login(user, function (err) {
        if (err) {
          next(err);
        } else {
          csrf.check(redirectKey, function (err, redirect) {
            if (err) {
              next(err);
            } else {
              res.redirect(redirect || '/');
            }
          });
        }
      });

    }).apply(passport, arguments);

  });


  // Signup Action
  // -----------

  app.post('/signup', function (req, res, next) {
    var email = req.body.email;
    var username = req.body.username;
    var password = req.body.password;

    users.create(email, username, password, function (err, uuid) {
      if (err) next(err);
      else next();
    });
  }, redirect('/signup?success=true'));


  // Settings Dialog
  // -----------

  app.get('/settings', logged(), redirect('/settings/profile'));

  function setting (name) {
    app.get('/settings/' + name, logged(), render('settings/' + name, {
      section: 'settings',
      page: name
    }));
  }

  setting('profile');
  setting('avatar');
  setting('networks');
  setting('documents');
};
