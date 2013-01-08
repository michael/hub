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
    'created_at timestamp)';

module.exports = function () {
  db.query(USERS, function (err) {
    if (err) throw err;
    db.query(PUBLICATIONS, function (err) {
      if (err) throw err;
    });
  });
};