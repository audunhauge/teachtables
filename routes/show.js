
/*
 * GET show,tickets, sell tickets
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;

var show = require('../backend/show');

exports.buytickets = function(req, res) {
    // user is selling tickets
    if (req.session.user ) {
      //console.log("User selling some tickets");
      show.selltickets(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }

};

exports.editshow = function(req, res) {
    // user changing/creating/deleting a show
    if (req.session.user) {
      show.editshow(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }

};

exports.tickets = function(req, res) {
    show.gettickets(req.session.user, req.query,function(tickets) {
            res.send(tickets);
          });
};

exports.show = function(req, res) {
    show.getshow(function(show) {
            res.send(show);
          });
};
