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

  function annotationsForNode(node) {
    var annotations = content.annotations;
    var result = [];
    var mappings = {
      "starts": {},
      "ends": {}
    };

    function registerMapping(type, index, annotation) {
      if (!mappings[type][index]) mappings[type][index] = [];
      mappings[type][index].push(annotation);
    }

    _.each(annotations, function(a) {
      if (a.node === node.id && a.pos) {
        result.push(a);
        registerMapping('starts', a.pos[0], a);
        registerMapping('ends', a.pos[0] + a.pos[1], a);
      }
    });

    return mappings;
  }

  function renderAnnotatedContent(node) {
    var mappings = annotationsForNode(node);

    function tagsFor(type, index) {
      var annotations = mappings[type][index];
      var res = "";

      _.each(annotations, function(a) {
        if (type === "starts") {
          res += '<span class="'+a.type+'">';
        } else {
          res += '</span>';
        }
      });
      return res;
    }

    var output = "";
    _.each(node.content.split(''), function(ch, index) {
      // 1. prepend start tags
      output += tagsFor("starts", index);

      // 2. add character
      output += ch;

      // 3. append end tags
      output += tagsFor("ends", index);
    });
    return output;
  }


  var html = '<div class="date">'+this.doc.created_at.toDateString()+'</div>';
  
  html += '<div class="title">'+properties.title+'</div>';
  html += '<div class="author">by <a href="/'+this.doc.creator.username+'">'+this.doc.creator.name+'</a></div>';
  html += '<img src="/images/separator.png">';

  if (properties.abstract && properties.abstract !== "Enter abstract") {
    html += '<div class="abstract">'+properties.abstract+'</div>';  
  }

  _.each(this.nodes(), function(node) {
    if (node.type === "heading") {
      html += '<h2>'+renderAnnotatedContent(node)+'</h2>';
    } else {
      html += '<p>'+renderAnnotatedContent(node)+'</p>';
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

  // Temp permalink
  // -----------

  app.get('/blog/2012/04/25/the-new-substane-is-here', function(req, res) {
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

  app.get('/:username', function(req, res) {
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
