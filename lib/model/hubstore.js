var _ = require('underscore');
var errors = require('../errors');
var util = require('../../util/util')
var collaborators = require('./collaborators');
var Store = require('substance-store');
var documents = require('./documents');

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
      var document = {id: docId, creator: creator};

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
          documents.create(document, function(err) {
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

      var publications = require('./publications');
      var versions = require('./versions');

      function storeDelete(data, cb) {
        store.delete(doc.id, cb);
      }

      function dbDelete(data, cb) {
        documents.delete(doc, cb);
      }

      function deleteVersions(data, cb) {
        versions.deleteAll(doc.id, cb);
      }

      function deletePublications(data, cb) {
        publications.deleteAll(doc.id, cb);
      }

      var options = {
        functions: [storeDelete, dbDelete, deleteVersions, deletePublications],
        stopOnError: false
      };
      util.async.sequential(options, cb);
    };

    this.clear = function() {
      cb("Not implemented");
    };

    this.update_new = function(id, options, cb) {
      cb("Not implemented");
    };

    // TODO: switch to the new update signature (needs to be done globally)
    this.update = function(doc, commits, meta, refs, cb) {
      //console.log("HubStore.update", arguments)
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
      var document = {
        id: docId,
        creator: creator
      };
      documents.create(document, cb);
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
    _.each(seeds, function(seed, creator) {
      getStore(creator).seed(seed);

      _.each(seed.documents, function(doc, id) {
        //console.log('HubStore.seed... each...', doc, id);
        var document = {
          id: id,
          creator: creator,
        }
        documents.create(document, function(err) {
          if (err) console.log("Hubstore.seed: Error", err);
          else console.log("Hubstore.seed: created document", creator, id);
        });
      });
    });
  }
  cb(null);
};

function withDoc(func) {
  return function(args, cb) {
    documents.get(args.document, function(err, doc) {
      if (err) return cb(err);
      func(args, doc, cb);
    });
  };
}

// Declare how this model is used by the hub
var api = {
  "create": {
    method: function(args, cb) {
      new HubStore({username: args.username}).create(args.creator, args.document, args.meta, cb);
    }
  },
  "delete": {
    ensure: global.api.isCreator,
    method: withDoc(function(args, doc, cb) {
      new HubStore({username: doc.creator}).delete(doc, cb);
    })
  },
  "update": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore update: args", args, "doc", doc);
      new HubStore({username: doc.creator}).update(doc,
        args.commits, args.meta, args.refs, cb);
    })
  },
  "get": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore get: doc", doc);
      new HubStore({username: doc.creator}).get(doc, cb);
    })
  },
  "commits": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore commits", doc);
      new HubStore({username: doc.creator}).commits(doc, args.startCommit, cb);
    })
  },
  "find": {
    method: function(args, cb) {
      //console.log("hubstore find", args);
      new HubStore({username: args.username}).list(args.username, cb);
    }
  },
  "collaborations": {
    method: function(args, cb) {
      //console.log("hubstore find", args);
      new HubStore({username: args.username}).collaborations(args.username, cb);
    }
  },
}
global.api.register("hubstore", api);
