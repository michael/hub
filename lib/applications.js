
var _ = require('underscore');
var db = require('./db');

var errors = require('./errors');

var ALL_APPLICATIONS_SQL = 'SELECT * FROM Applications',
    BY_ID_SQL = 'SELECT * FROM Applications WHERE uuid = $1';

var applications = module.exports = {};

applications.findAll = function (callback) {
  db.query(ALL_APPLICATIONS_SQL, db.many(callback, "No applications found"));
};

applications.findById = function (id, callback) {
  db.query(BY_ID_SQL, [id], db.one(callback, "No application found with id "+id));
};
