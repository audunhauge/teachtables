/*
 *
 *        Teachtables server
 *
 */


var site = 'default';
var crypto = require('crypto');
var siteinf = {};
if (process.argv[2]) {
  site = process.argv[2];
} else {
  console.log("no site specified - using default, expecting connection error");
  console.log("Usage: node server.js sitename","\n make a copy of sites/default.js and edit");
  console.log(" you need to setup postgres (see setup-postgres.txt");
  console.log(" create/edit a lang file (public/js/mylibs/lang/mylang.js");
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



var fs = require('fs');
//var sys = require('sys');

var version = '1.1.0';
siteinf.version = version;

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

var addons = {}
// extra data that we send AFTER the main page has been drawn
// this so that the page seems more responsive
addons.update = {};
// used to store time info for resources
// we refetch if the resource is stale

/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(base+'stat',express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
