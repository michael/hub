
var _ = require('underscore');
var db = require('./db');
var applications = require('./applications');


var TABLES = {

    Users: {
      uuid: 'text UNIQUE PRIMARY KEY',
      email: 'text UNIQUE',
      username: 'text UNIQUE',
      hash: 'text',
      data: 'text'
    },

    Publications: {
      uuid: 'text UNIQUE PRIMARY KEY',
      document: 'text',
      data: 'text',
      created_at: 'timestamp'
    },

    Applications: {
      uuid: 'text UNIQUE PRIMARY KEY',
      name: 'text NOT NULL',
      internal: 'boolean NOT NULL DEFAULT FALSE',
      secret: 'text NOT NULL'
    }

};

var createTable = function (fields, name) {
    var buffer = _.map(fields, function (type, field) {
        return field + ' ' + type;
    }).join(', ');
    return ['CREATE TABLE IF NOT EXISTS ', name, ' (', buffer, ');'].join('');
};

module.exports = function () {

  var sqls = _.map(TABLES, createTable);

  (function next (err) {
    var sql = sqls.shift();
    if (err) throw err;
    else if (sql) db.query(sql, next);
  })();

};