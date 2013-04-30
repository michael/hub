var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var users = require('./users');

var DOCUMENT_COLLABORATORS_SQL = 'SELECT * FROM Collaborators WHERE document = $1;',
    COLLABORATOR_BY_ID_SQL = 'SELECT * FROM Collaborators WHERE id = $1;',
	  COLLABORATIONS_OF_USER_SQL = 'SELECT document FROM Collaborators WHERE collaborator = $1;',
    INSERT_COLLABORATOR_SQL = 'INSERT INTO Collaborators (id, document, collaborator) VALUES ($1, $2, $3);',
    DELETE_COLLABORATOR_SQL = 'DELETE FROM Collaborators WHERE id = $1';

var collaborators = module.exports = {};

// Finds all collaborators of a given document of the given user
// and provides a list of user id's
collaborators.listCollaborators = function(document, cb) {
  db.query(DOCUMENT_COLLABORATORS_SQL, [document],
  	db.many(function(err, collaborators) {
    	if (err) return cb(err);
    	cb(null, collaborators);
	}, 'No collaborators found')
  );
}

// Finds documents where a given user is registered as collaborator
// and provides the result as a list with hashes containing a creator's user id
// and the document id.
// TODO: is this used somewhere?
collaborators.listCollaborations = function(username, cb) {
  db.query(COLLABORATIONS_OF_USER_SQL, [username],
  	db.many(function(err, collaborations) {
    	if (err) return cb(err);
    	cb(null, collaborations);
    }, 'No collaborations found')
  );
};

// Get collaborator by id
collaborators.get = function(collaborator, cb) {
  db.query(COLLABORATOR_BY_ID_SQL, [collaborator], db.one(cb, "Could not find collaborator " + collaborator));
};

// Adds a new collaborator for a given document of a given user
collaborators.create = function(c, cb) {
  if (!c.id) c.id = db.uuid();
  console.log('inserting', c);
  users.findById(c.collaborator, function(err, user) {
    if (!user) return cb('user not found');
    db.query(INSERT_COLLABORATOR_SQL, [c.id, c.document, c.collaborator], function(err, result) {
      if (err) return cb(err);
      cb(null);
    });
  });
};

// Removes a collaborator
collaborators.delete = function(collaborator, cb) {
  db.query(DELETE_COLLABORATOR_SQL, [collaborator], function(err) {
    if (err) return cb(err);
  	cb(null);
  });
};
