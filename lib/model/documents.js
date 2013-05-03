var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var collaborators = require('./collaborators');

var Store = require('substance-store');

var DOCUMENT_BY_ID = 'SELECT * FROM Documents WHERE id = $1',
    INSERT_DOCUMENT_SQL = 'INSERT INTO Documents (id, name, creator, latest_version) VALUES ($1, $2, $3, $4);',
    DELETE_DOCUMENT_SQL = 'DELETE FROM Documents WHERE id = $1',
    UPDATE_DOCUMENT_VERSION_SQL = 'UPDATE Documents SET latest_version = $1 WHERE id = $2';

var documents = module.exports = {};

documents.getStore = function(username) {
  return new Store.RedisStore({scope: username, port: 6380});
}

// Helper to access commit ranges
documents.extractCommits = function(doc, start, end) {
	var skip = false;

	if (start === end) return [];
	var commit = doc.commits[start];

	if (!commit) return [];
	commit.sha = start;

	var commits = [commit];
	var prev = commit;

	while (!skip && (commit = doc.commits[commit.parent])) {
	  if (end && commit.sha === end) {
	    skip = true;
	  } else {
	    commit.sha = prev.parent;
	    commits.push(commit);
	    prev = commit;
	  }
	}

	return commits.reverse();
};

documents.getDocumentById = function(docId, cb) {
  db.query(DOCUMENT_BY_ID, [docId], db.one(cb, "Could not find document " + docId));
}

documents.getDocumentInfo = function(creator, docId) {
  var store = documents.getStore(creator);
  var doc = store.getInfo(docId);
  return doc;
}

// Checks if a user is the owner of a document
// --------------
// requires options 'user' and 'document'

documents.isCreator = function(user, document, cb) {
  documents.getDocumentById(document, function(err, doc) {
    if(err) cb(err);
    else if(doc.creator !== user) cb("User is not creator.");
    else cb(null);
  });
}

// Provide access to a document while checking permissions for a given user and a document.
// @deprecated follow the new hub API protocol (using ensure etc.)
documents.getDocumentAccess = function(username, docId, permission, cb) {
  // console.log("documents.getDocumentAccess", username, docId, permission);

  documents.getDocumentById(docId, function(err, doc) {
    if (err) cb(err, null);
    else collaborators.find ({document: docId}, function(err, result) {
      if (err) return cb(err, null);

      var isCreator = (doc.creator === username);
      var isCollaborator = false;
      _.each(result, function(collab) {
        if (collab.collaborator === username) isCollaborator = true;
      });

      var permits = {
        read: function(username) { return isCollaborator; },
        write: function(username) { return isCollaborator; },
        delete: function(username) { return false; }, // only allowed by owner
        manage: function(username) { return isCollaborator; }
      };

      // creator is allowed to do everything
      if (isCreator || (permits[permission] && permits[permission](username))) {
        //console.log("Access '"+permission+"' permitted for user '"+username+"' on document '"+docId+"'.");
        cb(null, doc);
      } else {
        //console.log("Access '"+permission+"' denied for user '"+username+"' on document '"+docId+"'.");
        cb(new errors.Forbidden("Access '"+permission+"' denied for user '"+username+"' on document '"+docId+"'."), null);
      }
    });
  });
};


documents.createDocumentEntry = function(creator, docId, cb) {
  db.query(INSERT_DOCUMENT_SQL, [docId, null, creator, 0], cb);
};

documents.create = function (creator, docId, meta, cb) {

  var store = documents.getStore(creator);
  var docStub = {creator: creator, id: docId};

  // this is called whenever a document has been created in
  // the postgres backend but fails to be created in the user's redis store.
  // TODO: use transaction mechanism?
  function rollback(err) {
    documents.delete(docStub, function(err, result) {});
    store.delete(docStub.id);
    cb(err, null);
  }

  function createInStore(cb) {
    store.create(docId, function(err, newDoc) {
      if (err) return rollback(err);
      // Note: if meta-data is given, the store will be called once again
      //  to update the doc's meta data
      else if (meta) store.updateMeta(docId, meta, function(err) {
        if (err) return rollback(err);
        else cb(null, newDoc);
      });
      else cb(null, newDoc);
    });
  }

  // The document could exist if it has been published (without being synced)
  documents.getDocumentById(docId, function(err, alreadyExists) {
    if (alreadyExists) {
      createInStore(cb);
    } else {
      documents.createDocumentEntry(creator, docId, function(err) {
        if (err) return cb(new errors.InternalServerError(err));
        createInStore(cb);
      });
    }
  });
};

documents.delete = function (doc, cb) {
  documents.getStore(doc.creator).delete(doc.id, function(err, results) {
    if (err) cb(err);
    else db.query(DELETE_DOCUMENT_SQL, [doc.id], function (err, results) {
      if (err) cb(new error.InternalServerError("SQL error: could not delete document."));

      // Can't be done outside because of circulare dependencies
      // See: https://groups.google.com/forum/?fromgroups=#!topic/nodejs/u_9IE2z_6rM
      var publications = require('./publications');
      var versions = require('./versions');
      versions.deleteAll(doc.id, function(err) {
        if (err) cb(err);
        // Remove all publications
        publications.deleteAll(doc.id, cb);
      });
    });
  });
};

documents.update = function(doc, commits, meta, refs, cb) {
  var store = documents.getStore(doc.creator);
  store.update(doc.id, commits, meta, refs, cb);
};

// Documents for a particular user
// TODO: for consistency with Substance.Store return a list instead of a hash!
documents.documents = function(creator, cb) {
  documents.getStore(creator).list(function(err, docs) {
    if (err) cb(err);
    else {
      var result = {};
      _.each(docs, function(doc) {
        result[doc.id] = doc;
      });
      cb(null, result);
    }
  });
}

// List collaborations
documents.collaborations = function(username, cb) {
  var util = require('../../util/util');

  collaborators.listCollaborations(username, function(err, collaborations) {
    // stop on error
    if (err) return cb(err, null);

    var result = {};
    var afterAll = util.propagate(result, cb);

    util.async.each(collaborations, function(collaborator, cb) {
      documents.getDocumentById(collaborator.document, function(err, doc) {
        if(err) console.log("WARNING: Found invalid entry in collaborations.");
        if(doc) result[doc.id] = documents.getDocumentInfo(doc.creator, doc.id);
        cb(null);
      });
    })(null, afterAll);
  });
};

// Get document
documents.get = function(doc, cb) {
  documents.getStore(doc.creator).get(doc.id, cb);
};

// Gets commits for a particular document
documents.commits = function(doc, startCommit, cb) {
  var result = documents.getDocumentInfo(doc.creator, doc.id);
  var store = documents.getStore(doc.creator);
  var lastCommit, commits;

  var refs = store.getRefs(doc.id);

  lastCommit = (refs.master) ? refs.master.last : null;
  // TODO: we could have a low level interface for commit ranges
  commits = store.commits(doc.id, lastCommit, startCommit);
  // console.log("Commits from store", commits);

  result.commits = commits;
  cb(null, result);
};


documents.incrementVersion = function(document, cb) {
  documents.getDocumentById(document, function(err, doc) {
    if (err) return cb(err);
    db.query(UPDATE_DOCUMENT_VERSION_SQL, [doc.latest_version+1, document], function (err, results) {
      return cb(err, doc.latest_version+1);
    });
  });
};

// Seed Document Store
// This is redundant to composer/src/model.js
documents.seed = function(seeds, cb) {
  // console.log('Seeding the docstore...');
  var store = documents.getStore("");
  store.clear();

  if (seeds) {
    _.each(seeds, function(seed, scope) {
      documents.getStore(scope).seed(seed);

      _.each(seed.documents, function(doc, id) {
        documents.createDocumentEntry(scope, id);
      });
    });
  }
  cb(null);
};

