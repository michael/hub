var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var versions = require('./versions');
var documents = require('./documents');

var BY_DOCUMENT_SQL = 'SELECT * FROM Publications WHERE document = $1',
    BY_ID_SQL = 'SELECT * FROM Publications WHERE id = $1',
    DOCUMENT_BY_ID = 'SELECT * FROM Documents WHERE id = $1',
    ALL_PUBLISHED_DOCUMENTS_SQL = 'SELECT d.id as id, p.created_at as created_at, p.creator as creator, p.data as data from documents d, publications p WHERE p.document=d.id AND p.revision = d.latest_revision ORDER BY p.created_at DESC;',
    DOCUMENTS_BY_USER_SQL = 'SELECT d.id as id, v.created_at as created_at, d.creator as creator, v.data as data, v.version AS version FROM documents d, versions v WHERE v.document = d.id AND v.version = d.latest_version AND d.creator = $1 ORDER BY v.created_at DESC;',
    DOCUMENTS_BY_NETWORK_SQL = 'SELECT d.id as id, v.created_at as created_at, d.creator as creator, u.name AS creator_name, v.data as data FROM documents d, versions v, publications p, users u WHERE d.creator = u.username AND v.document = d.id AND v.version = d.latest_version AND p.network = $1 AND p.document=d.id ORDER BY v.created_at DESC;',
    INSERT_PUBLICATION_SQL = 'INSERT INTO Publications (id, network, document, version, creator, state) VALUES ($1, $2, $3, $4, $5, $6);',
    UPDATE_PUBLICATION_SQL = 'UPDATE Publications SET version = $1, state = $2 WHERE network = $3 AND document = $4;',
    DELETE_PUBLICATION_SQL = 'DELETE FROM Publications WHERE id = $1',
    DELETE_ALL_PUBLICATIONS_SQL = 'DELETE FROM Publications WHERE document = $1';


var SALT_ROUNDS = 10;
var publications = module.exports = {};

function convertDocs(docs) {
  var result = [];
  _.each(docs, function(doc, index) {
    var content = JSON.parse(doc.data);
    result.push({
      id: doc.id,
      created_at: doc.created_at, // latest publication
      title: content.properties.title,
      abstract: content.properties.abstract,
      cover: content.properties.cover,
      creator: {
        username: doc.creator,
        name: doc.creator_name
      },
      version: doc.version
    });
  });
  return result;
}

publications.get = function(id, cb) {
  db.query(BY_ID_SQL, [id], db.one(cb, "Could not find publication with id " + id));
};

// Find documents listed in a particular network
publications.findDocumentsByNetwork = function(network, cb) {
  db.query(DOCUMENTS_BY_NETWORK_SQL, [network], db.many(function(err, docs) {
    if (err) return cb(err);
    cb(null, convertDocs(docs));
  }, 'No publications found'));
};

// List all publications for a given user
publications.findDocumentsByUser = function(username, cb) {
  db.query(DOCUMENTS_BY_USER_SQL, [username], db.many(function(err, docs) {
    if (err) return cb(err);
    cb(null, convertDocs(docs));
  }, 'No publications found'));
};


// List all documents (of all authors) which have been published
publications.findAll = function(cb) {
  db.query(ALL_PUBLISHED_DOCUMENTS_SQL, db.many(function(err, docs) {
    if (err) return cb(err);
    cb(null, convertDocs(docs));
  }, 'No publications found'));
};

// List all publications for a given document
publications.findByDocument = function(id, cb) {
  db.query(BY_DOCUMENT_SQL, [id], db.many(cb, 'No publications found'));
};

// Create a fresh publication
publications.create = function(pub, cb) {
  if (!pub.id) pub.id = db.uuid();


  // network, document, creator
  db.query(INSERT_PUBLICATION_SQL, [pub.id, pub.network, pub.document, 0, pub.creator, 'active'], function (err, results) {
    if (err) return cb(err);

    // Registers the document if it is not existent
    // This way, it is possible to publish the document without
    // synching it to the hub
    documents.get(pub.document, function(err, doc) {
      if (doc) return cb(null);
      doc = {
        id: pub.document,
        creator: pub.creator
      };
      documents.create(doc, cb);
    });
  });
};

// Delete publication
publications.delete = function(id, cb) {
  db.query(DELETE_PUBLICATION_SQL, [id], cb);
};


// Delete all publications for a given document
publications.deleteAll = function(document, cb) {
  db.query(DELETE_ALL_PUBLICATIONS_SQL, [document], cb);
};

// Declare how this model is used by the hub
var api = {
  "find": {
    // TODO: should this be restricted anyhow?
    method: function(args, cb) {
      publications.findByDocument(args.document, cb);
    }
  },
  "create": {
    ensure: global.api.isCollaboratorOrCreator,
    method: function(args, cb) {
      publications.create(args, cb);
    }
  },
  "delete": {
    ensure: function (args, session, cb) {
      publications.get(args.publication, function(err, pub) {
        if (err) return cb(err);
        args.document = pub.document;
        global.api.isCollaboratorOrCreator(args, session, cb);
      });
    },
    method: function(args, cb) {
      publications.delete(args.id, cb);
    }
  }

}
global.api.register("publications", api);
