// a workbook for a course
//   teach can add elements to book
//   quiz - link to a test
//   questions - question displayd direct on page
//   container - a link to a sub-workbook
//       a container is like a chapter
//       can contain (quiz,question,container)

var wb = { render: {} };
var wbinfo = { trail:[], page:{}, missing:{} , haveadded:0, maxscore:0 };
// trail is breadcrumb for navigation
// missing is number of unasnwered questions in a quiz
// haveadded will be > 0 if teach has added a new question this session
//    used to show/hide extra help text

var tablets = {};   // workaround for lack of drag and drop on tablets
var remarks = {};   // questions with remarks from other teachers
var scoresum = {};  // score summary for each quiz/container - only used for quiz

var youSure = {};   // track warnings for incomplete answers

function getUser(uid,pref) {
  // will always get a user
  // notfound will be true if no valid
  // check Department == 'Undervisning' to test for teach
  pref= typeof(pref) != 'undefined' ? pref: 'stud';
  if (pref == 'stud') {
    if (students[uid]) return students[uid];
    if (teachers[uid]) return teachers[uid];
  } else {
    if (teachers[uid]) return teachers[uid];
    if (students[uid]) return students[uid];
  }
  return { notfound:true, firstname:'--', lastname:'--', username:'--', id:uid, department:'--', institution:'--' };
}

function showdate(jsdate) {
  var d = new Date(+jsdate);
  var mdate = d.getDate();
  var mmonth = d.getMonth() + 1; //months are zero based
  var myear = d.getFullYear();
  var hh = d.getHours();
  var mm = d.getMinutes();
  return mdate+'.'+mmonth+'-'+myear + ' '+hh+':'+mm;
}

var dragstate = {};   // state of draggable elements
// some qtypes have dragndrop enabled
// they need to store state


function makeTrail() {
    var trail = '';
    var prev = wbinfo.coursename;
    for (var i=0,l=wbinfo.trail.length; i<l; i++) {
      var e = wbinfo.trail[i];
      trail += '<span id="tt'+e.id+'_a" class="gui cont container">'+prev+'</span>';
      prev = e.name;
    }
    //if (l > 0) trail += '<span class="chapter">' + prev + '</span>';
    if (wbinfo.pagelink || l > 0) trail += '<span id="tt'+wbinfo.containerid+'_a" class="gui chapter cont container">'+prev+'</span>';
    return trail;
}


function score2grade(score,grad) {
  grad= typeof(grad) != 'undefined' ? grad: 'medium';
  var grades   = {
    easy: {    // the TEST is easy - the grading is tuf at the top
      0.00: '1',
      0.21: '1+',
      0.26: '2-',
      0.32: '2',
      0.37: '2+',
      0.42: '3-',
      0.48: '3',
      0.55: '3+',
      0.58: '4-',
      0.62: '4',
      0.77: '4+',
      0.80: '5-',
      0.84: '5',
      0.92: '5+',
      0.97: '6-',
      0.98: '6'
             },
    medium: { // normal TEST, standard limits
      0.00: '1',
      0.21: '1+',
      0.26: '2-',
      0.32: '2',
      0.37: '2+',
      0.42: '3-',
      0.48: '3',
      0.55: '3+',
      0.58: '4-',
      0.64: '4',
      0.72: '4+',
      0.78: '5-',
      0.82: '5',
      0.90: '5+',
      0.96: '6-',
      0.97: '6'
             },
    hard: { // the TEST was hard, go easy on the grade limits
      0.00: '1',
      0.21: '1+',
      0.22: '2-',
      0.28: '2',
      0.32: '2+',
      0.38: '3-',
      0.44: '3',
      0.52: '3+',
      0.55: '4-',
      0.61: '4',
      0.67: '4+',
      0.70: '5-',
      0.78: '5',
      0.86: '5+',
      0.91: '6-',
      0.96: '6'
             }

  };
  var gradehash = grades[grad] || grades['medium'];
  var prev = '0.00';
  for (var lim in gradehash) {
    if (+lim > +score) return gradehash[prev];
    prev = lim;
  }
  return '6';
}


function subscribe_to(idd) {
    var elm = idd.substr(4).split('_'),
        teachid = elm[0],
        course = elm[1];
    $j("#"+idd).toggleClass("n2");
    if (subscriptlist[teachid] && subscriptlist[teachid][course]) {
        delete subscriptlist[teachid][course];
    } else {
      if (!subscriptlist[teachid] ) {
        subscriptlist[teachid] = {};
      }
      subscriptlist[teachid][course] = 1;
    }
    console.log("SUBSCRIBING TO:",subscriptlist);
    var val = JSON.stringify(subscriptlist);

    //$j.post(mybase+'/saveconfig', { "target":"subscription","value":subscriptlist }, function(comment) {
    $j.post(mybase+'/log/saveconfig', { "target":"subscription","value":val }, function(comment) {
    });
}

function crossResults() {
    var group;
    try {
      group = wbinfo.coursename.split('_');
      group = group[1];
    } catch(err) {
      group = '';
    }
    var trail = makeTrail();
    var anonym = wbinfo.courseinfo.contopt.anonym == 1;
    var s = '<div id="crosstab"><h1 class="result" id="tt'+wbinfo.containerid+'">CrossTab</h1>'
             +trail+'<div id="results"></div></div>';
    $j("#main").html(s);
    $j.post(mybase+'/log/crosstable',{ container:wbinfo.containerid}, function(results) {
           console.log(results);
           var cross = {};
           var userlist = [];
           var questcount = {};  // count how many of each
           var userscore = {};
           var useduser = {};  // done this user-question combo already
           for (var uai in results) {
               var ua = results[uai];
               if (useduser[ua.qid +'_'+ua.userid]) continue;
               useduser[ua.qid +'_'+ua.userid] = 1;
               if (ua.points == 0 || ua.qtype == 'info') continue;
               if (!cross[ua.qid]) cross[ua.qid] = {};
               cross[ua.qid][ua.userid] = ua;
               if (userlist.indexOf(ua.userid) < 0) {
                   userlist.push(ua.userid);
               }
               if (!questcount[ua.qid]) questcount[ua.qid] = { num:0, score:0 };
               if (ua.attemptnum) {
                 questcount[ua.qid].num++;
                 questcount[ua.qid].score += (+ua.score);
               }
               if (!userscore[ua.userid]) userscore[ua.userid] = 0;
               userscore[ua.userid] += (+ua.score);
           }
           var qorder = [];
           for (var q in questcount) {
               qorder.push( {id:q, count:questcount[q].num, score:questcount[q].score, discrim:0 } );
           }
           qorder.sort(function(a,b) { var d = b.count - a.count; return (d) ? d : b.score-a.score;  })

           var userorder = [];
           for (var u in userscore) {
               userorder.push( {id:u, score:userscore[u]});
           }
           userorder.sort(function(a,b) { return b.score - a.score;  })

           // for questions answered by more than 10
           // calculate discrimination ability (separates the studs into two groups)
           // mark those where 40% of score is given to 5 best studs
           var numstud = userorder.length;
           for (var qidi in qorder) {
               var qord = qorder[qidi];
               if (qord.count < 10) continue;   // to few to make judgement
               var qid = qord.id;
               var cro = cross[qid];
               var top5 = 0;
               for (var uui =0; uui < 5; uui++) {
                   var uu = userorder[uui].id;
                   if (cro[uu]) {
                       top5 += +cro[uu].score;
                   }
               }
               // now if top5 > 0.4 times total for this question then this
               // question discriminates efficiently
               if (+qord.score > 0 && +qord.count > 0) { // && top5/qord.score > 10/qord.count) {
                   qord.discrim = ((+top5)/(+qord.score) / (5/(+qord.count))).toFixed(1);
               }
           }


           var ss = '<p><p><p><p><p><table><tr><th>QNR/Elev</th><td>DISC</td>';
           for (var uui =0; uui < userorder.length; uui++) {
              var uu = userorder[uui].id;
              var elev = id2elev[uu];
              if (elev)  {
                var elevnavn =  anonym ? 'anonym elev ' + scramble(uu) : elev.firstname.caps()+ ' ' + elev.lastname.caps();
                ss += '<td><div class="rel"><div id="stu'+uu+'" class="angled stud">' + elevnavn + '</div></div></td>';
              } else {
                elev = teachers[uu];
                if (elev)  {
                  ss += '<td><div class="rel"><div id="stu'+uu+'" class="angled stud">' + elev.firstname.caps()+ ' ' + elev.lastname.caps() + '</div></div></td>';
                }
              }
              //ss += '<th>'+uu+'</th>';
           }
           ss += '</tr>';
           var sumscore = {};
           var totalscore = {};
           for (var qidi in qorder) {
               var qord = qorder[qidi];
               var qid = qord.id;
               var cro = cross[qid];
               var disc = '';
               // mark questions if they discriminate well (or inverted)
               if (qord.discrim) {
                   if (qord.discrim > 1.2) {
                      disc = '<span class="greenfont">'+qord.discrim+'</span>';
                   } else if (qord.discrim < 1) {
                      disc = '<span class="redfont">'+qord.discrim+'</span>';
                   } else {
                      disc = qord.discrim;
                   }
               }
               var disc = qord.discrim ? ((qord.discrim > 1.2) ? '<span class="greenfont">'+qord.discrim+'</span>'
                    : qord.discrim    ) : '';
               ss += '<tr><th>'+qid+'</th><td>' + disc +'</td>';
               for (var uui =0; uui < userorder.length; uui++) {
                   var uu = userorder[uui].id;
                   var txt = '';
                   var tclass = '';
                   if (cro[uu]) {
                    var ucro = cro[uu];
                    var displayscore = +ucro.score;
                    if (ucro.usercomment && ucro.usercomment != '') tclass += ' prliste';
                    if (ucro.teachcomment && ucro.teachcomment != '') tclass += ' bluelined';
                    if (tclass) tclass = 'class="'+tclass+'"';
                    if (!sumscore[uu]) sumscore[uu] = 0;
                    if (!totalscore[uu]) totalscore[uu] = 0;
                    sumscore[uu] += +displayscore;
                    totalscore[uu] += +ucro.points;
                    displayscore = displayscore.toFixed(2);
                    displayscore = (ucro.attemptnum) ? displayscore : '<span class="redfont">&nbsp;0&nbsp;</span>';
                    txt = displayscore;
                   }
                   ss += '<td '+tclass+'><a href="#'+qid+'_'+uu+'">'+txt+'</a></td>';
               }
               ss += '<td>'+((+qord.score).toFixed(1))+'</td>';
               ss += '</tr>';
           }
           // give sum totals for each stud
           ss += '<tr><th colspan=2 >Total</th>';
           for (var uui =0; uui < userorder.length; uui++) {
                   var uu = userorder[uui].id;
                   ss += '<td>';
                   var score = (+sumscore[uu]).toFixed(1);
                   ss += score;
                   ss += ' / '+ totalscore[uu] || 0;
                   ss += '</td>';
           }
           ss += '</tr>';
           ss += '</table>';
           ss += '<p><p><table><tr><th>QNR/Elev</th>';
           for (var uui =0; uui < userorder.length; uui++) {
              var uu = userorder[uui].id;
              var usr = getUser(uu);
              fn = usr.firstname.caps();
              ln = usr.lastname.caps();
              var elevnavn =  anonym ? 'anonym elev ' + scramble(uu) : fn + '&nbsp;' + ln;
              ss += '<th>'+elevnavn+'</th>';
           }
           ss += '</tr>';
           for (var qidi in qorder) {
               var qid = qorder[qidi].id;
               var cro = cross[qid];
               ss += '<tr><th>'+qid+'</th>';
               for (var uui =0; uui < userorder.length; uui++) {
                   var uu = userorder[uui].id;
                   ss += '<td id="'+qid+'_'+uu+'" class="crosstd">';
                   if (cro[uu]) {
                    var sscore = { userscore:0, maxscore:0 ,scorelist:{} };
                    ss += wb.render.normal.displayQuest(cro[uu],1,{},sscore,0,cro[uu].param.fasit);
                   }
                   ss += '</td>';
               }
               ss += '</tr>';
           }
           ss += '</table>';
           $j("#results").html(ss);
           MathJax.Hub.Queue(["Typeset",MathJax.Hub,"results"]);
          $j('#results .score').editable( updateScore , {
                       indicator      : 'Saving...',
                       tooltip        : 'Click to edit...',
                       submit         : 'OK'
                   });
          $j('#results .addcomment').editable( updateComment , {
                       indicator      : 'Saving...',
                       type           : 'textarea',
                       getValue       : getComment,
                       width          : '12em',
                       height         : '12em',
                       style          : 'display:block',
                       submit         : 'OK'
                   });
     });
}

function remarked() {
    // fetch questions that have notes added by other teach
    mylink = undefined;   // forget other orbits in quizeditor
    $j.get(mybase+'/log/remarked',function(res){
        if (res.length) {
            _.each(res,function(e) { remarks[e.id] = { text:e.teachcomment, uid:e.userid}; } );
            clusterlist = res.map(function(e) { return e.id; } );
            console.log("REMARKED:",clusterlist);
            questEdit(clusterlist.join(","));
        }
    });
}

function longList() {
    var group;
    var anonym = wbinfo.courseinfo.contopt.anonym == 1;
    try {
      group = wbinfo.coursename.split('_');
      group = group[1];
    } catch(err) {
      group = '';
    }
    var trail = makeTrail();
    var s = '<div id="wbmain"><h1 class="result" id="tt'+wbinfo.containerid+'">Long List</h1>'
             +trail+'<div id="results"></div></div>';
    $j("#main").html(s);
    $j.post(mybase+'/log/getuseranswers',{ container:wbinfo.containerid, group:group, contopt:wbinfo.courseinfo.contopt}, function(results) {
           if (results) {
             for (var uid in results.ret) {
                 var sscore = { userscore:0, maxscore:0 ,scorelist:{} };
                 if (results.ret[uid] != undefined) {
                    // var contopt = wbinfo.courseinfo.contopt;
                    $j.getJSON(mybase+'/log/displayuserresponse',{ uid:uid, container:wbinfo.containerid }, function(results) {
                      var rr = unwindResults(results,sscore);
                      var uid = results.uid;
                      var skala = wbinfo.courseinfo.contopt.skala;
                      score = Math.round(100*sscore.userscore)/100;
                      tot = Math.round(100*sscore.maxscore)/100;
                      var gr = Math.round(100*score/tot)/100;
                      var grade = score2grade(gr,skala);
                      var fn='-', ln='-',depp='-';
                      var usr = getUser(uid);
                      fn = usr.firstname.caps();
                      ln = usr.lastname.caps();
                      depp = usr.department;
                      if (anonym) {
                           fn = 'anonym';
                           ln = 'elev ' + scramble(uid);
                           depp = '';
                      }
                      var header = '<h4 class="pb" >'+fn+' '+ln+' '+depp+'</h4>';
                      $j("#results").append(header+rr);
                      MathJax.Hub.Queue(["Typeset",MathJax.Hub,"main"]);
                    });
             }
           }
         }
     });
}

function quizstats(ttype,using,ignoring) {
    if (!ttype) {
        ttype = 0;
    }
    var isteach = userinfo.department == 'Undervisning';
    var testtxt   = ['quiz','homework','lab','exam'][ttype];
    var course,group,config,basetemalist;
    var justnow = new Date();
    var canonical = false;
    try {
      course = wbinfo.coursename.split('_');
      group = course[1];
      course = course[0];
      config = database.courseteach[wbinfo.coursename].config || { tema:"" };
      try {
        var param = JSON.parse(config);
        basetemalist = param.tema ? param.tema.split(',') : [];
        canonical = true;
      } catch(err) {
        basetemalist = [];
      }
    } catch(err) {
      course = '';
      group = '';
      config =  { tema:"" };
      basetemalist = [];
    }
    var teachid = 0;
    if (database.courseteach && database.courseteach[wbinfo.coursename]) {
        teachid = database.courseteach[wbinfo.coursename].teach[0];
    }
    if (teachid == 0) return;
    if (course && group) {
        var elever = memberlist[group];
        if (!elever) return;
        if (ttype == 0) {
            wbinfo.trail.push({id:0,name:"progress" });
        }
        var s = '<div><div class="gui"><h1><span class="workbook" id="'+wbinfo.coursename+'">QuizStats</span></h1>'
                 + '<div id="elist" class="gui"></div><p></p><p></p></div>'
                 + '<div id="results"></div></div>';
        $j("#main").html(s);
        $j("#main").delegate("span.workbook","click",function() {
          var myid = this.id;
          workbook(myid);
        });
        $j.get(mybase+'/log/quizstats',{ teachid:teachid,studid:userinfo.id, subject:course, studlist:elever.join(',')},function(res){
            showstats(res,basetemalist);
        });
        function showstats(res,using,ignoring) {
            var temalist  = typeof(using) != 'undefined' ? using : basetemalist ;
            ignoring  = typeof(ignoring) != 'undefined' ? ignoring : [] ;
            var studstats = {}
            var sometags = {};
            var tagscore = {};
            var tagavg = {};
            var notused = {};
            var userscore = {};
            var usercount = {};    // number of tags for this user
            var userant = {};      // number of useranswers pr user
            var tagquizlist = {};  // connects a tag to quiz with same name
            var tgar = [];
            // build list of quizes with same name as tags
            if (res.tagquiz && res.tagquiz.rows) {
              for (var i=0,l=res.tagquiz.rows.length; i<l; i++) {
                  var line = res.tagquiz.rows[i];
                  if (!tagquizlist[line.name]) tagquizlist[line.name] = line.id;
                  // they are sorted by number of answers, only use the first
              }
            }
            for (var i=0,l=res.rows.length; i<l; i++) {
                var line = res.rows[i];
                if (_.isNaN(+line.avg)) continue;
                if (temalist && temalist.length && temalist.indexOf(line.tagname) < 0) {
                    notused[line.tagname] = notused[line.tagname] ? notused[line.tagname]+1 : 1;
                    continue;
                }
                if (!sometags[line.tagname]) sometags[line.tagname] = 0;
                if (!studstats[line.userid]) studstats[line.userid] = {};
                if (!tagscore[line.tagname]) tagscore[line.tagname] = 0;
                if (!userscore[line.userid]) userscore[line.userid] = 0;
                if (!usercount[line.userid]) usercount[line.userid] = 0;
                if (!userant[line.userid]) userant[line.userid] = 0;
                sometags[line.tagname] += 1;
                tagscore[line.tagname] += Math.min(1,+line.avg);
                userant[line.userid] += +line.ant;
                usercount[line.userid] += 1;
                userscore[line.userid] += Math.min(1,+line.avg);
                studstats[line.userid][line.tagname] = { ant:line.ant, avg:(Math.min(1,+line.avg)).toFixed(2)};
            }
            var avgcount = _.reduce(userant,function(m,n) { return m+n;   },0) / _.keys(userant).length;
            // average number of answers
            for (var tg in sometags) {
                tgar.push([tg,sometags[tg]]);
                tagavg[tg] = tagscore[tg]/sometags[tg];
            }
            var avgavg = tagavg.length ?  _.reduce(tagavg,function(m,n) { return m+n;   },0) /tagavg.length : 0;
            // average of tag-avreage giving total average
            var sortedstuds = _.keys(studstats);
            sortedstuds.sort(function(a,b) {
                if (usercount[a] < avgcount*0.65 || usercount[b] < avgcount*0.65) {
                   return usercount[b] - usercount[a];
                }
                return userscore[b]/usercount[b] - userscore[a]/usercount[a]
            });
            ignoring = _.union(ignoring,_.keys(notused));
            if (ignoring.length == 0 && temalist.length == 0) {
                temalist = _.keys(sometags);
            }
            tgar.sort(function(a,b) { return tagavg[b[0]] - tagavg[a[0]]});
            var s = '<p><p><p><p><table>';
            s += '<tr><th class="enavn">Navn</th>' + tgar.map(function(e) {
                   var hasid = '';
                   var active = '';
                   if (tagquizlist[e[0]]) {
                       hasid = ' id="qq'+tagquizlist[e[0]]+'" '
                       active = " catt1";
                   }
                   return '<td><div class="rel"><div '+hasid+'class="angled stud'+active+'" tag="'+e[0]+'">'+e[0]+'</div></div></td>'
                }).join('') + '<td>Avg</td><td>Ant</td></tr>';
            for (var ii=0,l=sortedstuds.length; ii<l; ii++) {
                var e = enr = sortedstuds[ii];
                if (!isteach && userinfo.id != enr) continue;
                if (students[enr]) {
                  var usr = students[enr];
                  fn = usr.firstname.caps();
                  ln = usr.lastname.caps();
                  e = fn + ' ' + ln;
                }
                s += '<tr class="studline"><th class="enavn" id="ee'+enr+'">'+e+'</th>';
                for (var i= 0; i < tgar.length; i++) {
                    var tg = tgar[i][0];
                    var inf = studstats[enr][tg];
                    var klas = '';
                    if (inf) {
                        if (inf.avg < tagavg[tg] && inf.avg < 0.7) {
                           klas = 'gg' + Math.floor(9-3*inf.avg/tagavg[tg]);
                        } else {
                           klas = 'gg' + Math.floor(3*(1-(Math.max(0,inf.avg-tagavg[tg]))/(1-tagavg[tg])));
                        }
                    }
                    s += '<td class="'+klas+'">'
                    s += inf ? inf.avg : '';
                    s += "</td>";
                }
                s += '<td class="showhide">'+(userscore[enr]/usercount[enr]).toFixed(2)+'</td>';
                s += '<td>'+(userant[enr])+'</td>';
                s += '</tr>';
            }
            s += '<tr><th>Avg</th>' + tgar.map(function(e) {
                   var t = e[0];
                   return '<td>'+(tagavg[t].toFixed(2))+'</td>'
                }).join('') + '<td>'+(avgavg.toFixed(2))+'</td><td>'+(avgcount.toFixed(0))+'</td></tr>';
            s += '</table>';
            s = '<div class="centered sized1"><div id="studinf"><h4>Egenvurdering for faget '+ course + '</h4>'
                   + 'På denne sida får du faglig tilbakemelding, framovermelding og anledning til egenvurdering. '
                   + 'Meningen er at du aktivt skal bruke sida til å styre innsatsen din i faget.'
                   + '<ul>'
                   + '<li>Ut fra tabellen under kan du selv vurdere hvilke emner du må arbeide videre med.'
                   + '<li>Emner markert med <span class="gg7">rødt</span> er de du er svakest i.'
                   + '<li>Emner markert med <span class="gg6">oransje</span> er emner hvor du klarer en god del av oppgavene.'
                   + '<li>Emner markert med <span class="gg2">grønt</span> er de du mestrer ganske godt.'
                   + '<li>Blanke emner viser at her har du ikke løst tilstrekkelig mange oppgaver til at systemet kan vurdere deg.'
                   + '<li>Fjern først de blanke feltene, så de røde, deretter de oransje.'
                   + '</ul></div>'
                   + s +'</div>';
            $j("#results").html(s);
            $j("#results").undelegate(".stud","click");
            $j("#results").delegate(".stud","click", containerClick);
            if (!isteach) {
                return;
            }
            $j("#studinf").toggle();
            var changed = false;  // no need to save
            var ingress = canonical ? 'Canonical tags for this course' : 'These tags used' ;
            var tagcontrol = '<div class="gui"><h3>'+ingress+'</h3>'
                + _.reduce(temalist,function(m,e,i) { return m+' <span class="catt1">'+e+'</span>'},"")
                + "<h3>These tags not shown</h3>" + _.reduce(ignoring,function(m,e) { return m+' <span class="catt0">'+e+'</span>'},"")
                + '<div id="saveconf" class="gradebutton">Save</div>'
                + '</div>'

            $j("#elist").html(tagcontrol);
            if (basetemalist.length == using.length && _.difference(basetemalist,using).length == 0) {
                $j("#saveconf").hide();
            }

            $j("#results").undelegate(".showhide","click");
            $j("#results").delegate(".showhide","click", function() {
                         $j(".studline").toggle();
                         $j(this).parent().toggle();
                         $j("#studinf").toggle();
                         $j("#elist").toggle();
                    });
            $j("#results").undelegate(".enavn","click");
            $j("#results").delegate(".enavn","click", function() {
                         $j(".enavn").toggleClass("whiteout");
                         $j(this).removeClass("whiteout");
                         $j("#studinf").toggle();
                         $j("#elist").toggle();
                    });

            $j("#results").undelegate(".enavn","click");
            $j("#results").delegate(".enavn","click", function() {
                         $j(".enavn").toggleClass("whiteout");
                         $j(this).removeClass("whiteout");
                         $j("#studinf").toggle();
                         $j("#elist").toggle();
                    });
            $j("#results").undelegate(".enavn","click");
            $j("#results").delegate(".enavn","click", function() {
                         $j(".enavn").toggleClass("whiteout");
                         $j(this).removeClass("whiteout");
                         $j("#studinf").toggle();
                         $j("#elist").toggle();
                    });
            // toggle tags to show
            $j("#elist").undelegate(".catt0","click");
            $j("#elist").delegate(".catt0","click", function() {
                        var txt = this.innerHTML;
                        showstats(res, _.union([txt],temalist), _.difference(ignoring,[txt])  );
                    });
            $j("#elist").undelegate(".catt1","click");
            $j("#elist").delegate(".catt1","click", function() {
                        var txt = this.innerHTML;
                        showstats(res, _.difference(temalist,[txt]), _.union([txt],ignoring));
                    });
            $j("#saveconf").click(function() {
                        $j("#saveconf").hide();
                    });
            function showsave() {
                $j("#saveconf").hide();
            }
         }
     }
}

var colorize = 0;

function showProgress(ttype) {
    if (!ttype) {
        ttype = 0;
    }
    var testtxt   = ['quiz','homework','lab','exam'][ttype];
    var course,group;
    var justnow = new Date();
    try {
      course = wbinfo.coursename.split('_');
      group = course[1];
      course = course[0];
    } catch(err) {
      course = '';
      group = '';
    }
    var teachid = 0;
    if (database.courseteach && database.courseteach[wbinfo.coursename]) {
        teachid = database.courseteach[wbinfo.coursename].teach[0];
    }
    if (teachid == 0) return;
    if (course && group) {
        var elever = memberlist[group];
        if (!elever) return;
        if (ttype == 0) {
            wbinfo.trail.push({id:0,name:"progress" });
        }
        //var trail = makeTrail();
        var s = '<div><h1 class="result" id="tt'+wbinfo.containerid+'">Progress</h1>'
                 +'<div id="results"></div></div>';
                 //+trail+'<div id="results"></div></div>';
        $j("#main").html(s);
        $j.get(mybase+'/log/progressview',{ teachid:teachid, subject:course, studlist:elever.join(',')}, function(res) {
            if (res.progress) {
                var history = res.history;
                var results = res.progress;
                var quizzes = res.quiz;
                var maxk = {};
                var cross = {};
                var ulist = [];
                var klist = {};
                var ucount = {};
                var kcount = {};
                var korder = [];
                for (var i=0,l=results.length; i<l; i++) {
                    var r = results[i];
                    if (quizzes[r.k].exam != "0" && quizzes[r.k].exam != testtxt) continue;
                    if (!cross[r.u]) {
                        cross[r.u] = {};
                        ulist.push(r.u);
                    }
                    if (!klist[r.k]) {
                        klist[r.k] = r.n;
                        korder.push(r.k);
                    }
                    cross[r.u][r.k] = { score:Math.round(+r.s), count:r.c, time:r.t };
                    maxk[r.k] = maxk[r.k] ? Math.max(+r.s,maxk[r.k]) : +r.s;
                    if (!kcount[r.k]) {
                        kcount[r.k] = 0;
                    }
                    kcount[r.k] ++;
                    if (!ucount[r.u]) {
                        ucount[r.u] = { count:0, score:0, last:0};
                    }
                    ucount[r.u].count += +r.c;
                    ucount[r.u].score += +r.s;
                    ucount[r.u].last = Math.max(ucount[r.u].last, r.t)
                }
                ulist.sort(function(a,b) { return ucount[b].score - ucount[a].score;} )
                korder.sort(function(a,b) { return kcount[b] - kcount[a];} )
                var s = '<span id="testornot">'+testtxt+'</span> <span id="colordate">date</span> <span id="colorscore">score</span><p><p><br><p><table>';
                s += '<tr><th></th>';
                for (var i=0,l=korder.length; i<l; i++) {
                   var k = korder[i];
                   s += '<td><div class="rel"><div id="'+k+'" title="'+k+'" class="angled stud">' + klist[k] + '</div></div></td>';
                }
                s += '<th>num</th><th>score</th><th>avg</th><th>Sist</th>';
                s += '</tr>';
                for (var i=0,ul=ulist.length; i<ul; i++) {
                    var u = ulist[i];
                    var e = u;
                    if (students[u]){
                        e = students[u].firstname;
                    } else {
                        e = '--';
                    }
                    s += '<tr><th>'+e+'</th>';
                    for (var j=0,kl=korder.length; j<kl; j++) {
                        var k = korder[j];
                        var kk = (cross[u] && cross[u][k]) ? cross[u][k] : undefined;
                        if (!kk) {
                            if (history[u] && history[u][k]) {
                                kk = {score:Math.round(6*history[u][k].score),count:0,time:history[u][k].time};
                            }
                        }
                        var ss = '';
                        var klass = '';
                        if (kk) {
                            var daysago = Math.floor((justnow.getTime() - kk.time)/(1000*60*60*24));
                            var color = Math.floor(Math.log(1+daysago));
                            if (colorize == 1) {
                              color = Math.max(0,Math.floor( 10*(maxk[k]-kk.score)/maxk[k] ));
                            }
                            klass = daysago ? ' title="For '+daysago+' dager siden"' : ' title="Today"';
                            klass += ' class="heck'+color+'" ';
                            ss = '<span class="ures" id="'+u+'_'+k+'" >'+kk.score+':'+kk.count + '</span>';
                        }
                        s += '<td'+klass+'> &nbsp; '+ss+'</td>'
                    }
                    var last = '';
                    var klass = '';
                    if (ucount[u].last) {
                        last = startTime( new Date(ucount[u].last));
                        var daysago = Math.floor((justnow.getTime() - ucount[u].last)/(1000*60*60*24));
                        var color = Math.floor(Math.log(1+daysago));
                        klass = daysago ? ' title="For '+daysago+' dager siden"' : ' title="Today"';
                        klass += ' class="heck'+color+'" ';
                    }
                    ucount[u].avg = ucount[u].count > 0 ? ucount[u].score / ucount[u].count : 0;
                    s += '<td>'+ ucount[u].count + '</td><td>'+(+ucount[u].score).toFixed(2)+'</td><td>'+(+ucount[u].avg).toFixed(2)+'</td>';
                    s += '<td'+klass+'>'+last+'</td>'
                    s += '</tr>';
                }
                s += '</table>';
                $j("#results").html(s);
                $j("#results").undelegate(".ures","click");
                $j("#results").delegate(".ures","click", function() {
                      //if (results.ret[uid] != undefined) {
                      var uk = this.id.split('_');
                      var ui = uk[0], kid = uk[1];
                      var rr = { ret:{} };
                      rr.ret[ui] = 1;
                      showUserResponse(ui,kid, rr );
                    });
                $j(".result").click(function() {
                      showProgress();
                    });
                $j("#testornot").click(function() {
                      showProgress((ttype + 1) % 4 ) ;
                    });
                $j("#colordate").click(function() {
                      colorize = 0;
                      showProgress(ttype);
                    });
                $j("#colorscore").click(function() {
                      colorize = 1;
                      showProgress(ttype);
                    });
                $j("#results").undelegate(".angled","click");
                $j("#results").delegate(".angled","click", function() {
                        editquestion(this.id);
                    });
            }
         });
     }
}

function startTime(d) {
  return d.getDate() + '/'+(1+d.getMonth())+ '/' + ("" +d.getFullYear()).substr(2) + ' ' + d.getHours() +':'+ d.getMinutes();
}



function scramble(n) {
  var i = +n;
  var prime = 7687; //982451653;
  var num = (i*i) % prime;
  num = i <= prime/2 ? num : prime - num;
  return num;
}

function showResults(group,container,contopt) {
    if (group == undefined) {
      try {
        group = wbinfo.coursename.split('_');
        group = group[1];
      } catch(err) {
        group = '';
      }
    }
    if (container == undefined) {
      container = wbinfo.containerid;
    }
    if (contopt == undefined) {
      contopt = wbinfo.courseinfo.contopt;
    }
    var sortdir = { fn:1, ln:1, grade:1 };  // sort direction
    var reslist = {};
    var showorder = [];   // will be sorted by choice on display page name/grade/time etc
    var displaylist = {};
    var trail = makeTrail();
    function makeSparkline(txt) {
      var spark = '';
      if (wbinfo.courseinfo.contopt.omstart && wbinfo.courseinfo.contopt.omstart == "1") {
        spark = '<span class="sparkline">';
        if (txt) {
         var elm = txt.split(',');
         for (var i=0,l=elm.length; i<l; i++) {
            var num = +elm[i];
            num = 16*Math.min(1,Math.max(0,num));
            var tt = 16-num;
            spark += '<div class="bar" style="height:'+num+'px; left:'+(3*i)+'px; top:'+tt+'px"></div>';
         }
        }
        spark += '</span>';
      }
      return spark;
    }
    var skala = wbinfo.courseinfo.contopt.skala;
    var anonym = wbinfo.courseinfo.contopt.anonym == 1;
    var s = '<div id="wbmain"><h1 class="result" id="tt'+wbinfo.containerid+'">Resultat </h1>'
             +trail+' &nbsp; <span class="bluefont cross" id="yy'+wbinfo.containerid+'">CrossTab</span>'
             + ' &nbsp; <span class="bluefont long" id="yy'+wbinfo.containerid+'">LongList</span><div id="results"></div></div>';
    //s += JSON.stringify(wbinfo.courseinfo.contopt);
    $j("#main").html(s);
    $j(".result").click(function() {
          showResults();
        });
    $j(".cross").click(function() {
          crossResults();
        });
    $j(".long").click(function() {
          longList();
        });
    $j.post(mybase+'/log/getuseranswers',{ container:container, group:group, contopt:contopt}, function(results) {
           // results = { res:{ uid ... }, ulist:{ 12:1, 13:1, 14:2, 15:2 }
           if (results) {
             for (var uid in results.ret) {
                var re = results.ret[uid];
                var score = (re.tot) ? re.score/re.tot : 0;
                var gr = Math.round(100*score)/100;
                var prosent = gr*100;
                var hist = makeSparkline(re.hist);
                var first = (re.start) ? startTime( new Date(re.start)) : '&nbsp;' ;
                var last = (re.fresh) ? startTime( new Date(re.fresh)) : '&nbsp;' ;
                var grade = score2grade(gr,skala);
                reslist[uid] = { text:'<span class="kara">' + prosent.toFixed(0) + ' prosent </span>'
                         +  ((wbinfo.courseinfo.contopt.karak == 1) ?'<span class="kara">karakter '+grade+'</span>' : '' )
                         + '<span class="kara"> '+first+'</span><span class="kara"> '+last+'</span>'+hist,
                                        grade:gr, first:re.start, last:re.fresh, hist:hist };
             }
             var teachesThisCourse= teaches(userinfo.id,wbinfo.coursename);
             for (var uui in results.ulist) {
               //var started = results.ulist[uui];
               var fn = '--',
                   ln = '--',
                   his = '--',
                   gg = -1,
                   ff = -1,
                   ll = -1,
                   resultat = '<span class="kara">ikke startet</span>';
               var active = '';  // add class for showing result if allowed
               var usr = getUser(uui);
               fn = usr.firstname.caps();
               ln = usr.lastname.caps();
               if (anonym) {
                   fn = 'anonym';
                   ln = 'elev ' + scramble(uui);

               }
               active =' showme';
               if (reslist[uui]) {
                 resultat = reslist[uui].text;
                 gg = reslist[uui].grade;
                 ff = reslist[uui].first;
                 ll = reslist[uui].last;
                 his = reslist[uui].hist;
               }
               var face = '';
               if (!anonym && teachesThisCourse) {
                   var pix = euids[uui] ? euids[uui]+'.jpg' : 'anonym.gif';
                   face = '<div class="upic"><img src="/skeisvangstat/pic/'+pix+'"></div>';
               }
               displaylist[uui] =  '<div id="ures'+uui+'" class="upics relative userres'+active+'"><span class="numb">1</span><span class="fn">' + fn + face
                 + '</span><span class="ln">' + ln + '</span>' + resultat + '</div>';
               showorder.push( { id:uui, fn:fn, ln:ln, grade:gg, first:ff, last:ll } );
             }
             _showresults();
             if (teachesThisCourse) {
               $j("#results").undelegate(".userres","click");
               $j("#results").delegate(".userres","click", function() {
                   var uid = this.id.substr(4);
                   showUserResponse(uid,wbinfo.containerid,results);
                });
             } else {
               $j("#results").undelegate(".showme","click");
               $j("#results").delegate(".showme","click", function() {
                   var uid = this.id.substr(4);
                   showUserResponse(uid,wbinfo.containerid,results);
                });
             }
             $j("#results").undelegate(".heading span","click");
             $j("#results").delegate(".heading span","click", function() {
                 var field = $j(this).attr("sort");
                 var dir = sortdir[field] || 1;
                 dir = -dir;
                 sortdir[field] = dir;
                 _showresults(field,dir);
              });
           }
        });
    function _showresults(field,dir) {
       field   = typeof(field) != 'undefined' ? field : 'grade' ;
       dir   = typeof(dir) != 'undefined' ? dir : -1 ;
       showorder.sort(function (a,b) {
             return a[field] == b[field] ? 0 : (a[field] > b[field] ? dir : -dir) ;
           });
       var display = '<div id="gradelist">';
       display +=  '<div class="userres heading"><span class="numb">#</span><span sort="fn" class="fn">Fornavn</span>'
                    + '<span sort="ln" class="ln">Etternavn</span><span sort="grade" class="kara">Score</span>'
                    + ((wbinfo.courseinfo.contopt.karak == 1) ? '<span sort="grade" class="kara">Grade</span>' : '' )
                    + '<span sort="first" class="kara">Start</span><span sort="last" class="kara">Siste</span></div>';
       for (var ii = 0; ii < showorder.length; ii++) {
         if (userinfo.department == 'Undervisning' || wbinfo.courseinfo.contopt.rank == 1 || userinfo.id == showorder[ii].id ) {
           //var numb = ii ? '<div class="studnum">'+ii+'</div>' : '';
           var toshow = displaylist[showorder[ii].id].replace(/<span class="numb">[0-9]+/,'<span class="numb">'+(ii+1));
           display += toshow;
         }
       }
       display += '<div class="userres"></div>';
       display += '</div>';
       $j("#results").html(display );
    }

}

function getComment(content) {
  return $j("#"+this.id).attr("title");
}

function updateComment(val,settings) {
  var myid = this.id;
  var uaid = myid.substr(3);
  $j.post(mybase+'/log/addcomment', { comment:val,  uaid:uaid }, function(comment) {
      // no action yet ..
      // REDRAW question so that comment shows
  });
  return val;
}

function updateScore(val,settings) {
  var myid = this.id;
  var elm = myid.substr(2).split('_');
  var qid = elm[0], iid = elm[1], uaid= elm[2],points=elm[3];
  val =  Math.min(+val,+points);
  $j.post(mybase+'/log/editscore', { nuval:val,  uaid:uaid}, function(ggrade) {
      // no action yet ..
  });
  return Math.min(+val,points);
}


function showUserResponse(uid,cid,results) {
  // given a user-id and a container
  // show detailed response for all questions in container for this user
  var sscore = { userscore:0, maxscore:0 ,scorelist:{} };
  var anonym = wbinfo.courseinfo.contopt.anonym == 1;
  if (results.ret[uid] != undefined) {
    // var contopt = wbinfo.courseinfo.contopt;
    $j.getJSON(mybase+'/log/displayuserresponse',{ uid:uid, container:cid }, function(results) {
      //var ss = wb.render.normal.displayQuest(rr,i,sscore,false);
      //var ss = JSON.stringify(results);
      var rr = unwindResults(results,sscore);
      var skala = 'medium';
      if (wbinfo.courseinfo && wbinfo.courseinfo.contopt ) {
        skala = wbinfo.courseinfo.contopt.skala;
      }
      score = Math.round(100*sscore.userscore)/100;
      tot = Math.round(100*sscore.maxscore)/100;
      var gr = Math.round(100*score/tot)/100;
      var grade = score2grade(gr,skala);
      var fn='-', ln='-',depp='-';
      var usr = getUser(uid);
      fn = usr.firstname.caps();
      ln = usr.lastname.caps();
      depp = usr.department;
      if (anonym) {
           fn = 'anonym';
           ln = 'elev ' + scramble(uid);
           depp = '';
      }
      var header = '<h4>'+fn+' '+ln+' '+depp+'</h4>';
      header += '<h4>'+score+" av "+tot+" Karakter: "+grade+'</h4>'
        + ((teaches(userinfo.id,wbinfo.coursename)) ?
         '<div title="Slett besvarelsen" id="renew" class="gui gradebutton">Slett</div>' : '');
      $j("#results").html(header+rr);
      $j('#results .score').editable( updateScore , {
                   indicator      : 'Saving...',
                   tooltip        : 'Click to edit...',
                   submit         : 'OK'
               });
      $j('#results .addcomment').editable( updateComment , {
                   indicator      : 'Saving...',
                   type           : 'textarea',
                   getValue       : getComment,
                   width          : '12em',
                   height         : '12em',
                   style          : 'display:block',
                   submit         : 'OK'
               });
      MathJax.Hub.Queue(["Typeset",MathJax.Hub,"main"]);
      $j("#renew").click(function() {
           $j.post(mybase+"/log/studresetcontainer",{ uid:uid, container:wbinfo.containerid},function(res) {
             showResults();
           });
        });
    });
  }
}

function unwindResults(res,sscore) {
      var rr = '';
      var ss = [];
      for (var qid in res.q) {
        var qua = res.q[qid];
        for (var iid in qua) {
          var qu = qua[iid];
          var qdiv = wb.render.normal.displayQuest(qu,iid,{},sscore,0,qu.param.fasit);
          ss[iid] = qdiv;
        }
      }
      rr = ss.join('');
      for (var qid in res.c) {
        rr += '<h4>'+res.c[qid].name+'</h4>'+unwindResults(res.c[qid],sscore);
      }
      return rr;
}

var contopt = {};   // options for this container

function containerClick() {
            if ( $j(this).hasClass("clock")) {
               if (!teaches(userinfo.id,wbinfo.coursename)) {
                 alert("Test not open");
                 return;
               }
            }
            var containerid = this.id.substr(2).split('_')[0];
            if (containerid == wbinfo.containerid) {
              // self-click - last element in trail is ident
              // just reset page and rerender
              if (contopt && contopt.navi && contopt.navi == "1") {
                wbinfo.page[containerid] = 0;
                renderPage();
              } else {
                renderPage();
              }
              return;
            }
            var istrail = ( this.id.substr(0,2)  == 'tt');
            if (istrail) {
              // pop from trail until we hit this container-id
              var cinf;
              do {
                cinf = wbinfo.trail.pop();
              } while (wbinfo.trail.length > 0 && cinf.id != containerid );
            } else {
              wbinfo.trail.push({id:wbinfo.containerid,name:$j("#"+this.id).attr("tag") });
            }
            wbinfo.page[containerid] = wbinfo.page[containerid] || 0;
            wbinfo.parentid = wbinfo.containerid;   // remember parent
            wbinfo.containerid = containerid;
            renderPage();
    };


function renderPage() {
  // render a page of questions
  // if questions pr page is given
  // then render that many + button for next page
  //   also if navi is set then render back button when not on first page
  relax(30000);  // we are not editing - so relax
  $j.getJSON(mybase+'/log/getqcon',{ container:wbinfo.containerid }, function(container) {
    ignorehashchg = true;   // dont reload this page just because we set new hash
    tablets = { usedlist:{} };    // forget any stored info for dragndrop for tablets on rerender
    if (!container) {
      // we are most likely not logged in any more
      $j("#main").html("Not logged in - session expired or server restart<p>Reload page and logg in again.");
      return;
    }
    var courseinfo;
    try {
      eval( 'courseinfo = '+container.qtext);
    }
    catch(err) {
      courseinfo = {};
    }
    wbinfo.page[wbinfo.containerid] = wbinfo.page[wbinfo.containerid] || 0;
    wbinfo.missing[wbinfo.containerid] = wbinfo.missing[wbinfo.containerid] || 0;
    wbinfo.courseinfo = courseinfo;
    wbinfo.qlistorder = courseinfo.qlistorder || [];
    // call the render functions indexed by layout
    // render the question list and update order if changed
    // typeset any math
    // prepare the workbook editor (setupWB)
    wbinfo.coursename = wbinfo.coursename || container.name;

    var trail = makeTrail();
    var nav   = '';              // default no page navigation

    contopt = {};
    if (courseinfo.contopt) {
      contopt = courseinfo.contopt;
    }

    var header,  // header for first page
        body;    // som text info on first page

    // if this is a quiz ...
    if (container.qtype == 'quiz') {
      $j.bbq.pushState("#quiz/" + wbinfo.containerid);
      trail += '<h1 id="quiz" class="gui">'+container.name+'<div class="popme">⇐ vis resultat</div></h1>';
      header = '';
    } else {
        header = wb.render[wbinfo.layout].header();
    }
    body = wb.render[wbinfo.layout].body();

    var s = '<div id="wbmain">'+header + trail + body +  '</div>';
    $j("#main").html(s);
    if (teaches(userinfo.id,wbinfo.coursename)) {
      //if (userinfo.department == 'Undervisning') {
      $j("span.wbteachedit").addClass("wbedit");
    }
    $j(".totip").tooltip({position:"bottom right" } );
    $j("#main").undelegate("#nextpage","click");
    $j("#main").delegate("#nextpage","click", function() {
        if ( $j(this).hasClass("disabled") ) return;
        wbinfo.page[wbinfo.containerid] ++;
        renderPage();
    });
    $j("#main").undelegate("#prevpage","click");
    $j("#main").delegate("#prevpage","click", function() {
          wbinfo.page[wbinfo.containerid] --
          renderPage();
    });
    $j("#main").undelegate("#editwb","click");
    $j("#main").delegate("#editwb","click", function() {
        setupWB(header);
    });
    $j("#main").undelegate("#edqlist","click");
    $j("#main").delegate("#edqlist","click", function() {
        edqlist();
    });
    $j("#main").undelegate("span.drop","click");
    $j("#main").delegate("span.drop","click", function() {
        //$j("h1.wbhead").html( this.id );
        var thisq = this.id.substr(2).split('_')[0];
        var thisinst = this.id.substr(2).split('_')[1];
        if (thisq == tablets.qnr && thisinst == tablets.instance && tablets.dropvalue) {
          $j("#"+this.id).html( tablets.dropvalue );
          $j("#"+tablets.active).addClass('used');
          $j("#"+tablets.active).removeClass('act');
          tablets.usedlist[tablets.active] = this.id;
          delete tablets.dropvalue;
        }
    });
    $j(".wbhead").click(function() {
        showProgress();
    });
    $j("#quizstats").click(function() {
        quizstats();
    });
    $j("#main").undelegate("div.gethint","click");
    $j("#main").delegate("div.gethint","click", function() {
          var myid = this.id;
          var elm = myid.substr(4).split('_');
          $j.get(mybase+'/log/gimmeahint',{ qid:elm[0], uaid:elm[1] }, function(hints) {
               $j('#'+myid).html(hints.join('<br>'));
               MathJax.Hub.Queue(["Typeset",MathJax.Hub,myid]);
            });
        });
    $j("#main").undelegate("ul.sequence","click");
    $j("#main").delegate("ul.sequence, ul.sourcelist","click", function() {
          var nuelm = $j("#"+tablets.active);
          $j("#"+this.id).append(nuelm);
        });
    $j("#main").undelegate("li.dragme","click");
    $j("#main").delegate("li.dragme","click", function() {
        // for ipad and android
        $j("li.dragme").removeClass('act');
        tablets.active = this.id;
        $j("#"+tablets.active).addClass('act');
        tablets.qnr = this.id.substr(3).split('_')[0];
        tablets.instance = this.id.substr(3).split('_')[1];
        });
    $j("#main").undelegate("span.dragme","click");
    $j("#main").delegate("span.dragme","click", function() {
        // for ipad and android
        $j("span.dragme").removeClass('act');
        if (tablets.usedlist[this.id]) {
          $j("#" + tablets.usedlist[tablets.active]).html('&nbsp;&nbsp;&nbsp;&nbsp;');
          delete tablets.usedlist[tablets.active];
        }
        tablets.active = this.id;
        $j("#"+tablets.active).removeClass('used');
        $j("#"+tablets.active).addClass('act');
        tablets.qnr = this.id.substr(3).split('_')[0];
        tablets.instance = this.id.substr(3).split('_')[1];
        tablets.dropvalue = this.innerHTML;
    });
    $j("#main").undelegate("#quiz","click");
    $j("#main").delegate("#quiz","click", function() {
        showResults();
    });
    function afterEffects() {
        MathJax.Hub.Queue(["Typeset",MathJax.Hub,"main"]);
        $j('#main .addcomment').editable( updateComment, {
                   indicator      : 'Saving...',
                   type           : 'textarea',
                   getValue       : getComment,
                   width          : '12em',
                   height         : '2em',
                   style          : 'display:block',
                   submit         : 'OK'
               });
        $j("span.dragme").draggable( {
              revert:true,
              start:function(event,ui) {
                var droppid = ui.helper.attr("id");
                $j("#"+droppid).removeClass('used');
                var parid = $j("#"+droppid).parent().attr("id");
                $j("#"+parid+' span[droppid="'+droppid+'"]').removeAttr('droppid').removeClass("filled").html("&nbsp;&nbsp;&nbsp;&nbsp;");
              }
              // containing in parent is troublesome if we are close to right/left edge and
              // the dragged element is wide - cant get element centered on target
              //containment:'parent'
            } );
        $j("span.drop").droppable({
            drop:function(event,ui) {
              // alert(this.id + " gets " + ui.draggable.attr("id"));
              var droppid = ui.draggable.attr("id");
              var nutxt = ui.draggable.html();
              ui.draggable.addClass('used');
              var parid = $j(this).parent().attr("id");
              $j("#"+parid+' span[droppid="'+droppid+'"]').removeAttr('droppid').removeClass("filled").html("&nbsp;&nbsp;&nbsp;&nbsp;");
              $j(this).attr("droppid",droppid).html(nutxt).addClass("filled");
            },
            hoverClass:"ui-state-hover"
          });
        $j( "ul.sequence, ul.sourcelist" ).sortable({
              // containment:
              connectWith: ".connectedSortable"
         }).disableSelection();
        $j("#main").undelegate(".cont","click");
        $j("#main").delegate(".cont","click", containerClick);
        $j("#main").undelegate(".validate","keypress");
        $j("#main").delegate(".validate","keypress",function(e) {
            var subus = $j(this).attr("subtype");
            switch(subus) {
                case "0":  //  match plain number
                case "3":  //  plain number - test against nor(x,y)
                case "4":  //  plain number - range test
                case "7":  //  plain number - list of correct values
                    return validNum(e,/[-+.eE0-9]+/ );
                    break;
                default:
                    return true;
                    break;
            }

        });
       prettyPrint();

    }

    function validNum(event,reg) {
      var code = (event.keyCode ? event.keyCode : event.which);
      var character = String.fromCharCode(code);
      if (character.match(reg)) return;
      event.preventDefault();
    }

    $j.getJSON(mybase+'/log/getcontainer',{ container:wbinfo.containerid }, function(wqqlist) {
      // list of distinct questions - can not be used for displaying - as they may need
      // modification based on params stored in useranswers
      // the questions are 'stripped' of info giving correct answer
        wbinfo.taglist = wqqlist.taglist;
        var qlist = wqqlist.qlist;
        var showlist = generateQlist(qlist);
        var pagenum = '';
        if (contopt.antall < qlist.length) {
          // show page number
          pagenum = 'Side ' + (+wbinfo.page[wbinfo.containerid] + 1);
        }
        if (showlist.length) {
          wb.render[wbinfo.layout].qlist(wbinfo.containerid, showlist, contopt, function(renderq) {
                $j("#qlist").html( renderq.showlist);
                $j("#progress").html( '<div id="page">'+pagenum+'</div><div id="maxscore">'
                            +renderq.maxscore+'</div><div id="uscore">'+renderq.uscore+'</div>');
                wbinfo.maxscore = renderq.maxscore;
                afterEffects();
                if (contopt.omstart && contopt.omstart == "1") {
                    $j("#progress").append('<div title="Gi meg ett nytt sett med spørsmål" id="renew" class="gui gradebutton">Lag nye</div>');
                    $j("#renew").click(function() {
                       $j.post(mybase+"/log/studresetcontainer",{ uid:userinfo.id, container:wbinfo.containerid},function(res) {
                         renderPage();
                       });
                    });
                }
                // if the test is locked for grading (all studs completed).
                if (!(contopt.locked && contopt.locked == "1")) {
                    $j(".grademe").html('<div class="gradebutton">Vurder</div>');
                    $j("#qlistbox").undelegate(".grademe","click");
                    $j("#qlistbox").delegate(".grademe","click", function() {
                        var myid = $j(this).parent().attr("id");
                        if (myid == undefined) {
                            $j("#quiz").html("Feil i html for dette spørsmålet ...");
                            return;
                        }
                        var elm = myid.substr(5).split('_');  // fetch questionid and instance id (is equal to index in display-list)
                        var qid = elm[0], iid = elm[1];
                        var rr = wb.getUserAnswer(qid,iid,myid,renderq.qrender);
                        var ua =rr[0], missing = rr[1], jserror=rr[2];
                        var answered = _.filter(ua,function(e) { return e !== ''});
                        //console.log("USERANSWER=",ua,answered);
                        if (jserror != '') {
                            // the questiontype is js, the entered javascript has errors
                            alert(jserror);
                            return;
                        }
                        if (missing && answered.length < missing ) {  // missing only set for numeric,fillin questions
                            // not all elements answered
                            if (youSure[qid] == undefined) {
                                youSure[qid] = 1;       // page reload clears this cache
                                alert("Fill inn answers in all fields before grading");
                                return;
                            }
                        }
                        $j("#"+myid+" div.gradebutton").html("Lagrer..");
                        $j("#"+myid+" div.gradebutton").addClass("working");
                        $j.post(mybase+'/log/gradeuseranswer', {  contopt:contopt, iid:iid, qid:qid, cid:wbinfo.containerid, ua:ua }, function(ggrade) {
                              if (ggrade.completed == 1) {
                                 renderPage();
                              } else {
                                ggrade.qua.attemptnum=ggrade.att-1;
                                ggrade.qua.display = ggrade.qua.param.display;
                                ggrade.qua.score = ggrade.score;
                                wb.render[wbinfo.layout].qrend(contopt,iid,qid,ggrade.qua,renderq.qrender,renderq.scorelist,function(adjust) {
                                      //$j("#qlist").html( renderq.showlist);
                                      $j("#"+adjust.sscore.qdivid).html(adjust.sscore.qdiv);
                                      $j("#"+adjust.sscore.scid).html( adjust.sscore.userscore);
                                      $j("#"+adjust.sscore.atid).html( ggrade.att);
                                      $j("#"+adjust.sscore.qdivid +" .wantfocus input").focus();
                                      $j("#uscore").html(Math.floor(100*adjust.sumscore) / 100);
                                      redrawQuestion(iid,ggrade.att,adjust.sscore.userscore);  // redraw next question if any
                                });
                              }
                        });
                    });
                };


              function redrawQuestion(iid,att,score) {
                var doafter = true;
                if (att == 1) wbinfo.missing[wbinfo.containerid]--;
                if (wbinfo.missing[wbinfo.containerid] < 1) {
                  $j("#nextpage").removeClass("disabled");
                }
                if (contopt.trinn == "1") {
                 var nuid = +iid + 1;
                 var myid = $j(".qq"+nuid).attr("id");
                 if (myid && (att>4 || score > 0.8) ) {
                   var elm = myid.substr(2).split('_');  // fetch questionid and instance id (is equal to index in display-list)
                   var qid = elm[0];
                   var qu = renderq.qrender[nuid];
                   if (qu.param.donotshow) {
                     qu.param.donotshow = 0;
                     doafter = false;
                     wb.render[wbinfo.layout].qrend(contopt,nuid,qid,qu,renderq.qrender,renderq.scorelist,function(addj) {
                         $j("#"+addj.sscore.qdivid).html(addj.sscore.qdiv);
                         $j("#"+addj.sscore.scid).html( addj.score);
                         $j("#"+addj.sscore.atid).html( qu.attemptnum);
                         afterEffects();
                         $j(".grademe").html('<div class="gradebutton">Vurder</div>');
                      });
                   }
                  }
                }
                if (doafter) {
                       afterEffects();
                       $j(".grademe").html('<div class="gradebutton">Vurder</div>');
                }
              }
          });
        } else {
          // no questions added yet - give some suggestions
          if (teaches(userinfo.id,wbinfo.coursename)) {
            var info = '<p class="bigf">Klikk på blyanten for å legge til spørsmål.';
            if (trail == '') {
              info += '<p class="bigf">På dette nivået bør du bare legge quiz-er.'
                   + "<br>dvs legg til spørsmål, endre type til quiz."
                   + "<br>Legg nye spørsmål inne i quizene";
            }
            $j("#qlist").html(info);
          }
        }
    });
  });
}

function generateQlist(qlist) {
      var showlist = [];
      if (qlist) {
        // qlist is list of questions in this container
        var ql = {};
        var trulist = []; // a revised version of qlistorder where ids are good
        var changed = false;
        for (var qi in qlist) {
          var qu = qlist[qi];
          ql[qu.id] = qu;
        }
        // check if each question is in qlistorder
        // missing questions will be added to qlistorder
        for (var qi in ql) {
          var hit = false;
          for (var qli in wbinfo.qlistorder) {
            var qlii = wbinfo.qlistorder[qli];
             if (+qi == +qlii) {
                hit = true;
                break;
             }
          }
          if (!hit) {
            changed = true;
            wbinfo.qlistorder.push(qi);
          }
        }
        var points = 0;
        //console.log(wbinfo);
        for (var qi in wbinfo.qlistorder) {
          var quid = wbinfo.qlistorder[qi];
          if (ql[quid]) {
            trulist.push(quid);
            var qu = ql[quid];
            points += +qu.points;
            showlist.push(qu);
          } else {
              console.log("MISSIL ",ql,quid);
              changed = true;
          }
        }
        // update qlistorder in the container if different from orig
        if (changed) {
          console.log("CHANGED ",trulist,wbinfo.qlistorder,points);
          wbinfo.courseinfo.qlistorder = trulist;
          $j.post(mybase+'/log/editquest', { action:'update',cache:1,  points:points, qtext:wbinfo.courseinfo, qid:wbinfo.containerid }, function(resp) {
          });
        }

        // original
      }
      wbinfo.qlist = qlist;
      //console.log(showlist);
      return showlist;
}

function getTimmy(coursename,timmy,tidy) {
    if (timetables && timetables.course) {
      for (var tt in timetables.course[coursename] ) {
        var tty = timetables.course[coursename][tt];
        if (!timmy[tty[0]]) {
          timmy[tty[0]] = {};
          tidy [tty[0]] = [];
        }
        if (timmy[ tty[0] ][ tty[1] ]) continue;
        timmy[ tty[0] ][ tty[1] ] = 1;
        tidy[ tty[0] ].push(""+(1+tty[1]));
      }
    }
}

function edqlist() {
  relax(5000);  // we are showing a list for editing - so worry about connection
  var showlist = generateQlist(wbinfo.qlist);
  var showqlist = wb.render[wbinfo.layout].editql(showlist);
  var header = wb.render[wbinfo.layout].header();
  var head = '<h1 class="wbhead">' + header + '</h1>' ;
  var s = '<div id="wbmain">' + head + '<div id="qlistbox"><div id="sortable">'
         +showqlist
         + '</div><div title="Lag nytt spørsmål" id="addmore" class="button">add</div>'
         + '<div title="Nullstill svarlista" id="reset" class="gradebutton">reset</div>'
         + '<div title="Exporter spørsmål" id="export" class="gradebutton">export</div>'
         + '<div title="Importer spørsmål" id="import" class="gradebutton">import</div>'
         + '<div title="Oppdater - hent/send nyeste versjon" id="update" class="gradebutton">sync</div>'
         + '<div tag="'+wbinfo.containerid+'" title="Rediger QUIZ" id="edquiz" class="gradebutton">REDIGER</div>'
         + '<div id="qlist" class="qlist"></div>'
         + '<div id="importdia" ></div>'
         + '<div title="Gjenskap beholdere med elevsvar, ikke bruk dersom tillfeldig utvalg" id="regen" class="gradebutton">regen</div>'
         + '<div title="Legg til eksisterende sprsml" id="attach" class="gradebutton">attach</div></div></div>';
  $j("#main").html(s);
  $j("#sortable").sortable({placeholder:"ui-state-highlight",update: function(event, ui) {
            var ser = $j("#sortable").sortable("toArray");
            var trulist = [];
            for (var i=0,l=ser.length; i<l; i++) {
              trulist.push(ser[i].split('_')[1]);
            }
            wbinfo.courseinfo.qlistorder = trulist;
            $j.post(mybase+'/log/editquest', { action:'update', cache:1, qtext:wbinfo.courseinfo, qid:wbinfo.containerid }, function(resp) {
            });
          }
       });
  $j("#qlist").dialog({ width:550, height:500, autoOpen:false, title:'Pick question',
     buttons: {
       "Cancel": function() {
             $j( this ).dialog( "close" );
        },
       "Oppdater": function() {
               $j( this ).dialog( "close" );
               var nulist = $j.map($j("#qqlist div.chooseme"),function(e,i) {
                    return e.id.substr(4);
                  });
               // filter the new list removing questions already in container
               // this is the set of questions to insert intoquestion_container
               if (wbinfo.courseinfo.qlistorder && wbinfo.courseinfo.qlistorder.length) {
                 var nufilter = $j.grep(nulist,function(e,i) {
                   return ($j.inArray(e,wbinfo.courseinfo.qlistorder) < 0 );
                 });
               } else {
                 nufilter = nulist;
                 wbinfo.courseinfo.qlistorder = [];
               }
               $j.post(mybase+'/log/editqncontainer', { action:'insert', container:wbinfo.containerid, nuqs:nufilter.join(',') }, function(resp) {
                    wbinfo.courseinfo.qlistorder = wbinfo.courseinfo.qlistorder.concat(nulist);
                    $j.post(mybase+'/log/editquest', { action:'update', cache:1, qtext:wbinfo.courseinfo, qid:wbinfo.containerid }, function(resp) {
                      //workbook(wbinfo.coursename);
                      renderPage();
                    });
               });
            }
         }
  });
  $j("#attach").click(function() {
    var dia = ''
        + '<div id="selectag"><span class="tagtitle">Tags</span>'
        + '  <div id="chtag"></div>'
        + '  <div id="qqlist"></div>'
        + '</div>'
        + '<div id="multi"> Multiple: <input id="mult" name="mult" type="checkbox"></div>';
    $j("#qlist").html(dia);
    var taggis = {};
    var subject = wbinfo.coursename.split('_')[0];
    var containername = wbinfo.trail;
    if (containername && containername.length) {
      containername = containername[containername.length-1].name;
      subject = subject + ','+containername;
    }
    $j.getJSON(mybase+'/log/gettags', { subject:subject }, function(tags) {
         var mytags = tags[userinfo.id] || [];
         mytags.push(containername);  // the container name is also used as subject and tag
         var tlist = [];
         for (var i=0,l=mytags.length; i<l; i++) {
           var tag = mytags[i];
           tlist.push('<div id="tt'+tag+'" class="tagdiv"><div class="tagg">'+tag+'</div></div>');
         }
         tlist.push('<div id="ttnon" class="tagdiv"><div class="tagg">uten tag</div></div>');
         tlist.push('<div id="ttquizlist" class="tagdiv"><div class="tagg">alle quiz</div></div>');
         $j("#chtag").html(tlist.join(''));
         $j("#qlist").dialog('open');
         $j("#qqlist").undelegate(".equest","click");
         $j("#qqlist").delegate(".equest","click", function() {
              var myid = this.id;
              $j("#"+myid).toggleClass("chooseme");
           });
         $j("#selectag").undelegate(".tagdiv","click");
         $j("#selectag").delegate(".tagdiv","click", function() {
           $j("#qlistbox div.equest").removeClass("chooseme");
           var mytag = this.id;
           var tagname = mytag.substr(2);
           if (taggis[tagname]) {
             delete taggis[tagname];
             $j("#"+mytag).removeClass("tagon");
           } else {
             taggis[tagname] = 1;
             $j("#"+mytag).addClass("tagon");
           }
           var taglist = Object.keys(taggis).filter(function(e) { return e.length > 0;}).join(',');
           console.log("TAGLIST=",taglist);
           $j.getJSON(mybase+'/log/getquesttags',{ tags:taglist, subject:subject }, function(qtlist) {
                // qtlist = { tagname:{ teachid:[qid,..], ... }
                var mmu = $j("#mult").is(":checked");
                //var mmu =  (multi && multi.length) ? true : false;
                var qqlist = [];
                var xqqlist = [];
                var tagsforq = {}; // tags for question
                var qids = {};     // list of seen questions
                var totag = 0;     // count of tags
                taggis = {};       // remove mark from tags
                $j(".tagdiv").removeClass("tagon");
                if (qtlist ) {
                  // first gather all tags for questions
                  for(var tname in qtlist) {
                    for(var i in qtlist[tname][userinfo.id]) {
                      var qqa =qtlist[tname][userinfo.id][i];
                      if (!tagsforq[qqa.id]) {
                        tagsforq[qqa.id] = [];
                      }
                      tagsforq[qqa.id].push(tname);
                    }
                  }
                  for(var tname in qtlist) {
                    totag++;
                    for(var i in qtlist[tname][userinfo.id]) {
                      var qqa =qtlist[tname][userinfo.id][i];
                      var status = qqa.status;
                      var statusclass = '';
                      if (status != undefined && status != 0) {
                        statusclass = ' status'+status;
                      }
                      var param = {};
                      try {
                        param = JSON.parse(qqa.qtext);
                      }
                      catch (err) {
                        param = {};
                      }
                      var already = $j.inArray(""+qqa.id,wbinfo.qlistorder) >= 0;
                      if (already) {
                        $j("#qq_"+qqa.id).addClass("chooseme");
                      }
                      if (mmu || !already) {
                        if (!qids[qqa.id]) {
                          qids[qqa.id] = 0;
                          var containedqs = '';
                          if (param.qlistorder) {
                              var colr = qqa.parent ? 'redfont' : 'bluefont';
                              var parentname = '';
                              if (qqa.parent && qqa.ptid != userinfo.id) {
                                  if (teachers[qqa.ptid]) {
                                  var teach = teachers[qqa.ptid];
                                  parentname = ' title="'+(teach.firstname.substr(0,12))+ "&nbsp;"+(teach.lastname.substr(0,12)) + '" ';
                                  }
                              }
                              containedqs = ' <span '+parentname+'class="'+colr+'">'+param.qlistorder.length+'</span>';
                          }
                          var shorttext = param.display || '';
                          var duup = already ? 'duup' : '';
                          shorttext = shorttext.replace(/</g,'&lt;');
                          shorttext = shorttext.replace(/>/g,'&gt;');
                          shorttext = shorttext.toLowerCase();
                          shorttext = shorttext.replace(/['"]/g,'«');
                          var tit = tagsforq[qqa.id].join(',');
                          var shortname = qqa.name.substr(0,12);
                          var qdiv = '<div title="'+tit+'" class="equest listqq '+statusclass+duup+'" id="zqq_'+qqa.id+'"><span class="qid">'
                                     + qqa.id+ '</span><span class="img img'+qqa.qtype+'"></span>'
                                     + '<span >' + qqa.qtype + '</span><span title="'+qqa.name+'" > '
                                     + shortname + '</span><span title="'+shorttext+'">' + shorttext.substr(0,15) + containedqs
                                     + '</span></div>';
                                     // just to help colorize '
                          qqlist.push([qqa.id,qdiv]);
                        }
                        qids[qqa.id] += 1;
                      }
                      taggis[tname] = 1;
                      $j("#tt"+tname).addClass("tagon");
                    }
                  }
                }
                // shift questions to the right - depending on how few tags they have
                // questions with all tags applied will be flush to the left edge
                // first we sort em so that qs with most tags are at top
                function sso(a,b) {
                      return qids[b[0]] - qids[a[0]];
                }
                qqlist.sort(sso);
                for (var i=0; i< qqlist.length; i++) {
                  xqqlist.push(qqlist[i][1]);
                }
                $j("#qqlist").html(xqqlist.join(''));
                for (var qiq in qids) {
                  var qii = qids[qiq];  // count of tags for question
                  $j("#zqq_"+qiq).css("margin-left",(totag -qii)*3);
                  if (qii == totag) {
                    $j("#zqq_"+qiq).addClass('tagon');
                  }
                }

           });
         });
     });
     return false;
  });
  $j("#addmore").click(function() {
      // the newly created question is given subject based on coursename
      var subject = wbinfo.coursename.split('_')[0];
      $j.post(mybase+'/log/editqncontainer', { action:'create', container:wbinfo.containerid, subject:subject }, function(resp) {
         $j.getJSON(mybase+'/log/getcontainer',{ container:wbinfo.containerid }, function(qlist) {
           wbinfo.qlist = qlist.qlist;
           wbinfo.haveadded  += 1;
           edqlist();
         });
      });
  });
  $j("#reset").click(function() {
     $j.post(mybase+"/log/resetcontainer",{ container:wbinfo.containerid});
     show_thisweek();
  });
  //*
  $j("#regen").click(function() {
     var group;
     try {
        group = wbinfo.coursename.split('_');
        group = group[1];
     } catch(err) {
        group = '';
     }
     $j.post(mybase+'/log/generateforall',{ parentid:wbinfo.parentid, group:group, container:wbinfo.containerid, questlist:showlist}, function(qrender) {
     });
  });
  //*/
  $j("#update").click(function() {
    $j.get(mybase+"/log/updatequiz",{ container:wbinfo.containerid}, function(msg) {
      $j.getJSON(mybase+'/log/getcontainer',{ container:wbinfo.containerid }, function(qlist) {
        wbinfo.qlist = qlist.qlist;
        edqlist();
      });
    });
  });
  $j("#edquiz").click(function() {
     var myid = $j("#"+this.id).attr('tag');
     editquestion(+myid);
  });
  $j("#export").click(function() {
     window.location.href="/exportcontainer?container="+wbinfo.containerid;
  });
  $j("#import").click(function() {
      var imp = '<div id="fff">'
                 + '<form action="/importcontainer" method="post" enctype="multipart/form-data">'
                 + '<p>Spørsmål: <input type="file" name="image" /></p>'
                 + '<input id="containerid" type="hidden" name="containerid" value="'+wbinfo.containerid+'" />'
                 + '<input id="loc" type="hidden" name="loc" value="'+document.location+'" />'
                 + '<input id="wbinfo" type="hidden" name="wbinfo" value="'+escape(JSON.stringify(wbinfo))+'" />'
                 + '<p><input type="submit" value="Upload" /></p>'
                 + '</form></div>';
     $j("#importdia").html(imp);
  });
  $j(".wbhead").click(function() {
      //workbook(wbinfo.coursename);
      renderPage();
  });
  // check if question editor is loaded
  // and load it if missing
  if (typeof(editquestion) == 'undefined' ) {
      $j.getScript('js/'+database.version+'/quiz/editquestion.js', function() {
              editbind();
      });
  } else {
     editbind();
  }
}

function editbind() {
        //$j("#sortable").undelegate(".equest","click");
        $j("#sortable").undelegate(".edme","click");
        $j("#sortable").delegate(".edme","click", function() {
                var myid = $j(this).parent().attr("id").split('_')[1];
                editquestion(myid);
            });
        $j("#sortable").undelegate("#killem","click");
        $j("#sortable").delegate("#killem","click", function() {
           var tagged = $j("#sortable input:checked");
           var morituri = [];  // we who are about to die
           for (var i=0,l=tagged.length; i<l; i++) {
             var b = tagged[i];
             var qid = $j(b).parent().attr("id").substr(3);
             morituri.push(qid); // question id
           }
           dropquestion(morituri);
        });
        $j("#sortable").undelegate("#numem","click");
        $j("#sortable").delegate("#numem","click", function() {
           var tagged = $j("#sortable .equest input");
           var morituri = [];  // we who are about to be renamed with number
           for (var i=0,l=tagged.length; i<l; i++) {
             var b = tagged[i];
             var qid = $j(b).parent().attr("id").substr(3);
             morituri.push(qid); // question id
           }
           numriate(morituri);
        });
        $j("#sortable").undelegate("#subem","click");
        $j("#sortable").delegate("#subem","click", function() {
           var tagged = $j("#sortable input:checked");
           var morituri = [];  // we who are about to be subjugated
           for (var i=0,l=tagged.length; i<l; i++) {
             var b = tagged[i];
             var qid = $j(b).parent().attr("id").substr(3);
             morituri.push(qid); // question id
           }
           subjugate(morituri);
        });
        $j("#sortable").undelegate("#tagem","click");
        $j("#sortable").delegate("#tagem","click", function() {
           var tagged = $j("#sortable input:checked");
           var morituri = [];  // we who are about to be tagged
           for (var i=0,l=tagged.length; i<l; i++) {
             var b = tagged[i];
             var qid = $j(b).parent().attr("id").substr(3);
             morituri.push(qid); // question id
           }
           tagliate(morituri);
        });
        $j("#sortable").undelegate("#ownem","click");
        $j("#sortable").delegate("#ownem","click", function() {
           var tagged = $j("#sortable input:checked");
           var morituri = [];  // we who are about to be owned
           for (var i=0,l=tagged.length; i<l; i++) {
             var b = tagged[i];
             var qid = $j(b).parent().attr("id").substr(3);
             morituri.push(qid); // question id
           }
           posess(morituri);
        });
        $j("#sortable").undelegate("#dupem","click");
        $j("#sortable").delegate("#dupem","click", function() {
           var tagged = $j("#sortable input:checked");
           var morituri = [];  // we who are about to multiply
           for (var i=0,l=tagged.length; i<l; i++) {
             var b = tagged[i];
             var qid = $j(b).parent().attr("id").substr(3);
             morituri.push(qid); // question id
           }
           duplicate(morituri);
        });
}

function posess(morituri) {
  // sets parent to 0 - we own these questions and they are liberated from parent
  var given = [];
  if (morituri.length == 0) return;
  for (var i=0,l=morituri.length; i<l; i++) {
    var myid = morituri[i];
    var elm = myid.split('_');
    var qid = elm[0], instance = elm[1];
    $j.post(mybase+'/log/editquest', { action:'update', qid:qid, parent:0 }, function(msg){
        edqlist();
    });
  }
}
function subjugate(morituri) {
  var given = [];
  if (morituri.length == 0) return;
  var tagname = $j("#tnavn").val() || '';
  if (!tagname) return;
  for (var i=0,l=morituri.length; i<l; i++) {
    var myid = morituri[i];
    var elm = myid.split('_');
    var qid = elm[0], instance = elm[1];
    $j.post(mybase+'/log/editquest', { action:'update', qid:qid, subject:tagname }, function(msg) {
        edqlist();
    });
  }
}
function numriate(morituri) {
  var given = [];
  if (morituri.length == 0) return;
  var tagname = $j("#tnavn").val() || '';
  if (!tagname) return;
  for (var i=0,l=morituri.length; i<l; i++) {
    var myid = morituri[i];
    var elm = myid.split('_');
    var qid = elm[0], instance = elm[1];
    var numname = (i+1)+'-'+tagname;
    $j.post(mybase+'/log/editquest', { action:'update', qid:qid, name:numname }, function(msg) {
        edqlist();
    });
  }
}

function duplicate(morituri) {
  var dupes = {};
  var given = [];
  if (morituri.length == 0) return;
  for (var i=0,l=morituri.length; i<l; i++) {
    var myid = morituri[i];
    var elm = myid.split('_');
    var qid = elm[0], instance = elm[1];
    if (!dupes[qid]) {
        given.push(qid);
    }
    dupes[qid] = 1;  // only duplicate unique questions - not instances
  }
  $j.get(mybase+'/log/copyquest', { dupes:1, givenqlist:given.join(',') }, function(resp) {
        edqlist();
  });
}

function tagliate(morituri) {
  var given = [];
  if (morituri.length == 0) return;
  var tagname = $j("#tnavn").val() || '';
  if (!tagname) return;
  for (var i=0,l=morituri.length; i<l; i++) {
    var myid = morituri[i];
    var elm = myid.split('_');
    var qid = elm[0], instance = elm[1];
    given.push(qid);
  }
  $j.post(mybase+'/log/settag', { qidlist:given.join(','), tagname:tagname }, function(resp) {
        edqlist();
  });
}

function workbook(coursename) {
    relax(30000);  // we are not editing - so relax
    wbinfo = { trail:[], page:{}, missing:{} , haveadded:0, maxscore:0 };
    wbinfo.coursename = coursename;
    wbinfo.courseid = database.cname2id[coursename];
    var plandata = courseplans[coursename];
    var tests = coursetests(coursename);
    var felms = coursename.split('_');
    var fag = felms[0];
    var gru = felms[1];
    wbinfo.timmy = {};
    wbinfo.tidy = {};
    getTimmy(coursename,wbinfo.timmy,wbinfo.tidy);
    var startjd = database.firstweek;
    var tjd = database.startjd;
    var section = Math.min(47,Math.floor((tjd - startjd) / 7));
    // build timetable data for quick reference
    var uke = julian.week(tjd);
    var elever = memberlist[gru];
    var info = synopsis(coursename,plandata);
    wbinfo.weeksummary = showAweek(false,gru,elever,info,absent,wbinfo.timmy,tests,plandata,uke,tjd,section);
    $j.getJSON(mybase+'/log/workbook',{ courseid:wbinfo.courseid, coursename:coursename,studlist:elever.join(','),subject:fag }, function(resp) {
        if (resp) {
          var courseinfo;
          try {
            eval( 'courseinfo = '+resp.qtext);
          }
          catch(err) {
            courseinfo = {};
          }
          wbinfo.courseinfo = courseinfo;
          wbinfo.quizid = resp.quizid;
          wbinfo.containerid = resp.id;
          wbinfo.parentid = 0;
          wbinfo.title = courseinfo.title || coursename;
          wbinfo.ingress = courseinfo.ingress || '';
          wbinfo.bodytext = courseinfo.text || '';
          wbinfo.layout = courseinfo.layout || 'normal';
          wbinfo.qlistorder = courseinfo.qlistorder || [];
          if (wb.render[wbinfo.layout] ) {
            renderPage();
          }  else {
            $j.getScript('js/'+database.version+'/workbook/'+wbinfo.layout+'.js', function() {
                   renderPage();
              });
          }
        }
    });
    $j.get(mybase+'/log/scoresummary', function(resp) {
        if (resp) {
            for (var i=0; i< resp.length; i++) {
                var ss = resp[i];
                scoresum[ss.cid] = ss;
            }

        }
    });

}

function makeSelect(name,selected,arr,values) {
  var s = '<select name="'+name+'" id="'+name+'" ">';
  for (var ii in arr) {
    var oo = arr[ii];
    var va = values && values[ii] ? values[ii] : oo;
    var sel = (selected == oo) ? ' selected="selected" ' : '';
    s += '<option '+sel+' value="'+va+'">'+oo+'</option>';
  }
  s += '</select>';
  return s;
}

function setupWB(heading) {
  $j.getJSON(mybase+'/log/workbook',{ courseid:wbinfo.courseid, coursename:wbinfo.coursename }, function(resp) {
    if (resp) {
      var courseinfo;
      try {
        eval( 'courseinfo = '+resp.qtext);
      }
      catch(err) {
        courseinfo = {};
      }
      var title = courseinfo.title || wbinfo.coursename;
      var ingress = courseinfo.ingress || '';
      var text = courseinfo.text || '';
      var chosenlayout = courseinfo.layout || '';

      var head = '<h1 class="wbhead">' + heading + '</h1>' ;
      var layout = makeSelect('layout',chosenlayout,"normal cool".split(' '));
      var setup = '<div id="editform">'
                 + '<table>'
                 + ' <tr>  <th>Tittel</th>  <td colspan="3" ><input name="tittel" type="text" value="'+title+'"></td></tr>'
                 + ' <tr>  <th>Ingress</th> <td colspan="3" ><textarea id="ingress">'+ingress+'</textarea></td></tr>'
                 + ' <tr>  <th>Tekst</th>   <td colspan="3" ><textarea id="text">'+text+'</textarea></td></tr>'
                 + ' <tr>  <th>Layout</th>  <td>'+layout+'</td>'
                 + '   <th>Layout</th>  <td>ertioyiu</td></tr>'
                 + ' <tr>  <th>Jalla</th>  <td>HEALS</td>'
                 + '   <th>khjk</th>  <td>dfghkj sdhfkjh</td></tr>'
                 + ' <tr>  <th></th>   <td><div id="save" class="button">Lagre</div></td></tr>'
                 + '</table>'
                 + '</form>'
                 + '</div>'
                 + '';
      var s = '<div id="wbmain">' + head + setup + '</div>';
      $j("#main").html(s);
      $j(".wbhead").click(function() {
            //workbook(wbinfo.coursename);
            renderPage();
          });
      $j("#save").click(function() {
            courseinfo.title = $j("input[name=tittel]").val();
            courseinfo.ingress = $j('#ingress').val()
            courseinfo.text = $j('#text').val()
            courseinfo.layout = $j("#layout option:selected").val();
            //$j.post('/editquest', { action:'update', qtext:{ title:title, ingress:ingress, text:text, layout:layout }, qid:resp.id }, function(resp) {
            $j.post(mybase+'/log/editquest', { action:'update', qtext:courseinfo, qid:resp.id }, function(resp) {
                 //workbook(wbinfo.coursename);
                 renderPage();
                 //setupWB(courseid,coursename,heading);
              });
          });
    }
  });
}


/*
 * This code really belongs in quiz/editquestion.js
 * but during debug we need it here "
 *
*/


var dialog = { daze:'', contopt:{} };  // pesky dialog

var qdefault = {  "quiz"     : {navi:1,fasit:0,hints:1,omstart:1,adaptiv:1,antall:5 ,fiidback:"some",rank:1,karak:1,hintcost:0.10,attemptcost:0.1}
                , "lab"      : {darwin:0,navi:1,fasit:1,hints:1,omstart:1,adaptiv:1,antall:50,fiidback:"lots",rank:1,karak:0,hintcost:0.0,attemptcost:0.0}
                , "homework" : {navi:1,fasit:1,hints:1,omstart:0,adaptiv:1,antall:20,fiidback:"lots",rank:0,karak:0,hintcost:0.05,attemptcost:0.05}
                , "exam"     : {darwin:0,navi:0,fasit:0,hints:0,omstart:0,adaptiv:0,antall:2 ,fiidback:"none",rank:0,karak:0}
               };

function editquestion(myid, target) {
  // given a quid - edit the question
 relax(5000);  // trigger dead connection quicly
 target   = typeof(target) != 'undefined' ? target : '#main';
 $j.getJSON(mybase+'/log/getquestion',{ qid:myid }, function(q) {
   if (!q.qtype) {
       alert("You dont own this question");
   } else {
       dialog.qtype = q.qtype;
       dialog.qpoints = q.points;
       dialog.subject = q.subject;
       dialog.avg = q.avg;
       dialog.qcode = q.code;
       dialog.pycode = q.pycode;
       dialog.hints = q.hints || '';
       dialog.daze = q.daze || '';
       dialog.contopt = q.contopt || {};
       dialog.qlistorder = q.qlistorder;
       eedit(myid,q,target);
   }
 });
}

function eedit(myid,q,target) {
 var descript = { multiple:'Multiple choice', dragdrop:'Drag and Drop', sequence:'Place in order'
               , info:'Information'
               , abcde:'Connected numeric subquestions'
               , textarea:'Free text'
               , numeric:'Numeric answers'
               , jscore:'Answers scored by script'
                  // fields may be [[num:x0]] [[num:x1]] [[fun:f]] [[txt:name]]
                  // this specisfies type and name for user inputs
                  // scoring is done by running score function stored in
                  // con.score (javascript function returning score)
                  // this is coded same way as js for other questions
                  // only must define con.score as a function returning [0,1]
               , fillin:'Textbox'
               , random:'Random pick based on tag'
               , diff:'Difference'
               , js:'Javascript'
               , container:'SubChapter'
               , quiz:'A quiz'
 };
   var statlist = "Normal,Partial,Testing,Fixme,Error".split(',');
   var stat = statlist[q.status];
   var status = makeSelect('status',stat,statlist);
   var hard = (q.avg < 0.5) ? 'hard' : (q.avg < 0.8) ? 'medium' : 'easy' ;
   var hardy = makeSelect('hardy',hard,"easy,medium,hard".split(','),[0.88,0.65,0.4]);
   if (q.count > 3) {
     hardy = hard;  // cant set hardness of a question if more than 3 studs have scored it
   }
   var qdescript = descript[q.qtype] || q.qtype;
   var selectype = makeSelect('qtype',q.qtype,"multiple,diff,js,dragdrop,sequence,fillin,numeric,jscore,abcde,info,textarea,random,container,quiz".split(','));
   var head = '<h1 id="heading" class="wbhead">Question editor</h1>' ;
        head += '<h3>Question '+ q.id + ' ' + qdescript + '</h3>' ;
   var variants = editVariants(q);
   var sync = '';
   var remark = '';
   if (q.sync && q.sync.origtext) {
      var syncdiff = ' (sjekk detaljer - forskjell i kode ..)';
      if (q.sync.origtext != q.display) {
          if (q.sync.modified > q.modified) {
             syncdiff = "Endringer i original:<br>"+diffString(q.display,q.sync.origtext);
          } else {
             syncdiff = "Dine endringer:<br>"+diffString(q.sync.origtext,q.display);
          }
      } else {
        if (q.sync.qcode != q.sync.code) {
          if (q.sync.modified > q.modified) {
             syncdiff = "Endringer i original kode (detaljer for å se):<pre>"+diffString(dialog.qcode,q.sync.code)+"</pre>";
          } else {
             syncdiff = "Dine endringer i koden (detaljer for å se):<pre>"+diffString(q.sync.code,dialog.qcode)+"</pre>";
          }
        } else {
            syncdiff = " uvesentlig endring ";
        }
      }
      sync = '<span title="Synkroniser mot original" id="sync">Sync</span><div class="diff">'+syncdiff+'</div>';
   }
   if (remarks[q.id]) {
       var usr = getUser(remarks[q.id].uid);
       fn = usr.firstname.caps();
       ln = usr.lastname.caps();
       var remarkteach = fn + ' '+ln;
       remark = '<div class="remark">'+remarks[q.id].text+'</div><div class="author">'+remarkteach+'</div>';
   }
   var s = '<div id="wbmain">' + head + '<div id="qlistbox"><div id="editform">'
        + '<table class="qed">'
        + '<tr><th>Navn</th><td><input class="txted" name="qname" type="text" value="' + q.name + '"></td></tr>'
        + '<tr><th>Type</th><td>'+selectype+' <span title="Bare Normal,Partial spørsmål vises i en prøve. Partial betyr del av serie"> Status '
        + status + '</span><span title="Kan bare overstyre dersom antall svar mindre enn 3">'+hardy
        + '</span><span class="count">'+q.count+'</span><span class="avg">'+(+q.avg).toFixed(2)+'</span></td></tr>'
        + variants.qdisplay
        + '<tr><th>Detaljer <div id="details"></div></th><td>'+sync+'</td></tr><th></th><td>'+remark+'</td><td></td></tr>'
        + '</table>'
        + '<div id="taggs"><span class="tagtitle">Tags</span>'
        + '  <div id="taglist"><div id="mytags"></div>'
        + '  <div id="tagtxt"><input name="tagtxt" value=""></div>'
        + '  <div id="nutag" class="tinybut"><div id="ppp">+</div></div></div>'
        + '</div>'
        + '<div id="edetails" ></div>';
   //s += editVariants(q);
   s += variants.options;
   //if (target == "#main") s += '<div id="killquest"><div id="xx">x</div></div>';
   s += '</div></div>';

   $j(target).html(s);
   $j('#sync').click(function() {
         q.count = q.count ? q.count + 1 : 1 ;
         if ( q.count % 2) {
           $j("#qdisplay").text(q.sync.origtext).css("background","#fdd");
           $j("#daze").val(q.sync.daze).css("background","#fdd");
           dialog.qcode = q.sync.code;
           dialog.pycode = q.sync.pycode;
           dialog.hints = q.sync.hints;
         } else {
           $j("#qdisplay").text(q.display).css("background","#ffe");
           $j("#daze").val(q.daze).css("background","#ffe");
           dialog.qcode = q.code;
           dialog.pycode = q.pycode;
           dialog.hints = q.hints || '';
         }
       });
   $j("#start,#stop").datepicker( {showWeek:true, firstDay:1
       , dayNamesMin:"Sø Ma Ti On To Fr Lø".split(' ')
       , monthNames:"Januar Februar Mars April Mai Juni July August September Oktober November Desember".split(' ')
       , weekHeader:"Uke"
       , dateFormat:"dd/mm/yy"
       } );
   $j("#edetails").dialog({ width:550, autoOpen:false, title:'Details',
     buttons: {
       "Cancel": function() {
             $j( this ).dialog( "close" );
        },
       "Oppdater": function() {
               //alert($j("input[name=qpoints]").val());
             $j( this ).dialog( "close" );
             dialog.qpoints = $j("input[name=qpoints]").val();
             dialog.subject = $j("input[name=subject]").val();
             dialog.qcode = $j("#qcode").val();
             dialog.pycode = $j("#pycode").val();
             dialog.hints = $j("#hints").val();
             $j("#saveq").addClass('red');
            }
         }
   });
   // enable/disable dependent controls
   $j("#inputdiv").undelegate(".deppers","change");
   $j("#inputdiv").delegate(".deppers","change", function() {
         var test = $j(this).attr("derp");
         var val = $j(this).val();
         var elm = test.split(';');
         for (var i=0; i< elm.length; i++) {
           var listener = elm[i].split(':');
           if (val == listener[1]) {
             $j("#"+listener[0]).removeAttr('disabled').css("background","#ffe");
           } else {
             $j("#"+listener[0]).attr('disabled', 'disabled').css("background","#ccc");
           }
         }
       });
   $j('#taggs span.tagtitle').click(function() {
         $j("#taglist").toggle();
       });
   $j('#nutag').click(function() {
       var tagname = $j("input[name=tagtxt]").val();
       $j.post(mybase+'/log/edittags', { action:'tag', qid:myid, tagname:tagname}, function(resp) {
         freshenTags(q.subject);
       });
   });
   freshenTags(q.subject);
   $j("#mytags").undelegate("input.tagr","change");
   $j("#mytags").delegate("input.tagr","change", function() {
        $j("#saveq").addClass('red');
        dialog.tagger = true;
      });
   $j('#details').click(function() {
                var dia = ''
                +   '<form><fieldset><table class="standard_info">'
                +   '<tr><th>Points</th><td><input name="qpoints" class="num4" type="text" value="'+q.points+'"></td></tr>'
                +   '<tr><th>Subject</th><td><input name="subject" type="text" value="'+q.subject+'"></td></tr>'
        +   '<tr><th>Created</th><td>'+showdate(q.created)+'</td></tr>'
        +   '<tr><th>Modified</th><td>'+showdate(q.modified)+'</td></tr>'
                +   '<tr><th>Parent</th><td>'+q.parent+'</td></tr>'
                +   '<tr><th>Javascript</th><td><textarea class="txted" id="qcode">'+dialog.qcode+'</textarea></td></tr>'
                +   '<tr><th>SymbolicPython</th><td><textarea class="txted" id="pycode">'+dialog.pycode+'</textarea></td></tr>'
                +   '<tr><th>Hints</th><td><textarea class="txted" id="hints">'+dialog.hints+'</textarea></td></tr>'
                +   '</table></form></fieldset>'
             $j("#edetails").html(dia);
             $j("#edetails").dialog('open');
              return false;
           });
   $j("#opts").undelegate(".killer","click");
   $j("#opts").delegate(".killer","click", function() {
        preserve();  // save opt values
        var myid = $j(this).parent().attr("id").substr(1);
        q.options.splice(myid,1);
        q.fasit.splice(myid,1);
        if (q.qtype == 'multiple') {
          optlist = drawOpts(q.options,q.fasit);
        } else {
          optlist = drawABCDE(q.options,q.fasit);
        }
        $j("#opts").html(optlist);
      });
   $j(target).undelegate(".txted","change");
   $j(target).delegate(".txted","change", function() {
        $j("#saveq").addClass('red');
      });
   $j(target).undelegate("#exam","change");
   $j(target).delegate("#exam","change", function() {
        console.log(dialog.contopt);
        var nuval = $j("select[name=exam]").val();
        var nuinf = qdefault[nuval]
        for (var k in nuinf) {
          if (nuinf.hasOwnProperty(k)) {
            dialog.contopt[k] = nuinf[k];
          }
        }
        dialog.contopt.exam = nuval;
        eedit(myid,q,target);
      });
   $j("#heading").click(function() {
       if (target == '#main') {
         edqlist();
       } else {
         showinfo(mylink);
       }
      });
   $j("#addopt").click(function() {
        if (typeof(q.options) == 'undefined') {
          q.options = [];
          q.fasit = [];
        }
        preserve();
        q.options.push('');
        if (q.qtype == 'multiple') {
          optlist = drawOpts(q.options,q.fasit);
        } else {
          optlist = drawABCDE(q.options,q.fasit);
        }
        $j("#opts").html(optlist);
      });
   $j("#saveq").click(function() {
        var fo = $j("#editform");
        fo.addClass("wait");
        fo.animate({
                      opacity: "toggle"
                }, {
                      duration: "slow"
                }).animate({
                      opacity: "toggle"
                }, {
                      duration: "slow",
                      complete: function() { fo.removeClass("wait")}
                });
        var qoptlist = [];
        preserve();  // q.options and q.fasit are now up-to-date
        retag();
        // containers and quiz have options for how to display
        // pick them out and stuff them into a field
        var contopt = {};
        var containeropts = $j("#inputdiv .copts");
        if (containeropts.length > 0) {
          for (var coi = 0; coi < containeropts.length; coi++) {
            var inp = containeropts[coi];
            contopt[inp.name] = inp.value;
            if (inp.type == "textarea") {
                 contopt[inp.name] = inp.value;
            }
            if (inp.type == "checkbox") {
                 contopt[inp.name] = (inp.checked == true) ? "1":"0";
            }
          }
        }
        var daze = $j("input[name=daze]").val();
        dialog.daze = daze;
        var qtype = $j("select[name=qtype]").val();
        var qstatustxt = $j("select[name=status]").val();
        var qstatus = statlist.indexOf(qstatustxt);
        var qname = $j("input[name=qname]").val();
        var hardnes = $j("select[name=hardy]").val();
        var hard = q.count > 3 ? q.avg : hardnes; // three studs count for more than one teacher
        // wbinfo.courseinfo.qlistorder = trulist;
        var newqtx = { display:$j("#qdisplay").val(), options:q.options, fasit:q.fasit, code:dialog.qcode,
                        pycode:dialog.pycode, hints:dialog.hints, daze:daze, contopt:contopt };
        if (dialog.qlistorder) {
            newqtx.qlistorder = dialog.qlistorder;
            // this preserves any question-list for quiz/container
        }
        $j.post(mybase+'/log/editquest', { action:'update', qid:myid, qtext:newqtx, name:qname, status:qstatus, avg:hard,
                                qtype:qtype, points:dialog.qpoints, subject:dialog.subject }, function(resp) {
           editquestion(myid,target);
        });
      });
   if (target == '#main') $j("#killquest").click(function() {
      $j.post(mybase+'/log/editquest', { action:'delete', qid:myid }, function(resp) {
         $j.getJSON(mybase+'/log/getcontainer',{ container:wbinfo.containerid }, function(qlist) {
           wbinfo.qlist = qlist.qlist;
           edqlist();
         });
      });

    });

    function retag() {
        if (!dialog.tagger) return;
        var tags = [];
        var tagged = $j("#mytags input:checked");
        for (var i=0,l=tagged.length; i<l; i++) {
          var b = tagged[i];
          var tname = $j(b).parent().attr("id").substr(2);
          tags.push(tname);
        }
        if (tags.length) {
          $j.post(mybase+'/log/updateTags', { tags:tags.join(','), qid:myid }, function(resp) {
          });
        }
    }

    function freshenTags(subj) {
       // fetch tags for this subject (given by question) plus tags for this course
       var subject = (wbinfo.coursename) ? wbinfo.coursename.split('_')[0] :  '';
       subject = (subject != subj) ? [subject,subj].join(',') : subject;
       $j.getJSON(mybase+'/log/gettags', { subject:subject }, function(tags) {
         var mytags = tags[userinfo.id] || [];
         var tlist = [];
         $j.getJSON(mybase+'/log/gettagsq', { qid:myid }, function(mtags) {
           qtags = mtags;
           for (var i=0,l=mytags.length; i<l; i++) {
             var tag = mytags[i];
             var chk = ($j.inArray(tag,mtags) >= 0) ? 'checked="checked"' : '';
             tlist.push('<div id="tt'+tag+'" class="tagdiv"><input  class="tagr" type="checkbox" '+chk+'><div class="tagg">'+tag+'</div></div>');
           }
           $j("#mytags").html(tlist.join(''));
           $j("#qtags").html(mtags.join(','));
         });
       });
    }

    function editVariants(q) {  // qu is a question
      var s = '<hr />'
      var qdisplay = '<tr id="qtextarea"><th>Spørsmål</th><td><textarea class="txted" id="qdisplay" >' + q.display + '</textarea></td></tr>';
      switch(q.qtype) {
        case 'abcde':
           var optlist = drawABCDE(q.options,q.fasit);
           s += '<h3>Delspørsmål</h3>'
           + '<table id="opts" class="opts">'
           + optlist
           + '</table>'
           + '</div><div class="button" id="addopt">+</div>'
           break;
        case 'jscore':
           var jscore = dialog.contopt.jscore || 'return 1';   // default scoring functions passes any response
           var elements = {
                 elements:{
                      jscore:     {  value:jscore, type:"textarea", klass:"longtext copts" }
                 }
               };
           var res = gui(elements);
           s += '<span id="inputdiv">'
              + ' <span title="Funksjon for å score svarene">Scorefunk <br>{jscore}</span></span>';
           s = s.supplant(res);
           break;
        case 'multiple':
           var optlist = drawOpts(q.options,q.fasit);
           var rikt = dialog.contopt.rikt || '1';
           var feil = dialog.contopt.feil || '1';
           var plukk = (dialog.contopt.plukk != undefined) ? dialog.contopt.plukk : 0;
           var elements = {
                 defaults:{  type:"text", klass:"copts num4" }
               , elements:{
                    plukk:       {  type:"yesno", value:plukk }
                   ,rikt :       { value:rikt, depend:{plukk:1} }
                   ,feil :       { value:feil, depend:{plukk:1} }
                 }
               };
           var res = gui(elements);
           s += '<span id="inputdiv">'
              + ' <span title="Plukk ut tilfeldig riktig/gale alternativ. Du bør ha mange av hver (5++)">Plukk {plukk}</span>'
              + ' <span title="Antall riktige">Riktige {rikt}</span>'
              + ' <span title="Antall feil">Feil {feil}</span> </span>';
           s = s.supplant(res);           // supplant before we paste on options - they may contain macros #{varname}
           s += '<h3>Alternativer</h3>'
           + '<table id="opts" class="opts">'
           + optlist
           + '</table>'
           + '</div><div class="button" id="addopt">+</div>'
           break;
        case 'sequence':
        case 'dragdrop':
           s += 'Daze and Confuse (csv fog list: daze,confuse) : '
             + '<input id="daze" name="daze" type="text" value ="'+dialog.daze+'" />'
             + '</div>';
           break;
        case 'random':
           var seltype = dialog.contopt.seltype || 'all';
           var usetags = dialog.contopt.tags || '';
           var level = dialog.contopt.level || 'any';
           var demand = dialog.contopt.demand || '';
           qdisplay = '<tr id="qtextarea"><th>Spørsmål</th><td><textarea class="txted hidden" id="qdisplay" >Random Question '+usetags+','+seltype+ '</textarea></td></tr>';
           var elements = {
                 defaults:{  type:"text", klass:"copts" }
               , elements:{
                     seltype:       {  type:"select", klass:"copts",  value:seltype,
                                      options:[{ value:"all"},{ value:"multiple"},{ value:"numeric"},{ value:"jscore"},{ value:"fillin"},{ value:"dragdrop"} ] }
                   , level:       {  type:"select", klass:"copts",  value:level,
                                      options:[{ value:"any"},{ value:"darwin"},{ value:"easy"},{ value:"medium"},{ value:"hard"} ] }
                   , tags:         { value:usetags }
                   , demand:         { value:demand }
                 }
               };
           var res = gui(elements);
           s += 'Instillinger for random: <div id="inputdiv">'
             + '<div title="Velg spørsmål som har noen av disse tags">Velg blandt {tags}</div>'
             + '<div title="Krev at spørsmål har alle disse tags">Krev disse {demand}</div>'
             + '<div title="Bruk _all_ for alle typer (bare multiple,numeric,dragdrop,fillin)">Begrens til denne typen {seltype}</div>'
             + '<div title="Velg fortrinnsvis vanskegrad :">Difficulty level {level}</div>'
             + '</div></div>';
           s = s.supplant(res);
           break;
        case 'container':
           qdisplay = '';
           s += '</div>';
           break;
        case 'quiz':
           qdisplay = '';
           var start = dialog.contopt.start || '';
           var stop = dialog.contopt.stop || '';
           var hstop = dialog.contopt.hstop || '';
           var hstart = dialog.contopt.hstart || '';
           var intro = dialog.contopt.intro || '';
           var mstop = dialog.contopt.mstop || '';
           var mstart = dialog.contopt.mstart || '';
           var locked = (dialog.contopt.locked != undefined) ? dialog.contopt.locked : 0;
           var anonym = (dialog.contopt.anonym != undefined) ? dialog.contopt.anonym : 0;
           var hidden = (dialog.contopt.hidden != undefined) ? dialog.contopt.hidden : 0;
           var fasit = (dialog.contopt.fasit != undefined) ? dialog.contopt.fasit : 0;
           var darwin = (dialog.contopt.darwin != undefined) ? dialog.contopt.darwin : 0;
           var skala = dialog.contopt.skala || 'medium';
           var rcount = dialog.contopt.rcount || '15';
           var xcount = dialog.contopt.xcount || '0';
           var antall = dialog.contopt.antall || '10';
           var hintcost = dialog.contopt.hintcost || '0';
           var attemptcost = dialog.contopt.attemptcost || '0';
           var trinn = (dialog.contopt.trinn != undefined) ? dialog.contopt.trinn : 0;
           var exam = (dialog.contopt.exam != undefined) ? dialog.contopt.exam : 'quiz';
           var karak = (dialog.contopt.karak != undefined) ? dialog.contopt.karak : 0;
           var rank = (dialog.contopt.rank != undefined) ? dialog.contopt.rank : 0;
           var fiidback = (dialog.contopt.fiidback != undefined) ? dialog.contopt.fiidback : 'none';
           var randlist = (dialog.contopt.randlist != undefined) ? dialog.contopt.randlist : 0;
           var shuffle = (dialog.contopt.shuffle != undefined) ? dialog.contopt.shuffle : 0;
           var omstart = (dialog.contopt.omstart != undefined) ? dialog.contopt.omstart : 0;
           var komme = (dialog.contopt.komme != undefined) ? dialog.contopt.komme : 1;
           var hints = (dialog.contopt.hints != undefined) ? dialog.contopt.hints : 1;
           var navi = (dialog.contopt.navi != undefined) ? dialog.contopt.navi : 1;
           var adaptiv = (dialog.contopt.adaptiv != undefined) ? dialog.contopt.adaptiv : 0;
           var elements = {
                 defaults:{  type:"text", klass:"copts float" }
               , elements:{
                   adaptiv:       {  type:"yesno", value:adaptiv }
                 , randlist:      {  type:"yesno", value:randlist }
                 , darwin:        {  type:"yesno", value:darwin }
                 , hints:         {  type:"yesno", value:hints }
                 , intro:         {  klass:"smalltext copts",  value:intro, type:"textarea" }
                 , omstart:       {  type:"checkbox", value:omstart }
                 , navi:          {  type:"checkbox", value:navi }
                 , trinn:         {  type:"checkbox", value:trinn }
                 , komme:         {  type:"checkbox", value:komme }
                 , exam:          {  type:"select", klass:"copts",  value:exam, options:[{ value:"quiz"},{ value:"homework"},{ value:"lab"},{ value:"exam"} ] }
                 , locked:        {  type:"checkbox", value:locked }
                 , anonym:        {  type:"checkbox", value:anonym }
                 , hidden:        {  type:"checkbox", value:hidden }
                 , fasit:         {  type:"checkbox", value:fasit }
                 , karak:         {  type:"checkbox",  value:karak }
                 , rank:          {  type:"checkbox",  value:rank }
                 , shuffle:       {  type:"checkbox", value:shuffle }
                 , rcount:        {  klass:"float copts num4",  value:rcount, depend:{ randlist:1}  }
                 , xcount:        {  klass:"float copts num4",  value:xcount, depend:{ randlist:1} }
                 , start:         {  klass:"copts pickdate", type:"text", value:start }
                 , stop:          {  klass:"copts pickdate", type:"text", value:stop }
                 , fiidback:      {  type:"select", klass:"copts",  value:fiidback, options:[{ value:"none"},{ value:"some"},{ value:"lots"} ] }
                 , skala:         {  type:"select", klass:"copts",  value:skala, options:[{ value:"medium"},{ value:"easy"},{ value:"hard"} ] }
                 , hintcost:      {  klass:"float copts num4",  value:hintcost, depend:{ hints:1} }
                 , attemptcost:   {  klass:"float copts num4",  value:attemptcost, depend:{ adaptiv:1 } }
                 , antall:        {  klass:"float copts num4",  value:antall }
                 , hstart:        {  klass:"copts num2",  value:hstart }
                 , hstop:         {  klass:"copts num2",  value:hstop }
                 , mstart:        {  klass:"copts num2",  value:mstart }
                 , mstop:         {  klass:"copts num2",  value:mstop }
                          }
               };
           var res = gui(elements);
           s += '<h4>Instillinger for prøven</h4> <div id="inputdiv">'
             + '<div class="underlined" title="En valgfri introtext for elevene">Intro {intro}</div>'
             + '<div class="underlined" title="quiz,lekse,lab,prøve - styrer oppsummering">QuizType{exam}</div>'
             + '<div class="underlined" title="Kan bla tilbake i prøven">Navigering {navi}</div>'
             + '<div class="underlined" title="Brukeren kan kommentere spørsmålene">Brukerkommentarer{komme}</div>'
             + '<div class="underlined" title="Nyttig for øvingsoppgaver med genererte spørsmål">Elev kan ta omstart {omstart}</div>'
             + '<div class="underlined" title="Vis spørsmål i tillfeldig orden">Stokk {shuffle}</div>'
             + '<div class="underlined" title="Neste spørsmål vises dersom 80% riktig eller mer enn 4 forsøk">Trinnvis {trinn}</div>'
             + '<div class="underlined" title="Elever kan ikke se prøven.">Skjult {hidden}</div>'
             + '<div class="underlined" title="Skal karakter vises">Karakter{karak} </div>'
             + '<div class="underlined" title="Navn på elev er skjult (anonym retting)">Anonym {anonym}</div>'
             + '<div class="underlined" title="Elever kan ikke lenger endre svar, låst for retting.">Låst {locked}</div>'
             + '<div class="underlined" title="Prøven er ferdig - vis fasit/riktige svar">Fasit {fasit}</div>'
             + '<div class="underlined" title="Rangering i klassen">Rank{rank} </div>'
             + '<div class="underlined" title="Velger ut N fra spørsmålslista">Utvalg fra liste {randlist}</div>'
             + '<div class="underlined" title="Bruk uansett de første N spørsmålene, alle vil da få disse.">Faste spørsmål {xcount}</div>'
             + '<div class="underlined" title="Antall spørsmål som skal trekkes (i tillegg til de faste)">Antall tilfeldig valgte {rcount}</div>'
             + '<div class="underlined" title="Vis løsningsforslag etter 4 forsøk/riktig svar">Løsningsforslag{fiidback} </div>'
             + '<div class="underlined" title="Karakterskala som skal brukes, easy for en lett prøve (streng vurdering), hard gir snill vurdering">Skala {skala}</div>'
             + '<div class="underlined" title="Antall spørsmål pr side">Antall pr side {antall}</div>'
             + '<div class="underlined" title="Trinnvis visning av hjelpehint">Hjelpehint{hints}</div>'
             + '<div class="underlined" title="Pris for visning av hjelpehint">  Hintpris{hintcost}</div>'
             + '<div class="underlined" title="Velg vanskegrad etter elevnivå">Adaptiv {darwin}</div>'
             + '<div class="underlined" title="Kan svare flere ganger mot poengtap (10%)">Forsøk {adaptiv}</div>'
             + '<div class="underlined" title="  Pris for forsøk">  Forsøkpris{attemptcost}</div>'
             + '<div class="underlined" title="Prøve utilgjengelig før denne datoen">Start {start} H {hstart} : M {mstart}</div>'
             + '<div class="underlined" title="Prøve utilgjengelig etter denne datoen">Stop {stop} H {hstop} : M {mstop}</div>'
             + '</div></div>';
           s = s.supplant(res);
           break;
        case 'numeric':
        case 'jscore':
        case 'info':
        case 'diff':
        case 'js':
        case 'textarea':
        case 'fillin':
        default:
           s += '</div>';
           break;
      }
      s += '<div class="button" id="saveq">Lagre</div>';
      return {qdisplay:qdisplay, options:s};
   }

   function drawABCDE(options,fasit) {
     // given a list of options - creates rows for each
     var optlist = '';
     var order = "a".charCodeAt(0);
     if (options) {
       for (var i=0,l=options.length; i<l; i++) {
         var fa = fasit[i];
         var parts = options[i].split('-||-');
         var qtx = parts[0];
         var guidance = parts[1] || '';
         var unit = parts[2] || '';
         var skip = parts[3] || 0;
         optlist += '<tr><td>'
             + '<ol class="abcde"><li title="Text to show after completing prev quest">Guidance: <input name="q'+i+'" class="gu" type="text" value="'
             + guidance +'">'
             + '<li>Question: <input name="o'+i+'" class="gu" type="text" value="'
             + qtx +'">'
             + '<li>Answer:<input name="a'+i+'" class="gu" type="text" value="'
             + fa +'">'
             + '<li title="Units used for the answer">Units:<input name="u'+i+'" class="skip" type="text" value="'
             + unit +'">'
             + '<li title="If correct then next n questions implicitly answered">Skip next:<input name="s'+i+'" class="skip" type="text" value="'
             + skip +'">'
             + '<li title="Change a to b (and visaversa) to swap order">Order :<input name="r'+i+'" class="skip" type="text" value="'
             + String.fromCharCode(order+i) +'">'
             + '</ol>'
             + '</td><td><div id="c'+i+'" class="eopt"><div class="killer"></div></div></td></tr>';
       }
     }
     return optlist;
   }

   function drawOpts(options,fasit) {
     // given a list of options - creates rows for each
     var optlist = '';
     if (options) {
       for (var i=0,l=options.length; i<l; i++) {
         var fa = (fasit[i] == 1) ? ' checked="checked" ' : '';
         optlist += '<tr><td><input name="o'+i+'" class="txted option" type="text" value="'
                + options[i] +'"></td><td><div id="c'+i+'" class="eopt"><input class="check txted " type="checkbox" '+fa+' ><div class="killer"></div></div></td></tr>';
       }
     }
     return optlist;
   }
   function preserve() {
        // preserve any changed option text
      if (q.options) {
        if (q.qtype == 'multiple') {
            for (var i=0,l=q.options.length; i<l; i++) {
              var oval = $j("input[name=o"+i+"]").val();
              q.options[i] = oval;
              q.fasit[+i] = 0;
            }
            // preserve any changed checkboxes
            var fas = $j("div.eopt input:checked");
            for (var i=0,l=fas.length; i<l; i++) {
              var b = fas[i];
              var ii = $j(b).parent().attr("id").substr(1);
              q.fasit[+ii] = 1;
            }
        } else {
            // assumed to be "abcde"
            var sortme = [];
            for (var i=0,l=q.options.length; i<l; i++) {
              var question = $j("input[name=o"+i+"]").val();
              var guidance = $j("input[name=q"+i+"]").val();
              var answer = $j("input[name=a"+i+"]").val();
              var unit = $j("input[name=u"+i+"]").val();
              var skip = $j("input[name=s"+i+"]").val();
              var order = $j("input[name=r"+i+"]").val();
              sortme.push({ q:question,g:guidance,a:answer,u:unit,s:skip,o:order})
            }
            sortme.sort(function(a,b) { return a.o.charCodeAt(0) - b.o.charCodeAt(0) });
            for (var i=0,l=q.options.length; i<l; i++) {
              var me = sortme[i];
              q.options[i] = me.q + '-||-'+me.g+'-||-'+me.u+'-||-'+me.s;
              q.fasit[i] = me.a;
            }
        }
        $j("#saveq").addClass('red');
      }
   }
}


function dropquestion(morituri) {
  var dead = [];    // these we must kill
  var remove = {};  // 1 for removed
  var qcount = {};  // count duplicates
  var nuorder = []; // new qlistorder after removing
  if (morituri.length == 0) return;
  for (var id in wbinfo.qlistorder) {
    var qii = wbinfo.qlistorder[id];
    if (!qcount[qii]) qcount[qii] = 0;
    qcount[qii] ++;
  }
  for (var i=0,l=morituri.length; i<l; i++) {
    var myid = morituri[i];
    var elm = myid.split('_');
    var qid = elm[0], instance = elm[1];
    remove[instance] = 1;
    qcount[qid]--;
    if (qcount[qid] < 1) {
      dead.push(qid);
    }
  }
  for (var i=0,l=wbinfo.qlistorder.length; i<l; i++) {
    if (remove[i]) continue;
    nuorder.push(wbinfo.qlistorder[i]);
  }
  wbinfo.qlistorder = nuorder;
  $j.post(mybase+'/log/editquest', { action:'update',cache:1,  qtext:wbinfo.courseinfo, qid:wbinfo.containerid }, function(resp) {
    if (dead.length != 0) {
      $j.post(mybase+'/log/editqncontainer', {  action:'delete', nuqs:dead.join(','), container:wbinfo.containerid }, function(resp) {
           $j.getJSON(mybase+'/log/getcontainer',{ container:wbinfo.containerid }, function(qlist) {
             wbinfo.qlist = qlist.qlist;
             edqlist();
           });
        });
    } else {
      $j.getJSON(mybase+'/log/getcontainer',{ container:wbinfo.containerid }, function(qlist) {
         wbinfo.qlist = qlist.qlist;
         edqlist();
      });
    }
  });
}



wb.getUserAnswer = function(qid,iid,myid,showlist) {
  // parses out user answer for a given question
  var missing = 0;
  var jserror = '';  // used to check javascript for errors
  var qu = showlist[iid];
  var ua = {};
  var quii = myid.substr(5);  // drop 'quest' from 'quest' + qid_iid
  switch(qu.qtype) {
      case 'multiple':
        var ch = $j("#qq"+quii+" input:checked");
        for (var i=0, l=ch.length; i<l; i++) {
          var opti = $j(ch[i]).attr("id");
          var elm = opti.substr(2).split('_');
          var optid = elm[1];   // elm[0] is the same as qid
          var otxt = qu.param.options[optid];
          ua[optid] = otxt;
        }
        break;
      case 'js':
        var datalist = qu.param.options;  // test data for user function
        var ch = $j("#qq"+quii+" .fillin :input");
        var usfu;
        for (var i=0, l=ch.length; i<l; i++) {
          var opti = $j(ch[i]).val();
          var optii = (opti.indexOf("return") < 0) ? 'return '+opti : opti;
          try {
            usfu = new Function("a","b","c","d","e","f"," { "+optii+"; }");
          } catch(err) {
              opti += " \n\n"+err;
              usfu = function(a,b,c,d,e,f) { return 0;};
              jserror = "SYNTAX: "+err;
          }
          var myopt = datalist[i].split(";");
          var resp = [];
          for (var jik=0;jik<myopt.length; jik++) {
             try {
               var para = JSON.parse(myopt[jik]);
               resp.push(JSON.stringify(usfu.apply(null,para)));
             } catch(err) {
               //console.log("Parse err ",err);
               jserror = "EVALUATE: "+err;
               break;
             }
          }
          ua[i] = opti+"_|_"+resp.join(";");
        }
        break;
      case 'fillin':
      case 'numeric':
      case 'jscore':
      case 'abcde':
      case 'diff':
      case 'textarea':
        var ch = $j("#qq"+quii+" .fillin :input");
        for (var i=0, l=ch.length; i<l; i++) {
          var opti = $j(ch[i]).val();
          ua[i] = opti
        }
        if (qu.qtype == 'numeric' || qu.qtype == 'fillin')  missing = ch.length;
        break;
      case 'textmark':
        break;
      case 'info':
        break;
      case 'sequence':
        var ch = $j("#qq"+quii+" ul.sequence");
        for (var i=0, l=ch.length; i<l; i++) {
          var itemlist = $j("#"+ch[i].id+" li.dragme");
          ua[i] = {};
          for (var j=0, m=itemlist.length; j<m; j++) {
              var item = itemlist[j].innerHTML;
              ua[i][j] = item;
          }
        }
        break;
      case 'dragdrop':
        var ch = $j("#qq"+quii+" span.drop");
        for (var i=0, l=ch.length; i<l; i++) {
          var opti = $j(ch[i]).attr("id");
          var elm = opti.substr(2).split('_');
          var optid = elm[2];   // elm[0] is the same as qid
          var otxt = ch[i].innerHTML;
          ua[optid] = otxt;
        }
        break;
  }
  return [ua,missing,jserror];
}

// check question list for similar questions and warn if seeming duplicates
function warn_duplicates(qlist) {
    var md5hash = {};  // stored by md5
    var dupes = {};    // these may be dupes
    for (var i=0;i<qlist.length;i++) {
        var qu = qlist[i];
        var md5 = qu.md5;
        var txt = qu.display;
        if (!txt) continue;
        if (md5hash[md5] == undefined) {
            md5hash[md5] = i;
        } else {
            var qo = qlist[md5hash[md5]];
            dupes[qu.id] = qo.id;  // only show first dupe
            dupes[qo.id] = qu.id;
        }
    }
    return dupes;
}


wb.render.normal  = {
         // renderer for header
         header:function() {
            var head = '<h1 class="wbhead">' + wbinfo.title + '<span id="editwb" class="wbteachedit">&nbsp;</span></h1>' ;
            var quizstats = '<div id="quizstats" class="gradebutton">Stats</div>';
            var summary = '<div class="wbsummary"><table>'
                  + '<tr><th>Uke</th><th></th><th>Absent</th><th>Tema</th><th>Vurdering</th><th>Mål</th><th>Oppgaver</th><th>Logg</th></tr>'
                  + wbinfo.weeksummary + '</table></div><hr>';
            var bod = '<div class="wbingress">'+wbinfo.ingress+'</div><div class="wbbodytxt">'+wbinfo.bodytext+'</div>';
            return(head+quizstats+summary+bod);
           }
         // renderer for body
       , body:function() {
            var contained = '<div id="qlistbox" class="wbbodytxt"><br><div id="progress" class="gui"></div><span id="edqlist" class="wbteachedit">&nbsp;</span><div id="qlist"></div></div>';
            //var addmore = '<div id="addmore" class="button">add</div>';
            return contained;
           }
         // renderer for edit question list
       , editql:function(questlist,wantlist) {
            wantlist   = typeof(wantlist) != 'undefined' ? wantlist : false;
            var qq = '';
            var qql = [];
            var taggers = wbinfo.taglist;
            var dupes =  warn_duplicates(questlist);   // same question text
            for (var qidx in questlist) {
              qu = questlist[qidx];
              var status = qu.status;
              var statusclass = '';
              var remark = '';
              if (status != undefined && status != 0) {
                statusclass = ' status'+status;
              }
              var owner = ' title="Min"'; // name of original owner
              if (qu.parent && qu.pid && teachers[qu.pid]) {
                  owner = teachers[qu.pid];
                  owner = ' title="' + owner.firstname + '" ';
              }
              var shorttext = qu.display || '( no text )';
              var taggy = '';
              shorttext = shorttext.replace(/</g,'&lt;');
              shorttext = shorttext.replace(/>/g,'&gt;');
              if (taggers && taggers[qu.id]) {
                  taggy = taggers[qu.id].join(' ');
              }
              if (remarks[qu.id]) {
                remark = ' '+remarks[qu.id].text;
                statusclass = ' status5';
              }
              if (dupes[qu.id]) {
                remark = ' duplicate of '+dupes[qu.id];
                statusclass = ' status6';
              }
              var tit = shorttext.replace(/['"]/g,'«');    //' just to help the editor
              var qdiv = '<div class="equest'+statusclass+'" id="qq_'+qu.id+'_'+qidx+'">';
              //if (wantlist) qdiv += '<input type="checkbox">';
              var hardnes = (qu.avg == 0) ? '' : (qu.avg < 0.5) ? 'hard' : (qu.avg < 0.8) ? 'medium' : 'easy';
              qdiv += '<input type="checkbox">';
              qdiv +=      '<span '+owner+' class="num n'+qu.sync+'">'+(+qidx+1)+'</span>' + '<span class="qid">'
                         + qu.id+ '</span><span class="img img'+qu.qtype+'"></span>'
                         + '<span title="'+qu.name+remark+'" class="qtype">&nbsp;' + qu.name + '</span><div title="'+taggy+'" class="qname"> '
                         + qu.subject + '</div><span title="'+tit+'" class="qshort">' + shorttext.substr(0,50)
                         + '</span><span title="avg:'+(+qu.avg).toFixed(2)+' count:'+qu.count+'" class="qpoints '+hardnes+'">'+ qu.points +'</span><div class="edme"></div>';
              //if (!wantlist) qdiv += '<div class="killer"></div>';
              qdiv += '</div>';
              qql.push(qdiv);
            }
            if (wantlist) {
              return qql;
            } else {
              qq = qql.join('');
              if (qq == '') {
                if (wbinfo.trail == '') {
                 qq += '<p class="bigf">På dette nivået bør du bare legge quiz-er.'
                       + "<br>dvs legg til spørsmål, endre type til quiz."
                       + "<br>Legg nye spørsmål inne i quizene";
                }
                qq += '<p class="bigf">Nå kan du enten: <ul>'
                   + '<li>Lage nye spørsmål - klikk på add'
                   + '<li>Koble inn eksisterende - klikk på attach'
                   + '</ul></p>';
                if (wbinfo.trail == '') {
                  qq += '<p class="bigf">Anbefalt: klikk på add.';
                }
              } else {
                qq += ' &nbsp; <span title="Tar valgte sprsml ut av denne quizen" class="listbut" id="killem">Slett</span>';
                qq += '<span title="Dupliserer valgte sprsml" class="listbut" id="dupem">Dupliser</span>';
                qq += '<span title="Frigjør fra original" class="listbut" id="ownem">Eierskap</span>';
                qq += '<span title="Nummerer valgte sprsml" class="listbut" id="numem">Nummerer</span>';
                qq += '<span title="Tag valgte sprsml" class="listbut" id="tagem">Tag</span>';
                qq += '<span title="Subject for valgte sprsml" class="listbut" id="subem">Subject</span>';
                qq += '<span title="Tag/Navn/Subject" ><input class="num4" id="tnavn" name="tnavn" text=""></span>';
                qq += '<div class="clearbox"></div>';
              }
              if (wbinfo.haveadded < 2) {
                // first new question
                qq += '<p class="bigf">For å redigere setter du markøren over et spørsmål og klikker på blyanten.'
                   +  '  Marker (kryss av) og klikk på <b>slett valgte</b> rett under spørsmålslista for å slette.'
                   +  '</p><p class="bigf">For å lage en quiz endrer du spørsmålstypen til quiz, '
                   +  ' dette gjør du ved å redigere spørsmålet (blyant ved mus over) og '
                   +  ' når redigeringsvinduet kommer fram kan du velge type '
                   +  ' fra en rullegardin. Velg quiz og klikk på den grønne Lagre knappen'
                   +  '</p><p class="bigf">'
                   +  '<ul><li>add - lag nye spørsmål</li><li>attach - koble inn eksisterende</li>'
                   +  '<li>reset - slett besvarelser og generer nye spørsmål</li><li>regen - gjenskap elevbesvarelser med endringer</li>'
                   +  '</ul></p>';  // '

              }
              return qq;
            }
           }

       , qrend:function(contopt,iid,qid,qua,qrender,scorelist,callback) {
         // renderer for a single question
              //var qu = qrender[iid];
              if (qid != qua.qid) alert("Rekkefølgen på spørsmål i denne quizen er endra - kan ikke vurdere. Lærer må ta reset.");
              var sscore = { userscore:0, maxscore:0, qdiv:'', scorelist:scorelist };
              var qdiv = wb.render.normal.displayQuest(qua,iid,contopt,sscore,1);
              var sum = 0;
              for (var i in scorelist) {
                sum += scorelist[i];
              }
              callback( { sscore:sscore, sumscore:sum });
              var quizscore = wbinfo.maxscore ? sum/wbinfo.maxscore : sum ;
              //$j.post(mybase + '/updatecontainerscore', {  cid:wbinfo.containerid, sum:quizscore });
         }

       , qlist:function(container,questlist,contopt, callback) {
         // renderer for question list
            var qq = '';
            var qql = [];
            var qqdiv = [];
            var sscore = { userscore:0, maxscore:0 ,scorelist:{} };
            //console.log("wb.render.qlist:",questlist);
            $j.post(mybase+'/log/renderq',{ container:container, questlist:questlist }, function(qrender) {
              //console.log("wb.render.qlist after renderq:",qrender);
              var qstart = 0, qant = qrender.length;
              var qintro = (contopt && contopt.intro) ? contopt.intro : '';
              if (contopt && contopt.antall) {
               // paged display
               qstart = Math.min(qrender.length-1, (+contopt.antall * +wbinfo.page[wbinfo.containerid]));
               qant =  Math.min(qrender.length, qstart + +contopt.antall);
               qintro = (qstart == 0) ? qintro : '';
              }
              var gonext = true;  // if navi != 1 then can not go to next page before submitting all on this page
              var open = true;  // open next question if prev already answerd
              var stepw = (contopt && contopt.trinn && contopt.trinn == '1');
              var missing = 0; // ungraded questions this page
              // this is used in stepwise test
              for (var qi=qstart; qi < qant; qi++) {
                var qu = qrender[qi];
                gonext = (qu.attemptnum > 0) ? gonext : false;
                missing += (qu.attemptnum > 0) ? 0 : 1;
                if (stepw) {
                  if (!open) {
                    qu.param.donotshow = 1;
                  } else {
                    open = qu.attemptnum > 0;
                  }
                }
                var qdiv = wb.render.normal.displayQuest(qu,qi,contopt,sscore,0);
                qql.push(qdiv);
              }
              wbinfo.missing[wbinfo.containerid] = missing;
              if (contopt.navi) {
                gonext = (contopt.navi == "1") ? '' : ' disabled' ;
                if (contopt.navi != "1"  && wbinfo.missing[wbinfo.containerid] < 1) {
                   gonext = '';
                   qql=[ '<div class="question">Besvart - naviger til neste spørsmål.</div>' ];
                   if (qant == qrender.length ) {
                     qql=[ '<div class="question">Du har fullført prøven.</div>' ];
                   }
                }
              }
              qintro = (qintro != '') ? '<div class="qintro">'+qintro+'</div>' : '';
              qq = qintro + qql.join('');
              if (contopt.antall) {
                 //if (qant < qrender.length && (contopt.trinn == '0' || qu.attemptnum > 0 ) ) {
                 //var hidden =  (contopt.trinn == '0' || qu.attemptnum > 0 ) ? '' : ' hidden';
                 if (qant < qrender.length ) {
                   qq += '<div id="nextpage" class="gui gradebutton '+gonext+'">&gt;&gt;</div>';
                 }
                 if (contopt.navi && contopt.navi == "1" && qstart > 0) {
                   qq += '<div id="prevpage" class="gui gradebutton">&lt;&lt;</div>';
                 }
              }
              sscore.userscore = Math.floor(sscore.userscore*100) / 100;
              callback( { showlist:qq, maxscore:sscore.maxscore, uscore:sscore.userscore, qrender:qrender, scorelist:sscore.scorelist });
            });
          }


         , displayQuest:function(qu,qi,contopt,sscore,scored,fasit) {
              // qu is the question+useranswer, qi is instance number
              // scored is set true if we have graded this instance
              // (we display ungraded questions on first show of question)
                fasit   = typeof(fasit) != 'undefined' ? fasit : [];
                if (qu.display == '') return '';
                var attempt = (qu.attemptnum != undefined) ? qu.attemptnum : 0;
                var score = qu.score || 0;
                var chosen = qu.response;
                var param = qu.param;
                var displayfasit = '';
                var status = qu.status;
                param.display = param.display.replace(/«/g,'"');
                param.display = param.display.replace(/»/g,"'");
                // TODO don't show below the word FASIT if it exists in the display text
                // this should be done on server - so user never recieves FASIT before he should
                // this is NOT DEPENDENT on fasit setting ( shows correct answers )
                // After FASIT you can display a graph, give some explanation
                // typically not give correct answer - but an explanation
                var parts = param.display.split(/FASIT/);
                // fasit.length != 0 if displaying results for a user
                param.display = parts[0];
                var abc = false;
                if (qu.qtype == 'abcde') {
                  // for abcde partial questions - do not show fasit before all
                  // subquestions are answered - ie attempt >= options.length
                  abc = param.options.length > attempt;
                }
                if ( abc || (fasit.length  == 0 && parts.length > 1 && (score < 0.8  && attempt < 3) )) {
                    //param.display = parts[0];
                  displayfasit = '';
                } else if (parts[1] && (fasit.length  || (contopt && contopt.fiidback && contopt.fiidback != 'none'))) {
                  displayfasit = '<h4 class="gui">FASIT</h4><div class="gui">' + parts[1]+ '</div>';
                }
                score = Math.round(score*100)/100;
                var delta = score || 0;
                sscore.userscore += delta;
                sscore.maxscore += qu.points;
                sscore.scorelist[qi] = delta;
                var adjusted = param.display;
                var hints = '';
                var grademe = '</div>';
                if (contopt.hints && contopt.hints == "1" && qu.param.havehints == "y") {
                  var cost = contopt.hintcost || 0;
                  if (qu.hintcount > 0) {
                    //var hi = qu.param.hints.split(/\n|_&_/).slice(0,qu.hintcount).join('<br>');
                    var hi = qu.param.hints.join('<br>');
                    hints = '<div id="hint'+qu.qid+'_'+qu.id+'" title="Bruk av hint reduserer poengsummen med '+(+cost*100)
                      +'% pr klikk " class="gui gethint">'+hi+'</div>';
                  } else {
                    hints = '<div id="hint'+qu.qid+'_'+qu.id+'" title="Bruk av hint reduserer poengsummen med '
                         +(cost*100)+'% pr klikk" class="gui gethint">Koster:'+cost+'</div>';
                  }
                }
                // special case for questions of type abcde - they can/must always be attempted as many times
                // as there are partial questions.
                // grademe is changed in case abcde
                if (contopt.adaptiv && contopt.adaptiv == "1" || !(scored || attempt > 0) ) {
                   grademe = '<div class="grademe"></div></div>';
                }
                if (param.donotshow) {
                  adjusted = '';
                }
                var checkmarks = [];  // mark correct if feedback for numeric
                var qtxt = ''
                var subtype; // used by numeric to limit input to valid range
                switch(qu.qtype) {
                      case 'quiz':
                          var mycopt = qu.param.contopt;
                          var embellish = '';
                          if (mycopt && mycopt.hidden == "1") {
                            if (!teaches(userinfo.id,wbinfo.coursename)) {
                               return '';
                            }
                            embellish += " cloaked";
                          }
                          var start,stop,mstart,mstop,elm,account='';
                          mstop = mstart = 0;
                          if (scoresum[qu.qid]) {
                              var ss = scoresum[qu.qid];
                              if (+ss.att >0) {
                                var width = Math.max(2,Math.min(16,16*(+ss.att/+ss.ant)));
                                account +='<span style="width:'+(width)+'px;" class="dot">'+ss.att+'</span>';
                              }
                              if (+ss.suu >0) {
                                var width = Math.max(2,Math.min(16,16*(+ss.suu/+ss.poo)));
                                var score = (+ss.suu/+ss.poo).toFixed(1);
                                account +='<span style="left:30px; width:'+(width)+'px;" class="dot">'+(score)+'</span>';
                              }
                          }
                          var justnow = new Date().getTime();
                          if (mycopt && mycopt.start) {
                            elm = mycopt.start.split('/');
                            start = new Date(elm[2],+elm[1]-1,elm[0]);
                            if (mycopt.hstart) {
                                mstart = 1000 * 3600 * mycopt.hstart;
                            }
                            if (mycopt.mstart) {
                                mstart += 1000 * 60 *mycopt.mstart;
                            }
                          }
                          if (mycopt && mycopt.stop) {
                            elm = mycopt.stop.split('/');
                            stop = new Date(elm[2],+elm[1]-1,elm[0]);
                            if (mycopt.hstop) {
                                mstop = 1000 * 3600 * mycopt.hstop;
                            }
                            if (mycopt.mstop) {
                                mstop += 1000 * 60 *mycopt.mstop;
                            }
                          }
                          start = start ?  start.getTime() + mstart : justnow - 20000;
                          stop = stop ? stop.getTime()  + mstop : justnow + 2000;
                          if (justnow < start || justnow > stop ) {
                            embellish += " clock";
                          }
                          if (mycopt && mycopt.locked == "1") {
                            embellish += " locked";
                          }
                          if (mycopt && mycopt.trinn == "1") {
                            embellish += " trinn";
                          }
                          if (mycopt && mycopt.exam && mycopt.exam.length) {
                            return '<div tag="'+qu.name+'" class="cont '+mycopt.exam+embellish+' quiz" id="qq'+qu.qid+'_'+qi+'">'
                              + qu.name + '<div class="account">'+account+'</div></div>';
                          }
                          return '<div tag="'+qu.name+'" class="cont quiz'+embellish+'" id="qq'+qu.qid+'_'+qi+'">'
                             + qu.name + '<div class="account">'+account+'</div></div>';
                          break;
                      case 'container':
                          return '<div tag="'+qu.name+'" class="cont container" id="qq'+qu.qid+'_'+qi+'">' +  qu.name + '</div>';
                          break;
                      case 'js':
                      case 'diff':
                      case 'textarea':
                          var iid = 0;
                          adjusted = adjusted.replace(/(&nbsp;&nbsp;&nbsp;&nbsp;)/g,function(m,ch) {
                                var vv = ''
                                if (chosen[iid]) {
                                  vv = chosen[iid].split('_|_')[0];
                                }
                                var ff = fasit[iid] || '';
                                var ret = '<textarea>'+vv+'</textarea>';
                                ret += '<div class="fasit gui">'+unescape(ff)+'</div>';
                                iid++;
                                return ret;
                              });
                          if (qu.feedback && qu.feedback != '' ) {
                            adjusted += '<div class="fasit gui">'+unescape(qu.feedback) + '</div>';
                          }
                          qtxt = '<div id="quest'+qu.qid+'_'+qi+'" class="qtext textareaq">'+adjusted;
                          if (iid > 0) {  // there are input boxes to be filled
                              decoration();
                              qtxt += grademe;
                              qtxt += '<div class="clearbox">&nbsp;</div>';

                          } else {
                              qtxt += '</div>';
                          }
                          break;
                      case 'abcde':
                          // this question type must always be attempted at least as many times as
                          // there are sub-questions.
                          // The active subquestion is selected based on attemptnum - so stud
                          // can never make a second attempt on already answered subq
                          if (qu.param.subtype && qu.param.subtype.length) {
                            subtype = qu.param.subtype;
                          }
                          grademe = '<div class="grademe"></div></div>';
                          qtxt = '<div id="quest'+qu.qid+'_'+qi+'" class="qtext multipleq">'+adjusted;
                          if (qu.feedback && qu.feedback != 'none' ) {
                            if (/^[0-9-]+$/.test(qu.feedback)) {
                              checkmarks = qu.feedback.split('');
                              qu.feedback = '';
                            }
                          }
                          if (!param.donotshow && param.options && param.options.length) {
                              qtxt += '<ol class="math showabcde">'
                              for (var i=0, l= param.options.length; i<l; i++) {
                                var klasslist = [];
                                var subus = '', subclass='';
                                var opt = param.options[i];
                                var enabled = (scored +attempt == i || (!scored && i == 0 && attempt==0)) ? '' : ' readonly="readonly"';
                                var klass = (enabled) ? ' readonly' : ' wantfocus';
                                var parts = opt.split('-||-');
                                var question = parts[0];
                                var guidance = parts[1] || '';
                                var unit = parts[2] || '';
                                var answer = chosen[i] || '';
                                var ff = fasit[i] || '';
                                if (subtype && subtype[i] != undefined) {
                                      klasslist.push('validate');    // add class to check input valid while typing
                                      var su =""+ subtype[i];
                                      subus = ' subtype="'+su+'" ';
                                      su = su.replace(/[347]/,"0");    // restricted to [-+eE0-9]
                                      su = su.replace(/[1256]/,"1");   // any input allowed
                                      subclass = ' valid'+su;
                                }
                                var ffy = (ff) ? '<span class="fasit gui">'+unescape(ff)+'</span>' : '';
                                //var chk = (checkmarks[i] != undefined && checkmarks[i]!='-') ? ' class="heck' + checkmarks[i]+ '"' : '';
                                if (checkmarks[i] != undefined && checkmarks[i]!='-') klasslist.push('heck' + checkmarks[i]);
                                var chk = klasslist.length ? 'class="'+klasslist.join(' ')+'"' : '';
                                qtxt += '<li><div class="guide">' + guidance + '</div>'
                                  + '<dl><dt>'+question+'</dt><dd><span class="abcde fillin'+klass+subclass+'"><input '
                                  + chk+ enabled+subus+' type="text" value="'+answer+'"></span><span class="units">'+unit+'</span>'+ffy+'</dd></dl></li>';
                                  //ret = '<span '+subclass+'><input '+chk+subus+' type="text" value="'+vv+'" /></span>'+ffy;
                              }
                              qtxt += '</ol>' + grademe;
                              decoration();
                          } else {
                              qtxt += '</div>';
                          }
                          break;
                      case 'numeric':
                          if (qu.param.subtype && qu.param.subtype.length) {
                            subtype = qu.param.subtype;
                          }
                          // TODO intentional drop thru to fillin
                      case 'jscore':
                      case 'fillin':
                          if (qu.feedback && qu.feedback != 'none' ) {
                            if (/^[0-9-]+$/.test(qu.feedback)) {
                              checkmarks = qu.feedback.split('');
                              qu.feedback = '';
                            }
                          }
                          var iid = 0;
                          // special case for numeric match anytext [[anytext]] - use textarea instead of <input text>
                          adjusted = adjusted.replace(/(_&nbsp;&nbsp;_)/g,function(m,ch) {
                                var vv = ''
                                if (chosen[iid]) {
                                  vv = chosen[iid];
                                }
                                var ff = fasit[iid] || '';
                                var ret = '<textarea>'+vv+'</textarea>';
                                ret += '<div class="fasit gui">'+unescape(ff)+'</div>';
                                iid++;
                                return ret;
                              });
                          adjusted = adjusted.replace(/(_?&nbsp;&nbsp;&nbsp;&nbsp;)/g,function(m,ch) {
                                var vv = '', ret;
                                var klasslist = [];
                                var subus = '', subclass='';
                                if (chosen[iid]) {
                                  vv = chosen[iid];
                                }
                                if (subtype && subtype[iid] != undefined) {
                                  klasslist.push('validate');    // add class to check input valid while typing
                                  var su =""+ subtype[iid];
                                  subus = ' subtype="'+su+'" ';
                                  su = su.replace(/[347]/,"0");    // restricted to [-+eE0-9]
                                  su = su.replace(/[1256]/,"1");   // any input allowed
                                  subclass = ' class="valid'+su+'" ';
                                }
                                var ff = fasit[iid] || '';
                                if (ch.substr(0,1) == '_') {  // [[anytext]] will be repaced by textarea - not input text
                                  ret = '<textarea>'+vv+'</textarea>';
                                  ret += '<div class="fasit gui">'+unescape(ff)+'</div>';
                                } else {
                                  if (checkmarks[iid] != undefined && checkmarks[iid]!='-') klasslist.push('heck' + checkmarks[iid]);
                                  var chk = klasslist.length ? 'class="'+klasslist.join(' ')+'"' : '';
                                  var ffy = (ff) ? '<span class="fasit gui">'+unescape(ff)+'</span>' : '';
                                  ret = '<span '+subclass+'><input '+chk+subus+' type="text" value="'+vv+'" /></span>'+ffy;
                                }
                                iid++;
                                return ret;
                              });
                          if (qu.feedback && qu.feedback != '' ) {
                            adjusted += '<div class="fasit gui">'+unescape(qu.feedback) + '</div>';
                          }
                          qtxt = '<div id="quest'+qu.qid+'_'+qi+'" class="qtext fillinq">'+adjusted;
                          if (iid > 0) {  // there are input boxes to be filled
                              decoration();
                              qtxt += grademe;
                              qtxt += '<div class="clearbox">&nbsp;</div>';

                          } else {
                              qtxt += '</div>';
                          }
                          break;
                      case 'sequence':
                          var iid = 0;
                          var used = {};
                          var feedback = [];
                          if (qu.feedback) {
                              try {
                                feedback = JSON.parse(qu.feedback);
                              } catch (err) {
                                console.log("Feedback EVAL-ERROR",err,qu.feedback);
                              }
                          }
                          adjusted = adjusted.replace(/(ª)/g,function(m,ch) {
                                var ret = '';
                                var fee = feedback[iid];
                                if (chosen[iid]) {  // if the separator was newline then already array, else csv
                                  var chozz = _.isArray(chosen[iid]) ? chosen[iid] : chosen[iid].split(',');
                                  for (var j=0, m = chozz.length; j<m; j++) {
                                      var opt = chozz[j];
                                      var oo = 'a';
                                      used[opt] ? used[opt]++ : used[opt] = 1;
                                      ret += '<li id="ddm'+qu.qid+'_'+qi+'_'+j+'" class="dragme">' + opt + '</li>';
                                  }
                                }
                                iid++;
                                return ret;
                              });
                          qtxt = '<div id="quest'+qu.qid+'_'+qi+'" class="qtext sequenceq">'+adjusted;
                          if (!param.donotshow && param.options && param.options.length) {
                              if (param.daze && param.daze.length) {
                                // distractors are defined - stir them in
                                param.options = param.options.concat(param.daze.split(','));
                                shuffle(param.options);
                              }
                              qtxt += '<hr>';
                              decoration();
                              qtxt += grademe;
                              qtxt += '<ul id="sou'+qu.qid+'_'+qi+'" class="qtext sourcelist connectedSortable">';
                              for (var i=0, l= param.options.length; i<l; i++) {
                                  //var opt = param.options[i].split(',')[0];
                                  var opt = param.options[i];
                                  if (used[opt]) {
                                    used[opt]--;
                                    continue;
                                  }
                                  qtxt += '<li id="ddm'+qu.qid+'_'+qi+'_'+i+'" class="dragme">' + opt + '</li>';
                              }
                              qtxt += '</ul>';
                              if (fasit[0] && qu.param && qu.param.fasit) {
                                 qtxt += '<ul class="sequence gui"><li>'+qu.param.fasit.join('<li>') + '</ul>';
                              }
                              qtxt += '<div class="clearbox">&nbsp;</div>';

                          } else {
                              qtxt += '</div>';
                          }
                          break;
                      case 'random':
                      case 'info':
                          qtxt = '<div id="quest'+qu.qid+'_'+qi+'" class="qtext dragdropq">'+adjusted + '</div>';
                          return '<div class="question" id="qq'+qu.qid+'_'+qi+'">' + qtxt + '</div>';
                      case 'textmark':
                      case 'dragdrop':
                          var iid = 0;
                          adjusted = adjusted.replace(/(&nbsp;&nbsp;&nbsp;&nbsp;)/g,function(m,ch) {
                                var ret = '&nbsp;&nbsp;&nbsp;&nbsp;';
                                if (chosen[iid]) {
                                  ret = chosen[iid];
                                }
                                var ff = fasit[iid] || '';
                                var ffy = (ff) ? ' <span class="fasit gui">'+unescape(ff)+'</span>' : '';
                                iid++;
                                return ret+ffy;
                              });
                          qtxt = '<div id="quest'+qu.qid+'_'+qi+'" class="qtext dragdropq">'+adjusted;
                          if (!param.donotshow && param.options && param.options.length) {
                              if (param.daze && param.daze.length) {
                                // distractors are defined - stir them in
                                param.options = param.options.concat(param.daze.split(','));
                                shuffle(param.options);   // TODO daze should be shuffled into options server-side
                              }
                              qtxt += '<hr>';
                              decoration();
                              qtxt += grademe;
                              for (var i=0, l= param.options.length; i<l; i++) {
                                  var opt = param.options[i].split(',')[0];
                                  if (opt == ' ') continue;
                                  qtxt += '<span id="ddm'+qu.qid+'_'+qi+'_'+i+'" class="dragme">' + opt + '</span>' ;
                              }
                              qtxt += '<div class="clearbox">&nbsp;</div>';

                          } else {
                              qtxt += '</div>';
                          }
                          break;
                      case 'multiple':
                          qtxt = '<div id="quest'+qu.qid+'_'+qi+'" class="qtext multipleq">'+adjusted
                          if (!param.donotshow && param.options && param.options.length) {
                              decoration();
                              qtxt += grademe;
                              for (var i=0, l= param.options.length; i<l; i++) {
                                  var opt = param.options[i];
                                  var chh = (chosen[i]) ? ' checked="checked" ' : '';
                                  var fa = (fasit[i] == '1') ? ' correct' : ((fasit[i] == '0' && chosen[i]) ? ' wrong' : '' );
                                  qtxt += '<div class="multipleopt'+fa+'"><input id="op'+qu.qid+'_'+i
                                        +'" class="check" '+chh+' type="checkbox"><label for="op'+qu.qid+'_'+i+'">' + opt + '</label></div>';
                              }
                          } else {
                              qtxt += '</div>';
                          }
                          break;
                  }
                  var qnum = +qi + 1;
                  var qname = (qu.name && qu.name != '') ? '<span title="'+qu.name+'" class="questname">'+qu.name+'</span>' : '';
                  var studnote = ''; // <div class="studnote"></div>
                  if (scored || (attempt != '' && attempt > 0))  {
                    if (userinfo.id == qu.userid || (qu.usercomment && qu.usercomment != '')) {
                      var stutxt = qu.usercomment.replace(/['"]/g,'«');
                      studnote = '<div  id="com'+qu.id+'" title="'+stutxt+'" class="studnote addcomment">'+stutxt+'</div>';  // ' just to help editor
                    }
                    if (teaches(userinfo.id,wbinfo.coursename) || (qu.teachcomment && qu.teachcomment != '')) {
                      var teachtxt = qu.teachcomment.replace(/['"]/g,'«');
                      studnote += '<div  id="com'+qu.id+'" title="'+teachtxt+'" class="teachnote addcomment">'+teachtxt+'</div>'; // ' editor help
                    }
                  }
                  var statusclass = '';
                  if (status != undefined && status != 0) {
                      statusclass = ' status'+status;
                  }
                  var hardnes = (qu.avg == 0) ? '' : (qu.avg < 0.5) ? 'hard' : (qu.avg < 0.8) ? 'medium' : 'easy';
                  qtxt = '<span class="qnumber '+hardnes+'">Spørsmål '+qnum + qname + ' ' + qu.points + 'p'
                    +' &nbsp; <span id="com'+qu.id+'" class="addcomment wbedit">&nbsp;</span></span>' + qtxt+displayfasit;
                  if (sscore.qdiv != undefined) {
                    sscore.qdiv = hints+qtxt+studnote;
                    sscore.qdivid = 'qq'+qu.qid+'_'+qi;
                    sscore.scid = 'sc'+qi;
                    sscore.atid = 'at'+qi;
                  }
                  return '<div class="question '+statusclass+' qq'+qi+'" id="qq'+qu.qid+'_'+qi+'">' + hints+ qtxt + studnote + '</div>';

                  function decoration() {
                     if (scored || (attempt != '' && attempt > 0)) {
                       qtxt += '<span id="at'+qi+'" class="attempt gui">'+(attempt)+'</span>';
                     }
                     if (scored || attempt > 0 || score != '') {
                       qtxt += '<span id="sc'+qu.qid+'_'+qi+'_'+qu.id+'_'+qu.points+'" class="score gui">'+score+'</span>'
                     }
                  }
            }
      }

wb.render.cool={
         header:function(heading,ingress,summary) {
            var head = '<h1 class="wbhead">' + heading + '<span id="editwb" class="wbteachedit">&nbsp;</span></h1>' ;
            var summary = '<div class="wbsummary"><table>'
                  + '<tr><th>Uke</th><th></th><th>Absent</th><th>Tema</th><th>Vurdering</th><th>Mål</th><th>Oppgaver</th><th>Logg</th></tr>'
                  + summary + '</table></div>';
            var bod = '<div class="wbingress">'+ingress+'</div>';
            return(head+summary+bod);
           }
       , body:function(bodytxt) {
            var bod = '<div class="wbbodytxt">'+bodytxt+'</div>';
            return bod;
           }
         // renderer for question list - should switch on qtype
       , qlist:function(questlist) {
            var qq = '';
            var qql = [];
            for (var qidx in questlist) {
              qu = questlist[qidx];
              var qdiv = '<div id="'+qu.id+'">' + qu.qtext + '</div>';
              qql.push(qdiv);
            }
            qq = qql.join('');
            return qq;
           }
      }
