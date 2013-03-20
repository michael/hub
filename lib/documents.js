var _ = require('underscore');
var db = require('./db');
var bcrypt = require('bcrypt');
var errors = require('./errors');
var collaborators = require('./collaborators');
var Store = require('substance-store');

var DOCUMENT_BY_ID = 'SELECT * FROM Documents WHERE id = $1',
    INSERT_DOCUMENT_SQL = 'INSERT INTO Documents (id, name, creator, latest_revision) VALUES ($1, $2, $3, $4);',
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

  // HACK: somehow the refs are not set by store.getInfo
  doc.refs = {
    'tail': store.getRef(doc.id, 'tail'),
    'master': store.getRef(doc.id, 'master')
  };

  return doc;
}

// Provide access to a document while checking permissions for a given user and a document.
documents.getDocumentAccess = function(username, docId, permission, callback) {
  // console.log("documents.getDocumentAccess(" + username +", "+docId+")");

  documents.getDocumentById(docId, function(err, doc) {
    if (err) callback(err, null);
    else collaborators.listCollaborators (docId, function(err, result) {
      if (err) return callback(err, null);

      var isCreator = (doc.creator === username);
      var isCollaborator = false;
      _.each(result, function(collab) {
        if (collab.collaborator === username) isCollaborator = true;
      });
      // console.log("... isCollaborator: ", isCollaborator);
      //isCollaborator = false;

      var permits = {
        read: function(username) { return isCollaborator; },
        write: function(username) { return isCollaborator; },
        delete: function(username) { return false; }, // only allowed by owner
        manage: function(username) { return isCollaborator; }
      };

      // creator is allowed to do everything
      if (isCreator || (permits[permission] && permits[permission](username))) {
        //console.log("Access '"+permission+"' permitted for user '"+username+"' on document '"+docId+"'.");
        callback(null, doc);
      } else {
        //console.log("Access '"+permission+"' denied for user '"+username+"' on document '"+docId+"'.");
        callback(new errors.Forbidden("Access '"+permission+"' denied for user '"+username+"' on document '"+docId+"'."), null);
      }
    });
  });
};

documents.create = function (creator, document, meta, callback) {

  var store = documents.getStore(creator);
  var docStub = {creator: creator, id: document};

  // this is called whenever a document has been created in
  // the postgres backend but fails to be created in the user's redis store.
  // TODO: use transaction mechanism?
  function rollback(err) {
    documents.delete(docStub, function(err, result) {});
    store.delete(docStub.id);
    callback(err, null);
  }

  // the document should not exist
  documents.getDocumentById(document, function(err, alreadyExists) {
    if (alreadyExists) callback(new errors.WrongValue("Document already exists: " + creator + ", " + document));
    else {
      db.query(INSERT_DOCUMENT_SQL, [document, null, creator, 1], function (err, results) {
        if (err) return callback(new error.InternalServerError("SQL error: could not insert document."), null);

        store.create(document, function(err, newDoc) {
          if (err) return rollback(err);
          // Note: if meta-data is given, the store will be called once again
          //  to update the doc's meta data
          else if (meta) store.updateMeta(document, meta, function(err) {
            if (err) return rollback(err);
            else callback(null, newDoc);
          });
          else callback(null, newDoc);
        });
      });
    }
  });
};

documents.delete = function (doc, callback) {
  documents.getStore(doc.creator).delete(doc.id, function(err, results) {
    if (err) callback(err, null);
    else db.query(DELETE_DOCUMENT_SQL, [doc.id], function (err, results) {
      if (err) callback(new error.InternalServerError("SQL error: could not delete document.", null));
      else callback(null, true);
    });
  });
};

documents.update = function(doc, commits, meta, refs, callback) {
  var store = documents.getStore(doc.creator);

  // TODO: the following should be an atomic transaction
  //  (could be done via store.redis.beginTransaction etc.)
  store.update(doc.id, commits, function(err) {
    if (err) return callback(err);
    store.updateMeta(doc.id, meta, function(err) {
      if (err) callback(err, null);
      else {
        // Update master ref
        if (refs && refs["master"]) {
          store.setRef(doc.id, 'master', refs.master);
        }
        callback(null, true)
      }
    });
  });
};

// Documents for a particular user
documents.documents = function(creator, callback) {
  documents.getStore(creator).list(function(err, docs) {
    if (err) callback(err, null);
    else {
      var result = {};
      _.each(docs, function(doc) {
        result[doc.id] = doc;
      });
      callback(null, result);
    }
  });
}

// List collaborations
documents.collaborations = function(username, callback) {
  collaborators.listCollaborations(username, function(err, collaborations) {
    // stop on error
    if (err) return callback(err, null);

    var result = {};
    // for each registered collaboration retrieve the document (without content)
    // and add it to the result
    function next(index) {
      if(index < collaborations.length) {
        documents.getDocumentById(collaborations[index].document, function(err, _doc){
          if(err) console.log("WARNING: Found invalid entry in collaborations.");
          if(_doc) result[_doc.id] = documents.getDocumentInfo(_doc.creator, _doc.id);
          next(index + 1);
        });
      } else {
        callback(null, result);
      }
    }
    next(0);
  });
};

// Get document
documents.get = function(doc, callback) {
  documents.getStore(doc.creator).get(doc.id, callback);
};

// Gets commits for a particular document
documents.commits = function(doc, startCommit, callback) {
  var result = documents.getDocumentInfo(doc.creator, doc.id);
  var store = documents.getStore(doc.creator);
  var tailCommit, commits;

  tailCommit = store.getRef(doc.id, 'tail');
  // TODO: we could have a low level interface for commit ranges
  commits = store.commits(doc.id, tailCommit, startCommit);
  console.log("Commits from store", commits);

  result.commits = commits;
  callback(null, result);
};

documents.addCollaborator = function(doc, collaborator, callback) {
  collaborators.add(doc.id, collaborator, callback);
};

documents.deleteCollaborator = function(doc, collaborator, callback) {
  collaborators.delete(doc.id, collaborator, callback);
};

documents.incrementVersion = function(document, callback) {
  documents.getDocumentById(document, function(err, doc) {
    if (err) return callback(err);
    db.query(UPDATE_DOCUMENT_VERSION_SQL, [doc.latest_version+1, document], function (err, results) {
      return callback(err, doc.latest_version+1);
    });
  }); 
};
