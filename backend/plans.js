/*
 *  Database io for plans
 */

// get hold of database
var client = siteinf.client;
var julian = require('./julian');
var after = require('./utils').after;
var lev    = require('./levenshtein');
var database = siteinf.database;
var db = database.db;



exports.getAllPlans = function(state,callback) {
  // returns a hash of all info for all plans
  // 0 == empty plans
  // 1 == updated plans
  // 2 == oldplans - for copying
  //console.log("getAllPlans",client);
  client.query(
        'select p.id as i,p.name as n,c.shortname as s, pe.name as pn,p.info as v from plan p '
      + ' inner join periode pe on (pe.id = p.periodeid) '
      + ' left outer join course c '
      + ' on (c.planid = p.id) where p.state in ( '+state+' ) order by p.name',
      after(function(results) {
        if (results) {
          callback(results.rows);
        } else {
          callback(null);
        }
      }));
}

exports.getMyPlans = function(user,callback) {
  // returns a hash of all plans owned by user
  client.query("select * from plan where userid = $1",[user.id],
  after(function(myplans) {
    // we have list of plans
    client.query("select c.* from course c inner join teacher t on (t.courseid = c.id) where t.userid = $1",[user.id],
    after(function(mycourses) {
      // we have list of courses
      callback({ plan:myplans.rows, course:mycourses.rows} );
    }));
  }));
  /*
  client.query(
      'select p.*, c.id as cid, c.shortname from plan p  '
      + ' left outer join course c on (c.planid = p.id) '
      + ' where p.userid = $1 ' , [user.id ],
      after(function(results) {
         if (results.rows)
          callback(results.rows);
         else
          callback(null);
      }));
      */
  database.getActiveWorkbooks();
}

exports.getCoursePlans = function(callback) {
    //console.log("getCoursePlans");
    client.query(
            'SELECT u.id, u.username, c.id as cid, u.institution '
          + ' ,c.shortname,w.sequence as section,w.plantext as summary '
          + '   FROM users u  '
          + '        INNER JOIN plan p ON (p.userid = u.id) '
          + '        INNER JOIN course c ON (c.planid = p.id) '
          + '        LEFT JOIN weekplan w ON (p.id = w.planid) '
          + " WHERE u.department = 'Undervisning' and w.plantext != '' order by w.sequence ",
          //+ '   ORDER BY u.institution,u.username,c.shortname,w.sequence ' ,
      after(function(results) {
          //console.log(results);
          var fliste = {}; 
          var compliance = {};  // is this a compliant teacher?
          var startdate   = 0;
          var numsections = 0;
          var prevsum = '';  // used to calc lev distance
          for (var i=0,k= results.rows.length; i < k; i++) {
            fag = results.rows[i];
            summary = (fag.summary) ? fag.summary : '';
            summary = summary.replace("\n",'<br>');
            summary = summary.replace("\r",'<br>');
            section = (fag.section) ? fag.section : '0';
            shortname = fag.shortname;
            username = fag.username;
            institution = fag.institution;
            //if (startdate == 0) startdate = fag.startdate;
            //if (numsections == 0) numsections = fag.numsections;
            if (!compliance[username]) {
                compliance[username] = {};
            }
            if (!compliance[username][shortname]) {
                compliance[username][shortname] = { sum:0, count:0 };
            }
            if (!fliste[institution]) {
                fliste[institution] = {};
            }
            if (!fliste[institution][username]) {
                fliste[institution][username] = {};
            }
            if (!fliste[institution][username][shortname]) {
                fliste[institution][username][shortname] = {};
            }
            fliste[institution][username][shortname][section] = summary;
            if (lev.lev(summary,prevsum) > 1) {
              compliance[username][shortname].sum += summary.length;
              compliance[username][shortname].count += (summary.length > 2) ? 1 : 0 ;
            }
            prevsum = summary;
          }
          var allplans = { courseplans:fliste, compliance:compliance, startdate:db.firstweek, numsections:0 };
          //console.log(allplans);
          callback(allplans);
          //console.log("got allplans");
      }));
}

exports.getAplan = function(planid,callback) {
  // returns a specific plan
  client.query(
      'select p.*,w.id as wid, w.sequence, w.plantext from plan p  '
      + ' inner join weekplan w on (w.planid = p.id) '
      + ' where p.id = $1 ' , [planid ],
      after(function(results) {
          if (results.rows) {
            var plan = {};
            if (results.rows[0]) { 
              plan.name = results.rows[0].name;
              plan.weeks = {};
              for (var i=0;i<48;i++) plan.weeks[''+i] = '';
              for (var i=0,k= results.rows.length; i < k; i++) {
                fag = results.rows[i];
                summary = fag.plantext || '';
                summary = summary.replace(/\n/g,'<br>');
                summary = summary.replace(/\r/g,'<br>');
                section = fag.sequence || '0';
                shortname = fag.shortname;
                plan.weeks[section] = summary;
              }
            }
          }
          callback(plan);
      }));
}


exports.shiftWeekPlan = function(user,query,callback) {
    // shift sequence numbers for weekplan up or down
    var up = query.up || false;
    var section = +query.section;
    var planid = +query.planid;
    if (user.department == 'Undervisning') {
      if (up == "true") {
        // move first element away so it doesnt get overwritten
        client.query("update weekplan set sequence = 99 where planid=$2 and sequence = $1", [section,planid], 
          after(function(results) {
           client.query("update weekplan set sequence = sequence - 1 where planid=$1 and sequence > $2",
                [ planid,section ], after(function(res) {
                      client.query("update weekplan set sequence = 47 where planid=$1 and sequence = 98", [planid], 
                        after(function(results) {
                            client.query("select * from weekplan where planid = $1",[planid],
                              after(function(results) {
                                  callback(results);
                                }));
                          }));
                }));
           }));
      } else {
         console.log("update weekplan set sequence = sequence + 1 where planid=$1 and sequence >= $2", [ planid,section ]);
         client.query("update weekplan set sequence = sequence + 1 where planid=$1 and sequence >= $2", [ planid,section ],
             after(function(res) {
                    console.log("update weekplan set sequence = $1 where planid=$2 and sequence = 48", [section,planid]);
                    client.query("update weekplan set sequence = $1 where planid=$2 and sequence = 48", [section,planid], 
                      after(function(results) {
                          client.query("select * from weekplan where planid = $1",[planid],
                            after(function(results) {
                                callback(results);
                              }));
                        }));
              }));
      }
    } else {
       callback(null);
    }
};

exports.updateTotCoursePlan = function(query,callback) {
  // update courseplan - multiple sections
  var updated = query.alltext.split('z|z');
  var usects = {};
  for (var uid in updated) {
      var u = updated[uid];
      var elm = u.split('x|x');
      var sectnum = elm[0],text=elm[1];
      text = text.replace(/&amp;nbsp;/g,' ');
      text = text.replace(/&nbsp;/g,' ');
      text = text.replace(/\n/g,'<br>');
      usects[+sectnum] = text;
  }
  var ok = true;
  var msg = '';
  var param;
  var sql;
  if (query.planid) {
    sql = 'select w.*,p.id as pid from plan p left join weekplan w on (p.id = w.planid) '
        + ' where p.id = $1 '; 
    param = query.planid;
  } else {
    sql = 'select w.*,p.id as pid from plan p left join weekplan w on (p.id = w.planid) '
        + ' inner join course c on (c.planid = p.id) '
        + ' where c.id = $1 '; 
    param = query.courseid;
  }
  //console.log(sql,param);
  client.query( sql , [ param ] ,
      after(function(results) {
          var planid = 0;
          var sections = (results) ? results.rows : [] ;
          for (var sid in sections) {
              var s = sections[sid];
              if (planid == 0) planid = s.pid
              if (usects[s.sequence]) {
                  if (usects[s.sequence] != s.plantext) {
                      // there is an update for this section and it differs from dbase
                      // we must update this section
                      //console.log('update weekplan set plantext=$1 where id=$2',[ usects[s.sequence], s.id ]);
                      client.query(
                          'update weekplan set plantext=$1 where id=$2',[ usects[s.sequence], s.id ],
                          after(function(results) {
                          }));
                  }
              }
          }
          client.query( 'update plan set state=1 where id=$1',[ planid ],
              after(function(results) {
                callback( { ok:ok, msg:msg } );
          }));
      }));
}

exports.saveVurd = function(query,callback) {
  var pid = query.planid
  var value = query.value;
  //console.log( 'update plan set info = $1 where id= $2 ', value,pid);
  client.query(
      'update plan set info = $1 where id= $2 ', [value,pid],
      after(function(results) {
          callback( {ok:true, msg:"updated"} );
      }));

}

exports.savehd = function(user,query,callback) {
    //console.log(query,user.id);
    var jd = query.myid;
    var val = query.value;
    var fag = query.fag;
    var klass = query.klass || 0;  // save whole day test as half day test if != 0
    var kill = query.kill;
    var pid = query.pid;
    if (kill) {
      var elm = pid.split('_');
      fag = elm[1];
      jd = elm[0].substr(2);
      //console.log(fag,jd);
      //console.log("delete from calendar where eventtype=\'heldag\' and name='"+fag+"' and julday="+jd);
    }
    client.query( 'delete from calendar where eventtype=\'heldag\' and name=$1 and julday= $2 ' , [ fag , jd ]);
    if (kill)  {
       //console.log("deleted an entry");
       delete db.heldag[jd][fag];
       callback( {ok:true, msg:"deleted"} );
       return;
    }
    var itemid = 0;
    // see if we have a room name in the text
    // if there is one, then get the itemid for this room
    // and set the value for itemid
    var rids = [];  // turns out we may reserve several rooms for an exam
    var elm = val.split(/[ ,]/g);
    for (var i in elm) {
      var ee = elm[i].toUpperCase();
      if ( db.roomids[ee] ) {
        // we have found a valid room-name
        rids.push(db.roomids[ee]);
        itemid = db.roomids[ee];
      }
    }
    if (itemid == 0) {
      rids = [0];
    }
    for (var i=0; i<rids.length; i++) {
      itemid = rids[i];
      client.query(
        'insert into calendar (julday,name,value,roomid,courseid,userid,eventtype,class)'
        + " values ($1,$2,$3,$4,3745,2,'heldag',$5)" , [jd,fag,val,itemid,klass],
        after(function(results) {
            if (!db.heldag[jd]) {
              db.heldag[jd] = {};
            }
            db.heldag[jd][fag] = val;
        }));
    }
    callback( {ok:true, msg:"inserted"} );
}

exports.saveblokk = function(user,query,callback) {
    //console.log(query,user.id);
    var jd = query.myid;
    var val = query.value;
    var blokk = query.blokk;
    var kill = query.kill;
    var etype = query.etype || 'blokk';
    if (kill) {
      //console.log('delete from calendar where eventtype=\'blokk\' and name=\''+blokk+'\' and julday='+jd);
    }
    client.query( "delete from calendar where eventtype=$3 and name=$1 and julday= $2 " , [ blokk , jd, etype ]);
    if (kill)  {
       //console.log("deleted an entry");
       callback( {ok:true, msg:"deleted"} );
       return;
    }
    client.query(
        "insert into calendar (julday,name,value,roomid,courseid,userid,eventtype)"
        + " values ($1,$2,$3,0,3745,2,$4)" , [jd,blokk,val,etype],
        after(function(results) {
            callback( {ok:true, msg:"inserted"} );
        }));
}



exports.getBlocks = function(etype,callback) {
  // returns a hash of all blocks (slots for tests for all courses in a block)
  // the first to digits in groupname gives the block
  // this should be changed to a property of a course
  client.query(
      "select id,julday,name,value from calendar where value != ' ' and eventtype = '"+etype+"' ",
      after(function(results) {
          var blocks = {};
          for (var i=0,k= results.rows.length; i < k; i++) {
              var res = results.rows[i];
              var julday = res.julday;
              delete res.julday;   // save some space
              if (!blocks[julday]) {
                blocks[julday] = [];
              }
              blocks[julday].push(res);
          }
          callback(blocks);
          //console.log(blocks);
      }));
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

exports.updateCoursePlan = function(query,callback) {
  // update courseplan for given section
  //console.log(query);
  var param;
  var sql;
  if (query.planid) {
    sql = 'select w.*,p.id as pid from plan p left join weekplan w on (p.id = w.planid) '
        + ' where p.id = $1 '; 
    param = query.planid;
  } else {
    sql = 'select w.*,p.id as pid from plan p left join weekplan w on (p.id = w.planid) '
        + ' inner join course c on (c.planid = p.id) '
        + ' where c.id = $1 '; 
    param = query.courseid;
  }
  //console.log(sql,param)

  client.query( sql , [ param ],
      after(function(results) {
          var planid = 0;
          var wanted = null;
          if (results.rows) for (var si in results.rows) {
            var sect = results.rows[si];
            if (planid == 0) planid = sect.pid;
            if (sect.sequence == query.section) {
              wanted = sect;
              break;
            }
          }
          if (wanted) {
            if (wanted.plantext != query.summary) {
              client.query(
                  'update weekplan set plantext=$1 where id=$2',[ query.summary, wanted.id ],
                  after(function(results) {
                      callback( {ok:true, msg:"updated"} );
                  }));
            } else {
                callback( {ok:true, msg:"unchanged"} );
            }
          } else {
            //console.log('insert into weekplan (planid,sequence,plantext) values ($1,$2,$3)', [planid,query.section,query.summary]);
            client.query(
                'insert into weekplan (planid,sequence,plantext) values ($1,$2,$3)', [planid,query.section,query.summary],
                after(function(results) {
                    callback( {ok:true, msg:"inserted"} );
            }));
          }
          client.query( 'update plan set state=1 where id=$1',[ planid ],
              after(function(results) {
          }));
      }));
}
