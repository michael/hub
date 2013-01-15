
var db = require('./db');

var USERS = 'CREATE TABLE IF NOT EXISTS Users ('+
    'uuid text UNIQUE PRIMARY KEY, '+
    'email text UNIQUE, '+
    'username text UNIQUE, '+
    'hash text, '+
    'data text);';

var PUBLICATIONS = 'CREATE TABLE IF NOT EXISTS Publications ('+
    'uuid text UNIQUE PRIMARY KEY, '+
    'document text, '+
    'data text, '+
    'username text, '+
    'created_at timestamp)';

var APPLICATIONS = 'CREATE TABLE IF NOT EXISTS Applications ('+
    'uuid text UNIQUE PRIMARY KEY, '+
    'name text)';

module.exports = function () {
  var sqls = [USERS, PUBLICATIONS, APPLICATIONS];

  (function next (err) {
    var sql = sqls.shift();
    if (err) throw err;
    else if (sql) db.query(sql, next);
  })();
};