
var _ = require('underscore');
var db = require('../db');
var errors = require('../errors');

var BY_ID_SQL = 'SELECT * FROM Authorizations WHERE uuid = $1;',
    BY_TOKEN_SQL = 'SELECT * FROM Authorizations WHERE token = $1;',
    BY_USER_SQL = 'SELECT * FROM Authorizations WHERE user_uuid = $1;',
    BY_USER_ID_SQL = 'SELECT * FROM Authorizations WHERE user_uuid = $1 AND uuid = $2;',
    BY_USER_APP_SQL = 'SELECT * FROM Authorizations WHERE user_uuid = $1 AND application_uuid = $2;',
    INSERT_SQL = 'INSERT INTO Authorizations (uuid, user_uuid, application_uuid, token, scopes, created_at) VALUES ($1, $2, $3, $4, $5, NOW());';

var authorizations = module.exports = {};

authorizations.findById = function (uuid, cb) {
  db.query(BY_ID_SQL, [uuid], db.one(cb, 'No authorization found with id '+uuid));
};

authorizations.secureFindById = function (user_uuid, uuid, cb) {
  db.query(BY_USER_ID_SQL, [user_uuid, uuid], db.one(cb, 'No authorization found with id '+uuid));
};

authorizations.findByToken = function (token, cb) {
  db.query(BY_TOKEN_SQL, [token], db.one(cb, 'No authorization found with token '+token));
};

authorizations.findByUserAndApplication = function (user_uuid, application_uuid, cb) {
  db.query(BY_USER_APP_SQL, [user_uuid, application_uuid], db.one(cb, 'No authorization found'));
};

authorizations.findByUser = function (user_uuid, cb) {
  db.query(BY_USER_SQL, [user_uuid], db.many(cb));
};

authorizations.create = function (auth, cb) {
  var uuid = auth.uuid || db.uuid();
  var token = auth.token || db.uuid();
  db.query(INSERT_SQL, [uuid, auth.user_uuid, auth.application_uuid, token, auth.scopes], function (err) {
    if (err) cb(err, null);
    else cb(null, uuid);
  });
};

authorizations.findOrCreate = function (user_uuid, application_uuid, scopes, cb) {
  authorizations.findByUserAndApplication(user_uuid, application_uuid, function (err, application) {
    var auth = {
      user_uuid: user_uuid,
      scopes: scopes,
      application_uuid: application_uuid
    };

    if (err instanceof errors.NoRecordFound) authorizations.create(auth, function (err, uuid) {
      if (err) cb(err, null);
      else authorizations.findById(uuid, cb);
    });
    else if (err) cb(err, null);
    else cb(null, application);
  });
};
