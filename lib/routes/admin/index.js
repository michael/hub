var _ = require('underscore');

var passport = require('passport');

var admin = module.exports = {};

function isAdmin (user) {
  return user && user.username === 'admin';
}

admin.configure = function (app) {

  app.get('/admin-login', function (req, res) {
    if (req.user) res.redirect('/admin');
    else res.render('admin/login');
  });

  app.post('/admin-login', function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
      if (err || !user || !isAdmin(user)) {
        res.redirect('/admin-login');
      } else {
        req.login(user, function (err) {
          if (err) next(err);
          else res.redirect('/admin');
        });
      }
    }).apply(passport, arguments);
  });

  app.namespace('/admin',
    function (req, res, next) {
      res.locals({
        section: null,
        parseAction: parseAction
      });
      next();
    },
    function (req, res, next) {
      if (isAdmin(req.user)) {
        next();
      } else if (req.user) {
        res.redirect('/');
      } else {
        res.redirect('/admin-login');
      }
    },
    admin.routes.bind(null, app));

};


admin.routes = function (app) {

  app.get('/', function (req, res) {
    res.redirect('/admin/dashboard');
  });

  app.get('/dashboard', function (req, res) {
    res.render('admin/dashboard', {
      section: 'dashboard'
    });
  });

  app.get('/users', function (req, res) {

    app.users.findAll(function (err, users) {
      if (err) next(err);
      else res.render('admin/users', {
        section: 'users',
        title: 'Users',
        models: users,
        properties: ['username', 'name']
      });
    });

  });

  app.get('/apps', function (req, res) {
    res.render('admin/dashboard', {
      section: 'apps'
    });
  });

  app.get('/publications', function (req, res) {
    res.render('admin/dashboard', {
      section: 'publications'
    });
  });

};