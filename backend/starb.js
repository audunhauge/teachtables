/*
 *  Database for study attendance
 */

// get hold of database
var client = siteinf.client;
var julian = require('./julian');
var after = require('./utils').after;
var sys = require('util');
var database = siteinf.database;
var db = database.db;
var starbsec = require('./starbsec');


exports.getstarbless = function(user, query, callback) {
  client.query(
      "select * from calendar where eventtype='starbless' order by teachid,name ",
      after(function(results) {
         if (results.rows)
          callback(results.rows);
         else
          callback(null);
      }));
};


exports.getallstarblessdates = function(user, query, callback) {
  // all starb lessons from this week forward
  client.query(
      "select ca.julday, les.teachid, les.roomid, les.name, les.value from calendar ca inner join calendar les on "
      + " (ca.courseid = les.id and ca.eventtype = 'less' and les.eventtype='starbless' ) "
      + " where ca.julday >= " + db.startjd ,
      after(function(results) {
         if (results.rows)
          callback(results.rows);
         else
          callback(null);
      }));
};

exports.getstarblessdates = function(user, query, callback) {
  var teachid    = +query.teachid || 0;
  client.query(
      "select ca1.* from calendar ca1 inner join calendar ca2 "
      + " on (ca2.id = ca1.courseid and ca1.eventtype = 'less' and ca2.eventtype='starbless' and ca2.teachid=$1) ",[teachid ],
      after(function(results) {
         if (results.rows)
          callback(results.rows);
         else
          callback(null);
      }));
};

exports.killstarbless = function(user, query, callback) {
  var idd       = +query.idd || 0;
  client.query( "delete from calendar where courseid=$1 and eventtype='less' ",[idd],
      after(function(results) {
        client.query( "delete from calendar where id=$1 and eventtype='starbless' ",[idd],
          after(function(results) {
            callback( { msg:"ok" });
          }));
      }));
};

exports.createstarbless = function(user, query, callback) {
  var info      = query.info || '';
  var name      = query.name || '';
  var roomid    = +query.roomid || 0;
  var teachid   = +query.teachid || 0;
  var day       = +query.day || 0;
  if (info && day && roomid && teachid) {
    client.query( "insert into calendar (julday,teachid,roomid,day,value,name,eventtype) values (0,$1,$2,$3,$4,$5,'starbless') ", [teachid,roomid,day-1,info,name],
      after(function(results) {
        callback( { msg:"ok" });
      }));
  } else {
     callback( { msg:"fail" });
  }
};

exports.savestarbless = function(user, query, callback) {
  var info      = query.info || '';
  var name      = query.name || '';
  var roomid    = +query.roomid || 0;
  var idd       = +query.idd || 0;
  var teachid   = +query.teachid || 0;
  var day       = +query.day || 0;
  var jdays     = query.jdays || '';
  //console.log(query);
  if (day && idd && roomid && teachid) {
    client.query(
      "update calendar set teachid=$1, roomid=$2, day=$3, value=$4, name=$5 where id=$6 ", [teachid,roomid,day-1,info,name,idd],
      after(function(results) {
          client.query( "delete from calendar where courseid=$1 and eventtype='less' ",[idd],
              after(function(results) {
                if (jdays) {
                  var jds = jdays.split(',');
                  var jids = [];
                  for (var ii in jds) {
                    var jd = jds[ii];
                    jids.push( "("+jd+","+idd+",'less')" );
                  }
                  var jdvalues = jids.join(',');
                  client.query( "insert into calendar (julday,courseid,eventtype) values " + jdvalues,
                    after(function(results) {
                      callback( { msg:"ok" });
                    }));
                } else {
                  callback( { msg:"ok" });
                }
              }));
      }));
  } else {
     callback( { msg:"fail" });
  }
};

exports.teachstarb = function(elever,julday,starbreglist, callback) {
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

exports.regstarb = function(ip,user, query, callback) {
  // dual purpose: can be used to check if already registered
  // otherwise will attempt to register
  // the user need not be logged in
  var regkey    = +query.regkey     || 0;
  var userid    = +query.userid     || 0;
  var utz       = +query.utz        || 0;  // user timezone
  var resp = { fail:1, text:"error", info:"" };
  if (!starbsec.secure(userid)) {
      resp.text="dont spam";
      callback(resp);
      return;
  }

  regkey = Math.min(2100000000,regkey);  // just to avoid error in postgresql - int larger than maxint
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
          if (results && results.rows && results.rows[0]) {
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

exports.deletestarb = function(user,params,callback) {
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

exports.getstarb = function(user,params,callback) {
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

exports.genstarb = function(user,params,callback) {
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

  if (uid < 10000 || duration < 3 || duration > 80000 || starth < 11 || starth > 14 || startm < 0 || startm > 59 ) {
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

exports.getAttend = function(user,params,callback) {
  // returns a hash of attendance
  //console.log("getAttend");
  var uid = (user) ? user.id : 0;
  var all = params.all || false;
  if (all) { client.query(
      'select * from starb order by julday ' ,
      after(function(results) {
          var studs={}, daycount = {}, rooms={}, teach={}, klass={};
          if (results.rows) for (var i=0,k= results.rows.length; i < k; i++) {
            var att = results.rows[i];
            var stu = db.students[att.userid];

            if (!studs[att.userid]) {
              studs[att.userid] = [];
            }
            //studs[att.userid][att.julday -db.firstweek] = [att.teachid, att.roomid ];
            studs[att.userid].push((att.julday -db.firstweek)+','+att.teachid+','+ att.roomid );

            if (!daycount[att.julday]) {
              daycount[att.julday] = 0;
            }
            daycount[att.julday]++;

            // count pr klass
            if (stu && stu.department) {
                if (!klass[stu.department]) {
                  klass[stu.department] = {};
                }
                if (!klass[stu.department][att.julday]) {
                  klass[stu.department][att.julday] = 0;
                }
                klass[stu.department][att.julday]++;
            }

            if (!rooms[att.roomid]) {
              rooms[att.roomid] = {};
            }
            if (!rooms[att.roomid][att.julday - db.firstweek]) {
              rooms[att.roomid][att.julday - db.firstweek] = [];
            }
            rooms[att.roomid][att.julday - db.firstweek].push(att.userid);

            if (!teach[att.teachid]) {
              teach[att.teachid] = {};
            }
            if (!teach[att.teachid][att.julday - db.firstweek]) {
              teach[att.teachid][att.julday - db.firstweek] = [ att.roomid, [] ];
            }
            teach[att.teachid][att.julday - db.firstweek][1].push(att.userid);

          }
          db.daycount = daycount;
          db.klass = klass;
          for (var ss in studs) {
              studs[ss] = studs[ss].join(';');
          }
          for (var rr in rooms) {
              for ( var jj in rooms[rr]) {
                  rooms[rr][jj] = rooms[rr][jj].join(',');
              }
          }
          for (var tt in teach) {
              for ( var jt in teach[tt]) {
                  teach[tt][jt][1] = teach[tt][jt][1].join(',');
              }
          }
          callback( { studs:studs, daycount:daycount, rooms:rooms, teach:teach, klass:klass } );
      }));
  } else client.query(
      'select s.*, i.name from starb s inner join room i '
      + ' on (s.roomid = i.id) where userid=$1 order by julday ' ,[uid ],
      after(function(results) {
          if (results && results.rows)
            callback(results.rows);
          else
            callback(null);
      }));
}
