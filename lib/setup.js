var applications = require('./applications');
var fs = require('fs');
var Seed = require('./seed');

module.exports = function (app) {

  var exposeApp = function () {
    applications.findByName('Composer', function (err, a) {
      if (!a) return app.error("No application registered.");
      app.debug("Composer application "+a.uuid+" with secret "+a.secret);
    });
  };

  console.log('Starting Hub in', app.env, 'mode');

  if (process.argv[2] === "--seed") {
    var seedName = process.argv[3] || "001-boilerplate";
    Seed.read(app.env, seedName, function(err, seedData) {
      if(err) {
        console.log("Could not load seed data: ", err);
        app.error(err);
        process.exit(-1);
      }
      var seed = new Seed(seedData);
      seed.plant(function(err) {
        if(err) {
          console.log("Could not seed: ", err);
          app.error(err);
          process.exit(-1);
        }
        exposeApp();
      });
    });

  } else {
    exposeApp();
  }
};
