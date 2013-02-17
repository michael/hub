var _ = require('underscore');

var passport = require('passport');

var admin = module.exports = {};

var delay = function (wait, fn) {
  return _.delay(fn, wait);
};

function isAdmin (user) {
  return user && user.username === 'admin';
}

admin.configure = function (app) {

  app.get('/admin/login', function (req, res) {
    if (req.user) res.redirect('/admin');
    else res.render('admin/login.jade');
  });

  app.post('/admin/login', function (req, res, next) {
    if (req.user) next();
    else passport.authenticate('local', function (err, user, info) {
      delay(400, function () {
        if (err || !user || !isAdmin(user)) {
          res.redirect('/admin/login');
        } else {
          req.login(user, function (err) {
            if (err) next(err);
            else res.redirect('/admin');
          });
        }
      });
    }).apply(this, arguments);
  });

  app.namespace('/admin',
    function (req, res, next) {
      res.locals({
        section: null
      });
      next();
    },
    function (req, res, next) {
      if (isAdmin(req.user)) {
        next();
      } else if (req.user) {
        res.redirect('/');
      } else {
        res.redirect('/admin/login');
      }
    },
    admin.routes.bind(null, app));

};


admin.routes = function (app) {

  app.get('/', function (req, res) {
    res.redirect('/admin/dashboard');
  });

  app.get('/dashboard', function (req, res) {
    res.render('admin/dashboard.jade', {
      section: 'dashboard'
    });
  });

  app.get('/users', function (req, res) {

    app.users.findAll(function (err, users) {
      if (err) next(err);
      else res.render('admin/users.jade', {
        section: 'users',
        title: 'Users',
        models: users,
        properties: ['username', 'name']
      });
    });

  });

  app.get('/apps', function (req, res) {

    app.applications.findAll(function (err, apps) {
      if (err) next(err);
      else res.render('admin/models.jade', {
        sections: 'apps',
        title: 'Applications',
        models: apps,
        properties: ['name', 'uuid', 'secret']
      });
    });

  });

  app.get('/publications', function (req, res) {
    res.render('admin/dashboard.jade', {
      section: 'publications'
    });
  });

};