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
    var a = options.seed["applications"][0];
    a.uuid = db.uuid();
    a.secret = db.uuid();
  }

  var flushDB = function(data, cb) {
    console.log('flushing the database ...');
    var selectTables = function(data, cb) {
      var psql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";
      db.query(psql, cb);
    };

    var dropTables = function(sqlResult, cb) {
      // creates a function for being chained
      var dropTableFunc = function(row) {
        return function(data, cb) {
          console.log("Dropping table:", row.table_name);
          var psql = "DROP TABLE " + row.table_name + ";";
          db.query(psql, function (err) { cb(err, data); });
        };
      };

      // create a chain with a drop table function for each found table
      util.async(_.map(sqlResult.rows, dropTableFunc), cb);
    };
    
    util.async([selectTables, dropTables], data, cb);
  };

  var createSchema = function(data, cb) {
    // creats a functions that creates one table
    var createTableFunc = function (fields, name) {
      var buffer = _.map(fields, function (type, field) {
          return field + ' ' + type;
      }).join(', ');
      var psql = ['CREATE TABLE IF NOT EXISTS ', name, ' (', buffer, ');'].join('');

      return function(data, cb) {
        db.query(psql, function(err) { cb(err, data); });
      };
    };

    // chain all table creater functions
    var funcs = _.map(options.schema, createTableFunc);
    util.async(funcs, data, cb);
  };


  var populateTables = function(data, cb) {
    console.log('populating tables ...');

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