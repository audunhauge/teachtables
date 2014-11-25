
/**
 * Module dependencies.
 */

var version = '1.1.4';

var site = 'default';
var crypto = require('crypto');
var siteinf = {};
if (process.argv[2]) {
  site = process.argv[2];
} else {
  console.log("no site specified - using default, expecting connection error");
  console.log("Usage: node server.js sitename","\n make a copy of sites/default.js and edit");
  console.log(" you need to setup postgres (see setup-postgres.txt");
  console.log(" create/edit a lang file (public/javascripts/lang/mylang.js");
  console.log(" use node packet manager to install modules");
  console.log("   npm install ");
}

siteinf.timezone = 0;  // default timezone - overridden in sites
var nuinf = require('./sites/'+site+'.js');
for (var k in nuinf) {
   if (nuinf.hasOwnProperty(k)) {
         siteinf[k] = nuinf[k];
   }
}

GLOBAL.siteinf = siteinf;

var base = siteinf.base;
var mytitle = siteinf.title;
var schoolyear = siteinf.schoolyear;
var language = siteinf.language;
siteinf.version = version;


var database = require('./backend/database');
var db = database.db;
db.roominfo = siteinf.roominfo;  // restrictions on room reservations
db.romliste = siteinf.romliste;  // structured room list (by floor/building etc)
db.days = siteinf.days;
db.slots = siteinf.slots;
db.lessondur = siteinf.lessondur;                // 8 slots gives 40 minutes lesson
db.lessonstart = siteinf.lessonstart;            // just the start of lessons
db.starttime = siteinf.slotlabels.split(',');

siteinf.database = database;

var addons = {}
// extra data that we send AFTER the main page has been drawn
// this so that the page seems more responsive
addons.update = {};
// used to store time info for resources
// we refetch if the resource is stale
siteinf.addons = addons;

var express = require('express')
  , routes = require('./routes')
  , passport = require('passport')
  , SamlStrategy = require('./node_modules/passport-saml/lib/passport-saml/index').Strategy
  , meetings = require('./routes/meetings')
  , tests = require('./routes/tests')
  , workbook = require('./routes/workbook')
  , show = require('./routes/show')
  , starb = require('./routes/starb')
  , plans = require('./routes/plans')
  , user = require('./routes/user')
  , timetables = require('./routes/timetables')
  , http = require('http')
  , path = require('path');


var app = express();



var mydom = {};  // for each user - result of file import

var fs = require('fs');
//var sys = require('sys');
var exec = require('child_process').exec;

db.version = version;  // so that we can force reload of dynamic scripts
// they are a bugger to reload - must empty cache - reload dosn't do the trick
console.log("Version=",db.version,"Firstweek=",db.firstweek);


// check that we have a symlink for javascipt libraries
fs.stat('public/js/'+version,function(err,stat) {
  if (err) {
    fs.symlink('mylibs', 'public/js/' + version, function(err) {
      if (err) {
        console.log(err);
      }
    });
  }
});
// check that we have a symlink for css
fs.stat('public/css/'+version,function(err,stat) {
  if (err) {
    fs.symlink('.', 'public/css/' + version, function(err) {
      if (err) {
        console.log(err);
      }
    });
  }
});


app.configure(function(){
  app.set('port', siteinf.port || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.compress());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('anaglypsis'));
  app.use(express.session());
  app.use(app.router);
  app.use(base+'stat/pic',function(req,res,next) {
      if (req.url.match(/anonym.gif/)) {
        next();
      } else if (req.session && req.session.user && req.session.user.department === 'Undervisning') {
        next();
      } else {
        res.redirect( base+'stat/pic/anonym.gif');
      }
  });
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(base+'stat',express.static(path.join(__dirname, 'public')));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(function(req, res) {
     res.redirect( base+'stat/pic/anonym.gif');
  });
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


/*
*   ROUTES
*/

app.get(base +'/saml', function(req, res) {
  var target = req.query.target || '';
  res.redirect( 'http://'+ siteinf.domain +'/simplesaml/getlogin.php?target='+target);
  //res.redirect( 'http://'+ siteinf.domain +'/simplesaml/getlogin.php')
  //res.redirect( 'http://node.teachtables.net/simplesaml/getlogin.php')
});



app.get(base,                           routes.index);              // gives start-page
app.get(base+'/basic',                  routes.basic);              // get basic info - name of studs,teachers, timetables
app.get(base+'/getsql',                 routes.getsql);             // only admin can run any sql
app.get(base+'/freedays',               routes.freedays);
app.get(base+'/getexams',               routes.getexams);
app.get(base+'/log/plain',                  routes.plain);              // simplified overview
app.get(base+'/kurs',                   routes.kurs);               // even simpler simplified overview
app.get(base+'/gateway',                routes.gateway);            // stripped kalendar for tests/yearplan
app.get(base+'/log/geteuids',               routes.geteuids);           // ids for pics

app.post(base+'/log/editcourse',            routes.editcourse);
app.post(base+'/log/edituser',              routes.edituser);
app.post(base+'/log/editgroup',             routes.editgroup);


// user - info login config
app.get(base+'/log/login',              user.login);                // logg in
app.get(base+'/log/feide',                  user.feide);                // logg in with feide (simplesaml)
app.get(base+'/log/pict',                   user.pict);                 // get user picture
app.get(base+'/log/alive',                  user.alive);                // {alive:true} if logged in
app.get(base+'/log/ses',                    user.ses);                  // get login info for active users
app.get(base+'/log/userconfig',             user.userconfig);           // fresh read of config (used in config editor)
app.post(base+'/log/saveconfig',            user.saveconfig);


// workbook
app.get(base+'/log/workbook',               workbook.workbook);         // get selected workbook
app.get(base+'/log/getqcon',                workbook.getqcon);          // get questions from question-container
app.get(base+'/log/getcontainer',           workbook.getcontainer);     // get container info
app.get(base+'/log/displayuserresponse',    workbook.displayuserresponse);
app.get(base+'/log/wordindex',              workbook.wordindex);
app.get(base+'/log/getquestion',            workbook.getquestion);
app.get(base+'/log/gettags',                workbook.gettags);
app.get(base+'/log/gettagsq',               workbook.gettagsq);
app.get(base+'/log/getquesttags',           workbook.getquesttags);
app.get(base+'/log/getworkbook',            workbook.getworkbook);
app.get(base+'/log/update_subscription',    workbook.update_subscription);
app.get(base+'/log/gimmeahint',             workbook.gimmeahint);
app.get(base+'/log/exportcontainer',        workbook.exportcontainer );
app.get(base+'/log/copyquest',              workbook.copyquest );
app.get(base+'/log/updatequiz',             workbook.updatequiz );          // sync with parent/child
app.get(base+'/log/progressview',           workbook.progressview );
app.get(base+'/log/quizstats',              workbook.quizstats );           // average score pr tag
app.get(base+'/log/remarked',               workbook.remarked );            // list of remarked questions (by other teach)
app.get(base+'/log/scoresummary',           workbook.scoresummary );        // scores for each container for this user
app.get(base+'/log/questionstats',          workbook.questionstats );       // update average and count for each question -(average user score, count of answers)
app.get(base+'/log/quizconq',               workbook.quizconq);             // quiz competition between groups

app.post(base+'/log/generateforall',        workbook.generateforall );
app.post(base+'/log/renderq',               workbook.renderq);
app.post(base+'/log/gradeuseranswer',       workbook.gradeuseranswer);
app.post(base+'/log/editscore',             workbook.editscore);
app.post(base+'/log/editquest',             workbook.editquest);
app.post(base+'/log/editqncontainer',       workbook.editqncontainer);
app.post(base+'/log/studresetcontainer',    workbook.studresetcontainer);
app.post(base+'/log/resetcontainer',        workbook.resetcontainer );
app.post(base+'/log/changesubject',         workbook.changesubject );
app.post(base+'/log/edittags',              workbook.edittags );
app.post(base+'/log/settag',                workbook.settag );
app.post(base+'/log/updateTags',            workbook.updateTags );
app.post(base+'/log/addcomment',            workbook.addcomment );
app.post(base+'/log/getuseranswers',        workbook.getuseranswers);
app.post(base+'/log/crosstable',            workbook.crosstable);
app.post(base+'/log/updatecontainerscore',  workbook.updatecontainerscore );


// meetings - absent - reservations
app.get(base+'/log/getmeet',                meetings.getmeet );
app.get(base+'/log/getmeeting',             meetings.getmeeting );
app.get(base+'/log/rejectmeet',             meetings.rejectmeet );
app.get(base+'/log/acceptmeet',             meetings.acceptmeet );
app.get(base+'/log/reserv',                 meetings.reserv );
app.get(base+'/getabsent',              meetings.getabsent );
app.post(base+'/log/makereserv',            meetings.makereserv );
app.post(base+'/log/save_excursion',        meetings.save_excursion );
app.post(base+'/log/save_absent',           meetings.save_absent );
app.post(base+'/log/makemeet',              meetings.makemeet );




// plans
app.get(base+'/getaplan',               plans.getaplan );
app.get(base+'/getallplans',            plans.getallplans );
app.get(base+'/myplans',                plans.myplans );
app.get(base+'/allplans',               plans.allplans );
app.get(base+'/blocks',                 plans.blocks );
app.get(base+'/extrax',                 plans.extrax );
app.get(base+'/yyear',                  plans.yyear );
app.post(base+'/log/modifyplan',            plans.modifyplan );
app.post(base+'/log/save_simple',           plans.save_simple );
app.post(base+'/log/savehd',                plans.savehd );
app.post(base+'/log/saveblokk',             plans.saveblokk );
app.post(base+'/log/save_vurd',             plans.save_vurd );
app.post(base+'/log/save_totfagplan',       plans.save_totfagplan );
app.post(base+'/log/save_fagplan',          plans.save_fagplan );


// timetables
app.get(base+'/timetables',             timetables.timetables);
app.post(base+'/log/save_timetable',        timetables.save_timetable);


// tests - exams
app.get(base+'/alltests',               tests.alltests);            // all tests and exams for students
app.post(base+'/log/save_test',             tests.save_test );
app.get(base+'/log/savehd',                 plans.savehd );

// shows - tickets
// get shows and sell tickets
app.post(base+'/log/buytickets',            show.buytickets);
app.post(base+'/log/editshow',              show.editshow );
app.get(base+'/log/tickets',                show.tickets );
app.get(base+'/log/show',                   show.show );                  // get list of shows for this user

app.get(base+'/log/starb',                  starb.starb);                 // start page for study time
app.get(base+'/attendance',             starb.attendance );
app.get(base+'/starblessons',           starb.starblessons );
app.get(base+'/getallstarblessdates',   starb.getallstarblessdates);
app.get(base+'/getstarblessdates',      starb.getstarblessdates);
app.get(base+'/log/createstarbless',        starb.createstarbless);
app.get(base+'/log/savestarbless',          starb.savestarbless);
app.get(base+'/log/killstarbless',          starb.killstarbless);
app.get(base+'/log/elevstarb',              starb.elevstarb);
app.get(base+'/log/fjernelev',              starb.fjernelev);
app.get(base+'/log/regstud',                starb.regstud);
app.get(base+'/log/teachstarb',             starb.teachstarb);
app.get(base+'/log/starbkey',               starb.starbkey);
app.get(base+'/log/ipad ',                  starb.ipad );

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});




















/* just for some free space below last line */
