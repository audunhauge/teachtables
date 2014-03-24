// show/edit meetings

// global hash to ease change of state and reload of closures
minfo = {
   title      : ''
 , message    : ''
 , ignore     : ''
 , chosen     : {}    // the chosen participants
 , slotz      : []    // the chosen slots
 , delta      : 0
 , roomid     : 0
 , sendmail   : true
 , response   : 'accept'
 , day        : ''
};

var busyteachdayslot;  // f(day,slot) => busy teachlist
var allteachers;


function invigilator() {
  if (!busyteachdayslot) {
    // set up quick lookup table for teach/day/slot
    // an entry for a teach means this teach is free
    busyteachdayslot = {};
    allteachers = _.keys(teachers);   // get array of teachids
    for (var d=0; d<6; d++) {
      busyteachdayslot[d] = {};
      for (var s=0; s<12; s++) {
        busyteachdayslot[d][s] = [];
      }
    }
    for (var rid in teachers) {
      var tt = timetables.teach[rid];
      if (!tt) continue;
      for (var t=0,tl=tt.length; t < tl; t++) {
        var ts = tt[t];
        busyteachdayslot[ts[0]][slot2lesson(ts[1])].push(rid);
      }
    }
  }
  var jd = database.startjd + 7*minfo.delta;
  var s = ['<p>'];
  var d = 0;  // delta from julday - 0..6
  for (var j in database.heldag) {
    if (j < jd || j > jd+7) continue;
    d = j-jd;
    var h = database.heldag[j];
    for (var f in h) {
      var groups = [];
      var vigis = [];
      if (database.coursesgr && database.coursesgr[f] ) {
        groups = database.coursesgr[f];
        if (groups.length > 12) {
          continue;  // ignore overlarge groups
          console.log(f,"too large")
        }
        for (var i=0,l=groups.length; i<l; i++) {
          var g = groups[i];
          var tt = timetables.group[g];
          var grptable = _.range(10);
          if (tt) {
            for (var t=0,tl=tt.length; t < tl; t++) {
              // we are now looking at a timetable slot [day,slot,subj,room,didly,teachid]
              var ts = tt[t];
              if (ts[0] != d) continue;
              var tea = teachers[ts[5]];
              grptable[ts[1]] = slot2lesson(ts[1]) +' time '+tea.firstname+' på '+ts[3];
            }
            vigis.push(g+':'+grptable.join(',') );
            //var canuse = _.difference(allteachers.slice(),)
          }
        }
        s.push(f+' '+h[f].value + '<br>'+ vigis.join('<br>'));
      }
    }
  }
  $j("#timeviser").html(s.join('<p>'));

}


function reduceSlots(userlist,roomname,jd) {
  // returns biglump, whois, busy and rreserv
  // whois busy and rreserv contain info on who,what,why the slot is blocked
  // reduce available slots in biglump
  // remove meetings, absent, roomreservations, roomlessons and teachlessons
  // First remove meetings and absentees
  var biglump = {};
  var whois = {};
  var busy = {};
  var rreserv = {};
  var shortmeet = {};
  for (var day = 0; day < 5; day++) {
    biglump[day] = {};
    busy[day] = {};
    whois[day] = {};
    shortmeet[day] = {};
    for (var slot = 0; slot < 95; slot++) {
       biglump[day][slot] = $j.extend({}, userlist);
       biglump[day][slot][roomname] = 1;
    }
    // decimate based on existing meetings for teachers
    if (meetings[jd+day]) {
      var mee = meetings[jd+day];
      for (var muid in mee) {
        if (userlist[muid] != undefined) {
           for (var mmid in mee[muid]) {
            var abba = mee[muid][mmid];
            if (abba.slot) {
              var slot = +abba.slot;
              for (var di = 0; di < abba.dur; di++) {
                  // only the start slot is stored - use dur to fill in the rest
                if (slot+di >= 0 && slot+di < 95) {
                  delete biglump[day][slot+di][muid];
                  busy[day][slot+di] = abba.name || 'Møte';
                  whois[day][slot+di] = teachers[muid].username;
                }
              }
            }
           }
        }
      }
    }
    // desimate based on absent teachers
    // teachers are absent whole lessons (8 slots)
    if (absent[jd+day]) {
      var ab = absent[jd+day];
      for (var abt in ab) {
          if (userlist[abt] != undefined) {
            // one of selected teachers is absent
            var abba = ab[abt];
            var timer = abba.value.split(",");
            for (var ti in timer) {
              var slot = lesson2slot(+timer[ti]-1);
              for (var di=0; di < 8; di++) {   // a lesson is 8 slots
                delete biglump[day][slot+di][abt];
                busy[day][slot+di] = abba.name;
                whois[day][slot+di] = teachers[abt].username;
              }
            }
          }
      }
    }
  }
  // now decimate based on lessons for this room
  if (roomname) {
    var tt = timetables.room[roomname];
       for (var iid in tt) {
         var ts = tt[iid];
         var day = +ts[0] % 7;
         var slot = ts[1];
         if (ts[2] && ts[2].substr(0,4).toLowerCase() == 'møte') continue;
         if (day == undefined || slot == undefined) continue;
         if (!biglump[day][slot]) { console.log("reduceSlots: bad slot=",slot); continue;}
         for (var di=0; di < 8; di++) {   // a lesson is 8 slots
           if (slot+di >= 0 && slot+di < 95) delete biglump[day][slot+di][roomname];
         }
       }
  }
  // now decimate based on reservations for this room
  if (reservations) {
    for (var jdd = jd; jdd < jd+7; jdd++) {
      if (reservations[jdd]) {
        var reslist = reservations[jdd];
        for (var r in reslist) {
          var res = reslist[r];
          if (res.name == roomname) {
            if (!rreserv[res.day]) rreserv[res.day] = {};
            var slotz = res.slot;
            var cc = res.dur;
            while(cc--) {
              rreserv[res.day][slotz++] = res;
            }
          }
        }
      }
    }
  }
  // now decimate based on lessons for selected teachers
  if (timetables && timetables.teach) {
    // we have teach timetables
    for (var tuid in userlist) {
       var tt = timetables.teach[tuid];
       if (tt) for (var iid=0,k=tt.length; iid<k;iid++) {
         var ts = tt[iid];
         var day = +ts[0] % 7;
         var slot = ts[1];
         if (ts[2] && ts[2].substr(0,4).toLowerCase() == 'møte') continue;
         if (day == undefined || slot == undefined) continue;
         if (!biglump[day][slot]) { console.log("reduceSlots: bad slot=",slot); continue;}
         for (var di=0; di < 8; di++) {   // a lesson is 8 slots
           if (slot+di >= 0 && slot+di < 95) delete biglump[day][slot+di][+tuid];
         }
       }
    }
  }
  return { biglump:biglump, whois:whois, busy:busy, rreserv:rreserv, shortmeet:shortmeet }
}

function doStatusCheck() {
  // returns enabled/disabled for save button
  if ($j("#msgtitle").val() == '' ) return 'Mangler emne for møtet';
  if ($j("#msgtext").val() == '' ) return 'Mangler beskrivelse for møtet';
  if ($j.isEmptyObject(minfo.chosen)) return 'ingen deltagere';
  if (minfo.roomid == 0) return 'mangler rom';
  var roomname = database.roomnames[minfo.roomid] || '';
  if (roomname == '' || roomname == 'nn') return 'mangler rom';
  if (!minfo.slotz.length) return 'ingen timer valgt';
  return '';
}


function showWizInfo() {
  // update help tip in #wiz to reflect current state
  // We give hint depending on what is missing to make a meet
  // We have a function that does the same in doStatusCheck
  var wz = [];
  var roomname = database.roomnames[minfo.roomid] || '';
  if (minfo.roomid == 0 || roomname == '' || roomname == 'nn') {
    wz.push('Velg rom for møtet');
    $j("#stage").hide();
    $j("#freeplan").hide();
  } else {
    $j("#stage").show();
    $j("#freeplan").show();
  }
  if ($j.isEmptyObject(minfo.chosen)) {
    wz.push('Velg deltagere');
  }
  if (!minfo.slotz.length) {
    wz.push('Velg timer fra planen');
  }
  if (wz.length > 2) {
    wz.push('<span title="Velg en elev i vis-timeplan, klikk på Husk,kom tilbake hit.">TIPS:møte om elev</span>');
  }
  if (wz.length == 0) {
    wz.push('Klikk på Møte info');
    $j("#showdetails").animate({ opacity:0.2  },200,function() { $j(this).animate({ opacity:1 },300);  }   );
  }
  if (wz.length < 2) {
    $j("#wiz").html(wz.join(''));
  } else {
    $j("#wiz").html('<ol><li>'+wz.join('</li><li>')+'</li></ol>');
  }
}

function meetTimeStart(jd,slotz,early,dur) {
      // we know the slots are consecutive - we just need the first one and a count
      // early true if just want hh mm
      dur = dur ? dur : 5 * slotz.length;
      var base = database.starttime[0].split('-')[0].split('.');   // hh mm
      var first = _.min(slotz,function(e) { return e.split('_')[1];});
      var day = +first.split('_')[0];
      var slot = first.split('_')[1];
      var hh = +base[0] + Math.floor((+base[1] +slot*5)/60);
      var mm = (+base[1] +slot*5) % 60;
      mm = mm < 10 ? '0'+mm : mm;
      if (early) return [hh,mm];
      var shotime = ss.weekdays.split(' ')[day] + ' '+ hh + ':' + mm +'&nbsp; '+dur+'min' ;
      var juli = julian.jdtogregorian(jd+day);
      var meetdate =  ss.week.caps() + ' '+ julian.week(jd) + ' ' + juli.day + '.'+juli.month+'.'+juli.year;
      return meetdate + '<br>'+shotime;
}

function findFreeTime() {
  // show list of teachers - allow user to select and find free time
  var siz = 8;
  $j.getJSON(mybase+ "/getmeet", function(data) {

    meetings = data.meetings;
    var stulist = [];  // names of studs if we have some in memory
    if (! jQuery.isEmptyObject(timeregister)) {
      // the teach has memorized someone
      // find all teachers who teach this stud
      // and set chosen to this list
      var memList = [];
      for (var treg in timeregister) {
          // first pass expands groups into students
          if ( memberlist[treg]) {
              // this is a group containing members
              memList = memList.concat(memberlist[treg]);
          } else {
              memList.push(treg);
          }
      }
      for (var tii in memList) {
        var treg = memList[tii];
        if (students[+treg]) {
            var usergr = memgr[+treg] || null;
            if (usergr) {
              var astu = students[+treg];
              stulist.push(astu.firstname.caps() + " " + astu.lastname.caps());
              for (var i in usergr) {
                var group = usergr[i];
                var courselist = database.grcourses[group];
                for (var j in courselist) {
                  var cname = courselist[j] + '_' + group;
                  if (database.courseteach[cname]) {
                      var teachlist = database.courseteach[cname].teach;
                      for (var k in teachlist) {
                        var teachid = teachlist[k];
                        minfo.chosen[teachid] = 0;
                      }
                  }
                }
              }
            }
        }
      }
    }
    var message = '';
    var s='<div id="timeviser"><h1 id="oskrift">Finn ledig møtetid for lærere</h1>';
    s += '<div class="gui" id=\"velg\">Velg rom for møte<select id="chroom">';
    //s+= '<option value="0"> --velg-- </option>';
    for (var i in database.roomnames) {
         var e = database.roomnames[i];
         s+= '<option value="'+i+'">' + e  +  "</option>";
    }
    s+= '</select><div id="wiz"></div></div>';
    s+= '<div id="freeplan"></div>';
    s+= '<div id="stage"></div>';
    s+= "</div>";
    $j("#main").html(s);
    $j("#stage").hide();
    $j("#oskrift").click(function() {
             invigilator();
          });
    var activeday = { "0":{}, "1":{}, "2":{}, "3":{}, "4":{} };
    var aday = '';
    choosefrom = $j.extend({}, teachers);
    // studChooser(targetdiv,memberlist,info,tabfield,fieldlist)
    var fieldlist = {AvdLeder:1,lastname:1, institution:1 };
    var remap ={ AvdLeder:{field:'institution',
                 map:{ 'Realfag':'Berit', 'Samfunnsfag':'Eva', "Filologi":"Eva", 'Bibliotekar':"Eva",'Kontoret':'Atle',
                       'Musikk':'Erling', 'DansDrama':'Ruth', "Språk":'Ruth','IT':'Lest','Admin':'Kirsti'} }};
    studChooser("#stage",choosefrom,minfo.chosen,'institution', fieldlist,remap );
    var freeTimeTable = function (userlist,roomid,delta) {
      // assume timetables is valid
      // create timetable containing names of teach who are available
      // for a given slot
      // userlist = {1222:1,333:1,45556:1} teacher ids to check
      // chroom is index into allrooms
      minfo.roomid = roomid;
      minfo.delta = delta;
      minfo.title = $j("#msgtitle").val() || minfo.title;
      message = $j("#msgtext").val() || '';
      if (stulist.length > 0) {
        minfo.title = minfo.title || 'Møte om elev' + ( (stulist.length > 1) ? 'er' : '' );
        message = message || stulist.join(',');
      }
      minfo.ignore = $j('input[name=ignore]:checked').val() || '';
      minfo.kort = $j('input[name=kort]:checked').val() || '';
      minfo.sendmail = $j('input[name=sendmail]:checked').val() || minfo.sendmail;
      var count = 0;   // number of teachers
      var roomname = database.roomnames[minfo.roomid] || '';
      var jd = database.startjd + 7*minfo.delta;
      for(var prop in userlist) {
         if(userlist.hasOwnProperty(prop)) ++count;
      }
      var re = reduceSlots(userlist,roomname,jd);
      var biglump = re.biglump;   // all free slots
      var whois = re.whois;       // name of teach for meeting/reservation
      var busy = re.busy;         // what they are doing instead
      var shortmeet = re.shortmeet;
      var rreserv = re.rreserv;   // reserved rooms

      var s = '<div id="showplan" class="tabbers">Timeplan</div>'
            + '<div id="showdetails" class="tabbers" style="left:90px;" >Møte info</div><div id="meetbox"></div>';
      var t = '';
      var start = database.starttime;
      var ofs = 65;
      for (i=0;i<12;i++) {
        var sl = start[i];
        var po = s2sd(sl);
        t += '<div class="tttime'+(i%2)+'" style="width:468px;top:'+(+po[0]*4)+'px;height:'+(po[1]*4)+'px">' + sl + "</div>";
      }
      for (var slot = 0; slot < 95; slot++) {
        //s += '<tr><th>'+(slot+1)+'</th>';
        for (var day = 0; day < 5; day++) {
          if (rreserv[day] && rreserv[day][slot]) {
            var r = rreserv[day][slot];
            //s += '<td title="'+r.value+'">'+teachers[r.userid].username+'</td>';
            t += '<div title ="'+r.value+'" id="mm'+day+'_'+slot+'" class="mslot red" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
            continue;
          }
          if (database.freedays[jd+day]) {
            //s += '<td><div class="timeplanfree">'+database.freedays[jd+day]+'</div></td>';
            t += '<div title="'+database.freedays[jd+day]+'" id="mm'+day+'_'+slot+'" class="mslot freeday" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
            continue;
          }
          if (minfo.ignore != '') {
            //s += '<td class="greenfont"><input class="slotter" id="tt'+day+"_"+slot+'" type="checkbox"> '+minfo.ignore+'</td>';
            continue;
          }
          if (!biglump[day] || !biglump[day][slot]) {
            //s += '<td>&nbsp;</td>';
            t += '<div id="mm'+day+'_'+slot+'" class="mslot" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
            continue;
          }
          var freetime = biglump[day][slot];
          if (freetime) {
            var tt = '';
            var zz = '';
            var tdcount = 0;
            if (freetime[roomname]) {
                    for (var tti in userlist) {
                      if (freetime[tti] != undefined) {
                        tt += teachers[tti].username + ' ';
                        tdcount++;
                      } else {
                        zz += teachers[tti].username + ' ';
                      }
                    }
                    if (tdcount == count) {
                      if (shortmeet[day][slot] != undefined) {
                       //s += '<td title="'+tt+'" class="orangefont">'
                       //  + '<input rel="'+day+'" class="slotter shortslott" id="tt'+day+"_"+slot+'" type="checkbox"> LittLedig</td>';
                            t += '<div id="mm'+day+'_'+slot+'" class="mslot" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
                      } else {
                       //s += '<td title="'+tt+'" class="greenfont">'
                       //  + '<input rel="'+day+'" class="slotter" id="tt'+day+"_"+slot+'" type="checkbox"> AlleLedig</td>';
                         t += '<div id="mm'+day+'_'+slot+'" class="mslot pale" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
                      }
                    } else {
                       if (tdcount) {
                          //s += '<td><span title="Kan ikke:'+zz+'" class="redfont">'+(count-tdcount)+'</span>'
                          //s += ' &nbsp; <span class="greenfont" title="Kan møte:'+tt+'">'+(tdcount)+'</span>';
                         t += '<div title="Kan ikke:'+zz+'" id="mm'+day+'_'+slot+'" class="mslot partly'+(count-tdcount)+'" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
                       } else {
                          if (busy[day][slot] != undefined) {
                            var info = (whois[day] && whois[day][slot]) ? whois[day][slot]+' '+busy[day][slot] : '';
                            //s += '<td class="meeting"><span title="'+whois[day][slot]+'">'+busy[day][slot]+'</span>'
                            t += '<div title="'+info+'" id="mm'+day+'_'+slot+'" class="mslot busy" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
                          } else {
                            //s += '<td><span class="redfont">IngenLedig</span>'
                            t += '<div id="mm'+day+'_'+slot+'" class="mslot" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
                          }
                       }
                    }
            } else {
              var info = (whois[day] && whois[day][slot]) ? whois[day][slot] : '';
              t += '<div title="'+info+'" id="mm'+day+'_'+slot+'" class="mslot blue" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
            }
          } else {
            t += '<div id="mm'+day+'_'+slot+'" class="mslot" style="left:'+(ofs+day*82)+'px; top:'+(slot*4)+'px;"></div>';
          }
        }
      }
      var meetdate =  ss.week.caps() + ' '+ julian.week(jd) + ' ' + formatweekdate(jd);
      t += '<div id="duration">'+ss.meet.duration+' : <span class="dur">5</span> <span class="dur">10</span> <span class="dur">15</span> <span class="dur">20</span>'
         + ' <span class="dur">30</span> <span class="dur heck2">40</span><div id="dato">'+meetdate+'</div>'
         + '<div id="nxt" class="button blue gui">&gt;</div><div class="button blue gui" id="prv">&lt;</div></div>';
      var igncheck = (minfo.ignore != '') ? 'checked="checked"' : '';
      var mailcheck = (minfo.sendmail != '') ? 'checked="checked"' : '';
      var kortcheck = (minfo.kort != '') ? 'checked="checked"' : '';
      var mlist = [];
      for (var uu in userlist) {
        mlist.push(teachers[uu].username);
      }
      var meetlist = mlist.join(', ');
      var idlist = '';  // TODO idlist must pick up slots
      var save_status = doStatusCheck();
      var disabled = (save_status != '') ? 'disabled="disabled"' : '';

      s += '<div id="reservopts">';
      s += '<table id="details" class="dialog gui">'
        +  '<caption id="capdetails">Møte info</caption>'
        +    '<tr id="detailsrow">'
        +      '<td><table class="dialog gui">'
        +        '<tr><th>Møte-tittel</th><td><input id="msgtitle" type="text" value="'+minfo.title+'"></td></tr>'
        +        '<tr><th>Beskrivelse</th><td><textarea id="msgtext">'+message+'</textarea></td></tr>'
        +        '<tr><th>Påmeldt</th><td><span id="attend">'+meetlist+'</span></td></tr>'
        +        '<tr><th>Møtetid :</th><td><span id="timeliste">'+idlist+'</span></td></tr>'
        +        '<tr><th colspan="2"><hr /></th></tr>'
        +        '<tr><th title="Deltager kan ikke avvise møtet.">Obligatorisk</th>  <td><input name="konf" value="ob" type="radio"></td></tr>'
        +        '<tr><th title="Deltakere må avvise dersom de ikke kommer.">Kan avvise</th>    <td><input name="konf" value="deny" type="radio"></td></tr>'
        +        '<tr><th title="Deltakere må bekrefte at de kommer">Må bekrefte</th>'
        +             '<td><input checked="checked" name="konf" value="conf" type="radio"></td></tr>'
        +        '<tr><th colspan="2"><hr /></th></tr>'
        +        '<tr><th>ReserverRom</th><td><input id="resroom" checked="checked" type="checkbox"></td></tr>'
        +        '<tr><th>SendMail</th><td><input name="sendmail" type="checkbox" '+mailcheck+'></td></tr>'
        +        '<tr><th>IgnorerTimeplaner</th><td><input name="ignore" type="checkbox" '+igncheck+'></td></tr>'
        +        '<tr><th>&nbsp;</th><td><hr></td></tr>'
        +        '<tr><th>Lag møte</th><td> <input id="makemeet" '+disabled+' type="button" value="Lagre"></button>'
        +        ' <span id="savestatus" class="redfont tiny"> '+ save_status+'</span></td></tr>'
        +      '</table></td>'
        +    '</tr>'
        +  '</table>';

      s += '</div>';
      $j("#freeplan").html(s);
      $j("#meetbox").html(t);
      minfo.ignore = $j('input[name=ignore]:checked').val() || '';
      minfo.sendmail = $j('input[name=sendmail]:checked').val() || '';
      $j("#duration").undelegate(".dur","click");
      $j("#duration").delegate(".dur","click", function() {
          $j(".dur").removeClass("heck2");
          $j(this).addClass("heck2");
          var mydur = this.innerHTML;
          if (+mydur > 4 && +mydur < 50) {
            siz = Math.floor(+mydur/5);
          }
      });
      function record() {   // save chosen slots
         var choz = $j(".mslot.green");
         var slotz = [];
         for (var i=0; i< choz.length;i++) {
           var elm = choz[i];
           slotz.push(elm.id.substr(2));
         }
         minfo.slotz = slotz;
         showWizInfo();
        };

      $j("#meetbox").undelegate(".green","click");
      $j("#meetbox").delegate(".green","click", function() {
          var myid = this.id.substr(2).split('_');
          var dd = myid[0];
          var ss0 = +myid[1];
          var ss = lesson2slot(slot2lesson(ss0)-1);
          ss = ss + siz*Math.floor((ss0-ss)/siz);
          $j(".green").addClass("pale");
          $j(".mslot").removeClass("green");
          record();
      });

      $j("#meetbox").undelegate(".pale","click");
      $j("#meetbox").delegate(".pale","click", function() {
          var myid = this.id.substr(2).split('_');
          var dd = myid[0];
          var ss0 = +myid[1];
          var ss = ss0;
          if (siz==8) {
            ss = lesson2slot(slot2lesson(ss0)-1);
            ss = ss + siz*Math.floor((ss0-ss)/siz);
          }
          $j(".green").addClass("pale");
          $j(".mslot").removeClass("green");
          for (var ti=0; ti< siz;ti++) {
            $j("#mm"+dd+"_"+(+ss+ti)+".pale").addClass("green");
            $j("#mm"+dd+"_"+(+ss+ti)+".pale").removeClass("pale");
          }
          record();
      });

      function checkToggleSave() {
            disabled = doStatusCheck();
            $j("#savestatus").html(disabled);
            if (disabled == '') {
              $j("#makemeet").removeAttr("disabled");
            } else {
              $j("#makemeet").attr("disabled","disabled");
            }
      }

      $j("#msgtitle").keyup(checkToggleSave);
      $j("#msgtext").keyup(checkToggleSave);

      $j("#nxt").click(function() {
         if (database.startjd+7*minfo.delta < database.lastweek+7)
          minfo.delta++;
          minfo.slotz = {};
          $j("#freeplan").html(freeTimeTable(userlist,minfo.roomid,minfo.delta));
         });
      $j("#prv").click(function() {
         if (database.startjd+7*minfo.delta > database.firstweek-7)
          minfo.delta--;
          minfo.slotz = {};
          $j("#freeplan").html(freeTimeTable(userlist,minfo.roomid,minfo.delta));
         });
      $j(".tabbers").removeClass("active");
      if (mlist.length > 10) $j("#attend").addClass('tiny');
      $j(".tabchooser").click(function() {
              tabfield = this.id;
              studChooser(targetdiv,memberlist,info,tabfield,fieldlist,remap);
          });
      $j("#details").hide();
      $j("#showplan").addClass('active');
      $j("#showplan").click(function() {
            $j(".tabbers").removeClass("active");
            $j("#meetbox").show();
            $j("#details").hide();
            $j("#showplan").addClass('active');
          });
      $j("#showdetails").click(function() {
            $j(".tabbers").removeClass("active");
            $j("#details").show();
            $j("#meetbox").hide();
            $j("#showdetails").addClass('active');
            if (mlist.length > 10) {
              $j("#attend").addClass('tiny');
            } else {
              $j("#attend").removeClass('tiny');
            }
            checkToggleSave();
            $j("#timeliste").html( meetTimeStart(jd,minfo.slotz));
          });

      $j("#makemeet").click(function() {
         var slot = minfo.slotz[0].split('_')[1];   // the first slot
         var day = minfo.slotz[0].split('_')[0];   // the first slot
         var dur = minfo.slotz.length;  // each slot is 5 minutes
         first = meetTimeStart(jd,minfo.slotz,1).join(':');
         minfo.title = $j("#msgtitle").val() || minfo.title;
         minfo.sendmail = $j('input[name=sendmail]:checked').val();
         var sendmail =  minfo.sendmail ? 'yes' : 'no';
         message = $j("#msgtext").val();
         var roomname = database.roomnames[minfo.roomid] || '';
         var konf = $j('input[name=konf]:checked').val();
         var resroom = $j("#resroom").val();
         $j.post(mybase+'/makemeet',{ chosen:getkeys(userlist), current:jd, meetstart:first,dur:dur, slot:slot,
                       roomname:roomname, message:message, title:minfo.title, resroom:resroom, sendmail:sendmail,
                       konf:konf, roomid:minfo.roomid, day:day, action:"insert" },function(resp) {
             $j.getJSON(mybase+ "/getmeet",
                  function(data) {
                     meetings = data;
                     freeTimeTable(userlist,minfo.roomid,minfo.delta);
                     $j("#oskrift").html("Avtalen er lagra").effect("pulsate", { times:3 }, 3000);
             });
         });
       });
       showWizInfo();
    }
    var refindFree = function (event) {
       minfo.slotz = {};
       minfo.roomid = +$j("#chroom").val() || minfo.roomid;
       if (event.type == 'click') {
         var teachid = +this.id.substr(2);
         $j(this).toggleClass("someabs");
         if (minfo.chosen[teachid] != undefined) {
           delete minfo.chosen[teachid];
         } else {
           minfo.chosen[teachid] = 0;
         }
       }
       freeTimeTable(minfo.chosen,minfo.roomid,minfo.delta);
    }
    $j("#stage").delegate(".tnames","click",refindFree);
    $j("#chroom").change(refindFree);
    showWizInfo();
  });
}

function myMeetings(meetid,delta) {
  // show list of meetings (your meetings)
  meetid = typeof(meetid) != 'undefined' ?  +meetid : 0;
  delta = typeof(delta) != 'undefined' ?  +delta : 0;    // week offset from current date
  $j.getJSON(mybase+ "/getmeet", function(data) {
    meetings = data.meetings;
    var s='<div id="timeviser"><h1 id="oskrift">Mine møter</h1>';
    s+= '<div id="freeplan"></div>';
    s+= '<div id="stage"></div>';
    s+= "</div>";
    $j("#main").html(s);
    var meetlist = [];
    var jd = database.startjd + 7*delta;
    for (var day = 0; day < 5; day++) {
      if (database.thisjd > jd+day) {
        continue;
      }
      if (meetings[jd+day]) {
        var mee = meetings[jd+day];
        var minf = {};
        // details of all meetings
        for (var uui in mee) {
          for (var mmi in mee[uui]) {
            var abb = mee[uui][mmi];
            if (!minf[abb.courseid]) {
               minf[abb.courseid] = {ant:0, ulist:[] };
            }
            minf[abb.courseid].ant ++;
            minf[abb.courseid].ulist.push(teachers[uui].username);
          }
        }
        // my meetings
        if (mee[userinfo.id]) {
          for (var mmid in mee[userinfo.id]) {
            var abba = mee[userinfo.id][mmid];
            var active = '';
            var meetime = abba.value;
            if (abba.id == meetid) active = ' active';
            var meetdate = julian.jdtogregorian(jd+day);
            var myown = (abba.teachid == userinfo.id) ? ' myown' : '';
            var meetdiv = '<div  class="meetlist'+active+' acc'+abba.klass+myown+'"><span class="meetinfo">'
                          + '<input  class="meetchk" type="checkbox" >' + abba.name
                          +'</span><span class="meetdato">' + meetime + ' ' + romdager[day]+' '
                          +meetdate.day+'.'+meetdate.month+'</span><span class="ulist">'
                          +minf[abba.courseid].ulist.join(',')+'</span><span id="'+abba.courseid+'" class="meetroom">'+database.roomnames[abba.roomid]
                          +'</span></div>';
            meetlist.push(meetdiv);
          }
        }
      }
    }
    $j("#stage").html(meetlist.join(''));
    $j(".meetroom").click(function() {
       editMeeting(this.id,meetid,delta);
    });
    $j(".meetroom").click(function() {
       editMeeting(this.id,meetid,delta);
    });
  })
}


function editMeeting(meetingid,meetid,delta) {
  // edit a specific meeting - you are owner
  $j.getJSON(mybase+ "/getmeeting", function(data) {
    var meet,s,owner,ownerid;
    var owner = false;
    if ( data[userinfo.id] && data[userinfo.id][meetingid]) {
      meet = data[userinfo.id][meetingid];
      owner = true;
    } else {
        // find this meeting, data is indexed by owner
        for (var uui in data) {
            var uuu = data[uui];
            if (uuu[meetingid]) {
               meet = uuu[meetingid];
               ownerid = uui;
               break;
            }
        }
    }
    if (meet) {
      if (owner) {
        s='<div id="timeviser"><h1 id="oskrift">Rediger møte</h1>';
        s+= '<div id="stage"></div>';
        s+= '<div id="controls">'
            + '<div id="killmeet" class="meetbutton">Slett</div>'
            + '<div class="meetbutton">Resend</div>'
            + '</div>';
        s+= "</div>";
      } else {
        var teach = teachers[ownerid];
        var ownername = teach.firstname.caps() + ' '+ teach.lastname.caps() ;
        s='<div id="timeviser"><h1 id="oskrift">Møte</h1>';
        s+= '<h4>Ansvarlig: '+ownername+'</h4>';
        s+= '<div id="stage"></div>';
        s+= "</div>";
      }
      $j("#main").html(s);
      s = '';
      var metinfo = JSON.parse(meet.value);
      var meetime =  meetTimeStart(meet.julday+meet.day,['0_'+meet.slot],0,5*meet.dur);
      s += '<h1>' + metinfo.title + '</h1>';
      s += (meet.klass == 1) ? '<h4>Obligatorisk</h4>' : '';
      s +=  metinfo.message + '<hr>';
      if (metinfo.sendmail == 'yes') {
        s+= '<br>Mail er sendt til deltakerne';
      }
      s += '<br>Tid: ' + meetime.replace('<br>','&nbsp; ');
      s += '<br>Rom : ' + database.roomnames[meet.roomid];
      var teachlist = [];
      var daymeet = meetings[meet.julday];   // all meetings this day
      var acceptOrDecline = 0;
      while( metinfo.chosen.length) {
        var teach = teachers[metinfo.chosen.pop()];
        var accepted = 'ui-icon-close';
        var notcoming = ' class="redfont" ';
        if (daymeet[teach.id]) {
            for (var mii in daymeet[teach.id]) {
                var mmme = daymeet[teach.id][mii];
                if (mmme.courseid == meetingid) {
                   accepted = ("ui-icon-help,ui-icon-check,ui-icon-check,ui-icon-close".split(','))[mmme.klass];
                   if (teach.id == userinfo.id) {
                       acceptOrDecline = mmme.klass;
                       notcoming = '';
                   }
                   break;
                }
            }
        }
        accepted = '<span class="right ui-icon '+accepted+'"></span>';
        teachlist.push( '<span'+notcoming+'>'+teach.firstname.caps() + ' '+ teach.lastname.caps() + '</span>'+ accepted );
      }
      if (acceptOrDecline == 0 || acceptOrDecline == 2) {
          if (acceptOrDecline == 0 ) {
             s += '<h5><div id="acc" class="float button">godta</div><div id="rej" class="float button">avslå</div></h5><p class="clear"></p>';
          } else {
             s += '<h5><div id="rej" class="button">KanIkke</div></h5>';
          }
      }
      s += '<h3>Deltakere</h3><ul><li>'+teachlist.join('</li><li>') + '</ul>';
      s += (metinfo.kort) ? '<br>Short meeting' : '';
      $j("#killmeet").click(function() {
            $j.post(mybase+'/makemeet',{ myid:meetingid, action:"kill" },function(resp) {
                 myMeetings(meetid,delta);
             });
       });
       $j("#stage").html(s);
      $j("#rej").click(function() {
          $j.get(mybase+ "/rejectmeet?userid="+userinfo.id+"&meetid="+meetingid,function(res) {
                 myMeetings(meetid,delta);
              });
       });
      $j("#acc").click(function() {
          $j.get(mybase+ "/acceptmeet?userid="+userinfo.id+"&meetid="+meetingid,function(res) {
                 myMeetings(meetid,delta);
              });
       });
    } else {
      $j("#main").html('No such meeting pending');
    }
  })
}
