/*
 *   Get/Set show info
 */

// get hold of database
var client = siteinf.client;
var julian = require('./julian');
var after = require('./utils').after;
var db = siteinf.database.db;

exports.gettickets = function(user,query,callback) {
  // returns a hash of tickets for show
  // assumes you give it a callback that assigns the hash
  client.query(
      // fetch all shows
       'SELECT u.firstname,u.lastname,u.department,sho.name,ti.* from tickets ti inner join show sho '
       + 'on (sho.id = ti.showid) inner join users u on (u.id = ti.userid)',
      after(function(results) {
          var tickets = {};
          if (results && results.rows )
          for (var i=0,k= results.rows.length; i < k; i++) {
              var tick = results.rows[i];
              var julday = tick.jd;
              delete tick.jd;
              if (!tickets[julday]) {
                tickets[julday] = [];
              }
              tickets[julday].push(tick);
          }
          callback(tickets);
      }));
}

exports.getshow = function(callback) {
  // returns a hash of all shows
  // assumes you give it a callback that assigns the hash
  client.query(
      // fetch all shows
       'SELECT * from show order by name',
      after(function(results) {
          var showlist = {};
          if (results && results.rows)
          for (var i=0,k= results.rows.length; i < k; i++) {
              var show = results.rows[i];
              var userid = show.userid;
              var aut = show.authlist.split(',');
              if (!showlist[userid]) {
                showlist[userid] = [];
              }
              showlist[userid].push(show);
              for (var au in aut) {
                autid = aut[au];
                if (!showlist[autid]) {
                  showlist[autid] = [];
                }
                showlist[autid].push(show);

              }
          }
          callback(showlist);
      }));
}

exports.selltickets = function(user,query,callback) {
    //console.log(query);
    var today = new Date();
    var m = today.getMonth()+1; var d = today.getDate(); var y = today.getFullYear();
    var julday = julian.greg2jul(m,d,y);
    var showid = query.showid;
    var type = query.type;
    //console.log(query.accu);
    var accu = query.accu.split('|');
    var now = new Date();
    var jn = now.getHours()*100 + now.getMinutes();
    var values = [];
    for (var i in accu) {
        var elm = accu[i].split(',');
        values.push('('+showid+",'"+elm[0]+"',"+elm[1]+",'"+type+"',"+elm[2]+','+jn+','+julday+','+user.id+')' );
    }
    var valuelist = values.join(',');
    //console.log('insert into tickets (showid,showtime,price,kk,ant,saletime,jd,userid) values ' + values);
    client.query(
        'insert into tickets (showid,showtime,price,kk,ant,saletime,jd,userid) values ' + values,
        after(function(results) {
            callback( {ok:true, msg:"inserted"} );
        }));
}

exports.editshow = function(user,query,callback) {
    var action     = query.action;
    var showid     = query.showid;
    var name       = query.name;
    var showtime   = query.showtime;
    var pricenames = query.pricenames;
    var authlist   = query.authlist;
    var userid     = user.id;
    switch(action) {
      case 'test':
          console.log(action,showid,name,showtime,pricenames,authlist,userid);
          callback( {ok:true, msg:"tested"} );
          break;
      case 'update':
        client.query( 'update show set name=$1, showtime=$2,pricenames=$3,authlist=$4 where id=$5', [name,showtime,pricenames,authlist, showid],
            after(function(results) {
                callback( {ok:true, msg:"updated"} );
            }));
        break;
      case 'kill':
        client.query(
            'delete from show where id=$1', [ showid],
            after(function(results) {
                client.query(
                  'delete from tickets where showid=$1', [ showid],
                  after(function(results) {
                     callback( {ok:true, msg:"deleted"} );
                  }));
            }));
        break;
      case 'insert':
        client.query(
            'insert into show (name,showtime,pricenames,authlist,userid) values ($1,$2,$3,$4,$5)', [ name,showtime,pricenames,authlist,userid],
            after(function(results) {
                callback( {ok:true, msg:"inserted"} );
            }));
        break;
    }
}
