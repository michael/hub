var _ = require('underscore');
var db = require('../db');
var bcrypt = require('bcrypt');
var errors = require('../errors');
var collaborators = require('./collaborators');
var Store = require('substance-store');
var documents = require('./documents');


// Only temporarily to achieve a smaller refactoring step:
var DOCUMENT_BY_ID = 'SELECT * FROM Documents WHERE id = $1',
    INSERT_DOCUMENT_SQL = 'INSERT INTO Documents (id, name, creator, latest_version) VALUES ($1, $2, $3, $4);',
    DELETE_DOCUMENT_SQL = 'DELETE FROM Documents WHERE id = $1',
    UPDATE_DOCUMENT_VERSION_SQL = 'UPDATE Documents SET latest_version = $1 WHERE id = $2';

function getStore(username) {
  var scope = username || "";
  return new Store.RedisStore({scope: scope, port: 6380});
}

var HubStore = module.exports = function(settings) {

    var self = this;

    function store(username) {
      username = username || settings.username;
      return getStore(username);
    }

    // Store API
    // ==============

    this.exists = function(docId, cb) {
      cb("Not implemented");
    };

    this.create = function (creator, docId, meta, cb) {

      var docStub = {creator: creator, id: docId};
      var store = getStore(creator);

      // this is called whenever a document has been created in
      // the postgres backend but fails to be created in the user's redis store.
      // TODO: use transaction mechanism?
      function rollback(err) {
        self.delete(docStub, function(err, result) {});
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
      documents.get(docId, function(err, alreadyExists) {
        if (alreadyExists) {
          createInStore(cb);
        } else {
          documents.create(creator, docId, function(err) {
            if (err) return cb(new errors.InternalServerError(err));
            createInStore(cb);
          });
        }
      });
    };

    this.updateMeta = function(id, meta, cb) {
      cb("Not implemented.");
    };

    this.getInfo = function(creator, docId, cb) {
      var doc = getStore(creator).getInfo(docId);
      if (cb) cb(null, doc);
      return doc;
    };

    // Documents for a particular user
    // TODO: for consistency with Substance.Store return a list instead of a hash!
    this.list = function(creator, cb) {
      getStore(creator).list(function(err, docs) {
        if (err) return cb(err);
        // TODO: aggregate the documents with those that the user is registered for as a collaborator

        var result = {};
        _.each(docs, function(doc) {
          result[doc.id] = doc;
        });
        cb(null, result);
      });
    };

    // Get document
    this.get = function(doc, cb) {
      getStore(doc.creator).get(doc.id, cb);
    };

    // Gets commits for a particular document
    this.commits = function(doc, startCommit, cb) {
      var store = getStore(doc.creator);

      if (!store.exists(doc.id)) {
        var msg = "Document does not exist";
        if (cb) return cb(msg);
        throw msg;
      }

      var result = self.getInfo(doc.creator, doc.id);

      var refs = store.getRefs(doc.id);
      var lastCommit = (refs.master) ? refs.master.last : null;
      // TODO: we could have a low level interface for commit ranges
      var commits = store.commits(doc.id, lastCommit, startCommit);
      // console.log("Commits from store", commits);

      result.commits = commits;
      cb(null, result);
    };

    this.delete = function (doc, cb) {
      var store = getStore(doc.creator);

      store.delete(doc.id, function(err, results) {
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

    this.clear = function() {
      cb("Not implemented");
    };

    this.update_new = function(id, options, cb) {
      cb("Not implemented");
    };

    // TODO: switch to the new update signature (needs to be done globally)
    this.update = function(doc, commits, meta, refs, cb) {
      var store = getStore(doc.creator);

      store.update(doc.id, commits, meta, refs, cb);
    };

    this.setRefs = function(id, branch, refs, cb) {
      cb("Not implemented");
    };

    this.getRefs = function(id, branch, cb) {
      cb("Not implemented");
    };

    this.setSnapshot = function (id, data, title, cb) {
      cb("Not implemented");
    };

    this.deletedDocuments = function(cb) {
      cb("Not implemented");
    };

    this.confirmDeletion = function(id, cb) {
      cb("Not implemented");
    };

    // TODO: should this be static in general?
    this.seed = function(seeds, cb) {
      HubStore.seed(seeds, cb);
    };

    this.dump = function(cb) {
      cb("Not implemented.");
    };

    this.createBlob = function(id, base64data, cb) {
      cb("Not implemented.");
    };

    this.getBlob = function(id, cb) {
      cb("Not implemented.");
    };

    this.blobExists = function (id, cb) {
      cb("Not implemented.");
    };

    this.deleteBlob = function(id, cb) {
      cb("Not implemented.");
    };

    this.listBlobs = function(cb) {
      cb("Not implemented.");
    };

    // Hubstore API extensions
    // =================

    // List collaborations
    this.collaborations = function(username, cb) {
      var util = require('../../util/util');

      collaborators.listCollaborations(username, function(err, collaborations) {
        //console.log("hubstore.collaborations: collaborations", collaborations);
        // stop on error
        if (err) return cb(err, null);
        var result = {};

        util.async.iterator({
          items: collaborations,
          iterator: function(collaborator, cb) {
            //console.log("hubstore.collaborations: collaborator", collaborator);
            documents.get(collaborator.document, function(err, doc) {
              //console.log("hubstore.collaborations: doc", doc);
              var origin = new HubStore({username: doc.creator});
              if(err) console.log("WARNING: Found invalid entry in collaborations.");
              if(doc) result[doc.id] = origin.getInfo(doc.creator, doc.id);
              cb(null);
            })
          },
          finally: function(err) { cb(err, result); }
        })(null, cb);
      });
    };

    // legacy: called from publications.js
    // TODO: improve this
    this.getDocumentById = function(docId, cb) {
      documents.get(docId, cb);
    };

    // legacy: called from publications.js
    // TODO: improve this
    this.createDocumentEntry = function(creator, docId, cb) {
      db.query(INSERT_DOCUMENT_SQL, [docId, null, creator, 0], cb);
    };

    // Provide access to a document while checking permissions for a given user and a document.
    // @deprecated follow the new hub API protocol (using ensure etc.)
    this.getDocumentAccess = function(username, docId, permission, cb) {
      // console.log("self.getDocumentAccess", username, docId, permission);

      self.getDocumentById(docId, function(err, doc) {
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
};

// static methods

// Seed Document Store
// This is redundant to composer/src/model.js
HubStore.seed = function(seeds, cb) {
  //console.log('HubStore.seed', seeds);

  var store = getStore();
  store.clear();

  if (seeds) {
    _.each(seeds, function(seed, scope) {
      getStore(scope).seed(seed);

      _.each(seed.documents, function(doc, id) {
        //console.log('HubStore.seed... each...', doc, id);
        documents.create(scope, id);
      });
    });
  }
  cb(null);
};
