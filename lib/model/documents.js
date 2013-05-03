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

function getStore(username) {
  return new Store.RedisStore({scope: username, port: 6380});
}

/**
  Refactoring plan (#65):

- split db stuff (aim is to have a db only documents.js plus hub_store.js as aggregate)
- hub_store should expose the same API as RedisStore (= Store interface)
- use the global.api protocol for handling rights
- simplify the Store API on the way

*/

documentsDb = {}

documentsDb.get = function(document, cb) {
  db.query(DOCUMENT_BY_ID, [document], db.one(cb, "Could not find document " + document));
};

documentsDb.create = function(creator, docId, cb) {
  db.query(INSERT_DOCUMENT_SQL, [docId, null, creator, 0], cb);
};

// Checks if a user is the owner of a document
// --------------

documents.isCreator = function(user, document, cb) {
  documentsDb.get(document, function(err, doc) {
    if(err) cb(err);
    else if(doc.creator !== user) cb("User is not creator.");
    else cb(null);
  });
};

// Store API
// ==============

documents.exists = function(docId, cb) {
  cb("Not implemented");
};

documents.create = function (creator, docId, meta, cb) {

  var store = getStore(creator);
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
  documentsDb.get(docId, function(err, alreadyExists) {
    if (alreadyExists) {
      createInStore(cb);
    } else {
      documentsDb.create(creator, docId, function(err) {
        if (err) return cb(new errors.InternalServerError(err));
        createInStore(cb);
      });
    }
  });
};

documents.updateMeta = function(id, meta, cb) {
  cb("Not implemented.");
};

documents.getInfo = function(creator, docId, cb) {
  var store = getStore(creator);
  var doc = store.getInfo(docId);
  if (cb) cb(null, doc);
  return doc;
};

// Documents for a particular user
// TODO: for consistency with Substance.Store return a list instead of a hash!
documents.list = function(creator, cb) {
  getStore(creator).list(function(err, docs) {
    if (err) cb(err);
    else {
      var result = {};
      _.each(docs, function(doc) {
        result[doc.id] = doc;
      });
      cb(null, result);
    }
  });
};

// Get document
documents.get = function(doc, cb) {
  getStore(doc.creator).get(doc.id, cb);
};

// Gets commits for a particular document
documents.commits = function(doc, startCommit, cb) {
  var result = documents.getInfo(doc.creator, doc.id);
  var store = getStore(doc.creator);
  var lastCommit, commits;

  var refs = store.getRefs(doc.id);

  lastCommit = (refs.master) ? refs.master.last : null;
  // TODO: we could have a low level interface for commit ranges
  commits = store.commits(doc.id, lastCommit, startCommit);
  // console.log("Commits from store", commits);

  result.commits = commits;
  cb(null, result);
};

documents.delete = function (doc, cb) {
  getStore(doc.creator).delete(doc.id, function(err, results) {
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

documents.clear = function() {
  cb("Not implemented");
};

documents.update_new = function(id, options, cb) {
  cb("Not implemented");
};

// TODO: switch to the new update signature (needs to be done globally)
documents.update = function(doc, commits, meta, refs, cb) {
  var store = getStore(doc.creator);
  store.update(doc.id, commits, meta, refs, cb);
};

documents.setRefs = function(id, branch, refs, cb) {
  cb("Not implemented");
};

documents.getRefs = function(id, branch, cb) {
  cb("Not implemented");
};

documents.setSnapshot = function (id, data, title, cb) {
  cb("Not implemented");
};

documents.deletedDocuments = function(cb) {
  cb("Not implemented");
};

documents.confirmDeletion = function(id, cb) {
  cb("Not implemented");
};

// Seed Document Store
// This is redundant to composer/src/model.js
documents.seed = function(seeds, cb) {
  // console.log('Seeding the docstore...');
  var store = getStore("");
  store.clear();

  if (seeds) {
    _.each(seeds, function(seed, scope) {
      getStore(scope).seed(seed);

      _.each(seed.documents, function(doc, id) {
        documentsDb.create(scope, id);
      });
    });
  }
  cb(null);
};

documents.dump = function(cb) {
  cb("Not implemented.");
};

documents.createBlob = function(id, base64data, cb) {
  cb("Not implemented.");
};

documents.getBlob = function(id, cb) {
  cb("Not implemented.");
};

documents.blobExists = function (id, cb) {
  cb("Not implemented.");
};

documents.deleteBlob = function(id, cb) {
  cb("Not implemented.");
};

documents.listBlobs = function(cb) {
  cb("Not implemented.");
};

// Hubstore API extensions
// =================

// List collaborations
documents.collaborations = function(username, cb) {
  var util = require('../../util/util');

  collaborators.listCollaborations(username, function(err, collaborations) {
    // stop on error
    if (err) return cb(err, null);

    var result = {};
    var afterAll = util.propagate(result, cb);

    util.async.each(collaborations, function(collaborator, cb) {
      documentsDb.get(collaborator.document, function(err, doc) {
        if(err) console.log("WARNING: Found invalid entry in collaborations.");
        if(doc) result[doc.id] = documents.getInfo(doc.creator, doc.id);
        cb(null);
      });
    })(null, afterAll);
  });
};

documents.incrementVersion = function(document, cb) {
  documentsDb.get(document, function(err, doc) {
    if (err) return cb(err);
    db.query(UPDATE_DOCUMENT_VERSION_SQL, [doc.latest_version+1, document], function (err, results) {
      return cb(err, doc.latest_version+1);
    });
  });
};

// legacy: called from publications.js
// TODO: improve this
documents.getDocumentById = function(docId, cb) {
  documentsDb.get(docId, cb);
};

// legacy: called from publications.js
// TODO: improve this
documents.createDocumentEntry = function(creator, docId, cb) {
  db.query(INSERT_DOCUMENT_SQL, [docId, null, creator, 0], cb);
};

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

