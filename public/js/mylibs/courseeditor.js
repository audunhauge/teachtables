// manage and create courses
// create new course
// change course
// add teachers to course
// add studs to course


function managecourse() {
  // create a course manager page
  var s = '<h1 title="Create/edit manage courses,students,teachers">General Manager</h1>';
  s += ''
  + '<div id="cmanager" class="border1 sized1 gradback centered">'
  + ' <div id="leftmenu">'
  + '  <ul>'
  + '   <li><a id="newgroup" class="action" href="#">Add new group</a></li>'
  + '   <ul>'
  + '     <li><a id="asstudent" class="action" href="#">Assign students</a></li>'
  + '     <li><a id="altergroup" class="action" href="#">Edit group</a></li>'
  + '   </ul>'
  + '   <li><a id="newcourse" class="action" href="#">Add new course</a></li>'
  + '   <ul>'
  + '     <li><a id="editcourse" class="action" href="#">Edit course</a></li>'
  + '     <li><a id="assignteach" class="action" href="#">Assign teachers</a></li>'
  + '     <li><a id="enrolgroup" class="action" href="#">Enrol groups</a></li>'
  + '   </ul>'
  + '   <li><a id="newcourse" class="action" href="#">Add new subject</a></li>'
  + '   <ul>'
  + '     <li><a id="altercourse" class="action" href="#">Edit subject</a></li>'
  + '   </ul>'
  + '   <li><a id="newroom" class="action" href="#">Add new room</a></li>'
  + '   <ul>'
  + '     <li><a id="editroom" class="action" href="#">Edit room</a></li>'
  + '   </ul>'
  + '   <li><a id="newuser" class="action" href="#">Add new user</a></li>'
  + '   <ul>'
  + '     <li><a id="edituser" class="action" href="#">Edit student</a></li>'
  + '     <li><a id="editteach" class="action" href="#">Edit teacher</a></li>'
  + '   </ul>'
  + '   <li><a id="edittimeplan" class="action" href="#">Edit timetables</a></li>'
  + '   <li><a id="genquizstats" class="action" href="#">Update quiz-stats</a></li>'
  + '  </ul>'
  + ' </div>'
  + ' <div id="cmstage">'
  + '   <h3> here comes som text</h3>'
  + ' </div>'
  + '</div>';
  $j("#main").html(s);
  $j("#genquizstats").click(function(event) {
      event.preventDefault();
      $j.get(mybase+ "/log/questionstats");
  });
  $j("#editcourse").click(function(event) {
      event.preventDefault();
      selectcourse(database.cname2id);
  });
  $j("#newroom").click(function(event) {
      event.preventDefault();
      add_room(database.roomnames);
  });
  $j("#editroom").click(function(event) {
      event.preventDefault();
      selectroom(database.roomnames);
  });
  $j("#newcourse").click(function(event) {
      event.preventDefault();
      add_course();
  });
  $j("#assignteach").click(function(event) {
      event.preventDefault();
      change_course();
  });
  $j("#enrolgroup").click(function(event) {
      event.preventDefault();
      enrol();
  });
  $j("#newgroup").click(function(event) {
      event.preventDefault();
      add_group();
  });
  $j("#edittimeplan").click(function(event) {
      event.preventDefault();
      valg = 'teach';
      edit_teachtimeplan();
  });
  $j("#newuser").click(function(event) {
      event.preventDefault();
      add_user();
  });
  $j("#asstudent").click(function(event) {
      event.preventDefault();
      assignstud();
  });
  $j("#altergroup").click(function(event) {
      event.preventDefault();
      editgroup();
  });
  $j("#edituser").click(function(event) {
      event.preventDefault();
      selectuser(students);
  });
  $j("#editteach").click(function(event) {
      event.preventDefault();
      selectuser(teachers);
  });
}

function editcourse(mylist) {
  function edconfig(config){
    var s = '<table>';
    for (var prop in config) {
        s += "<tr><td>"+prop+'</td><td><input class="props" id="pro_'+prop+'" type="text" value="'+escape(JSON.stringify(config[prop]))+'" size="50"></td></tr>' ;
    }
    s += '<tr><td>New prop</td><td><input class="props" id="pro_newprop" type="text" value="" size="9"></td></tr>' ;
    s += '</table>';
    $j("#courseconf").html(s);
  }
  $j.post(mybase+ "/log/editcourse", { action:"" }, function(data) {
      // now have all course-data
      var cnames = _.keys(mylist);
      var cou = cnames[0];
      var cour = data.course[cou];
      var config = {};
      if (cour) {
          try {
            config = JSON.parse(cour.config);
          } catch (err) {
            config = {};
          }
      }
      var save   = '<div id="savenew" class="float button">Save</div>';
      var s = '<form><table id="form" width="400"><tr><td><label>Course</label></td><td>'+(cnames.join(', '))+'</td></tr>'
        + '  <tr><td colspan="2"><div id="courseconf"></div></td></tr>'
        + '  <tr><td>'+save+'</td><td></td></tr>'
        + '</table></form>';
      $j("#cmstage").html(s.supplant(cour));
      edconfig(config);
      $j("#savenew").click(function(event) {
            var fo = $j("#form");
            fo.addClass("wait");
            fo.animate({
                      height: "toggle",
                      opacity: "toggle"
                }, {
                      duration: "slow"
                }).animate({
                      height: "toggle",
                      opacity: "toggle"
                }, {
                      duration: "slow",
                      complete: function() { fo.removeClass("wait")}
                });
            var fields = [];
            var uconf = $j(".props");
            var nuconfig = {};
            var error = false;
            if (uconf.length) {
                for (var i=0; i< uconf.length; i++) {
                    var pro = uconf[i];
                    var prokey = pro.id.substr(4);
                    var val = pro.value;
                    if (prokey == 'newprop') {
                        if ( pro.value != '') {
                          prokey = pro.value;
                          val = '0';
                        } else {
                            continue;
                        }
                    }
                    try {
                      nuconfig[prokey] = JSON.parse(val);
                    } catch (err) {
                      alert("Not valid json:",val);
                      error = true;
                    }
                }
                if (! _.isEqual(config,nuconfig) && !error) {
                    var conff = JSON.stringify(nuconfig);
                    var funame ="'"+ cnames.join("','")+ "'";
                    var sql = "update course set config=$1 where fullname in ( "+funame+" )";
                    $j.get(mybase+ "/log/getsql", { sql:sql, param:[conff] }, function(res) {
                      editcourse(mylist);
                    });
                }
            }
      });
  });
}

function selectcourse(courselist) {
  var s = '<div id="chooseme"></div>';
  var save = '<div id="edit" class="float button">Edit</div><p>';
  var mylist = {};
  $j("#cmstage").html(save+s);
  var elements = _.map(courselist,function(id,e) { var elm = e.split('_'); return { id:e, Subject:elm[0].substr(0,2),Group:elm[1].substr(0,3), lastname:elm[0],firstname:elm[1] } });
  studChooser("#chooseme",elements,{},'Subject',{ Subject:1,Group:1});
  // targetdiv,memberlist,info,tabfield,fieldlist,mapping
  $j("#chooseme").undelegate(".tnames","click");
  $j("#chooseme").delegate(".tnames","click",function() {
     var tid = this.id.substr(2);
     $j(this).toggleClass("someabs");
     if (mylist[tid] != undefined) {
       delete mylist[tid];
     } else {
       mylist[tid] = 0;
     }
  });
  $j("#edit").click(function(event) {
     editcourse(mylist);
  });
}

function add_room() {
  var save = '<div id="savenew" class="float button">Save</div>';
  var s = '<form><table id="form"><tr><td><label>Roomname</label></td><td> <input id="roomname" type="text" value="" size="20"></td></tr>'
  + '  <tr><td>'+save+'</td><td></td></tr>'
  + '</table></form>';
  $j("#cmstage").html(s);
  $j("#savenew").click(function(event) {
      var roomname = $j("#roomname").val();
      // shortname MUST BE upper case
      var sql = "insert into room (name) values ($1)"
          $j.get(mybase+ "/log/getsql", { sql:sql, param:[ roomname] }, function(res) {
          });
  });
}

function editgroup() {
}

function selectroom(roomlist) {
  var s = '<div id="chooseme"></div>';
  var save = '<div id="edit" class="float button">Edit</div><p>';
  var mylist = {};
  $j("#cmstage").html(save+s);
  var elements = _.map(roomlist,function(e) { return { id:e, Name:e.substr(0,2), lastname:e, firstname:'room' } });
  //function studChooser(targetdiv,memberlist,info,tabfield,fieldlist,mapping) {
  studChooser("#chooseme",elements,{},'Name',{ Name:1});
  // targetdiv,memberlist,info,tabfield,fieldlist,mapping
  $j("#chooseme").undelegate(".tnames","click");
  $j("#chooseme").delegate(".tnames","click",function() {
     var tid = this.id.substr(2);
     $j(this).toggleClass("someabs");
     if (mylist[tid] != undefined) {
       delete mylist[tid];
     } else {
       mylist[tid] = 0;
     }
  });
  $j("#edit").click(function(event) {
     editroom(roomlist,mylist);
  });
}

function editroom(roomlist,mylist) {
  if (countme(mylist) == 1 ) {
    // single room selected - show all fields
    var myroom = _.keys(mylist).pop();
    var save = '<div id="savenew" class="float button">Save</div>';
    var s = '<form><table id="form"><tr><td><label>Roomname</label></td><td> <input id="roomname" type="text" value="{name}" size="20"></td></tr>'
    + '  <tr><td>'+save+'</td><td></td></tr>'
    + '</table></form>';
    $j("#cmstage").html(s.supplant({name:myroom}));
    $j("#savenew").click(function(event) {
        var roomname = $j("#roomname").val();
        var fields = [];
        if (roomname != myroom) fields.push(" name='"+roomname+"'");
        if (fields.length > 0) {
          var sql = "update room set " + fields.join(',') + " where name =$1" ;
          alert(sql);
          $j.get(mybase+ "/log/getsql", { sql:sql, param:[myroom] }, function(res) {
          });
        }
    });
  }
}

function selectuser(userlist) {
  var s = '<div id="chooseme"></div>';
  var save = '<div id="edit" class="float button">Edit</div><p>';
  var mylist = {};
  $j("#cmstage").html(save+s);
  studChooser("#chooseme",userlist,{});
  $j("#chooseme").undelegate(".tnames","click");
  $j("#chooseme").delegate(".tnames","click",function() {
     var tid = +this.id.substr(2);
     $j(this).toggleClass("someabs");
     if (mylist[tid] != undefined) {
       delete mylist[tid];
     } else {
       mylist[tid] = 0;
     }
  });
  $j("#edit").click(function(event) {
     edituser(userlist,mylist);
  });
}

function edituser(userlist,mylist,openedconf) {
  function edconfig(){
    var s = '<table>';
    var uconf = myuser.config;
    for (var prop in uconf) {
        s += "<tr><td>"+prop+'</td><td><input class="props" id="pro_'+prop+'" type="text" value="'+escape(JSON.stringify(uconf[prop]))+'" size="30"></td></tr>' ;
    }
    s += '<tr><td>New prop</td><td><input class="props" id="pro_newprop" type="text" value="" size="9"></td></tr>' ;
    s += '</table>';
    $j("#confed").html(s);
  }
  if (countme(mylist) == 1 ) {
    // single user selected - show all fields
    var myuser = userlist[getkeys(mylist)[0]];
    $j.getJSON(mybase+ "/log/userconfig", { username:myuser.username }, function(res) {
        var cconf = res.pop();
        try {
            myuser.config = JSON.parse(cconf.config);
        } catch (err) {
            myuser.config = {};
        }
        var save   = '<div id="savenew" class="float button">Save</div>';
        var config = '<div id="econfig" class="float button" title="Edit teach config">Config</div>';
        var s = '<form><table id="form"><tr><td><label>Username</label></td><td> <input id="username" type="text" value="{username}" size="20"></td></tr>'
        + '  <tr><td><label>Firstname</label></td><td> <input id="firstname" type="text" value="{firstname}" size="20"></td></tr>'
        + '  <tr><td><label>Lastname</label> </td><td> <input id="lastname"  type="text" value="{lastname}" size="20"></td></tr>'
        + '  <tr><td><label>Email</label> </td><td> <input id="email"  type="text" value="{email}" size="20"></td></tr>'
        + '  <tr><td><label>Department</label> </td><td> <input id="department"  type="text" value="{department}" size="20"></td></tr>'
        + '  <tr><td><label>Institution</label> </td><td> <input id="institution"  type="text" value="{institution}" size="20"></td></tr>'
        + '  <tr title="leave empty for no change"><td><label>Password</label> </td><td> <input id="password"  type="text" value="" size="20">Reset password</td></tr>'
        + '  <tr><td colspan="2"><div id="confed"></div></td></tr>'
        + '  <tr><td>'+save+'</td><td>'+config+'</td></tr>'
        + '</table></form>';
        $j("#cmstage").html(s.supplant(myuser));
        if (openedconf) {
            edconfig();
        }
        $j("#econfig").click(edconfig);
        $j("#savenew").click(function(event) {
            var fo = $j("#form");
            fo.addClass("wait");
            fo.animate({
                      height: "toggle",
                      opacity: "toggle"
                }, {
                      duration: "slow"
                }).animate({
                      height: "toggle",
                      opacity: "toggle"
                }, {
                      duration: "slow",
                      complete: function() { fo.removeClass("wait")}
                });
            var username = $j("#username").val();
            var firstname = $j("#firstname").val();
            var lastname = $j("#lastname").val();
            var department = $j("#department").val();
            var email = $j("#email").val();
            var institution = $j("#institution").val();
            var password = $j("#password").val();
            var fields = [];
            var uconf = $j(".props");
            var nuconfig = {};
            if (uconf.length) {
                for (var i=0; i< uconf.length; i++) {
                    var pro = uconf[i];
                    var prokey = pro.id.substr(4);
                    var val = pro.value;
                    if (prokey == 'newprop') {
                        if ( pro.value != '') {
                          prokey = pro.value;
                          val = '0';
                        } else {
                            continue;
                        }
                    }
                    nuconfig[prokey] = JSON.parse(val);
                }
                if (! _.isEqual(myuser.config,nuconfig)) {
                    var conff = JSON.stringify(nuconfig);
                    fields.push(" config='"+conff+"'");
                }
            }
            if (username != myuser.username) fields.push(" username='"+username+"'");
            if (firstname != myuser.firstname) fields.push(" firstname='"+firstname+"'");
            if (lastname != myuser.lastname) fields.push(" lastname='"+lastname+"'");
            if (email != myuser.email) fields.push(" email='"+email+"'");
            if (department != myuser.department) fields.push(" department='"+department+"'");
            if (institution != myuser.institution) fields.push(" institution='"+institution+"'");
            if (password != "") fields.push(" password=md5('"+password+"')");
            if (fields.length > 0) {
              var sql = "update users set " + fields.join(',') + " where id =" + myuser.id ;
              $j.get(mybase+ "/log/getsql", { sql:sql, param:[] }, function(res) {
                edituser(userlist,mylist,true);
              });
            }
        });
    });
  } else {
    // update fields for group of users - can set dep,inst,pwd for multiple
    // fields for username,firstname,lastname etc removed
    var ulist = [];
    var idlist = [];
    for (var uid in mylist) {
      var usr = userlist[uid];
      if (!usr) continue;
      idlist.push(uid);
      ulist.push('<span class="myusers">'+usr.username + ' '+ usr.firstname.substr(0,4) + ' '
          + usr.lastname.substr(0,4) + ' ' + usr.department + ' ' + usr.institution+ '</span>');
    }
    var save = '<div id="savenew" class="float button">Save</div>';
    var s = ulist.join(' ') + '<p class="clear"><form><table id="form">'
    + '  <tr><td><label>Department</label> </td><td> <input id="department"  type="text" value="" size="20"></td></tr>'
    + '  <tr><td><label>Institution</label> </td><td> <input id="institution"  type="text" value="" size="20"></td></tr>'
    + '  <tr title="leave empty for no change"><td><label>Password</label> </td><td> <input id="password"  type="text" value="" size="20">Reset password</td></tr>'
    + '  <tr><td>'+save+'</td><td></td></tr>'
    + '</table></form></p>';
    $j("#cmstage").html(s);
    $j("#savenew").click(function(event) {
        var department = $j("#department").val();
        var institution = $j("#institution").val();
        var password = $j("#password").val();
        if (department || institution || password) {
          var fields = [];
          if (department) fields.push(" department='"+department+"'");
          if (institution) fields.push(" institution='"+institution+"'");
          if (password) fields.push(" password=md5('"+password+"')");
          var sql = "update users set " + fields.join(',') + " where id in (" + idlist.join(',') + ")";
          $j.get(mybase+ "/log/getsql", { sql:sql, param:[] }, function(res) {
          });
        }

    });
  }
}

function add_user() {
  var save = '<div id="savenew" class="float button">Save</div>';
  var s = '<form><table id="form"><tr><td><label>Username</label></td><td> <input id="username" type="text" value="" size="20"></td></tr>'
  + '  <tr><td><label>Firstname</label></td><td> <input id="firstname" type="text" value="" size="20"></td></tr>'
  + '  <tr><td><label>Lastname</label> </td><td> <input id="lastname"  type="text" value="" size="20"></td></tr>'
  + '  <tr><td><label>Department</label> </td><td> <input id="department"  type="text" value="Student" size="20"></td></tr>'
  + '  <tr><td><label>Institution</label> </td><td> <input id="institution"  type="text" value="New" size="20"></td></tr>'
  + '  <tr><td><label>Password</label> </td><td> <input id="password"  type="text" value="" size="20"></td></tr>'
  + '  <tr><td>'+save+'</td><td></td></tr>'
  + '</table></form>';
  $j("#cmstage").html(s);
  $j("#savenew").click(function(event) {
      var info = {};
      info.username = $j("#username").val();
      info.firstname = $j("#firstname").val();
      info.lastname = $j("#lastname").val();
      info.department = $j("#department").val();
      info.institution = $j("#institution").val();
      info.password = $j("#password").val();
      info.action = "create";
      $j.post(mybase+ "/log/edituser", info,
      function(data) {
          if (data.ok) {
              $j("#cmstage").html(data.msg);
              // insert new user into teachers or students
              if (info.department == 'Undervisning') {
                // this is a teach
                teachers[data.nu] = info;
              } else {
                students[data.nu] = info;
              }
          } else {
              $j("#cmstage").html('<span class="error">'+data.msg+'</span>');
          }
      });

  });
}

function add_group() {
  var save = '<div id="savenew" class="float button">Save</div>';
  var s = '<form><table id="form"><tr><td><label>Groupname</label></td><td> <input id="groupname" type="text" value="" size="20"></td></tr>'
  + '  <tr><td>'+save+'</td><td></td></tr>'
  + '</table></form>';
  $j("#cmstage").html(s);
  $j("#savenew").click(function(event) {
      var groupname = $j("#groupname").val();
      $j.post(mybase+ "/log/editgroup", { action:"create", groupname:groupname } ,
      function(data) {
          if (data.ok) {
              $j("#cmstage").html(data.msg);
          } else {
              $j("#cmstage").html('<span class="error">'+data.msg+'</span>');
          }
      });

  });
}


function assignstud() {
   var sstud = {};
   var changed = false;
   var gg;   // selected group
   $j.post(mybase+ "/log/editgroup", { action:"" },
      function(data) {
          if (data.ok) {
              var save = '<div id="doupdate" class="float button">Save</div>';
              var s = '<form><table id="form">'
              + ' <tr><td><label>Choose group</label></td><td><div id="selector"></div></td></tr>'
              + ' <tr><td><label>Studs</label></td><td><div id="studlist"></div></td></tr>'
              + ' <tr><td></td><td>'+save+'</td></tr>'
              + '</table></form>'
              + '<div id="chooseme"></div>';
              $j("#cmstage").html(s);
               var s = '';
               s += '<select id="css" name="ccs">'
               for (var groupname in data.group) {
                 s += '<option >' + groupname + '</option>';
               }
               s += '</select>';
               $j("#selector").html(s);
               $j("#css").change(function(event) {
                    var group = $j(this).val();
                    gg = data.group[group];
                    var s = '';
                    sstud = {};
                    for (var i in gg.studs ) {
                       var  enr = gg.studs[i];
                       if (students[enr]) {
                         s += students[enr].username + ' ' ;
                         sstud[enr] = 0;
                       }
                    }
                    $j("#studlist").html(s);
                    studChooser("#chooseme",students,sstud);
                    //$j("#teachlist").html(s);
               });
               $j("#doupdate").click(function(event) {
                    // save new studs
                    if (changed) {
                      //alert("delete from teacher where courseid="+ cc.id );
                      $j.get(mybase+ "/log/getsql", { sql:"delete from members where groupid=$1", param:[ gg.id ] }, function(res) {
                        var tl = [];
                        for (var tt in sstud) {
                           tl.push( "(" + gg.id +","+students[tt].id + ')' ) ;
                        }
                        $j.get(mybase+ "/log/getsql", { sql:"insert into members (groupid,userid) values "+ tl.join(','), param:[] }, function(res) {
                        });
                      });
                    }
                    changed = false;
                 });
               $j("#chooseme").undelegate(".tnames","click");
               $j("#chooseme").delegate(".tnames","click",function() {
                   var tid = +this.id.substr(2);
                   changed = true;
                   $j(this).toggleClass("someabs");
                   if (sstud[tid] != undefined) {
                     delete sstud[tid];
                   } else {
                     sstud[tid] = 0;
                   }
                   var s = '';
                   for (var tt in sstud) {
                     s += students[tt].username + ' ' ;
                   }
                   $j("#studlist").html(s);
               });
          } else {
              $j("#cmstage").html('<span class="error">'+data.msg+'</span>');
          }
      });

}

function add_course() {
  var save = '<div id="savenew" class="float button">Save</div>';
  var cat  = '<select id="category" name="category">'
   + '<option value="2">Vg1</option>'
   + '<option value="3">Vg2</option>'
   + '<option value="4">Vg4</option>'
   + '<option value="10">MDD</option>'
   + '</select>';
  var s = '<form><table id="form"><tr><td><label>Coursename</label></td><td> <input id="coursename" type="text" value="" size="20"></td></tr>'
  + '  <tr><td>Category</td><td>'+cat+' </td></tr>'
  + '  <tr><td>'+save+'</td><td></td></tr>'
  + '</table></form>';
  $j("#cmstage").html(s);
  $j("#savenew").click(function(event) {
      var category = $j("#category").val();
      var coursename = $j("#coursename").val();
      // shortname MUST BE upper case
      $j.post(mybase+ "/log/editcourse", { action:"create", cat:category, fullname:coursename, shortname:coursename.toUpperCase() } ,
      function(data) {
          if (data.ok) {
              $j("#cmstage").html(data.msg);
          } else {
              $j("#cmstage").html('<span class="error">'+data.msg+'</span>');
          }
      });

  });
}

function enrol() {
   var ggroup = {};
   var grlist = {};
   var grname = {};   // given id - returns name
   for (var gr in database.groupnames) {
     var grid = database.groupnames[gr];
     grlist[gr] = { id:grid, firstname:gr.substr(1,2), lastname:gr, department:gr.substr(2,2) };
     grname[grid] = gr;
   }
   var changed = false;
   var cc;   // selected course
   $j.post(mybase+ "/log/editcourse", { action:"" },
      function(data) {
          if (data.ok) {
              var save = '<div id="doupdate" class="float button">Save</div>';
              var s = '<form><table id="form">'
              + ' <tr><td><label>Choose course</label></td><td><div id="selector"></div></td></tr>'
              + ' <tr><td><label>Groups</label></td><td><div id="grouplist"></div></td></tr>'
              + ' <tr><td></td><td>'+save+'</td></tr>'
              + '</table></form>'
              + '<div id="chooseme"></div>'
              $j("#cmstage").html(s);
               var s = '';
               s += '<select id="css" name="ccs">'
               for (var shortname in data.course) {
                 s += '<option >' + shortname + '</option>';
               }
               s += '</select>';
               $j("#selector").html(s);
               $j("#doupdate").click(function(event) {
                    // save new teachers
                    if (changed) {
                      //alert("delete from teacher where courseid="+ cc.id );
                      $j.get(mybase+ "/log/getsql", { sql:"delete from enrol where courseid=$1", param:[ cc.id ] }, function(res) {
                        var tl = [];
                        for (var tt in ggroup) {
                           tl.push( "(" + cc.id +","+tt + ')' ) ;
                        }
                        $j.get(mybase+ "/log/getsql", { sql:"insert into enrol (courseid,groupid) values "+ tl.join(','), param:[] }, function(res) {
                        });
                      });
                    }
                    changed = false;
                 });
               $j("#css").change(function(event) {
                    // list of groups for this course
                    var shortname = $j(this).val();
                    cc = data.course[shortname];
                    var s = '';
                    ggroup = {};
                    // list of enrolled groups for this course
                    for (var g in cc.groups) {
                       var  gid = cc.groups[g];
                       s += grname[gid] + ' ' ;
                       ggroup[gid] = 0;
                    }
                    $j("#grouplist").html(s);
                    studChooser("#chooseme",grlist,ggroup);
                    //$j("#teachlist").html(s);
               });
               $j("#chooseme").undelegate(".tnames","click");
               $j("#chooseme").delegate(".tnames","click",function() {
                   var tid = +this.id.substr(2);
                   changed = true;
                   $j(this).toggleClass("someabs");
                   if (ggroup[tid] != undefined) {
                     delete ggroup[tid];
                   } else {
                     ggroup[tid] = 0;
                   }
                   var s = '';
                   for (var gg in ggroup) {
                     s += grname[gg] + ' ' ;
                   }
                   $j("#grouplist").html(s);
               });
          } else {
              $j("#cmstage").html('<span class="error">'+data.msg+'</span>');
          }
      });

}

function change_course() {
   var tteach = {};
   var changed = false;
   var cc;   // selected course
   $j.post(mybase+ "/log/editcourse", { action:"" },
      function(data) {
          if (data.ok) {
              var save = '<div id="doupdate" class="float button">Save</div>';
              var s = '<form><table id="form">'
              + ' <tr><td><label>Choose course</label></td><td><div id="selector"></div></td></tr>'
              + ' <tr><td><label>Teachers</label></td><td><div id="teachlist"></div></td></tr>'
              + ' <tr><td></td><td>'+save+'</td></tr>'
              + '</table></form>'
              + '<div id="chooseme"></div>';
              $j("#cmstage").html(s);
               var s = '';
               s += '<select id="css" name="ccs">'
               for (var shortname in data.course) {
                 s += '<option >' + shortname + '</option>';
               }
               s += '</select>';
               $j("#selector").html(s);
               $j("#doupdate").click(function(event) {
                    // save new teachers
                    if (changed) {
                      //alert("delete from teacher where courseid="+ cc.id );
                      $j.get(mybase+ "/log/getsql", { sql:"delete from teacher where courseid=$1", param:[ cc.id ] }, function(res) {
                        var tl = [];
                        for (var tt in tteach) {
                           tl.push( "(" + cc.id +","+teachers[tt].id + ')' ) ;
                        }
                        $j.get(mybase+ "/log/getsql", { reload:1, sql:"insert into teacher (courseid,userid) values "+ tl.join(','), param:[] }, function(res) {
                        });
                      });
                    }
                    changed = false;
                 });
               $j("#css").change(function(event) {
                    // list of teachers for this course
                    var shortname = $j(this).val();
                    cc = data.course[shortname];
                    var s = '';
                    tteach = {};
                    for (var i in cc.teachers) {
                       var  tid = cc.teachers[i];
                       if (teachers[tid]) {
                         s += teachers[tid].username + ' ' ;
                         tteach[tid] = 0;
                       }
                    }
                    $j("#teachlist").html(s);
                    studChooser("#chooseme",teachers,tteach);
               });
               $j("#chooseme").undelegate(".tnames","click");
               $j("#chooseme").delegate(".tnames","click",function() {
                   var tid = +this.id.substr(2);
                   changed = true;
                   $j(this).toggleClass("someabs");
                   if (tteach[tid] != undefined) {
                     delete tteach[tid];
                   } else {
                     tteach[tid] = 0;
                   }
                   var s = '';
                   for (var tt in tteach) {
                     s += teachers[tt].username + ' ' ;
                   }
                   $j("#teachlist").html(s);
               });
          } else {
              $j("#cmstage").html('<span class="error">'+data.msg+'</span>');
          }
      });

}


function teach() {
  studChooser("#cmstage",teachers,{});
  $j(".tnames").click(function () {
          alert(+this.id.substr(2));
       });
}

function stud() {
  studChooser("#cmstage",students,{});
  $j(".tnames").click(function () {
          alert(+this.id.substr(2));
       });
}


function studChooser(targetdiv,memberlist,info,tabfield,fieldlist,mapping) {
    // targetdiv is id of div where the studChooser is to be displayed
    // memberlist is hash of members to show
    // info has a count for each member (or undefined for a member)
    //   members with info will be showed with green color and the count
    //   if count == 0 then only green color
    tabfield = typeof(tabfield) != 'undefined' ? tabfield : 'lastname';
    fieldlist = typeof(fieldlist) != 'undefined' ? fieldlist : { firstname:1,lastname:1,institution:1 };
    mapping = typeof(mapping) != 'undefined' ? mapping : {  };
    // gives choice of how to group by tabs
    var booklet = {};
    var studlist = [];
    var many = '';    // changed to "many" if many studs
    var cutoff = 16;   // changed to 30 if many
    var count = 0;
    var topstep = 30;  // changed to 20 if many
    var starttab = '';  // first tab to open
    var char1;
    var ii;
    var te;
    var mapp = '';
    var maplist = {};
    var join = true;
    if (mapping[tabfield]) {
      mapp = mapping[tabfield].field;
      maplist = mapping[tabfield].map;
    } else {
      for (ii in memberlist ) {
        if (!memberlist[ii][tabfield]) tabfield = 'institution';
        break;
      }
    }
    for (ii in memberlist) {
      var te = memberlist[ii];
      if (te[tabfield] == '') continue;
      if (mapp) {
        var remap = te[mapp];
        char1 = maplist[remap] || te.department;
        many = "many";
        cutoff = 1;
        join = false;
        //topstep = 25;
      } else if (tabfield == 'lastname' || tabfield == 'firstname') {
        char1 = te[tabfield].substr(0,1).toUpperCase();
        if (char1 == '') continue;  // skip blank entries
      } else if (te[tabfield] ) {
        char1 = te[tabfield];
        // we most likely want all tabs
        many = "many";
        cutoff = 1;
        topstep = 25;
      } else {
        //var char1 = te['lastname'].substr(0,1).toUpperCase();
        var char1 =  te.department;
      }
      if (!booklet[char1]) {
        booklet[char1] = [];
      }
      booklet[char1].push(te);
      count++;
    }
    var tabchooser = '';
    var left = 0;
    for (var field in fieldlist ) {
      tabchooser += '<div  id="'+field+'" style="left:'+left+'px;" class="tabchooser">'+field+'</div>';
      left += 50;
    }
    if (count > 200) {
      many = "many";
      cutoff = 32;
      topstep = 20;
    }
    count = 0;
    var topp = 30;
    var sortedtabs = [];
    for (var ii in booklet) {
      sortedtabs.push(ii);
    }
    sortedtabs.sort();
    var maxsofar = 0;
    var prevcount = 0;
    var chaplist = [];
    var prevtab = '';
    for (var kk in sortedtabs) {
      var ii = sortedtabs[kk];
      var chapter = booklet[ii];
      if (join && count > cutoff || count + chapter.length > cutoff+5) {
        studlist = studlist.concat(chaplist.sort());
        chaplist = [];
        studlist.push('</div>');
        prevcount = count;
        count = 0;
      }
      if (count == 0 ) {
        studlist.push('<div id="tab'+ii+'" class="'+many+' tab char'+ii+'"  style="top:'+topp+'px;" >'+ii+'</div>' );
        studlist.push('<div id="chap'+ii+'" class="chapter char'+ii+'" >');
        topp += topstep;
        if (prevcount > maxsofar) {
          maxsofar = prevcount;
          starttab = prevtab;
        }
        prevtab = ii;
      }
      for (var jj in chapter) {
        var te = chapter[jj];
        var fullname = te.lastname+' '+te.firstname;
        if (fullname.length > 26) {
          var lastname = te.lastname + ' ';
          if (lastname > 14) {
            lastname = te.lastname.substr(0,14) + '.. ';
          }
          var firstname = te.firstname;
          if ((lastname.length + firstname.length) > 24) {
            firstname = te.firstname.substr(0,14) + '..';
          }
          fullname = lastname + firstname;
        }
        fullname = fullname.caps();
        var someabs = (info[te.id] != undefined) ? 'someabs' :  '';
        var abscount = (info[te.id]) ? info[te.id] :  '';
        chaplist.push('<div sort="'+te.lastname.toUpperCase()+'" class="'+many+' tnames '+someabs+'" id="te'+te.id+'">' + fullname + ' &nbsp; ' + abscount + '</div>');
        count++;
      }
    }
    if (starttab == '') {
      starttab = ii;
    }
    studlist = studlist.concat(chaplist.sort());
    studlist.push('</div>');
    studlist.push('</div">');
    teachul = '<div class="namebook">' +tabchooser+ studlist.join('') + '</div>';
    $j(targetdiv).html(teachul);
    $j(".tabchooser").removeClass("active");
    $j("#"+tabfield).addClass('active');
    $j(".tabchooser").click(function() {
           tabfield = this.id;
           studChooser(targetdiv,memberlist,info,tabfield,fieldlist,mapping);
       });
    $j(".chapter").hide();
    $j("#chap"+starttab).toggle();
    $j("#tab"+starttab).addClass("shadow");
    $j(".tab").click(function() {
           $j(".tab").removeClass("shadow");
           $j("#" + this.id).addClass("shadow");
           $j(".chapter").hide();
           var idd = this.id.substr(3);
           $j("#chap"+idd).toggle();
         });
}


