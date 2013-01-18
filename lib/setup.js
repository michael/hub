
var db = require('./db');

var USERS = 'CREATE TABLE IF NOT EXISTS Users ('+
    'username text PRIMARY KEY, '+
    'email text UNIQUE, '+
    'hash text, '+
    'data text);';

var DOCUMENTS = 'CREATE TABLE IF NOT EXISTS Documents ('+
    'id text PRIMARY KEY, '+
    'name text, '+
    'creator text, '+
    'latest_revision int NOT NULL);';

var PUBLICATIONS = 'CREATE TABLE IF NOT EXISTS Publications ('+
    'document text NOT NULL, '+
    'revision int NOT NULL, '+
    'data text, '+
    'creator text, '+
    'created_at timestamp, '+
    'PRIMARY KEY(document, revision));';

var APPLICATIONS = 'CREATE TABLE IF NOT EXISTS Applications ('+
    'uuid text UNIQUE PRIMARY KEY, '+
    'name text)';

module.exports = function () {
  var sqls = [USERS, DOCUMENTS, PUBLICATIONS, APPLICATIONS];

  (function next (err) {
    var sql = sqls.shift();
    if (err) throw err;
    else if (sql) db.query(sql, next);
  })();
};