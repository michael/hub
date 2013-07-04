
var _ = require('underscore');
var db = require('./db');
var csrf = module.exports = {};

var TTL = /* 1 minute */ 60 * 60 * 1000;

var CACHE = {};

// TODO Persistence?

csrf.enable = function (value) {
  var key = db.uuid();
  var obj = {};

  obj.born = Date.now();
  obj.value = value;

  CACHE[key] = obj;

  return key;
};

csrf.check = function (key, callback) {
  var obj = CACHE[key];
  delete CACHE[key];

  var value = (obj || null) && obj.value;

  _.defer(callback, null, value);

  return value;
};

setInterval(function () {
  var now = Date.now();
  var list = [];

  _.each(CACHE, function (obj, key) {
    if (!obj || (now - obj.born > TTL)) {
      list[list.lengt] = key;
    }
  });

  CACHE = _.omit(CACHE, list);

}, 3 * TTL);
