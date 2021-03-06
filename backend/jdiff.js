/*
 * Javascript Diff Algorithm
 *  By John Resig (http://ejohn.org/)
 *  Modified by Chu Alan "sprite"
 *
 * Released under the MIT license.
 *
 * More Info:
 *  http://ejohn.org/projects/javascript-diff-algorithm/
 */

function escape(s) {
    var n = s;
    n = n.replace(/&/g, "&amp;");
    n = n.replace(/</g, "&lt;");
    n = n.replace(/>/g, "&gt;");
    n = n.replace(/"/g, "&quot;");

    return n;
}

exports.diffString = function( o, n ) {
  o = o.replace(/\s+$/, '');
  n = n.replace(/\s+$/, '');
  var count=0,ins=0,del=0;

  var out = exports.diff(o == "" ? [] : o.split(/\s+/), n == "" ? [] : n.split(/\s+/) );
  var str = "";

  var oSpace = o.match(/\s+/g);
  if (oSpace == null) {
    oSpace = ["\n"];
  } else {
    oSpace.push("\n");
  }
  var nSpace = n.match(/\s+/g);
  if (nSpace == null) {
    nSpace = ["\n"];
  } else {
    nSpace.push("\n");
  }

  if (out.n.length == 0) {
      for (var i = 0; i < out.o.length; i++) {
        str += '<del>' + escape(out.o[i]) + oSpace[i] + "</del>";
        del++;
      }
  } else {
    if (out.n[0].text == null) {
      for (n = 0; n < out.o.length && out.o[n].text == null; n++) {
        str += '<del>' + escape(out.o[n]) + oSpace[n] + "</del>";
        del++;
      }
    }

    for ( var i = 0; i < out.n.length; i++ ) {
      if (out.n[i].text == null) {
        str += '<ins>' + escape(out.n[i]) + nSpace[i] + "</ins>";
        ins++;
      } else {
        var pre = "";

        for (n = out.n[i].row + 1; n < out.o.length && out.o[n].text == null; n++ ) {
          pre += '<del>' + escape(out.o[n]) + oSpace[n] + "</del>";
          del++;
        }
        str += " " + out.n[i].text + nSpace[i] + pre;
      }
    }
  }
  var tot = out.o.length;
  var similar = (tot - del) / (tot + ins);
  
  return { diff:str,del:del, ins:ins, similar:similar };
}

function randomColor() {
    return "rgb(" + (Math.random() * 100) + "%, " + 
                    (Math.random() * 100) + "%, " + 
                    (Math.random() * 100) + "%)";
}
exports.diffString2 = function ( o, n, fiidback ) {
  o = o.replace(/\s+$/, '');
  n = n.replace(/\s+$/, '');
  var dw = [];
  var missing = {};
  var aliens = {};


  var out = exports.diff(o == "" ? [] : o.split(/\s+/), n == "" ? [] : n.split(/\s+/) );
  var count=0,ins=0,del=0;

  var oSpace = o.match(/\s+/g);
  if (oSpace == null) {
    oSpace = ["\n"];
  } else {
    oSpace.push("\n");
  }
  var nSpace = n.match(/\s+/g);
  if (nSpace == null) {
    nSpace = ["\n"];
  } else {
    nSpace.push("\n");
  }

  var os = "";
  var colors = new Array();
  for (var i = 0; i < out.o.length; i++) {
      //colors[i] = randomColor();

      if (out.o[i].text != null) {
          os +=  escape(out.o[i].text) + oSpace[i]; 
      } else {
          os += "<del>" + escape(out.o[i]) + oSpace[i] + "</del>";
          dw.push("<del>" + escape(out.o[i]) + oSpace[i] + "</del>");
          del++;
          missing[escape(out.o[i])] = 1;
      }
  }

  var ns = "";
  for (var i = 0; i < out.n.length; i++) {
      if (out.n[i].text != null) {
          ns += escape(out.n[i].text) + nSpace[i] ; 
      } else {
          ns += "<ins>" + escape(out.n[i]) + nSpace[i] + "</ins>";
          dw.push("<ins>" + escape(out.n[i]) + oSpace[i] + "</ins>");
          ins++;
          aliens[escape(out.n[i])] = 1;
      }
  }
  var tot = out.o.length;
  var similar = (tot - del) / (tot + ins);
  var fb = del + ' words missing ' + ins + ' words added of '+tot+' words.';
  var mw = Object.keys(missing);
  var aw = Object.keys(aliens);
  switch (fiidback) {
      case 'lots':
        fb += '<br>' + os + '<hr>' + ns;
        break;
      case 'some':
        fb += '<br>Missing:' + mw.join(' ') + '<br>Remove:' + aw.join(' ');
        break;
  }
  
  return { diff:fb, dw:(dw.join(' ')), del:del, ins:ins, similar:similar };

  //return { o : os , n : ns };
}

exports.diff = function ( o, n ) {
  var ns = new Object();
  var os = new Object();
  
  for ( var i = 0; i < n.length; i++ ) {
    if ( ns[ n[i] ] == null )
      ns[ n[i] ] = { rows: new Array(), o: null };
    ns[ n[i] ].rows.push( i );
  }
  
  for ( var i = 0; i < o.length; i++ ) {
    if ( os[ o[i] ] == null )
      os[ o[i] ] = { rows: new Array(), n: null };
    os[ o[i] ].rows.push( i );
  }
  
  for ( var i in ns ) {
    if ( ns[i].rows.length == 1 && typeof(os[i]) != "undefined" && os[i].rows.length == 1 ) {
      n[ ns[i].rows[0] ] = { text: n[ ns[i].rows[0] ], row: os[i].rows[0] };
      o[ os[i].rows[0] ] = { text: o[ os[i].rows[0] ], row: ns[i].rows[0] };
    }
  }
  
  for ( var i = 0; i < n.length - 1; i++ ) {
    if ( n[i].text != null && n[i+1].text == null && n[i].row + 1 < o.length && o[ n[i].row + 1 ].text == null && 
         n[i+1] == o[ n[i].row + 1 ] ) {
      n[i+1] = { text: n[i+1], row: n[i].row + 1 };
      o[n[i].row+1] = { text: o[n[i].row+1], row: i + 1 };
    }
  }
  
  for ( var i = n.length - 1; i > 0; i-- ) {
    if ( n[i].text != null && n[i-1].text == null && n[i].row > 0 && o[ n[i].row - 1 ].text == null && 
         n[i-1] == o[ n[i].row - 1 ] ) {
      n[i-1] = { text: n[i-1], row: n[i].row - 1 };
      o[n[i].row-1] = { text: o[n[i].row-1], row: i - 1 };
    }
  }
  
  return { o: o, n: n };
}

