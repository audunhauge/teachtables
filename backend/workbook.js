
/*
 *  Database io for workbook/quiz
 */

// get hold of database
var client = siteinf.client;
var quiz = require('./quiz').qz;
var parseJSON = require('./quiz').parseJSON;
var julian = require('./julian');
var async = require('async');
var after = require('./utils').after;
var db = siteinf.database.db;



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
  var qtype   = query.qtype || '';
  var qtext   = JSON.stringify(query.qtext) || '';
  var teachid = +user.id;
  var points  = query.points || '';
  var now = new Date();
  quiz.containers = {};
  quiz.contq = {};
  delete quiz.question[qid];  // remove it from cache
  //console.log(qid,name,qtype,qtext,teachid,points);
  switch(action) {
      case 'delete':
        if (!qidlist) qidlist = qid;
        // set status to 9 - indicates deleted
        client.query( 'update quiz_question set status=9 where id in ('+qidlist+') and teachid=$1', [teachid],
            after(function(results) {
                callback( {ok:true, msg:"updated"} );
            }));
        break;
      case 'update':
    	  var sql =  'update quiz_question set modified=$3, qtext=$4 ';
    	  var params = [qid,teachid,now.getTime(),qtext];
    	  var idd = 5;
    	  if (query.qtype) {
    		  sql += ',qtype=$'+idd;
    		  params.push(qtype);
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
    	  }
    	  sql += ' where id=$1 and teachid=$2';
    	  //console.log(sql,params);
    	  client.query( sql, params,
    			  after(function(results) {
    				  delete quiz.question[qid];  // remove it from cache
    				  callback( {ok:true, msg:"updated"} );
                      // TODO here we may need to regen useranswer for container
    			  }));
    	  break;
      default:
        callback(null);
        break;
  }
}

exports.updatecontainerscore = function(user,query,callback) {
  var cid    = +query.cid ;   // the question (container) containing the questions
  var sum    = +query.sum ;   // total score for this container
  var uid    = +user.id;
  client.query( "update quiz_useranswer set score = $1 where userid=$2 and qid=$3", [sum,uid,cid]);
}

exports.addcomment = function(user,query,callback) {
  var uaid    = +query.uaid,   // id of useranswer to add comment to
      uid     = +query.uid,    // the user 
      qid     = +query.qid,    // question id
      iid     = +query.iid,    // instance id
      uid     = +query.uid,    // the user 
      comment = query.comment;  // the comment
  if (uid == user.id) {
    // stud-comment
    client.query( "update quiz_useranswer set usercomment = $1 where id=$2",[comment,uaid]);
  } else if (user.department == 'Undervisning') {
    // teach comment
    client.query( "update quiz_useranswer set teachcomment = $1 where id=$2",[comment,uaid]);
  }
  callback(123);
}

exports.editscore = function(user,query,callback) {
  var qid    = +query.qid,
      iid    = +query.iid,    // instance id (we may have more than one instance of a question in a container, generated questions)
      cid    = +query.cid,    // the question (container) containing the question
      uid    = +query.uid,    // the user 
      nuval  = +query.nuval,  // the new score
      qua    = query.qua,
      uaid   = +qua.id,
      oldval = +qua.score,    // prev score
      diff   =  nuval-oldval;
  console.log("REGRADE",qid,iid,cid,uid,qua,nuval,oldval,diff,qua.id);
  client.query( "update quiz_useranswer set score = "+nuval+" where id="+uaid);
  console.log( "update quiz_useranswer set score = $1 where id=$3", [nuval,uaid]);
  client.query( "update quiz_useranswer set score = score + "+diff+" where userid="+uid+" and qid="+cid);
  console.log( "update quiz_useranswer set score = score + $1 where userid=$2 and qid=$3", [diff,uid,cid]);
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
                    quiz.grade(contopt,myquiz,myquest,ua,param,qua.attemptnum,qua.hintcount,user,iid,function(nugrade,feedback,completed) {
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
                      if (completed.lock) {
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
                      callback({score:0, att:0 } );
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
              client.query( 'delete from quiz_tag qtt where qtt.teachid=$1 and qtt.id not in '
                + ' (select t.id from quiz_tag t inner join quiz_qtag qt on (t.id = qt.tid) ) ', [teachid],
                  after(function(results) {
                    callback( {ok:true, msg:"removed"} );
                  }));
            }));
          return;
        }
        break;
      case 'untag':
        console.log("delete from quiz_qtag qt using quiz_tag t where t.tagname=$2 and t.id = qt.tid and qt.qid in ("+qidlist+") ",teachid,tagname);
        if (qidlist) {
          client.query("delete from quiz_qtag qt using quiz_tag t where t.tagname=$1 and t.id = qt.tid and qt.qid in ("+qidlist+") "
            , [tagname],
            after(function(results) {
              client.query( 'delete from quiz_tag qtt where qtt.teachid=$1 and qtt.id not in '
                + ' (select t.id from quiz_tag t inner join quiz_qtag qt on (t.id = qt.tid) ) ', [teachid],
                  after(function(results) {
                    callback( {ok:true, msg:"removed"} );
                  }));
            }));
        } else {
          client.query('delete from quiz_qtag qt using quiz_tag t where t.tagname=$2 and t.id = qt.tid and qt.qid=$1 ', [qid,tagname],
            after(function(results) {
              client.query( 'delete from quiz_tag qtt where qtt.teachid=$1 and qtt.id not in '
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
              var tagg = results.rows[0];
              client.query( "insert into quiz_qtag (qid,tid) values ($1,$2) ",[qid,tagg.id],
              after(function(results) {
                  callback( {ok:true, msg:"tagged"} );
              }));
            } else {
              // create new tag
              client.query( "insert into quiz_tag (teachid,tagname) values ($1,$2) returning id ",[user.id, tagname ],
              after(function(results) {
                if (results && results.rows && results.rows[0] ) {
                  var tagg = results.rows[0];
                  client.query( "insert into quiz_qtag (qid,tid) values ($1,$2) ",[qid,tagg.id],
                  after(function(results) {
                    if (results && results.rows && results.rows[0] ) {
                      callback( {ok:true, msg:"tagged"} );
                    }
                  }));
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
  var subject = query.subject;
  var tags = {};
  client.query( "select distinct q.teachid,t.tagname from quiz_tag t inner join quiz_qtag qt on (qt.tid=t.id) inner join quiz_question q on (q.id = qt.qid) "
      + " where q.teachid = $1 and q.subject=$2 and q.status != 9 order by t.tagname ", [uid,subject],
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

exports.tags_defined = { is_empty : 1 };  // remember all tags defined in db

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
  //console.log("Defined tags:",tags_defined);
  if (tags_defined[tagstr] ) {
       do_maketag(uid,tagstr,qidlist,callback);
  } else {
    //console.log("insert into quiz_tag (tagname,teachid) values ($1,$2) returning id",[tagstr,uid]);
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
  //console.log("SETTAG do_maketag",uid,tagstr,qidlist);
  var tagid = tags_defined[tagstr];
  var insvalue = qidlist.replace(/,/g, function(c) {
        return "," + tagid +"),(" ;
      });
  insvalue += "," + tagid ;
  // first remove any pre-existing tags
  //console.log("delete from quiz_qtag where qid in ("+qidlist+") and tid = $1", [ tagid ]);
  client.query("delete from quiz_qtag where qid in ("+qidlist+") and tid = $1", [ tagid ],
    after(function(results) {
      //console.log("insert into quiz_qtag (qid,tid) values ( "+insvalue + ")" );
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
  var subject = query.subject;
  if (user.department != 'Undervisning') {
      callback(null);
      return;
  }
  var uid    = user.id;
  var tagstring   = query.tags;  // assumed to be 'atag,anothertag,moretags'
  // SPECIAL CASE tagstring == 'non' - find all questions with no tag
  if (tagstring == 'non') {
    var qtlist = { 'non':[] };
    client.query( "select q.id,q.qtype,q.qtext,q.name,q.teachid from quiz_question q left outer join quiz_qtag qt on (q.id = qt.qid) "
        + " where qt.qid is null and q.teachid=$1 and q.subject=$2 and q.status != 9 order by modified desc", [uid,subject],
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
    client.query( "select q.id,q.qtype,q.qtext,q.name,q.teachid,t.tagname from quiz_question q inner join quiz_qtag qt on (q.id = qt.qid) "
        + " inner join quiz_tag t on (qt.tid = t.id) where q.teachid=$1 and q.subject=$2 and q.status != 9 and t.tagname in  " + tags,[ uid,subject ],
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
  // returns null if user is not owner
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
              if (qobj.display == qu.sync.display && qobj.code == qu.sync.code) {
                  console.log("SYNC sees no diff ",qu);
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
            callback(null);
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
        if (ua.qtype == 'multiple' || ua.qtype == 'dragdrop') {
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
  // this should happen in renderq
  // we don't insert empty user-answers here
  //  we do however check for sub-containers
  //  and recurse thru them gathering up total score
  var cont = quiz.question[container] || {qtext:''} ;
  var cparam = parseJSON(cont.qtext);
  var contopt = cparam.contopt || {};
  var qlist = cparam.qlistorder;
  //console.log("CONTOPTS= ",contopt);
  //console.log("FASIT:",contopt.fasit,contopt.fasit && (+contopt.fasit & 1));
  client.query( "select id,qid,param,userid,score from quiz_useranswer where qid=$1  ",[ container ],
  after(function(coont) {
    if (coont && coont.rows) {
      var res = coont.rows[0];
      var coo = JSON.parse(res.param);
      // need to remember userid <--> anonym
      var qlist = coo.qlistorder;
      if (typeof(qlist) == "string") {
        qlist = qlist.split(',');
      }
      if (user.department == 'Undervisning' || ( (user.id == uid) && contopt.fasit && (+contopt.fasit & 1)) ) {
        client.query(  "select q.points,q.qtype,q.name,q.subject,qua.* from quiz_useranswer qua inner join quiz_question q on (q.id = qua.qid) "
                     + " where qua.qid in ("+(qlist.join(','))+" ) and qua.userid = $1 and qua.cid = $2 order by qua.time",[ uid, container ],
        after(function(results) {
              var myscore = { score:0, tot:0};
              var ualist = { q:{}, c:{}, sc:myscore };
              if (results && results.rows) {
                // clean the list - remove dups
                var qlist = [];
                var usedlist = {};
                for (var i=0; i< results.rows.length; i++) {
                  var qq = results.rows[i];
                  if (usedlist[qq.id] && usedlist[qq.id][qq.instance]) continue;
                  qlist.push(qq);
                  if (!usedlist[qq.id]) usedlist[qq.id] = {};
                  if (!usedlist[qq.id][qq.instance]) usedlist[qq.id][qq.instance] = 1;
                }
                scoreQuestion(uid,qlist,ualist,myscore,function () {
                     callback(ualist);
                     var prosent = (myscore.tot) ? myscore.score/myscore.tot : 0;
                     client.query( "update quiz_useranswer set score = $1 where userid=$2 and qid=$3", [prosent,uid,container]);
                  });
              } else {
                callback(ualist);
              }
        }));
      } else {
          callback(null);
      }
    } else {
      callback(null);
    }
  }));
}

var generateforall = exports.generateforall = function(user,query,callback) {
  // generate useranswer for all users
  var container    = +query.container;
  var parentid     = +query.parentid;
  var questlist    = query.questlist ;  // used in renderq - just fetch it here to check
  var group        = query.group;
  var isteach = (user.department == 'Undervisning');
  if (isteach) {
    var sql = "delete from quiz_useranswer where (qid =$1) ";
    delete quiz.containers[container];
    delete quiz.contq[container];
    // delete any symbols generated for this container
    client.query( sql,[container],
    after(function(results) {
        client.query( "delete from quiz_useranswer where cid = $1 and score = 0 and attemptnum = 0 and response = '' ",[ container],
        after(function(results) {
          if (db.memlist[group]) {
            for (var i=0, l = db.memlist[group].length; i<l; i++) {
              var enr = db.memlist[group][i];
              renderq({id:enr},query,function(resp) {
                //console.log(resp);
              });
            }
          }
          callback(null);
        }));
    }));
  }
}

var renderq = exports.renderq = function(user,query,callback) {
  // renders a list of questions
  // each question may be repeated and displayed 
  // differently depending on parameters
  // any questions/instances missing a useranswer
  // will have one inserted and parameters generated for it
  // all questions are assumed to be in quiz.question cache
  var container    = +query.container;
  var questlist    = query.questlist ;
  var uid          = +user.id;
  var justnow = new Date();
  var now = justnow.getTime()
  var contopt = {};
  var message = null;
  var ualist = {};
  var already = {};  // list of questions with existing answers
  var retlist = [];  // list to return
  // console.log( "select * from quiz_useranswer where qid = $1 and userid = $2 ",[ container,uid ]);
  client.query( "select * from quiz_useranswer where qid = $1 and userid = $2 ",[ container,uid ],
  after(function(results) {
      // we now have the container as delivered to the user
      // must get useranswer for container.
    client.query( "select * from quiz_useranswer where cid = $1 and userid = $2 order by instance",[ container,uid ],
    after(function(answers) {
            if (answers && answers.rows) {
              for (var i=0,l=answers.rows.length; i<l; i++) {
                var ua = answers.rows[i];
                var q = quiz.question[ua.qid];
                var qopts =parseJSON(q.qtext);
                if (q == undefined) {
                  continue;  // this response is to a question no longer part of container
                  // just ignore it
                }
                ua.points = q.points;
                ua.qtype = q.qtype;
                ua.name = q.name;
                ua.subject = q.subject;
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
                  var hin = ua.param.hints.split('_&_');
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
      var containerq = results.rows[0];
      if (!containerq) {
        // no container generated yet, make a new one
        // TODO make a true container here
        if (quiz.question[container]) {
          containerq = quiz.question[container];
          var coo = JSON.parse(containerq.qtext);
          containerq.attemptnum = 0;
          console.log("paaa 1");
        } else {
          containerq = { attemptnum:0 };
          var coo = { contopt:{} };
          console.log("paaa 2");
        }
      } else {
          var coo = JSON.parse(containerq.param);
          //console.log("paaa 3");
      }
      //if (quiz.question[container]) {
      //var containerq = quiz.question[container];
      contopt = coo.contopt || {};
      if (contopt.start || contopt.stop) {
        var start,stop,elm;
        if (contopt.start) {
          elm = contopt.start.split('/');
          start = new Date(elm[2],+elm[1]-1,elm[0]);
        }
        if (contopt.stop) {
          elm = contopt.stop.split('/');
          stop = new Date(elm[2],+elm[1]-1,elm[0]);
        }
        start = start || justnow - 20000;
        stop = stop || justnow + 2000;
        if (justnow < start || justnow > stop ) {
          console.log("OUT OF BOUNDS:",start,justnow,stop);
          if (user.department == 'Undervisning' ) {
            message = { points:0, qtype:'info', param: { display: '<h1>Test not open</h1>Start:'+contopt.start+'<br>Stop:'+contopt.stop } };
          } else {
            callback([ { points:0, qtype:'info', param: { display: '<h1>Test not open</h1>Start:'+contopt.start+'<br>Stop:'+contopt.stop } } ]);
            return;
          }
        }
      }
      if ( containerq.attemptnum != 0) {
        // we have questions in questlist
        // we have the order (and number) in qlist
        // BUT if we have questions not in  questlist
        // THEN we must just set attemptnum to 0
        // SO that new questions are generated
        // THIS happens if the question has just been edited
        // AND some of the questions deleted
        //console.log("USING GENERATED question list",coo.qlistorder);
        var qlist = coo.qlistorder.split(',');
        var ref = {};
        var allPresent = true;  // assume we have these questions
        for (var i=0; i< questlist.length; i++) {
          var q = questlist[i];
          ref[q.id] = q;
        }
        var newlist = [];
        for (var i=0; i< qlist.length; i++) {
          if (ref[qlist[i]]) {
            newlist.push(ref[qlist[i]]);
          } else {
            // this question is no longer part of the container
            // thus the quiz_useranswer is invalid
            console.log("Invalid qlist from useranswer - trigger regen");
            containerq.attemptnum = 0;
            allPresent = false;
          }
        }
        if (allPresent) questlist = newlist;
      }
      if ( containerq.attemptnum == 0) {
        // first time rendering this container
        // make random list if needed
        //console.log("Contopts = ", contopt);
        var always = []; // list of questions always used
        var fresh = []; // templist with existing answers removed
        // first check if we have existing answers (attemptnum > 0)
        // if we have - then use these if they still are on question-list
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
            // we slice them of
            // only do this if always is still empty
            // if not empty - then always contains already answered questions
            var n = +contopt.xcount;
            always = questlist.slice(0,n);
            questlist = questlist.slice(n);
        }
        if (contopt.randlist && contopt.randlist == "1") {
          // pick N random questions, if N >= length of list then just shuffle the list
          if (contopt.shuffle && contopt.shuffle == "1") {
            questlist = quiz.shuffle(questlist);
          }
          if (contopt.rcount && +contopt.rcount >= always.length && +contopt.rcount - always.length <= questlist.length) {
             questlist = questlist.slice(0,+contopt.rcount - always.length);
          }
        }
        questlist = always.concat(questlist);
        if (contopt.shuffle && contopt.shuffle == "1") {
          // must reshuffle so _always_ list gets mixed in
          questlist = quiz.shuffle(questlist);
          console.log("RANDOM QUESTIONS",uid);
        }
        // update for next time
        coo.qlistorder = questlist.map(function(e) { return e.id }).join(',');
        var para = JSON.stringify(coo)
        //console.log("updating container ...",container);
        //delete quiz.question[container];
        query.shufflist = questlist;
        client.query("update quiz_useranswer set param = $1,attemptnum =1 where userid=$2 and qid = $3",[ para,uid,container],
          after(function(results) {
          }));
      }
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
                console.log('UNEXPECTED, SURPRISING .. renderq found no useranswers');
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
                    if (ualist[qu.id] && ualist[qu.id][i]) {
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
                      quiz.generateParams(qu,user.id,i,container,function(params) {
                        missing.push( " ( "+qu.id+","+uid+","+container+",'',"+now+",0,'"+JSON.stringify(params)+"',"+i+" ) " );
                        loopWait(i+1,cb);
                      });
                    }
                  } else {
                    cb();
                  }
              }
    }));
  }));
}

exports.studresetcontainer = function(user,query,callback) {
  // deletes useranswers for (container)
  user = user || {};
  var container    = +query.container ;
  var uid          = user.id;
  var instance     = +query.instance || 0;
  var params = [ container,uid ];
  var sql = "delete from quiz_useranswer where (cid =$1) and userid=$2 ";
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
          var timest = 1234; //resp.ret[uid].start;
          //console.log("insert into quiz_history (userid,container,score,timest) values ($1,$2,$3,$4) ", [uid,container,percent,timest] );
          client.query("insert into quiz_history (userid,container,score,timest) values ($1,$2,$3,$4) ", [uid,container,percent,timest] );
       }
       delete quiz.containers[container];
       delete quiz.contq[container];
       // delete any symbols generated for this container
       //console.log(sql,params);
       client.query( sql,params,
       after(function(results) {
           callback(null);
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
  var sql = "delete from quiz_useranswer where (cid =$1 or qid=$1) ";
  //var sql = "delete from quiz_useranswer where cid =$1 ";
  var ii = 2;
  if (uid) {
    sql += " and userid=$"+ii;
    params.push(uid);
    ii++;
  }
  if (instance) {
    sql += " and instance=$"+ii;
    params.push(instance);
    ii++;
  }
  delete quiz.containers[container];
  delete quiz.contq[container];
  // delete any symbols generated for this container
  client.query( sql,params,
  after(function(results) {
      callback(null);
  }));
}

exports.getqcon = function(user,query,callback) {
  // refetches container (the qtext for the container)
  // so that we have the correct sort-order for contained questions
  var container    = +query.container ;
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
                             [now.getTime(), container, user.id ]);
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
              var sql = "select id from quiz_question where status != 9 and teachid=$1 and parent = 0 and qtype != 'quiz' and subject=$2 "
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

var copyquest = exports.copyquest = function(user,query,callback) {
  // simply duplicate the questions with new teachid , set parent of copy to source question
  var givenqlist   = query.givenqlist ;  // we already have the question-ids as a list
  var now = new Date();
  client.query( "insert into quiz_question (name,points,qtype,qtext,qfasit,teachid,created,modified,parent,subject) "
                + " select  name,points,qtype,qtext,qfasit,"+user.id+",created,"+(now.getTime())+",id,subject  "
                + " from quiz_question q where q.status != 9 and q.id in ("+givenqlist+") ",
    after(function(results) {
      client.query( " insert into quiz_qtag select qt.tid,q.id from quiz_question q "
          + " inner join quiz_qtag qt on (q.parent = qt.qid) "
          + " where q.parent != 0 and q.modified = $2 and q.teachid=$1" , [ user.id, now.getTime() ] ,
          after(function(results) {
             callback("ok");
             client.query( " delete from quiz_question where id in (select q.id from quiz_question q "
            + " inner join quiz_question qdup "
            + " on (q.parent = qdup.parent and q.teachid = qdup.teachid and q.id > qdup.id) where q.parent != 0 and "
            + " q.teachid = $1 and q.qtext = qdup.qtext) ",[user.id] );
          }));
  }));
}

exports.getcontainer = function(user,query,callback) {
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
  if (givenqlist) {
    // process the specified questions
    if (isteach) {
      sql = "select q.*,case when q.parent != 0 and q.qtext != qp.qtext then "
          + " case when qp.modified > q.modified then 3 else 2 end "        // sync diff
          + " else case when q.parent != 0 then 1 else 0 end  "
          + " end as sync "
          + "from quiz_question q  left join quiz_question qp on (q.parent = qp.id) where q.status != 9 and q.id in ("+givenqlist+") ";
      // sync will be 2 if parent,child differ - 1 if differ but parent older (child has recent change)
      // the teacher may decide to edit, then its nice to have diff from parent-question if its a copy
    } else {
      sql = "select q.*,0 as sync from quiz_question q where q.id in ("+givenqlist+") ";
    }
    param = [];
    //console.log("HERE 1");
  } else {
    // pick questions from container
    sql = (isteach) ? ( " select q.*,case when q.parent != 0 and q.qtext != qp.qtext then "
        + " case when qp.modified > q.modified then 3 else 2 end "        // sync diff
        + " else case when q.parent != 0 then 1 else 0 end  "
        + "end as sync "
        + "from quiz_question q  left join quiz_question qp on (q.parent = qp.id) where q.id in (  "
        + " select q.id from quiz_question q inner join question_container qc on (q.id = qc.qid) where q.status != 9 and qc.cid = $1 ) " )
          :
          "select q.*,0 as sync from quiz_question q inner join question_container qc on (q.id = qc.qid) where q.status != 9 and qc.cid =$1";
    param = [ container ];
    //console.log("HERE 2");
  }
  client.query( sql, param,
    after(function(results) {
      //console.log("came here ",results.rows);
          if (results && results.rows) {
            var qlist = [];
            for (var i=0,l=results.rows.length; i<l; i++) {
              var qu = results.rows[i];
              quiz.question[qu.id] = qu;           // Cache 
              qlist.push(quiz.display(qu,false));
            }
            if (container) quiz.contq[container] = qlist;
            callback(qlist);
          } else {
            callback(null);
          }
  }));
}


var getuseranswers = exports.getuseranswers = function(user,query,callback) {
  // get useranswers for a container
  // all questions assumed to be in quiz.question cache
  var containerid  = +query.container;
  var group        = query.group;
  var contopt      = query.contopt;  // options set for this container
  var ulist = {};     // list of students for this test
  var aid = 100000;
  var alias = {};  // map userid to alias
  //console.log( "select * from quiz_question where id = $1",[ containerid ]);
  //console.log("CONTOPT=",contopt);
  client.query( "select * from quiz_question where id = $1",[ containerid ],
  after(function(results) {
    container = results.rows[0];
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
              for (i=0, l = uas.rows.length; i<l; i++) {
                var u = uas.rows[i];
                if (!usas[u.userid]) usas[u.userid] = {};
                if (!usas[u.userid][u.qid]) usas[u.userid][u.qid] = [];
                usas[u.userid][u.qid][u.instance] = u;
              }
              for (i=0, l = results.rows.length; i<l; i++) {
                var res = results.rows[i];
                var coo = JSON.parse(res.param);
                // need to remember userid <--> anonym
                var qlist = coo.qlistorder;
                if (typeof(qlist) == "string") {
                  qlist = qlist.split(',');
                }
                var sscore = getscore(res,qlist,usas);
                if (!isteach && res.userid != user.id) {
                  res.userid = alias[res.userid];
                }
                ulist[res.userid] = 2;            // mark as started
                sscore.start = res.firstseen;
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

  function getscore(res,qlist,usas) {
    // qlist is the set of questions given to this user
    // usas contains useranswers index by userid,qid
    var tot = 0;
    var score = 0;
    var fresh = 0;
    if (qlist && qlist.length ) for (var i=0; i<qlist.length; i++) {
      var qid = qlist[i];
      if (usas[res.userid] && usas[res.userid][qid] && usas[res.userid][qid][i] != undefined) {
        var uu = usas[res.userid][qid][i];
        score += +uu.score;
        if (quiz.question[qid]) tot += quiz.question[qid].points;   
        if (uu.time > fresh) fresh = uu.time;
      } else {
        try {
          console.log("NOTFOUND ",qid,res.userid,qid,i);
        } catch(err) {
          // console.log("REALLY not there ",qid,i);
        }
      }
    }
    //if (res.userid==10024) {
      //console.log("uuUUUUUU",qlist,score,tot);
    //}
    //console.log("User ",res.userid,score,tot);
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
          var nuqids = '(' + nuqs.split(',').join(','+container+'),(') + ',' + container+')';
          //console.log( "insert into question_container (qid,cid) values " + nuqids);
          client.query( "insert into question_container (qid,cid) values " + nuqids,
              after(function(results) {
                callback( {ok:true, msg:"updated" } );
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
  + ' skriv finn klikk f_olgende svar bruk husk deretter begynne gj_or bedre begge begynte beste betyr blant ble blev bli blir blitt b_or bort borte bra bruke burde byen da dag dagen dager'
  + ' d_arlig de navnet navn deg del dem den denne der dere deres derfor dermed dersom dessuten det dette din disse d_oren du eg egen egentlig'
  + ' eget egne ei hvilke inneholder kalles skjer p_astandene brukes ulike merk hvilken oppgave foreg_ar plasser h_orer ovenfor ein eit eksempel eller ellers en enda ene eneste enkelte enn enn_a er et ett etter f_a fall fant far f_ar faren fast f_att'
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
  var wordlist = {  a:{}, b:{}, c:{}, d:{}, e:{}, f:{}, g:{},h:{}, i:{}, j:{}, k:{}, l:{}, m:{}, n:{}, o:{}, p:{}, q:{}, r:{}, s:{}, t:{}, u:{}, v:{},w:{}, x:{}, y:{}, z:{}, A:{} };
  var wlist = [];      // wordlist as sorted array
  var relations = {};  // questions sharing words
  var teachlist;       // list of teachers with questions
  var close = [];      // questions sharing "many" words | many > 7
  var teachid = (teacher) ? teacher : user.id;
  var subjects = {};   // distinct subjects with qcount
  var questions = {};
  var containers = {};
  // modified questions 
  client.query("select q.id from quiz_question q  left join quiz_question qp "
               + " on (q.parent = qp.id) where q.status != 9 and q.parent != 0 and q.modified < qp.modified and q.qtext != qp.qtext and q.teachid=$1",[teachid],
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
              client.query('select q.*, qp.teachid as origin from quiz_question q left outer join quiz_question qp on (q.parent = qp.id) where q.status != 9 and q.teachid='+ teachid ,
                 after(function(results) {
                    console.log("Got all questions");
                    if (results && results.rows) {
                      for (var i=0, l= results.rows.length; i<l; i++) {
                        var qu = results.rows[i];
                        if ( qu.subject) {
                          if (!subjects[qu.subject]) subjects[qu.subject] = 0;
                          subjects[qu.subject] += 1;
                        }
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
                        str.replace(/([A-Z_a-z]+)[-+.,;:() *\f\n\r\t\v\u00A0\u2028\u2029]/g,function(m,wo) {
                            if (wo.length < 3) return '';
                            wo = wo.toLowerCase();
                            if (skipwords[wo]) {
                              return '';
                            }
                            wo = wo.replace(/_a/g,'å').replace(/_o/g,'ø').replace(/_e/g,'æ');
                            if (wo.length < 3) return '';
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