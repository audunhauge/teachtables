
/*
 * GET home page.
*/

var base = siteinf.base;
var mytitle = siteinf.title;
var schoolyear = siteinf.schoolyear;
var language = siteinf.language;
var version = siteinf.version;
var database = siteinf.database;
var findUser = require('./utils').findUser;
var db = database.db;
var julian = require('../backend/julian');
var addons = siteinf.addons;

exports.kurs = function(req, res) {
    var today = new Date();
    var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
    var thisjd = julian.greg2jul(month,day,year );
    var uuid = 0;
    var username = req.query.navn;
    var firstname = '';
    var lastname = '';
    res.render('kurs', { julday:thisjd,  userid:uuid, loggedin:0,
        title:"index.jade",  mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, jbase:base,
        version:version, username:username, firstname:firstname, lastname:lastname } );
};

exports.plain = function(req, res) {
    var today = new Date();
    var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
    var thisjd = julian.greg2jul(month,day,year );
    if ( req.session.user) {
          // user is logged in
          var user = req.session.user;
          res.render('plain', { julday:thisjd, userid:user.id, loggedin:1, username:user.username,
              title:"index.jade", mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, jbase:base,
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
          res.render('plain', { julday:thisjd,  userid:uuid, loggedin:0,
                    title:"index.jade",  mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, jbase:base,
                    version:version, username:username, firstname:firstname, lastname:lastname } );
    }
};

exports.index = function(req, res){
  res.render('index', { title:"index.jade",mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, jbase:base, version:version });
};

exports.gateway = function(req, res) {
  res.render('yearplain', { mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, jbase:base, version:version });
}


exports.getsql =  function(req, res) {
    //console.log("getting some general data");
    database.getsql(req.session.user, req.query.sql, req.query.param, req.query.reload, function(data) {
      res.send(data);
    });
};

exports.getexams = function(req, res) {
    //console.log("getting exams");
    if (req.query.quick && addons && addons.exams) {
      res.send(addons.exams)
      //console.log("quick");
    }
    else  {
            //console.log("query");
    database.getexams(function(exams) {
            addons.exams = exams;
            addons.update.exams = new Date();
            res.send(exams);
          });
    }
};

exports.freedays = function(req, res) {
    // called when freedays have been changed
    database.getfreedays(function(data) {
      db.freedays = data;
      res.send(data);
    });
};

exports.geteuids =  function(req, res) {
    // get euids for images of studs
    if (req.session.user && req.session.user.department === 'Undervisning') {
      database.geteuids(req.session.user,req.body,function(euids) {
         res.send(euids);
      });
    } else {
      res.send({});
    }
};

exports.editgroup =  function(req, res) {
    // edit/create group
    if (req.session.user && req.session.user.isadmin) {
      console.log("admin creating new group");
      console.log(req.body);
      database.editgroup(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.edituser = function(req, res) {
    // edit/create user
    if (req.session.user && req.session.user.isadmin) {
      console.log("admin creating new user");
      console.log(req.body);
      database.edituser(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.editcourse = function(req, res) {
    // edit/create course/subject
    if (req.session.user && req.session.user.isadmin) {
      console.log("admin creating new course");
      console.log(req.body);
      database.editcourse(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.basic = function(req, res) {
        //var admins = { "haau6257":1, "gjbe6257":1, "brer6257":1, "kvru6257":1 };
        // get some date info
        // this is done in database.js - but needs redoing here in case
        // the server has been running for more than one day
        // Some returned data will need to be filtered on date
        // TODO
        // the client should send in getTimezoneOffset as req.tzo so that we can
        // compute users local time
        var today = new Date();
        var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
        var hours = today.getUTCHours();
        db.firstweek = (month >7) ? julian.w2j(year,33) : julian.w2j(year-1,33)
        db.lastweek  = (month >7) ? julian.w2j(year+1,28) : julian.w2j(year,28)
        // info about this week
        db.thisjd = julian.greg2jul(month,day,year );
        var wd = db.thisjd % 7 + (hours - siteinf.timezone)/100;  // hours as decimalish ( 4.16 ==  day 4, hour 16)
        var skip = (wd > 4.14 ) ? 3 : 0;   // start next week after school ends friday
        db.startjd = 7 * Math.floor((db.thisjd + skip ) / 7);
        db.startdate = julian.jdtogregorian(db.startjd);
        db.enddate = julian.jdtogregorian(db.startjd+6);
        db.week = julian.week(db.startjd);
        db.userinfo = { uid:0 };
        if (req.query.navn) {
          var username = req.query.navn;
          username = username.toLowerCase();
          var nameparts = username.split(" ");
          var ln = nameparts.pop();
          var fn = nameparts.join(' ');
          if (fn == '') { fn = ln; ln = '' };
          var ulist = findUser(fn,ln);
          console.log("USENAME=",username,ulist);
          db.userinfo = (ulist.length == 1) ? ulist[0] : { uid:0 };
          db.ulist = ulist;
          req.userinfo = db.userinfo;
        }
        res.send(db);
};

