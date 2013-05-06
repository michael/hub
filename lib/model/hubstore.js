var _ = require('underscore');
var errors = require('../errors');
var util = require('../../util/util')
var collaborators = require('./collaborators');
var Store = require('substance-store');
var documents = require('./documents');

var REDIS_PORT = parseInt(process.env['SUBSTANCE_REDIS_PORT'], 10);
if (!REDIS_PORT) throw ("NOOOOOOOO ..... substance redis port given... ehem. §%!");

function getStore(username) {
  var scope = username || "";
  return new Store.RedisStore({scope: scope, port: REDIS_PORT});
}

var HubStore = module.exports = function(username) {
    //console.log("HubStore(): username", username);

    var self = this;
    var store = getStore(username);
    var util = require('../../util/util');

    // Private methods
    // ---------

    function getCollaborations(cb) {

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
              var origin = new HubStore(doc.creator);
              if(err) console.log("WARNING: Found invalid entry in collaborations.");
              if(doc) result[doc.id] = origin.getInfo(doc.id);
              cb(null);
            })
          },
          finally: function(err) { cb(err, result); }
        })(null, cb);
      });
    };

    // Store API
    // --------

    this.exists = function(docId, cb) {
      return store.exists(docId);
    };

    this.create = function (docId, meta, cb) {
      // this is called whenever a document has been created in
      // the postgres backend but fails to be created in the user's redis store.
      function rollback(err) {
        self.delete(docId, function(err, result) {});
        store.delete(docId);
        cb(err, null);
      }

      function createInStore(cb) {
        store.create(docId, function(err, newDoc) {
          if (err) return rollback(err);
          // Note: if meta-data is given, the store will be called once again
          //  to update the doc's meta data
          else if (meta) store.update(docId, {meta: meta}, function(err) {
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
          var document = {id: docId, creator: username};
          documents.create(document, function(err) {
            if (err) return cb(new errors.InternalServerError(err));
            createInStore(cb);
          });
        }
      });
    };

    this.getInfo = function(docId, cb) {
      var doc = store.getInfo(docId);
      if (cb) cb(null, doc);
      return doc;
    };

    // Documents for a particular user
    // TODO: for consistency with Substance.Store return a list instead of a hash!
    this.list = function(cb) {

      var docs;
      var collaborations;
      var result = {};

      function getOwnDocs(data, cb) {
        store.list(function(err, data) {
          docs = data;
          //console.log("HubStore.list: own docs", docs);
          cb(err);
        });
      }

      function _getCollaborations(data, cb) {
        getCollaborations(function(err, data) {
          collaborations = data;
          //console.log("HubStore.list: collaborations", collaborations);
          cb(err);
        });
      }

      function expandDocs(data, cb) {
        _.each(docs, function(doc) {
          result[doc.id] = doc;
        });
        _.extend(result, collaborations);
        cb(null, result);
      }

      var options = {
        functions: [getOwnDocs, _getCollaborations, expandDocs],
      }
      util.async.sequential(options, cb);
    };

    // Get document
    this.get = function(docId, cb) {
      store.get(docId, cb);
    };

    // Gets commits for a particular document
    this.commits = function(docId, startCommit, cb) {
      if (!store.exists(docId)) {
        var msg = "Document does not exist";
        if (cb) return cb(msg);
        throw msg;
      }

      var result = self.getInfo(docId);

      var refs = store.getRefs(docId);
      var lastCommit = (refs.master) ? refs.master.last : null;
      // TODO: we could have a low level interface for commit ranges
      var commits = store.commits(docId, lastCommit, startCommit);
      // console.log("Commits from store", commits);

      result.commits = commits;
      cb(null, result);
    };

    this.delete = function (docId, cb) {
      var doc = {
        id: docId
      }

      var publications = require('./publications');
      var versions = require('./versions');

      function storeDelete(data, cb) {
        store.delete(docId, cb);
      }

      function dbDelete(data, cb) {
        documents.delete(doc, cb);
      }

      function deleteVersions(data, cb) {
        versions.deleteAll(docId, cb);
      }

      function deletePublications(data, cb) {
        publications.deleteAll(docId, cb);
      }

      var options = {
        functions: [storeDelete, dbDelete, deleteVersions, deletePublications],
        stopOnError: false
      };
      util.async.sequential(options, cb);
    };

    this.clear = function(cb) {
      // TODO remove all documents from sql db for which this
      // user is creator
      cb("Not implemented");
    };

    this.update = store.update;

    this.setRefs = store.setRefs;

    this.getRefs = store.getRefs;

    this.setSnapshot = store.setSnapshot;

    this.deletedDocuments = store.deletedDocuments;

    this.confirmDeletion = store.confirmDeletion;

    // TODO: should this be static in general?
    this.seed = function(seeds, cb) {
      HubStore.seed(seeds, cb);
    };

    this.dump = function(cb) {
      // TODO provide everything what is needed to seed the hub
      cb("Not implemented.");
    };

    this.createBlob = store.createBlob;

    this.getBlob = store.getBlob;

    this.blobExists = function(docId, blobId, cb) {
      cb("Not implemented.");
    };

    this.deleteBlob = store.deleteBlob;

    this.listBlobs = store.listBlobs;

};

// Static methods
// ----------

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

// Global API
// ---------

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
      new HubStore(args.username).create(args.document, args.meta, cb);
    }
  },
  "delete": {
    ensure: global.api.isCreator,
    method: withDoc(function(args, doc, cb) {
      new HubStore(doc.creator).delete(doc.id, cb);
    })
  },
  "update": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore update: args", args, "doc", doc);
      new HubStore(doc.creator).update(doc.id, args, cb);
    })
  },
  "get": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore get: doc", doc);
      new HubStore(doc.creator).get(doc.id, cb);
    })
  },
  "commits": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore commits", doc);
      new HubStore(doc.creator).commits(doc.id, args.startCommit, cb);
    })
  },
  "find": {
    method: function(args, cb) {
      //console.log("hubstore find", args);
      new HubStore(args.username).list(cb);
    }
  },
  "getBlob": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore getBlob", args, doc);
      new HubStore(doc.creator).getBlob(doc.id, args.blob, cb);
    })
  },
  "findBlobs": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore findBlobs", args, doc);
      new HubStore(doc.creator).listBlobs(doc.id, cb);
    })
  },
  "createBlob": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore createBlob", args, doc);
      new HubStore(doc.creator).createBlob(doc.id, args.blob, args.data, cb);
    })
  },
}
global.api.register("hubstore", api);
