
var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');

var BY_ID_SQL = 'SELECT * FROM Networks WHERE id = $1',
    ALL_NETWORKS_SQL = 'SELECT * FROM Networks',
    NETWORKS_BY_DOCUMENT_SQL = 'SELECT n.* FROM network_documents nd, networks n WHERE nd.network = n.id AND n.id = $1 ORDER BY n.name ASC;',
    DELETE_NETWORK_SQL = 'DELETE FROM Networks WHERE id = $1',
    INSERT_NETWORK_SQL = 'INSERT INTO Networks (id, name, descr, cover, creator, created_at) VALUES ($1, $2, $3, $4, $5, NOW());';
    UPDATE_DOCUMENT_SQL = 'UPDATE Networks SET name = $1, descr = $2, cover = $3, creator = $4, created_at = $5 WHERE id = $6';
    ADD_DOCUMENT_SQL = 'INSERT INTO Network_Documents (network, document, state) VALUES ($1, $2, "active");';

var networks = module.exports = {};

// List all networks for a given document
networks.findNetworksByDocument = function(document, callback) {
  db.query(NETWORKS_BY_DOCUMENT_SQL, [document], db.many(function(err, networks) {
    if (err) return callback(err);
    callback(null, networks);
  }, 'No networks found'));
};

// Get network by id
networks.findById = function(id, callback) {
  db.query(BY_ID_SQL, [id], db.one(function(err, networks) {
    if (err) return callback(err);
    callback(null, networks);
  }, 'No networks found'));
};

// List all networks available
networks.list = function(callback) {
  db.query(ALL_NETWORKS_SQL, db.many(function(err, networks) {
    if (err) return callback(err);
    callback(null, networks);
  }, 'No networks found'));
};

// Update network data
networks.update = function(network, callback) {
  // TODO: implement
};

// Delete a network
networks.delete = function(document, callback) {
  db.query(DELETE_NETWORK_SQL, [document], function(err) {
    db.query(DELETE_NETWORK_SQL, [document], callback);
  });
};

// Create a new network
networks.create = function(network, callback) {
  db.query(INSERT_NETWORK_SQL, [network.id, network.name, network.descr, network.cover, network.creator], function (err, results) {
    callback(err, network);
  });
};

// Insert network association
networks.addDocument = function(network, document, callback) {
  db.query(INSERT_NETWORK_SQL, [network, document], function (err, results) {
    callback(err, network);
  });
};