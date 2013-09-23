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

function withNiceError(cb) {
  return function(err, data) {
    if (err) return cb(prepareError(err));
    cb(null, data);
  }
}

api.execute = function(model, command, args, session, cb) {
  //console.log("api.exeute", model, command, args, session);
  // check if model and command are registered
  cb = withNiceError(cb);

  if (!models[model] || !models[model][command]) {
    cb(new errors.InternalError("Unknown command: "+model+"."+command));
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
          cb(err);
        }
      });
    } else {
      try {
        spec.method(args, cb);
      } catch (err) {
        console.log(err);
        if(err.stack) console.log(err.stack);
        cb(err);
      }
    }
  }
};

api.register = function(name, model) {
  models[name] = model;
};

//module.exports = api;
global.api = api;
