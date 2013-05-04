var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var users = require('./users');

var DOCUMENT_COLLABORATORS_SQL = 'SELECT * FROM Collaborators WHERE document = $1;',
    COLLABORATOR_BY_ID_SQL = 'SELECT * FROM Collaborators WHERE id = $1;',
    ID_BY_USER_AND_DOCUMENT_SQL = 'SELECT id FROM Collaborators WHERE collaborator = $1 AND document = $2;',
	  COLLABORATIONS_OF_USER_SQL = 'SELECT document FROM Collaborators WHERE collaborator = $1;',
    INSERT_COLLABORATOR_SQL = 'INSERT INTO Collaborators (id, document, collaborator) VALUES ($1, $2, $3);',
    DELETE_COLLABORATOR_SQL = 'DELETE FROM Collaborators WHERE id = $1';

var collaborators = module.exports = {};

// Finds all collaborators of a given document of the given user
// and provides a list of user id's
collaborators.find = function(query, cb) {
  var document = query.document;
  //console.log("collaborators.listCollaborators", collaborator);

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
// This is used by the HubStore to augment list of user documents with those a user
// is registered for as a collaborator.
collaborators.listCollaborations = function(username, cb) {
  // console.log("collaborators.listCollaborations", username);
  db.query(COLLABORATIONS_OF_USER_SQL, [username],
  	db.many(function(err, collaborations) {
    	if (err) return cb(err);
    	cb(null, collaborations);
    }, 'No collaborations found')
  );
};

// Get collaborator by id
collaborators.get = function(collaborator, cb) {
  var id = collaborator.id;
  db.query(COLLABORATOR_BY_ID_SQL, [id], db.one(cb, "Could not find collaborator " + collaborator));
};

// Adds a new collaborator for a given document of a given user
// ----------

collaborators.create = function(collaborator, cb) {
  var id = collaborator.id || db.uuid();
  var document = collaborator.document;
  var user = collaborator.collaborator;

  // console.log('collaborators.create', id, document, user);
  db.query(INSERT_COLLABORATOR_SQL, [id, document, user], function(err, result) {
    //console.log("collaborators.create", err, result, cb);
    if (err) return cb(err);
    cb(null);
  });
};

// Removes a collaborator
// ----------

collaborators.delete = function(collaborator, cb) {
  var id = collaborator.id;

  db.query(DELETE_COLLABORATOR_SQL, [id], function(err) {
    if (err) return cb(err);
  	cb(null);
  });
};

// Checks if a user is registered as a collaborator for a given document
// ----------
// requires options 'user' and 'document'

collaborators.isCollaborator = function(user, document, cb) {
  // console.log("collaborators.isCollaborator", user, document);
  db.query(ID_BY_USER_AND_DOCUMENT_SQL, [user, document],
    db.one(cb, "User is not a collaborator.")
  );
}

// Declare how this model is used by the hub
var api = {
  "find": {
    ensure: global.api.isCollaboratorOrCreator,
    method: collaborators.find
  },
  // only the creator can add and delete collaborators
  "create": {
    ensure: global.api.isCreator,
    method: collaborators.create
  },
  "delete": {
    // called via collaborator id
    // must look up the document id first and then
    // check if the current user is the creator
    ensure: function (args, session, cb) {
      // retrieve the collaborator entry
      collaborators.get(args.id, function(err, collaborator) {
        if (err) return cb(err);
        // requires 'document' field (which is in collaborator)
        global.api.isCreator(collaborator, session, cb);
      });
    },
    method: collaborators.delete
  }
}
global.api.register("collaborators", api);
