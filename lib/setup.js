
var _ = require('underscore');
var db = require('./db');
var errors = require('./errors');

var applications = require('./applications');
var users = require('./users');
var networks = require('./networks');

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

    // Create admin user
    users.findByLogin('admin', function (err, user) {
      if (!user) users.insert('admin@substance.io', 'admin', 'John Admin', 'unicornsarecute', function (err, uuid) {
        if (err) throw err;
        app.debug("Created default user");
      });
    });

    // Create a bunch of default networks
    var defaultNetworks = [
      {
        "id": "public",
        "name": "Public",
        "descr": "Substance Public Stream, unfiltered.",
        "cover": "http://farm8.staticflickr.com/7197/6922744517_7108a40fa4_b.jpg",
        "creator": "michael",
        "color": "#474B21",
        "moderated": false
      },
      {
        "id": "technology",
        "name": "Technology",
        "descr": "Essays about all kinds of technology.",
        "cover": "http://farm3.staticflickr.com/2174/2240432052_b5ff5b800c_b.jpg",
        "creator": "michael",
        "color": "#407956",
        "moderated": true
      },
      {
        "id": "film",
        "name": "Film",
        "descr": "Everything film-related.",
        "cover": "http://farm5.staticflickr.com/4134/4872994545_9cf0bd0a7e_o.jpg",
        "creator": "michael",
        "color": "#462B4E",
        "moderated": true
      },
      {
        "id": "fiction",
        "name": "Fiction",
        "descr": "Yes, fiction.",
        "cover": "http://farm5.staticflickr.com/4098/4748942112_4c00e67bd2_b.jpg",
        "creator": "michael",
        "color": "#2E465C",
        "moderated": true
      },
      {
        "id": "open-source",
        "name": "Open Source",
        "descr": "The Open Source channel on Substance.",
        "cover": "http://farm6.staticflickr.com/5200/7442443392_45591a631b_b.jpg",
        "creator": "michael",
        "color": "#B75726",
        "moderated": true
      },
      {
        "id": "design",
        "name": "Design",
        "descr": "Design and UX.",
        "cover": "http://farm6.staticflickr.com/5448/7418827168_df8b0f0ec0_b.jpg",
        "creator": "michael",
        "color": "#9F2929",
        "moderated": true
      },
      {
        "id": "substance",
        "name": "Substance",
        "descr": "Substance is open digital publishing.",
        "cover": "http://farm7.staticflickr.com/6090/6090064610_60d9801357_b.jpg",
        "creator": "michael",
        "color": "#59422D",
        "moderated": true
      }
    ];

    _.each(defaultNetworks, function(network) {
      networks.findById(network.id, function(err, data) {
        if (!data) {
          networks.create(network, function(err, n) {
            console.log('err', err);
            app.debug("Created network:", network.name);
          });
        }
      });
    });
  };

  next();
};
