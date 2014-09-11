// this module implements the server-side of quiz-question engine
//   display   : will pick apart questions dependent on type
//   grade     : grade question-answer against correct answer

var fs = require('fs');
var exec = require('child_process').exec;
var crypto = require('crypto');
var _ = require('underscore');
var jsp = require('uglify-js');
var jstat = require('./jstat').jstat;
var jdiff = require('./jdiff');
var client = siteinf.client;
var after = require('./utils').after;
var isInt = require('./utils').isInt;
var saveconf = require('./user').save_config;
var studans = {}; // cache of stud answers
var database = siteinf.database;
var db = database.db;

Math.ln = Math.log;

var parseJSON = exports.parseJSON = function (str) {
  // take just about any string - ignore errors
  if (str && str != '') {
    str = str.replace(/\n/g,' ');
    try {
      return JSON.parse(str);
    } catch(err) {
      console.log("RENDER JSON PARSE error ",err,str);
      return {};
    }
  } else {
    return {};
  }

}


function prep(code) {
  code = code.replace(/package/g,"function package()");
  code = code.replace(/(\w+) extends (\w+)/g,"$1_ext_$2");
  code = code.replace(/class (\w+)/ig,"function class_$1()");
  code = code.replace(/import ([^ ;]+)/g,"import($1) ");
  code = code.replace(/\+\+/g,"+=1");
  code = code.replace(/--/g,"-=1");
  code = code.replace(/var (\w+):(\w+)/gi,"var $1");
  code = code.replace(/(\w+)\((.+)\):(int|string|number|boolean|date|void)/ig,"$1($2)");
  code = code.replace(/public (\w+) (\w+)/g,"$1 public_$2");
  code = code.replace(/private (\w+) (\w+)/g,"$1 private_$2");
  var ast;
  try {
   ast = jsp.parse(code);
   ast.figure_out_scope();
   ast.compute_char_frequency();
   ast.mangle_names();
   var res = ast.print_to_string({beautify:true});
   console.log(res);
   return res;
  }
  catch (err) {
   console.log(err);
   console.log("THE CODE:",code);
   return code;
  }
}

primes1000 = [
 2,3,5,7,11,13,17,19,23,29,
 31,37,41,43,47,53,59,61,67,71,
 73,79,83,89,97,101,103,107,109,113,
 127,131,137,139,149,151,157,163,167,173,
 179,181,191,193,197,199,211,223,227,229,
 233,239,241,251,257,263,269,271,277,281,
 283,293,307,311,313,317,331,337,347,349,
 353,359,367,373,379,383,389,397,401,409,
 419,421,431,433,439,443,449,457,461,463,
 467,479,487,491,499,503,509,521,523,541,
 547,557,563,569,571,577,587,593,599,601,
 607,613,617,619,631,641,643,647,653,659,
 661,673,677,683,691,701,709,719,727,733,
 739,743,751,757,761,769,773,787,797,809,
 811,821,823,827,829,839,853,857,859,863,
 877,881,883,887,907,911,919,929,937,941,
 947,953,967,971,977,983,991,997,1009,1013,
 1019,1021,1031,1033,1039,1049,1051,1061,1063,1069,
 1087,1091,1093,1097,1103,1109,1117,1123,1129,1151,
 1153,1163,1171,1181,1187,1193,1201,1213,1217,1223,
 1229,1231,1237,1249,1259,1277,1279,1283,1289,1291,
 1297,1301,1303,1307,1319,1321,1327,1361,1367,1373,
 1381,1399,1409,1423,1427,1429,1433,1439,1447,1451,
 1453,1459,1471,1481,1483,1487,1489,1493,1499,1511,
 1523,1531,1543,1549,1553,1559,1567,1571,1579,1583,
 1597,1601,1607,1609,1613,1619,1621,1627,1637,1657,
 1663,1667,1669,1693,1697,1699,1709,1721,1723,1733,
 1741,1747,1753,1759,1777,1783,1787,1789,1801,1811,
 1823,1831,1847,1861,1867,1871,1873,1877,1879,1889,
 1901,1907,1913,1931,1933,1949,1951,1973,1979,1987,
 1993,1997,1999,2003,2011,2017,2027,2029,2039,2053,
 2063,2069,2081,2083,2087,2089,2099,2111,2113,2129,
 2131,2137,2141,2143,2153,2161,2179,2203,2207,2213,
 2221,2237,2239,2243,2251,2267,2269,2273,2281,2287,
 2293,2297,2309,2311,2333,2339,2341,2347,2351,2357,
 2371,2377,2381,2383,2389,2393,2399,2411,2417,2423,
 2437,2441,2447,2459,2467,2473,2477,2503,2521,2531,
 2539,2543,2549,2551,2557,2579,2591,2593,2609,2617,
 2621,2633,2647,2657,2659,2663,2671,2677,2683,2687,
 2689,2693,2699,2707,2711,2713,2719,2729,2731,2741,
 2749,2753,2767,2777,2789,2791,2797,2801,2803,2819,
 2833,2837,2843,2851,2857,2861,2879,2887,2897,2903,
 2909,2917,2927,2939,2953,2957,2963,2969,2971,2999,
 3001,3011,3019,3023,3037,3041,3049,3061,3067,3079,
 3083,3089,3109,3119,3121,3137,3163,3167,3169,3181,
 3187,3191,3203,3209,3217,3221,3229,3251,3253,3257,
 3259,3271,3299,3301,3307,3313,3319,3323,3329,3331,
 3343,3347,3359,3361,3371,3373,3389,3391,3407,3413,
 3433,3449,3457,3461,3463,3467,3469,3491,3499,3511,
 3517,3527,3529,3533,3539,3541,3547,3557,3559,3571,
 3581,3583,3593,3607,3613,3617,3623,3631,3637,3643,
 3659,3671,3673,3677,3691,3697,3701,3709,3719,3727,
 3733,3739,3761,3767,3769,3779,3793,3797,3803,3821,
 3823,3833,3847,3851,3853,3863,3877,3881,3889,3907,
 3911,3917,3919,3923,3929,3931,3943,3947,3967,3989,
 4001,4003,4007,4013,4019,4021,4027,4049,4051,4057,
 4073,4079,4091,4093,4099,4111,4127,4129,4133,4139,
 4153,4157,4159,4177,4201,4211,4217,4219,4229,4231,
 4241,4243,4253,4259,4261,4271,4273,4283,4289,4297,
 4327,4337,4339,4349,4357,4363,4373,4391,4397,4409,
 4421,4423,4441,4447,4451,4457,4463,4481,4483,4493,
 4507,4513,4517,4519,4523,4547,4549,4561,4567,4583,
 4591,4597,4603,4621,4637,4639,4643,4649,4651,4657,
 4663,4673,4679,4691,4703,4721,4723,4729,4733,4751,
 4759,4783,4787,4789,4793,4799,4801,4813,4817,4831,
 4861,4871,4877,4889,4903,4909,4919,4931,4933,4937,
 4943,4951,4957,4967,4969,4973,4987,4993,4999,5003,
 5009,5011,5021,5023,5039,5051,5059,5077,5081,5087,
 5099,5101,5107,5113,5119,5147,5153,5167,5171,5179,
 5189,5197,5209,5227,5231,5233,5237,5261,5273,5279,
 5281,5297,5303,5309,5323,5333,5347,5351,5381,5387,
 5393,5399,5407,5413,5417,5419,5431,5437,5441,5443,
 5449,5471,5477,5479,5483,5501,5503,5507,5519,5521,
 5527,5531,5557,5563,5569,5573,5581,5591,5623,5639,
 5641,5647,5651,5653,5657,5659,5669,5683,5689,5693,
 5701,5711,5717,5737,5741,5743,5749,5779,5783,5791,
 5801,5807,5813,5821,5827,5839,5843,5849,5851,5857,
 5861,5867,5869,5879,5881,5897,5903,5923,5927,5939,
 5953,5981,5987,6007,6011,6029,6037,6043,6047,6053,
 6067,6073,6079,6089,6091,6101,6113,6121,6131,6133,
 6143,6151,6163,6173,6197,6199,6203,6211,6217,6221,
 6229,6247,6257,6263,6269,6271,6277,6287,6299,6301,
 6311,6317,6323,6329,6337,6343,6353,6359,6361,6367,
 6373,6379,6389,6397,6421,6427,6449,6451,6469,6473,
 6481,6491,6521,6529,6547,6551,6553,6563,6569,6571,
 6577,6581,6599,6607,6619,6637,6653,6659,6661,6673,
 6679,6689,6691,6701,6703,6709,6719,6733,6737,6761,
 6763,6779,6781,6791,6793,6803,6823,6827,6829,6833,
 6841,6857,6863,6869,6871,6883,6899,6907,6911,6917,
 6947,6949,6959,6961,6967,6971,6977,6983,6991,6997,
 7001,7013,7019,7027,7039,7043,7057,7069,7079,7103,
 7109,7121,7127,7129,7151,7159,7177,7187,7193,7207,
 7211,7213,7219,7229,7237,7243,7247,7253,7283,7297,
 7307,7309,7321,7331,7333,7349,7351,7369,7393,7411,
 7417,7433,7451,7457,7459,7477,7481,7487,7489,7499,
 7507,7517,7523,7529,7537,7541,7547,7549,7559,7561,
 7573,7577,7583,7589,7591,7603,7607,7621,7639,7643,
 7649,7669,7673,7681,7687,7691,7699,7703,7717,7723,
 7727,7741,7753,7757,7759,7789,7793,7817,7823,7829,
 7841,7853,7867,7873,7877,7879,7883,7901,7907,7919];

function sympify(txt) {
  // convert 2x^2+3(x-2)(x+1) to 2*x**2+3*(x-2)*(x+1)
  if (txt =='' || txt == undefined) return txt;
  var fu = txt.replace(/ /g,'');
      fu = fu.replace(/\^/gm,'**');
      fu = fu.replace(/([0-9]+)([a-z(])/gm,function(m,f,e) { return f+'*'+e; });
      fu = fu.replace(/x\(/gm,'x*(');
      fu = fu.replace(/\)x/gm,')*x');
      fu = fu.replace(/xx/gm,'x*x');
      fu = fu.replace(/xx/gm,'x*x');
      fu = fu.replace(/xx/gm,'x*x');
      fu = fu.replace(/xx/gm,'x*x');
      fu = fu.replace(/\+\-/gm,'-');
      fu = fu.replace(/\-\-/gm,'+');
      fu = fu.replace(/\-\+/gm,'-');
      fu = fu.replace(/^1\*/gm,'');
      fu = fu.replace(/^\-1\*/gm,'-');
      fu = fu.replace(/([^0-9])1\*/gm,function(m,f) { return f; });
      fu = fu.replace(/\)\(/gm,')*(');
  return fu;
}

function normalizeFunction(txt,nosubst,ua) {
  // convert 2x^2+3(x-2)(x+1) to 2*pow(t,2)+3*(t-2)*(t+1)
  // x,y => t
  if (txt =='' || txt == undefined) return txt;
  nosubst = (typeof nosubst != "undefined") ? 1 : 0;
  if (ua) {
      console.log("TESTING ua",ua,txt);
      // use ua to supply values for u1 u2 u3 ... values given in other userinput
      txt = txt.replace(/u([0-9])/gm,function(m,n) { var i = +n; if (ua[i] && _.isNumber(+ua[i])) {return +ua[i]} else {return m;}   } );
      console.log("CHANGED TO ua",ua,txt);
  }
  var fu = txt.replace(/ /g,'').replace(/exp/gm,'©');
      if (!nosubst) fu = fu.replace(/[xy]/gm,'t');
      fu = fu.replace(/([xyt])\^([0-9]+)/gm,function(m,n,o) { return 'pow('+n+','+o+')'; } );
      fu = fu.replace(/([xyt])\*\*([0-9]+)/gm,function(m,n,o) { return 'pow('+n+','+o+')'; } );
      fu = fu.replace(/([0-9]+)([a-z(])/gm,function(m,f,e) { return f+'*'+e; });    // regexp confuses editor
      fu = fu.replace(/pow\(([^,]+),([^)]+)\)/gm,function(m,f,e) { return "pow("+f+";"+e+")"; })
      fu = fu.replace(/([0-9])\,([0-9])/gm,function(m,f,e) { return f+"."+e; });      // desimal 3,141 => 3.141
      fu = fu.replace(/;/gm,",");
      fu = fu.replace(/tt/gm,'t*t');
      fu = fu.replace(/tt/gm,'t*t');
      fu = fu.replace(/xx/gm,'x*x');
      fu = fu.replace(/xx/gm,'x*x');
      fu = fu.replace(/yy/gm,'y*y');
      fu = fu.replace(/yy/gm,'y*y');
      fu = fu.replace(/\)\(/gm,')*(').replace(/©/gm,'exp');
      //return 'with(Math) { return ' + fu + '; }';
      return fu;
}


function addslashes(str) {
  str=str.replace(/\\/g,'\\\\');
  str=str.replace(/\'/g,'\\\'');
  str=str.replace(/\"/g,'\\"');   // '
  return str;
}
function stripslashes(str) {
  str=str.replace(/\\'/g,'\'');
  str=str.replace(/\\"/g,'"');    // '
  str=str.replace(/\\\\/g,'\\');
  return str;
}


var qz = {
    quiz:{}         // cache for quiz info
 ,  question:{}     // cache for questions
 ,  contq:{}        // cache for container-questions
 ,  graphs:{}       // cache for graphs indexed by md5 hash of asymptote code
 //,  symb:{}         // symbols used by dynamic question
 ,  containers:{}   // symbols defined by container
 , perturbe:function(optionCount) {
     // gives back a shuffled string, 'abcd'.length == optionCount
     // 'abcd'  becomes 'dacb' etc - giving the order for options
     var str = '';
     var bag = 'abcdefghijklmnopqrstuvwxyz'.substr(0,optionCount);
     // bugger them that use more options in a quiz!
     for (var i=0; i< optionCount; i++) {
       var idx = Math.floor(Math.random()*bag.length);
       var ch = bag.charAt(idx);
       bag = bag.substr(0,idx) + bag.substr(idx+1);
       str += ch;
     }
     return str;
 }
 , reorder:function(marry,str) {
     // reorders an array based on str
     // str is generated by perturbe
     var jane = [];
     if (marry == undefined) return jane;
     for (var i=0,l=marry.length; i<l; i++) {
       var a = str.charCodeAt(i) - 97;
       jane.push(marry[a]);
     }
     return jane;
 }
 , getQobj: function(qtext,qtype,qid,instance) {
     var qobj = { display:'', options:[] , fasit:[] , code:'', pycode:'', hints:'',  daze:'', contopt:{} };
     if (!qtext ) return qobj;
     try {
         qobj = JSON.parse(qtext);
     } catch(err) {
       console.log("getOBJ EVAL-ERROR",err,qtext);
     }
     if (qobj == undefined) {
        qobj = { display:'', options:[] , fasit:[] , daze:'', code:'', pycode:'', hints:'',  contopt:{}};
     }
     if (!qobj.code) qobj.code = '';
     if (!qobj.pycode) qobj.pycode = '';
     if (!qobj.hints) qobj.hints = '';
     qobj.origtext = qobj.display;  // used by editor
     var did,cid;
     plots = [];
     // strip out function plot descriptions like €€line { points:[[[1,2],[1,2]]] } €€
     // as the [[ ]] may be eaten by sequence,dragdrop fillin etc
     if (qobj.display) qobj.display = qobj.display.replace(/€€([^€]+)€€/gm,function(m,plot) {
       plots.push(plot);
       return '_FusRoDah_';
     });
     switch(qtype) {
       case 'textarea':
       case 'diff':
       case 'numeric':
       case 'fillin':
         draggers = [];
         did = 0;
         qobj.display = qobj.display.replace(/\[\[([^ª]+?)\]\]/mg,function(m,ch) {
             draggers[did] = ch;
             var sp;
             if (ch == 'anytext') {
                 // special case: numeric match anytext  [[anytext]] behaves as a textarea
                 // workbook.js knows this and does special test for this case
                 // when substituting back in <input, will change to <textarea>
               sp = '<span id="dd'+qid+'_'+instance+'_'+did+'" class="fillin">_&nbsp;&nbsp;&nbsp;&nbsp;</span>';
             } else {
               sp = '<span id="dd'+qid+'_'+instance+'_'+did+'" class="fillin">&nbsp;&nbsp;&nbsp;&nbsp;</span>';
             }
             did++;
             return sp;
         });
         qobj.fasit = draggers;
         break;
       case 'sequence':
         draggers = [];
         categories = [];
         catnames = [];
         did = 0;
         cid = 0;  // container for this group
         qobj.display = qobj.display.replace(/\[\[([^ª]+?)\]\]/gm,function(m,ch) {
             // we assume [[categoryname:elements,in,this,category]]
             // where , may be replaced by newline
             var lines;
             var catname=''+cid,elements=ch,off;
             if (off = ch.indexOf(":"), off >= 0) {
               catname = ch.substr(0,off);
               elements = ch.substr(off+1);
             }
             categories[cid] = [];
             catnames[cid] = catname;
             if (elements.indexOf("\n") >= 0) {
               // this is a multiline text - split on newline
               lines = elements.split("\n");
             } else {
               lines = elements.split(',');
             }
             for (var i=0; i< lines.length; i++) {
               var l = lines[i];
               if (l == '') continue;
               draggers[did] = l;
               categories[cid].push(l);
               did++;
             }
             var inorder = catname.charAt(0) == '+';
             var orderclass = '';
             if (inorder) {
               catname = catname.substr(1);
               orderclass = 'order ';
             }
             var sp = '<div class="catt">'+catname+'</div><ul id="dd'+qid+'_'
                 + cid + '" class="'+orderclass+'sequence connectedSortable"><li class="hidden" >zzzz</li>ª</ul>';
             cid++;
             return sp;
         });
         qobj.fasit = draggers;
         qobj.cats = categories;
         qobj.catnames = catnames;
         break;
       case 'textmark':
       case 'info':
       case 'dragdrop':
         draggers = [];
         did = 0;
         qobj.display = qobj.display.replace(/\[\[(.+?)\]\]/g,function(m,ch) {
             if (ch == ' ') {
                 // special: a single blank means BLANK option - doesnt generate a draggable
                 // thus questions like : place x on the third position: [[ ]] [[ ]] [[x]] [[ ]]
                 // works basically like checkbox - but can place the box anywhere in text
                 // TODO we may not need to do anything here
             }
             draggers[did] = ch;
             var sp = '<span id="dd'+qid+'_'+instance+'_'+did+'" class="drop">&nbsp;&nbsp;&nbsp;&nbsp;</span>';
             did++;
             return sp;
         });
         qobj.fasit = draggers;
         //console.log("Draggers = ",draggers);
         break;
       case 'abcde':
         break;
       case 'multiple':
         break;
       default:
         break;
     }
     // restore any function descriptions that were extracted before the switch
     if (plots.length) {
       qobj.display = qobj.display.replace(/_FusRoDah_/gm,function(m) {
          return '€€'+plots.shift()+'€€';
       });
     }
     return qobj;
   }
 , stashInSymbols: function(pyout) {
     var lines = pyout.split(/\n/);
     for (var lid in lines) {
       var exp = lines[lid];
       var elm = exp.split(/=/,2);
       var sy = elm[0].replace(/ /g,'');
       if (symb[sy] != undefined ) {
         // TODO replace operatorname with sin/cos/**/^ ?
         symb[sy] = (elm[1].replace(/operatorname/,'mathop'));
       }
     }
   }
  , doPyCode:function(text,uid,instance,callback) {
    if (!text || text == '') {
      callback()
    } else {
      var intro = 'from sympy import *\n';
      var now = new Date().getTime();
      fs.writeFile("/tmp/symp"+now, intro+text, function (err) {
         if (err) { res.send(''); throw err; }
          try {
           var child = exec("/usr/bin/python /tmp/symp"+now, function(error,stdout,stderr) {
             fs.unlink('/tmp/symp'+now);
             if (error) {
               console.log(error,stderr);
               callback();
             } else {
               if (stdout && stdout != '') {
                  qz.stashInSymbols(stdout);
               }
               callback();
             }
           });
         } catch(err) {
               console.log("TRIED ",err);
               callback();
         }
      });
    }
  }
  , diagram:function(text,qid,instance) {
     // draw some diagrams
     //   histogram
     //   bar
     //   line,linreg,expreg
     /*
           dataprovider = 'var data = [];\n'
                   + 'var ch = $j("#quest'+qid+'_'+instance+' .fillin input");\n'
                   + 'for (var i=0, l=ch.length; i<l; i++) {\n'
                   + '   var opti = $j(ch[i]).val();\n'
                   + '   data[i] = opti\n'
                   + '}\n';
                   */
     if (!text || text == '') return text;
     if (text.indexOf('€€') < 0) return text;
     var idx = 0;
     text = text.replace(/€€([a-z]+) ([^ª]+?)€€/g,function(m,command,params) {
         var dataprovider,
             hist = 'bad hist',
             data = '',
             tegn = '',
             userdata = false;
         idx++;
         params = params.trim();
         command = command.trim();
         var udata =  'var udata = []; function getudata'+qid+'_'+instance+'() {\n'
                     + '   udata = [];\n'
                     + '   var ch = $j("#quest'+qid+'_'+instance+' .fillin input");\n'
                     + '   for (var i=0, l=ch.length; i<l; i++) {\n'
                     + '      var opti = $j(ch[i]).val();\n'
                     + '     udata[i] = opti || 0;\n'
                     + '   }}\n'
         var plot = false;
         var idd = qid+'_'+instance+'_'+idx;
         switch (command) {
           case 'jqplot':
               // use jqplot to plot a graph
               console.log("Generating jqplot graph",idd);
               hist = '<div id="hist'+idd+'" style="width:200px; height:200px;" ></div><script>';
               hist += " $j.plot($j('#hist" + idd + "'), "+params+" );";
               hist +=  '</script>';
               return hist;
             break;
           case 'flot':
               // use jquery flot functions to plot graphs
               // TODO fix this - pick out width and height
               if (text.indexOf('replot') >= 0)  {
                  tegn = '<div id="redraw'+qid+'_'+instance+'" class="gradebutton">Tegn</div>';
               }
               var w=200,h=200;
               params.replace(/height:([0-9]+)/gm,function(m,a) { h = a; } );
               params.replace(/width:([0-9]+)/gm,function(m,a) { w = a; } );
               console.log("Generating flot graph",idd);
               hist = '<div id="hist'+idd+'" style="width:'+w+'px; height:'+h+'px;" ></div><script>';
               hist += " $j.plot($j('#hist" + idd + "'), "+params+" );";
               hist +=  '</script>';
               return hist;
             break;
           case 'plot':
               if (text.indexOf('replot') >= 0)  {
                  tegn = '<div id="redraw'+qid+'_'+instance+'" class="gradebutton">Tegn</div>';
               }
               var elm = [];
               params.replace(/{([^ª]+?)}/mg,function(mm,cc) {
                    elm.push(cc);
                 });
               if (elm.length < 1) {
                 console.log("expected 1 groups of {} - found ",elm.length);
                 return hist;
               }
               //dataprovider += 'var data=['+elm[0]+'];\n';
               hist = '<div id="hist'+idd+'">'+tegn+'<div class="graph"></div></div><script>' + udata;
               var param = (elm[1]) ? ','+elm[1] : '';
               // subst param x for t without breaking exp(t)
               var fulist = elm[0].replace(/\r/g,' ').replace(/\n/g,' ');
               fulist = fulist.replace(/pow\(([^,)]+),/gm,function(m,a) { return 'pow('+a+'©'; } );
               fulist = fulist.replace(/,/gm,'ð').replace(/©/gm,',');
               fulist = normalizeFunction(fulist);
               var fus = fulist.split('ð');
               var ro = 'function (t) { with(Math) { return ' + fus.join(' }}, function (t) { with(Math) { return ') + '}}';
               // hist += 'function fu'+idd+'(t) { with(Math) { return '+fu+' } };\n';
               hist += 'getudata'+qid+'_'+instance+'();var param = { fu:['+ro+'] ,  target:"#hist'+idd+'"'+param+' };\n'
               hist += '$j("#redraw'+qid+'_'+instance+'").click("",function() { fubug("redraw"); getudata'+qid+'_'+instance+'();var param = { fu:['
                           +ro+'] ,  target:"#hist'+idd+'"'+param+' }; lineplot(param) });lineplot(param)\n</script>';
               //console.log(hist);
               return hist;
               break;
           case 'vfield':
               if (text.indexOf('replot') >= 0)  {
                  tegn = '<div id="redraw" class="gradebutton">Tegn</div>';
               }
               var elm = [];
               params.replace(/{([^ª]+?)}/mg,function(mm,cc) {
                     elm.push(cc);
                  });
               if (elm.length < 1) {
                 console.log("expected 1 groups of {} - found ",elm.length);
                 return hist;
               }
               hist = '<div id="hist'+idd+'">'+tegn+'<div class="graph"></div></div><script>' + udata;
               var param = (elm[1]) ? ','+elm[1] : '';
               // subst param x for t without breaking exp(t)
               var fulist = elm[0].replace(/\r/g,' ').replace(/\n/g,' ');
               fulist = normalizeFunction(fulist,1);
               var fus = fulist;
               var ro = 'function (x,y) { with(Math) { return ' + fus + '}}';
               hist += 'getudata();var param = { fu:'+ro+' ,  target:"#hist'+idd+'"'+param+' };\n'
               hist += '$j("#redraw").click("",function() { getudata();var param = { fu:'+ro
                        + ' ,  target:"#hist'+idd+'"'+param+' }; vfield(param) });vfield(param)\n</script>';
                //console.log(hist);
                return hist;
               break;
           case 'line':
                return hist;
               break;
           case 'hist':
            //   width of interval and height
            if (userdata) {
              tegn = '<div class="gradebutton">Tegn</div>';
            } else {
              var elm = [];
              params.replace(/{([^ª]+?)}/g,function(mm,cc) {
                   elm.push(cc);
                });
              if (elm.length < 1) {
                console.log("expected 1 groups of {} - found ",elm.length);
                return hist;
              }
              dataprovider =  'var data=['+elm[0]+'];\n'
            }
            hist = '<div id="hist'+qid+'_'+instance+'_'+idx+'">'+tegn+'</div><script>'
                   + dataprovider
                   + 'if (data.length > 0) {\n'
                   + ' var w=20, h=80;\n'
                   + ' var start=[],width=[], freq=[], sum = 0;\n'
                   + ' for (var i=0, l=data.length; i<l; i += 2) {\n'
                   + '   width.push(+data[i]);\n'
                   + '   freq.push(+data[i+1]);\n'
                   + '   start.push(+sum);\n'
                   + '   sum += +data[i];\n'
                   + ' }\n'
                   + ' var x = d3.scale.linear()\n'
                   + '     .domain([0, 1])\n'
                   + '     .range([0, w]);\n'
                   + ' var y = d3.scale.linear()\n'
                   + '     .domain([0,Math.max.apply(null, freq) ])\n'
                   + '     .rangeRound([0, h]);\n'
                   + ' var chart'+idx+' = d3.select("#hist'+qid+'_'+instance+'_'+idx+'").append("svg")\n'
                   + '       .attr("class", "chart")\n'
                   + '       .attr("width", w * sum)\n'
                   + '       .attr("height", h+20);\n'
                   + ' chart'+idx+'.selectAll("rect") \n'
                   + '     .data(freq) \n'
                   + '   .enter().append("rect") \n'
                   + '     .attr("x", function(d, i) { return 5*start[i] - .5; }) \n'
                   + '     .attr("y", function(d,i) { return 20+h - y(d) - .5; }) \n'
                   + '     .attr("width", function(d,i) { return 5*width[i]; }) \n'
                   + '     .attr("height", function(d) { return y(d); }); \n'
                   + 'chart'+idx+'.append("line")\n'
                   + '     .attr("x1", 0)\n'
                   + '     .attr("x2", 5 * sum)\n'
                   + '     .attr("y1", 20+h -y(0)- .5)\n'
                   + '     .attr("y2", 20+h -y(0)- .5)\n'
                   + '     .style("stroke", "#000");\n'
                   + '}\n'
                   + ((userdata) ? (
                       '$j("#hist'+qid+'_'+instance+'_'+idx+'").undelegate(".gradebutton","click");\n'
                     + '$j("#hist'+qid+'_'+instance+'_'+idx+'").delegate(".gradebutton","click",function() {\n'
                     + '   data = [];\n'
                     + '   var ch = $j("#quest'+qid+'_'+instance+' .fillin input");\n'
                     + '   for (var i=0, l=ch.length; i<l; i++) {\n'
                     + '      var opti = $j(ch[i]).val();\n'
                     + '     data[i] = opti\n'
                     + '   }\n'
                     + ' var start=[],width=[], freq=[], sum = 0;\n'
                     + ' for (var i=0, l=data.length; i<l; i += 2) {\n'
                     + '   width.push(+data[i]);\n'
                     + '   freq.push(+data[i+1]);\n'
                     + '   start.push(+sum);\n'
                     + '   sum += +data[i];\n'
                     + ' }\n'
                     + '   y.domain([0,Math.max.apply(null, freq) ]);\n'
                     + '   if (freq.length > 0) {\n'
                     + '    chart'+idx+'.selectAll("rect") \n'
                     + '     .data(freq) \n'
                     + '     .transition() \n'
                     + '     .duration(1000) \n'
                     + '     .attr("x", function(d, i) { return 5*start[i] - .5; }) \n'
                     + '     .attr("y", function(d,i) { return 20+h - y(d) - .5; }) \n'
                     + '     .attr("width", function(d,i) { return 5*width[i]; }) \n'
                     + '     .attr("height", function(d) { return y(d); }); \n'
                     + '    }\n'
                     + ' })\n'
                     ) : '')
                   + '</script>';
               //console.log(hist);
               return hist;
             break;
           case 'bar':
            if (userdata) {
              tegn = '<div class="gradebutton">Tegn</div>';
            } else {
              var elm = [];
              params.replace(/{([^ª]+?)}/g,function(mm,cc) {
                   elm.push(cc);
                });
              if (elm.length < 1) {
                console.log("expected 1 groups of {} - found ",elm.length);
                return hist;
              }
              dataprovider = 'var data=['+elm[0]+'];\n';
            }
            hist = '<div id="hist'+qid+'_'+instance+'_'+idx+'">'+tegn+'</div><script>'
                   + dataprovider
                   + 'if (data.length > 0) {\n'
                   + ' var w=20, h=80;\n'
                   + ' var x = d3.scale.linear()\n'
                   + '     .domain([0, 1])\n'
                   + '     .range([0, w]);\n'
                   + ' var y = d3.scale.linear()\n'
                   + '     .domain([0,Math.max.apply(null, data) ])\n'
                   + '     .rangeRound([0, h]);\n'
                   + ' var chart'+idx+' = d3.select("#hist'+qid+'_'+instance+'_'+idx+'").append("svg")\n'
                   + '       .attr("class", "chart")\n'
                   + '       .attr("width", w * data.length - 1)\n'
                   + '       .attr("height", h+20);\n'
                   + ' chart'+idx+'.selectAll("rect") \n'
                   + '     .data(data) \n'
                   + '   .enter().append("rect") \n'
                   + '     .attr("x", function(d, i) { return x(i) - .5; }) \n'
                   + '     .attr("y", function(d,i) { return 20+h - y(d) - .5; }) \n'
                   + '     .attr("width", w) \n'
                   + '     .attr("height", function(d) { return y(d); }); \n'
                   + 'chart'+idx+'.append("line")\n'
                   + '     .attr("x1", 0)\n'
                   + '     .attr("x2", w * data.length)\n'
                   + '     .attr("y1", 20+h -y(0)- .5)\n'
                   + '     .attr("y2", 20+h -y(0)- .5)\n'
                   + '     .style("stroke", "#000");\n'
                   + 'chart'+idx+'.selectAll("text")\n'
                   + '     .data(data)\n'
                   + '   .enter().append("text")\n'
                   + '     .attr("x", function(d, i) { return x(i) + .5; }) \n'
                   + '     .attr("y", function(d,i) { return 20+h - y(d) - .5; }) \n'
                   + '     .attr("dx", 3) // padding-right\n'
                   + '     .attr("dy", "-.35em") // vertical-align: middle\n'
                   + '     .attr("text-anchor", "top") // text-align: right\n'
                   + '     .text(String);\n'
                   + '}\n'
                   + ((userdata) ? (
                       '$j("#hist'+qid+'_'+instance+'_'+idx+'").undelegate(".gradebutton","click");\n'
                     + '$j("#hist'+qid+'_'+instance+'_'+idx+'").delegate(".gradebutton","click",function() {\n'
                     + '   data = [];\n'
                     + '   var ch = $j("#quest'+qid+'_'+instance+' .fillin input");\n'
                     + '   for (var i=0, l=ch.length; i<l; i++) {\n'
                     + '      var opti = $j(ch[i]).val();\n'
                     + '     data[i] = opti\n'
                     + '   }\n'
                     + '   y.domain([0,Math.max.apply(null, data) ]);\n'
                     + '   if (data.length > 0) {\n'
                     + '    chart'+idx+'.selectAll("rect") \n'
                     + '     .data(data) \n'
                     + '     .transition() \n'
                     + '     .duration(1000) \n'
                     + '     .attr("x", function(d, i) { return x(i) - .5; }) \n'
                     + '     .attr("y", function(d,i) { return 20+h - y(d) - .5; }) \n'
                     + '     .attr("width", w) \n'
                     + '     .attr("height", function(d) { return y(d); }); \n'
                     + '    }\n'
                     + ' })\n'
                     ) : '')
                   + '</script>';
               //console.log(hist);
               return hist;
             break;
         }
       });
       return text;
    }
  , asymp:function(text) {
     if (!text || text == '') return text;
     if (text.indexOf('££') < 0) return text;
     var idx = 0;
     //var now = new Date().getTime();
     var retimg =  '<img src="http://i.imgur.com/bY7XM.png">';
     text = text.replace(/££([^ª]+?)££/g,function(m,ch) {
         var asy = '';
           // default graph to show if no valid graph
         ch = ch.trim();
         if (ch.substr(0,4) == 'plot') {
            asy = 'import graph; size(200,200,IgnoreAspect); scale(false);'
            var elm = [];
            ch.replace(/{([^ª]+?)}/g,function(mm,cc) {
                 elm.push(cc);
              });
            if (elm.length < 2) {
              console.log("missing x/y values");
              return retimg;
            }
            asy += 'real[] x={'+elm[0]+'}; real[] y={'+elm[1]+'};';
            asy += 'draw(graph(x,y,Hermite),red);';
            asy += 'xaxis("$x$",BottomTop,LeftTicks );'
            asy += 'yaxis("$y$",LeftRight, RightTicks);';
            var md5 = crypto.createHash('md5').update(asy).digest("hex");
            //console.log(md5);
            if (qz.graphs[md5]) {
              // we have a graph for this code already
              retimg = qz.graphs[md5];
            } else {
              retimg =  '<img src="graphs/asy'+md5+'.png">';
              fs.writeFile("/tmp/asy"+md5, asy, function (err) {
                 if (err) { throw err; }
                   var child = exec("/usr/local/bin/asy -o public/graphs/asy"+md5+" -f png /tmp/asy"+md5, function(error,stdout,stderr) {
                     fs.unlink('/tmp/asy'+md5);
                     if (error) {
                       console.log(error,stderr);
                     } else {
                       qz.graphs[md5] = '<img src="graphs/asy'+md5+'.png">';
                     }
                   });
              });
            }
         } else if (ch.substr(0,5) == 'graph') {
            asy = 'import graph; size(200,200,IgnoreAspect); scale(false);'
            var elm = ch.substr(6).split(',');
            var elm = ch.substr(6).split(',');
            //console.log(elm);
            var lo = (elm[1] != undefined) ? elm[1] : -5;
            var hi = (elm[2] != undefined) ? elm[2] : 5;
            var fun = elm[0].split(';');
            var colors = ['red','blue','green','black'];
            for (var i=0; i< fun.length; i++) {
              var col = colors[i] || 'black';
              asy += 'real f'+i+'(real x) {return '+fun[i]+';} '
                  +  'pair F'+i+'(real x) {return (x,f'+i+'(x));} '
                  +  'draw(graph(f'+i+','+lo+','+hi+',Hermite),'+col+'); ';
            }

            asy += 'xaxis("$x$",LeftTicks ); '
                +  'yaxis("$y$",RightTicks); ';
            var md5 = crypto.createHash('md5').update(asy).digest("hex");
            //console.log(asy);
            if (qz.graphs[md5]) {
              // we have a graph for this code already
              retimg = qz.graphs[md5];
            } else {
              retimg =  '<img src="graphs/asy'+md5+'.png">';
              fs.writeFile("/tmp/asy"+md5, asy, function (err) {
                 if (err) { throw err; }
                   var child = exec("/usr/local/bin/asy -o public/graphs/asy"+md5+" -f png /tmp/asy"+md5, function(error,stdout,stderr) {
                     fs.unlink('/tmp/asy'+md5);
                     if (error) {
                       console.log(error,stderr);
                     } else {
                       qz.graphs[md5] = '<img src="graphs/asy'+md5+'.png">';
                     }
                   });
              });
            }
         } else {
         }
         return retimg;
       });
     return text;
  }
 , doCode:function(text,uid,instance) {
     text = text.trim();
     if (text == '' ) {
       return ;
     }
     var lines = text.split(/\n/);
     for (var lid in lines) {
       var exp = lines[lid].trim();
             if (exp == '' ) {
               continue ;
             }
         try {
            with(symb){ eval('('+exp+')') };
         } catch(err) {
               console.log("EVAL-ERROR err=",err," EXPRESSION=",exp,":::");
         }
     }
     //console.log("SYMB=",symb);
   }
 , macro:function(text,container) {
     //var cha = 'abcdefghijklmnopqrstuvwxyz';
     // expand #a to value of symb.a
     // expand #{name[2]} to value of symb.con.name[2]
     var fix = 4; // default precision
     fix = (symb.fix != undefined && _.isNumber(symb.fix) && +symb.fix < 12 && +symb.fix >= 0 ) ?  +symb.fix : 4;
     function fixx(v,m,fix) {
         if (v != 'niu') {
             return (_.isNumber(v) && ! isInt(v)) ? (+v).toFixed(fix) : v;
         } else {
             return m;
         }
     }
     var idx = 0;
     // all numeric answers toFixed(fix) if not otherwise specified by fix = 2 etc
     // precision can be overrridden as " add #a3 and #b5 ", will use 3 and 5 decimal places
     if (!text || text == '') return text;
     text = text.replace(/\#([a-zA-Z])([0-9]?)/g,function(m,ch,fx) {
         var afix = (fx != '') ? +fx : fix;
         return fixx(symb[ch],m,afix);
       });
     text = text.replace(/\#{([a-zA-Z]+)}/g,function(m,c1) {
       return fixx(symb.con[c1],m,fix);
       });
     text = text.replace(/\#{([a-zA-Z]+)\[(.+?)\]}/g,function(m,c1,c2) {
       //  symb.a[2]
       if (symb.con[c1]) return fixx(symb.con[c1][c2],fix);
       return 0;
       });
     // if any #{ ... } left - try them as expressions
     // so #{a+2} will fetch #a and add 2
     text = text.replace(/\#{([a-zA-Z0-9.+*/^)(-]+)}/g,function(m,exp) {
       var calc = 0;
       try {
           // first replace d?nn with dice value
           // da6 => random(1..6), db22 => random(1..22)
           // da6 db6 dc6 dd6 are all 1..6 ( da6 will give same value if evaluated twice)
           // thus if you need two d6 dice that are independent (independent random vars)
           // you can use da6 db6 dc6 .. dz6
           // rolled dice are stored in symb.dice
           exp = exp.replace(/(d[a-z][0-9]+)/g,function(m,ch) {
               if (symb.dice[ch]) {
                    return symb.dice[ch];
               } else {
                    var dd = Math.floor(+ch.substr(2));
                    symb.dice[ch] = 1 + Math.floor(Math.random()*dd);
                    return symb.dice[ch];
               }
           });
           // see if we have a^b or a^([0-9]+)
           exp = exp.replace(/([a-z])\^(([a-z])|([0-9]+))/g,function(m,b,p) {
               return "Math.pow("+b+","+p+")";
           });
           with(symb){ calc = eval('('+exp+')') };
           return calc;
         } catch(err) {
            return exp;
         }
       });
     return text;
   }
 , quadreg:function(x, y) {
         var a0 = 1,
             a1 = 0,
             a2 = 0,
             a3 = 0,
             a4 = 0,
             b0 = 0,
             b1 = 0,
             b2 = 0,
             m,
             n = x.length,
             ma=0, mb=0, mc=0,
             d,xx;
         if (n != y.length) return [0,0,0]; // no solution
         for (m=0; m<n; m++) {
              xx = x[m], yy = y[m];
              a1 += xx; xx *= x[m];
              a2 += xx; xx *= x[m];
              a3 += xx; xx *= x[m];
              a4 += xx; xx  = x[m];
              b0 += yy;
              b1 += yy * xx;
              b2 += yy * xx * xx;
         }
         //console.log("Quadreg=",a1,a2,a3,a4,b0,b1,b2);
         a1 /= n; a2 /= n; a3 /= n; a4 /= n;
         b0 /= n; b1 /= n; b2 /= n;
         //console.log("Quadreg=",a1,a2,a3,a4,b0,b1,b2);
         d  = a0 * (a2 * a4 - a3 * a3) - a1 * (a1 * a4 - a2 * a3) + a2 * (a1 * a3 - a2 * a2);
         ma = b0 * (a2 * a4 - a3 * a3) + b1 * (a2 * a3 - a1 * a4) + b2 * (a1 * a3 - a2 * a2);
         mb = b0 * (a2 * a3 - a1 * a4) + b1 * (a0 * a4 - a2 * a2) + b2 * (a1 * a2 - a0 * a3);
         mc = b0 * (a1 * a3 - a2 * a2) + b1 * (a2 * a1 - a0 * a3) + b2 * (a0 * a2 - a1 * a1);
         //console.log("Quadreg=",d,mc,mb,ma);
         ma /= d; mb /= d; mc /= d;
         //console.log("Quadreg=",mc,mb,ma);
         return [mc,mb,ma];
     }
 , linreg:function(values_x, values_y) {
      var sum_x = 0,
          sum_y = 0,
          sum_xy = 0,
          sum_xx = 0,
          count = 0,
          x = 0,
          y = 0,
          values_length = values_x.length;
      if (values_length != values_y.length) {
          throw new Error('The parameters values_x and values_y need to have same size!');
      }
      if (values_length === 0) {
          return [ 0,0 ];
      }

      for (var v = 0; v < values_length; v++) {
          x = +values_x[v];
          y = +values_y[v];
          sum_x += x;
          sum_y += y;
          sum_xx += x*x;
          sum_xy += x*y;
          count++;
      }

      var m = (count*sum_xy - sum_x*sum_y) / (count*sum_xx - sum_x*sum_x);
      var b = (sum_y/count) - (m*sum_x)/count;
      return [m,b];
    }
  , getprime:function() {
       //returns a random prime between 41 and 1601
       var n = Math.floor(Math.random()*40);
       return n*n+n+41;
   }
  , isprime:function(n) {
     if (isNaN(n) || !isFinite(n) || n%1 || n<2) return false;
         if (primes1000.indexOf(n) >= 0) return true;
     if (n==qz.leastfactor(n)) return true;
     return false;
    }
  , getnthprime:function(n) {
        n = Math.min(1000,n);
        return primes1000[n];
    }

  , factor:function(n) {
      var doLoop = 1 < n && isFinite(n);
      var facts = [];
      while (doLoop) {
          var f = qz.leastfactor(n);
          facts.push(f);
          n /= f;
          doLoop = (f !== n);
      }
      return facts;
    }

  , leastfactor:function(n) {
      if (isNaN(n) || !isFinite(n)) return NaN;
      if (n==0) return 0;
      if (n%1 || n*n<2) return 1;
      if (n%2==0) return 2;
      if (n%3==0) return 3;
      if (n%5==0) return 5;
      var m = Math.sqrt(n);
      for (var i=7;i<=m;i+=30) {
       if (n%i==0)      return i;
       if (n%(i+4)==0)  return i+4;
       if (n%(i+6)==0)  return i+6;
       if (n%(i+10)==0) return i+10;
       if (n%(i+12)==0) return i+12;
       if (n%(i+16)==0) return i+16;
       if (n%(i+22)==0) return i+22;
       if (n%(i+24)==0) return i+24;
      }
      return n;
     }

 , powmod:function(a,b,m) {
    if (b < -1) return Math.pow(a, b) % m;
    if (b === 0) return 1 % m;
    if (b >= 1) {
      var result = 1;
      while (b > 0) {
          if ((b % 2) === 1) {
            result = (result * a) % m;
          }
          a = (a * a) % m;
          b = b >> 1;
      }
      return result;
    }
   }
 , modinv:function(a,m) {
     var r = qz.egcd(m,a);
     return (r[2]+m) % m;
   }

 , phi:function(n) {   // eulers phi function (totient)
    var f = qz.factor(n);
    f.pop();  // drop 1
    var u = _.uniq(f);
    var r = _.reduce(u,function(res,num) { return res*(1-1/num);},n);
    return r-r%1;
   }

 , egcd:function(a,b) {
    var x = (+b && +a) ? 1 : 0,
        y = b ? 0 : 1,
        u = (+b && +a) ? 0 : 1,
        v = b ? 1 : 0;
    b = (+b && +a) ? +b : 0;
    a = b ? a : 1;
    while (b) {
        var q = Math.floor(a/b);
            r = a % b;
        var m = x - u * q,
            n = y - v * q;
        a = b;
        b = r;
        x = u;
        y = v;
        u = m;
        v = n;
    }
    return [a, x, y];
   }

 , gcd:function(x, y) {
     y = (+x && +y) ? +y : 0;
     x = y ? x : 1;
     while (y) {
          var z = x % y;
          x = y;
          y = z;
     }
     return x;
   }
 , normal:function(mean, deviation) {
     if (arguments.length < 2) deviation = 1;
     if (arguments.length < 1) mean = 0;
     return function() {
        var x, y, r;
        do {
          x = Math.random() * 2 - 1;
          y = Math.random() * 2 - 1;
          r = x * x + y * y;
        } while (!r || r > 1);
        return mean + deviation * x * Math.sqrt(-2 * Math.log(r) / r);
      };
   }
 , ranlist:function(dist,count) {
     // given a distribution function, returns count list of values
     var v = [];
     for (var i=0; i< count; i++) {
        v.push(dist());
     }
     //console.log("RANLIST ",v);
     return v;
   }
 , freqvalues:function(freq,val) {
     // given a table of frequencies and values [ 3,2,1],[a,b,c]
     // generates list of values [ a,a,a,b,b,c ]
     var v= [];
     if (freq.length != val.length) return v;
     for (var i=0; i<freq.length; i++) {
       var w = val[i];
       var u = freq[i];
       while (u--) {
         v.push(w);
       }
     }
     return v;
 }
 , valfreq:function(val) {
     // given a table of values [ a,a,a,a,b,b,c]
     // generates freq val [4,2,1],[a,b,c]
     v = {};
     for (var i=0; i<val.length; i++) {
       var w = val[i];
       if (!v[w]) v[w] = 0;
       v[w]++;
     }
     var x=[],y=[];
     for (var k in v) {
       x.push(k);
     }
     x.sort(function(a,b) { return (a-b); });
     for (var kx in x) {
       y.push(v[x[kx]]);
     }
     //console.log("VALFREQ ",val.length,x,y);
     return [x,y];
 }
 , quantile:function(values, p) {
     var H = (values.length - 1) * p + 1,
               h = Math.floor(H),
               v = values[h - 1],
               e = H - h;
       return e ? v + e * (values[h] - v) : v;
 }
 , alist:function(lo,hi,num) {  // random list of numbers
   // numbers may repeat
   var list = [];
   for (var i=0; i<num; i++) {
     var kand = Math.floor(lo + Math.random()*(hi+1-lo))
     list.push(kand);
   }
   return list;
 }
 , shuffle:function(arr) {
   for (var i=arr.length-1; i>0; i--) {
     var j = Math.round(Math.random()*i);
     var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
   }
   return arr;
 }
 , range:function(lo,hi,step) {
   // range(1,10,1) => [1,2,3,4,5,6,7,8,9]
   // range(1,4,0.1) => [1.0, 1.1, 1.2, 1.3 .. 3.9]
   step = typeof(step) != 'undefined' ?  +step : 1;
   step = (step == 0 || isNaN(step)) ? 1 : step;
   var list = [], i=lo;
   if (hi <= lo) return list;
   while (i<hi) {
     list.push(qz.round(i,2)); i+=step;
   }
   return list;
 }
 , roll:function(lo,hi) {
     if (lo == undefined) {
         return Math.random();
     }
     if (hi == undefined) {
         hi = lo; lo = 1;
     }
     return Math.floor(Math.random() * (1+hi-lo))+lo;
 }
 , fix:function(arr,p) {
   // maps all numbers to fixed
   return arr.map(function(n) { var nn = new Number(n); return nn.toFixed(p); });
 }
 , poly:function(clist,v) {
   //  L,v => f(v) => Number
   // given a list of consts will return a polynom in variable v
   // as a function of v
   //  1,2,3 =>  (1x+2)x+3 => 1x²+2x+3
   //  1,2,3,4 => ((1x+2)x+3)+4 => 1x³+2x²+3x+4
   var s = clist.shift()+'*'+v + '+' + clist.shift();
   while (clist.length > 0) {
      var c = clist.shift();
      s = '('+s+')*'+v+'+'+c;
   }
   //console.log(s);
   var f = new Function(v,'return '+s);
   return { fu:f, txt:s };
 }
 , round:function(x,p) {
    // we really dont want 1.2000000000001
    var tmp =  Math.round(x*Math.pow(10,p))/Math.pow(10,p);
    var str = ""+tmp;
    if (str.indexOf('.') >= 0) {
      // we have a decimal point
      tmp = tmp.toFixed(p);
    }
    return tmp;
 }
 , rlist:function(lo,hi,num) {  // random list of numbers
   // only one instance of any given number in the list
   var list = [];
   num = Math.min(num,hi+1-lo);
   for (var i=0; i<num; i++) {
     var maxiter = 70;
     do {
       var kand = Math.floor(lo + Math.random()*(hi+1-lo))
       maxiter --;
     } while (list.indexOf(kand) >= 0 && maxiter > 0 );
     list.push(kand);
   }
   return list;
 }
 , generateParams:function(question,userid,instance,container,stripfasit,callback) {
     // stripfasit is true if fasit is off
     var u = 'niu';
     symb = { a:u, b:u, c:u, d:u, e:u, f:u, g:u, h:u, i:u, j:u, k:u, l:u, m:u, n:u, o:u,
              p:u, q:u, r:u, s:u, t:u, u:u, v:u, w:u, x:u, y:u, z:u,
              A:u, B:u, C:u, D:u, E:u, F:u, G:u, H:u, I:u, J:u, K:u, L:u, M:u, N:u, O:u,
              P:u, Q:u, R:u, S:u, T:u, U:u, V:u, W:u, X:u, Y:u, Z:u
       , random:Math.random, floor:Math.floor
       , pow:Math.pow
       , abs:Math.abs
       , fix:qz.fix
       , getprime:qz.getprime
       , isprime:qz.isprime
       , factor:qz.factor
       , leastfactor:qz.leastfactor
       , getnthprime:qz.getnthprime
       , modinv:qz.modinv
       , powmod:qz.powmod
       , egcd:qz.egcd
       , phi:qz.phi
       , gcd:qz.gcd
       , gammaln: jstat.gammaln
       , gammafn: jstat.gammafn
       , gammap: jstat.gammap
       , factorialln: jstat.factorialln
       , factorial: jstat.factorial
       , combination: jstat.combination
       , combinationln: jstat.combinationln
       , permutation: jstat.permutation
       , betafn: jstat.betafn
       , betaln: jstat.betaln
       , betacf: jstat.betacf
       , gammapinv: jstat.gammapinv
       , erf: jstat.erf
       , erfc: jstat.erfc
       , erfcinv: jstat.erfcinv
       , ibetainv: jstat.ibetainv
       , ibeta: jstat.ibeta
       , randn: jstat.randn
       , randg: jstat.randg
       , quantile:qz.quantile
       , freqvalues:qz.freqvalues
       , valfreq:qz.valfreq
       , normal:qz.normal
       , ranlist:qz.ranlist
       , range:qz.range
       , roll:qz.roll
       , shuffle:qz.shuffle
       , round:qz.round
       , poly:qz.poly
       , linreg:qz.linreg
       , quadreg:qz.quadreg
       , rlist:qz.rlist
       , alist:qz.alist
       , con:{}
       , dice:{}
       , quizbase:db.quizbase
     };  // remove symbols from prev question
     if (qz.containers[container] && qz.containers[container][userid] ) {
       // we have symbols for the container
       // use these as defaults
       // must copy so we don't change originals
       var base = qz.containers[container][userid];
       symb = {};
       for (var attr in base) {
          if (base.hasOwnProperty(attr)) symb[attr] = base[attr];
       }
     } else if (qz.question[container]) {
       // generate symbols for container
       var cq = qz.question[container];  // get from cache
       var cqobj = qz.getQobj(cq.qtext,cq.qtype,cq.id,0);
       qz.doCode(cqobj.code,userid,0); // this is run for the side-effects (symboltabel)
       // make a shallow copy of symbol table
       var copy = {};
       for (var attr in symb) {
          if (symb.hasOwnProperty(attr)) copy[attr] = symb[attr];
       }
       // stash a copy of symbol table for the container
       if (!qz.containers[container]) {
         qz.containers[container] = {};
       }
       qz.containers[container][userid] = copy  ;
     }
     //console.log("symb=",symb);
     var q = qz.question[question.id];  // get from cache
     var qobj = qz.getQobj(q.qtext,q.qtype,q.id,instance);
     qobj.origtext = '' ; // only used in editor
     qz.doCode(qobj.code,userid,instance); // this is run for the side-effects (symboltabel)
        // javascript code
     // we need a callback for running python
     // this might take a while
     // returns immed if no pycode
     qz.doPyCode(qobj.pycode,userid,instance,function() {
       //qobj.origtext = '' ; // only used in editor
       qobj.display = qz.macro(qobj.display);        // MACRO replace #a .. #z with values
       qobj.display = qz.asymp(qobj.display);        // generate graph for ££ draw(graph(x,y,operator ..) ££
       qobj.display = qz.diagram(qobj.display,q.id,instance);    // generate graph for €€ plot(sin(x)) €€
       qobj.display = escape(qobj.display);
       if (question.qtype == 'dragdrop'
           || question.qtype == 'sequence'
           || question.qtype == 'numeric'
           || question.qtype == 'diff'
           || question.qtype == 'fillin' ) {
         qobj.options = qobj.fasit;
       }
       if (qobj.hints != '') qobj.hints = qz.macro(qobj.hints);
       var optcopy = [];  // needed for partial questions abcde
       for (var i in qobj.options) {
         optcopy[i] = qz.macro(qobj.options[i]);  // need to get correct answer for use in multipart abcde
         qobj.options[i] = escape(optcopy[i]);
       }
       qobj.daze = qz.macro(qobj.daze,container);
       qobj.pycode = '';  // remove pycode and code - they are not needed in useranswer
       // only used to generate params susbtituted into display
       qobj.code = '';
       //console.log(qobj);
       switch(question.qtype) {
           case 'dragdrop':
            qobj.options = _.shuffle(qobj.options);
            break;
           case 'textarea':
           case 'fillin':
           case 'numeric':
           case 'textmark':
           case 'diff':
           case 'info':
           case 'sequence':
            break;
           case 'abcde':
            // must remove guidance from options for multipart question
            for (var i in qobj.options) {
                var elements = optcopy[i].split('-||-');
                var questiontxt = elements[0];
                qobj.options[i] = escape(questiontxt);
                qobj.fasit[i] = qz.macro(qobj.fasit[i]);
                qobj.abcde = optcopy;
            }
            break;
           case 'multiple':
            if (qobj.options && qobj.options.length) {
               qobj.optorder = qz.perturbe(qobj.options.length);
               //qobj.fasit = '';   // don't return fasit
               qobj.options = qz.reorder(qobj.options,qobj.optorder);
            }
            break;
           case 'container':
           case 'quiz':
            // stash container symbols for use by contained questions
            if (!qz.containers[container]) {
               qz.containers[container] = {};
            }
            qz.containers[container][userid] = symb  ;
            break;
           default:
            break;
       }
       if (stripfasit) {
           var parts = qobj.display.split(/FASIT/);
           qobj.display = parts[0];
       }
       callback(qobj);
     });

   }
 ,  display: function(qu,options) {
           // takes a question and returns a formatted display text
           options = typeof(options) != 'undefined' ?  options : true;
           var qobj = qz.getQobj(qu.qtext,qu.qtype,qu.id,qu.instance);
           var otxt = qu.qtext.substring(0,100);
           qobj.md5 = crypto.createHash('md5').update(otxt).digest("hex");
           // so that we have easy test to see if two questions are the same
           // can not compare display as quiz-items are replaced with ids dependent on question id
           qobj.origtext = '' ; // only used in editor
           qobj.fasit = [];  // we never send fasit for display
           qobj.cats = {};  // we never send categories for display
           // edit question uses getquestion - doesn't involve quiz.display
           if (!options) {
             // remove options from display
             // they need to be refetched anyway
             // so that params can be used properly
             // this is needed to make dynamic questions
             // where we can instanciate a question several times on a page
             // and get different text/numbers for each instance.
             qobj.options = [];
           }
           qobj.id = qu.id;
           qobj.qtype = qu.qtype;
           qobj.points = qu.points;
           qobj.name = qu.name;
           qobj.status = qu.status;
           qobj.sync = qu.sync;
           qobj.avg = qu.avg;
           qobj.count = qu.count;
           qobj.subject = qu.subject;
           qobj.created = qu.created;
           qobj.modified = qu.modified;
           qobj.parent = qu.parent;
           qobj.pid = qu.pid;
           return qobj;

         }

  , grade: function(contopt,aquiz,aquest,useranswer,param,attnum,hintcount,user,instance,uaid,callback) {
           // takes a question + useranswer + param and returns a grade
           // and possibly a feedback (where needed).
           // param is stored in db, it contains parameters
           // that are needed for displaying and grading the response
           // the question from db may be mangled (reordered etc) so
           // we need info about how its mangled or how dynamic content
           // has been generated
           // contopt - options for this container - sent from user web page
           var feedback = '';  // default feedback
           var overskip = 1;   // move on to next question
           var qobj = qz.getQobj(aquest.qtext,aquest.qtype,aquest.id,aquest.instance);
           var gsymb = {};
           if (contopt && contopt.trinn == "1" && qobj.code && (qobj.code.indexOf('control') >= 0)) {
               //console.log("GRADING -",contopt);
               // control = 1  \n limit = 0.9 assumed to be in code section
               // this question can complete this set of questions if correctly answered
               // so that we can have a _complete_ question (this one)
               // followed by tiny steps questions
               // 1 Calculate P(Z>0.5) for p(Z) ~ N(3,2)  answer:[  ]
               // 2 A dist with mean = 3 and variance = 4 can be made Standard normal
               //   by substituting ( z - mean)/sqrt(var) into standard normal
               // 3 What value will we have for Z>0.5 given mean=3 and var=4
               // 4 Calculate P(Z>0.5)
               // So q1 correctly answered will cause q2,q3,q4 to be correctly answered
               // and student can skip these (reciving full score)
               // failing q1 will open q2 q3 q4 wich will baby-step student to correct solution
               gsymb.limit = 0.9; // grade needed to set completed for all the rest
               gsymb.skip = 0;    // how many questions to mark as completed, 0 => all the remaining
               gsymb.lock = 0;    // this question needs to be answered correctly to continue with remaining
                                 //    used as password/lock
               gsymb.key = '';    // this question depends on key question (may be in other quiz)
               var text = qobj.code.trim();
               if (text != '' ) {
                 var lines = text.split(/\n/);
                 for (var lid in lines) {
                   var exp = lines[lid].trim();
                   if (exp == '' ) {
                       continue ;
                   }
                   if ("limskiplockey".indexOf(exp.substr(0,3)) == -1) continue;
                   // ignore any javascript not related to locking a container
                   try {
                       with(gsymb){ eval('('+exp+')') };
                   } catch(err) {
                           //console.log("EVAL-ERROR err=",err," EXPRESSION=",exp,":::");
                   }
                 }
               }
               //console.log("LOG: symb : ",symb);
           }
           qobj.origtext = '' ; // only used in editor
           var simple = true;   // use the callback at end of function
           // symbolic python does not - callback at end of sympy exe
           var optorder = param.optorder;
           var options = param.options;
           var qgrade = 0;
           var ua;
           var cost = (contopt) ? contopt.attemptcost || 0.1 : 0.1;  // grade cost pr attempt
           var hintcost = (contopt) ? contopt.hintcost || 0.05 : 0.1;  // grade cost pr hint
           var fiib = (contopt) ? contopt.fiidback || 'none' : 'none';
           //console.log("CONTOPT=",contopt);
           useranswer = useranswer.replace(/&lt;/g,'<');
           useranswer = useranswer.replace(/&gt;/g,'>');
           useranswer = useranswer.replace(/&amp;/g,'&');
           try {
             eval( 'ua ='+(useranswer));
           } catch(err) {
           }
           if (!ua) {
             ua = [];
           }
           console.log("USERANSWER=",ua);
           var now = new Date().getTime();
           switch(aquest.qtype) {
             case 'numeric':
                 var fasit = param.fasit;
                 var tot = 0;      // total number of options
                 var ucorr = 0;    // user correct choices
                 var uerr = 0;     // user false choices
                 for (var ii=0,l=fasit.length; ii < l; ii++) {
                   var feedb = '-';  // mark as failed
                   var uatxt =  ua[ii];
                   tot++;
                   var ff = unescape(fasit[ii]);
                   if (uatxt == undefined) {
                      uerr++;
                   } else if (ff.toLowerCase() == uatxt.toLowerCase()  ) {        // MARK: exact answer
                     ucorr++;
                     feedb = '1';  // mark as correct
                   } else {
                     var swi = ff.substr(0,4);  // check for nor: sym: eva: reg: lis:
                     var tch = ff.substr(4);    // remainder after removing prefix
                     var num = +ff;             // get numeric value
                     var tol = 0.0000001;       // default tolerance
                     var uanum = uatxt.replace(',','.') ;  // user input 3,141 => 3.14
                     uanum = +uanum;       // numeric value of user input
                     gradenumeric();
                   }
                   if (fiib != 'none') feedback += feedb;
                 }
                 //console.log(fasit,ua,'tot=',tot,'uco=',ucorr,'uer=',uerr);
                 if (tot > 0) {
                   qgrade = (ucorr - uerr/6) / tot;
                 }
                 qgrade = Math.max(0,qgrade);
                 break;
             case 'abcde':
                 console.log("ABCDE ",param.fasit,param.abcde,ua,attnum);
                 //var answers = param.abcde;
                 var fasit = param.fasit;
                 var tot = 0;      // total number of options
                 var ucorr = 0;    // user correct answers
                 var uerr = 0;     // user false answers
                 var doskip = false; // no skip so far
                 var upskip = false;
                 var skip = 0;       // skip so far
                 for (var ii=0,l=fasit.length; ii < l; ii++) {
                   var feedb = '-';  // mark as failed
                   var cdiff = ucorr;
                   var memer = uerr;
                   var uatxt =  ua[ii];
                   //var elements = answers[ii].split('-||-');
                   var ff = fasit[ii];
                   var swi = ff.substr(0,4);  // check for nor: sym: eva: reg: lis:
                   var tch = ff.substr(4);    // remainder after removing prefix
                   var num = +ff;             // get numeric value
                   var tol = 0.0000001;       // default tolerance
                   var uanum = uatxt.replace(',','.') ;  // user input 3,141 => 3.14
                   uanum = +uanum;       // numeric value of user input
                   tot++;
                   if (doskip && skip > 0 && ii > attnum) {
                     var cor =  gradenumeric();
                     uerr = memer;
                     ucorr = cdiff;
                     ua[ii] = cor;
                     uatxt =  ""+ua[ii];
                     uanum = uatxt.replace(',','.') ;  // user input 3,141 => 3.14
                     uanum = +uanum;       // numeric value of user input
                     cor =  gradenumeric();
                     console.log("Changed useranswer to ",ua," skip=",skip,tot,ucorr);
                     skip--;
                     if (skip < 1) doskip = false;
                     if (fiib != 'none') feedback += feedb;
                     continue;
                   }
                   if (uatxt == undefined) {
                      uerr++;
                   } else if (ff.toLowerCase() == uatxt.toLowerCase()  ) {        // MARK: exact answer
                     ucorr++;
                     feedb = '1';  // mark as correct
                   } else {
                     var cor =  gradenumeric();
                   }
                   if (ucorr - cdiff == 1) {
                         // correct answer last question
                         console.log("Correct last qp:",attnum,ii,param.abcde);
                         if (attnum == ii) {
                            var elements = param.abcde[ii].split('-||-');
                            skip = +elements[3] || 0;
                            if (skip > 0) {
                              doskip = true;
                              overskip = skip+1;
                            }
                         }
                   }
                   if (fiib != 'none') feedback += feedb;
                 }
                 if (tot > 0) {
                   qgrade = (ucorr) / tot;
                   console.log("Calculated score = ",qgrade);
                 }
                 qgrade = Math.max(0,qgrade);
                 break;
             case 'textarea':
             case 'fillin':
                 //var fasit = qobj.fasit;
                 var fasit = param.fasit;
                 var tot = 0;      // total number of options
                 var ucorr = 0;    // user correct choices
                 var uerr = 0;     // user false choices
                 for (var ii=0,l=fasit.length; ii < l; ii++) {
                   tot++;
                   var feedb = '-';  // mark as failed
                   var ff = unescape(fasit[ii]);
                   var fasil = ff.split(',');
                   if (ff == ua[ii] || fasil.indexOf(ua[ii]) >= 0 ) {
                     ucorr++;
                     feedb = '1';  // mark as correct
                   } else {
                     // first do a check using fasit as a regular expression
                     //console.log("trying regexp");
                     try {
                       var myreg = new RegExp('('+ff+')',"gi");
                       var isgood = false;
                       ua[ii].replace(myreg,function (m,ch) {
                             isgood = (m == ua[ii]);
                             //console.log("m ch:",m,ch);
                           });
                       if ( isgood) {
                         ucorr++;     // good match for regular expression
                         feedb = '1';  // mark as correct
                       } else if (ua[ii] != undefined && ua[ii] != '' && ua[ii] != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                         uerr++;
                       }
                     }
                     catch (err) {
                       if (ua[ii] != undefined && ua[ii] != '' && ua[ii] != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                         uerr++;
                       }
                     }
                   }
                   if (fiib != 'none') feedback += feedb;
                 }
                 //console.log(fasit,ua,'tot=',tot,'uco=',ucorr,'uer=',uerr);
                 if (tot > 0) {
                   qgrade = (ucorr - uerr/6) / tot;
                 }
                 qgrade = Math.max(0,qgrade);
               break;
             case 'diff':
                 var fasit = param.fasit;
                 var tot = 0;      // total number of options
                 var ucorr = 0;    // user correct choices
                 var uerr = 0;     // user false choices
                 feedback = '';
                 for (var ii=0,l=fasit.length; ii < l; ii++) {
                   tot++;
                   var ff = unescape(fasit[ii]);
                   if (ff == ua[ii] ) {
                     ucorr++;
                   } else {
                     //try {
                       var codeA = prep(ff);
                       var codeB = prep(ua[ii]);
                       var cdiff = jdiff.diffString2(codeA,codeB,contopt.fiidback);
                       feedback += cdiff.diff+'<br>';
                       ucorr += cdiff.similar;
                     //} catch(err) {
                     //  console.log("parse err");
                     //  feedback = 'feil';
                     //}
                   }
                 }
                 if (tot > 0) {
                   qgrade = ucorr / tot;
                 }
                 qgrade = Math.max(0,qgrade);
               break;
             case 'sequence':
                 // adjustment for orderd sequence
                 var adjust =  {   2 : 0.51,  3 : 0.5,   4 : 0.38,  5 : 0.35,
                                   6 : 0.38,  7 : 0.38,  8 : 0.32,  9 : 0.32,
                                  10 : 0.34, 11 : 0.34, 12 : 0.3,  13 : 0.3,
                                  14 : 0.31, 15 : 0.32, 16 : 0.28, 17 : 0.28,
                                  18 : 0.26, 19 : 0.26, 20 : 0.24, 21 : 0.24,
                                  22 : 0.22, 23 : 0.22, 24 : 0.21, 25 : 0.21,
                                  26 : 0.2,  27 : 0.19, 28 : 0.18, 29 : 0.18,
                                  30 : 0.17, 31 : 0.17, 32 : 0.16, 33 : 0.16,
                                  34 : 0.16, 35 : 0.16, 36 : 0.14, 37 : 0.15,
                                  38 : 0.14, 39 : 0.14, 40 : 0.13, 41 : 0.14,
                                  42 : 0.13, 43 : 0.13, 44 : 0.12, 45 : 0.13,
                                  46 : 0.12, 47 : 0.12, 48 : 0.11, 49 : 0.11,
                                  50 : 0.11, 51 : 0.11, 52 : 0.1, 53 : 0.1,
                                  54 : 0.1,  55 : 0.1, 56  : 0.1, 57 : 0.1,
                                  58 : 0.1,  59 : 0.1, 60  : 0.09,
                                  61 : 0.09, 62 : 0.09, 63 : 0.09 };

                 var fasit = param.cats;
                 var tot = 0;  // total number of options
                 var daze = (qobj.daze) ? qobj.daze.split(',').length :  0;  // fake options
                 var ucorr = 0;    // user correct choices
                 var uerr = 0;     // user false choices
                 var idx;
                 for (var ii=0,l=fasit.length; ii < l; ii++) {
                   tot += fasit[ii].length;
                 }
                 feedback = [];
                 for (var ii=0,l=ua.length; ii < l; ii++) {
                   feedback[ii] ={ inv:{}, seq:{},inorder:{},reverse:{} };
                   if (ua[ii]) {
                     var mytot = fasit[ii].length;
                     var myuco = 0;
                     var myuer = 0;
                     if (param.catnames[ii].charAt(0) == '+') {
                       // this sequence is ordered
                       // we check the sequence and also the reversed sequence
                       // first we make a reverse lookup list
                       var idlist = {};
                       for (var jj=0; jj < mytot; jj++) {
                         var elm = fasit[ii][jj];
                         idlist[elm] = jj;
                       }
                       var w = Math.min(4,Math.max(1,Math.floor(mytot/2)));
                         // width of sequence
                       var pr = -1;  // prev value
                       var seq = 0;  // score for sequence  a,b,c,d,e,f
                       var inv = 0;  // score for inverse sequence  f,e,d,c,b,a
                       var idx;      // idx we should have for this element
                       var dscore,rdscore;
                       var inorder = 0;
                       var reverse = 0;
                       for (var jj=0,jl=ua[ii].length; jj < jl; jj++) {
                         var ff = unescape(ua[ii][jj]);
                         idx = idlist[ff];
                         if (idx == undefined) idx = -999;
                         dscore = 1 - Math.min(w,Math.abs(jj-idx))/w;
                         rdscore = 1 - Math.min(w,Math.abs(mytot-jj-idx))/w;
                         feedback[ii].inv[jj] = 0;
                         feedback[ii].seq[jj] = 0;
                         if (idx == pr + 1) {
                           seq++;
                           feedback[ii].seq[jj] = 1;
                         }
                         if (idx == pr - 1) {
                           inv++;
                           feedback[ii].inv[jj] = 1;
                         }
                         pr = idx;
                         inorder += dscore;
                         reverse += rdscore;
                         feedback[ii].inorder[jj] = dscore;
                         feedback[ii].reverse[jj] = rdscore;
                       }
                       if (inv > seq) {
                         inorder = reverse * 0.9;
                         seq = inv;
                         feedback[ii].inorder = feedback[ii].reverse;
                       }
                       feedback[ii].order = inorder;
                       feedback[ii].sequ = seq;
                       myuco = (inorder+seq)/2;
                       if (mytot > 0.45 * (tot+daze)) {
                         // this sequence is a large part of this question
                         // we dont need adjustment if we have many small sequences
                         // as then its hard placing an element in the correct sequence
                         // in the first place - getting the order right is simple addon
                         var adj = adjust[Math.min(63,mytot+daze)] * mytot;
                         feedback[ii].adj = adj;
                         //console.log(myuco,adj);
                         myuco = myuco*Math.max(0,(myuco-adj)/(mytot-adj));
                         feedback[ii].myuco = myuco;
                       } else {
                         feedback[ii].myuco = myuco;
                         feedback[ii].adj = 0;
                       }
                     } else {
                       for (var jj=0,jl=ua[ii].length; jj < jl; jj++) {
                         var ff = unescape(ua[ii][jj]);
                         if (fasit[ii].indexOf(ff) >= 0) {
                           feedback[ii].seq[jj] = 1;
                           myuco++;
                         } else {
                           myuer++;
                         }
                       }
                       feedback[ii].myuco = myuco;
                       feedback[ii].myuer = myuer;
                       feedback[ii].adj = 0;
                     }
                   }
                   //console.log("UERR,UCORR",myuer,myuco,tot,adj,mytot,fasit);
                   uerr += myuer;
                   ucorr += myuco;
                 }
                 if (tot > 0) {
                   qgrade = (ucorr - uerr/6) / tot;
                 }
                 qgrade = Math.max(0,qgrade);
                 feedback = JSON.stringify(feedback);
               break;
             case 'textmark':
             case 'info':
             case 'dragdrop':
                 //var fasit = qobj.fasit;
                 var fasit = param.fasit;
                 var tot = 0;      // total number of options
                 var ucorr = 0;    // user correct choices
                 var uerr = 0;     // user false choices
                 for (var ii=0,l=fasit.length; ii < l; ii++) {
                   var ff = unescape(fasit[ii]);
                   if (ff == ' ' ) {
                     // blank fields dont count - unless you place something on them
                     if (ua[ii] == undefined || ua[ii] == '' || ua[ii] == '&nbsp;&nbsp;&nbsp;&nbsp;') {
                         continue;
                     }
                   }
                   tot++;
                   // ignore blank bokses - so we can have place one item in correct position
                   var fasil = ff.split(',');
                   if (ff == ua[ii] || fasil.indexOf(ua[ii]) >= 0 ) {
                     ucorr++;
                   } else {
                     if (ua[ii] != undefined && ua[ii] != '' && ua[ii] != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                       uerr++;
                     }
                   }
                 }
                 //console.log(fasit,ua,'tot=',tot,'uco=',ucorr,'uer=',uerr);
                 if (tot > 0) {
                   qgrade = (ucorr - uerr/6) / tot;
                 }
                 qgrade = Math.max(0,qgrade);
               break;
             case 'multiple':
                 //console.log(qobj,useranswer);
                 var fasit = qz.reorder(qobj.fasit,optorder);
                 var tot = 0;      // total number of options
                 var totfasit = 0; // total of choices that are true
                 var ucorr = 0;    // user correct choices
                 var uerr = 0;     // user false choices
                 var utotch = 0;   // user total choices - should not eq tot
                 for (var ii=0,l=fasit.length; ii < l; ii++) {
                   var truthy = (fasit[ii] == '1');
                   tot++;
                   if (ua[ii]) utotch++;
                   if (truthy) totfasit++;
                   if (ua[ii] && truthy ) {
                     ucorr++;
                   } else if(!truthy  && ua[ii] ) {
                     uerr++;
                   }
                 }
                 //console.log('tot=',tot,'fasit=',totfasit,'uco=',ucorr,'uer=',uerr);
                 if (totfasit > 0) {
                   qgrade = (ucorr - uerr / 3) / totfasit;
                 }
                 if (utotch == tot) {
                   qgrade = 0;    // all options checked => no score
                 }
                 qgrade = Math.max(0,qgrade);
               break;
             case 'info':
               break;
             default:
               break;
           }
           if (simple) {  // only symbolic math is not simple
             var adjust;
             if (aquest.qtype == 'abcde') {
                 // no penalty for multiple attempts on this type
                 // its the point to grade each subquestion separatly
                 adjust = qgrade;
             } else {
                 var cutcost = (attnum > 2) ? Math.min(1,cost*attnum*2) : cost*attnum;
                 adjust = qgrade * (1 - cutcost - hintcost*hintcount);
             }
             //console.log(qgrade,adjust,attnum,cost);
             qgrade = aquest.points * Math.max(0,adjust);
             var completed = { comp:0, lock:0 };
             console.log("GSYMB=",gsymb);
             if (gsymb.lock && gsymb.limit && gsymb.limit <= qgrade) {
               completed.lock = 1;
             }
             if (gsymb.key) {
                 // this question is unanswerable until question aa:bb is answered
                 //   in container aa there is a question with name bb
                 //   if this has a score > 0 then accept answer
                 completed.lock = 1;
                 var keyel = gsymb.key.split(':');
                 var cname = keyel[0];
                 var qname = keyel[1] || '';
                 feedback = 'Must complete: '+gsymb.key+' (container:question)';
                 var sql = 'select  u.score,u.id,c.name from quiz_question q inner join quiz_useranswer u on (q.id = u.qid) '
                        +  ' inner join quiz_question c on (u.cid = c.id) where q.name=$1 and c.name=$2 and u.userid=$3';
                client.query( sql,[ qname,cname,user.id],
                  after(function(res) {
                      var score = 0;
                      if (res && res.rows) {
                        var uan = res.rows[0];
                        console.log("TESTING KEY",feedback);
                        if (uan && (uan.id == uaid && qgrade > 0 || uan.score > 0)) {
                            score = qgrade;
                            completed.lock = 0;
                            feedback = '';
                        }
                      }
                      callback(score,feedback,completed,ua,1);

                  }));
             } else {
                 if (gsymb.limit && gsymb.limit <= qgrade) {
                  var tempq = parseJSON(aquiz.qtext);
                  var skip = gsymb.skip ? gsymb.skip : tempq.qlistorder.length;
                  remaining = tempq.qlistorder.slice(instance+1,instance+skip+1);
                  console.log("UNLOCK ALL",instance,remaining,tempq.qlistorder);
                  completed.comp = 1;
                  client.query( "update quiz_useranswer set score = 1,attemptnum = 1 "
                              + " where qid != $3 and cid=$1 and userid=$2 and qid in (" + remaining.join(',')+ ')',
                                    [aquiz.id, user.id,aquest.id ] );
                 }
               callback(qgrade,feedback,completed,ua,overskip);
             }
           }

          // returns the correct answer
          function gradenumeric() {
                 //var fasit = qobj.fasit;
                 // for numeric the fasit is a template like this
                 //   33.13:0.5         the answer is 33.13 +- 0.5
                 //   32.0..33.5        the answer must be in the interval [32.0,33.5]
                 //   nor:m,s           the answer x is scored as e^-((1/(2) * ((x-m)/s)^2
                 //   sym:exp           the answer x is scored as pycas(x - exp) == 0
                 //   eva:exp|a|b       the answer x is scored as eval(x) == exp
                 //   zro:exp|a         the answer x is correct if |exp(x)| < a
                 //   reg:r             the answer x is scored as regular exp match for x,r
                 //   lis:a:A,b:B,c     the answer x is scored as  x == one of a,b,c - score is given by :A or 1
                 var cor = ff;
                     switch (swi) {
                       case 'nor:':
                         var norm = tch.split(',');
                         var med = +norm[0];
                         var std = +norm[1];
                         var ex = ((uanum - med)/std);
                         var sco = Math.pow(2.712818284,-(0.5*ex*ex));
                         if (sco > 0.05) {
                           ucorr += sco;
                           feedb = Math.floor((1-sco)*10);
                         } else {
                           uerr++;
                         }
                         cor = med;
                         break;
                       case 'rng:':    // [[rng:10,20]]
                         var lims = tch.split(',');
                         var lo = +lims[0];
                         var hi = +lims[1];
                         if (uanum >= lo && uanum <= hi) {
                           ucorr += 1;
                           feedb = 1;
                         } else {
                           uerr++;
                         }
                         cor = lo;
                         break;
                       case 'sym:':
                          simple = false;  // callback done after sympy is finished
                                 // fixup for 3x => 3*x etc
                          var completed = { comp:0, lock:0 };
                          if (uatxt == undefined || uatxt == '') {
                            callback(score,'no input',completed,ua);
                          } else {
                               var elem = tch.split('|');
                               var target = elem[0];
                               var differ = elem[1]; // optional text that useranswer must NOT EQUAL
                               // for symbolic equality - dont accept original equation
                               // or new eq that is longer (not simpler)
                               if (differ && (differ == uatxt  || differ.length < uatxt.length)  ) {
                                  callback(score,'sicut prius',completed,ua);
                               } else {
                                   var ufu  =   sympify(target);   // fasit
                                   cor = ufu;
                                   var fafu =   sympify(uatxt);    // user response
                                   var diffu =  sympify(differ);   // if testing equality - must be as short or shorter than this
                                   var intro = '# coding=utf-8\n'
                                         + 'from sympy import *\n';
                                   var text = 'x,y,z,a,b,c,d,e,f,u,v,w = symbols("x,y,z,a,b,c,d,e,f,u,v,w")\n'
                                         +   'a1=sympify("'+ufu+'")\n'
                                         +   'b1=sympify("'+fafu+'")\n'
                                         +   'c1=a1-b1\n'
                                         +   'print simplify(c1)\n';
                                   var score = 0;
                                   console.log(intro+text);
                                   fs.writeFile("/tmp/symp"+now, intro+text, function (err) {
                                     if (err) { callback(score,'error1',completed,ua); throw err; }
                                      try {
                                       var child = exec("/usr/bin/python /tmp/symp"+now, function(error,stdout,stderr) {
                                         fs.unlink('/tmp/symp'+now);
                                         //console.log("err=",stderr,"out=",stdout,"SOO");
                                         if (error) {
                                           console.log(error,stderr);
                                           callback(score,'error2',completed,ua);
                                         } else {
                                           if (stdout && stdout != '') {
                                             //console.log(stdout);
                                             var feedb = stdout;
                                             var eta = +stdout.trim();
                                             if (_.isFinite(eta) && eta == 0 || Math.abs(eta) < 0.001 ) {
                                               score = 1
                                               if (differ) {
                                                 // we are testing for simplification
                                                 // minimum assumed to be ufu, diffu.length is original length (unsimplified)
                                                 var span = diffu.length - ufu.length; // max shortening possible
                                                 var dif  = fafu.length - ufu.length;  // how much shorter
                                                 if (span > 0) {
                                                   score = Math.max(0,Math.min(1,1-dif/span));
                                                   // relative score depending on how many chars
                                                   // you have shortened the eq - span assumed to be max
                                                   feedb = (score > 0.8) ? 'Good answer' : (score > 0.5) ?  'Nearly' : 'Not quite';
                                                 }
                                               } else {
                                                   feedb = 'Correct answer';
                                               }
                                             } else {
                                               feedb = 'Incorrect answer';
                                               score = 0;
                                             }
                                             var cutcost = (attnum > 2) ? Math.min(1,cost*attnum*2) : cost*attnum;
                                             var adjust = score * (1 - cutcost - hintcost*hintcount);
                                             //console.log(qgrade,adjust,attnum,cost);
                                             score = aquest.points * Math.max(0,adjust);
                                           }
                                           //console.log("CAME SO FAR SYMBOLIC PYTHON ",eta,score,stdout,stderr,error);
                                           callback(score,feedb,completed,ua);
                                         }
                                       });
                                     } catch(err) {
                                           callback(score,'error3',completed,ua);
                                     }
                                   });
                               }
                          }
                         break;
                       case 'zro:':
                         //   zro:exp|a      the answer x is correct if |exp(x)| < a
                         var elem = tch.split('|');
                         var exp = elem[0];
                         var tol = elem[1] || 0.001 ;
                         var sco = 0;
                         exp = normalizeFunction(exp,0,ua);
                         var num = +uatxt;
                         if (uatxt != undefined && uatxt != '' && uatxt != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                            // user supplied root checked
                            console.log("Checking if root:",uatxt,exp);
                            var bad = false;
                            try {
                               var fu1 = new Function("x",' with(Math) { return ' +exp+'; }' );
                               var f1 = Math.abs(fu1(num));
                               console.log("Evalueated to ",f1,tol)
                               if (f1 <= tol) {
                                   sco = 1;
                                   feedb = '1';  // mark as correct
                               } else {
                                   bad = true;
                               }
                             }
                             catch (err) {
                                 console.log("EVAL fu ",err);
                                 bad = true;
                             }
                             if (bad) {
                               uerr++;
                             } else {
                               ucorr += sco;
                             }
                           }
                           cor = 'NaN';
                         break;
                       case 'eva:':
                         //   eva:exp|a|b      the answer x is scored as eval(x) == exp
                         //   the user answer must NOT EQUAL a,
                         //       Quiz: multiply (x+6) by 2, do not accept 2*(x+2)
                         //       eva:2x+12|2(x+6)
                         //   the answer should be as short as b (punished for extra chars - up to a.length)
                         //   simplify (2+4)*(7-5)
                         //     eva:12|(2+4)*(7-5)|12
                         //     so the constraints are : evaluate as 12, not eq "(2+4)*(7-5)" , as short as 12
                         //          partial score if between "12" and "(2+4)*(7-5)" in length
                         var elem = tch.split('|');
                         var exp = elem[0];
                         var differ = elem[1]; // optional text that useranswer must NOT EQUAL
                         var simply = elem[2]; // optional text that useranswer should match in length
                         var lolim =  -5;
                         var hilim =   5;
                         var sco = 0;
                         exp = normalizeFunction(exp,0,ua);
                         cor = exp;
                         var ufu = normalizeFunction(uatxt,0);
                         var udiff =normalizeFunction(differ,0);
                         //console.log(exp,lolim,hilim,ufu);
                         if (differ && (differ == uatxt || udiff == ufu) ) {
                            uerr++;
                            console.log("sicut prius");
                         } else if (exp == ufu) {
                            ucorr++;     // good match for regular expression
                            feedb = '1';  // mark as correct
                            console.log("exact");
                         } else {
                           console.log("EVA:",exp,ufu);
                           if (uatxt != undefined && uatxt != '' && uatxt != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                             // user supplied function numericly tested against fasit
                             // for x values lolim .. hilim , 20 steps
                             var dx = (+hilim - +lolim) / 20;
                             var bad = false;
                             try {
                               //return 'with(Math) { return ' + fu + '; }';
                               var fu1 = new Function("x",' with(Math) { return ' +exp+'; }' );
                               var fu2 = new Function("x",' with(Math) { return ' +ufu+'; }' );
                               var reltol,f1,f2;
                               for (var pi=0,xi = lolim; pi < 20; xi += dx, pi++) {
                                   console.log("testing with ",xi);
                                   f1 = fu1(xi);
                                   f2 = fu2(xi);
                                   if (!isFinite(f1) && !isFinite(f2)) {
                                     reltol = 0;
                                     //console.log("NaN/inf",xi,reltol);
                                   } else {
                                     reltol = f1 ? Math.abs(f1-f2)/Math.abs(f1) : Math.abs(f1-f2);
                                   }
                                   //console.log(xi,f1,f2,reltol);
                                   if (reltol > 0.005) {
                                       bad = true;
                                       break;
                                   }
                                   sco += reltol;
                               }
                             }
                             catch (err) {
                                 console.log("EVAL fu ",err);
                                 bad = true;
                             }
                             if (bad) {
                               uerr++;
                             } else {
                               if (simply) {
                                 // we are testing for simplification
                                 // minimum assumed to be simply.length, differ.length is original length (unsimplified)
                                 var span = differ.length - simply.length; // max shortening possible
                                 var dif  = Math.min(span,Math.max(0,differ.length - ufu.length));  // how much shorter
                                 if (span > 0) {
                                   sco = 1 - Math.max(0,Math.min(1,dif/span));
                                   // relative score depending on how many chars
                                   // you have shortened the eq - span assumed to be max
                                 }
                               }
                               ucorr += 1 - sco;
                               feedb = '1';  // mark as correct
                             }
                           }
                         }
                         break;
                       case 'reg:':
                         try {
                           tch = tch.trim();
                           var myreg = new RegExp('('+tch+')',"gi");
                           var isgood = false;
                           uatxt.replace(myreg,function (m,ch) {
                                 console.log("REG:",uatxt,tch,m,ch);
                                 isgood = (m == uatxt);
                               });
                           if ( isgood) {
                             ucorr++;     // good match for regular expression
                             feedb = '1';  // mark as correct
                           } else if (uatxt != undefined && uatxt != '' && uatxt != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                             uerr++;
                           }
                         }
                         catch (err) {
                           console.log("BAD REG EXP",tch);
                           if (uatxt != undefined && uatxt != '' && uatxt != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                             uerr++;
                           }
                         }
                         cor = 'NaN';
                         break;
                       case 'lis:':
                         var goodies = tch.split(',');
                         if (goodies.indexOf(uatxt) > -1) {
                           ucorr++;
                           feedb = '1';  // mark as correct
                         } else if (uatxt != undefined && uatxt  != '' && uatxt  != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                           uerr++;
                         }
                         cor = goodies[0];
                         break;
                       default:
                         var num,tol,cor;
                         cor = ff;
                         console.log("trying numeric",ff,uatxt );
                         if (ff == num) feedb = 1;
                         if ( ff.indexOf(':') > 0) {
                           // we have a fasit like [[23.3:0.5]]
                           var elm = ff.split(':');
                           num = +elm[0];
                           tol = +elm[1];
                           cor = num;
                           //console.log("NUM:TOL",ff,num,tol,uanum);
                         } else if ( ff.indexOf('..') > 0) {
                           // we have a fasit like [[23.0..23.5]]
                           var elm = ff.split('..');
                           var lo = +elm[0];
                           var hi = +elm[1];
                           tol = (hi - lo) / 2;
                           num = lo + tol;
                           cor = num;
                           //console.log("LO..HI",ff,lo,hi,num,tol,uanum);
                         } else {
                             num = +ff; tol = 0.0001;
                         }
                         if ( ff == 'any' || ff == 'anytext' || Math.abs(num - uanum) <= tol) {
                               ucorr++;
                               feedb = '1';  // mark as correct
                         } else if (uatxt != undefined && uatxt  != '' && uatxt  != '&nbsp;&nbsp;&nbsp;&nbsp;') {
                               uerr++;
                         }
                         break;
                     }
                     return cor;
          }
  }
}

module.exports.qz = qz;
