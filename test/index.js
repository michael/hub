/*jshint expr:true */


var request = require("supertest");
var should = require("should");

var app = require("../app")({
  logger: { transports: [] }
});

request = request(app);

var GET = "get";
var POST = "post";
var PUT = "put";
var DELETE = "del";

function api (verb, path, obj) {

  var req = request[verb]("/api/v1"+(path||""))
    .set("Accept", "application/json")
    .expect("Content-Type", /json/);

  if (obj && obj.secret) {
    req = req.send({
      client_id: obj.uuid,
      client_secret: obj.secret
    });
  } else if (obj && obj.token) {
    req = req.set("Authorization", "token "+obj.token);
  }

  return req;
}


describe("Simple smoke tests", function () {

  it("responds with the home page", function (done) {
    request.get("/")
      .expect(200, done);
  });

});


describe("APIs", function () {

  it("should give the links", function (done) {
    api(GET, "")
      .expect(200, done);
  });

});


var Composer;
var Auth;


describe("Authorization APIs", function () {

  it("shouldn't work without authentication", function (done) {
    api(POST, "/authorizations")
      .expect(/authentication|application/i)
      .expect(401, done);
  });

  it("shouldn't work without application credentials", function (done) {
    api(POST, "/authorizations")
      .auth("admin", "unicornsarecute")
      .expect(/application/i)
      .expect(401, done);
  });

  it("shouldn't work without user credentials", function (done) {
    app.applications.findByName("Composer", function (err, application) {
      Composer = application;
      if (err) return done(err);
      api(POST, "/authorizations", Composer)
        .expect(/authentication/i)
        .expect(401, done);
    });
  });

  it("should return an authorization", function (done) {
    api(POST, "/authorizations", Composer)
      .auth("admin", "unicornsarecute")
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        Auth = res.body;
        done();
      });
  });

  it("should return a valid authorization", function () {
    Auth.should.have.property("token");
    Auth.should.have.property("uuid");
    Auth.should.have.property("application_uuid");
    Auth.token.should.be.ok;
    Auth.application_uuid.should.equal(Composer.uuid);
  });

  it("should be accessible with the provided token", function (done) {
    api(GET, "/authorizations", Auth)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.body.should.not.be.empty;
        res.body.should.includeEql(Auth);
        done();
      });
  });

  it("should return the provided token as current", function (done) {
    api(GET, "/authorizations/current", Composer)
      .auth("admin", "unicornsarecute")
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.body.should.eql(Auth);
        done();
      });
  });

  it("shouldn't permit updates", function (done) {
    api(PUT, "/authorizations/"+Auth.uuid)
      .expect(501, done);
  });

  it("shouldn't permit deletions", function (done) {
    api(DELETE, "/authorizations/"+Auth.uuid)
      .expect(501, done);
  });

});

