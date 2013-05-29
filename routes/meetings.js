
/*
 * GET meeting info, reservations, excursions, absent
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;

exports.makemeet = function(req, res) {
    // make a meeting
    if (req.session.user && req.session.user.department == 'Undervisning') {
      database.makemeet(req.session.user,req.body,req.headers.host,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }

};

exports.getmeet = function(req, res) {
    // returns list of users signed on to meetings (with meet info)
    database.getmeet(function(meetings) {
            var data = { meetings:meetings, roomnames:db.roomnames };
            res.send(data);
          });
};

exports.getmeeting =  function(req, res) {
    // return list of meetings (not users signed on to a meeting)
    // this is the tie together for a set of meets (participants)
    database.getmeeting(function(meets) {
            res.send(meets);
          });
};

exports.rejectmeet = function(req, res) {
    database.changeStateMeet(req.query,3,function(data) {
      if (data.rows && data.rows[0]) {
        res.send('ok - rejected');
      } else {
        res.send('invalid meeting info - does this meeting still exist?');
      }
    });
};

exports.acceptmeet = function(req, res) {
    database.changeStateMeet(req.query,2,function(data) {
      if (data.rows && data.rows[0]) {
        res.send('ok - accepted');
      } else {
        res.send('invalid meeting info - does this meeting still exist?');
      }
    });
};


exports.reserv = function(req, res) {
    // get all reservations
    // they are expected to change often
    // only get reservations that are ! in the past
        database.getReservations(function(data) {
            res.send(data);
          });
};


exports.makereserv = function(req, res) {
    // reserv a room
    if (req.session.user && req.session.user.department == 'Undervisning') {
      //console.log("teacher reserving a room");
      database.makereserv(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.save_excursion = function(req, res) {
    // save excursion for given jday - slots
    // and given set of students
    /*
      var idd  = query.jd.substr(3);
      var jd = idd.split('_')[0];
      var day = idd.split('_')[1];
      var text = query.value;
      var name = query.name;
      var userid = query.userid;
      var klass = query.klass;
    */
    if (req.session.user && req.body.userid == req.session.user.id && req.session.user.department == 'Undervisning') {
      console.log("Teacher saving an excursion");
      var userlist = req.body.userlist;
      console.log(req.body);
      var rmsg = {ok:true, msg:""};
      var ulist = userlist.split(',');
      function stuffit(msg) {
          var us = ulist.pop();
          if (+us > 0) {
            req.body.userid = +us;
            database.saveabsent(req.session.user,req.body,stuffit);
          } else {
             delete addons.absent;
             res.send({ok:true, msg:"doneitall"});
          }
      };
      stuffit();
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.save_absent = function(req, res) {
    // save absent for given jday - slots
    if ((req.session.user && req.body.userid == req.session.user.id ) || req.session.user && req.session.user.isadmin ) {
      //console.log("User saved some data");
      database.saveteachabsent(req.session.user,req.body,function(msg) {
         res.send(msg);
         delete addons.absent;
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};


exports.getabsent = function(req, res) {
    // get absent list
        database.getabsent(req.query, function(absent) {
            addons.absent = absent;
            addons.update.absent = new Date();
            res.send(absent);
          });
};

