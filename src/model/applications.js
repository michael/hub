
var _ = require('underscore');
var db = require('../db');
var errors = require('../errors');

var ALL_APPLICATIONS_SQL = 'SELECT * FROM Applications;',
    BY_NAME_SQL = 'SELECT * FROM Applications WHERE name = $1;',
    BY_ID_SQL = 'SELECT * FROM Applications WHERE uuid = $1;',
    INSERT_SQL = 'INSERT INTO Applications (uuid, name, internal, secret, created_at) VALUES ($1, $2, $3, $4, NOW());';

var applications = module.exports = {};

applications.findAll = function (cb) {
  db.query(ALL_APPLICATIONS_SQL, db.many(cb, "No applications found"));
};

applications.findByName = function (name, cb) {
  db.query(BY_NAME_SQL, [name], db.one(cb, "No application found with name "+name));
};

applications.findById = function (id, cb) {
  db.query(BY_ID_SQL, [id], db.one(cb, "No application found with id "+id));
};

applications.create = function (app, cb) {
  db.query(INSERT_SQL, [app.uuid, app.name, !!app.internal, app.secret], function (err, results) {
    if (err) cb(err, null);
    else cb(null, app.uuid);
  });
};
