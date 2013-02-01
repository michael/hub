
var express = require('express'),
    resource = require('express-resource'),
    assets = require('connect-assets'),
    crypto = require('crypto'),
    path = require('path'),
    passport = require('passport');

require('express-namespace');

var setup = require('./lib/setup');
var authentication = require('./lib/authentication');
var users = require('./lib/users');
var users = require('./lib/publications');
var errors = require('./lib/errors');

var db = require('./lib/db');
var routes = require('./routes');


module.exports = function create () {

  var app = express();

  app.configure(function () {

    app.set('port', process.env.PORT || 3000);
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/views');

    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.session({ secret: 'unicorns are cute' }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.use(routes.commonHelper);
    app.use(gravatars);
    app.use(app.router);

    app.use(assets());
    app.use(errors.errorHandler());

    app.use(express['static'](path.join(__dirname, 'assets')));

  });

  app.configure('development', function(){
    app.use(express.errorHandler());

    db.configure({
      host: 'localhost',
      user: process.env.USER,
      password: process.env.USER
    });
  });

  authentication.configure(app);

  routes.configure(app);

  setup();

  return app;
};

function md5(str) {
  var hasher = crypto.createHash('md5');
  hasher.update(str);
  return hasher.digest('hex');
}

function gravatars(req, res, next) {
  var gravatarUrl = 'http://www.gravatar.com/avatar/';
  if (req.user) {
    res.locals.gravatar = gravatarUrl + md5(req.user.email) + '?s=80';
  }
  next();
}
