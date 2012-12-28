
var _ = require('underscore');

var users = require('../lib/users');
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

routes.commonHelper = function (req, res, next) {
  var path = req.path;

  res.locals.title = '';
  res.locals.user = req.user || null;

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
    });
  });

  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login' }),
    redirect('/'));

  app.post('/signup', function (req, res, next) {
    var email = req.body.email;
    var username = req.body.username;
    var password = req.body.password;

    users.create(email, username, password, function (err, uuid) {
      if (err) next(err);
      else next();
    });
  }, redirect('/signup?success=true'));

};
