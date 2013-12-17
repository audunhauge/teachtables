
/*
 *  Database io for workbook/quiz
 */

// get hold of database
var client = siteinf.client;
var quiz = require('./quiz').qz;
var parseJSON = require('./quiz').parseJSON;
var julian = require('./julian');
var async = require('async');
var _ = require('underscore');
var after = require('./utils').after;
var db = siteinf.database.db;
var os = require('os');
var hname = os.hostname();
var cachecounter = 0;
var lasttime = 0;       // last time we modified cache


setInterval(emptyCache,2000);  // check if cache needs to be emptied

function emptyCache() {
  client.query( "select * from subject where subjectname ='cache' ",
     after(function(res) {
         if (res && res.rows && res.rows[0]) {
             var r = res.rows[0];
             if (r.description != '') {
              var obj = parseJSON(r.description);
              // description = { hname:hostname, qid:id of changed question, lasttime:time of change }
              if (cachecounter > 3  || (cachecounter > 2 && obj.hname == hname) ) {
                // owner gets first chance at removing
                client.query( "update subject set description = '' where subjectname ='cache'",
                after(function(res) {
                  cachecounter = 0;
                  //console.log("DONE UPDATE CACHE")
                }));
              } else  {
                    if (lasttime[obj.qid] == undefined || lasttime[obj.qid] != obj.lasttime) {
                        lasttime[obj.qid] = obj.lasttime;
                        client.query("select q.*,0 as sync from quiz_question q where q.id =$1",[obj.qid],
                        after(function(res) {
                          quiz.question[obj.qid] = res.rows[0];
                        }));
                    }
                  cachecounter++;
              }
             }
         } else {
             cachecounter = 0;
             lasttime = {}; // forget time cache
         }
     }));
}


exports.gimmeahint = function(user,query,callback) {
  // gets a hint from quiz.question
  // and increments hintcount in useranswer
  var qid  = +query.qid;
  var uaid = +query.uaid;
  var just = +query.just;
  client.query( "select * from quiz_useranswer where id = $1 and userid = $2",[ uaid,user.id],
     after(function(res) {
          if (res && res.rows) {
            var uan = res.rows[0];
            var obj = parseJSON(uan.param);
            var hints = obj.hints || '';
            var hin = hints.split(/\n|_&_/);
            if (just || hin.length < uan.hintcount) {
              // get any hints already bought
              callback(hin.slice(0,uan.hintcount));
            } else {
              client.query( "update quiz_useranswer set hintcount = hintcount + 1 where id=$1", [uaid]);
              callback(hin.slice(0,uan.hintcount+1));
            }

          } else {
            callback([]);
          }
       }));
}


exports.editquest = function(user,query,callback) {
  // insert/update/delete a question
  var action  = query.action ;
  var qid     = +query.qid ;        // single question
  var qidlist = query.qidlist;      // question list - only delete
  var name    = query.name || '';
  var subject = query.subject || '';
  var qtype   = query.qtype || '';
  var status  = query.status;
  var qcache  = query.cache || '';  // do we need to update cache
  var qtext   = JSON.stringify(query.qtext) || '';
  var teachid = +user.id;
  var points  = +query.points || 0;
  var parent  = +query.parent;
  var now = new Date();
  quiz.containers = {};
  quiz.contq = {};
  if (qtype == 'quiz' || qcache == '1') {
    var obj = {};
    obj.qid = qid;
    obj.lasttime = now.getTime();
    obj.hname = hname;
    var strobj = JSON.stringify(obj);
    //console.log("Saving cache info",obj);
    client.query( "update subject set description = $1 where subjectname ='cache'",[strobj]);
  }
  //console.log(qid,name,qtype,qtext,teachid,points);
  switch(action) {
      case 'delete':
        if (!qidlist) qidlist = qid;
        // set status to 9 - indicates deleted
        console.log("Deleteing these questions:",qidlist);
        client.query( "update quiz_question set status=9 where id in ("+qidlist+") and qtype != 'container' and qtype != 'quiz' and teachid=$1", [teachid],
            after(function(results) {
                callback( {ok:true, msg:"updated"} );
            }));
        break;
      case 'update':
        var sql =  'update quiz_question set modified=$3 ';
        var params = [qid,teachid,now.getTime()];
        var idd = 4;
        if (query.qtext) {
          sql += ',qtext=$'+idd;
          params.push(qtext);
          idd++;
        }
        if (query.qtype) {
          sql += ',qtype=$'+idd;
          params.push(qtype);
          idd++;
        }
        if (query.status != undefined) {
          sql += ',status=$'+idd;
          params.push(status);
          idd++;
        }
        if (query.name) {
          sql += ',name=$'+idd;
          params.push(name);
          idd++;
        }
        if (query.points) {
          sql += ',points=$'+idd;
          params.push(points);
          idd++;
        }
        if (query.subject) {
          sql += ',subject=$'+idd;
          params.push(subject);
          idd++;
        }
        if (query.parent == 0) {
          sql += ',parent=$'+idd;
          params.push(0);
          idd++;
        }
        sql += ' where id=$1 and teachid=$2';
        console.log(sql,params);
        client.query( sql, params,
          after(function(results) {
            delete quiz.question[qid];  // remove it from cache
            callback( {ok:true, msg:"updated"} );
            client.query("select q.*,0 as sync from quiz_question q where q.id =$1",[qid],
                after(function(res) {
                    quiz.question[qid] = res.rows[0];
                }));
          }));
        break;
      default:
        callback(null);
        break;
  }
}

exports.updatecontainerscore = function(user,query,callback) {
  var cid    = +query.cid ;   // the queuestion (container) containing the questions
  var sum    = +query.sum ;   // total score for this container
  var uid    = +user.id;
  if (! _.isFinite(sum)) return;  // ignore if NaN or other bad stuff
  client.query( "update quiz_useranswer set score = $1 where userid=$2 and qid=$3", [sum,uid,cid]);
}

exports.addcomment = function(user,query,callback) {
  var uaid    = +query.uaid,   // id of useranswer to add comment to
      comment = query.comment;  // the comment
  if (user.department == 'Undervisning') {
    // teach comment
    client.query( "update quiz_useranswer set teachcomment = $1 where id=$2",[comment,uaid]);
  } else {
    client.query( "update quiz_useranswer set usercomment = $1 where id=$2 and userid=$3",[comment,uaid,user.id]);
    // stud-comment
  }
  callback(123);
}

exports.editscore = function(user,query,callback) {
  var uaid   = +query.uaid,
      nuval  = +query.nuval;  // the new score
  if (_.isFinite(nuval)) {
    client.query( "update quiz_useranswer set score = "+nuval+" where id="+uaid);
  }
  callback(123);
}

exports.gradeuseranswer = function(user,query,callback) {
  // returns a grade for a useranswer
  var qid     = +query.qid ;
  var iid     = +query.iid ;   // instance id (we may have more than one instance of a question in a container, generated questions)
  var cid     = +query.cid ;   // the question (container) containing the question
  var uid     = user.id;
  var contopt = query.contopt;
  var ua      = JSON.stringify(query.ua) || '';
  var now = new Date().getTime()
  var mycontainer,myquest;
  async.parallel( [
      function(callback) {
        var mycontainer;
        if (!quiz.question[cid]) {
            client.query( "select * from quiz_question where id = $1",[ cid ],
            after(function(results) {
              if (results && results.rows && results.rows[0]) {
                mycontainer = results.rows[0];
                quiz.question[mycontainer.id] = mycontainer;
                callback(null, mycontainer);
              } else {
                callback('err',null);
              }
            }));
        } else {
            mycontainer = quiz.question[cid];
            callback(null, mycontainer);
        }
      },
      function(callback) {
        var myquest;
        if (!quiz.question[qid]) {
            client.query( "select * from quiz_question where id = $1",[ qid ],
            after(function(results) {
              if (results && results.rows && results.rows[0]) {
                myquest = results.rows[0];
                quiz.question[myquest.id] = myquest;
                callback(null, myquest);
              } else {
                callback('err',null);
              }
            }));
        } else {
            myquest = quiz.question[qid];
            callback(null, myquest);
        }
      }
      ],
      function(err,results) {
        myquiz  = results[0];
        myquest = results[1];
        if (myquiz && myquest) {
          // grade the response
          // check if we have an existing useranswer (uid,qid,qzid)
          //console.log( "select * from quiz_useranswer where qid = $1 and userid = $2 and qzid=$3",[ qid,uid,qzid ]);
          client.query( "select * from quiz_useranswer where qid = $1 and userid = $2 and cid=$3 and instance=$4",[ qid,uid,cid,iid ],
            after(function(results) {
                  if (results && results.rows && results.rows[0]) {
                    // we will always have a user response (may be empty)
                    // as one MUST be generated before displaying a question
                    // any dynamic params are stored in user-response
                    var qua = results.rows[0];
                    var param = parseJSON(qua.param);
                    //var nugrade = quiz.grade(myquiz,myquest,ua,param);
                    quiz.grade(contopt,myquiz,myquest,ua,param,qua.attemptnum,qua.hintcount,user,iid,qua.id,function(nugrade,feedback,completed) {
                      //console.log("FEEDBACK IS NOW",feedback);
                      // completed will be 1 if this is a question with complete=1 in code section
                      //   if so then all other questions in this container will be updated to complete (score=1,attemptnum=1)
                      //   so that a stepwise container is completed if first (difficult) question answered correct
                      qua.param = param;
                      qua.param.display = unescape(qua.param.display);
                      for (var oi in qua.param.options) {
                           qua.param.options[oi] = unescape(qua.param.options[oi]);
                      }
                      qua.response = parseJSON(ua);
                      qua.feedback = feedback;
                      qua.param.optorder = '';
                      qua.qtype = myquest.qtype;
                      qua.points = myquest.points;
                      if (completed && completed.lock) {
                        callback({score:nugrade, att:0, qua:qua, completed:0} );
                      } else client.query( "update quiz_useranswer set score = $5,instance=$4,response=$1,"
                                    + "feedback='"+feedback+"', attemptnum = attemptnum + 1,time=$2 where id=$3",
                                    [ua,now,qua.id,iid,nugrade,],
                      after(function(results) {
                        // return parsed version of param
                        // as the question needs to be redisplayed
                        // to reflect userchoice
                        callback({score:nugrade, att:qua.attemptnum+1, qua:qua, completed:completed.comp} );
                      }));
                    });
                  } else {
                      console.log("Error while grading- missing user answer for displayed question");
                      callback({score:0, att:0,qua:{param:{display:""}} } );
                  }
          }));
        } else {
          //console.log("baddas came here");
          callback( { msg:'Bad quiz/quest'} );
        }
      });
}

exports.updateTags = function(user,query,callback) {
  // remove all tags from a question
  // create tags from list
  // all tags presumed to exist
  var qid     = +query.qid ;
  var teachid = +user.id;
  var tagstring   = query.tags;  // assumed to be 'atag,anothertag,moretags'
  // no quotes - just plain words - comma separated
  var tags = " ( '" + tagstring.split(',').join("','") + "' )";
  client.query( 'delete from quiz_qtag qt where qt.qid=$1 ', [qid],
     after(function(results) {
        // removed existing tags for this question
        // now we just add in new tags
        if (tagstring) {
          client.query( "select t.* from quiz_tag t where t.tagname in "+tags ,
          after(function(results) {
            // we now have ids for the tag-words
            var ttg = [];
            if (results && results.rows) {
              for (var i=0,l=results.rows.length; i<l; i++) {
                var ta = results.rows[i];
                ttg.push( '( '+ta.id+','+qid+')' );
              }
              var freshtags = ttg.join(',');
              client.query( "insert into quiz_qtag (tid,qid) values "+freshtags,
              after(function(results) {
                callback( {ok:true, msg:"retagged"} );
              }));
            } else {
              callback( {ok:false, msg:"nope"} );
            }
          }));
        } else {
          callback( {ok:true, msg:"notags"} );
        }
     }));
}

exports.changesubject = function(user,query,callback) {
  // change subject field for a set of questions (owned by user)
  var qidlist = query.qidlist;      // question list
  var subject = query.subject;      // question list
  var teachid = +user.id;
  if (qidlist) { client.query( "update quiz_question set subject='"+subject+"' where id in ("+qidlist+") and teachid="+teachid,
         after(function(results) {
               callback( {ok:true, msg:"removed"} );
           }));
  } else {
     callback(null);
  }
}

exports.edittags = function(user,query,callback) {
  // add/remove a qtag
  // will create a new tag if non exists (teachid,tagname)
  // will remove tag if no questions use it (after remove from qtag)
  var action  = query.action ;
  var qid     = +query.qid ;
  var qidlist = query.qidlist;      // question list - add/remove tags from these
  var tagname = query.tagname;
  var teachid = +user.id;
  if (tagname) tagname = tagname.substr(0,31);
  //console.log(qid,name,qtype,qtext,teachid,points);
  switch(action) {
      case 'tagfree':
          console.log( 'delete from quiz_qtag qt using quiz_question q where q.id = qt.qid  and qt.qid in ('+qidlist+') and q.teachid=$1', [teachid]);
        if (qidlist) {
          client.query( 'delete from quiz_qtag qt using quiz_question q where q.id = qt.qid  and qt.qid in ('+qidlist+') and q.teachid=$1', [teachid],
            after(function(results) {
              client.query( 'delete from quiz_tag qtt where qtt.id not in '
                + ' (select t.id from quiz_tag t inner join quiz_qtag qt on (t.id = qt.tid) ) ', [teachid],
                  after(function(results) {
                    callback( {ok:true, msg:"removed"} );
                  }));
            }));
          return;
        }
        break;
      case 'untag':
        console.log("delete from quiz_qtag qt using quiz_tag t where t.tagname=$1 and t.id = qt.tid and qt.qid in ("+qidlist+") ",tagname);
        if (qidlist) {
          client.query("delete from quiz_qtag qt using quiz_tag t where t.tagname=$1 and t.id = qt.tid and qt.qid in ("+qidlist+") "
            , [tagname],
            after(function(results) {
              client.query( 'delete from quiz_tag qtt where qtt.id not in '
                + ' (select t.id from quiz_tag t inner join quiz_qtag qt on (t.id = qt.tid) ) ', [teachid],
                  after(function(results) {
                    callback( {ok:true, msg:"removed"} );
                  }));
            }));
        } else {
          client.query('delete from quiz_qtag qt using quiz_tag t where t.tagname=$2 and t.id = qt.tid and qt.qid=$1 ', [qid,tagname],
            after(function(results) {
              client.query( 'delete from quiz_tag qtt where qtt.id not in '
                + ' (select t.id from quiz_tag t inner join quiz_qtag qt on (t.id = qt.tid) ) ', [teachid],
                  after(function(results) {
                    callback( {ok:true, msg:"removed"} );
                  }));
            }));
        }
        return;
        break;
      case 'tag':
          client.query( "select t.* from quiz_tag t where t.tagname = $1 ", [tagname],
          after(function(results) {
            // existing tag
            if (results && results.rows && results.rows[0] ) {
              console.log("Existing tag")
              var tagg = results.rows[0];
              client.query( "insert into quiz_qtag (qid,tid) values ($1,$2) ",[qid,tagg.id],
              after(function(results) {
                  console.log("INSERTED LINK TO Existing tag")
                  callback( {ok:true, msg:"tagged"} );
              }));
            } else {
              // create new tag
              console.log("CREATE NEW TAG")
              client.query( "insert into quiz_tag (teachid,tagname) values ($1,$2) returning id ",[user.id, tagname ],
              after(function(results) {
                if (results && results.rows && results.rows[0] ) {
                  var tagg = results.rows[0];
                  console.log("CREATED NEW TAG id=",tagg)
                  client.query( "insert into quiz_qtag (qid,tid) values ($1,$2) ",[qid,tagg.id],
                  after(function(results) {
                      console.log("INSERTED NEW TAG id=",tagg,qid)
                      callback( {ok:true, msg:"tagged"} );
                  }));
                } else {
                    console.log("FAILED INSERT NEW",tagname);
                    callback( {ok:false, msg:"failed"} );
                }
              }));
            }
          }));
          return;
        break;
      default:
        break;
  }
  callback(null);
}

exports.gettags = function(user,query,callback) {
  // returns all tags for a subject { teachid:[tag,..], ... }
  var uid    = user.id;
  var tags = {};
  var subjects = query.subject.split(',');
  var sublist = "( '" + subjects.join("','") + "' )";
  client.query( "select distinct q.teachid,t.tagname from quiz_tag t inner join quiz_qtag qt on (qt.tid=t.id) inner join quiz_question q on (q.id = qt.qid) "
      + " where q.teachid = $1 and q.subject in "+sublist+" and q.status != 9 order by t.tagname ", [uid],
  after(function(results) {
      if (results && results.rows && results.rows[0]) {
        for (var i=0,l=results.rows.length; i<l; i++) {
          var ta = results.rows[i];
          if (!tags[ta.teachid]) tags[ta.teachid] = [];
          tags[ta.teachid].push(ta.tagname);
        }
      }
      callback(tags);
  }));
}

var tags_defined = exports.tags_defined = { is_empty : 1 };  // remember all tags defined in db

exports.settag = function(user,query,callback) {
  // given a tagstring and qlist
  // creates the tag if not present
  // creates tag-entries for qlist
  //console.log("SETTAG ",user,query);
  var uid    = user.id;
  var tagstr = query.tagname;       // "Matrix"
  var qidlist = query.qidlist;      // question list "1,2,3"
  if (qidlist == '') {
    callback({ err:0, msg:"ok" } );
    return;
  }
  if ( tags_defined.is_empty ) {
    // tags assumed to be empty - fetch from dbase
    client.query("select id,tagname from quiz_tag",
      after(function(results) {
        tags_defined = {};
        if (results && results.rows) {
          for (var i=0,l=results.rows.length; i<l; i++) {
            var ta = results.rows[i];
            tags_defined[ta.tagname] = ta.id;
          }
        }
        maketag(uid,tagstr,qidlist,callback);
      }));
  } else {
    maketag(uid,tagstr,qidlist,callback);
  }
}

function maketag(uid,tagstr,qidlist,callback) {
  // we now need to ensure that the tagstr exists
  // insert if missing
  console.log("Defined tags:",tags_defined);
  if (tags_defined[tagstr] ) {
       do_maketag(uid,tagstr,qidlist,callback);
  } else {
    console.log("insert into quiz_tag (tagname,teachid) values ($1,$2) returning id",[tagstr,uid]);
    client.query("insert into quiz_tag (tagname,teachid) values ($1,$2) returning id",[tagstr,uid],
    after(function(results) {
      if (results && results.rows && results.rows[0]) {
        // returned a valid id after insert
        tags_defined[tagstr] = results.rows[0].id;
        do_maketag(uid,tagstr,qidlist,callback);
      } else {
        callback( { err:1, msg:"failed insert" } );
      }
    }));
  }
}

function do_maketag(uid,tagstr,qidlist,callback) {
  // we now have a valid tag-id and list of qids
  console.log("SETTAG do_maketag",uid,tagstr,qidlist);
  var tagid = tags_defined[tagstr];
  var insvalue = qidlist.replace(/,/g, function(c) {
        return "," + tagid +"),(" ;
      });
  insvalue += "," + tagid ;
  // first remove any pre-existing tags
  console.log("delete from quiz_qtag where qid in ("+qidlist+") and tid = $1", [ tagid ]);
  client.query("delete from quiz_qtag where qid in ("+qidlist+") and tid = $1", [ tagid ],
    after(function(results) {
      console.log("insert into quiz_qtag (qid,tid) values ( "+insvalue + ")" );
      client.query("insert into quiz_qtag (qid,tid) values ( "+insvalue + ")" );
    }));
  callback({ err:0, msg:"ok" } );
}

exports.gettagsq = function(user,query,callback) {
  // returns all tags for a given question
  var uid    = user.id;
  var qid     = +query.qid ;
  var tags = [];
  client.query( "select t.* from quiz_tag t inner join quiz_qtag qt on (t.id = qt.tid) where qt.qid=$1", [qid],
  after(function(results) {
      if (results && results.rows && results.rows[0]) {
        for (var i=0,l=results.rows.length; i<l; i++) {
          var ta = results.rows[i];
          tags.push(ta.tagname);
        }
      }
      callback(tags);
  }));
}

exports.getquesttags = function(user,query,callback) {
  // returns all questions with given tags
  // returns { tagname:{ teachid:[qid,..], ... }
  var subjects = query.subject.split(',');
  var sublist = "( '" + subjects.join("','") + "' )";
  if (user.department != 'Undervisning') {
      callback(null);
      return;
  }
  var uid    = user.id;
  var tagstring   = query.tags;  // assumed to be 'atag,anothertag,moretags'
  if (tagstring == 'quizlist') {
    // special casing - get all quizes
    var qtlist = { 'quizlist':{} };
    client.query( "select q.id,q.qtype,q.qtext,q.name,q.teachid,q.status,q.parent from quiz_question q  "
        + " where q.teachid=$1 and (qtype='quiz' or qtype='container') and q.subject in "+sublist
        + " and q.status != 9 order by modified desc", [uid],
    after(function(results) {
        if (results && results.rows && results.rows[0]) {
          for (var i=0,l=results.rows.length; i<l; i++) {
            var qta = results.rows[i];
            if (!qtlist.quizlist[qta.teachid]) qtlist.quizlist[qta.teachid] = [];
            qtlist.quizlist[qta.teachid].push(qta);
          }
        }
        callback(qtlist);
    }));
  } else if (tagstring == 'non') {
    // SPECIAL CASE tagstring == 'non' - find all questions with no tag
    var qtlist = { 'non':{} };
    client.query( "select q.id,q.qtype,q.qtext,q.name,q.teachid,q.status,q.parent from quiz_question q left outer join quiz_qtag qt on (q.id = qt.qid) "
        + " where qt.qid is null and q.teachid=$1 and q.subject in "+sublist
        + " and q.status != 9 order by modified desc", [uid],
    after(function(results) {
        if (results && results.rows && results.rows[0]) {
          for (var i=0,l=results.rows.length; i<l; i++) {
            var qta = results.rows[i];
            if (!qtlist.non[qta.teachid]) qtlist.non[qta.teachid] = [];
            qtlist.non[qta.teachid].push(qta);
          }
        }
        callback(qtlist);
    }));
  } else {
    // no quotes - just plain words - comma separated
    var tags = " ( '" + tagstring.split(',').join("','") + "' )";
    var qtlist = {};
    client.query( "select q.id,q.qtype,q.qtext,q.name,q.status,q.teachid,t.tagname,q.parent from quiz_question q inner join quiz_qtag qt on (q.id = qt.qid) "
        + " inner join quiz_tag t on (qt.tid = t.id) where q.teachid=$1 "  // and q.subject in "+sublist
        + " and q.status != 9 and t.tagname in  " + tags,[ uid ],
    after(function(results) {
        //console.log("GETQTAG ",results.rows);
        if (results && results.rows && results.rows[0]) {
          for (var i=0,l=results.rows.length; i<l; i++) {
            var qta = results.rows[i];
            if (!qtlist[qta.tagname]) qtlist[qta.tagname] = {};
            if (!qtlist[qta.tagname][qta.teachid]) qtlist[qta.tagname][qta.teachid] = [];
            qtlist[qta.tagname][qta.teachid].push(qta);
          }
        }
        callback(qtlist);
    }));
  }
}

exports.getquestion = function(user,query,callback) {
  // returns a question
  // returns {msg:"not owner"} if user is not owner
  var qid    = +query.qid ;
  var uid    = user.id;
  var sql = "select q.*,case when q.parent != 0 and q.qtext != qp.qtext then qp.qtext else '' end as sync, "
          + " qp.modified as synctime "
          + "from quiz_question q  left join quiz_question qp on (q.parent = qp.id) where q.id = $1 and q.teachid=$2 ";
  //client.query( "select q.* from quiz_question q where q.id = $1 and q.teachid = $2",[ qid,uid ],
  client.query( sql,[ qid,uid ],
  after(function(results) {
          if (results && results.rows && results.rows[0]) {
            var qu = results.rows[0];
            quiz.question[qu.id] = qu;    // Cache
            var qobj = quiz.getQobj(qu.qtext,qu.qtype,qu.id);
            if (qu.sync != '') {
              // differs from parent
              qu.sync = quiz.getQobj(qu.sync,qu.qtype,qu.id);
              qu.sync.modified = qu.synctime;
              if (qobj.display == qu.sync.display && qobj.code == qu.sync.code
                        && qu.sync.options == qobj.options &&  qu.sync.hints == qobj.hints && qu.sync.daze == qobj.daze) {
                  //console.log("SYNC sees no diff ",qu);
                  qu.sync = '';
              }
            }
            qu.display = qobj.display;
            if (qu.qtype == 'dragdrop' || qu.qtype == 'sequence'
              || qu.qtype == 'fillin'
              || qu.qtype == 'diff'
              || qu.qtype == 'numeric'
              || qu.qtype == 'textarea') {
              // display is what we show the student
              // for some questions this is not the text we want to edit
              // restore original text
              qu.display = qobj.origtext;
            }
            qu.qlistorder = qobj.qlistorder;
            qu.fasit = qobj.fasit;
            qu.cats = qobj.cats;
            qu.options = qobj.options;
            qu.code = qobj.code;
            qu.pycode = qobj.pycode;
            qu.hints = qobj.hints || '';
            qu.daze = qobj.daze || '';
            qu.contopt = qobj.contopt || {};
            callback(qu);
          } else {
            callback({msg:"not owner"});
          }
  }));
}





function scoreQuestion(uid,qlist,ualist,myscore,callback) {
  // qlist is list of questions to score
  if (qlist.length > 0) {
    var ua = qlist.shift();
      if (ua.qtype == 'quiz') {
        client.query(  "select q.points,q.qtype,q.name,qua.* from quiz_useranswer qua inner join quiz_question q on (q.id = qua.qid) "
                 + " where qua.cid = $1 and qua.userid = $2 order by qua.instance",[ ua.qid,uid ],
        after(function(results) {
          if (results && results.rows && results.rows.length > 0) {
            console.log("subquiz",ua.qid);
            ualist.c[ua.qid] = { q:{}, c:{}, name:ua.name };
            scoreQuestion(uid,results.rows,ualist.c[ua.qid],myscore,function () {
                  scoreQuestion(uid,qlist,ualist,myscore,callback);
              });
          } else {
            console.log("missing subquiz",ua.qid);
            if (!ualist.q[ua.qid]) {
              ualist.q[ua.qid] = {};
            }
            ua.param = parseJSON(ua.param);
            ua.param.display = unescape(ua.param.display);
            ua.response = {}
            ualist.q[ua.qid][ua.instance] = ua;
            scoreQuestion(uid,qlist,ualist,myscore,callback);
          }
        }));
      } else {
        //console.log("normal quest",ua.qid,ua.instance,ua.attemptnum,ua.score);
        if (!ualist.q[ua.qid]) {
          ualist.q[ua.qid] = {};
        }
        myscore.score += ua.score;
        myscore.tot += ua.points;
        ua.param = parseJSON(ua.param);
        ua.param.display = unescape(ua.param.display);
        for (var oi in ua.param.options) {
           ua.param.options[oi] = unescape(ua.param.options[oi]);
        }
        ua.response = parseJSON(ua.response);
        if (ua.qtype == 'multiple' ) {
          //console.log("reordering ",ua.param.fasit);
          ua.param.fasit = quiz.reorder(ua.param.fasit,ua.param.optorder);
        }
        ualist.q[ua.qid][ua.instance] = ua;
        scoreQuestion(uid,qlist,ualist,myscore,callback);
      }
  } else {
     if (callback) callback();
  }
}


exports.displayuserresponse = function(user,uid,container,callback) {
  // user is user driving this web page
  // uid is id of stud to show results for
  // we assume all questions have a user-response
  // this should happen in  r e n d e r q
  // we don't insert empty user-answers here
  //  we do however check for sub-containers
  //  and recurse thru them gathering up total score
  var cont = quiz.question[container] || {qtext:''} ;
  var cparam = parseJSON(cont.qtext);   // this is the question order as seen by student
  var contopt = cparam.contopt || {};
  var olist = cparam.qlistorder;    // question list as shown to user
  // first get container options AS EXIST NOW - ignore those stored in useranswer
  //   as show fasit may have changed AFTER student finished the test
  client.query("select q.id as i,q.qtext from quiz_question q where q.id = $1 ", [container],
  after(function(quizz) {
      var qz = quizz.rows[0];
      var qopts = parseJSON(qz.qtext);   // tru options for container as exists NOW
      var qcontopt = qopts.contopt || {};
      client.query( "select id,userid,qid,param,score from quiz_useranswer where qid=$1 and userid=$2 ",[ container,uid ],
      after(function(coont) {
        if (coont && coont.rows && coont.rows[0]) {
          var res = coont.rows[0];
          var coo = parseJSON(res.param);
          // need to remember userid <--> anonym
          var qlist = coo.qlistorder;
          if (typeof(qlist) == "string") {
            qlist = qlist.split(',');
          }
          console.log("DIffer ? ",olist,qlist);
          if (qlist && user.department == 'Undervisning' || ( (user.id == uid) && qcontopt.fasit && (+qcontopt.fasit & 1)) ) {
            // client.query(  "select q.points,q.qtype,q.name,q.subject,qua.* from quiz_useranswer qua inner join quiz_question q on (q.id = qua.qid) "
            //             + " where qua.qid in ("+(qlist.join(','))+" ) and qua.userid = $1 and qua.cid = $2 order by qua.time",[ uid, container ],
            client.query(  "select q.points,q.qtype,q.name,q.subject,qua.* from quiz_useranswer qua inner join quiz_question q on (q.id = qua.qid) "
                         + " where qua.userid = $1 and qua.cid = $2 order by instance,qua.time",[ uid, container ],
            after(function(results) {
                  var myscore = { score:0, tot:0};
                  var ualist = { q:{}, c:{}, sc:myscore, uid:uid };
                  if (results && results.rows) {
                    // clean the list - remove dups
                    // if source question is random - accept any qid for this slot
                    //console.log("Found these answers",results.rows,"qlist =",qlist);
                    var qqlist = [];
                    var usedlist = {};
                    for (var i=0; i< results.rows.length; i++) {
                      var qq = results.rows[i];
                      //if (qq.qid != qlist[i] ) {
                      if (qlist.indexOf(""+qq.qid) <0) {
                          // this question id is not in list
                          var ra = +qlist[i];
                          var ran = quiz.question[ra];
                          if (ran && ran.qtype != 'random') {
                              continue;  // question doesnt match source and source is not random - ignore
                          }
                      }
                      if (usedlist[qq.id] && usedlist[qq.id][qq.instance]) continue;
                      qqlist.push(qq);
                      if (!usedlist[qq.id]) usedlist[qq.id] = {};
                      if (!usedlist[qq.id][qq.instance]) usedlist[qq.id][qq.instance] = 1;
                    }
                    scoreQuestion(uid,qqlist,ualist,myscore,function () {
                         callback(ualist);
                         var prosent = (myscore.tot > 0) ? myscore.score/myscore.tot : 0;
                         if (_.isFinite(prosent))
                           client.query( "update quiz_useranswer set score = $1 where userid=$2 and qid=$3", [prosent,uid,container]);
                      });
                  } else {
                    callback(ualist);
                  }
            }));
          } else {
              var myscore = { score:0, tot:0};
              var ualist = { q:{}, c:{}, sc:myscore, uid:uid };
              callback(null);
          }
        } else {
          callback(null);
        }
      }));
  }));
}

var remarked = exports.remarked = function(user,query,callback) {
  var isteach = (user.department == 'Undervisning');
    //console.log("select qp.id,u.userid,u.teachcomment from quiz_useranswer u inner join quiz_question q on (u.qid=q.id) "
    //             + "inner join quiz_question qp on (q.parent = qp.id and qp.teachid=$1) where u.userid=q.teachid "
    //             + "and u.teachcomment != '' and u.userid != $1;",[user.id]);
    client.query("select qp.id,u.userid,u.teachcomment from quiz_useranswer u inner join quiz_question q on (u.qid=q.id) "
                 + "inner join quiz_question qp on (q.parent = qp.id and qp.teachid=$1) where u.userid=q.teachid "
                 + "and qp.modified < u.time and u.teachcomment != '' and u.userid != $1;",[user.id],
    after(function(stats) {
      console.log("Getting remarked questions",stats);
      callback(stats.rows)
    }));
}

var quizstats = exports.quizstats = function(user,query,callback) {
  var isteach = (user.department == 'Undervisning');
  var studid  = query.studid;
  var studlist = query.studlist || "" ;  // list of student ids
  var goodlist = _.every(studlist.split(","),function(e) { return (e == Math.floor(+e))});
  // test that studlist is list of numbers
  var now = new Date();
  var justnow = now.getTime();
  var lim1 = justnow-8*24*60*60*1000;
  var lim2 = justnow-18*24*60*60*1000;
  var lim3 = justnow-38*24*60*60*1000;
  var subject  = query.subject || "";
  if (goodlist ) {
    // here we have everything in one query
    //   we only take scores [0,1] to avoid edge cases
    client.query("select u.userid,t.tagname,sum(u.score) as su,count(u.id) as ant, sum(u.score)/count(u.id) as oavg "
            +      " , sum(case when u.time > $2 then u.score when u.time > $3 then u.score*0.7 when u.time > $4 then u.score*0.4 else u.score*0.2 end)  "
            +      " / sum(case when u.time > $2 then 1 when u.time > $3 then 0.7 when u.time > $4 then 0.4 else 0.2 end) as avg  "
            +      " from quiz_useranswer u inner join quiz_qtag qt on (u.qid = qt.qid) inner join quiz_tag t on (qt.tid=t.id) "
            +      " inner join quiz_question q on (q.id = u.qid) where u.userid in (" + studlist
            +      "  ) and u.attemptnum >0 and q.subject=$1 and u.score >= 0 and q.points = 1 "
            +      " group by u.userid,t.tagname having count(u.id) > 2 order by ant desc", [subject,lim1,lim2,lim3],
    after(function(stats) {
      if (!isteach) {
        var ii=0;
        var remap = {};
        for (var i =0; i < stats.rows.length; i++) {
          var elm = stats.rows[i];
          if (elm.userid != user.id) {
            if (!remap[elm.userid]) {
              remap[elm.userid] = 'anonym' + ii++;
            }
            elm.userid = remap[elm.userid];
          }
        }
      }
      callback(stats)
    }));
  } else {
    callback({});
  }

}

var progressview = exports.progressview = function(user,query,callback) {
  // show progress for all users in this workbook
  var subject  = query.subject;
  var teachid  = query.teachid;
  var studlist = query.studlist ;  // list of student ids
  var isteach   = (user.department == 'Undervisning');
  var progress = [];
  var history  = {};
  var quizzes  = {};
  // first fetch params for all quizzes owned by this teach
  client.query("select q.id as i,q.qtext from quiz_question q "
      + "where q.qtype = 'quiz' and q.teachid=$2 and q.subject=$1 ", [subject,teachid],
  after(function(quizz) {
    var qz = quizz.rows;
    for (var i=0,l=qz.length; i < l; i++) {
          var r = qz[i];
          var qopts = parseJSON(r.qtext);
          quizzes[r.i] = qopts.contopt;
    }
    client.query("select q.name as n, max(qu.time) as t, qu.userid as u, qu.cid as k,count(qu.score) as c,sum(qu.score) as s "
      + "from quiz_useranswer qu inner join quiz_question q on (q.id = qu.cid) "
      + "where q.qtype = 'quiz' and q.teachid=$2 and q.subject=$1 and qu.attemptnum > 0 and qu.userid in ("+studlist
      + ") group by qu.userid,qu.cid,q.name order by userid,cid", [subject,teachid],
    after(function(prog) {
         if (prog && prog.rows) {
           progress = prog.rows;
           client.query("select qh.userid as u, max(qh.score) as m, max(qh.timest) as t, qh.container as k from quiz_history qh inner join quiz_question q on (q.id = qh.container) "
              + "where q.qtype = 'quiz' and q.teachid=$2 and q.subject=$1 and qh.userid in ("+studlist
              + ") group by qh.userid,qh.container ", [subject,teachid],
          after(function(hist) {   // history used if no current answers for container - user reset
            console.log(history);
            if (!isteach) {
                var ii=0;
                var remap = {};
                for (var i=0,l=progress.length; i < l; i++) {
                      var r = progress[i];
                      if (r.u != user.id) {
                           if (!remap[r.u]) {
                               remap[r.u] = 'anonym' + ii++;
                           }
                           r.u = remap[r.u];
                      }
                }
            }
            // remap history also (studs not see others)
            if (hist && hist.rows) {
                var histo = hist.rows;
                for (var i=0,l=histo.length; i < l; i++) {
                    var r = histo[i];
                    if (!isteach && r.u != user.id) {
                        if (!remap[r.u]) {
                           remap[r.u] = 'anonym' + ii++;
                        }
                        r.u = remap[r.u];
                    }
                    if (!history[r.u]) history[r.u] = {};
                    history[r.u][r.k] = { score:r.m, time:r.t };
                }
            }
            callback({progress:progress,history:history, quiz:quizzes});
          }));
         } else {
           callback({progress:progress,history:history, quiz:quizzes});
         }
     }));
  }));
}

var generateforall = exports.generateforall = function(user,query,callback) {
  // generate useranswer for all users
  var container = +query.container;
  var parentid  = +query.parentid;
  var questlist = query.questlist ;  // used in r e n d e rq - just fetch it here to check
  var group     = query.group;
  var isteach   = (user.department == 'Undervisning');
  if (isteach) {
          if (db.memlist[group]) {
              client.query("select * from quiz_useranswer where userid=$1 and qid=$2", [user.id,container],
              after(function(master) {
                // get hold of container one level up
                if (master && master.rows) {
                    var massa = master.rows.pop();
                    if (massa && massa.cid) {
                        // we now have containing container
                        console.log("CONTAINING CONTAINER IS",massa.cid);
                        for (var i=0, l = db.memlist[group].length; i<l; i++) (function(enr) {
                          getcontainer({id:enr},{container:massa.cid},function(res) {
                            console.log("generating outer container for ",enr)
                            renderq({id:enr},{container:massa.cid,questlist:res.qlist},function(res) {
                                getcontainer({id:enr},{container:container},function(res1) {
                                   console.log("generating inner container for ",enr)
                                   renderq({id:enr},{container:container,questlist:res1.qlist},function(res) {
                                   });
                                });
                            });
                          });
                        }) (db.memlist[group][i]);
                    }
                }
              }));
          }
  }
  callback(null);
}

var ccc = 0;

var renderq = exports.renderq = function(user,query,callback) {
  // renders a list of questions
  // each question may be repeated and displayed
  // differently depending on parameters
  // any questions/instances missing a useranswer
  // will have one inserted and parameters generated for it
  // all questions are assumed to be in quiz.question cache
  var randlist = [];  // list of used random question ids - we only pick them once;
  var container = +query.container;
  var questlist = query.questlist ;
  var uid       = +user.id;
  var justnow   = new Date();
  var diff = (+siteinf.timezone)*60 - justnow.getTimezoneOffset();
  var now       = justnow.getTime() - diff*60*1000;
  //console.log("GETTING TIME: ",justnow.getTime(),justnow.getTimezoneOffset(),now,diff);
  var contopt   = {};
  var message   = null;
  var baselist  = [];  // useranswers ordered by instance - need if random question type
  var ualist    = {};  // list of generated user answers (questions as shown to stud - not actual answers)
  var already   = {};  // list of questions with existing answers (actual answers).
  var retlist   = [];  // list to return
  // check that we have complete cache
  /*
  for (var qi in questlist) {
      var qu = questlist[qi];
      if (!quiz.question[qu.id]) {
          quiz.question = {};
          break;
      }
  }
  */
  if (Object.keys(quiz.question).length == 0) {
      // the question cache has been reset
      // can not show anything before getcontainer is redone
      message = { points:0, qtype:'info', param: { display: '<h1>Klikk på navnet på quiz-en i stien over</h1>Må hente question cache på nytt.' } };
      retlist.unshift(message);
      callback(retlist);
      return;
  }
  // first fetch all questions used by this user in this quiz (independent of actual contents of quiz container - accounts for RANDOM question type)
  client.query( "select q.* from quiz_question q inner join quiz_useranswer qu on (q.id = qu.qid) where cid = $1 and userid = $2 ",[ container,uid ],
  after(function(prefetch) {
    for (var i=0,l=prefetch.rows.length; i<l; i++) {
      var qu = prefetch.rows[i];
      quiz.question[qu.id] = qu;           // Cache
    }
    client.query( "select * from quiz_useranswer where qid = $1 and userid = $2 ",[ container,uid ],
    after(function(results) {
     client.query( "select q.* from quiz_question q where q.status != 9 and q.id =$1",[ container ],
     after(function(master) {
        // we now have the container as it exists now
        // must get useranswer for container.
      client.query( "select * from quiz_useranswer where cid = $1 and userid = $2 order by instance",[ container,uid ],
      after(function(answers) {
            if (answers && answers.rows) {
              for (var i=0,l=answers.rows.length; i<l; i++) {
                var ua = answers.rows[i];
                var q = quiz.question[ua.qid];
                if (q == undefined) {
                  continue;  // this response is to a question no longer part of container
                  // just ignore it
                  // TODO here we skip existing answers to random questions before quiz.question is filled
                }
                var qopts =parseJSON(q.qtext);
                ua.points = q.points;
                ua.qtype = q.qtype;
                ua.name = q.name;
                ua.status = q.status;
                ua.subject = q.subject;
                baselist[i] = ua;         // easy lookup if we have random question type
                if (!ualist[ua.qid]) {
                  ualist[ua.qid] = {};
                }
                ua.param = parseJSON(ua.param);
                ua.param.display = unescape(ua.param.display);
                ua.param.fasit = '';
                ua.param.cats = '';
                ua.param.havehints = '';
                ua.param.contopt = qopts.contopt;   // fetch out the TRUE container-opts
                // these should track the question AS IS NOW - not as when useranswer generated
                // other params should stay as generated (dynamic vars etc).
                // this so that hiding/showing a quiz takes effect immediately
                if (ua.param.hints) {
                  // there are hints to be had
                  // return those already payed for
                  var hin = ua.param.hints.split(/\n|_&_/);
                  ua.param.hints = hin.slice(0,ua.hintcount);
                  ua.param.havehints = 'y';
                }
                if (q.qtype == 'fillin' || q.qtype == 'numeric' ) {
                  // must blank out options for these as they give
                  // correct answer
                  ua.param.options = [];
                }


                for (var oi in ua.param.options) {
                   ua.param.options[oi] = unescape(ua.param.options[oi]);
                }
                ua.response = parseJSON(ua.response);
                ua.param.optorder = '';
                ualist[ua.qid][ua.instance] = ua;
                if (ua.attemptnum) {
                    if (!already[ua.qid]) {
                      already[ua.qid] = 0;
                    }
                    already[ua.qid]++;
                    // we have existing answer for this question
                    // if we generate random question-set
                    // then keep this question if still in list to choose from
                }
              }
            }
      var containerq = results.rows[0];    // quiz-container as stored for this user
      var masterq = master.rows[0];        // current version of quiz-container
      var moo = parseJSON(masterq.qtext);
      var attemptnum = 0;
      var shuffle = false;
      var coo;
      if (moo.contopt && (moo.contopt.randlist || moo.contopt.shuffle)) {
          shuffle = true;
      }
      //console.log("QLISTST ",questlist.map( function(a) { return a.id+a.qtype; }),contopt);
      if (!containerq) {
        // no container exists for this user - coo is given by quiz
        attemptnum = 0;
        coo = moo;
        //console.log("paaa 2",coo);
      } else {
          coo = parseJSON(containerq.param);  // coo is fetched from useranswer
          attemptnum = containerq.attemptnum;
          if (shuffle) {
              // use original order (its a random shuffle or selection)
          } else {
              // use authoritative order as exists in container now
              //coo.qlistorder = moo.qlistorder.join(',');
              coo.qlistorder = moo.qlistorder;
          }
      }
      //if (quiz.question[container]) {
      //var containerq = quiz.question[container];
      contopt = moo.contopt || {};
      if (contopt.start || contopt.stop) {
        var start,stop,elm,hstart,mstart,hstop,mstop;
        hstart = hstop = mstart = mstop = 0;
        if (contopt.start) {
          elm = contopt.start.split('/');
          start = new Date(elm[2],+elm[1]-1,elm[0]);
        }
        if (contopt.stop) {
          elm = contopt.stop.split('/');
          stop = new Date(elm[2],+elm[1]-1,elm[0]);
        }
        if (contopt.hstart) {
            hstart = Math.floor(+contopt.hstart);
            hstart = Math.max(0,Math.min(23,hstart));
        }
        if (contopt.mstart) {
            mstart = Math.floor(+contopt.mstart);
            mstart = Math.max(0,Math.min(59,mstart));
        }
        if (contopt.hstop) {
            hstop = Math.floor(+contopt.hstop);
            hstop = Math.max(0,Math.min(23,hstop));
        }
        if (contopt.mstop) {
            mstop = Math.floor(+contopt.mstop);
            mstop = Math.max(0,Math.min(59,mstop));
        }
        start = (start) ? start.getTime() : now - 2000;
        stop =  (stop) ? stop.getTime() : now +3600000;
        start = start + 1000*60* (hstart*60+mstart);
        stop = stop  + 1000*60* (hstop*60+mstop);
        if (now < start || now > stop ) {
          var db1 = new Date(now);
          var db2 = new Date(start);
          var db3 = new Date(stop);
          console.log("start,now,stop = ",db2.toLocaleTimeString(),' < ',db1.toLocaleTimeString( ),' < ',db3.toLocaleTimeString() ) ;
          var d1 = new Date(start), d2 = new Date(stop);
          var dd0 = justnow.toLocaleString().substr(0,21);
          var dd1 = d1.toLocaleString().substr(0,21);
          var dd2 = d2.toLocaleString().substr(0,21);
          if (user.department == 'Undervisning' ) {
            message = { points:0, qtype:'info', param: { display: '<h1>Test not open</h1>Start: '+dd1+'<br>Stop: '+dd2+'<br>Server time is '+dd0 } };
          } else {
            callback([ { points:0, qtype:'info', param: { display: '<h1>Test not open</h1>Start: '+dd1+'<br>Stop: '+dd2} } ]);
            return;
          }
        }
      }
      /// call in and generate question list TODO
      questlist = generateQlist(shuffle,attemptnum,coo,questlist,already,contopt,uid,container);
      //console.log("NOW QLISTST ",questlist.map( function(a) { return a.id+a.qtype; }),contopt);
      if (answers && answers.rows) {

              // ensure that we have useranswers for all (question,instance) we display
              // we insert empty ua's as needed
              var missing = [];

              // we need to make recursive calls until all questions
              // are handled by python callback (if they have any python-code).
              // this might slow down the server quite a bit
              // if a whole class enters a workbook with many questions using python code
              //   TODO should flag those that use random and reuse param for those that do not.
              loopWait(0,function() {
                var misslist = missing.join(',');
                if (misslist) {
                  client.query( "insert into quiz_useranswer (qid,userid,cid,response,time,score,param,instance) values "+misslist,
                  function(err,results) {
                    if (err) {
                      console.log(err);
                      callback(null);
                    } else {
                      renderq(user,query,callback);
                    }
                  });
                } else {
                  // now we have ua for all (question,instance) in list
                  // generate display text and options for each (q,inst)
                  if (message) {
                    retlist.unshift(message);
                  }
                  callback(retlist);
                }
              });
      } else {
                callback(null);
                console.log('UNEXPECTED, SURPRISING .. r enderq found no useranswers');
                // we should not come here as the select should return atleast []
      }
      /// handle need for callback before inserting
      function loopWait(i,cb) {
                  if (i < questlist.length) {
                    var qu = questlist[i];
                    if (qu == undefined) {
                      // forgot to delete useranswer?
                      console.log("HOW DID THIS HAPPEN?",questlist,i);
                    }
                    if (!quiz.question[qu.id]) {
                        console.log("CACHE MISS",qu.id,quiz.question);
                        cb();
                        return;
                    }
                    if (qu.qtype == 'random' && baselist[i] && baselist[i].qtype != 'random') {
                      // question type is random and we have a question for this slot
                      // and its not random itself - implies we have picked a random question
                      retlist[i] = baselist[i];
                      loopWait(i+1,cb);
                    } else if (ualist[qu.id] && ualist[qu.id][i]) {
                      retlist[i] = ualist[qu.id][i];
                      loopWait(i+1,cb);
                    } else if (ualist[qu.id]) {
                       // we have the question, but with another index
                       // this may happen if 1: shuffle  2:duplicated question (allowed)
                       // easy way to make a quiz - dynamic question repeated n-times.
                       // gives n  similar questions with different params (calculated values)
                       for (var iiixi in ualist[qu.id]) {
                         retlist[i] = ualist[qu.id][iiixi];
                         delete ualist[qu.id][iiixi];
                         loopWait(i+1,cb);
                         break;
                       }
                    } else {
                      // create empty user-answer for this (question,instance)
                      // run any filters and macros found in qtext
                      if (qu.qtype == 'random') {
                        var thesetags = "'"+qu.contopt.tags.replace(/,/g,"','")+"'";
                        var seltype = (qu.contopt.seltype == 'all') ? " and qtype not in ('quiz','container','random')"
                                        : " and qtype = '"+qu.contopt.seltype +"'";
                        client.query('select q.*,t.tagname from quiz_question q inner join quiz_qtag qt on (q.id = qt.qid) '
                                     + 'inner join quiz_tag t on (qt.tid = t.id) where q.teachid=$1 and t.tagname in ('+thesetags+')' + seltype
                                     + ' and points ='+qu.points
                                     + " and subject = '"+qu.subject+"'"
                                     + ' and status = 0'
                                     , [masterq.teachid],
                        after(function(random) {
                            var nu = qu;
                            if (random.rows.length) {
                               nu = _.shuffle(random.rows)[0];
                               questlist[i] = nu;
                               quiz.question[nu.id] = nu;
                               query.questlist[i] = nu;   // replace the RANDOM-TYPE question with randomly chosen question
                               // grading this question doesnt work - checks remove answers to questions that are no longer part of
                               // a quiz - a random question (randomly chosen based on tags) is never part of a quiz
                            }
                            quiz.generateParams(nu,user.id,i,container,function(params) {
                              missing.push( " ( "+nu.id+","+uid+","+container+",'',"+now+",0,'"+JSON.stringify(params)+"',"+i+" ) " );
                              loopWait(i+1,cb);
                            });
                        }));
                      } else {
                        quiz.generateParams(qu,user.id,i,container,function(params) {
                          missing.push( " ( "+qu.id+","+uid+","+container+",'',"+now+",0,'"+JSON.stringify(params)+"',"+i+" ) " );
                          loopWait(i+1,cb);
                        });
                      }
                    }
                  } else {
                    cb();
                  }
              }
     }));
    }));
   }));
  }));
}

function generateQlist(shuffle,attemptnum,coo,questlist,already,contopt,uid,container) {
    if ( !shuffle || attemptnum != 0) {
        var qlist = coo.qlistorder;
        if (qlist && !Array.isArray(qlist)) {
            qlist = qlist.split(',');
        }
        var ref = {};
        var rr = [];
        var allPresent = true;  // assume we have these questions
        for (var i=0; i< questlist.length; i++) {
          var q = questlist[i];
          rr.push(q.id);
          ref[q.id] = q;
        }
        var newlist = [];
        if (qlist) for (var i=0; i< qlist.length; i++) {
          if (ref[qlist[i]]) {
            newlist.push(ref[qlist[i]]);
          } else { // this question is no longer part of the container
            attemptnum = 0;
            allPresent = false;
          }
        }
        if (allPresent) questlist = newlist;
    } else if ( attemptnum == 0) {
        questlist =  genNewQlistOrder(already,questlist,contopt,coo,uid,container);
    }
    return questlist;
}


function genNewQlistOrder(already,questlist,contopt,coo,uid,container) {
    var always = []; // list of questions always used
    var fresh = []; // templist with existing answers removed
    for (var i=0; i< questlist.length; i++) {
        var q = questlist[i];
        if (already[q.id]) {
            // push this question into always
            always.push(q);
            already[q.id]--;
        } else {
            fresh.push(q);
        }
    }
    questlist = fresh;
    if (always.length == 0 && contopt.xcount && +contopt.xcount > 0) {
        // the first N questions are to be used no matter what
        // we slice them of only do this if always is still empty
        // if not empty - then always contains already answered questions
        var n = +contopt.xcount;
        always = questlist.slice(0,n);
        questlist = questlist.slice(n);
    }
    if (contopt.randlist && contopt.randlist == "1") {
      // pick N random questions
      if (contopt.rcount && +contopt.rcount >= always.length && +contopt.rcount - always.length <= questlist.length) {
         questlist = quiz.shuffle(questlist);
         questlist = questlist.slice(0,+contopt.rcount - always.length);
      }
    }
    questlist = always.concat(questlist);
    if (contopt.shuffle && contopt.shuffle == "1") {
      // must reshuffle so _always_ list gets mixed in
      questlist = quiz.shuffle(questlist);
    }
    coo.qlistorder = questlist.map(function(e) { return e.id }).join(',');
    var para = JSON.stringify(coo)
    client.query("update quiz_useranswer set param = $1,attemptnum =1 where userid=$2 and qid = $3",[ para,uid,container],
      after(function(results) {
           //console.log("update quiz_useranswer set param = $1,attemptnum =1 where userid=$2 and qid = $3",[ para,uid,container]);
      }));
    return questlist;
}

exports.deletestudresp = function(user,query,callback) {
  // deletes a stud response for a given quiz - question
  var container    = +query.container ;
  var qid          = +query.qid ;
  var uid          = user.id;
  var params = [ container,uid ];
  var sql = "delete from quiz_useranswer where qid=$1 and cid =$2 and userid=$3 ";
  client.query( sql,[ qid,container,uid ],
      after(function(results) {
          callback(0);
      }));
}

exports.studresetcontainer = function(user,query,callback) {
  // deletes useranswers for (container)
  user = user || {};
  var container    = +query.container ;
  var userid       = +query.uid ;
  var uid          = user.id;
  var isteach = (user.department == 'Undervisning');
  if (isteach && userid) {
      uid = userid;
  }
  var params = [ container,uid ];
  var sql1 = "update quiz_useranswer set cid=null,param='',response='' where (cid =$1) and userid=$2 and response != '' and response !~ '\\[(\\\"\\\",?)+\\]'";
  // preserve score for useranswers that have been attempted (for calculating avgs)
  var sql2 = "delete from quiz_useranswer where (cid =$1) and userid=$2";
  //console.log("studresetcontainer::");
  // before we delete we save score as history for this container.
  // thus we must calculate the score ..
  // we actually get for all studs
  //var containerid  = +query.container;
  //var group        = query.group;
  getuseranswers(user,{ container:container, group:null },function(resp) {
      // callback({ret:ret, ulist:ulist});
      //console.log("studresetcontainer:GOT THIS RESULT:",resp);
      if (resp && resp.ret && resp.ret[uid] ) {
          var score = resp.ret[uid].score;
          var tot = resp.ret[uid].tot;
          var percent = (tot > 0) ? score/tot : 0.0;
          var justnow   = new Date();
          var timest = justnow.getTime();
          //console.log("insert into quiz_history (userid,container,score,timest) values ($1,$2,$3,$4) ", [uid,container,percent,timest] );
          client.query("insert into quiz_history (userid,container,score,timest) values ($1,$2,$3,$4) ", [uid,container,percent,timest] );
      }
      client.query( "select param from quiz_useranswer where qid = $1 and userid = $2 ",[ container,uid ],
      after(function(results) {
           var containerq = results.rows[0];    // quiz-container as stored for this user
           if (containerq) {
            // NOTE here we ignore status for container - any deleted containers
            // or containers with status != 0,1 must work here anyway.
            client.query( "select q.* from quiz_question q where q.id =$1",[ container ],
            after(function(master) {
              var masterq = master.rows[0];        // current version of quiz-container
              var moo = parseJSON(masterq.qtext);
              var attemptnum = 0;
              var shuffle = false;
              var coo = parseJSON(containerq.param);  // coo is fetched from useranswer
              var qlist = moo.qlistorder;
              if (qlist && !Array.isArray(qlist)) {
                   qlist = qlist.split(',');
              }
              questlist = qlist.map(function(e) { return {id:e} });
              //console.log("RESET:",questlist,moo.contopt,coo,uid,container);
              delete quiz.containers[container];
              delete quiz.contq[container];
              // delete any symbols generated for this container
              //console.log(sql,params);
              client.query( sql1,params,
                  after(function(results) {
                  client.query( sql2,params,
                      after(function(results) {
                           genNewQlistOrder([],questlist,moo.contopt,coo,uid,container);
                           // executed for sideeffect of storing new qlist order in useranswer
                           // for this container
                           callback(null);
                      }));
                  }));
         }));
        }
      }));
  });
}


exports.resetcontainer = function(user,query,callback) {
  // deletes useranswers for (container)
  // if uid is set then delete only for this user
  // if instance is set then delete only this instance
  var isteach = (user.department == 'Undervisning');
  var container    = +query.container ;
  //var quiz         = +query.quiz ;
  var uid          = +query.uid || 0;
  var instance     = +query.instance || 0;
  var params = [ container ];
  var sql1 = "update quiz_useranswer set cid=null,param='',response='' where (cid =$1 or qid=$1) and response != '' and response !~ '\\[(\\\"\\\",?)+\\]'";
  var sql2 = "delete from quiz_useranswer where (cid =$1 or qid=$1) ";
  //var sql = "delete from quiz_useranswer where cid =$1 ";
  var ii = 2;
  if (uid) {
    sql2 += " and userid=$"+ii;
    sql1 += " and userid=$"+ii;
    params.push(uid);
    ii++;
  }
  if (instance) {
    sql1 += " and instance=$"+ii;
    sql2 += " and instance=$"+ii;
    params.push(instance);
    ii++;
  }
  delete quiz.containers[container];
  delete quiz.contq[container];
  // delete any symbols generated for this container
  client.query( sql1,params,
  after(function(results) {
    client.query( sql2,params,
      after(function(results) {
      callback(null);
    }));
  }));
}

var getqcon = exports.getqcon = function(user,query,callback) {
  // refetches container (the qtext for the container)
  // so that we have the correct sort-order for contained questions
  var container    = +query.container ;
  var usid         = +query.uid || user.id;
  var now = new Date();
  client.query( "select q.* from quiz_question q where q.status != 9 and q.id =$1",[ container ],
  after(function(results) {
          if (results && results.rows) {
            client.query( "select u.* from quiz_useranswer u where u.qid =$1",[ container ],
            after(function(usera) {
               if (usera && usera.rows) {
                 callback(results.rows[0]);
                  // save first-seen time for this user
                  // this will be time of first show for this container
                 client.query( "update quiz_useranswer set firstseen = $1 where qid=$2 and userid=$3 and firstseen = 0",
                             [now.getTime(), container, usid ]);
               } else {
                 console.log("No useranswer - must generate");
                 callback(results.rows[0]);
               }
            }));
          } else {
            callback(null);
          }
  }));
}


exports.exportcontainer = function(user,query,callback) {
  // returns list of questions for a container suitable for export
  var container    = +query.container ;
  client.query( "select q.* from quiz_question q "
          + " inner join question_container qc on (q.id = qc.qid)  "
      + " where and q.status != 9 and qc.cid =$1",[ container ],
  after(function(results) {
          if (results && results.rows) {
            callback(results.rows);
          } else {
            callback(null);
          }
  }));
}

exports.update_subscription = function(user) {
  // on subscriber side (teacher subscribing to a question set):
  //    fetch list of subscribed questions (those with parent != 0
  // on target side: (owner of the question set)
  //    fetch list of questions that are:
  //       original by this teach (parentid == 0)
  //       owned by
  //       selected subject
  //       and not in list of subscribed questions
  // thus two teachers can safely subscribe from each other - duplicates avoided
  // back-copies avoided as any copies have parent != 0
  if (user.config && user.config.subscription) {
      // subscribe is hash [teacher][subject]
      var sub = user.config.subscription;
      for ( var tea in sub) {
          for (var su in sub[tea] ) {
              var sql = "select id from quiz_question where status != 9 and teachid=$1 and parent = 0 and subject=$2 "
                       + " and id not in (select parent from quiz_question where status != 9 and parent != 0 and teachid=$3 and subject = $2) ";
              client.query( sql, [tea,su,user.id],
              after(function(results) {
                    if (results.rows && results.rows.length) {
                       var list = [];
                       for ( var ii in results.rows) {
                          list.push(results.rows[ii].id);
                       }
                       list = list.join(',');
                       copyquest(user,{ givenqlist:list }, function(a) { });
                    }
              }));
          }
      }
  }
}

var updatequiz = exports.updatequiz = function(user,query,callback) {
  // for each question/quiz in container - sync with parent  or children
  var container = +query.container ;
  var teachid   = +user.id;
  var now = new Date();
  client.query( "select * from quiz_question where id = $1",[container],
  after(function(remyc) {
      // we now have the container where we do the sync
      // NO ERROR TEST - this container does surely exist
      var myc = remyc.rows[0];
      client.query( "select q.id,q.parent,q.qtype from quiz_question q "
                   + " inner join question_container c on (q.id=c.qid) where c.cid=$1 and q.status != 9 ",[container],
      after(function(results) {
          var masters = [];       // parent == 0
          var slaves = [];        // has a parent
          if (results.rows && results.rows.length) {
               for ( var ii in results.rows) {
                  var re = results.rows[ii];
                  if (re.parent) {
                        slaves.push(re.id);
                  } else {
                        masters.push(re.id);
                  }
               }
          }
          if (myc.parent) {
            console.log("UPDATEQUIZ:has parent");
            client.query( "select * from quiz_question where id = $1",[myc.parent],
            after(function(pamyc) {
                var pyc = pamyc.rows[0];
                var containedqs = "select c.qid from question_container c where c.cid =$1";
                if (pyc.teachid != teachid) {
                  containedqs = "select id as qid from quiz_question where teachid="+teachid+" and parent in (select qid from question_container where cid=$1)";
                }
                console.log("UPDATEQUIZ:diff parent",pyc,containedqs);
                client.query( containedqs , [pyc.id],
                    after(function(conttq) {
                       var contained = conttq.rows.map(function (e) {
                         return e.qid;
                       });
                       contained = _.difference(contained,slaves);
                       console.log("Missing questions:",contained);
                       if (contained.length > 0 ) {
                           // only copy questions if there are some
                           var nuqids = '(' + contained.join(','+container+'),(') + ',' + container+')';
                           console.log( "insert into question_container (qid,cid) values " + nuqids);
                           client.query( "insert into question_container (qid,cid) values " + nuqids);
                       }
                }));
            }));
          }
          var sql;
          if (masters.length) {
                // update all copies of this master question
                sql = ' update quiz_question set qtext = p.qtext,qtype=p.qtype,name=p.name,points=p.points,qfasit=p.qfasit,status=p.status '
                +  ' from quiz_question p where quiz_question.parent = p.id and p.id in ('+masters.join(",")+')';

          }
          if (slaves.length) {
                // copy from master
                sql = ' update quiz_question set qtext = p.qtext,qtype=p.qtype,name=p.name,points=p.points,qfasit=p.qfasit,status=p.status '
                +  ' from quiz_question p where quiz_question.parent = p.id and quiz_question.id in ('+slaves.join(",")+')';
                // copy over any tags
                client.query( " insert into quiz_qtag select qt.tid,q.id from quiz_question q "
                              + " inner join quiz_qtag qt on (q.parent = qt.qid) "
                              + " where q.id in ("+slaves.join(",")+") "
                              + " and not exists (select * from quiz_qtag where tid=qt.tid and qid=q.id )");
            }
          console.log("MASTERS",masters," Slaves:",slaves,sql);
          if (sql) client.query( sql);
          // update tags
          callback("ok");
      }));
  }));

}

var copyquest = exports.copyquest = function(user,query,callback) {
  // simply duplicate the questions with new teachid , set parent of copy to source question
  var givenqlist   = query.givenqlist ;  // we already have the question-ids as a list
  var dupes = query.dupes;
  var now = new Date();
  client.query( "insert into quiz_question (name,points,qtype,qtext,qfasit,teachid,created,modified,parent,subject,status) "
                + " select  name,points,qtype,qtext,qfasit,"+user.id+",created,"+(now.getTime())+",id,subject,status  "
                + " from quiz_question q where q.status != 9 and q.id in ("+givenqlist+") ",
    after(function(results) {
      client.query( " insert into quiz_qtag select qt.tid,q.id from quiz_question q "
          + " inner join quiz_qtag qt on (q.parent = qt.qid) "
          + " where q.parent != 0 and q.modified = $2 and q.teachid=$1" , [ user.id, now.getTime() ] ,
          after(function(results) {
             callback("ok");
             if (dupes) {
                client.query( " update quiz_question set parent = 0 where id in (select q.id from quiz_question q "
                  + " where q.teachid = $1 and q.modified = $2) ",[user.id,now.getTime() ] );
             } else {
                client.query( " delete from quiz_question where id in (select q.id from quiz_question q "
                  + " inner join quiz_question qdup "
                  + " on (q.parent = qdup.parent and q.teachid = qdup.teachid and q.id > qdup.id) where q.parent != 0 and "
                  + " q.teachid = $1 and q.qtext = qdup.qtext) ",[user.id] );
             }
          }));
  }));
}

var scoresummary = exports.scoresummary = function(user,query,callback) {
  client.query( "select qu.cid,sum(qu.score) as suu, sum(q.points) as poo, sum(case attemptnum when 0 then 0 else 1 end) as att, count(qu.id) as ant  "
               + "from quiz_useranswer qu inner join quiz_question q on (q.id=qu.qid) "
               + "where userid=$1 and cid>0 group by qu.cid",[user.id],
          after(function(results) {
             callback(results.rows);
          }));
}

var getcontainer = exports.getcontainer = function(user,query,callback) {
  // returns list of questions for a container or set of question-ids
  var container    = +query.container ;   // used if we pick questions from a container
  var givenqlist   = query.givenqlist ;  // we already have the question-ids as a list
  if (container && quiz.contq[container]) {
     // we have the list of questions
     callback(quiz.contq[container]);
     //console.log("USING CONTAINER CACHE",container,quiz.contq[container]);
     return;
  }
  var isteach = (user.department == 'Undervisning');
  var sql,param;
  //console.log("WORKBOOK:getcontainer:",query);
  if (givenqlist && givenqlist != '') {
    // process the specified questions
    if (isteach) {
      sql = "select q.*,qp.teachid as pid, case when q.parent != 0 and q.qtext != qp.qtext then "
          + " case when qp.modified > q.modified then 3 else 2 end "        // sync diff
          + " else case when q.parent != 0 then 1 else 0 end  "
          + " end as sync "
          + "from quiz_question q  left join quiz_question qp on (q.parent = qp.id) where q.status != 9 and q.id in ("+givenqlist+") ";
      // sync will be 2 if parent,child differ - 1 if differ but parent older (child has recent change)
      // the teacher may decide to edit, then its nice to have diff from parent-question if its a copy
    } else {
      sql = "select q.*,0 as pid, 0 as sync from quiz_question q where q.id in ("+givenqlist+") ";
    }
    param = [];
    //console.log("HERE 1",sql);
  } else {
    // pick questions from container
    sql = (isteach) ? ( " select q.*,qp.teachid as pid, case when q.parent != 0 and q.qtext != qp.qtext then "
        + " case when qp.modified > q.modified then 3 else 2 end "        // sync diff
        + " else case when q.parent != 0 then 1 else 0 end  "
        + "end as sync "
        + "from quiz_question q  left join quiz_question qp on (q.parent = qp.id) where q.id in (  "
        + " select q.id from quiz_question q inner join question_container qc on (q.id = qc.qid) where q.status != 9 and qc.cid = $1 ) " )
          :
          "select q.*,0 as pid,0 as sync from quiz_question q inner join question_container qc on (q.id = qc.qid) where q.status < 2 and qc.cid =$1";
    param = [ container ];
    //console.log("HERE 2");
  }
  //console.log("WORKBOOK:getcontainer:",sql,param);
  client.query( sql, param,
    after(function(results) {
      //console.log("GETCONTAINER came here ");
          if (results && results.rows) {
            var qlist = [];
            var qidlist = [];
            for (var i=0,l=results.rows.length; i<l; i++) {
              var qu = results.rows[i];
              quiz.question[qu.id] = qu;           // Cache
              qidlist.push(qu.id);                 // used to fetch tags
              qlist.push(quiz.display(qu,false));
            }
            if (container) quiz.contq[container] = { qlist:qlist, taglist:{} };
            if (isteach && qidlist.length) {
              qidlist = qidlist.join(',');
              client.query( "select distinct q.id,t.tagname from quiz_question q inner join quiz_qtag qt on (q.id = qt.qid) "
                          + " inner join quiz_tag t on (t.id=qt.tid) where q.id in ( " + qidlist + " ) ",
              after(function(taglist) {
                //console.log(taglist.rows);
                var taggart = {};
                if (taglist && taglist.rows) for (var i=0,l=taglist.rows.length; i<l; i++) {
                    var tag = taglist.rows[i];
                    if (!taggart[tag.id]) taggart[tag.id] = [];
                    taggart[tag.id].push(tag.tagname);
                }
                if (container) quiz.contq[container] = { qlist:qlist, taglist:taggart};
                callback({ qlist:qlist, taglist:taggart});
              }));
            } else {
              callback({ qlist:qlist, taglist:{} });
            }
          } else {
            callback(null);
          }
  }));
}


exports.crosstable = function(user,query,callback) {
  var containerid  = +query.container;
  var isteach = (user.department == 'Undervisning' );
  if (isteach) {
    // get all useranswers to all questions in this quiz
          client.query(  "select q.points,q.qtype,q.name,qua.* from quiz_useranswer qua inner join quiz_question q on (q.id = qua.qid) "
                 + " where qua.cid = $1 and qua.attemptnum > 0 order by id desc", [ containerid ],
          after(function(uas) {
              var rlist = [];
              for (var i=0; i<uas.rows.length; i++) {
                var uu = uas.rows[i];
                uu.param = parseJSON(uu.param);
                uu.param.display = unescape(uu.param.display);
                for (var oi in uu.param.options) {
                   uu.param.options[oi] = unescape(uu.param.options[oi]);
                }
                if (uu.qtype == 'multiple' ) {
                  //console.log("reordering ",ua.param.fasit);
                  uu.param.fasit = quiz.reorder(uu.param.fasit,uu.param.optorder);
                }
                uu.response = parseJSON(uu.response);
                rlist.push(uu);
              }
              callback(rlist);
          }));
  } else {
      callback(null);
  }
}

var getuseranswers = exports.getuseranswers = function(user,query,callback) {
  // get useranswers for a container
  // all questions assumed to be in quiz.question cache
  var containerid  = +query.container;
  var group        = query.group;
  var contopt      = query.contopt;  // options set for this container
  var ulist = {};     // list of students for this test
  var hist = {};
  var aid = 100000;
  var alias = {};  // map userid to alias
  //console.log( "select * from quiz_question where id = $1",[ containerid ]);
  //console.log("CONTOPT=",contopt);
  client.query( "select * from quiz_question where id = $1",[ containerid ],
  after(function(results) {
   client.query( "select * from quiz_history where score > 0 and container = $1",[ containerid ],
   after(function(history) {
    // build history for each student
    var i,l;
    for (i=0, l = history.rows.length; i<l; i++) {
       var res = history.rows[i];
       if (!hist[res.userid])  hist[res.userid] = [];
       hist[res.userid].push(res.score);
    }
    container = results.rows[0];
    var masterq = parseJSON(container.qtext);  // this is the ruling qlist
    var shuffle = false;
    if (masterq.contopt && (masterq.contopt.randlist || masterq.contopt.shuffle)) {
          shuffle = true;
    }
    if (contopt == undefined && masterq.contopt ) {
        // if no container options sent, then use as defined in CURRENT question def
        contopt = masterq.contopt;
    }
    // we use this if quiz is NOT SHUFFLED
    var isteach = (user.department == 'Undervisning' && container.teachid == user.id );
    if (db.memlist[group]) {
      for (var i=0, l = db.memlist[group].length; i<l; i++) {
        var enr = db.memlist[group][i];
        if (!isteach && enr != user.id) {
          alias[enr] = aid++
          ulist[alias[enr]] = 1;
        } else {
          ulist[enr] =  1;
        }
      }
    }
    //console.log( "select id,qid,param,userid,score,time,firstseen from quiz_useranswer where qid=$1  ",[ containerid ]);
    client.query( "select id,qid,param,userid,score,time,firstseen from quiz_useranswer where qid=$1  ",[ containerid ],
    after(function(results) {
        if (results && results.rows) {
          //console.log( "select id,qid,instance,userid,score,time from quiz_useranswer where cid=$1  ",[ containerid ]);
          client.query( "select id,qid,instance,userid,score,time from quiz_useranswer where cid=$1  ",[ containerid ],
          after(function(uas) {
              var i,l;
              var ret = {};
              var usas = {};
              var qusas = {};
              var userinstance = {};   // lookup by instance
              for (i=0, l = uas.rows.length; i<l; i++) {
                var u = uas.rows[i];
                if (!usas[u.userid]) usas[u.userid] = {};
                if (!userinstance[u.userid]) userinstance[u.userid] = {};
                if (!qusas[u.userid]) qusas[u.userid] = {};
                if (!usas[u.userid][u.qid]) usas[u.userid][u.qid] = [];
                usas[u.userid][u.qid][u.instance] = u;
                qusas[u.userid][u.qid] = u;
                userinstance[u.userid][u.instance] = u;  // needed for RANDOM question type
              }
              for (i=0, l = results.rows.length; i<l; i++) {
                var res = results.rows[i];
                var coo = parseJSON(res.param);
                // need to remember userid <--> anonym
                var qlist = coo.qlistorder;
                if (!shuffle) {
                    qlist = masterq.qlistorder;
                }
                if (typeof(qlist) == "string") {
                  qlist = qlist.split(',');
                }
                var sscore = getscore(res,qlist,usas,qusas,userinstance);
                if (!isteach && res.userid != user.id) {
                  res.userid = alias[res.userid];
                }
                ulist[res.userid] = 2;            // mark as started
                sscore.start = res.firstseen;
                sscore.hist = '';
                if (hist[res.userid]) {
                  sscore.hist = hist[res.userid].join(',');
                }
                ret[res.userid] = (isteach || (contopt && contopt.rank == 1) || user.id == res.userid) ? sscore : 0;
              }
              //console.log("Ret ",ret," Users ",ulist);
              callback({ret:ret, ulist:ulist});
          }));
        } else {
          callback( null);
        }
     }));
   }));
  }));

  function getscore(res,qlist,usas,qusas,userinstance) {
    // qlist is the set of questions given to this user
    // usas contains useranswers index by userid,qid,instance
    var tot = 0;
    var score = 0;
    var fresh = 0;
    if (qlist && qlist.length ) for (var i=0; i<qlist.length; i++) {
      var qid = qlist[i];
      if (usas[res.userid] && usas[res.userid][qid]) {
        var uu;
        if (usas[res.userid][qid][i] != undefined) {
          uu = usas[res.userid][qid][i];
        } else {
          uu = qusas[res.userid][qid];
          //console.log("Useranswer at different instance id",i," ::  ",(usas[res.userid][qid]).map( function(a) { return a.instance; }) );
        }
        score += +uu.score;
        if (quiz.question[qid]) tot += quiz.question[qid].points;
        if (uu.time > fresh) fresh = uu.time;
      } else {
          if (quiz.question[qid]) {
              if (quiz.question[qid].qtype=='random' && userinstance[res.userid][i]) {
                 uu = userinstance[res.userid][i];
                score += +uu.score;
                if (quiz.question[qid]) tot += quiz.question[qid].points;
                if (uu.time > fresh) fresh = uu.time;
              }
          }
      }
    }
    return { score:score, tot:tot, fresh:fresh} ;

  }

}


var getworkbook = exports.getworkbook = function(user,query,callback) {
  // returns quiz for given course
  // if non exists - then one is created
  var courseid    = +query.courseid ;
  var coursename  = query.coursename ;
  var now = new Date();
  if (isNaN(courseid)) {
    console.log("This course may have no studs")
    callback('');
    return;
  }
  client.query( "select ques.*, q.id as quizid from quiz q inner join quiz_question ques on (ques.id = q.cid) where q.courseid=$1 and q.name=$2 ",[ courseid, coursename ],
  after(function(results) {
          if (results && results.rows && results.rows[0]) {
            callback(results.rows[0]);
          } else {
            if (user.department == 'Undervisning') {
              //console.log( "insert into quiz_question (qtype,teachid,created,modified) values ('container',$1,$2,$2) returning id ",[user.id, now.getTime() ]);
              client.query( "insert into quiz_question (qtype,teachid,created,modified) values ('container',$1,$2,$2) returning id ",[user.id, now.getTime() ],
              after(function(results) {
                  if (results && results.rows) {
                      var qid = results.rows[0].id;
                      client.query( "update quiz set cid=$1 where name=$2 and courseid=$3 returning id ",[ qid, coursename, courseid ],
                      after(function(results) {
                  //console.log( "insert into quiz (name,courseid,teachid,cid) values ($2,$1,$3,$4) returning id ",[ courseid, coursename, user.id, qid ]);
               if (results && results.rows && results.rows[0]) {
                getworkbook(user,query,callback);
               } else {
                  client.query( "insert into quiz (name,courseid,teachid,cid) values ($2,$1,$3,$4) returning id ",[ courseid, coursename, user.id, qid ],
                  after(function(results) {
                getworkbook(user,query,callback);
                              }));
               }
                      }));
                  }

              }));
            } else {
              callback('');
            }
          }
  }));
}


exports.insertimport = function(user,qlist,callback) {
  //var container = +query.container ;  // id of existing container (a question)
  var teachid   = +user.id;
  var now = new Date();
  var vv = [];
  for (var i=0; i< qlist.length; i++) {
    var qq = qlist[i];
    qq.qtext = qq.qtext.replace(/\\/g,'\\\\');
    vv.push("(" + user.id + ","+now.getTime() +","+now.getTime() + ",'" + qq.qtype + "','"+qq.qtext+"','"+qq.name+"',"+qq.points+")" );
  }
  console.log( "insert into quiz_question (teachid,created,modified,qtype,qtext,name,points) "
                + " values " + vv.join(',') );
  client.query( "insert into quiz_question (teachid,created,modified,qtype,qtext,name,points) "
                + " values " + vv.join(',') );
}

exports.editqncontainer = function(user,query,callback) {
  // insert/update/delete a question_container
  var action    = query.action ;
  var container = +query.container ;  // id of existing container (a question)
  var qid       = +query.qid ;        // used if binding existing question
  var name      = query.name  || '';
  var subject   = query.subject  || '';
  var qtype     = query.qtype || 'multiple';
  var qtext     = query.qtext || '{}';
  var teachid   = +user.id;
  var nuqs      = query.nuqs || '';
  var points    = +query.points || 1;
  var now = new Date();
  delete quiz.containers[container];
  delete quiz.contq[container];
  // empty the container cache
  switch(action) {
      case 'test':
        console.log(qid,name,qtype,qtext,teachid,points);
        break;
      case 'create':
        // we create a new empty question and bind it to the container
        client.query( "insert into quiz_question (teachid,created,modified,qtype,qtext,name,points,subject) "
                + " values ($1,$2,$2,$3,$4,$5,$6,$7) returning id ",
                [user.id, now.getTime(),qtype,qtext,name,points,subject ],
        after(function(results) {
            var newqid = results.rows[0].id;
            client.query( "insert into question_container (cid,qid) values ($1,$2) returning id ",
                    [container,newqid ],
                after(function(results) {
                  callback( {ok:true, msg:"updated" } );
                }));
            }));
        break;
      case 'insert':
        // we bind existing questions to the container
        if (nuqs) {
          client.query( "select q.id,q.parent,c.qid from quiz_question q left outer join question_container c on (q.id = c.qid) "
                       + " where q.qtype='quiz' and q.id in ("+nuqs+" ) and q.teachid=$1", [teachid],
              after(function(existing) {
                  console.log("Existing quiz",existing.rows);
                  // existing is list of quiz ids already used
                  // WE ONLY DO ONE QUIZ any others just dropped
                  // so instead of just inserting this quiz  we duplicate it and insert the dups
                  // ANY other questions are just dropped
                  if (existing && existing.rows && existing.rows.length && (existing.rows[0].parent || existing.rows[0].qid)) {
                      console.log("Already quiz ",existing.rows);
                      var dupcon = existing.rows[0].id;
                      var containedqs = "select c.qid from question_container c where c.cid =$1";
                      // default sql to use if copying my own container
                      if (existing.rows[0].parent) {
                          dupcon = existing.rows[0].parent;
                          console.log("Duplicating a copy of a quiz - might be OTHER TEACHERS QUIZ:",dupcon);
                          // we need to find the local copies of original questions contained in this quiz
                          // this gives us a new list of qids to insert
                          var source  = "select case when parent = 0 then id else parent end as iid from quiz_question "
                              + "where id in (select qid from question_container where cid="+dupcon+" )";
                          containedqs = "select id as qid from quiz_question where teachid="+teachid+" and (parent in ( "+source+") or id in ("+source+") ) ";
                          // if we are missing questions (might not subscribe to source teacher) then we get a reduced copy
                          // only questions that are already existing will be used
                      }
                      // this quiz is a copy of other teachers quiz
                      console.log("Duplicating",dupcon);
                      client.query( "insert into quiz_question (name,points,qtype,qtext,qfasit,teachid,created,modified,parent,subject) "
                                    + " select  name,points,qtype,qtext,qfasit,"+teachid+",created,"+(now.getTime())+",id,subject  "
                                    + " from quiz_question q where q.status != 9 and q.id = "+dupcon+" returning id ",
                        after(function(results) {
                          var nucon = results.rows[0].id;
                          console.log("came here 1",containedqs);
                          // duplicate link to contained questions
                          //   this doesnt duplicate contained questions
                          //   but inserts record in question_container that
                          //   shows this question used in this quiz
                          client.query( containedqs ,
                            after(function(conttq) {
                               var contained = conttq.rows.map(function (e) {
                                 return e.qid;
                              });
                              console.log("came here 2",contained);
                              if (contained.length > 0 ) {
                                   // only copy questions if there are some
                                   var nuqids = '(' + contained.join(','+nucon+'),(') + ',' + nucon+')';
                                   console.log("came here 3",nuqids);
                                   console.log( "insert into question_container (qid,cid) values " + nuqids);
                                   client.query( "insert into question_container (qid,cid) values " + nuqids);
                              }
                              // duplicate the tags
                              client.query( " insert into quiz_qtag select qt.tid,q.id from quiz_question q "
                                  + " inner join quiz_qtag qt on (q.parent = qt.qid) "
                                  + " where q.parent != 0 and q.modified = $2 and q.teachid=$1" , [ teachid, now.getTime() ] );
                               console.log("came here 4");
                               var thedupes = results.rows.map(function (e) {
                                 return e.id;
                               });
                               var nuqids = '(' + thedupes.join(','+container+'),(') + ',' + container+')';
                               client.query( "insert into question_container (qid,cid) values " + nuqids,
                                   after(function(results) {
                                     console.log("came here 5");
                                     callback( {ok:true, msg:"updated" } );
                                   }));
                                }));
                    }));
                  } else {
                   var nuqids = '(' + nuqs.split(',').join(','+container+'),(') + ',' + container+')';
                   client.query( "insert into question_container (qid,cid) values " + nuqids,
                       after(function(results) {
                         callback( {ok:true, msg:"updated" } );
                       }));
                  }
              }));
        } else {
          callback( {ok:true, msg:"emptylist" } );
        }
        break;
      case 'delete':
        // we can only delete it if no more instances exist
        // we assume this is tested for
        // drop a question from the container
        //console.log( "delete from question_container where cid=$1 and qid=$2 ", [container,qid]);
        if (nuqs) {
          // delete a list of questions
          client.query( "delete from question_container where cid=$1 and qid in ("+nuqs+") ", [container],
          after(function(results) {
             client.query("delete from quiz_useranswer  where cid=$1 and qid in ("+nuqs+") ", [container],
             after(function(results) {
                 callback( {ok:true, msg:"dropped" } );
             }));
          }));
        } else
          client.query( "delete from question_container where cid=$1 and qid=$2 ", [container,qid],
          after(function(results) {
             client.query("delete from quiz_useranswer where cid =$1 and qid=$2",[container,qid],
             after(function(results) {
                 callback( {ok:true, msg:"dropped" } );
             }));
          }));
        break;
      default:
        callback(null);
        break;
  }
}

// skipwords used to cross-index all questions
// these should be moved into a language file

skipwords = {};
shortlist = ' akkurat aldri alene all alle allerede alltid alt alts_a andre annen annet _ar _arene at av b_ade bak bare'
  + ' skriv finn klikk f_olgende svar bruk husk deretter begynne gj_or bedre begge begynte beste betyr blant ble blev bli blir blitt b_or bort borte '
  + ' bra bruke burde byen da dag dagen dager'
  + ' d_arlig de navnet navn deg del dem den denne der dere deres derfor dermed dersom dessuten det dette din disse d_oren du eg egen egentlig'
  + ' eget egne ei hvilke inneholder kalles skjer p_astandene brukes ulike merk hvilken oppgave foreg_ar plasser h_orer ovenfor ein eit eksempel '
  + ' eller ellers en enda ene eneste enkelte enn enn_a er et ett etter f_a fall fant far f_ar faren fast f_att'
  + ' fem fikk finne finner finnes fire fjor flere fleste f_olge folk f_olte for f_or foran fordi forhold f_orst f_orste forteller fortsatt fra'
  + ' fr_a fram frem fremdeles full funnet ga g_a gamle gammel gang gangen ganger ganske g_ar g_att gi gikk gir gitt gjelder kryss p_astander passer gjennom gjerne gj_or gjorde'
  + ' gj_ore gjort glad god gode godt grunn gud ha hadde ham han hans har hatt hele heller helst helt henne hennes her hjelp hjem hjemme'
  + ' ho holde holder holdt h_ore h_orte hos hun hus huset hva hvem hver hverandre hvert hvis hvor hvordan hvorfor igjen ikke ikkje imidlertid'
  + ' imot ingen ingenting inn inne ja jeg jo kampen kan kanskje kjenner kjent kjente klar forskjellige f_ore f_orer virker fyll best enkelt klart kom komme kommer kommet kort '
  + ' kunne kveld la l_a laget lagt lang lange langt legge legger lenge lenger lett ligger like likevel lille lite liten litt liv'
  + ' livet l_opet l_ordag lot m_a m_al man mange mann mannen m_ate m_aten m_atte med meg meget mellom men mener menn menneske mennesker mens mente mer'
  + ' mest mig min mindre mine minst mitt mor moren mot m_ote mulig mye n n_a n_ermere n_ar ned nei neste nesten nettopp noe noen nok norge norges'
  + ' norsk norske nu ny nye nytt ofte og ogs_a om omkring _onsker op opp oppe ord oss over overfor p_a par per plass plutselig '
  + ' redd reiste rekke rett riktig rundt sa s_a s_erlig sagt saken samme sammen samtidig satt satte se seg seier seks selv senere ser'
  + ' sett sette si side siden sier sig sikkert sin sine siste sitt sitter skal skulde skulle slags slik slike slikt slo slutt sm_a snakke snakket'
  + ' snart som spurte st_a stadig st_ar sted stedet sterkt stille sto stod stor store st_orre st_orste stort stund sv_ert svarte synes syntes ta'
  + ' tar tatt tenke tenker tenkt tenkte ti tid tiden tidende tidligere til tilbake tillegg ting to tok tre trenger tro trodde tror under unge ut'
  + ' ute uten utenfor v_ere v_ert vanskelig vant var v_ar v_are v_art ved vei veien vel ventet verden vet vi videre viktig vil vilde ville virkelig'
  + ' code pycode hints contopt hidden start stop randlist xcount rcount shuffle locked fasit skala medium karak rank antall komme hints hintcost navi'
  + ' trinn omstart adaptiv attemptcost qlistorder'
  + ' vise viser visst visste viste vite';
  shortlist.replace(/(\w+)\s/g,function(m,wo) {
         skipwords[wo] = 1;
         return '';
      });

// generate and return a cross index for all questions for a given teacher
// this has reasonable performance for ~ 1000 questions with some lines of text each (~ < 30 words)
// can seem slow on client as data-size is large (takes some time to send)
// WILL be slow on server if n >> 10000

exports.makeWordIndex = function(user,query,callback) {
  var teacher = +query.teacher;
  var other = +query.other || 0;   // other teacher - fetch subscribed questions for this teach
  var showsubj = query.showsubj;   // select only from this subject - to avoid too big dataload
  var wordlist = {  a:{}, b:{}, c:{}, d:{}, e:{}, f:{}, g:{},h:{}, i:{}, j:{}, k:{}, l:{}, m:{}, n:{}, o:{}, p:{}, q:{}, r:{}, s:{}, t:{}, u:{}, v:{},w:{}, x:{}, y:{}, z:{}, A:{} };
  var wlist = [];      // wordlist as sorted array
  var relations = {};  // questions sharing words
  var teachlist;       // list of teachers with questions
  var close = [];      // questions sharing "many" words | many > 7
  var teachid = (teacher) ? teacher : user.id;
  var subjects = [];   // distinct subjects
  var questions = {};
  var containers = {};
  // modified questions
  //console.log("We have these subjects:",db.subscribe.teachers[teachid]);
  if (!showsubj) {
      if (db.subscribe && db.subscribe.teachers && db.subscribe.teachers[teachid]) {
        showsubj = db.subscribe.teachers[teachid][0];
      } else {
        showsubj = '';
      }
  }
  subjects = db.subscribe.teachers[teachid] || [];
  console.log("Subject with the most:",showsubj);
  client.query("select q.id from quiz_question q  left join quiz_question qp "
               + " on (q.parent = qp.id) where q.status != 9 and q.parent != 0 "
               + " and q.modified < qp.modified and q.qtext != qp.qtext and q.teachid=$1",[teachid],
    after(function(unsynced) {
    client.query("select * from question_container",
      after(function(cont) {
        client.query("select distinct teachid from quiz_question where qtype in ('dragdrop','multiple','fillin','numeric') ",
         after(function(res) {
          teachlist = res.rows;
          client.query("select q.id,t.tagname from quiz_question q inner join quiz_qtag qt on (qt.qid=q.id) "
                 + " inner join quiz_tag t on (t.id = qt.tid) "
                 + " where t.tagname not in ('multiple','dragdrop','fillin','sequence','numeric','textarea') "
                 + " and q.status != 9 and q.teachid=$1 order by q.id",[ teachid],
            after(function(tags) {
              console.log("Got all tags");
              var mytags = {}; // question -> tags
              var qtags = {};   // tag -> questions
              for (var tt in tags.rows) {
                 var tag = tags.rows[tt];
                 if (!mytags[tag.id]) mytags[tag.id] = [];
                 mytags[tag.id].push(tag.tagname);
                 if (!qtags[tag.tagname]) qtags[tag.tagname] = {};
                 qtags[tag.tagname][tag.id] = 1;
              }
              console.log('select q.*, qp.teachid as origin from quiz_question q '
                           + 'left outer join quiz_question qp on  (q.parent = qp.id)'
                           + ' where q.status != 9 and q.teachid=$1 and q.subject=$3 and (qp.teachid=$2 or q.parent=0)', [teachid,other,showsubj] );
              client.query('select q.*, qp.teachid as origin from quiz_question q '
                           + 'left outer join quiz_question qp on  (q.parent = qp.id)'
                           + ' where q.status != 9 and q.teachid=$1 and q.subject=$3 and (qp.teachid=$2 or q.parent=0)', [teachid,other,showsubj] ,
                 after(function(results) {
                    console.log("Got all questions");
                    if (results && results.rows) {
                      for (var i=0, l= results.rows.length; i<l; i++) {
                        var qu = results.rows[i];
                        //if ( qu.subject) {
                        //  if (!subjects[qu.subject]) subjects[qu.subject] = 0;
                        //  subjects[qu.subject] += 1;
                        //}
                        var wcount = 0;  // count of words in this question
                        var qtag = (mytags[qu.id]) ? mytags[qu.id].join(' ') : '';
                        var str = qu.qtext + ' '+qtag;
                        str = str.replace(/\\n/g,' ');
                        str = str.replace(/\\r/g,' ');
                        str = str.replace(/&aring;/g,'_a');
                        str = str.replace(/&oslash;/g,'_o');
                        str = str.replace(/&aelig;/g,'_e');
                        str = str.replace(/Å/g,'_a');
                        str = str.replace(/Ø/g,'_o');
                        str = str.replace(/Æ/g,'_e');
                        str = str.replace(/å/g,'_a');
                        str = str.replace(/ø/g,'_o');
                        str = str.replace(/æ/g,'_e');
                        str.replace(/([A-Z_a-z]+)[-+.<>{},;\[\]:() *\f\n\r\t\v\u00A0\u2028\u2029]/g,function(m,wo) {
                            if (wo.length < 3) return '';
                            wo = wo.toLowerCase();
                            if (skipwords[wo]) {
                              return '';
                            }
                            wo = wo.replace(/_a/g,'å').replace(/_o/g,'ø').replace(/_e/g,'æ');
                            if (wo.length < 3) return '';
                            if (wo.indexOf('_') > -1) return '';
                            wcount++;
                            var w0 = wo.substr(0,1);
                            if (!wordlist[w0]) w0 = 'A';
                            if (wordlist[w0][wo]) {
                              wordlist[w0][wo].count ++;
                              if (!wordlist[w0][wo].qids[qu.id]) {
                                wordlist[w0][wo].qcount ++;
                                wordlist[w0][wo].qids[qu.id] = 1;
                              }
                            } else {
                              wordlist[w0][wo] = { count:1, qcount:1, qids:{} };
                              wordlist[w0][wo].qids[qu.id] = 1;
                            }
                            return '';
                          });
                        qu.wcount = wcount;
                        questions[qu.id] = qu;

                      }
                    }
                    console.log("Got all words");
                    for (var w0 in wordlist) {
                     var ww = wordlist[w0];
                     for (var wo in ww) {
                      var w = ww[wo];
                      if (w.count > 1 && w.qcount > 1 ) {
                        //console.log(wo,w);
                         for (q in w.qids) {
                           if (!relations[q]) {
                             relations[q] = {};
                           }
                           for (qq in w.qids) {
                             if (qq == q) continue;
                             if (!relations[q][qq]) {
                               relations[q][qq] = 0;
                             }
                             relations[q][qq]++;
                           }
                         }
                      }
                     }
                    }
                    /*
                    var alfab = 'abcdefghijklmnopqrstuvwxyzA'.split('');
                    for (var w0 in alfab) {
                     var w1 = alfab[w0];
                     var ww = wordlist[w1];
                     var wwlist = [];
                     for (var wo in ww) {
                         var w = ww[wo];
                         w.w = wo;
                         wwlist.push(w);
                     }
                     wwlist.sort(function(a,b) {  var r = a.w.substr(0,3).localeCompare(b.w.substr(0,3)); return r ? r : +b.qcount - +a.qcount;  }  )
                     wlist = wlist.concat(wwlist);
                    }
                    */
                    console.log("Sorted wordlist "+wlist.length+" words.");
                    var already = {};  // only keep one side of a dual relation
                    for (q in relations) {
                      var rr = relations[q];
                      for (r in rr) {
                        if (rr[r] > 2) {
                          var a = Math.max(q,r);
                          var b = Math.min(q,r);
                          if (already[a+'_'+b]) continue;
                          already[a+'_'+b] = 1;
                          close.push( [ rr[r],q,r ] );
                        } else {
                          delete relations[q][r]; // remove one word relationships
                        }

                      }
                    }
                    // now build list of containers for this teach
                    console.log("removed single relations");
                    for (var cc in cont.rows) {
                       var con = cont.rows[cc];
                       if (!questions[con.cid]) continue;  // ignore containers for other teach
                       if (!questions[con.qid]) continue;  // ignore questions for other teach
                       if (!questions[con.cid].name) continue;  // ignore containers without name
                       if (!containers[con.cid]) containers[con.cid] = {};
                       containers[con.cid][con.qid] = 1;
                    }
                    console.log("questions that differ from parent");
                    unsyncedlist= [];
                    for (var mdi in unsynced.rows) {
                       var md = unsynced.rows[mdi];
                       unsyncedlist.push(md.id);
                    }
                    callback({teachlist:teachlist, wordlist:wordlist, relations:close, questions:questions, unsynced:unsyncedlist,
                               qtags:qtags, tags:mytags, orbits:relations, subjects:subjects, containers:containers });

         }));
       }));
     }));
   }));
  }));
}
