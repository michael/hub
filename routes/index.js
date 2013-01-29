var _ = require('underscore');
var csrf = require('../lib/csrf');
var users = require('../lib/users');
var publications = require('../lib/publications');
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
  this.doc = doc;
};

DocumentRenderer.prototype.nodes = function() {
  var result = [];
  var content = this.doc.content;

  function node(id) {
    return content.nodes[id];
  }

  if (!content.head) return;
  var current = node(content.head);
  var index = 0;

  result.push(current);
  while (current = node(current.next)) {
    index += 1;
    result.push(current);
  }
  return result;
};


DocumentRenderer.prototype.render = function() {
  var content = this.doc.content;
  var properties = content.properties;

  var html = '<div class="date">'+this.doc.created_at.toDateString()+'</div>';
  
  html += '<div class="title">'+properties.title+'</div>';
  html += '<div class="author">by '+this.doc.creator.name+'</div>';
  html += '<div class="abstract">'+properties.abstract+'</div>';

  _.each(this.nodes(), function(node) {
    if (node.type === "heading") {
      html += '<h2>'+node.content+'</h2>';
    } else {
      html += '<p>'+node.content+'</p>';
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


  // Explore
  // -----------

  app.get('/explore', function(req, res) {
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

      var doc = _.last(publications);
      if (!doc) return res.send(404, "Document Not found");

      users.findById(doc.creator, function(err, user) {
        console.log('User fetched', doc.creator, user);

        var renderer = new DocumentRenderer({
          content: JSON.parse(doc.data),
          creator: {
            username: doc.creator,
            name: user ? user.name : doc.creator,
          },
          created_at: doc.created_at
        });

        // var nodes = doc.nodes();
        var html = renderer.render();

        res.render('document', {
          content: html,
          section: 'login',
          util: util
        });        
      });
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
    });
  });


  // Logout action
  // -----------

  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });


  // Login Action
  // -----------

  app.post('/login', function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {

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
    var name = req.body.name;

    users.create(email, username, name, password, function (err, uuid) {
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


  // API v1
  // ===========

  app.namespace('/api/v1', function () {

    require('./api').configure(app);

  });

};
