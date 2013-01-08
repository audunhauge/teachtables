
/*
 * GET study time attendance for students
*/

var base = siteinf.base;
var mytitle = siteinf.title;
var schoolyear = siteinf.schoolyear;
var language = siteinf.language;
var version = siteinf.version;
var database = siteinf.database;
var findUser = require('./utils').findUser; 
var db = database.db;
var addons = siteinf.addons;

var starb = require('../backend/starb');
var julian = require('../backend/julian');

exports.starblessons = function(req,res) {
    // returns list of all starblessons
    // a starblesson is stored like this
    //  id      | julday  | userid | teachid | roomid | courseid | eventtype | day | slot | class | name  |  value
    //  xxxx    |         |        |   10111 |     56 |          | starbless |   2 |    0 | 0     |       | Kurs i flash
    //          |         |        |   10111 |     56 |   xxxx   | sless     |     |      |       |       | 
    if (req.session.user && req.session.user.isadmin) {
      starb.getstarbless(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.getallstarblessdates = function(req,res) {
      // get all starb-lessons
      starb.getallstarblessdates(req.session.user, req.query, function(data) {
        res.send(data);
      });
};

exports.getstarblessdates =  function(req,res) {
      // for specific teacher
      starb.getstarblessdates(req.session.user, req.query, function(data) {
        res.send(data);
      });
};

exports.createstarbless = function(req,res) {
    if (req.session.user && req.session.user.isadmin) {
      starb.createstarbless(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};


exports.savestarbless = function(req,res) {
    if (req.session.user && req.session.user.isadmin) {
      starb.savestarbless(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.killstarbless = function(req,res) {
    if (req.session.user && req.session.user.isadmin) {
      starb.savestarbless(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.attendance = function(req, res) {
    // get attendance
    starb.getAttend(req.session.user,req.query,function(attend) {
            res.send(attend);
          });
};


exports.elevstarb = function(req, res) {
    //console.log("Getting elevstarb");
    starb.getstarb(req.session.user, req.query, function(starblist) {
      res.send(starblist);
    });
};

exports.fjernelev = function(req, res) {
    //console.log("Sletter starb ",req.query);
    starb.deletestarb(req.session.user, req.query, function(resp) {
      res.send(resp);
    });
};

exports.regstud = function(req, res) {
    //console.log("Registering with starbkey ",req.query);
    var ip = req.connection.remoteAddress;
    starb.regstarb(ip,req.session.user, req.query, function(resp) {
      //console.log("Student reg with starbkey",req.query);
      res.send(resp);
    });
};

exports.teachstarb = function(req, res) {
    // insert list of starb-studs into starb
    var starbelever = req.query.starbelever || '';
    var julday      = +req.query.julday || 0;
    var roomid      = +req.query.roomid || 0;
    if (req.session.user && req.session.user.department == 'Undervisning') {
      if (starbelever && julday && roomid) {
        var uid = req.session.user.id;
        var elever = starbelever.split(',');
        var starbreg = [];
        for (var i=0; i< elever.length; i++) {
           var eid = +elever[i];
           starbreg.push( " ("+julday+","+eid+","+uid+","+roomid+") ");
           // 'insert into starb (julday,userid,teachid,roomid) 
        }
        starbreglist = starbreg.join(',');
        starb.teachstarb(starbelever,julday,starbreglist, function(resp) {
            res.send(resp);
            return;
        });
        return;
      }
      console.log("fail - no data");
      res.send( { fail:1, msg:'No data' } );
      return;
    }
    res.send( { fail:1, msg:'Not teach' } );
      console.log("fail - not teach");
    return;
};

exports.starbkey = function(req, res) {
    //console.log("Getting starbkey");
    starb.genstarb(req.session.user, req.query, function(starbkey) {
      //console.log("Sending starbkey",starbkey);
      res.send(starbkey);
    });
};

exports.ipad = function(req, res) {
       // starb-reg for students
       // key-gen for teachers
        var today = new Date();
        var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
        var thisjd = julian.greg2jul(month,day,year );
        var thisday = thisjd % 7;
        var ip = req.connection.remoteAddress;
        //console.log("REQ",ip);
	var locals = { 'key': 'value' };
	locals = dummyHelper.add_overlay(app, req, locals);
        if ( req.session.user) {
          // user is logged in
          var user = req.session.user;
	  res.render('ipad/index', { layout:'ipad.jade', julday:thisjd, day:thisday, userid:user.id, loggedin:1, 
              mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, base:base, version:version, username:user.username, firstname:user.firstname, lastname:user.lastname } );
        } else {
          var uuid = 0;
          var username = req.query.navn;
          var firstname = '';
          var lastname = '';
          if (req.query.navn && db && db.students && db.teachers) {
            username = username.toLowerCase();
            var nameparts = username.split(" ");
            var ln = nameparts.pop();
            var fn = nameparts.join(' ');
            if (fn == '') { fn = ln; ln = '' };
            var ulist = findUser(fn,ln);
            var uu = ulist[0]
            if (uu) {
              uuid = uu.id;
              username = uu.username;
              lastname = uu.lastname;
              firstname = uu.firstname;
            }
          }
          res.render('ipad/index', { layout:'ipad.jade', julday:thisjd, day:thisday, mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, base:base, version:version, userid:uuid, loggedin:0, 
                                      username:username, firstname:firstname, lastname:lastname } );
        }
};

exports.starb = function(req, res) {
   // starb-reg for students
   // key-gen for teachers
   var today = new Date();
   var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
   var thisjd = julian.greg2jul(month,day,year );
   var ip = req.connection.remoteAddress;
   if ( req.session.user) {
          // user is logged in
          var user = req.session.user;
          res.render('starb', { julday:thisjd, userid:user.id, loggedin:1, username:user.username, 
              title:"index.jade", mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, base:base, 
              version:version, firstname:user.firstname, lastname:user.lastname } );
        } else {
          var uuid = 0;
          var username = req.query.navn;
          var firstname = '';
          var lastname = '';
          if (req.query.navn && db && db.students && db.teachers) {
            username = username.toLowerCase();
            var nameparts = username.split(" ");
            var ln = nameparts.pop();
            var fn = nameparts.join(' ');
            if (fn == '') { fn = ln; ln = '' };
            var ulist = findUser(fn,ln);
            var uu = ulist[0]
            if (uu) {
              uuid = uu.id;
              username = uu.username;
              lastname = uu.lastname;
              firstname = uu.firstname;
            }
          }
          res.render('starb', { julday:thisjd, mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, 
                     title:"index.jade",language:language, base:base, version:version, userid:uuid, loggedin:0, 
                     username:username, firstname:firstname, lastname:lastname } );
        }
};
