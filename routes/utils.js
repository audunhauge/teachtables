/*
 *
 *    findUser
 *
 */

var database = siteinf.database;
var db = database.db;
exports.findUser = function (firstname,lastname) {
  // search for a user given firstname and lastname
  // try students first (studs may shadow teach)
  lastname = lastname.replace(/%F8/g,"ø");
  lastname = lastname.replace(/%E6/g,"æ");
  lastname = lastname.replace(/%E5/g,"å");
  lastname = lastname.replace(/%D8/g,"Ø");
  lastname = lastname.replace(/%C6/g,"Æ");
  lastname = lastname.replace(/%C5/g,"Å");
  firstname = firstname.replace(/%F8/g,"ø");
  firstname = firstname.replace(/%E6/g,"æ");
  firstname = firstname.replace(/%E5/g,"å");
  firstname = firstname.replace(/%D8/g,"Ø");
  firstname = firstname.replace(/%C6/g,"Æ");
  firstname = firstname.replace(/%C5/g,"Å");
  var list = [];
  var seen = {};
  if (lastname == '') {
    // just one search word
    // we try department,institution
      var any = new RegExp(firstname.trim(),"i");
      var plain = firstname.trim().toUpperCase();
      for (var i in db.students) {
        var s = db.students[i];
        if (seen[s.id]) continue;
        if (s.lastname.match(any) || s.firstname.match(any) || s.department.match(any)  || s.institution.match(any)) {
           if (s) {
             list.push(s);
             seen[s.id] = 1;
           }
        }
      }
      for (var j in db.teachers) {
        var t = db.teachers[j];
        if (seen[t.id]) continue;
        if (t.lastname.match(any) || t.firstname.match(any) || t.department.match(any)  || t.institution.match(any)) {
           if (t) {
             list.push(t);
             seen[t.id] = 1;
           }
        }
      }
      if (db.memlist[plain]) {
        // the searchterm matches a groupname
        //var gr = courseteach[firstname.trim()].split('_')[1];
        var studlist = db.memlist[plain];
        for (j in studlist) {
          var s = db.students[studlist[j]];
          if (seen[s.id]) continue;
          if (s) {
             list.push(s);
             seen[s.id] = 1;
          }
        }
      } else { 
          if (db.coursesgr[plain]) {
          // the searchterm matches a coursename
          var grlist = db.coursesgr[plain];
          // all groups for this course
          for (i in grlist) {
            var gr = grlist[i];
            if (db.courseteach[plain+'_'+gr]) {
              var tl = db.courseteach[plain+'_'+gr].teach;
              for (var k in tl) {
                t = db.teachers[tl[k]];
                if (t) {
                  t.gr = gr;
                  list.unshift(t);
                }
              }
            }
            var studlist = db.memlist[gr];
            for (j in studlist) {
              var s = db.students[studlist[j]];
              if (s) {
                s.gr = gr;
                list.push(s);
              }  
            }
          }
        }

      }
  } else {
      firstname = firstname.trim();
      lastname = lastname.trim();
      //console.log("fn="+firstname + " ln=" + lastname);
      //console.log("scanning studs");
      for (var i in db.students) {
        var s = db.students[i];
        if (s.firstname.toLowerCase() == firstname && s.lastname.toLowerCase() == lastname) {
           if (s) list.push(s);
           return list;
        }
      }
      // scan thru teachers
      //console.log("scanning teach");
      for (var j in db.teachers) {
        var t = db.teachers[j];
        if (t.firstname.toLowerCase() == firstname && t.lastname.toLowerCase() == lastname) {
           if (t) list.push(t);
           return list;
        }
      }
      var fn = new RegExp(firstname,"i");
      var ln = new RegExp(lastname,"i");
      //console.log("regexp scanning studs");
      for (var i in db.students) {
        var s = db.students[i];
        if ( s.firstname.match(fn) && s.lastname.match(ln)) {
           if (s) list.push(s);
        }
      }
      //console.log("regexp scanning teach");
      for (var j in db.teachers) {
        var t = db.teachers[j];
        if ( t.firstname.match(fn) && t.lastname.match(ln)) {
           if (t) list.push(t);
        }
      }
  }
  return list;
}
