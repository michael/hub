var _ = require('underscore');
var errors = require('../errors');
var util = require('../../util/util')
var collaborators = require('./collaborators');
var store = require('substance-store');
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

    this.create = function (docId, options, cb) {
      var self = this;

      function createInStore() {
        try {
          var newDoc = self.store.create(docId, options);
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
          var document = {id: docId, creator: self.username};
          documents.create(document, function(err) {
            if (err) return cb(new errors.StoreError(err));
            createInStore();
          });
        }
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

    this.delete = function (docId, cb) {
      var self = this;

      var doc = {
        id: docId
      }

      var publications = require('./publications');
      var versions = require('./versions');

      function storeDelete(cb) {
        self.store.delete(docId);
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
  //console.log('HubStore.seed', seeds);

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
      new HubStore(doc.creator).commits(doc.id, args.options, cb);
    })
  },
  "find": {
    method: function(args, cb) {
      //console.log("hubstore find", args);
      new HubStore(args.username).list(cb);
    }
  },
  "getBlobs": {
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
  }
}
global.api.register("hubstore", api);

module.exports = HubStore;
