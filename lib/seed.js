var _ = require('underscore');
var fs = require('fs');
var db = require('./db');
var errors = require('./errors');

var documents = require('./documents');
var util = require('../util/util');


// API for seeding the Database
// --------
// 
// Takes seed identifier as a parameter

var Seed = function(options) {

  // For production env, use secure shas
  if (options.env === "production") {
    var a = hubSeed["applications"][0];
    a.uuid = db.uuid();
    a.secret = db.uuid();
  }


  var flushDB = function(data, cb) {
    console.log('flushing the database ...');
    db.query('drop schema public cascade;', function(err) {
      db.query('create schema public;', function(err) {
        cb(err, data);
      });
    });
  };


  var createSchema = function(data, cb) {
    var createTable = function (fields, name) {
        var buffer = _.map(fields, function (type, field) {
            return field + ' ' + type;
        }).join(', ');
        return ['CREATE TABLE IF NOT EXISTS ', name, ' (', buffer, ');'].join('');
    };

    var sqls = _.map(options.schema, createTable);

    function next(err) {
      var sql = sqls.shift();
      if (err) throw err;
      else if (sql) db.query(sql, next);
      else {
        cb(null, data);
      }
    };
    next();
  };


  var populateTables = function(data, cb) {
    var jobs = [];

    _.each(options.seed, function(seed, type) {
      jobs[type] = [];
      var model = require('./'+type);

      var subJobs = [];
      _.each(seed, function(obj) {
        subJobs.push(function(data, cb) {
          model.create(obj, cb);
        });
      });

      jobs.push(function(data, cb) {
        util.async(subJobs, function(err) {
          cb(err, data);
        });
      });
    });

    util.async(jobs, function() {
      cb(null, data);
    });
  };


  var seedStore = function(data, cb) {
    documents.seed(options.store_seed, cb);
  }

  // Plant Seed to database
  this.plant = function(cb) {
    var funcs = [flushDB, createSchema, populateTables, seedStore];

    util.async(funcs, cb);
  }
};


// Util to read seed data from file system
// ----------

Seed.read = function(env, name) {
  var res = {
    env: env,
    schema: JSON.parse(fs.readFileSync('./data/schema.json','utf8'))
  };
  if (env === "production") {
    res.seed = JSON.parse(fs.readFileSync('./data/seed.json','utf8'));
    res.store_seed = null;
  } else {
    res.seed = JSON.parse(fs.readFileSync('./tests/seeds/'+name+'/hub.json','utf8'));
    var filename = './tests/seeds/'+name+'/remote.json';
    if (fs.existsSync(filename)) {
      res.store_seed = JSON.parse(fs.readFileSync(filename,'utf8'));
    } else {
      res.store_seed = null;
    }
  }
  return res;
};


module.exports = Seed;