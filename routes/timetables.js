
/*
 * GET timetables, save timetables
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;


exports.save_timetable = function(req, res) {
    // save a change of timetabledata
    // teachid,day,slot,value
    if (req.session.user && req.session.user.isadmin) {
      delete addons.timetable;
      database.saveTimetableSlot(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.timetables = function(req, res) {
    // timetables dont change much - reuse value
    var isad = req.query.reload && req.session.user && req.session.user.isadmin;
    if (addons.timetable) {
      res.send(addons.timetable);
    } else database.getTimetables(isad,function(timtab) {
            addons.timetable = timtab;
            res.send(addons.timetable);
          });
};

