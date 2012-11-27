
/*
 * GET home page.
*/

var base = siteinf.base;
var mytitle = siteinf.title;
var schoolyear = siteinf.schoolyear;
var language = siteinf.language;
var version = siteinf.version;
var database = siteinf.database;
var db = database.db;
var julian = require('../backend/julian');
var addons = siteinf.addons;


exports.index = function(req, res){
  res.render('index', { title:"index.jade",mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, base:base, version:version });
};

exports.gateway = function(req, res) {
  res.render('yearplain', { mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, base:base, version:version });
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
        //myclient = database.client;
        //console.log("basic");
        var today = new Date();
        var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
        db.firstweek = (month >7) ? julian.w2j(year,33) : julian.w2j(year-1,33)
        db.lastweek  = (month >7) ? julian.w2j(year+1,28) : julian.w2j(year,28)
        // info about this week
        db.thisjd = julian.greg2jul(month,day,year );
        db.startjd = 7 * Math.floor(db.thisjd  / 7);
        db.startdate = julian.jdtogregorian(db.startjd);
        db.enddate = julian.jdtogregorian(db.startjd+6);
        db.week = julian.week(db.startjd);
        var db_copy = db;
        db_copy.userinfo = { uid:0 };
        if (req.query.navn) {
          var username = req.query.navn;
          //username = username.replace(/æ/g,'e').replace(/Æ/g,'E').replace(/ø/g,'o');
          //username = username.replace(/Ø/g,'O').replace(/å/g,'a').replace(/Å/g,'A');
          username = username.toLowerCase();
          var nameparts = username.split(" ");
          var ln = nameparts.pop();
          var fn = nameparts.join(' ');
          if (fn == '') { fn = ln; ln = '' };
          var ulist = findUser(fn,ln);
          //console.log(ulist);
          db_copy.userinfo = (ulist.length == 1) ? ulist[0] : { uid:0 };
          db_copy.ulist = ulist;
          //console.log(db_copy.userinfo);
          if (db_copy.userinfo) {
            //db_copy.userinfo.isadmin = (admins[db_copy.userinfo.username] && admins[db_copy.userinfo.username] == 1) ? true : false;
            //console.log(db_copy.userinfo.isadmin);
          }
          req.userinfo = db_copy.userinfo; 
        }
        //console.log("I came here");
        res.send(db_copy);
        //console.log("THIS IS AFTER");
};

function findUser(firstname,lastname) {
  // search for a user given firstname and lastname
  // try students first (studs may shadow teach)
  lastname = lastname.replace(/%F8/g,"ø");
  lastname = lastname.replace(/%E6/g,"æ");
  lastname = lastname.replace(/%E5/g,"å");
  lastname = lastname.replace(/%D8/g,"Ø");
  lastname = lastname.replace(/%C6/g,"Æ");
  lastname = lastname.replace(/%C5/g,"Å");
  firstname = firstname.replace(/%F8/g,"ø");
  firstname = firstname.replace(/%E6/g,"æ");
  firstname = firstname.replace(/%E5/g,"å");
  firstname = firstname.replace(/%D8/g,"Ø");
  firstname = firstname.replace(/%C6/g,"Æ");
  firstname = firstname.replace(/%C5/g,"Å");
  var list = [];
  var seen = {};
  if (lastname == '') {
    // just one search word
    // we try department,institution
      var any = new RegExp(firstname.trim(),"i");
      var plain = firstname.trim().toUpperCase();
      for (var i in db.students) {
        var s = db.students[i];
        if (seen[s.id]) continue;
        if (s.lastname.match(any) || s.firstname.match(any) || s.department.match(any)  || s.institution.match(any)) {
           if (s) {
             list.push(s);
             seen[s.id] = 1;
           }
        }
      }
      for (var j in db.teachers) {
        var t = db.teachers[j];
        if (seen[t.id]) continue;
        if (t.lastname.match(any) || t.firstname.match(any) || t.department.match(any)  || t.institution.match(any)) {
           if (t) {
             list.push(t);
             seen[t.id] = 1;
           }
        }
      }
      if (db.memlist[plain]) {
        // the searchterm matches a groupname
        //var gr = courseteach[firstname.trim()].split('_')[1];
        var studlist = db.memlist[plain];
        for (j in studlist) {
          var s = db.students[studlist[j]];
          if (seen[s.id]) continue;
          if (s) {
             list.push(s);
             seen[s.id] = 1;
          }
        }
      } else { 
          if (db.coursesgr[plain]) {
          // the searchterm matches a coursename
          var grlist = db.coursesgr[plain];
          // all groups for this course
          for (i in grlist) {
            var gr = grlist[i];
            if (db.courseteach[plain+'_'+gr]) {
              var tl = db.courseteach[plain+'_'+gr].teach;
              for (var k in tl) {
                t = db.teachers[tl[k]];
                if (t) {
                  t.gr = gr;
                  list.unshift(t);
                }
              }
            }
            var studlist = db.memlist[gr];
            for (j in studlist) {
              var s = db.students[studlist[j]];
              if (s) {
                s.gr = gr;
                list.push(s);
              }  
            }
          }
        }

      }
  } else {
      firstname = firstname.trim();
      lastname = lastname.trim();
      //console.log("fn="+firstname + " ln=" + lastname);
      //console.log("scanning studs");
      for (var i in db.students) {
        var s = db.students[i];
        if (s.firstname.toLowerCase() == firstname && s.lastname.toLowerCase() == lastname) {
           if (s) list.push(s);
           return list;
        }
      }
      // scan thru teachers
      //console.log("scanning teach");
      for (var j in db.teachers) {
        var t = db.teachers[j];
        if (t.firstname.toLowerCase() == firstname && t.lastname.toLowerCase() == lastname) {
           if (t) list.push(t);
           return list;
        }
      }
      var fn = new RegExp(firstname,"i");
      var ln = new RegExp(lastname,"i");
      //console.log("regexp scanning studs");
      for (var i in db.students) {
        var s = db.students[i];
        if ( s.firstname.match(fn) && s.lastname.match(ln)) {
           if (s) list.push(s);
        }
      }
      //console.log("regexp scanning teach");
      for (var j in db.teachers) {
        var t = db.teachers[j];
        if ( t.firstname.match(fn) && t.lastname.match(ln)) {
           if (t) list.push(t);
        }
      }
  }
  return list;
}
