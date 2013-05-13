
/*
 * GET workbook and quiz
*/

var database = siteinf.database;
var db = database.db;
var addons = siteinf.addons;

var wb = require('../backend/workbook');

exports.workbook =  function(req,res) {
    if (req.session.user ) {
      wb.getworkbook(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.editqncontainer = function(req, res) {
    // insert/update/delete a question_container
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.editqncontainer(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.crosstable = function(req,res) {
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.crosstable(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }

}

exports.progressview = function(req, res) {
    // get progress rapport for this workbook
    if (req.session.user ) {
      wb.progressview(req.session.user,req.query,function(progress) {
         res.send(progress);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.editquest = function(req, res) {
    // insert/update/delete a question
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.editquest(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.edittags = function(req, res) {
    // insert/update/delete a tag
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.edittags(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.changesubject = function(req, res) {
    // change subject for list of question-ids
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.changesubject(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.settag = function(req, res) {
    // set tag for some questions
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.settag(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.updateTags = function(req, res) {
    // fresh list of tags for a question - drop old list
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.updateTags(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.gettags = function(req,res) {
    // returns all tags { teachid:[tag,..], ... }
    wb.gettags(req.session.user, req.query, function(data) {
        res.send(data);
      });
};

exports.gettagsq = function(req,res) {
    // returns all tags { teachid:[tag,..], ... }
    wb.gettagsq(req.session.user, req.query, function(data) {
        res.send(data);
      });
};

exports.getquesttags = function(req,res) {
    // returns all questions tagged with tagglist
    //  { tagname:{ teachid:[qid,..], .. }, .. }
    wb.getquesttags(req.session.user, req.query, function(data) {
        res.send(data);
      });
};

exports.gradeuseranswer = function(req, res) {
    // grade a user answer
    if (req.session.user ) {
      wb.gradeuseranswer(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user", restart:db.restart});
    }
};

exports.updatecontainerscore = function(req, res) {
    // update a container with new sum for contained questions
    if (req.session.user ) {
      wb.updatecontainerscore(req.session.user,req.body);
    }
};

exports.generateforall = function(req,res) {
    if (req.session.user && req.session.user.department == 'Undervisning' ) {
      wb.generateforall(req.session.user, req.body, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.renderq = function(req,res) {
    if (req.session.user ) {
      wb.renderq(req.session.user, req.body, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.studresetcontainer = function(req,res) {
    // a stud can reset his/her container
    wb.studresetcontainer(req.session.user, req.body, function(data) {
        res.send(data);
    });
};

exports.resetcontainer = function(req,res) {
    if ((req.session.user && req.session.user.department == 'Undervisning')) {
      wb.resetcontainer(req.session.user, req.body, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.exportcontainer = function(req,res) {
    if (req.session.user && req.session.user.department == 'Undervisning' ) {
      console.log("exporting container");
      wb.exportcontainer(req.session.user, req.query, function(data) {
        console.log("got data",data);
        var filename = req.query.container ;
        var containerdump = JSON.stringify(data);
        console.log("dumping this:",filename,containerdump);
        res.writeHead(200 , { "Content-Disposition": 'attachment; filename=container'+filename+'.txt', "Content-Type":'text' } );
        res.end( containerdump);
      });
    }
};


exports.gimmeahint = function(req,res) {
    if (req.session.user ) {
      wb.gimmeahint(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.getqcon = function(req,res) {
    if (req.session.user ) {
      wb.getqcon(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.displayuserresponse = function(req,res) {
    if ((req.query.uid && req.session && req.session.user && req.query.uid == req.session.user.id)
        ||  req.session && req.session.user && req.session.user.department == 'Undervisning' ) {
    // studs may get their own results - teach may see all
      wb.displayuserresponse(req.session.user,req.query.uid, +req.query.container, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.getuseranswers = function(req,res) {
    if (req.session.user ) {
      wb.getuseranswers(req.session.user, req.body, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.getcontainer = function(req,res) {
    if (req.session.user ) {
      wb.getcontainer(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.getquestion = function(req,res) {
    if (req.session.user && req.session.user.department == 'Undervisning' ) {
      wb.getquestion(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.copyquest = function(req,res) {
    if (req.session.user && req.session.user.department == 'Undervisning' ) {
      wb.copyquest(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.update_subscription = function(req,res) {
    if (req.session.user && req.session.user.department == 'Undervisning' ) {
      wb.update_subscription(req.session.user);
    }
    res.send(null);
};

exports.wordindex = function(req,res) {
    if (req.session.user && req.session.user.department == 'Undervisning' ) {
      wb.makeWordIndex(req.session.user, req.query, function(data) {
        res.send(data);
      });
    } else {
      res.send(null);
    }
};

exports.addcomment = function(req, res) {
    if (req.session.user) {
      wb.addcomment(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user"});
    }
};

exports.editscore = function(req, res) {
    // teacher is setting score for a question
    if (req.session.user && req.session.user.department == 'Undervisning') {
      wb.editscore(req.session.user,req.body,function(msg) {
         res.send(msg);
      });
    } else {
      res.send({ok:false, msg:"bad user"});
    }
};

