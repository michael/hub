var _ = require('underscore');
var csrf = require('./csrf');
var users = require('./users');
var publications = require('./publications');
var passport = require('passport');

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

var Document = function(doc) {
  this.content = doc;
};


Document.prototype.nodes = function() {
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


routes.configure = function (app) {

  app.get('/', render('index', {
    section: 'home'
  }));

  app.get('/login', render('login', {
    section: 'login'
  }));

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

  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  app.post('/publications', function(req, res) {
    publications.create(req.body.document, req.body.data, function() {
      console.log('CREATED PUblication');
    });
    res.json({"status": "ok"});
  });

  app.get('/documents/:document', function(req, res) {
    publications.findByDocument(req.params.document, function(err, publications) {
      var doc = new Document(JSON.parse(_.last(publications).data));
      var nodes = doc.nodes();
      var html = "<h1>"+doc.content.properties.title+"</h1>";

      _.each(nodes, function(node) {
        if (node.type === "heading") {
          html += "<h1>"+node.content+"</h1>"
        } else {
          html += "<p>"+node.content+"</p>"
        }
      });
      res.send(html);  
    });
  });

  // Clear publications
  app.delete('/publications/:document', function(req, res) {
    console.log('deleting...', req.params.document);
    publications.clear(req.params.document, function(err) {
      if (err) console.log('ERROR', err);
      res.json({"status": "ok"});
    });
  });

  app.get('/publications', function(req, res) {
    res.json({"status": "ok", "publications": ["a", "b", "c"]});
  });

  app.get('/users', function(req, res) {
    users.findAll(function (err, users) {
      res.json(users);
    });
  });

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

  /*app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login' }),
    function (req, res, next) {
      // TODO CRSF Check here!!
      if (req.query.redirect) {
        res.redirect(req.query.redirect);
      } else {
        next();
      }
    },
    redirect('/'));*/

  app.post('/signup', function (req, res, next) {
    var email = req.body.email;
    var username = req.body.username;
    var password = req.body.password;

    users.create(email, username, password, function (err, uuid) {
      if (err) next(err);
      else next();
    });
  }, redirect('/signup?success=true'));

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
