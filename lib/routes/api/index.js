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
      "publication_url": "/publications/{document}",
      "user_url": "/users/{user}",
      "register_user_url": "/register",
      "document_url": "/users/{owner}/documents/{document}",
      "document_commits_url": "/users/{owner}/documents/{document}/commits",
      "documents_status_url": "/users/{owner}/documents/statuses"
    });
  });


  // Expose Publication API
  require('./publication_api')(app);

  // Expose Document API
  require('./document_api')(app);

  // Expose User API
  require('./user_api')(app);

  // Expose Maintenance API
  require('./maintenance_api')(app);

}; // authentication
