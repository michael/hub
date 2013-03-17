
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
    descr: 'text',
    active: 'boolean NOT NULL DEFAULT TRUE',
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
    'PRIMARY KEY': '(network, document)'
  },

  Collaborators: {
    document: 'text NOT NULL',
    username: 'text NOT NULL',
    'PRIMARY KEY': '(document, username)'
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
        "id": "javascript",
        "name": "Javascript",
        "descr": "JavaScript is a prototype-based scripting language that is dynamic, weakly typed and has first-class functions. It is a multi-paradigm language, supporting object-oriented imperative, and functional programming styles.",
        "cover": "http://substance-assets.s3.amazonaws.com/39/44059bda16aa4e7f4aeaf77d537bce/javascript.png",
        "creator": "michael"
      },
      {
        "id": "film",
        "name": "Film",
        "descr": "A film, also called a movie or motion picture, is a series of still or moving images. It is produced by recording photographic images with cameras, or by creating images using animation techniques or visual effects.",
        "cover": "http://substance-assets.s3.amazonaws.com/fc/cd266bf9b3f927e6b8b594601502c4/film.png",
        "creator": "michael"
      },
      {
        "id": "history",
        "name": "History",
        "descr": "History (from Greek ἱστορία - historia, meaning 'inquiry, knowledge acquired by investigation') is an umbrella term that relates to past events as well as the discovery, collection, organization, and presentation of information about these events. The term includes cosmic, geologic, and organic history, but is often generically implied to mean human history. Scholars who write about history are called historians.",
        "cover": "http://substance-assets.s3.amazonaws.com/30/df3a0db5cfd8f4d4c02af7e1a228cb/history.png",
        "creator": "michael"
      },
      {
        "id": "substance",
        "name": "Substance",
        "descr": "Substance is open publishing, for everyone.",
        "cover": "http://substance-assets.s3.amazonaws.com/7c/4436e919d5804906218a033b83cf63/substance-network.png",
        "creator": "michael"
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
