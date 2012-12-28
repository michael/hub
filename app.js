
var express = require('express'),
    resource = require('express-resource'),
    assets = require('connect-assets'),
    path = require('path'),
    passport = require('passport');

var setup = require('./lib/setup');
var authentication = require('./lib/authentication');
var users = require('./lib/users');
var db = require('./lib/db');
var routes = require('./lib/routes');

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
    app.use(app.router);

    app.use(assets());

    app.use(express['static'](path.join(__dirname, 'public')));

  });

  app.configure('development', function(){
    app.use(express.errorHandler());

    db.configure({
      user: process.env.USER,
      password: process.env.USER
    });
  });

  authentication.configure(app);

  routes.configure(app);

  setup();

  return app;
};