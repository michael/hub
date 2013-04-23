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

var Seed = function(seed) {
  this.seed = seed;

  // For production env, use secure shas
  if (seed.env === "production") {
    var a = seed.hub["applications"][0];
    a.uuid = db.uuid();
    a.secret = db.uuid();
  }

  var flushDB = function(data, cb) {
    console.log('flushing the database ...');
    var selectTables = function(data, cb) {
      var psql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";
      db.query(psql, cb);
    };

    var dropTables = util.async.each({
      selector: function(sqlResult) { return sqlResult.rows; },
      iterator: function(row, cb) {
        //console.log("    dropping table:", row.table_name);
        var sql = "DROP TABLE " + row.table_name + ";";
        db.query(sql, function (err) { cb(err, data); });
      }
    });

    util.async([selectTables, dropTables], data, cb);
  };

  var createSchema = util.async.each({
    before: function() { console.log("creating schema...")},
    selector: function() { return seed.schema; },
    iterator: function(fields, name, cb) {
      var fieldSpecs = _.map(fields, function (type, field) {
          return field + ' ' + type;
      }).join(', ');
      var psql = ['CREATE TABLE IF NOT EXISTS ', name, ' (', fieldSpecs, ');'].join('');
      // console.log("    creating table:", name);
      db.query(psql, cb);
    }
  });

  var populateTables = function(data, cb) {
    console.log('populating tables ...');

    var jobs = [];
    _.each(seed.hub, function(hubSeed, type) {
      jobs[type] = [];
      var model = require('./'+type);

      var subJobs = [];
      _.each(hubSeed, function(obj) {
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

  var seedRemoteStore = function (data, cb) {
    documents.seed(seed.remote, cb);
  };

  // Plant Seed to database
  this.plant = function(cb) {
    var funcs = [flushDB, createSchema, populateTables, seedRemoteStore];
    util.async(funcs, seed, cb);
  }
};

Seed.schema = function() {
  return JSON.parse(fs.readFileSync('./data/schema.json','utf8'));
}

Seed.read = function(env, name, cb) {

  var seed = {
    env: env,
    schema: Seed.schema(),
    hub: null,
    local: [],
    remote: [],
  };

  if (env === "production") {
    seed = JSON.parse(fs.readFileSync('./data/seed.json','utf8'));
    cb(null, seed);
  } else {
    // read the config and pull in dependencies
    util.loadSeedSpec(name, function(err, spec) {
      if(err) return cb(err, null);
      util.loadSeed(spec, function(err, data) {
        if(err) return cb(err, null);
        seed = _.extend(seed, data);
        cb(null, seed);
      });
    })
  }
};

module.exports = Seed;
