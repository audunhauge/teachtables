
/*
 * GET plans, save plans
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;

var plans = require('../backend/plans');


exports.yyear = function(req, res) {
    // called when yearplan has been changed
    if (req.query.quick && db && db.yearplan) {
      var data = db.yearplan;
      data.teachers = db.teachers;
      data.students = db.students;
      data.roomnames = db.roomnames;
      data.start = db.startjd;
      res.send(data)
      //console.log("quick");
    } else 
    database.getyearplan(function(data) {
      db.yearplan = data;
      data.teachers = db.teachers;
      data.students = db.students;
      data.roomnames = db.roomnames;
      data.start = db.startjd;
      res.send(data);
    });
};


exports.getaplan = function(req, res) {
    plans.getAplan(req.query.planid,function(plandata) {
            res.send(plandata);
          });
};

exports.getallplans = function(req,res) {
    plans.getAllPlans(req.query.state,function(plandata) {
            res.send(plandata);
          });
};

exports.myplans = function(req, res) {
    plans.getMyPlans(req.session.user, function(myplans) {
        res.send(myplans);
    });
};

exports.modifyplan = function(req, res) {
    // create/update/delete a plan
    if (req.session.user && req.session.user.department == 'Undervisning' ) {
      database.modifyPlan(req.session.user,req.body,function(msg) {
         res.send(msg);
         if (req.body.operation == 'connect') delete addons.plans;
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }

};


exports.allplans = function(req, res) {
    // requery only if 10h since last query
    // we will refetch allplans if any of them have changed
    // - this we will know because the editor will fetch /saveplan
    // - /saveplan will then refetch allplans (after res.send )
    // thus allplans will mostly always be in memory
    var justnow = new Date();
    //console.log("allplans");
    if (addons.plans && ((justnow.getTime() - addons.update.plans.getTime())/60000 < 600  )  ) {
      res.send(addons.plans);
      //var diff = (justnow.getTime() - addons.update.plans.getTime())/60000;
      //console.log("resending allplans - diff = " + diff);
    } else {
      //console.log("fetching all plans");
      plans.getCoursePlans(function(plans) {
        addons.plans = plans
        addons.update.plans = new Date();
        res.send(plans);
      });
    }
};

exports.save_simple =  function(req, res) {
    // save a julday for yearplan or freedays
    if (req.session.user && req.session.user.department == 'Undervisning') {
      //console.log("User saved some data",req.body);
      database.savesimple(req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.saveblokk = function(req, res) {
    // save a block (all subjects belonging to a block have specific days set for tests)
    if (req.session.user && req.session.user.department == 'Undervisning') {
      //console.log("User saving block ",req.body);
      plans.saveblokk(req.session.user,req.body,function(msg) {
         res.send(msg);
         delete addons.blocks;
         delete addons.xtrax;
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.savehd = function(req, res) {
    // save a full day test
    if (req.session.user && req.session.user.department == 'Undervisning') {
      //console.log("User saving full day test",req.body);
      plans.savehd(req.session.user,req.body,function(msg) {
         res.send(msg);
         delete addons.exams;
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.save_fagplan = function(req, res) {
    // user has new data to push into a plan
    //console.log(req);
    if (req.session.user && req.session.user.department == 'Undervisning' 
         && req.body.uid == req.session.user.id) {
      //console.log("User saved som data ",req.body);
      plans.updateCoursePlan(req.body,function(msg) {
         res.send(msg);
         delete addons.plans;
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }

};

exports.save_totfagplan = function(req, res) {
    // several sections may be changed
    if (req.session.user && req.session.user.department == 'Undervisning') {
      //console.log("User saved som data");
      plans.updateTotCoursePlan(req.body,function(msg) {
         res.send(msg);
         delete addons.plans;
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.save_vurd = function(req, res) {
    // user has changed/created a test
    if (req.session.user && req.session.user.department == 'Undervisning') {
      plans.saveVurd(req.body,function(msg) {
         //console.log(msg);
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }

};


exports.extrax = function(req, res) {
    // ekstra exams - editor is based on block editor
    if (addons.xtrax) {
      res.send(addons.xtrax);
    } else plans.getBlocks('xtrax',function(xtrax) {
            addons.xtrax = xtrax;
            res.send(addons.xtrax);
          });
};

exports.blocks = function(req, res) {
    // blocks dont change much - reuse value
    if (addons.blocks) {
      res.send(addons.blocks);
    } else plans.getBlocks('blokk',function(blocks) {
            addons.blocks = blocks;
            res.send(addons.blocks);
          });
};



