
function defineError(clazz) {
  /*jshint proto:true */
  clazz.__proto__ = Error;
  clazz.prototype = Object.create(Error.prototype);
  clazz.prototype.constructor = clazz;
  module.exports[clazz.name] = clazz;
  return clazz;
}

function prepareError(self, args) {
  Error.call(self);
  Error.captureStackTrace(self, args.callee);
  self.name = self.constructor.name;
  self.message = message || null;
}

defineError(function NoRecordFound(message) {
  prepareError(this, arguments);
});
