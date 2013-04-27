var _ = require('underscore');

var util = module.exports = {};

util.authentication = function(app) {
  return function (req, res, next) {
    var tokenData;
    var basicData;
    var authorization = (req.get('authorization') || '').trim();
    var client_id = req.query.client_id || req.body.client_id;
    var client_secret = req.query.client_secret || req.body.client_secret;

    var checkToken = 0;
    var checkBasic = 0;
    var checkClient = 0;

    if (!authorization) {
      checkToken = 0;
      checkBasic = 0;
    }
    else if (authorization.slice(0, 6).trim() === 'token') {
      tokenData = authorization.slice(6).trim();
      checkToken = 1;
      checkBasic = 0;
      checkClient = 0;
    }
    else if (authorization.slice(0, 6).toLowerCase().trim() === 'basic') {
      basicData = authorization.slice(6).trim();
      checkBasic = 1;
      checkToken = 0;
    }
    else {
      checkToken = 0;
      checkBasic = 0;
    }

    if (!checkToken && client_id) {
      checkClient = 1;
    }

    var authErrors = [];
    var foundUser = null;
    var foundClient = null;
    var foundAuthorization = null;

    var conclude = _.after(checkToken + checkBasic + checkClient, function () {
      if (authErrors.length) next(new errors.MaybeParallel(authErrors));
      else {
        req.user = foundUser;
        req.client = foundClient;
        req.authorization = foundAuthorization;
        next();
      }
    });

    // ATTENTION: If more than one authentication strategy challenges for a property
    // (user or client) then it must be not overwritten!

    if (checkBasic) {
      app.authentication.authenticateBasic(basicData, function (err, user) {
        if (err) authErrors.push(err);
        if (!user) authErrors.push(new errors.Unauthorized("Basic Authentication failed"));
        if (!foundUser) foundUser = user;
        conclude();
      });
    }

    if (checkToken) {
      app.authentication.authenticateFullToken(tokenData, function (err, authorization, user, client) {
        if (err) authErrors.push(err);
        if (!authorization || !user || !client) authErrors.push(new errors.Unauthorized("Token Authentication failed"));
        if (!foundAuthorization) foundAuthorization = authorization;
        if (!foundUser) foundUser = user;
        if (!foundClient) foundClient = client;
        conclude();
      });
    }

    if (checkClient) {
      app.authentication.authenticateApplication(client_id, client_secret, function (err, client) {
        if (err) authErrors.push(err);
        if (!client) authErrors.push(new errors.Unauthorized("Client Authentication failed"));
        if (!foundClient) foundClient = client;
        conclude();
      });
    }
  };
}

var slice = Array.prototype.slice;

util.requires = function() {
  var props = slice.call(arguments);
  var length = props.length;
  return function (req, res, next) {
    for (var i = 0; i<length; ++i) {
      if (!req[props[i]]) return next(new errors.Unauthorized("Authentication for "+props[i]+" not found"));
    }
    next();
  };
}


util.out = function (res, next) {
  return function (err, data) {
    if (err) next(err);
    else res.json(data);
  };
}
