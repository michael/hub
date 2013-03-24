var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');
var users = require('./users');

var DOCUMENT_COLLABORATORS_SQL = 'SELECT collaborator FROM Collaborators WHERE document = $1;',
	COLLABORATIONS_OF_USER_SQL = 'SELECT document FROM Collaborators WHERE collaborator = $1;',
    INSERT_COLLABORATOR_SQL = 'INSERT INTO Collaborators (document, collaborator) VALUES ($1, $2);',
    DELETE_COLLABORATOR_SQL = 'DELETE FROM Collaborators WHERE document = $1 AND collaborator = $2';

var collaborators = module.exports = {};

// Finds all collaborators of a given document of the given user
// and provides a list of user id's
collaborators.listCollaborators = function(document, callback) {
  db.query(DOCUMENT_COLLABORATORS_SQL, [document],
  	db.many(function(err, collaborators) {
    	if (err) return callback(err);
    	callback(null, collaborators);
	}, 'No collaborators found')
  );
}

// Finds documents where a given user is registered as collaborator
// and provides the result as a list with hashes containing a creator's user id
// and the document id.
collaborators.listCollaborations = function(username, callback) {
  db.query(COLLABORATIONS_OF_USER_SQL, [username],
  	db.many(function(err, collaborations) {
    	if (err) return callback(err);
    	callback(null, collaborations);
    }, 'No collaborations found')
  );
};

// Adds a new collaborator for a given document of a given user
collaborators.add = function(document, collaborator, callback) {
  users.findById(collaborator, function(err, user) {
    if (!user) return callback('user not found');
    db.query(INSERT_COLLABORATOR_SQL, [document, collaborator], function(err, result) {
      if (err) return callback(err);
      callback(null, {'document': document, 'collaborator': collaborator});
    });
  });
};

// Removes a collaborator from a given document of a given user
collaborators.delete = function(document, collaborator, callback) {
  db.query(DELETE_COLLABORATOR_SQL, [document, collaborator], function(err) {
    if (err) return callback(err);
  	callback(null, {'document': document, 'collaborator': collaborator});
  });
};
