
var db = require('./db');

var USERS = 'CREATE TABLE IF NOT EXISTS Users ('+
    'uuid text UNIQUE PRIMARY KEY, '+
    'email text UNIQUE, '+
    'username text UNIQUE, '+
    'hash text, '+
    'data text);';

module.exports = function () {

  db.query(USERS, function (err) {
    if (err) throw err;
  });

};
