var _ = require('underscore');
var fs = require('fs');
var db = require('./db');
var errors = require('substance-util/errors');

var util = require('substance-util');

// TODO: move somewhere else
var seeds = require('../../../tests/seeds');

var HubStore = require('./model/hubstore');

// API for seeding the Database
// --------
//
// Takes seed identifier as a parameter

var Seed = function(seed) {

  this.seed = seed;
  var sqlResult;

  // For production env, use secure shas
  if (seed.env === "production") {
    var a = seed.hub["applications"][0];
    a.uuid = db.uuid();
    a.secret = db.uuid();
  }

  var flushDB = function(cb) {
    console.log('flushing the database ...');
    var selectTables = function(cb) {
      var psql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";
      db.query(psql, function(err, data) {
        sqlResult = data;
        cb(err);
      });
    };

    var dropTables = util.async.iterator({
      selector: function() { return sqlResult.rows; },
      iterator: function(row, cb) {
        //console.log("    dropping table:", row.table_name);
        var sql = "DROP TABLE " + row.table_name + ";";
        db.query(sql, function (err) { cb(err); });
      }
    });

    util.async.sequential([selectTables, dropTables], cb);
  };

  var createSchema = util.async.iterator({
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

  var populateTables = function(cb) {
    console.log('populating tables ...');

    var jobs = [];
    _.each(seed.hub, function(hubSeed, type) {
      jobs[type] = [];
      var model = require('./model/'+type);

      var subJobs = [];
      _.each(hubSeed, function(obj) {
        subJobs.push(function(cb) {
          model.create(obj, cb);
        });
      });

      jobs.push(function(cb) {
        util.async.sequential(subJobs, function(err) {
          cb(err);
        });
      });
    });

    util.async.sequential(jobs, cb);
  };

  var seedRemoteStore = function (cb) {
    HubStore.seed(seed.remote, cb);
  };

  // Plant Seed to database
  this.plant = function(cb) {
    var functions = [flushDB, createSchema, populateTables, seedRemoteStore];
    util.async.sequential(functions, cb);
  }
};

Seed.schema = function() {
  // TODO: bitter
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
    // TODO: bitter
    seed.hub = JSON.parse(fs.readFileSync('./lib/hub/data/seed.json','utf8'));
    cb(null, seed);
  } else {
    // read the config and pull in dependencies
    seeds.loadSeedSpec(name, function(err, spec) {
      if(err) return cb(err, null);
      seeds.loadSeed(spec, function(err, data) {
        if(err) return cb(err, null);
        seed = _.extend(seed, data);
        cb(null, seed);
      });
    })
  }
};

module.exports = Seed;
