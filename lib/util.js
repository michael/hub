
/*var pg = require('pg');*/

var apply = Function.prototype.apply;
var call = Function.prototype.call;
var has = call.bind(Object.prototype.hasOwnProperty);
var slice = call.bind(Array.prototype.slice);
var nativeForEach = Array.prototype.forEach;

var each = exports.each = function (o, iterator, context) {
  var i, l;

  if (o.forEach === nativeForEach) {
    nativeForEach.apply(o, slice(arguments, 1));
    return o;
  }

  l = o.length;
  if (l === +l) {
    for (i = 0; i<l; ++i) {
      iterator.call(context, o[i], i, o);
    }
    return o;
  }

  for (i in o) {
    if (has(o, i)) {
      iterator.call(context, o[i], i, o);
    }
  }
  return o;
};

var extend = exports.extend = function (base) {
  var args = slice(arguments, 1);
  each(args, function (arg) {
    each(arg, function (value, key) {
      Object.defineProperty(base, key, Object.getOwnPropertyDescriptor(arg, key));
    });
  });
  return base;
};
