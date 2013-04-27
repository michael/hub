var Seed = require('../../seed');

// Publication API
// ===================
// 
// Maintenance-related stuff goes here

module.exports = function(app) {

  if (app.env !== "production")  {  

    // Seed
    // -----------

    app.get('/seed/:seed',
      function(req, res, next) {
        Seed.read(app.env, req.params.seed, function(err, seedData) {
          if(err) return next(err);
          var seed = new Seed(seedData).plant(function(err) {
            if (err) return res.json(500, {"error": "seeding_failed"});
            res.json({"status": "ok"});
          });
        });
      });

    app.post('/seed',
      function(req, res, next) {
        var seed = req.body;
        seed.env = app.env;
        seed.schema = Seed.schema();
        new Seed(seed).plant(function(err) {
          if (err) { return res.json(500, {"error": "seeding_failed"}) };
          res.json({"status": "ok"});
        });
      }
    );
  }
};