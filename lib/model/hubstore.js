var _ = require('underscore');
var errors = require('../errors');
var util = require('../../util/util')
var collaborators = require('./collaborators');
var store = require('substance-store');
var documents = require('./documents');

var REDIS_PORT = parseInt(process.env['SUBSTANCE_REDIS_PORT'], 10);
if (!REDIS_PORT) throw ("NOOOOOOOO ..... substance redis port given... ehem. §%!");

function getStore(username) {
  var scope = username || "";
  return new store.RedisStore({scope: scope, port: REDIS_PORT});
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

    // Store API
    // --------

    this.exists = function(docId, cb) {
      cb(null, store.exists(docId));
    };


    this.create = function (docId, options, cb) {
      function createInStore() {
        try {
          var newDoc = store.create(docId, options);
          cb(null, newDoc);
        } catch(err) {
          cb(err);
        }
      }

      // The document could exist if it has been published (without being synced)
      documents.get(docId, function(err, alreadyExists) {
        if (alreadyExists) {
          createInStore();
        } else {
          var document = {id: docId, creator: username};
          documents.create(document, function(err) {
            if (err) return cb(new errors.InternalServerError(err));
            createInStore();
          });
        }
      });
    };

    // this.create = function (docId, meta, cb) {

    //   var existsInDB;
    //   var doc;

    //   // The document could exist if it has been published (without being synced)
    //   function getFromDb(cb) {
    //     documents.get(docId, function(err, doc) {
    //       existsInDB = !!doc;
    //       cb(null);
    //     });
    //   }

    //   function createInDb(cb) {
    //     if (!existsInDB) {
    //       var document = {id: docId, creator: username};
    //       documents.create(document, cb);
    //     } else cb(null);
    //   }

    //   function createInStore(cb) {
    //     var options = {
    //       meta: meta
    //     }
    //     doc = store.create(docId, options);
    //     cb(null);
    //   }

    //   util.async.sequential([getFromDb, createInDb, createInStore], function(err) {
    //     if(err) cb(err);
    //     else cb(null, doc);
    //   });
    // };

    this.getInfo = function(docId, cb) {
      try {
        var doc = store.getInfo(docId);
        cb(null, doc);
      } catch (err) { cb(err); }
    };

    // Documents for a particular user
    // TODO: for consistency with Substance.Store return a list instead of a hash!
    this.list = function(cb) {

      var docs = store.list();
      var collaborations;
      var result = {};

      function _getCollaborations(cb) {
        getCollaborations(function(err, data) {
          collaborations = data;
          //console.log("HubStore.list: collaborations", collaborations);
          cb(err);
        });
      }

      function expandDocs(cb) {
        _.each(docs, function(doc) {
          result[doc.id] = doc;
        });
        _.extend(result, collaborations);
        cb(null, result);
      }

      var functions = [_getCollaborations, expandDocs];
      util.async.sequential(functions, cb);
    };

    // Get document
    this.get = function(docId, cb) {
      try {
        var result = store.get(docId);
        cb(null, result);
      } catch (err) { cb(err); }
    };

    // Gets commits for a particular document
    this.commits = function(docId, last, since, cb) {
      try {
        var result = store.commits(docId, last, since);
        cb(null, result);
      } catch (err) { console.log(err, err.stack); cb(err); }
    };

    this.delete = function (docId, cb) {
      var doc = {
        id: docId
      }

      var publications = require('./publications');
      var versions = require('./versions');

      function storeDelete(cb) {
        store.delete(docId);
        cb(null);
      }

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

    this.update = function (id, options, cb) {
      try {
        store.update(id, options);
        cb(null);
      } catch (err) { cb(err); }
    };

    this.setRefs = function(id, branch, refs, cb) {
      cb = arguments[arguments.length-1];
      store.setRefs(id, branch, refs);
      cb(null);
    }

    this.getRefs = function(id, branch, cb) {
      if (arguments.length == 2) {
        cb = branch;
        branch = null;
      }
      var result = store.getRefs(id, branch);
      cb(null, result);
    }

    this.deletedDocuments = function(cb) {
      store.deletedDocuments();
      cb(null);
    }

    this.confirmDeletion = function(id, cb) {
      store.confirmDeletion(id);
      cb(null);
    }

    // TODO: should this be static in general?
    this.seed = function(seeds, cb) {
      HubStore.seed(seeds, cb);
    };

    this.dump = function(cb) {
      // TODO provide everything what is needed to seed the hub
      cb("Not implemented.");
    };

    this.createBlob = function(id, blobId, data, cb) {
      try {
        var blob = store.createBlob(id, blobId, data);
        cb(null, blob);
      } catch (err) { cb(err); }
    }

    this.getBlob = function(id, blobId, cb) {
      try {
        var blob = store.getBlob(id, blobId);
        cb(null, blob);
      } catch (err) { cb(err); }
    }

    this.blobExists = function(docId, blobId, cb) {
      cb(null, store.blobExists(docId, blobId));
    };

    this.deleteBlob = function(docId, blobId, cb) {
      store.deleteBlob(docId, blobId);
      cb(null);
    }

    this.listBlobs = function(docId, cb) {
      var blobs = store.listBlobs(docId);
      cb(null, blobs);
    }

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
      new HubStore(doc.creator).commits(doc.id, args.last, args.since, cb);
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
