
/*
 * GET tests info, exams etc
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;
var tests = require('../backend/tests');


exports.alltests = function(req, res) {
    var justnow = new Date();
    if (addons.tests && ((justnow.getTime() - addons.update.tests.getTime())/60000 < 600  )  ) {
      res.send(addons.tests);
      var diff = (justnow.getTime() - addons.update.tests.getTime())/60000;
      //console.log("resending tests - diff = " + diff);
    } else {
        tests.getAllTests(function(prover) {
            addons.tests = prover;
            addons.update.tests = new Date();
            res.send(prover);
          });
    }
};
