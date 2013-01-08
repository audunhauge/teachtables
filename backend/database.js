var pg = require('pg');
var sys = require('util');
var crypto = require('crypto');
//var creds = require('./creds');
var connectionString = siteinf.connectionString;

var email   = require("emailjs/email");

// utils will upgrade String with a few goodies
var after = require('./utils').after;

// utility function (fill inn error and do callback)
function sqlrunner(sql,params,callback) {
  client.query( sql, params,
      function (err,results) {
          if (err) {
              callback( { ok:false, msg:err.message } );
              return;
          }
          callback( {ok:true, msg:"inserted"} );
      });
}


function stripRooms(text) {
  // removes any roomnames from text
  if (!db.roomids) return text; // room ids not there yet
  var list = text.split(/[, ]/);
  if (list.length < 2) return text;  // short list ok
  var clean = [];
  for (var i=0; i< list.length; i++) {
      var ee = list[i].toUpperCase();
      if ( !db.roomids[ee] ) {
        clean.push(list[i]);
      }
  }
  return clean.join(' ');
}
  

var julian = require('./julian');

var db = {
   studentIds   : []    // array of students ids [ 2343,4567 ]
  ,students     : {}    // hash of student objects {  2343:{username,firstname,lastname,institution,department} , ... ]
  ,teachIds     : []    // array of teacher ids [ 654,1493 ... ]
  ,teachers     : {}    // hash of teach objects { 654:{username,firstname,lastname,institution}, ... }
  ,teachuname   : {}    // hash of { 'ROJO':654, 'HAGR':666 ... } username to id
  ,tnames       : []    // list of all teachnames (usernames) for autocomplete
  ,roomnamelist : []    // list of all roomnames (usernames) for autocomplete
  ,course       : [ '2TY14','3SP35','3TY5' ]    // array of coursenames [ '1MAP5', '3INF5' ... ] - used by autocomplete
  ,cid2name     : {}    // hash { courseid:coursename, .. }
  ,cname2id     : {}    // hash { coursename:courseid, .. }
  ,freedays     : {}    // hash of juliandaynumber:freedays { 2347889:"Xmas", 2347890:"Xmas" ... }
  ,heldag       : {}    // hash of { 2345556:{"3inf5":"Exam", ... } }
  ,xtrax        : {}    // hash of { 2345556:{"3inf5":"RepeatExam", ... } }
  ,prover       : {}    // hash of { 2345556:[ {shortname:"3inf5_3304",value::"3,4,5",username:"haau6257" } ... ], ... }
  ,yearplan     : {}    // hash of { 2345556:["info om valg", 2345557:"Exam", ...], ...  }
  ,groups       : []    // array of groups
  ,groupnames   : {}    // hash of groupname to group-id
  ,nextyear     : {}    // info about next year
  ,memlist      : {}    // hash of { "3304":[234,45,454],"2303":[23, ...], ... }  -- group -> studs
  ,courseteach  : {}    // hash of { "3inf5_3304":{teach:[654],id:6347},"2inf5":{teach:[654,1363],id:6348}," ... }  -- course -> {teach,id}
  ,grcourses    : {}    // hash of { "3304":[ "3inf5" ] , ... }  -- courses connected to a group
  ,coursesgr    : {}    // hash of { "3inf5":[ "3304" ] , ... }  -- groups connected to a course
  ,memgr        : {}    // hash of { 234:["3304","2303","3sta" ..], ... }  --- groups stud is member of
  ,teachcourse  : {}    // array of courses the teacher teaches (inverse of courseteach)
  ,category     : { '3TY5':2,'3SP35':2,'2TY14':2 }    // hash of coursename:category { '3inf5':4 , '1nat5':2 ... }
  ,classes      : ("1STA,1STB,1STC,1STD,1STE,1STF,1MDA,1MDB,2STA,2STB,2STC,"
                   + "2STD,2STE,2STF,2DDA,2MUA,3STA,3STB,3STC,3STD,3STE,3DDA,3MUA").split(",")
                      // array of class-names ( assumes all studs are member of
                      // one unique class - they are also member of diverse groups)
  ,klasskeys    : {  "1STA":"hjTr6f", "1STB":"Mns2dq", "1STC":"bcsss3", "1STD":"poi6bc", "1STE":"Z132ef","1STF":"vNN5rf"
                    ,"1MDA":"jgkr5f", "1MDB":"zzzdef", "2STA":"3mcdet", "2STB":"yyRqef", "2STC":"a220oO"
                    ,"2STD":"44ncgf", "2STE":"ttLK3f", "2STF":"orldw5", "2DDA":"mcb66f", "2MUA":"mvbdef", "3STA":"bnghrr","3STB":"65s33g"
                    ,"3STC":"oi2def", "3STD":"qwuN1x", "3STE":"mgjr44", "3DDA":"iggyef", "3MUA":"abzdef"}
    
                        // hash of class mapping to keys { '1STA':'3cfx65', ... }
                        // a 6 char base64 key giving access to search on specific class members

}

// get some date info
var today = new Date();
var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
db.restart = { hh:today.getHours(), mm:today.getMinutes() , tz:today.getTimezoneOffset() };
console.log(day,month,year);
db.firstweek = (month >7) ? julian.w2j(year,33) : julian.w2j(year-1,33);
db.lastweek  = (month >7) ? julian.w2j(year+1,26) : julian.w2j(year,26);
db.nextyear.firstweek = (month >7) ? julian.w2j(year+1,33) : julian.w2j(year,33);
db.nextyear.lastweek  = (month >7) ? julian.w2j(year+2,26) : julian.w2j(year+1,26);
console.log("Nextyear ",db.nextyear);
// info about this week
db.startjd = 7 * Math.floor(julian.greg2jul(month,day,year ) / 7);
db.startdate = julian.jdtogregorian(db.startjd);
db.enddate = julian.jdtogregorian(db.startjd+6);
db.week = julian.week(db.startjd);
console.log(db.startjd,db.firstweek,db.lastweek,db.week);


var client = new pg.Client(connectionString);
siteinf.client = client;
client.connect();




var saveteachabsent = function(user,query,callback) {
  // update/insert absent list for teacher
  var idd  = query.jd.substr(3);
  var jd = idd.split('_')[0];
  var day = idd.split('_')[1];
  var text = query.value;
  var name = query.name;
  var userid = query.userid;
  var klass = query.klass;   // this will be userid or 0
  //console.log("Saving:",jd,text,name,userid,klass);
  if (text == '') client.query(
          "delete from calendar where name = $1 and userid= $2 and eventtype='absent' and julday= $3 " , [ name,userid, jd ],
          after(function(results) {
              callback( {ok:true, msg:"deleted"} );
          }));
  else client.query(
        'select * from calendar '
      + ' where name = $1 and eventtype=\'absent\' and userid= $2 and julday= $3 ' , [ name, userid, jd ],
      after(function(results) {
          var abs ;
          if (results) abs = results.rows[0];
          if (abs) {
              if (abs.value != text || abs.name != name) {
              client.query(
                  'update calendar set class=$1, name=$2,value=$3 where id=$4',[ klass,name,text, abs.id ],
                  after(function(results) {
                      callback( {ok:true, msg:"updated"} );
                  }));
              } else {
                callback( {ok:true, msg:"unchanged"} );
              }
          } else {
            client.query(
                'insert into calendar (courseid,userid,julday,eventtype,value,name,class) values (0,$1,$2,\'absent\',$3,$4,$5)',[userid,jd,text,name,klass],
                after(function(results) {
                    callback( {ok:true, msg:"inserted"} );
                    var today = new Date();
                    var m = today.getMonth()+1; var d = today.getDate(); var y = today.getFullYear();
                    var julday = julian.greg2jul(m,d,y);
                    if (db.teachers[userid] && jd == julday) {
                       // send mail if we mark a teacher as absent on this very day
                       var teach = db.teachers[userid];
                       var avd = siteinf.depleader[teach.institution];
                       if (avd) {
                         var depleader = db.teachers[db.teachuname[avd]];
                         var server  = email.server.connect({
                              user:       "skeisvang.skole", 
                              password:   "123naturfag", 
                              host:       "smtp.gmail.com", 
                              ssl:        true
                         });

                         // send the message and get a callback with an error or details of the message that was sent
                         server.send({
                                text:   "Borte i dag: " + teach.username + " " + name + " " + text + " time"
                              , from:   "kontoret <skeisvang.skole@gmail.com>"
                              , to:     depleader.email
                              , cc:     "audun.hauge@gmail.com"
                              , subject:  "Bortfall lerar"
                         }, function(err, message) { console.log(err || message); });

                       }
                    }
                }));
          }
      }));
}

var saveabsent = function(user,query,callback) {
  // update/insert absent list
  var idd  = query.jd.substr(3);
  var jd = idd.split('_')[0];
  var day = idd.split('_')[1];
  var text = query.value;
  var name = query.name;
  var userid = query.userid;
  var klass = query.klass;   // this will be userid or 0
  //console.log("Saving:",jd,text,name,userid,klass);
  if (text == '') client.query(
          'delete from calendar'
      + " where name = $1 and ($2 or (class=$3 or class=0 ) and userid= $4) and eventtype='absent' and julday= $5 " , [ name,user.isadmin,klass,userid, jd ],
          after(function(results) {
              callback( {ok:true, msg:"deleted"} );
          }));
  else client.query(
        'select * from calendar '
      + ' where name = $1 and (class=$2 or class=0) and eventtype=\'absent\' and userid= $3 and julday= $4 ' , [ name,klass, userid,  jd ],
      after(function(results) {
          var abs ;
          if (results) abs = results.rows[0];
          if (abs) {
              if (abs.value != text || abs.name != name) {
              client.query(
                  'update calendar set class=$1, name=$2,value=$3 where id=$4',[ klass,name,text, abs.id ],
                  after(function(results) {
                      callback( {ok:true, msg:"updated"} );
                  }));
              } else {
                callback( {ok:true, msg:"unchanged"} );
              }
          } else {
            client.query(
                'insert into calendar (courseid,userid,julday,eventtype,value,name,class) values (0,$1,$2,\'absent\',$3,$4,$5)',[userid,jd,text,name,klass],
                after(function(results) {
                    callback( {ok:true, msg:"inserted"} );
                }));
          }
      }));
}


var getcalendar = function(query,callback) {
  // returns a hash of all calendar events that cause  teach/stud to miss lessons
  //  {  julday:{ uid:{value:"1,2",name:"Kurs"}, uid:"1,2,3,4,5,6,7,8,9", ... }
  var upper       = +query.upper    || db.lastweek ;
  client.query(
      "select id,userid,julday,name,slot,value,class as klass from calendar where eventtype in ('absent','meet','reservation')"
      + " and julday >= $1 and julday <= $2 ",[ db.startjd, upper ],
      after(function(results) {
          var absent = {};
          if (results && results.rows) for (var i=0,k= results.rows.length; i < k; i++) {
              var res = results.rows[i];
              var julday = res.julday;
              var uid = res.userid;
              delete res.julday;   // save some space
              delete res.userid;   // save some space
              if (!absent[julday]) {
                absent[julday] = {}
              }
              absent[julday][uid] = res;
          }
          callback(absent);
          //console.log(absent);
      }));
}


var getabsent = function(query,callback) {
  // returns a hash of all absent teach/stud
  //  {  julday:{ uid:{value:"1,2",name:"Kurs"}, uid:"1,2,3,4,5,6,7,8,9", ... }
  var upper       = +query.upper    || db.lastweek ;
  client.query(
      "select id,userid,julday,name,value,class as klass from calendar "
      + " where eventtype ='absent' and julday >= $1 and julday <= $2 ",[ db.startjd, upper ],
      after(function(results) {
          var absent = {};
          if (results && results.rows) for (var i=0,k= results.rows.length; i < k; i++) {
              var res = results.rows[i];
              var julday = res.julday;
              var uid = res.userid;
              delete res.julday;   // save some space
              delete res.userid;   // save some space
              if (!absent[julday]) {
                absent[julday] = {}
              }
              absent[julday][uid] = res;
          }
          callback(absent);
          //console.log(absent);
      }));
}


exports.editgroup = function(user,query,callback) {
  // insert/update/delete a group
  var action       = query.action;
  var groupname    = query.groupname;
  var nuname       = query.nuname;
  var roleid       = +query.roleid || 0;
  switch(action) {
      case 'create':
           client.query("insert into groups (groupname,roleid) "
                       + " values ($1,$2) ",[groupname,roleid],
           after(function(results) {
              callback( {ok:true, msg:"deleted" } );
              getBasicData();  // total reread of everything
           }));
        break;
      case 'delete':
          client.query("delete from groups where groupname=$1",[groupname],
          after(function(results) {
               callback( {ok:true, msg:"deleted" } );
           }));
        break;
      case 'update':
          client.query("update groups set groupname=$2 where groupname=$1 ",[groupname,nuname],
          after(function(results) {
               callback( {ok:true, msg:"updated" } );
           }));
    	break;
      default:
          client.query("select g.*,m.userid from groups g left outer join members m on (m.groupid = g.id) order by groupname",
          after(function(results) {
               var grouplist = {};
               for (var i=0; i< results.rows.length; i++) {
                 var re = results.rows[i];
                 if (!grouplist[re.groupname]) grouplist[re.groupname] = { id:re.id, studs:[] };
                 grouplist[re.groupname].studs.push(re.userid);
               }
               callback( {ok:true, msg:"", group:grouplist } );
           }));
        break;
  }
}

exports.edituser = function(user,query,callback) {
  // insert/update/delete a course
  var action       = query.action;
  var username     = query.username;
  var firstname    = query.firstname;
  var lastname     = query.lastname;
  var department   = query.department || 'Student';
  var institution  = query.institution || 'New';
  var password     = query.password || 'new';
  var md5pwd = crypto.createHash('md5').update(password).digest("hex");
  switch(action) {
      case 'create':
           client.query("insert into users (username,firstname,lastname,password,department,institution) "
                       + " values ($1,$2,$3,$4,$5,$6) returning id",[username,firstname,lastname,md5pwd,department,institution],
           after(function(results) {
            var nu = (results.rows && results.rows.length) ? results.rows[0] : 0;
            client.query("select * from users order by username",
            after(function(results) {
                 callback( {ok:true, msg:"created", users:results.rows, nu:nu } );
             }));
             getBasicData();  // total reread of everything
           }));
        break;
      case 'delete':
          client.query("delete from users where username=$1",[username],
          after(function(results) {
            client.query("select * from users order by username",
            after(function(results) {
                 callback( {ok:true, msg:"deleted", users:results.rows } );
             }));
           }));
        break;
      case 'update':
          client.query("update users set username=$2, firstname=$3, lastname=$4 where username=$1 ",[username,nuuser,nufirst,nulast],
          after(function(results) {
               callback( {ok:true, msg:"updated" } );
           }));
    	break;
      default:
          client.query("select * from users order by username",
          after(function(results) {
               callback( {ok:true, msg:"", users:results.rows } );
           }));
        break;
  }
}

exports.editcourse = function(user,query,callback) {
  // insert/update/delete a course
  var action     = query.action;
  var shortname  = query.shortname;
  var fullname   = query.fullname;
  var nushort    = query.nushort;
  var nufull     = query.nufull;
  var cat        = +query.cat;
  switch(action) {
      case 'create':
           client.query("insert into course (shortname,fullname,category) values ($1,$2,$3)",[shortname,fullname,cat],
           after(function(results) {
               callback( {ok:true, msg:"created" } );
               getBasicData();  // total reread of everything
           }));
        break;
      case 'delete':
          client.query("delete from course where shortname=$1",[shortname],
          after(function(results) {
               callback( {ok:true, msg:"deleted" } );
           }));
        break;
      case 'update':
          client.query("update course set shortname=$1, fullname=$2 where shortname=$3",[nushort,nufull,shortname],
          after(function(results) {
               callback( {ok:true, msg:"updated" } );
           }));
    	break;
      default:
          client.query("select c.*,t.userid,e.groupid from course c left outer join teacher t on (t.courseid = c.id) "
              + " left outer join enrol e on (e.courseid = c.id) "
              + " order by shortname",
          after(function(results) {
               var courselist = {};
               var tea = {};  // list of seen teachers
               var gro = {};  // list of seen groups
               for (var i=0; i< results.rows.length; i++) {
                 var re = results.rows[i];
                 if (!courselist[re.shortname]) courselist[re.shortname] = { id:re.id, fullname:re.fullname, teachers:[], groups:[] };
                 if (re.userid && !tea[re.shortname + '_' + re.userid]) courselist[re.shortname].teachers.push(re.userid);
                 if (re.groupid && !gro[re.shortname + '_' + re.groupid]) courselist[re.shortname].groups.push(re.groupid);
                 tea[re.shortname + '_' + re.userid] = 1;
                 gro[re.shortname + '_' + re.groupid] = 1;
               }
               callback( {ok:true, msg:"", course:courselist } );
           }));
        break;
  }
}

exports.modifyPlan = function(user,query,callback) {
  // create/modify/delete a plan
  if (!user || user.department != 'Undervisning' ) {
    callback("not allowed");
    return;
  }
  var operation = query.operation;
  var pname     = query.pname    || 'newplan';
  var periodeid = 8;
  var subject   = query.subject  || pname;
  var category  = query.category || 0;
  var state     = query.state    || 0;
  var planid    = query.planid   || 0;
  var connect   = query.connect  || '';
  switch(operation) {
    case 'newplan':
      client.query(
      'insert into plan (name,periodeid,info,userid,category,state) values ($1,$2,$3,$4,$5,$6) returning id'
      , [pname,periodeid,subject,user.id,category,state ],
      after(function(results) {
          if (results && results.rows && results.rows[0] ) {
            var pid = results.rows[0].id;
            var val = [];
            for (var i=0; i < 48; i++) {
              val.push("('',"+pid+","+i+")");
            }
            client.query( 'insert into weekplan (plantext,planid,sequence) values ' + val.join(','),
            after(function(results) {
                 callback("inserted");
            }));
          }
      }));
      break;
    case 'connect':
          if (connect) {
            //cidlist = connect.split(',');
            console.log('update course set planid = '+planid+' where id in ('+connect+')');
            //*
            client.query(
            'update course set planid = $1 where id in ('+connect+')' , [planid ],
            after(function(results) {
                callback("connected");
            }));
            // */
          }
      break;
    case 'disconnect':
          // disconnect a course from this plan
          callback("disconnected");
      break;
    case 'editplan':
          // change name, subject, year
            client.query(
            'update plan set periodeid = $1,name=$2,info=$3 where id =$4' , [periodeid,pname,subject,planid ],
            after(function(results) {
                callback("edited");
            }));
      break;
    case 'delete':
      //console.log("deleting ",planid);
      client.query(
      'delete from plan where id=$1 ' , [planid ],
      after(function(results) {
          client.query( 'delete from weekplan where planid=$1', [ planid ] ,
          after(function(results) {
              callback("deleted");
          }));
      }));
      break;
  }
}



var ical = function(user,query,callback) {
  var action    =  query.action || 'yearplan';
  var itemid    = +query.itemid || 0;
  var type      =  query.type || 'yearplan';
  function guid() {
     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
              return v.toString(16);
              });
  }
  var intro = 'BEGIN:VCALENDAR' + "\n"
             + 'METHOD:PUBLISH' + "\n"
             + 'PRODID:/Apple Inc.//iCal 3.0//EN' + "\n"
             + 'X-WR-CALNAME:MineProver0008' + "\n"
             + 'X-WR-RELCALID:' + guid() + "\n"
             + 'X-WR-TIMEZONE:Europe/Oslo' + "\n"
             + 'VERSION:2.0' + "\n"
  var closing = 'END:VCALENDAR';
  var events = [];
  switch (action) {
    case 'timeplan':
      switch (type) {
        case 'teach':
          break;
        case 'stud':
          break;
        case 'room':
          break;
        default:
          break;
      }
      break;
    case 'yearplan':
      for (var jd in db.yearplan) {
        if (jd*7 < db.startjd ) continue;
        var e = db.yearplan[jd];
        for (var i in e.days) {
          var ev = e.days[i];
          var jud = jd*7 + +i;
          var greg = julian.jdtogregorian(jud);
          var start = tstamp(greg,0,1);
          var stop =  tstamp(greg,23,1);
          var eva = { summary:ev, stamp:start, start:start, end:stop, uid:guid() };
          console.log(jd*7,i,ev);
          var evstr = (''
            + 'BEGIN:VEVENT' + "\n"
            + 'SUMMARY:{summary}' + "\n"
            + 'CLASS:PUBLIC' + "\n"
            + 'DTSTAMP:{stamp}' + "\n"
            + 'DTSTART:{start}' + "\n"
            + 'DTEND:{end}' + "\n"
            + 'UID:{uid}' + "\n"
            + 'END:VEVENT' + "\n"
            ).supplant(eva);
          events.push(evstr);
        }
      }
      break;
    case 'rom':
      break;
  }
  var data = intro + events.join("") + closing;
  callback(data);

  function tstamp(greg,h,min) {
     var y = greg.year;
     var m = greg.month;
     var d = greg.day;
     return "" + y + ff(m) + ff(d) + "T" + ff(h) + ff(min) + "00";

     function ff(t) {
         var t0 = +t;
         if (t0 < 10) return "0"+t0;
         return ""+t0;
     }
  }
}

var savesimple = function(query,callback) {
  // update/insert yearplan/freedays
  var type = query.myid.substring(0,4);
  var typemap = { 'free':'fridager','year':'aarsplan' };
  var eventtype = typemap[type] || 'error';
  if (eventtype == 'error') {
     callback( { ok:false, msg:"invalid event-type" } );
  }
  var jd  = query.myid.substring(4);
  var text = query.value;
  if (text == '') client.query(
          'delete from calendar where eventtype=$1 and julday= $2 ' , [ eventtype, jd ],
          after(function(results) {
              callback( {ok:true, msg:"deleted"} );
          }));
  else client.query(
        'select * from calendar where eventtype= $1 and julday= $2 ' , [ eventtype,  jd ],
      after(function(results) {
          if (results.rows && results.rows[0]) {
              var free = results.rows.pop();
              //console.log(free);
              if (free.value != text) {
              client.query(
                  'update calendar set value=$1 where id=$2',[ text, free.id ],
                  after(function(results) {
                      callback( {ok:true, msg:"updated"} );
                  }));
              } else {
                callback( {ok:true, msg:"unchanged"} );
              }
          } else {
            //console.log( 'insert into calendar (courseid,userid,julday,eventtype,value) values (0,2,$1,$2,$3)',[jd,eventtype,text]);
            client.query(
                'insert into calendar (courseid,userid,julday,eventtype,value) values (0,2,$1,$2,$3)',[jd,eventtype,text],
                 after(function(results) {
                    callback( {ok:true, msg:"inserted"} );
                }));
          }
      }));
}

var saveTimetableSlot = function(user,query,callback) {
  // update/insert test

  var teachid  = query.teachid;
  var day = query.day;
  var slot = query.slot;
  var value = query.value;
  var name = query.name;
  var rid = +query.rid;
  var cid = +query.cid;
  var jd = db.firstweek;
  //console.log("insert into calendar (julday,teachid,roomid,courseid,day,slot,value,name,eventtype) values "
  //       + " ($1,$2,$3,$4,$5,$6,$7,$8,'timetable') " , [jd,teachid,rid,cid,day,slot,value,name] );
  if (rid > 0 && cid >0) {
    try {
    client.query("insert into calendar (julday,teachid,roomid,courseid,day,slot,value,name,eventtype) values "
         + " ($1,$2,$3,$4,$5,$6,$7,$8,'timetable') " , [jd,teachid,rid,cid,day,slot,value,name], 
                 after(function(results) {
                    callback( {ok:true, msg:"inserted"} );
                }));
    } catch(err) {
          callback( {ok:false, msg:"failed insert"} );
          console.log("Failed to insert ",err);
    }
  } else {
    console.log("Incomplete data for timetable entry - missing rid,cid",rid,cid);
    callback( {ok:false, msg:"failed insert"} );
  }
  return;
}







exports.getsql = function(user,sql,param,reload,callback) {
  // runs a query and returns the recordset
  // only allows admin to run this query
  if (!user || !user.isadmin) {
    callback("not allowed");
    return;
  }
  if (param == '') param = [];
  client.query(
      sql,param,
      after(function(results) {
          if (results.rows) {
            callback(results.rows);
          } else {
            callback(null);
          }
          if (reload) {
            getBasicData();
          }
      }));
}



var teachstarb = function(elever,julday,starbreglist, callback) {
  // used by teachers to reg multiple studs for starb
    client.query( 'delete from starb where julday='+julday+' and userid in ('+elever+') ' , function() {
     client.query( 'insert into starb (julday,userid,teachid,roomid) values ' + starbreglist,
      function(err,results) {
        if (err) {
          callback( { fail:1, msg:sys.inspect(err) } );
        } else {
          callback( { fail:0, msg:'ok' } );
        }
      });
    });
}

var regstarb = function(ip,user, query, callback) {
  // dual purpose: can be used to check if already registered
  // otherwise will attempt to register
  // the user need not be logged in
  var regkey    = +query.regkey     || 0;
  var userid    = +query.userid     || 0;
  var utz       = +query.utz        || 0;  // user timezone
  var resp = { fail:1, text:"error", info:"" };
  /*
  if (ip.substr(0,6) != '152.93' ) {
      resp.text = "Bare fra skolen";
      callback(resp);
      return;
  }
  */
  if (userid == 0 || !db.students[userid] ) {
      callback(resp);
      return;
  }
  var today = new Date();
  var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
  var jd = julian.greg2jul(month,day,year);
  var hh = today.getHours();
  var tz = today.getTimezoneOffset(); // server timezone
  var mm = today.getMinutes();
  var minutcount = hh * 60 + +mm + ( +tz - +utz);
  // because pound sets ip to 127.0.0.1 we drop test for unique ip
  //client.query( 'select * from starb where julday=$1 and (userid=$2 or ip=$2) ' , [jd,userid,ip ],
  client.query( 'select * from starb where julday=$1 and userid=$2 ' , [jd,userid ],
      after(function(results) {
          if (results.rows && results.rows[0]) {
            var starb = results.rows[0];
            if (starb.userid == userid) {
              resp.fail = 0;
              resp.text = "Allerede registrert"
              resp.info = "";
              if (db.roomnames && db.roomnames[starb.roomid]) {
                resp.info += " Rom: " + db.roomnames[starb.roomid]
              }
              if (db.teachers && db.teachers[starb.teachid]) {
                resp.info += " av " + db.teachers[starb.teachid].username;
              }
            } else {
              resp.fail = 1;
              resp.text = "Bare en starb-reg pr maskin (ip)"
              resp.info = ip + " er allered brukt.";
            }
            callback(resp);
          } else {
            // not registered
            client.query( 'select * from starbkey where regkey=$1 ' , [regkey ],
                after(function(results) {
                  if (results.rows && results.rows[0]) {
                    var starbkey = results.rows[0];
                    if (starbkey.ecount > 0 && (starbkey.start <= minutcount+1) && (starbkey.start + starbkey.minutes >= minutcount-1) ) {
                      // note we use userid instead of ip - cause pound removes original ip
                      console.log( 'insert into starb (julday,userid,teachid,roomid,ip) values'
                          + ' ($1,$2,$3,$4,$2) ' , [jd, userid, starbkey.teachid, starbkey.roomid, ip]);
                      client.query( 'insert into starb (julday,userid,teachid,roomid,ip) values'
                          + ' ($1,$2,$3,$4,$5) ' , [jd, userid, starbkey.teachid, starbkey.roomid, ""+userid ],
                        function(err,results) {
                          if (err) {
                            console.log(err);
                            resp.fail = 1;
                            resp.text = "Allerede registrert";
                            callback(resp);
                            return;
                          }
                          resp.fail = 0;
                          resp.text = "Registrert"
                          resp.info = "";
                          if (db.roomnames && db.roomnames[starbkey.roomid]) {
                            resp.info += "på " + db.roomnames[starbkey.roomid]
                          }
                          if (db.teachers && db.teachers[starbkey.teachid]) {
                            resp.info += " av " + db.teachers[starbkey.teachid].username;
                          }
                          callback(resp);
                          client.query( 'update starbkey set ecount = ecount - 1 where id = $1', [starbkey.id],
                              after(function(results) {
                              }));
                       });
                    } else {
                      resp.fail = 1;
                      resp.text = "Ugyldig key";
                      if (starbkey.ecount == 0) {
                        resp.text = "RegKey er brukt opp";
                      } else if (starbkey.start > minutcount) {
                        var kmm = starbkey.start % 60;
                        var khh = Math.floor(starbkey.start / 60) + ":" + ((kmm < 10) ? '0' : '') + kmm;
                        resp.text = "RegKey ikke gyldig nu "+khh;
                      } else if (starbkey.start + starbkey.minutes < minutcount) {
                        resp.text = "RegKey er ikke lenger gyldig";
                      }
                      callback(resp);
                    }

                  } else {
                    resp.text = "Ugyldig key";
                    resp.fail = 1;
                    callback(resp);
                  }
                }));
          }
      }));

}

var deletestarb = function(user,params,callback) {
  var uid       = user.id        || 0;
  var eid       = +params.eid    || 0;
  var romid     = +params.romid  || 0;
  var alle      = +params.alle   || 0;
  if (uid < 10000 || romid == 0 ) {
      callback( { ok:0 } );
  }
  var today = new Date();
  var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
  var jd = julian.greg2jul(month,day,year);
  //console.log( 'select * from starb where julday=$1 and roomid=$2 ' , [jd,romid ]);
  var sql,params;
  if (alle == 1) {
    sql = 'delete from starb where julday = $1 and roomid=$2';
    params = [jd,romid];
  } else {
    sql = 'delete from starb where julday = $1 and userid=$2';
    params = [jd,eid];
  }
  client.query( sql, params,
      after(function(results) {
          callback( { ok:1 } );
      }));


}

var getstarb = function(user,params,callback) {
  // get list of starbreg for room
  // this day
  var starblist = { "elever":[]};
  var uid       = (user && user.id) ? user.id : 0;
  var romid     = +params.romid     || 0;
  var jd        = +params.julday    || 0;
  if (uid < 10000 ) {
      callback(starblist);
      return;
  }
  if (jd == 0) {
    var today = new Date();
    var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
    var jd = julian.greg2jul(month,day,year);
  }
  //console.log( 'select * from starb where julday=$1 and roomid=$2 ' , [jd,romid ]);
  client.query( 'select * from starb where julday=$1 and roomid=$2 ' , [jd,romid ],
      after(function(results) {
          if (results.rows) {
            for ( var i=0; i< results.rows.length; i++) {
              var starb = results.rows[i];
              var elev = db.students[starb.userid]
              starblist['elever'].push( { eid:starb.userid, firstname:elev.firstname, lastname:elev.lastname, klasse:elev.department });
            }
          }
          callback(starblist);
      }));
}

var genstarb = function(user,params,callback) {
  if (user == undefined) {
    callback( { "key":0 } );
    return;
  }
  var uid = user.id || 0;
  var starth    = +params.starth    || 0;
  var startm    = +params.startm    || 0;
  var antall    = +params.antall    || 0;
  var romid     = +params.romid     || 0;
  var duration  = +params.duration  || 0;
  
  if (uid < 10000 || duration < 3 || duration > 80 || starth < 12 || starth > 14 || startm < 0 || startm > 59 ) {
    callback( { "key":0 } );
    return;
  }
  var today = new Date();
  var month = today.getMonth()+1; var day = today.getDate(); var year = today.getFullYear();
  var jd = julian.greg2jul(month,day,year);
  client.query('delete from starbkey where julday < $1' , [ jd ],
    after(function(results) {
    client.query('delete from starbkey where teachid = $1 and roomid=$2 and julday=$3' , [ uid,romid,jd ],
      after(function(results) {
        client.query('select * from starbkey',
          after(function(results) {
            var active = {}; // list of existing keys
            if (results && results.rows) {
              for (var i=0; i < results.rows.length; i++) {
                var kk = results.rows[i];
                active[kk.regkey] = kk;
              }
            }
            var regk = 0;
            var search = true;
            while (search) {
                regk = Math.floor(Math.random()* (9999 -314)) + 314;
                var regkstr = ""+regk;
                ts = 0;
                for (var j=0;j < regkstr.length; j++) {
                   ts =  (ts + 0 + +regkstr.substr(j,1) ) % 10;
                }
                regk = 10*regk + +ts;
                // the last digit in regkey == sum of the others mod 10
                search = (active[regk]) ? true : false;
            }
            client.query( 'insert into starbkey (roomid,julday,teachid,regkey,ecount,start,minutes) '
               + 'values ($1,$2,$3,$4,$5,$6,$7) ', [romid,jd,uid,regk,antall,starth*60+startm,duration],
              after(function(results) {
                callback( { "key":regk } );
            }));
        }));
      }));
    }));


}


var getmeeting = function(callback) {
  // returns a hash of all meetings (this is data created by owner)
  // meeting is the entry with list of participants
  // and other info like message - title - start-time - duration
  // some of this is duplicated in each meet entry
  // this is because a meeting should not be changed (change room f.eks)
  // but rather deleted and recreated with new info
  // because email HAS BEEN SENT with the old info
  // changing the data in the database (even if we maintain consistency between
  // meeting and meet IS WORTHLESS as the EMAILS CANT BE CHANGED
  // SOLUTION: delete and recreate - causing new emails to be sent
  client.query(
      'select id,userid,courseid,day,slot,roomid,name,value,julday,class as klass from calendar  '
       + "      WHERE eventtype = 'meeting' and julday >= " + db.startjd ,
      after(function(results) {
          var meets = {};
          for (var i=0,k= results.rows.length; i < k; i++) {
              var res = results.rows[i];
              var uid = res.userid;
              if (!meets[uid]) {
                meets[uid] = {};
              }
              meets[uid][res.id] = res;
          }
          callback(meets);
      }));
}

var getmeet = function(callback) {
  // returns a hash of all meet
  // a meet is a calendar entry for one specific person assigned to a meeting
  // each meet is connected to a meeting thru courseid
  // horrid - certainly. so what ?
  client.query(
      'select id,userid,courseid,day,slot,roomid,name,value,julday,class as klass from calendar  '
       + "      WHERE eventtype = 'meet' and class in (0,1,2) and julday >= " + db.startjd ,
      after(function(results) {
          var meets = {};
          for (var i=0,k= results.rows.length; i < k; i++) {
              var res = results.rows[i];
              var julday = res.julday;
              var uid = res.userid;
              delete res.julday;   // save some space
              delete res.userid;   // save some space
              if (!meets[julday]) {
                meets[julday] = {};
              }
              if (!meets[julday][uid]) {
                meets[julday][uid] = [];
              }
              meets[julday][uid].push(res);
          }
          callback(meets);
      }));
}

var changeStateMeet  = function(query,state,callback) {
   // 0 == in limbo, 1 == obligatory, 2 == accepted, 3 == rejected
   var userid = +query.userid;
   var meetid = +query.meetid;
   if (!isNaN(userid) && !isNaN(meetid) ) {
     client.query('update calendar set class=$3 where eventtype=\'meet\' and userid=$1 and courseid=$2 returning id  ',
       [userid,meetid,state] , 
       after(function(results) {
           callback(results);
       }));
   }
};


var makemeet = function(user,query,callback) {
    var current        = +query.current;
    var idlist         = query.idlist;
    var shortslots     = query.shortslots; // for short meetings (5,10,15 .. min)
    var kort           = query.kort;       // true if a short meeting
    var myid           = +query.myid;      // used to delete a meeting
    var myday          = +query.day;       // the weekday - current is monday
    var roomid         = query.roomid;
    var meetstart      = query.meetstart;
    var roomname       = query.room;
    var chosen         = query.chosen;
    var message        = query.message;
    var title          = query.title;
    var action         = query.action;
    var konf           = query.konf;       // oblig, accept, reject
    var resroom        = query.resroom;    // make a room reservation for meeting
    var sendmail       = query.sendmail;   // send mail to participants
    var values         = [];               // entered as events into calendar for each partisipant
    // idlist will be slots in the same day (script ensures this)
    if (kort && !(typeOf(shortslots) === 'object')) {
         callback( {ok:false, msg:"no slots"} );
         return;
    }
    switch(action) {
      case 'kill':
        //console.log("delete where id="+myid+" and uid="+user.id);
        sqlrunner('delete from calendar where eventtype=\'meet\' and id=$1 and (userid=$2 or $3 )  ',[myid,user.id,user.isadmin],callback);
        callback( {ok:true, msg:"meeting removed"} );
        break;
      case 'insert':
        var teach        = db.teachers[user.id];
        var owner        = teach.firstname.caps() + " " + teach.lastname.caps();
        var roomname     = db.roomnames[roomid];
        var calledback = false;
        var participants = [];
        var klass = (konf == 'ob') ? 1 : 0 ;
        var meetinfo = JSON.stringify({message:message, idlist:idlist, owner:user.id, 
                                       sendmail:sendmail, title:title, message:message, 
                                       chosen:chosen, kort:kort, shortslots:shortslots });
        client.query(
          'insert into calendar (eventtype,julday,userid,roomid,name,value) values (\'meeting\',$1,$2,$3,$4,$5)  returning id',
             [current+myday,user.id,roomid,title.substr(0,30),meetinfo], after(function(results) {
            if (results && results.rows && results.rows[0] ) {
              var pid = results.rows[0].id;
              var allusers = [];
              var slot = 0;                   // slot only used if short meeting
              if (kort) {
                slot = idlist;
                idlist = Object.keys(shortslots);
              }
              for (var uii in chosen) {
                var uid = +chosen[uii];
                var teach = db.teachers[uid];
                participants.push(teach.firstname.caps() + " " + teach.lastname.caps());
                allusers.push(teach.email);
                values.push('(\'meet\','+pid+','+uid+','+(current+myday)+','+roomid+",'"+title+"','"+idlist+"',"+klass+","+slot+")" );
              }
              var valuelist = values.join(',');
              //console.log( 'insert into calendar (eventtype,courseid,userid,julday,roomid,name,value,class,slot) values ' + values);
              client.query( 'insert into calendar (eventtype,courseid,userid,julday,roomid,name,value,class,slot) values ' + values,
               after(function(results) {
                   if (!(resroom && !kort)) {
                     if (!calledback) {
                       callback( {ok:true, msg:"inserted"} );
                       calledback = true;
                     }
                   }
              }));
              if (resroom && !kort) {
                // make a reservation if option is checked - but not for short meetings
                var myslots = idlist.split(',');
                values = [];
                for (var i in myslots) {
                    var slot = myslots[i];
                    values.push('(\'reservation\',123,'+user.id+','+current+','+myday+','+slot+','+roomid+',\''+roomname+'\',\''+title+'\')' );
                }
                //console.log( 'insert into calendar (eventtype,courseid,userid,julday,day,slot,roomid,name,value) values '+ values.join(','));
                client.query( 'insert into calendar (eventtype,courseid,userid,julday,day,slot,roomid,name,value) values '+ values.join(','),
                  after(function(results) {
                     if (!calledback) {
                       callback( {ok:true, msg:"inserted"} );
                       calledback = true;
                     }
                   }));
              }
              console.log("SENDMAIL=",sendmail);
              if (sendmail == 'yes') {
                if (kort) {
                  idlist = slot;  // swap the time-slot back in 
                }
                var greg = julian.jdtogregorian(current + myday);
                var d1 = new Date(greg.year, greg.month-1, greg.day);
                var meetdate = greg.day + '.' + greg.month + '.' + greg.year;
                var server  = email.server.connect({
                      user:       "skeisvang.skole", 
                      password:   "123naturfag", 
                      host:       "smtp.gmail.com", 
                      ssl:        true
                });
                var basemsg = '\n\n' + message + "\n\n\n" + "  Dato: " + meetdate + '\n  Time: ' + idlist 
                         + '\n  Tid: ' + meetstart + '\n  Sted: rom '+roomname;
                basemsg  += "\n\n" + "  Deltagere:\n   * " + participants.join('\n   * ');
                basemsg  += "\n\n" + "  Ansvarlig: " + owner;
                basemsg  += "\n";
                for (var uii in chosen) {
                      var persmsg = basemsg;
                      var uid = +chosen[uii];
                      var teach = db.teachers[uid];
                      if (konf == 'deny') persmsg += "\n" + " Avvis med denne linken:\n    http://node.skeisvang-moodle.net/rejectmeet?userid="+uid+"&meetid="+pid;
                      if (konf == 'conf') persmsg += "\n" + " Bekreft med denne linken:\n    http://node.skeisvang-moodle.net/acceptmeet?userid="+uid+"&meetid="+pid;
                      server.send({
                                text:   persmsg
                              , from:   "AvtalePlanlegger <skeisvang.skole@gmail.com>"
                              , to:     teach.email
                              , subject:  title
                      }, function(err, message) { console.log(err || message); });
                }
              }
              return;
           }
           if (!calledback) {
             callback( {ok:true, msg:"inserted"} );
             calledback = true;
           }

        }));
        break;
    }
    callback( {ok:false, msg:"Failed to make meeting"} );
}

var makereserv = function(user,query,callback) {
    //console.log(query);
    var current  = +query.current;
    var idlist   = query.idlist.split(',');
    var myid     = +query.myid;
    var room     = query.room;
    var message  = query.message;
    var action   = query.action;
    var values   = [];
    var itemid   = +db.roomids[room];
    switch(action) {
      case 'kill':
        //console.log("delete where id="+myid+" and uid="+user.id);
        sqlrunner('delete from calendar where eventtype=\'reservation\' and id=$1 and (userid=$2 or $3 )  ',[myid,user.id,user.isadmin],callback);
        break;
      case 'update':
        //console.log( 'update calendar set value = '+message+'where id='+myid+' and ('+user.isadmin+' or userid='+user.id+')' );
        sqlrunner( 'update calendar set value = $1 where eventtype=\'reservation\' and id=$2 and ($3 or userid=$4) ',
             [message,myid,user.isadmin,user.id],callback);
        break;
      case 'insert':
        for (var i in idlist) {
            var elm = idlist[i].substr(3).split('_');
            var day = +elm[1];
            var slot = +elm[0];
            values.push('(\'reservation\',3745,'+user.id+','+(current+day)+','+day+','+slot+','+itemid+',\''+room+'\',\''+message+'\')' );
        }
        var valuelist = values.join(',');
        //console.log( 'insert into calendar (eventtype,courseid,userid,julday,day,slot,roomid,name,value) values ' + values);
        client.query(
          'insert into calendar (eventtype,courseid,userid,julday,day,slot,roomid,name,value) values ' + values,
          after(function(results) {
              callback( {ok:true, msg:"inserted"} );
          }));
        break;
    }
}


var getReservations = function(callback) {
  // returns a hash of all reservations 
  client.query(
      'select id,userid,day,slot,courseid,roomid,name,value,julday,eventtype from calendar cal '
       + "      WHERE roomid > 0 and eventtype in ('heldag', 'reservation') and julday >= $1 order by julday,day,slot" , [ db.startjd - 34 ] ,
      after(function(results) {
          var reservations = {};
          for (var i=0,k= results.rows.length; i < k; i++) {
              var res = results.rows[i];
              var julday = res.julday;
              delete res.julday;   // save some space
              if (!reservations[julday]) {
                reservations[julday] = [];
              }
              if (res.eventtype == 'heldag') {
                res.day = julday % 7;
                var roomname = db.roomnames[res.roomid];
                //var repl = new RegExp(",? *"+roomname,"i");
                //var vvalue = (res.name+' '+res.value).replace(repl,'');
                var vvalue = (res.name+' '+stripRooms(res.value));
                for (var j=0;j<9;j++) {
                  res.slot = j;
                  reservations[julday].push({id: res.id, userid: res.userid, day: res.day, 
                                 slot: j, itemid: res.roomid, name:roomname , value:vvalue, eventtype:'hd' });
                }
              } else {
                reservations[julday].push(res);
              }
          }
          callback(reservations);
      }));
}


var getTimetables = function(isad,callback) {
  // fetch all timetable data
  // returns a hash { course:{ "3inf5_3304":[ [1,2,"3inf5_3304","R210",'',654 ], ... ] , ... } , 
  //                    room:{ "r210":      [ [1,2,"3inf5_3304",654 ..
  //                   group:{ "3304":      [ [1,2,"3inf5_3304","r210",'',654], ..],  "3sta":[... ] ... }
  //                   teach:{ "654":       [ [1,2,"3inf5_3304","r210",'',654], ..],  "1312":[... ] ... }
  //                    stud:{ "445":       [ [1,2,"3inf5_3304","r210",'',654], ..],  "447" :[... ] ... }
  //                }
  // the inner array is [day,slot,room,changed-room,teachid]
  // assumes you give it a callback that assigns the hash
  client.query(
      "select teachid,cal.day,cal.slot,r.name as room,cal.name from calendar cal inner join room r "
       +     " on cal.roomid = r. id where eventtype in ( 'timetable', 'xtratime' ) and julday = $1 order by cal.name,day,slot", [ db.firstweek ],
      after(function(results) {
          //console.log("RESULTS FOR gettimetables", db.firstweek);
          //console.log(results);
          var coursetimetable = {};
          var roomtimetable = {};
          var grouptimetable = {};
          var teachtimetable = {};
          var studtimetable = {};
          if (results && results.rows) 
          for (var i=0,k= results.rows.length; i < k; i++) {
              var lesson = results.rows[i];
              var course = lesson.name;
              var room = lesson.room;
              var elm = course.split('_');
              var fag = elm[0];
              var group = elm[1];
              var uid = lesson.teachid;

              // indexd by teach id
              if (!teachtimetable[uid]) {
                teachtimetable[uid] = [];
              }
              teachtimetable[uid].push([lesson.day, lesson.slot, course, room, '',uid]);

              // indexed by group name
              if (!grouptimetable[group]) {
                grouptimetable[group] = [];
              }
              grouptimetable[group].push([lesson.day, lesson.slot, course, room,'', uid]);


              // indexed by room name
              if (!roomtimetable[room]) {
                roomtimetable[room] = [];
              }
              roomtimetable[room].push([lesson.day, lesson.slot, course, room,'', uid]);

              // indexed by coursename (course_group)
              if (!coursetimetable[course]) {
                coursetimetable[course] = [];
              }
              coursetimetable[course].push([lesson.day, lesson.slot, course, room,'', uid]);
          }
          if (isad) {
            // indexed by stud id
            for (var gr in grouptimetable) {
              var mem = db.memlist[gr];
              var tt = grouptimetable[gr].slice();
              for (var sid in mem) {
                var stid = mem[sid];
                if (!studtimetable[stid]) {
                  studtimetable[stid] = [];
                }
                studtimetable[stid] = studtimetable[stid].concat(tt);
              }
            }
            console.log(studtimetable);
          }
          callback( { course:coursetimetable, room:roomtimetable, group:grouptimetable, teach:teachtimetable, stud:studtimetable  } );
      }));
}

var getstudents = function() {
  // we want list of all users, list of all courses
  // list of all groups, list of all tests
  // list of all freedays, list of all bigtests (exams etc)
  // list of all rooms, array of coursenames (for autocomplete)
  client.query(
      // fetch students and teachers
      'SELECT id,username,firstname,lastname,department,institution,email from users order by department,institution,lastname,firstname',
            after(function(results) {
            //console.log(results.rows);
            for (var i=0,k= results.rows.length; i < k; i++) {
                var user = results.rows[i];
                if (user.department == 'Undervisning') {
                  db.teachIds.push(user.id);
                  db.teachers[user.id] = user;
                  db.tnames.push(user.username);
                  db.teachuname[user.username] = user.id;
                } else {
                  db.studentIds.push(user.id);
                  db.students[user.id] = user;
                }
            }
      }));
}

var getcourses = function() {
  client.query(
      // fetch courses, groups and course:catoegories
      'select c.id,c.shortname,c.category,me.groupid, count(me.id) as cc from course c inner join enrol en on (en.courseid=c.id) '
      + ' inner join members me on (me.groupid = en.groupid) group by c.id,c.shortname,c.category,me.groupid having count(me.id) > 1 order by count(me.id)',
      after(function (results) {
          var ghash = {}; // only push group once
          var courselist = []; 
          for (var i=0,k= results.rows.length; i < k; i++) {
              var course = results.rows[i];
              //if (course.cc <1) continue;
              courselist.push(course.id);
              var elm = course.shortname.split('_');
              var cname = elm[0];
              var group = elm[1];
              db.course.push(cname);
              db.category[cname] = course.category;
              if (!ghash[group]) {
                db.groups.push(group);
                ghash[group] = 1;
              }

              if (!db.grcourses[group]) {
                db.grcourses[group] = [];
              }
              db.grcourses[group].push(cname);

              if (!db.coursesgr[cname]) {
                db.coursesgr[cname] = [];
              }
              db.coursesgr[cname].push(group);
          }
          var str_courselist = courselist.join(',');
          //('select c.id, c.shortname,en.userid,en.roleid as role from course c inner join enrol en on (c.id = en.courseid) where c.id in ( ' + str_courselist + ' )');
          client.query(
              // fetch memberlist for all courses
              //'select c.id, c.shortname,en.userid,en.roleid as role from course c inner join enrol en on (c.id = en.courseid) where c.id in ( ' + str_courselist + ' )',
              'select c.id,c.shortname,me.userid from course c inner join enrol en on (en.courseid=c.id) '
              + ' inner join members me on (me.groupid = en.groupid) group by c.id,c.shortname,me.userid ',
              after( function (results) {
                  var blokkgr = {};
                  var blokkmem = {};  // used to prevent duplicates
                  for (var i=0,k=results.rows.length; i<k; i++) {
                    var amem = results.rows[i];
                    var elm = amem.shortname.split('_');
                    var cname = elm[0];
                    var group = elm[1];
                    if (!db.cname2id[amem.shortname]) {
                        db.cname2id[amem.shortname] = amem.id;
                        db.cid2name[amem.id] = amem.shortname;
                    }

                    // build group: studentlist
                      if (!db.memlist[group]) {
                        db.memlist[group] = [];
                        blokkmem[group] = {}
                      }
                      // only students in memlist
                      if (!blokkmem[group][amem.userid]) {
                        db.memlist[group].push(amem.userid);
                        blokkmem[group][amem.userid] = 1;
                      } 
                    // build person : grouplist
                      if (!db.memgr[amem.userid]) {
                        db.memgr[amem.userid] = [];
                        blokkgr[amem.userid] = {};
                      }
                      if (! blokkgr[amem.userid][group]) {
                        db.memgr[amem.userid].push(group);
                        blokkgr[amem.userid][group] = 1;
                      }
                  } 
                  client.query(
                      'select c.id,c.shortname,t.userid from teacher t inner join course c on (c.id = t.courseid)',
                      after( function (results) {
                          // build courseteach
                          // and teachcourse
                          for (var i=0,k=results.rows.length; i<k; i++) {
                                var amem = results.rows[i];
                                var elm = amem.shortname.split('_');
                                var cname = elm[0];
                                var group = elm[1];
                                if (!db.courseteach[amem.shortname]) {
                                  db.courseteach[amem.shortname] = {teach:[],id:amem.id};
                                }
                                if (!db.teachcourse[amem.userid]) {
                                  db.teachcourse[amem.userid] = [];
                                }
                                db.teachcourse[amem.userid].push(amem.shortname);
                                db.courseteach[amem.shortname].teach.push(amem.userid);

                            // build person : grouplist
                              if (!db.memgr[amem.userid]) {
                                db.memgr[amem.userid] = [];
                                blokkgr[amem.userid] = {};
                              }
                              if (! blokkgr[amem.userid][group]) {
                                db.memgr[amem.userid].push(group);
                                blokkgr[amem.userid][group] = 1;
                              }
                          }
                          //console.log(db.teachcourse);
                          //console.log(db.memlist);
                          // console.log(db.cname2id);
                          client.query( 'select * from groups',
                              after( function (results) {
                                 for (var i=0,k=results.rows.length; i<k; i++) {
                                   var gg = results.rows[i];
                                   db.groupnames[gg.groupname] = gg.id;
                                 }
                                 client.query( 'select * from members ',
                                  after( function (results) {
                                    for (var i=0,k=results.rows.length; i<k; i++) {
                                      var ggmem = results.rows[i];
                                      if (!db.memlist[ggmem.groupid]) {
                                        db.memlist[ggmem.groupid] = [];
                                        blokkmem[ggmem.groupid] = {}
                                      }
                                      if (!blokkmem[ggmem.groupid][ggmem.userid]) {
                                        db.memlist[ggmem.groupid].push(ggmem.userid);
                                        blokkmem[ggmem.groupid][ggmem.userid] = 1;
                                      } 
                                    }
                                  }));
                              }));
                     }));
              }));
      }));
}


var getroomids = function() {
  client.query(
      "select id,name from room ",
      after(function(results) {
          db.roomids   = {};
          db.roomnames = {};
          if (results) {
            for (var i=0,k= results.rows.length; i < k; i++) {
              var room = results.rows[i];
              db.roomids[""+room.name] = ""+room.id;
              db.roomnames[room.id] = room.name;
              db.roomnamelist.push(room.name);
            }
          }
      }));
}

var getActiveWorkbooks = exports.getActiveWorkbooks  = function () {
  client.query('select c.shortname,ques.id from quiz q inner join quiz_question ques on (ques.id = q.cid) '
               + 'inner join course c on (q.courseid = c.id)', after(function(results) {
     var wb = {};
     if (results && results.rows) {
       for (var i=0,k= results.rows.length; i < k; i++) {
         var wblink = results.rows[i];
         wb[wblink.shortname] = wblink.id;
       }
     }
     db.workbook = wb;
  }));
  // get list of teacher/subject for subscription
  client.query("select distinct teachid,subject from quiz_question where teachid > 100 and subject != '' " ,   
   after(function(results) {
     var subscribe = { teachers:{}, subjects:{} };
     if (results && results.rows) {
       for (var i=0,k= results.rows.length; i < k; i++) {
         var subb = results.rows[i];
         if (!subscribe.subjects[subb.subject]) {
            subscribe.subjects[subb.subject] = [];
         }
         if (!subscribe.teachers[subb.teachid]) {
            subscribe.teachers[subb.teachid] = [];
         }
         subscribe.subjects[subb.subject].push(subb.teachid);
         subscribe.teachers[subb.teachid].push(subb.subject);
       }
     }
     db.subscribe = subscribe;
  }));
}


function checkSetup() {
  // if admin user is missing - insert
  client.query("select * from users where username = 'admin' ", after(function(results) {
           if (results.rows && results.rows[0]) {
             // admin exists
           } else {
             // create admin with default password taken from creds.js
             client.query("insert into users (username,firstname,lastname,department,institution,password)"
                + " values ('admin','ad','min','Undervisning','System','"+siteinf.adminpwd+"') " );
           }
        }));
  // if default subject is missing - insert it
  client.query("select * from subject where id = 1 ", after(function(results) {
           if (results.rows && results.rows[0]) {
             // subject 1 exists (default subject for all courses)
           } else {
             // create default subject and default plan
             client.query("insert into subject (id,subjectname,description) values (1,'new','new subject')" );
             client.query("insert into periode (id,name,info,startyear,startweek,numweeks) values (1,'new','newperiode',2012,33,46)" );
             client.query("insert into plan (id,name) values (1,'noplan')" );
           }
        }));
}

var getexams = exports.getexams = function(callback) {
      //console.log('getting stuff exams');
  client.query(
      // fetch big tests (exams and other big tests - they block a whole day )
      "select id,julday,name,value,class as klass,eventtype from calendar where eventtype in ('heldag','xtrax') ",
      after(function(results) {
          //console.log('ZZresult=',db.heldag);
          if (results) {
          for (var i=0,k= results.rows.length; i < k; i++) {
              var free = results.rows[i];
              if (free.eventtype == 'heldag') {
                if (!db.heldag[free.julday]) {
                  db.heldag[free.julday] = {};
                }
                db.heldag[free.julday][free.name.toUpperCase()] = { value:stripRooms(free.value), klass:free.klass, fullvalue:free.value };
              } else {
                if (!db.xtrax[free.julday]) {
                  db.xtrax[free.julday] = {};
                }
                db.xtrax[free.julday][free.name] = { value:free.value };
              }
          }
          }
          if (callback) callback(db.heldag);
          //console.log('result=',db.heldag);
      }));
}

var getyearplan = exports.getyearplan = function(callback) {
  client.query(
      // fetch yearplan events
      "select id,julday,value from calendar where eventtype='aarsplan' ",
      after(function(results) {
          db.yearplan = {};
          if (results) {
          for (var i=0,k= results.rows.length; i < k; i++) {
              var plan = results.rows[i];
              if (!db.yearplan[Math.floor(plan.julday/7)]) {
                db.yearplan[Math.floor(plan.julday/7)] = { week:julian.week(plan.julday), pr:[], days:[] };
              }
              db.yearplan[Math.floor(plan.julday/7)].days[Math.floor(plan.julday%7)] =  plan.value;
          }
          }
          if (callback) callback(db.yearplan);
          //console.log(db.yearplan);
      }));
}

var getfreedays = exports.getfreedays = function(callback) {
  client.query(
      // fetch free-days
      "select * from calendar where eventtype='fridager' ",
      after(function(results) {
          db.freedays = {};
          if (results) {
            for (var i=0,k= results.rows.length; i < k; i++) {
              var free = results.rows[i];
              db.freedays[free.julday] = free.value;
            }
          }
          //console.log("fetched freedays");
          if (callback) callback(db.freedays);
      }));
}


var getBasicData = function() {
  // we want list of all users, list of all courses
  // list of all groups, list of all tests
  // list of all freedays, list of all bigtests (exams etc)
  // list of all rooms, array of coursenames (for autocomplete)
  db.studentIds   = []   ;
  db.students     = {}  ;
  db.teachIds     = [] ;
  db.teachers     = {} ;
  db.teachuname   = {};
  db.tnames       = [];
  db.roomnamelist = [];
  db.course       = siteinf.course;  // [ '2TY14','3SP35','3TY5' ] ;
  db.cid2name     = {}   ;
  db.cname2id     = {}   ;
  db.freedays     = {}   ;
  db.heldag       = {}   ;
  db.prover       = {}   ;
  db.yearplan     = {}   ;
  db.groups       = []   ;
  db.groupnames   = {}   ;
  db.memlist      = {}   ;
  db.courseteach  = {}   ;
  db.grcourses    = {}   ;
  db.coursesgr    = {}   ;
  db.memgr        = {}   ;
  db.teachcourse  = {}   ;
  console.log("getting basic data");
  checkSetup();
  getroomids();
  getstudents();
  getcourses();
  getfreedays();
  getyearplan();
  getexams();
  getActiveWorkbooks();
};



getBasicData();


module.exports.reread = getBasicData;
module.exports.db = db;
module.exports.client = client;
module.exports.getstudents = getstudents;
module.exports.getcourses = getcourses;
module.exports.getReservations = getReservations;
module.exports.makereserv = makereserv;
module.exports.makemeet = makemeet;
module.exports.changeStateMeet = changeStateMeet;  
module.exports.getmeet = getmeet;
module.exports.getmeeting = getmeeting;
module.exports.getTimetables = getTimetables;
module.exports.savesimple = savesimple;
module.exports.ical = ical;
module.exports.saveabsent = saveabsent;
module.exports.getabsent = getabsent;
module.exports.saveteachabsent = saveteachabsent;
module.exports.saveTimetableSlot =  saveTimetableSlot ;
