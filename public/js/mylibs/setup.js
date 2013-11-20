// set up global vars
// and connect event-handlers
// all functions must be defined before we load this file


var $j = jQuery.noConflict();
var database;           // jSON data
var brukerliste = {};   // brukerliste[elev,teach,klasse]
var valg;               // siste valg (teach,elev,klasse,sammensatt)
var fagenemine = [];    // for teach this is a list of courses owned
var inlogged = false;   // easy test for logged in (not related to security - just to menues shown)
var superbus = false;   // are we superbus
var plannames;          // list of logged in users plans (assumed to be teach - only used if so)
                        // { 'name':pid, ... }

var attend;             // attendance for logged in user - simple select * from starbreg where userid=?
var allattend;          // attendance for all students
var meetings;           // meetings for teachers

var usersonline = '';   // logged in users with session active


var showyear = 0;       // used to choose school year to show
    // can show this or next school year
    // changing showyear influences yearplan mostly
    // timetables and courseplans are not affected as they are not known yet
    // the system only has yearplans/timetables for current year
    // older courseplans are stashed in separate table (oldplans)
    // at startup will always be 0 == thisyear
    // can be changed to 1 == next year

var user = Url.decode(gup("navn"));
var its = Url.decode(gup("its"));
var currentloc = mybase+"?navn="+user;  // current location - used by popstate and others
var action = gup("action") || 'default';   // brukes i switch til å velge alternative visninger
var getdom = gup("getdom") || null;        // hent importert fil fra server
var page;                                  // brukes som adresse for valgt side, history
for (page in $j.deparam.fragment()) {
  break;  // the page is the key in the returned object
}
var showplan  = gup("plan") || '';         // dersom ?plan=3it5_3402 da vises denne planen
   // egen var for denne slik at linken blir så kort som mulig
   // brukes til å legge inn link fra itslearning

var dager = ss.dayheads.split(" ");
var eier;               // eier av siste timeplan (navn osv)

var show = {};   // list over all shows indexed by userid

var myplans = null;   // my very own plans (I'm a teacher)
var timetables = null;
var timeregister = {};
// timeregister lagrer timeplaner slik at de kan vises
// samlet. Alle timeplanvisere kan push/pop på denne

var absent = {};
// all teachers who are absent (from current day)
// and all students
// also solo - tests for students
// {  julday:{ userid:{id,klass,name,value,eventtype }, ..}, ... }
// if klass != 0 then this is id of teach who takes studs on trip

var valgtPlan;          // husker på den sist viste planen
var memberlist;         // liste over medlemmer i hver gruppe
var memgr;              // liste over grupper en elev er medlem av

var heldag;
var teachers;
var students;
var reservations;       // all reservations (future) for rooms
var id2elev;            // konverterer fra id til elevinfo
var isteach = false;    // a flag to decide if we should
  // bother displaying extra menues for a _presumed_ teacher -
  // the real test is done in php on submit
  // this is just a convenience

var isadmin = false;    //  display admin menues?
var popmemoizer = {};
var userinfo = {};
var memothisweek = '';  // remember timetable for this week (this user)

var fagplaner;          // mine fagplaner
var allefagplaner;      // alle fagplaner courseplans[avdeling][teach][fag] (pr lærer)
var courseplans = null; // courseplans[course]

var planinfo;           // planid -> info (vurdering)
var cpinfo;             // courseid -> planid

var siste10 = {}        // husk 10 siste timeplaner

var alleprover;         // lagrer data om alle prøver for alle elever
var blocks;             // slots for entering tests for courses that belong to a block

var fullname;           // lagrer fagnavn delen av gruppenavnet - fullname["3403"] = "3inf5"
var category;           // 3inf5:4, 2SCD5:10
var fagautocomp;        // liste over alle gyldige fagnavn - brukes til autocomplete
var linktilrom = [];    // liste over alle rom
var mysubscript = [];   // subscription menu
var subscriptlist = {}; // the chosen subscriptions

var promises = {};      // hash of promises that functions may fulfill when they have recieved data

var romliste = {};      // structured list of rooms - grouped by floor,building etc - defined in sites/sitename.js
var allrooms = [];      // straight list of all room names

$j(window).bind('hashchange', function(event) {
         var state = $j.bbq.getState();
         var s;
         for (var k in state) {
           s = k;
           break;
         }
         page = s;
         gotoPage();
    });

function unflatreserv(data) {
  var id,userid,day,slot,courseid,roomid,name,value,eventtype,res,jd,i,k,elm;
  var ret = {};
  for (jd in data) {
    res = data[jd];
    var lis = [];
    for (i=0,k= res.length; i < k; i++) {
       elm = res[i].split(',');
       lis.push( { id:elm[0],userid:elm[1],day:elm[2],slot:elm[3],courseid:elm[4],roomid:elm[5],name:elm[6],value:elm[7],eventtype:elm[8] } );
    }
    ret[jd] = lis;
  }
  return ret;
}

function expandatt(att) {
    // expand attendance
    var ret = { studs:{}, daycount:att.daycount, rooms:{}, teach:{} , klass:att.klass };
    for (var st in att.studs) {
        var list = att.studs[st].split(';');
        ret.studs[st] = {};
        for (var di in list) {
            var dat = list[di].split(',');
            ret.studs[st][ +dat[0] + +database.firstweek] = [ dat[1],dat[2] ];
        }
    }
    for (var rr in att.rooms) {
        var list = att.rooms[rr];
        ret.rooms[rr] = {};
        for (var jj in list) {
            var dat = list[jj].split(',');
            ret.rooms[rr][ +jj + +database.firstweek] = dat;
        }
    }
    for (var rr in att.teach) {
        var list = att.teach[rr];
        ret.teach[rr] = {};
        for (var jj in list) {
            var dat = list[jj];
            ret.teach[rr][ +jj + +database.firstweek] = { room:dat[0],studs:dat[1].split(',')};
        }
    }
    return ret;
}



function teaches(uid,coursename) {
  // returns true if uid is a teacher in coursename
  if (database.courseteach && database.courseteach[coursename]) {
    if (database.courseteach[coursename].teach.indexOf(uid) >= 0) {
      return true;
    }
  }
  return false;
}

function toggle_year() {
  showyear = (showyear == 0) ? 1 : 0;
  var jyy = (showyear == 0) ? database.firstweek : database.nextyear.firstweek ;
  var greg = julian.jdtogregorian(jyy);
  $j("#yyear").html(""+greg.year+'-'+(+greg.year+1));
  if (promises.toggle_year) {
    // redisplay with new year
    promises.toggle_year();
  }
}

function gotoPage() {
  // all menue-choices have their own address (so that history and bookmarks can work)
  // we also push all pages into history so that history rewind works
  // A page has address like this:  page=mainmenu/submenu/subsub
  // page=aarsplan/denneuka
  // page=plans/3inf5
  // page=tests/3inf5
  // page=timeplan/elev/eid
  // page=timeplan/teach/eid
  // page=timeplan/gruppe/gr
  // page=timeplan/klasse/klassenavn
  // page=timeplan/room/roomname
  // page=edit/aarsplan
  // page=edit/fridager
  // page=quiz
  if (page) {
    var element = page.split('/');
    var main = element.shift();
    switch (main) {
      case 'quiz':
        $j.get(mybase+'/getdom',function(data) {
          wbinfo = data;
          edqlist();
        });
        break;
      case 'plans':
        var fagnavn = element.shift();
        if (fagnavn) {
          fagnavn = fagnavn.toUpperCase();
          if (courseplans) {
            var plandata = courseplans[fagnavn];
            action = 'showpage';
            visEnPlan(fagnavn,plandata,false);
          } else {
            if (!promises.allplans) promises.allplans = [];
            promises.allplans.plans = function() { action = 'showpage'; visEnPlan(fagnavn,plandata,true); };
          }
        }
        break;
      case 'tests':
        var fagnavn = element.shift();
        if (fagnavn) {
          fagnavn = fagnavn.toUpperCase();
          var plandata = courseplans[fagnavn];
          if (plandata) {
            action = 'showpage';
            edit_proveplan(fagnavn,plandata);
          } else {
            if (!promises.allplans) promises.allplans = [];
            promises.allplans.tests = function() { action = 'showpage'; edit_proveplan(fagnavn,courseplans[fagnavn]); };
          }
        }
        break;
      case "thisweek":
        show_thisweek();
        break;
      case "hdtest":
        show_heldag();
        break;
      case "timeplan":
        var target = element.shift();
        var usr = element.shift();
        action = 'showpage';
        //var s="<div id=\"timeviser\"><h1>Gruppe-timeplaner</h1>";
        // usr will be idnumber for teach/stud
        //     else name of group/klass/room
        switch(target) {
            case 'group':
            case 'klass':
            case 'room':
                if (timetables && timetables.teach) {
                  var userplan = getcourseplan(usr,deltamemory);
                  vis_timeplan_helper(userplan,usr,target,false,false,deltamemory);
                } else {
                  $j.getJSON(mybase+ "/timetables",
                    function(data) {
                        timetables = unflatten(data.flatlist);
                        updateFagplanMenu();
                        var userplan = getcourseplan(usr,deltamemory);
                        vis_timeplan_helper(userplan,usr,target,false,false,deltamemory);
                    });
                }
                break;
            case 'teach':
            case 'stud':
                if (+usr == 0) {
                  usr = userinfo.id || 0;
                }
                if (timetables && timetables.teach) {
                  var userplan = getuserplan(+usr);
                  vis_timeplan_helper(userplan,+usr,target,'isuser',true,deltamemory);
                } else {
                  $j.getJSON(mybase+ "/timetables",
                    function(data) {
                        timetables = unflatten(data.flatlist);
                        updateFagplanMenu();
                        var userplan = getuserplan(+usr);
                        vis_timeplan_helper(userplan,+usr,target,'isuser',true,0);
                    });
                }
                break;
            default:
                break;
        }
        break;
      default:
        break;
    }

  }
}


function take_action() {
    // decide what to show at startup based on action parameter
    if (showplan) { action = 'plan'; }
    switch(action) {
        case 'raad':
            valg = 'teach';
            url = "aarsplan/php/gettimeplan.php";
            $j("#main").html('<div id="timeplan"></div>');
            filter = 'RAD';
            $j("#htitle").html("Timeplan for Wenche Mack");

            // vis wenche
            vis_valgt_timeplan({ id:1343, username:"Wench Mack"},url,filter);

            var s =   '<li class="current"><a href="#">Rådgivere</a></li>'
                    + '<li><a id="dahi" href="#">Hilde Dalen</a></li>'
                    + '<li><a id="hasi" href="#">Sigmund Hauge</a></li>'
                    + '<li><a id="mawe" href="#">Wenche Mack</a></li>';
            $j("#nav").html(s);

            $j("#mawe").click(function(event) {
                $j("#htitle").html("Timeplan for Wenche Mack");
                event.preventDefault();
                vis_valgt_timeplan({ id:1343, username:"Wench Mack"},url,filter);
            });
            $j("#hasi").click(function(event) {
                $j("#htitle").html("Timeplan for Sigmund Hauge");
                event.preventDefault();
                vis_valgt_timeplan({ id:1358, username:"Sigmund Hauge" },url,filter);
            });
            $j("#dahi").click(function(event) {
                $j("#htitle").html("Timeplan for Hilde Dalen");
                event.preventDefault();
                vis_valgt_timeplan({ id:1328, username:"Hilde Dalen" },url,filter);
            });

            break;

        case 'reload':
            // after login - don't do anything
            break;
        case 'login':
            // go to the login page
            get_login();
            break;

        case 'plan':
            if (showplan != '') {
                 $j.getJSON(mybase+ "/timetables",
                    function(data) {
                        timetables = unflatten(data.flatlist);
                        getcourseplans();
                    });

            }
        case 'default':
        default:
            if (isteach) {
                setup_teach();
            }
            gotoPage();
            break;
    }
}

// fetch userlist and do some more setup

var alreadyappended = false;   //menus already expanded for logged in user
var zombie = 0;
var interval = 30000;
function aliveordead() {
    $j("#alive").removeClass("green dead");
    zombie++;
    if (zombie > 4) {
        $j("#alive").addClass("dead");
    }
    $j.get(mybase+"/alive", function(ali) {
        zombie = 0;
        if (ali.alive == "true") {
            $j("#alive").addClass("green");
        } else {
            $j("#alive").removeClass("green");
        }
    });
}
var alivefun;

function relax(interv) {
    // change frequency of alive test - while editing we are always checking (5-10 s)
    // else just relax and test twice a minute
    clearInterval(alivefun);
    if (isteach && inlogged) {
      alivefun = window.setInterval(aliveordead, interv);
    }
}

function setup_teach() {
    if (alreadyappended) return;
    alreadyappended = true;
    $j("#htitle").append('<div id="alive" class="green"><span id="dead">Server may be asleep ... </span></div>');
    relax(30000);
    var romvalg = '<ul>';
    romvalg += '<li><a id="ledigrom" href="#">'+ss.setup.freeroom+'</a></li>';
    var ii=0; // so we can have link for rooms under several different headings
    for (var i in romliste) {
        var etasje = romliste[i];
        var head = (i.length < 3) ? i + 'xx' : i;
        romvalg += '<li><a href="#">' + head + '</a><ul>';
        for (var j =0; j< etasje.length; j++) {
            var rom = etasje[j];
            romvalg += '<li><a id="rom'+rom+'_'+ ii +'" href="#">'+rom+'</a></li>';
            linktilrom.push(rom+'_'+ii);
            ii++;
        }
        romvalg += '</ul></li>';
    }
    romvalg += '<li><a id="resrapp" href="#">'+ss.setup.rapport+'</a></li>';
    romvalg += '</ul>';

    // prepare for subscriptions
    if (! teachers) {
        teachers = database.teachers;
    }
    var subscript = '<ul>';
    var minefag = database.teachcourse[userinfo.id] ? database.teachcourse[userinfo.id].join(' ') : '';
    var myown = database.subscribe.teachers[userinfo.id];
    var usedup = {};  // so we dont get two divs with same id
    function buildSubscript(limited) {
        var suru = '';
        for (var i in database.subscribe.subjects) {
            var i_teach_this = (minefag.indexOf(i) >= 0);
            if (!limited && !i_teach_this && (!myown || myown.indexOf(i) < 0)) continue;
            var su = database.subscribe.subjects[i];
            if (su.length == 1 && su[0] == userinfo.id) continue;
            if (usedup[i]) continue;
            usedup[i] = 1;
            suru += '<li><a href="#">' + i + '</a><ul>';
            for (var j =0; j< su.length; j++) {
                var cla = '';
                var te = su[j];
                if (te == userinfo.id) continue;
                var tea = teachers[te] || { firstname:'',lastname:'' };
                var teaname = tea.firstname.caps();
                if (subscriptlist[te] && subscriptlist[te][i]) {
                    // we subscribe - mark with n2
                    cla = ' class="n2" ';
                }
                suru += '<li><a id="suru'+te+'_'+i+'" href="#" '+cla+'>'+teaname+'</a></li>';
                mysubscript.push(te+'_'+i);
            }
            suru += '</ul></li>';
        }
        return suru;
    }
    var subscript  = '<ul>' + buildSubscript(0) + '</ul>';
    var csubscript = '<ul>' + buildSubscript(1) + '</ul>';
    $j("#subscribe").after(subscript);
    $j("#csubscribe").after(csubscript);
    $j.get(mybase+ "/update_subscription");

    var s = '<li><a id="romres" href="#">'+ss.setup.reserv+'</a>'+romvalg+'</li>'
           + ''; // + '<li><a id="starb" href="#">Starb</a></li>';
    if (isadmin) {
        s +=  '<li><a id="rediger" href="#">'+ss.edit+'</a><ul>'
            +    '<li><a id="edfridager"     href="#">'+ss.setup.freedays+'</a></li>'
            +    '<li><a id="edaarsplan"     href="#">'+ss.setup.yearplan+'</a></li>'
            +    '<li><a id="edblokk"        href="#">'+ss.setup.blockform+'</a></li>'
            +    '<li><a id="xtrax"          href="#">'+ss.setup.xtrax+'</a></li>'
            +    '<li><a id="edexcurs"       href="#">'+ss.setup.excursions+'</a></li>'
            +    '<li><a id="edsolo"         href="#">'+ss.setup.singular+'</a></li>'
            +    '<li><a id="starbkurs"      href="#">'+ss.setup.starbcourse+'</a></li>'
            +    '<li><a id="teachabsent"    href="#">'+ss.setup.absteach+'</a></li>'
            +    '<li><a id="edcourse"       href="#">'+ss.setup.manager+'</a></li>'
            +    '<li><a id="makeplans"      href="#">'+ss.setup.createplans+'</a></li>'
            + '</ul></li>';
    } else if (isteach) {
        s +=  '<li><a id="rediger" href="#">'+ss.edit+'</a><ul>'
            +    '<li><a id="edexcurs"       href="#">'+ss.setup.excursions+'</a></li>'
            +    '<li><a id="edsolo"         href="#">'+ss.setup.singular+'</a></li>'
            +    '<li><a id="makeplans"      href="#">'+ss.setup.createplans+'</a></li>'
            + '</ul></li>';
    }
    $j("#seek").html('<span id="heat"><span class="label">'+ss.setup.seek+':'
        + '</span><input id="seeker" class="seeker" type="text" value="" size="8"></span>');
    $j("#heat").hover(function(event) {
          $j("#seeker").focus();
        });
    $j("#seeker").keypress(function(event) {
        if (event.keyCode == "13") {
            event.preventDefault();
            window.location = mybase+'?navn='+$j("#seeker").val();
        }
    });
    // legg inn clickhandler for alle rom
    // hent reserveringer for rommene
    $j.getJSON(mybase+ "/myplans",
      function(data) {
        myplans = {};
        for (var i in data) {
           var p = data[i];
           if (p.shortname) {
             myplans[p.shortname] = p;
           } else {
             myplans[p.name] = p;
           }
        }
      });
    // fetch current users
    $j.getJSON(mybase+ "/ses",
      function(data) {
        online = [];
        for (var i in data) {
           var au = data[i];
           var jn = new Date();
           var ti = new Date(+au.time);
           var min = ti.getMinutes();
           min = (+min < 10) ? '0'+min : min;
           online.push(au.firstname.caps() + " " + au.lastname.caps()+ " " + ti.getHours()  + ":" + min);
        }
        usersonline = online.join(', ');
      });

    $j.getJSON(mybase+ "/reserv",
         function(data) {
            $j("#nav").append(s);
            $j("#ledigrom").click(function() {
                findfree();
            } );
            reservations = unflatreserv(data);
            for (var k=0; k < linktilrom.length; k++) {
                var rom = linktilrom[k];
                $j("#rom"+rom).click(function() {
                    var idd = $j(this).attr("id");
                    idd = idd.substr(3).split('_')[0];
                    rom_reservering(idd);
                } );
            }
            for (var k=0; k < mysubscript.length; k++) {
                var su = mysubscript[k];
                $j("#suru"+su).click(function() {
                    var idd = $j(this).attr("id");
                    subscribe_to(idd);
                } );
            }
            $j("#resrapp").click(function(event) {
                event.preventDefault();
                resrapport();
            });
            $j("#edfridager").click(function(event) {
                event.preventDefault();
                edit_fridager();
            });
            $j("#edcourse").click(function(event) {
                event.preventDefault();
                managecourse();
            });
            $j("#edaarsplan").click(function(event) {
                event.preventDefault();
                edit_aarsplan();
            });
            $j("#edexcurs").click(function(event) {
                event.preventDefault();
                edit_excursion(userinfo.id);
            });
            $j("#edsolo").click(function(event) {
                event.preventDefault();
                edit_solo(userinfo.id);
            });
            $j("#edblokk").click(function(event) {
                event.preventDefault();
                edit_blokk();
            });
            $j("#xtrax").click(function(event) {
                event.preventDefault();
                edit_extrax();
            });
            $j("#starbkurs").click(function(event) {
                event.preventDefault();
                starbkurs();
            });
            $j("#teachabsent").click(function(event) {
                event.preventDefault();
                teachAbsent();
            });
            $j("#makeplans").click(function(event) {
                event.preventDefault();
                makeplans();
            });
         });
}


function get_login() {
    // NOTE: this is not security - just convenience. we only show
    // editing menues to presumed teachers.
    // The real check is performed on the node server on all
    // requests that perform changes. We just don't show menues that
    // users are not allowed to use.
    var s = '<form name="loginform"><table id="loginform" class="gradback rcorner centered" >';
    if (!userinfo.username) {
      s += '<tr><th><label for="username" >Brukernavn</label></th><td><input id="uname" type="text" name="username" value="'+userinfo.username+'"></td></tr>';
    } else {
      if (isNaN(userinfo.username)) {
        s += '<tr><th><label for="username" >Brukernavn</label></th><td><input disabled="disabled" id="uname" type="text" name="username" value="'+userinfo.username+'"></td></tr>';
      } else {
        s += '<tr><th></th><td>'+userinfo.firstname.caps()+' '+userinfo.lastname.caps()+'<input type="hidden" id="uname" name="username" value="'+userinfo.username+'"></td></tr>';
      }
    }
    s += '<tr><th><label for="password" >Passord</label></th><td><input id="pwd" type="password" name="password"></td></tr>';
    s += '<tr><td colspan="2"><div id="do_login" class="button">Login</div></td></tr>';
    s += '</table></form>';
    $j("#main").html(s);
    if (userinfo.username) {
      $j("#pwd").focus();
    }
    $j("#uname").keypress(function(event) {
        if (event.keyCode == "13") {
            event.preventDefault();
            $j("#pwd").focus();
        }
      }).focus();
    $j("#pwd").keypress(function(event) {
        if (event.keyCode == "13") {
            event.preventDefault();
            $j("#do_login").click();
        }
      });

    $j("#do_login").click(function(event) {
        var username = $j("#uname").val();
        var password = $j("#pwd").val();
        var doits = (its == "1") ? 1 : 0;
        $j.get(mybase+ '/login',{"username":username, "password":password, "its":doits }, function(uinfo) {
            if (uinfo && uinfo.id > 0) {
              afterloggin(uinfo);
              if (userinfo.department == ss.teachdep) {
                setup_teach();
              }
              show_thisweek();
            } else {
              alert("feil");
            }
        });
    });
}

function belongsToCategory(uid,cat) {
  if (timetables) {
     _belongsToCategory(uid,cat);
  } else {
    $j.getJSON(mybase+ "/timetables",
          function(data) {
              timetables = unflatten(data.flatlist);
              _belongsToCategory(uid,cat);
       });
  }
}

function _belongsToCategory(uid,cat) {
  // return true if user has a course in this list of categories - cat = { cat1:1, cat2:1  ... }
  if (timetables && timetables.teach && timetables.teach[uid]) {
    // we have a teach
    var minefag = database.teachcourse[uid];
    for (var j in minefag) {
      var fagcourse = minefag[j];
      var faggruppe = fagcourse.split('_');
      var fag = faggruppe[0];
      if (fag == 'KOMO') continue;
      if (cat[+database.category[fag]]) {
        return true;
      }
    }
  } else {
    // this is a stud
    var usergr = database.memgr[uid] || null;
    if (usergr) {
      for (var i in usergr) {
        var group = usergr[i];
        var fagliste = database.grcourses[group];
        for (var k in fagliste) {
          var fag = fagliste[k];
          if (cat[database.category[fag]]) return true;
        }
      }
    }
  }
  return false;
}

function afterloggin(uinfo) {
    inlogged = true;
    uinfo.mdd = belongsToCategory(uinfo.id,{10:1,11:1,12:1});
    database.userinfo = userinfo = uinfo;
    // if user.id > 0 then we are logged in
    // add new and dainty things to the menu
    // same as isteach
    if (userinfo.mdd) {
       $j.get(mybase+ '/show', function(showlist) {
          show = showlist;
          s =  '<li><a id="show" href="#">Show</a><ul>'
              +    '<li><a id="editshow"       href="#">Rediger show</a></li>'
              +    '<li><a id="tickets"       href="#">Billettsalg</a></li>'
              + '</ul></li>';
          $j("#nav").append(s);
          $j("#editshow").click(function(event) {
              event.preventDefault();
              editshow(userinfo.id);
          });
          $j("#tickets").click(function(event) {
              event.preventDefault();
              tickets(userinfo.id);
          });
         });
    }
    if (userinfo.department == ss.teachdep) {
      if (userinfo.config) {
        if (userinfo.config.subscription) {
            subscriptlist = userinfo.config.subscription;
        }
        if (userinfo.config["super"]) {
            superbus = userinfo.config["super"];
        }
      }
      fullname = userinfo.firstname + ' ' + userinfo.lastname;
      user = fullname;
      userinfo.fullname = fullname;
      isteach = true;
      isadmin = (database.userinfo.isadmin);
      if (superbus) {
        s = '<li><a id="quizedit" title="Fjern dubletter -slett spørsmål" href="#">'+ss.setup.quizedit+'</a></li>'
           + '<li><a id="subscribe" title="Aboner teach quiz" href="#">'+ss.setup.subscribe+'</a></li>'
           + '<li><a id="csubscribe" title="Aboner any quiz" href="#">'+ss.setup.xsubscribe+'</a></li>'
           + '<li><a id="remarked" title="Spørsmål med merknad" href="#">'+ss.setup.remarked+'</a></li>';
        $j("#fagplaner + ul").append(s);
        $j("#quizedit").click(function(event) {
            event.preventDefault();
            quizDemo();
        });
        $j("#subscribe").click(function(event) {
            event.preventDefault();
            subscribe();
        });
        $j("#andreplaner").click(function(event) {
            relax(30000);
            event.preventDefault();
            vis_andreplaner();
        });
        $j("#remarked").click(function(event) {
            relax(30000);
            event.preventDefault();
            remarked();
        });
      }
      $j.get(mybase+ '/attendance', { all:1 },function(att) {
            allattend = expandatt(att);
            $j("#timeplaner").html("Timeplan/Starb");
            var s = '';
            if (superbus) {
              s += '<li><a id="timeplansamling" title="Sett sammen flere timeplaner" href="#">'+ss.setup.samling+'</a></li>'
            }
            s +=  '<li><a id="show" href="#">Starb</a><ul>'
              +    '<li><a id="regstarb"    href="#">RegistrerStarb</a></li>'
              +    '<li><a id="myattend"    href="#">MineRegistreringer</a></li>'
              +    '<li><a id="weekattend"  href="#">MineKontaktelever</a></li>'
              + '</ul></li>';
            if (superbus) {
              s += '<li><a id="freetime" title="Finn felles tid og ledig rom" href="#">Lag møte</a></li>'
                 + '<li><a id="mymeets" title="Rediger møter" href="#">Mine møter</a></li>';
            }
            $j("#timeplaner + ul").append(s);
            $j("#myattend").click(function(event) {
                event.preventDefault();
                teachattend();
            });
            $j("#regstarb").click(function(event) {
                event.preventDefault();
                regstarb();
            });
            $j("#weekattend").click(function(event) {
                event.preventDefault();
                var starbgr = database.groupnames['kogr_'+userinfo.username.toLowerCase()] || 0;
                weekattend(starbgr);
            });
            $j("#freetime").click(function(event) {
                event.preventDefault();
                findFreeTime();
            });
            $j("#mymeets").click(function(event) {
                event.preventDefault();
                myMeetings();
            });
            $j("#timeplansamling").click(function(event) {
                relax(30000);
                event.preventDefault();
                valg = 'samling';
                vis_samlingtimeplan();
            });
          });
    } else {
       $j.get(mybase+ '/attendance', function(att) {
          attend = att;
          s =  '<li><a id="show" href="#">Starb</a><ul>'
              +    '<li><a id="myattend"    href="#">Starb-oversikt</a></li>'
              + '</ul></li>';
          $j("#nav").append(s);
          $j("#myattend,#show").click(function(event) {
              event.preventDefault();
              myattend(userinfo.id);
          });
         });
    }
}



var prevtitle;

function getusers() {
    // noen kjappe globale
    memberlist = database.memlist;
    memgr = database.memgr;
    heldag = database.heldag;
    category = database.category;
    fagautocomp = database.course;
    id2elev = database.students;
    teachers = database.teachers;
    students = database.students;
    studentIds = database.studentIds;
    getcourseplans();
    // hent ut blokkskjema
    $j.getJSON(mybase+ '/blocks',function (newblocks) {
        blocks = newblocks;
    });
    // hent ut planlagt fravær for teach
    $j.getJSON(mybase+ "/getabsent",
         function(data) {
           absent = data;
         });
    $j.getJSON(mybase+ "/reserv",
         function(data) {
            reservations = unflatreserv(data);
         });
}

function getcourseplans() {
  // fetch timetables and courseplans
  $j.getJSON(mybase+ "/timetables",
        function(data) {
            timetables = unflatten(data.flatlist);
            if (promises.timetables) {
              // some functions have some actions pending on my data
              for (var p in promises.timetables) {
                promises.timetables[p]();
              }
              delete promises.timetables;
            }
            updateFagplanMenu();
     });
  var url = '/allplans';
  $j.getJSON(mybase+ url,
  function(allplans) {
      allefagplaner = allplans;
      courseplans = {};
      var s = '<ul>';
      var linktilfag = [];
      for (var avdeling in allefagplaner.courseplans) {
          var myteachers = allefagplaner.courseplans[avdeling];
          s += '<li><a href="#">' + avdeling + '</a><ul>';
          for (var teach in myteachers) {
              var fagene = myteachers[teach];
              s += '<li><a href="#">' + teach + '</a><ul>';
              for (var fag in fagene) {
                  var idd = fag+'z'+teach+'z'+avdeling;
                  var compliance = allefagplaner.compliance[teach][fag];
                  var comp = Math.floor(Math.log(1 +compliance.sum * compliance.count/44))
                  s += '<li><a class="fag'+comp+'" id="'+idd+'" href="#">' + fag + '</a></li>';
                  var plandata = allefagplaner.courseplans[avdeling][teach][fag];
                  courseplans[fag] = plandata;
                  linktilfag.push(idd);
              }
              s += '</ul></li>';
          }
          s += '</ul></li>';
      }
      s += '</ul>';
      $j("#andreplaner").after(s);
      for (var i=0; i < linktilfag.length; i++) {
          var fag = linktilfag[i];
          $j("#"+fag).click(function(event) {
              event.preventDefault();
              var idd = $j(this).attr("id");
              var elms = idd.split('z');
              var fagnavn = elms[0];
              var teach = elms[1];
              var avdeling = elms[2];
              //var datoliste = allefagplaner.wdates;
              var plandata = allefagplaner.courseplans[avdeling][teach][fagnavn];
              visEnPlan(fagnavn,plandata);
          } );
      }
      $j("#htitle").html(prevtitle);
      // updateFagplanMenu();
      if (showplan != '') {
          action = 'plan';
          coursename = showplan.toUpperCase();
          if (courseplans[coursename]) {
                  var plandata = courseplans[coursename];
                  visEnPlan(coursename,plandata);
                  $j("#htitle").html("Fagplan");
          } else {
                  // vi fant ingen plan - vis standard
                  $j("#main").html("Ukjent plan ");
                  action = 'default';
                  show_thisweek();
          }

      }
      if (promises.allplans) {
        // some functions have some actions pending on my data
        for (var p in promises.allplans) {
          promises.allplans[p]();
        }
        delete promises.allplans;
      }

  });
}



$j(document).ready(function() {
    $j.getJSON(mybase+ "/basic",{ navn:user },
    function(data) {
        database = data;
        romliste = database.romliste;
        for (var gr in romliste) {
          var grr = romliste[gr];
          for (var id in grr) {
            var navn = grr[id];
            allrooms.push(navn);
          }
        }

       var slotzy = [];
      for (var tt in data.starttime) {
         var sl = data.starttime[tt];
         var elm = sl.split('-');
         var t1 = elm[0];
         var t2 = elm[1];
         elm = t1.split('.');
         var t10 = +elm[0];
         var t11 = +elm[1];
         elm = t2.split('.');
         var t20 = +elm[0];
         var t21 = +elm[1];
         var dur = (60*(+t20) + (+t21) - 60*(+t10) - (+t11)) / 5;
         var start = (60*(+t10) + (+t11) - 8*60) / 5;
         slotzy.push([start,dur]);
      }
      database.slotzy = slotzy;
           userinfo = data.userinfo;
           if (!page && (userinfo.uid == 0 && data.ulist)) {
               // we have multiple matches for the user
               // present a list of links for user to choose from
               var s = '<h4>Velg fra lista</h4>';
               data.userinfo = data.ulist[0];
               s += '<div class="gradback centered sized1"><table class="summary"><caption>'+data.ulist.length+'</caption><tr>' + $j.map(data.ulist,function(e,i) {
                    e.gr = e.gr || '';
                    return ('<td><a href="?navn='+e.firstname
                      + ' ' + e.lastname+'">' + e.firstname + ' ' + e.lastname +  '</a></td><td>'
                      + e.department + '</td><td> ' + e.institution +'</td><td>'+ e.gr + '</td>');
                 }).join('</tr><tr>') + '</tr></table></div>';
               action = 'velg';
               $j("#main").html(s);
           }
           if (!database.userinfo) {
             database.userinfo = { uid:0 };
           }
           // sjekk først om bruker allerede er logga inn
           $j.get(mybase+ '/login', function(uinfo) {
               if (uinfo && uinfo.id > 0 && uinfo.id == userinfo.id) {
                  // if user.id > 0 then we are logged in
                  // add new and dainty things to the menu
                  // same as isteach
                  afterloggin(uinfo)
               } else {
                    userinfo = database.userinfo || { firstname:"", lastname:"", department:"", isadmin:false };
                    fullname = userinfo.firstname + " " + userinfo.lastname;
                    userinfo.maybeteach = (userinfo.department == ss.teachdep);
                    isteach = false;
                    isadmin = false;
                    prevtitle = $j("#htitle").html();
               }
               take_action();
               if (action == 'default') {
                 show_thisweek();
               }
               getusers();
            });
         });
    $j.getJSON(mybase+ "/getmeet", function(data) {
       meetings = data.meetings;
    });
    $j("#yearplan").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_all(database.firstweek);
    });
    $j("#resten").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_all(database.startjd);
    });
    $j("#hele").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_all(database.firstweek);
    });
    $j("#heldag").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_heldag();
    });
    $j("#alleprover").addClass("disabled");
    // this is disabled until we have loaded all tests
    // will only show if response from database is slow
    $j.getJSON(mybase+ "/alltests",
         function(data) {
            alleprover = data;
            $j("#alleprover").click(function(event) {
                event.preventDefault();
                show_alleprover();
            }).removeClass("disabled");
         });
    $j.getJSON(mybase+ "/getallplans", { state:"0,1" },
         function(data) {
             planinfo = {};
             cpinfo = {};
             for (var i in data) {
               var pinf = data[i];
               if (!planinfo[pinf.i]) planinfo[pinf.i] = pinf.v;
               if (!cpinfo[pinf.s]) cpinfo[pinf.s] = pinf.i;
             }
         });
    $j("#prover").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_prover();
    });
    $j("#neste").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_next4();
    });
    $j("#starblist").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_allstarbless();
    });
    $j("#denne").click(function(event) {
        relax(30000);
        event.preventDefault();
        show_thisweek();
    });
    $j("#timeplaner").click(function(event) {
        relax(30000);
        event.preventDefault();
        valg = 'elev';
        vis_elevtimeplan();
    });
    $j("#logout").click(function(event) {
        event.preventDefault();
        $j.get(mybase+ "/logout");
        inlogged = false;
        window.location= mybase;
    });
    $j("#timeplanelev").click(function(event) {
        event.preventDefault();
        valg = 'elev';
        vis_elevtimeplan();
    });
    $j("#timeplanteach").click(function(event) {
        relax(30000);
        event.preventDefault();
        valg = 'teach';
        vis_teachtimeplan();
    });
    $j("#timeplanklasse").click(function(event) {
        relax(30000);
        event.preventDefault();
        valg = 'klasse';
        vis_klassetimeplan();
    });
    $j("#timeplangruppe").click(function(event) {
        relax(30000);
        event.preventDefault();
        valg = 'gruppe';
        vis_gruppetimeplan();
    });
    $j("#timeplanrom").click(function(event) {
        relax(30000);
        event.preventDefault();
        valg = 'rom';
        vis_romtimeplan();
    });
    $j("#edbortfall").click(function(event) {
        event.preventDefault();
        edit_bortfall(userinfo.id);
    });
    //$j("#yyear").html("heisan");
    $j("#htitle").click(function(event) {
        toggle_year();
    });
    $j(".llogin").html('Login').click(function(event) {
        event.preventDefault();
        get_login();
    });
    $j("#seek").html('<span id="heat"><span class="label">søk:'
        + '</span><input id="seeker" class="seeker" type="text" value="" size="18"></span>');
    $j("#heat").hover(function(event) {
          $j("#seeker").focus();
        });
    $j("#seeker").keypress(function(event) {
        if (event.keyCode == "13") {
            event.preventDefault();
            window.location = '?navn='+$j("#seeker").val();
        }
    });
});

