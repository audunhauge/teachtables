
/**
 * Module dependencies.
 */

var version = '1.1.1';

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
db.roominfo = siteinf.roominfo;
db.days = siteinf.days;
db.slots = siteinf.slots;
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
console.log(db.version);


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
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(base+'stat',express.static(path.join(__dirname, 'public')));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


/*
*   ROUTES
*/
app.get(base,                           routes.index);                                // gives start-page
app.get(base+'/basic',                  routes.basic);              // get basic info - name of studs,teachers, timetables
app.get(base+'/getsql',                 routes.getsql);
app.get(base+'/freedays',               routes.freedays);
app.get(base+'/getexams',               routes.getexams);
app.get(base+'/plain',                  routes.plain);              // simplified overview
app.get(base+'/gateway',                routes.gateway);            // stripped kalendar for tests/yearplan

app.post(base+'/editcourse',             routes.editcourse);
app.post(base+'/edituser',               routes.edituser);
app.post(base+'/editgroup',              routes.editgroup);


// user - info login config
app.get(base+'/login',                  user.login);                // logg in
app.get(base+'/ses',                    user.ses);                  // get login info (check if logged in)

app.post(base+'/saveconfig',             user.saveconfig);


// workbook
app.get(base+'/workbook',               workbook.workbook);         // get selected workbook
app.get(base+'/getqcon',                workbook.getqcon);          // get questions from question-container
app.get(base+'/getcontainer',           workbook.getcontainer);     // get container info
app.get(base+'/displayuserresponse',    workbook.displayuserresponse);
app.get(base+'/wordindex',              workbook.wordindex);
app.get(base+'/getquestion',            workbook.getquestion);
app.get(base+'/gettags',                workbook.gettags);
app.get(base+'/gettagsq',               workbook.gettagsq);
app.get(base+'/getquesttags',           workbook.getquesttags);
app.get(base+'/getworkbook',            workbook.getworkbook);
app.get(base+'/update_subscription',    workbook.update_subscription);
app.get(base+'/gimmeahint',             workbook.gimmeahint);
app.get(base+'/exportcontainer',        workbook.exportcontainer );
app.get(base+'/copyquest',              workbook.copyquest );
app.get(base+'/progressview',           workbook.progressview );

app.post(base+'/generateforall',        workbook.generateforall );
app.post(base+'/renderq',               workbook.renderq);
app.post(base+'/gradeuseranswer',       workbook.gradeuseranswer);
app.post(base+'/editscore',             workbook.editscore);
app.post(base+'/editquest',             workbook.editquest);
app.post(base+'/editqncontainer',       workbook.editqncontainer);
app.post(base+'/studresetcontainer',    workbook.studresetcontainer);
app.post(base+'/resetcontainer',        workbook.resetcontainer );
app.post(base+'/changesubject',         workbook.changesubject );
app.post(base+'/edittags',              workbook.edittags );
app.post(base+'/settag',                workbook.settag );
app.post(base+'/updateTags',            workbook.updateTags );
app.post(base+'/addcomment',            workbook.addcomment );
app.post(base+'/getuseranswers',        workbook.getuseranswers);
app.post(base+'/crosstable',            workbook.crosstable);
app.post(base+'/updatecontainerscore',  workbook.updatecontainerscore );


// meetings - absent - reservations
app.get(base+'/getmeet',                meetings.getmeet );
app.get(base+'/getmeeting',             meetings.getmeeting );
app.get(base+'/rejectmeet',             meetings.rejectmeet );
app.get(base+'/acceptmeet',             meetings.acceptmeet );
app.get(base+'/reserv',                 meetings.reserv );
app.get(base+'/getabsent',              meetings.getabsent );
app.post(base+'/makereserv',            meetings.makereserv );
app.post(base+'/save_excursion',        meetings.save_excursion );
app.post(base+'/save_absent',           meetings.save_absent );
app.post(base+'/makemeet',              meetings.makemeet );




// plans
app.get(base+'/getaplan',               plans.getaplan );
app.get(base+'/getallplans',            plans.getallplans );
app.get(base+'/myplans',                plans.myplans );
app.get(base+'/allplans',               plans.allplans );
app.get(base+'/blocks',                 plans.blocks );
app.get(base+'/extrax',                 plans.extrax );
app.get(base+'/yyear',                  plans.yyear );
app.post(base+'/modifyplan',            plans.modifyplan );
app.post(base+'/save_simple',           plans.save_simple );
app.post(base+'/savehd',                plans.savehd );
app.post(base+'/saveblokk',             plans.saveblokk );
app.post(base+'/save_vurd',             plans.save_vurd );
app.post(base+'/save_totfagplan',       plans.save_totfagplan );
app.post(base+'/save_fagplan',          plans.save_fagplan );


// timetables
app.get(base+'/timetables',             timetables.timetables);
app.post(base+'/save_timetable',        timetables.save_timetable);


// tests - exams
app.get(base+'/alltests',               tests.alltests);            // all tests and exams for students
app.post(base+'/save_test',             tests.save_test );
app.get(base+'/savehd',                 plans.savehd );

// shows - tickets
// get shows and sell tickets
app.post(base+'/buytickets',            show.buytickets);
app.post(base+'/editshow',              show.editshow );
app.get(base+'/tickets',                show.tickets );
app.get(base+'/show',                   show.show );                  // get list of shows for this user

app.get(base+'/starb',                  starb.starb);                 // start page for study time
app.get(base+'/attendance',             starb.attendance );
app.get(base+'/starblessons',           starb.starblessons );
app.get(base+'/getallstarblessdates',   starb.getallstarblessdates);
app.get(base+'/getstarblessdates',      starb.getstarblessdates);
app.get(base+'/createstarbless',        starb.createstarbless);
app.get(base+'/savestarbless',          starb.savestarbless);
app.get(base+'/killstarbless',          starb.killstarbless);
app.get(base+'/elevstarb',              starb.elevstarb);
app.get(base+'/fjernelev',              starb.fjernelev);
app.get(base+'/regstud',                starb.regstud);
app.get(base+'/teachstarb',             starb.teachstarb);
app.get(base+'/starbkey',               starb.starbkey);
app.get(base+'/ipad ',                  starb.ipad );

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});




















/* just for some free space below last line */
