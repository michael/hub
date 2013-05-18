// Expose API

var api = {};
var models = {};

var _ = require("underscore");


function prepareError(err) {
  var result = {};
  result.status = err.status || 500;
  result.message = err.message || err.toString();
  result.stack = err.stack || null;

  return result;
}

api.execute = function(model, command, args, session, cb) {
  //console.log("api.exeute", model, command, args, session);
  // check if model and command are registered
  if (!models[model] || !models[model][command]) {
    cb("Unknown command: "+model+"."+command);
  } else {
    var spec = models[model][command];
    // console.log("api.exeute: found spec", spec);
    if (spec.ensure) {
      spec.ensure(args, session, function(err) {
        if (err) return cb(err);
        try {
          spec.method(args, cb);
        } catch (err) {
          console.log(err);
          if(err.stack) console.log(err.stack);
          cb(prepareError(err));
        }
      });
    } else {
      try {
        spec.method(args, cb);
      } catch (err) {
        console.log(err);
        if(err.stack) console.log(err.stack);
        cb(prepareError(err));
      }
    }
  }
};

api.register = function(name, model) {
  models[name] = model;
};

// Checks if a user is the owner of a document
// --------------

api.isCreator = function(args, session, cb) {
  var documents = require('./model/documents');
  documents.isCreator(session.username, args.document, cb);
}

// Checks if a user is a collaborator, i.e., is owner or registered as a collaborator
// --------------

api.isCollaboratorOrCreator = function(args, session, cb) {
  var collaborators = require('./model/collaborators');
  collaborators.isCollaborator(session.username, args.document, function(err) {
    if (err) api.isCreator(args, session, cb);
    else cb(null);
  });
}

//module.exports = api;
global.api = api;
