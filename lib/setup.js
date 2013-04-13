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
    var seed = new Seed(Seed.read(app.env, seedName));
    seed.plant(function(err) {
      exposeApp();  
    });

  } else {
    exposeApp();
  }
};
