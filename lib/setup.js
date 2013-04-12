
var _ = require('underscore');
var db = require('./db');
var errors = require('./errors');

var applications = require('./applications');
var users = require('./users');
var networks = require('./networks');
var util = require('../util/util');

var UUID = 'text UNIQUE PRIMARY KEY';
var TIMESTAMP = 'timestamp NOT NULL';

var ENVIRONMENT = process.env.NODE_ENV || "development";
var SEED = null;

if (process.argv[2] === "--seed") {
  if (ENVIRONMENT === "production") {
    SEED = JSON.parse(require('fs').readFileSync('./data/seed.json','utf8'));
  } else {
    var seedName = process.argv[3] || "001-boilerplate";
    SEED = JSON.parse(require('fs').readFileSync('./tests/seeds/'+seedName+'/hub.json','utf8'));  
  }
}

var TABLES = {
  Users: {
    username: 'text PRIMARY KEY',
    email: 'text NOT NULL UNIQUE',
    name: 'text',
    hash: 'text',
    data: 'text',
    created_at: TIMESTAMP
  },

  Documents: {
    id: UUID,
    name: 'text',
    creator: 'text',
    latest_version: 'int NOT NULL'
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
  },

  Networks: {
    id: UUID,
    name: 'text NOT NULL UNIQUE',
    cover: 'text NOT NULL',
    color: 'text NOT NULL',
    descr: 'text',
    active: 'boolean NOT NULL DEFAULT TRUE',
    moderated: 'boolean NOT NULL DEFAULT FALSE', // publications in moderated networks need to be activated manually
    creator: 'text NOT NULL',
    created_at: TIMESTAMP
  },

  Versions: {
    document: 'text NOT NULL',
    version: 'int NOT NULL',
    creator: 'text NOT NULL',
    data: 'text NOT NULL',
    created_at: TIMESTAMP,
    'PRIMARY KEY': '(document, version)'
  },

  Publications: {
    network: 'text NOT NULL',
    document: 'text NOT NULL',
    version: 'int NOT NULL',
    creator: 'text NOT NULL',
    state: 'text NOT NULL',
    active: 'boolean NOT NULL DEFAULT TRUE', // used for moderation
    'PRIMARY KEY': '(network, document)'
  },

  Collaborators: {
    document: 'text NOT NULL',
    collaborator: 'text NOT NULL',
    'PRIMARY KEY': '(document, collaborator)'
  }
};



// API for seeding the Database
// --------
// 
// Takes seed identifier as a parameter

var Seed = function(app, seeds) {

  if (ENVIRONMENT === "production") {
    var a = seeds["applications"][0];
    a.uuid = db.uuid();
    a.secret = db.uuid();
  }

  // Plant Seed to database
  this.plant = function(cb) {
    app.debug('Seeding DB ...');

    var jobs = [];

    _.each(seeds, function(seed, type) {
      jobs[type] = [];
      var model = require('./'+type);

      var subJobs = [];
      _.each(seed, function(obj) {
        subJobs.push(function(data, cb) {
          model.create(obj, cb);
          // cb(null);
        });
      });

      jobs.push(function(data, cb) {
        util.async(subJobs, function(err) {
          cb(err);
        });
      });
    });

    util.async(jobs, function() {
      cb(null);
    });
  }
};

var flushDB = function(cb) {
  console.log('flushing the database ...');
  db.query('drop schema public cascade;', function(err) {
    db.query('create schema public;', function(err) {
      cb(err);
    });
  });
};

var createTable = function (fields, name) {
    var buffer = _.map(fields, function (type, field) {
        return field + ' ' + type;
    }).join(', ');
    return ['CREATE TABLE IF NOT EXISTS ', name, ' (', buffer, ');'].join('');
};

module.exports = function (app) {
  var seedDB = function(cb) {
    var sqls = _.map(TABLES, createTable);

    function next(err) {
      var sql = sqls.shift();
      if (err) throw err;
      else if (sql) db.query(sql, next);
      else {
        app.debug("Database setup complete");

        // Seed it
        var seed = new Seed(app, SEED);
        seed.plant(function(err) {
          cb(err);
        });
      }
    };

    next();
  }


  var exposeApp = function () {
    applications.findByName('Composer', function (err, a) {
      if (!a) return app.error("No application registered.");
      app.debug("Composer application "+a.uuid+" with secret "+a.secret);  
    });
  };

  
  console.log('Starting Hub in', ENVIRONMENT, 'mode');
  
  if (SEED) {
    flushDB(function(err) {
      if (err) return app.error("FLUSH FAILED: ", err);
      seedDB(function(err) {
        if (err) return app.error("SEED FAILED: ", err);
        exposeApp();
      });
    });
  } else {
    exposeApp();
  }
};
