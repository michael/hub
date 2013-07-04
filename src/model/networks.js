
var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');

var BY_ID_SQL = 'SELECT * FROM Networks WHERE id = $1',
    ALL_NETWORKS_SQL = 'SELECT * FROM Networks',
    NETWORKS_BY_DOCUMENT_SQL = 'SELECT n.*, nd.state AS state FROM network_documents nd, networks n WHERE nd.network = n.id AND nd.document = $1 ORDER BY n.name ASC;',
    DELETE_NETWORK_SQL = 'DELETE FROM Networks WHERE id = $1',
    INSERT_NETWORK_SQL = 'INSERT INTO Networks (id, name, descr, cover, color, creator, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW());';

var networks = module.exports = {};

// List all networks for a given document
networks.findNetworksByDocument = function(document, cb) {
  db.query(NETWORKS_BY_DOCUMENT_SQL, [document], db.many(function(err, networks) {
    if (err) return cb(err);
    cb(null, networks);
  }, 'No networks found'));
};

// Get network by id
networks.findById = function(id, cb) {
  db.query(BY_ID_SQL, [id], db.one(function(err, networks) {
    if (err) return cb(err);
    cb(null, networks);
  }, 'No networks found'));
};

// List all networks available
networks.list = function(cb) {
  db.query(ALL_NETWORKS_SQL, db.many(function(err, networks) {
    if (err) return cb(err);
    cb(null, networks);
  }, 'No networks found'));
};

// Update network data
networks.update = function(network, cb) {
  // TODO: implement
};

// Create a new network
networks.create = function(network, cb) {
  db.query(INSERT_NETWORK_SQL, [network.id, network.name, network.descr, network.cover, network.color, network.creator], function (err, results) {
    cb(err, network);
  });
};

// Delete a network
networks.delete = function(document, cb) {
  db.query(DELETE_NETWORK_SQL, [document], function(err) {
    db.query(DELETE_NETWORK_SQL, [document], cb);
  });
};

