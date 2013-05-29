/*
 *  Database io for tests
 */

// get hold of database
var client = siteinf.client;
var julian = require('./julian');
var after = require('./utils').after;
var db = siteinf.database.db;

exports.getAllTests = function(callback) {
  // returns a hash of all tests --- same as db.prover,
  // used to populate db.prover
  // assumes you give it a callback that assigns the hash
  client.query(
      // fetch all tests
       'SELECT julday,shortname,cl.value, u.username FROM calendar cl '
       + '      INNER JOIN course c ON (c.id = cl.courseid) '
       + '      INNER JOIN users u ON (u.id = cl.userid) '
       + "      WHERE eventtype = 'prove' and julday >= " + db.firstweek + ' ORDER BY julday,value,shortname',
      after(function(results) {
          var prover = {};
          for (var i=0,k= results.rows.length; i < k; i++) {
              var prove = results.rows[i];
              var julday = prove.julday;
              delete prove.julday;   // save some space
              if (!prover[julday]) {
                prover[julday] = [];
              }
              prover[julday].push(prove);
          }
          callback(prover);
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

exports.saveTest = function(user,query,callback) {
  // update/insert test

  var jd  = query.idd.substring(3).split('_')[0];
  var day = query.idd.substring(3).split('_')[1];
  var julday = (+jd) + (+day);
  var courseid = db.courseteach[query.coursename].id;
  var tlist = (query.timer) ? query.timer : '';
  //console.log(tlist,julday,courseid,user);
  if (tlist == '') client.query(
          'delete from calendar where courseid = $1 and userid = $2 and eventtype=\'prove\' and julday= $3 ' , [ courseid,  user.id, julday ],
      after(function(results) {
              callback( {ok:true, msg:"deleted"} );
          }));
  else client.query(
        'select * from calendar where courseid = $1 and userid = $2 and eventtype=\'prove\' and julday= $3 ' , [ courseid,  user.id, julday ],
      after(function(results) {
          if (results.rows && results.rows[0]) {
              var test = results.rows.pop();
              //console.log(test);
              if (test.value != tlist) {
              client.query(
                  'update calendar set value=$1 where id=$2',[ tlist, test.id ],
                  after(function(results) {
                      callback( {ok:true, msg:"updated"} );
                  }));
              } else {
                callback( {ok:true, msg:"unchanged"} );
              }
          } else {
            //console.log("inserting new");
            client.query(
                'insert into calendar (courseid,userid,julday,eventtype,value) values ($1,$2,$3,\'prove\',$4)',[courseid, user.id, julday,tlist],
                after(function(results) {
                    callback( {ok:true, msg:"inserted"} );
                }));
          }
      }));
}
