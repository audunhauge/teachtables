
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

var aa=top.mainframe.document.getElementsByClassName("user_name");
var b = aa.pop();
var uname = b.innerHTML;
uname = uname.split(",");
uname = uname[1] + "%20" + uname[0];
uname = uname.replace(/ /g,"%20");
uname = uname.replace(/å/g,"%C3%A5");
uname = uname.replace(/æ/g,"%C3%A6");
uname = uname.replace(/ø/g,"%C3%B8");
uname = uname.replace(/Å/g,"%C3%85");
uname = uname.replace(/é/g,"%C3%A9");
uname = uname.replace(/Ø/g,"%C3%98");
uname = uname.replace(/Æ/g,"%C3%86");
uname = uname.replace(/ü/g,"%C3%BC");
var plain="http://www.teachtables.net/skeisvang/plain?navn="+uname;
var starb="http://www.teachtables.net/skeisvang/starb?navn="+uname;
var cal="http://www.teachtables.net/skeisvang/kalendar?navn="+uname;
document.getElementById("timeplan").src=tar;
function ssta() { document.getElementById("timeplan").src=plain;
}function sstb() { document.getElementById("timeplan").src=starb;
}function sstc() { document.getElementById("timeplan").src=cal;
}
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
          res.redirect(base + "?navn="+uname);
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
