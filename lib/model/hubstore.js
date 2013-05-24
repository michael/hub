var _ = require('underscore');
var errors = require('../errors');
var util = require('../../util/util')
var collaborators = require('./collaborators');
var store = require('substance-store');
var Store = require('../../store/src/store').Store;
var AsyncStore = require('../../store/src/async_store');
var documents = require('./documents');

var REDIS_PORT = parseInt(process.env['SUBSTANCE_REDIS_PORT'], 10);
if (!REDIS_PORT) throw ("NOOOOOOOO ..... substance redis port given... ehem. §%!");

function getStore(username) {
  var scope = username || "";
  return new store.RedisStore({scope: scope, port: REDIS_PORT});
}

var HubStore = function(username) {
    AsyncStore.call(this, getStore(username));
    this.username = username;
};

HubStore.__prototype__ = function() {

    var __super__ = util.prototype(this);

    this.getCollaborations = function(cb) {

      collaborators.listCollaborations(this.username, function(err, collaborations) {
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
              if(doc) origin.getInfo(doc.id, function(err, data) {
                result[doc.id] = data;
                cb(null);
              });
              else cb(null);
            })
          },
          finally: function(err) { cb(err, result); }
        })(null, cb);
      });
    };

    function createInDb(docId, creator, cb) {
      // The document could exist if it has been published (without being synced)
      documents.get(docId, function(err, alreadyExists) {
        if (alreadyExists) return cb(null);
        var doc = {id: docId, creator: creator};
        documents.create(doc, function(err) {
          if (err) cb(new errors.StoreError(err));
          else cb(null);
        });
      });
    }

    this.create = function (docId, options, cb) {
      var self = this;
      createInDb(docId, this.username, function(err) {
        if (err) return cb(err);
        __super__.create.call(self, docId, options, cb);
      });
    };

    // Documents for a particular user
    this.list = function(cb) {

      var self = this;
      var docs = this.store.list();
      var collaborations;
      var result = {};

      self.getCollaborations(function(err, collaborations) {
        if (err) return cb(err);
        _.each(collaborations, function(doc) {
          docs.push(doc);
        });
        cb(null, docs);
      });
    };

    function deleteFromDb(docId,  cb) {

      var publications = require('./publications');
      var versions = require('./versions');

      var doc = {
        id: docId
      };

      function dbDelete(cb) {
        documents.delete(doc, cb);
      }

      function deleteVersions(cb) {
        versions.deleteAll(docId, cb);
      }

      function deletePublications(cb) {
        publications.deleteAll(docId, cb);
      }

      var options = {
        functions: [dbDelete, deleteVersions, deletePublications],
        stopOnError: false
      };

      util.async.sequential(options, cb);
    }

    this.delete = function (docId, cb) {
      this.store.delete(docId);
      deleteFromDb(docId, cb);
    };

    // we need to intercept store commands to keep the db in sync
    this.applyCommand = function(trackId, command, cb) {
      var self = this;

      try {
        console.log("Hubstore.applyCommand:", "trackId", trackId, "command", command);
        this.store.applyCommand(trackId, command);

        // necessary only for store changes
        if (trackId !== Store.MAIN_TRACK) return cb(null);

        var cmd = command.command;
        var name = cmd[0];
        var docId = cmd[1];

        if (name === "create") {
          console.log("Hubstore.applyCommand: creating document", docId);
          // Note: only own documents need to be registered in the db
          // E.g., it is not allowed to control collaborations from the client;
          // they must be granted using the hubstore.
          var role = cmd[2].role;
          if (role === "creator") {
            return createInDb(docId, this.username, cb);
          }
        }
        else if (name === "update") {
          // Updates to the document's state (i.e., role) have only an effect when done via hub
        }
        else if (name === "delete") {

          // Strategy: in future, a collaborator might be allowed to delete a document too.
          // Thus, in the case that the document is not owned by the current user,
          // the deletion has to be propagated to the owners HubStore.

          // Basically, the user needs to have permission for deleting the document
          return documents.get(docId, function(err, doc) {
            if(err) {
              // tolerate if the document does not exist
              console.log("HubStore.applyCommand", "err=", err);
              cb(null);
            } else if (doc.creator !== self.username) {
              // user is not creator, delegate deletion to another store
              console.log("Hubstore.applyCommand: delegating deletion to another store", doc.creator, docId);
              global.api.execute("hubstore", "delete", {document: docId}, {username: self.username}, function(err) {
                // Do not fail in this case: the user deleted the document from his store.
                // If he is not permitted to delete the original document
                // it is ok that this operation does not have an effect.
                cb(null);
              });
            } else {
              // the user is creator, remove the document from db
              console.log("Hubstore.applyCommand: deleting document", docId);
              deleteFromDb(docId, cb);
            }
          });
        }
        else this.store.applyCommand(trackId, command);

        cb(null);

      } catch(err) {
        return cb(err);
      }
    }

    // TODO: should this be static in general?
    this.seed = function(seeds, cb) {
      HubStore.seed(seeds, cb);
    };

};

HubStore.__prototype__.prototype = AsyncStore.prototype;
HubStore.prototype = new HubStore.__prototype__();

// Static methods
// ----------

// Seed Document Store
// This is redundant to composer/src/model.js
HubStore.seed = function(seeds, cb) {
  // console.log('HubStore.seed', seeds);

  var store = getStore();
  store.impl.clear();

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
      new HubStore(args.username).create(args.document, args, cb);
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
  "info": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      new HubStore(doc.creator).getInfo(doc.id, cb);
    })
  },
  "commits": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore commits", doc);
      new HubStore(doc.creator).commits(doc.id, args, cb);
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
  "listBlobs": {
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
  "deleteBlob": {
    ensure: global.api.isCollaboratorOrCreator,
    method: withDoc(function(args, doc, cb) {
      //console.log("hubstore createBlob", args, doc);
      new HubStore(doc.creator).deleteBlob(doc.id, args.blob, cb);
    })
  },
  "getChanges": {
    method: function(args, cb) {
      //console.log("hubstore getChanges", args);
      new HubStore(args.username).getChanges(args.track, args.ids, cb);
    }
  },
  "getIndex": {
    method: function(args, cb) {
      //console.log("hubstore getLastChange", args);
      new HubStore(args.username).getIndex(args.track, cb);
    }
  },
  "applyChange": {
    method: function(args, cb) {
      //console.log("hubstore applyChange", args);
      new HubStore(args.username).applyCommand(args.track, args.command, cb);
    }
  }
}
global.api.register("hubstore", api);

module.exports = HubStore;
