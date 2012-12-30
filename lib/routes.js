
var _ = require('underscore');
var csrf = require('./csrf');
var users = require('./users');
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
