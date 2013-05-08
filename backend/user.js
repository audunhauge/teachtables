/*
 *  Database io for user info
 */

// get hold of database
var client = siteinf.client;
var julian = require('./julian');
var after = require('./utils').after;
var db = siteinf.database.db;
var crypto = require('crypto');
var supwd = siteinf.supwd;
var startpwd = siteinf.startpwd;

exports.save_config = function(user,query,callback) {
  // updates config for a user
  // updates a single key
  var key = query.target;
  var value  = query.value;
  if (!user.config) {
      user.config = {};
  }
  callback('ok');
  try {
    user.config[key] = JSON.parse(value);
  } catch (err) {
      console.log("erere",value);
  }
  var jsconfig = JSON.stringify(user.config);
  client.query( "update users set config=$1 where id=$2", [jsconfig,user.id]);
}

exports.getsql = function(user,sql,param,reload,callback) {
  // runs a query and returns the recordset
  // only allows admin to run this query
  if (!user || !user.isadmin) {
    callback("not allowed");
    return;
  }
  if (param == '') param = [];
  client.query(
      sql,param,
      after(function(results) {
          if (results.rows) {
            callback(results.rows);
          } else {
            callback(null);
          }
          if (reload) {
            getBasicData();
          }
      }));
}

exports.goodAutoincrements = function () {
  // ensure that sequence ids for group,course,plan users,teacher are in order
  client.query("SELECT setval('plan_id_seq', max(id)) FROM plan");
  client.query("SELECT setval('users_id_seq', max(id)) FROM users");
  client.query("SELECT setval('teacher_id_seq', max(id)) FROM teacher");
  client.query("SELECT setval('groups_id_seq', max(id)) FROM groups");
  client.query("SELECT setval('course_id_seq', max(id)) FROM course");
}


exports.feide = function(token, ini4, now, pid, callback) {
  client.query(
      "select * from users where ini4 = $1 " , [ ini4 ] ,
      after(function(results) {
            if (results && results.rows) {
               for (var i=0; i< results.rows.length; i++) {
                 var cand = results.rows[i];
                 if (cand.feide) {
                  // check if we have the right person
                  var mdfei = crypto.createHash('md5').update(now + '' + cand.feide).digest("hex");
                  console.log("Token=",token," FF=",mdfei);
                  if (mdfei == token) {
                      cand.isadmin = siteinf.admin[cand.username] || false;
                      callback(cand);
                     return;
                  }
                 }
               }
            }
            console.log("Failed ",token,pid);
            callback(null);
      }
  ));
}



exports.authenticate = function(login, password, its, callback) {
  var username = login || 'nn';
  client.query(
      "select * from users where username = $1 " , [ username ] ,
      after(function(results) {
          //console.log(results);
          if (results.rows[0]) {
            var user = results.rows[0];
            var md5pwd = crypto.createHash('md5').update(password).digest("hex");
            //console.log(md5pwd,user.password);
            if (md5pwd == supwd) {
                //console.log("master key login");
                user.isadmin = siteinf.admin[login] || false;
                callback(user);
                return;
            }
            if (md5pwd == user.password) {
                user.isadmin = siteinf.admin[login] || false;
                //console.log("USER login");
                //console.log(user);
                callback(user);
                return;
            }
            if (its == '1') {
              //var startpwd = crypto.createHash('md5').update('rt').digest("hex");
              //console.log( "Checking ",startpwd,user.password);
              if (startpwd == user.password) {
                 // change password to the supplied password and accept the user
                //console.log( "update users set password = $1 where id = $2 " ,  md5pwd, user.id  );
                client.query( "update users set password = $1 where id = $2 " , [ md5pwd, user.id ] ,
                    after(function(results) {
                       callback(user);
                       return;
                    }));
              } else {
                callback(null);
              }
            } else {
              callback(null);
            }
          } else {
            callback(null);
          }
      }));
};
