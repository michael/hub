var _ = require('underscore');
var util = require('./util');
var apis = module.exports = {};


apis.configure = function (app) {
  app.namespace('/api/v1',
    util.authentication(app),
    apis.routes.bind(null, app));
};

apis.routes = function (app) {

  app.get('/', function (req, res) {
    res.json({
      "name": "Substance API",
      "version": "1.0-alpha",
      "authorization_url": "/authorizations/{authorization}",
      "current_authorization_url": "/authorizations/current",
      "user_url": "/users/{user}",
      "register_user_url": "/register",
    });
  });

  // Expose User API
  require('./user_api')(app);

  // Expose Maintenance API
  require('./maintenance_api')(app);

}; // authentication
