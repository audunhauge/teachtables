
/*
 * GET plans, save plans
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;

var usr = require('../backend/user');

exports.logout = function(req, res) {
  if (req.session) {
    req.session.auth = null;
    res.clearCookie('auth');
    req.session.destroy(function() {});
  }
  delete req.userinfo;
  res.redirect(base);
};

exports.saveconfig = function(req, res) {
  if (req.session) {
      usr.save_config(req.session.user,req.body,function(r) {
          res.send(0);
      });
  }
};

exports.login =function(req, res) {
  if (!req.query.username && req.session.user) {
      res.send(req.session.user);
      return;
  }
  usr.authenticate(req.query.username, req.query.password, req.query.its, function(user) {
    if (user) {
      if (user.config) {
          try {
             user.config = JSON.parse(user.config);
          } catch(err) {
            console.log("getOBJ EVAL-ERROR",err,user.config);
            user.config = {};
          }
      } else {
            user.config = {};
      }
      req.session.user = user;
      res.send(user);
      if (user.isadmin) {
        usr.goodAutoincrements();
      }
      return;
    }
    res.send({id:0});
  });
};

exports.ses = function(req,res) {
    var rr = [];
    for (var ss in req.sessionStore.sessions) {
      var sess = req.sessionStore.sessions[ss];
      var data = JSON.parse(sess);
      var time = new Date(data.lastAccess);
      if (data.user) {
        var info = { firstname:data.user.firstname, lastname:data.user.lastname };
        rr.push([info,data.lastAccess]);
      }
    }
    res.send( rr  );
};
