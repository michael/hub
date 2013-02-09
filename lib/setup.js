
var _ = require('underscore');
var db = require('./db');
var errors = require('./errors');

var applications = require('./applications');
var users = require('./users');

var UUID = 'text UNIQUE PRIMARY KEY';
var TIMESTAMP = 'timestamp NOT NULL';

var TABLES = {
  Users: {
    username: 'text PRIMARY KEY',
    email: 'text NOT NULL UNIQUE',
    name: 'text',
    hash: 'text',
    data: 'text',
    created_at: TIMESTAMP
  },

  Publications: {
    document: 'text NOT NULL',
    revision: 'int NOT NULL',
    data: 'text',
    creator: 'text',
    created_at: TIMESTAMP,
    "PRIMARY KEY": "(document, revision)"
  },

  Applications: {
    uuid: UUID,
    name: 'text NOT NULL UNIQUE',
    internal: 'boolean NOT NULL DEFAULT FALSE',
    secret: 'text NOT NULL',
    created_at: TIMESTAMP
  },

  Authorizations: {
      uuid: UUID,
      active: 'boolean NOT NULL DEFAULT TRUE',
      user_uuid: 'text NOT NULL',
      application_uuid: 'text NOT NULL',
      token: 'text NOT NULL',
      scopes: 'text',
      created_at: TIMESTAMP
  }
};

var createTable = function (fields, name) {
    var buffer = _.map(fields, function (type, field) {
        return field + ' ' + type;
    }).join(', ');
    return ['CREATE TABLE IF NOT EXISTS ', name, ' (', buffer, ');'].join('');
};

module.exports = function (app) {

  var sqls = _.map(TABLES, createTable);

  var next = function (err) {
    var sql = sqls.shift();
    if (err) throw err;
    else if (sql) db.query(sql, next);
    else {
      app.debug("Database setup complete");
      defaults();
    }
  };

  var exposeApp = function (application) {
    var uuid = application.uuid;
    var secret = application.secret;
    app.debug("Composer application "+uuid+" with secret "+secret);
  };

  var defaults = function () {
    applications.findByName('Composer', function (err, application) {
      if (err instanceof errors.NoRecordFound) {
          applications.create('Composer', true, function (err, uuid) {
          if (err) throw err;
          applications.findById(uuid, function (err, application) {
            if (err) throw err;
            app.debug("Created default application");
            exposeApp(application);
          });
        });
      } else if (application) {
        exposeApp(application);
      }
    });

    users.findByLogin('admin', function (err, user) {
      if (!user) users.insert('admin@substance.io', 'admin', 'John Admin', 'unicornsarecute', function (err, uuid) {
        if (err) throw err;
        app.debug("Created default user");
      });
    });
  };

  next();
};
