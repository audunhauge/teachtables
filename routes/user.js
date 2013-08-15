
/*
 * GET plans, save plans
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;
var base = siteinf.base;

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

exports.feide =function(req, res) {
  if (req.query.token) {
      var tok = req.query.token;
      var ini4 = req.query.ini;
      var now = req.query.now;
      var pid = req.query.pid;
      console.log("FEIDE:",ini4,tok);
      usr.feide(tok, ini4, now, pid, function(user) {
         if (user) {
           req.session.user = user;
           res.redirect(base + "?navn="+user.firstname + " " + user.lastname);
         } else {
           console.log("FAILED");
           res.redirect(base);
         }
      });
      return;
  }
  res.redirect(base);
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
      user.logintime = new Date().getTime();
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
      if (data.user) {
        var info = { firstname:data.user.firstname, lastname:data.user.lastname, time:data.user.logintime};
        rr.push(info);
      }
    }
    res.send( rr  );
};
