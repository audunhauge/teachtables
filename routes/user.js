
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

exports.alive =function(req, res) {
  // returns true if user still logged in
  if (req.session.user) {
      res.send( { "alive":"true" });
  } else {
      res.send( { "alive":"false" });
  }
}

exports.feide =function(req, res) {
  if (req.query.token) {
      var tok = req.query.token;
      var ini4 = req.query.ini;
      var now = req.query.now;
      var pid = req.query.pid;
      var target = req.query.target || '';
      if (target) target = '/' + target;
      console.log("FEIDE:",ini4,tok,target);
      usr.feide(tok, ini4, now, pid, function(user) {
        if (user) {
          user.logintime = new Date().getTime();
          req.session.user = user;
          var uname = user.firstname+" "+user.lastname;
          uname = uname.replace(/ /g,"%20");
          uname = uname.replace(/å/g,"%C3%A5");
          uname = uname.replace(/æ/g,"%C3%A6");
          uname = uname.replace(/ø/g,"%C3%B8");
          uname = uname.replace(/Å/g,"%C3%85");
          uname = uname.replace(/é/g,"%C3%A9");
          uname = uname.replace(/Ø/g,"%C3%98");
          uname = uname.replace(/Æ/g,"%C3%86");
          uname = uname.replace(/ü/g,"%C3%BC");
          res.redirect(base + target + "?navn="+uname);
        } else {
          console.log("FAILED");
          res.redirect(base);
        }
      });
      return;
  }
  res.redirect(base);
};

exports.userconfig = function(req, res) {
  usr.userconfig(req.session.user,req.query,function(r) {
    res.send(r);
  });
};


exports.login =function(req, res) {
  if (!req.query.username && req.session.user) {
      res.send(req.session.user);
      return;
  }
  usr.authenticate(req.query.username, req.query.password, req.query.its, function(user) {
    if (user) {
      if (user.config) {
          // some browsers seem to do addslashes ...
          var conf = user.config.replace(/\\'/g,"'").replace(/\\"/g,'"');
          try {
             user.config = JSON.parse(conf);
          } catch(err) {
            console.log("Config error for ",user.id,err,user.config);
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
