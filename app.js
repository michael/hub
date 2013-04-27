var express = require('express'),
    resource = require('express-resource'),
    assets = require('connect-assets'),
    crypto = require('crypto'),
    path = require('path'),
    passport = require('passport'),
    winston = require('winston');

require('express-namespace');

var setup = require('./lib/setup');
var authentication = require('./lib/authentication');
var errors = require('./lib/errors');

var db = require('./lib/db');
var routes = require('./lib/routes');

module.exports = function create(options) {

  if (!options) options = {};

  var app = express();

  app.env = process.env.NODE_ENV || "development";

  var logger = new winston.Logger(options.logger || {
    transports: [
      new winston.transports.Console()
    ]
  });

  logger.extend(app);

  app.authentication = authentication;

  app.authorizations = require('./lib/model/authorizations');
  app.publications = require('./lib/model/publications');
  app.applications = require('./lib/model/applications');
  app.users = require('./lib/model/users');

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
    app.use(express['static'](path.join(__dirname, 'assets')));
    
    app.use(assets());
    app.use(app.router);
    app.use(errors.errorHandler());

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

  setup(app);

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
