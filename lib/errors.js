
function defineError(clazz, parent) {
  /*jshint proto:true */
  parent || (parent = BaseError);
  clazz.__proto__ = parent;
  clazz.prototype = Object.create(parent.prototype);
  clazz.prototype.constructor = clazz;
  module.exports[clazz.name] = clazz;
  return clazz;
}

function BaseError () {
  throw new Error("BaseError cannot be instantiated");
}

BaseError.__proto__ = Error;
BaseError.prototype.constructor = BaseError;

function prepareError(self, args, message) {
  Error.call(self);
  Error.captureStackTrace(self, args.callee);
  self.name = self.constructor.name;
  self.message = message || null;
}

defineError(function NoRecordFound(message) {
  prepareError(this, arguments, message);
});

defineError(function Unauthorized(message) {
  prepareError(this, arguments, message);
  this.status = 401;
});

defineError(function WrongValue(message) {
  prepareError(this, arguments, message);
});

defineError(function WrongFieldValue(field, value) {
  var message = "Wrong value '"+value+"' for field '"+field+"'";
  prepareError(this, arguments, message);
  this.field = field;
  this.value = value;
}, exports.WrongValue);

exports.errorHandler = function () {
  return function (err, req, res, next) {
    if (req.accepts('json')) {
      res.status(err.status ? err.status : 500);
      res.json(err);
    } else {
      next(err);
    }
  };
};
