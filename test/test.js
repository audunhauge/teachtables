var assert = require("assert");
/*
describe('Array', function(){
  describe('#indexOf()', function(){
    it('should return -1 when the value is not present', function(){
      assert.equal(-1, [1,2,3].indexOf(5));
      assert.equal(-1, [1,2,3].indexOf(0));
    })
  })
})
*/

// question database mockup used for testing
var question = {};
question[123]={ qtext:'{"display":"drop dead #a","code":"a=3","pycode":"","hints":""}',qtype:"info",id:123 };
question[124]={ qtext:'{"display":"sort em [[1]] [[2]] [[3]] [[4]]","fasit":["1","2","3","4"],"code":"","pycode":"","hints":"","daze":"ja"}',qtype:"dragdrop",id:124 };
question[125]={ qtext:'{"display":"sort em [[1]] ","fasit":["1"],"code":"","pycode":"","hints":"","daze":"ja"}',qtype:"dragdrop",id:125 };
question[126]={ qtext:'{"display":"a decimal [[0.667:0.01]], fraction [[eva:2/3]], regular [[reg:2+]], normal [[nor:10,1]], range [[rng:10,20]], expression has zero [[zro:x+2,0.001]],'
			     + ' symbolic [[sym:2a+4b]], list [[lis:1,2,4,7]]"'
			     + ',"fasit":["0.667:0.01","eva:2/3","reg:2+","nor:10,1","rng:10,20","zro:x+2,0.001","sym:2a+4b","lis:1,2,4,7"]'
			     + ',"code":"","pycode":"","hints":"","daze":""}',qtype:"numeric",id:126 };
question[127]={ qtext:'{"display":"simple number [[12]] and a fraction [[eva:2/3]] ","fasit":["12","eva:2/3" ],"code":"","pycode":"","hints":"","daze":""}',qtype:"numeric",id:127 };

var expect = require("chai").expect;

var julian = require("../backend/julian.js");
describe("Julian", function(){
     describe("#greg2jul()", function(){
       it("should convert greg dates to julian number", function(){
           var result = julian.greg2jul(12,12,1990);
           expect(result).to.be.equal(2448238);
       });
   });
     describe("#jdtogregorian()", function(){
       it("should convert julian number to greg date", function(){
           var result = julian.jdtogregorian(2448238);
           expect(result).to.have.a.property("month",12);
           expect(result).to.have.a.property("day",12);
           expect(result).to.have.a.property("year",1990);
       });
   });
});

var rewire = require("rewire");

GLOBAL.siteinf = { client:{ query:function(a,b,c) {
    console.log("QUERY ",a,b);
    if (c != undefined && typeof c === 'function') c();
  }
}, database:{db:null }  };

var constring = '';
var olog = console.log;
function conlog(a,b,c,d) {
  // should handle args  .. cant be arsed
  //console.log(a,b,c,d);
  constring += ""+a+b+c+d;
}

// test backend for grading questions
var quiz = rewire("../backend/quiz.js");
quiz.__set__("console",{ log:conlog});
describe("Quiz", function(){
  describe("#prep()", function(){
    it("should convert actionscript to javascript", function(){
      var result = quiz.__get__("prep")("package { var a:int;var b:Number;}");
      expect(result).to.equal("function package() {\n    var a;\n    var c;\n}");
    });
  });
  describe("#sympify()", function(){
    it("should convert math to symbolic python", function(){
      var result = quiz.__get__("sympify")("2x^2+3(x-2)(x+1)");
      expect(result).to.equal("2*x**2+3*(x-2)*(x+1)");
    });
  });
  describe("#qz", function(){
      var qz = quiz.__get__("qz");
      qz.question = question;        // attach to test base for questions
      describe("#grade", function(){
        it("should give full credit for sequence with newline and comma", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"set in order [[+abc:\\na\\nb,c\\n,d\\ne\\nf]]","code":"","pycode":"","hints":""}',qtype:'sequence'},
                   '[["a","b,c","d","e","f"]]',
                   { optorder:'',fasit:[]["a","b,c","d","e","f"],cats:[["a","b,c","d","e","f"]],catnames:["+abc"],options:["b,c","e","f","a","d"]},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.be.at.least(0.38);
              done();
          });
        });
        it("should give some credit for reversed sequence ", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"set in order [[+abc:a,b,c,d,e,f]]","code":"","pycode":"","hints":""}',qtype:'sequence'},
                   '[["f","e","d","c","b","a"]]',
                   { optorder:'',fasit:[]["a","b","c","d","e","f"],cats:[["a","b","c","d","e","f"]],catnames:["+abc"],options:["c","e","f","a","b","d"]},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.be.at.least(0.38);
              done();
          });
        });
        it("should give some credit for nearly good sequence", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"set in order [[+abc:a,b,c,d,e,f]]","code":"","pycode":"","hints":""}',qtype:'sequence'},
                   '[["a","b","c","d","f","e"]]',
                   { optorder:'',fasit:[]["a","b","c","d","e","f"],cats:[["a","b","c","d","e","f"]],catnames:["+abc"],options:["c","e","f","a","b","d"]},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.be.at.least(0.49);
              done();
          });
        });
        it("should give full credit for correct sequence", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"set in order [[+abc:a,b,c,d,e,f]]","code":"","pycode":"","hints":""}',qtype:'sequence'},
                   '[["a","b","c","d","e","f"]]',
                   { optorder:'',fasit:[]["a","b","c","d","e","f"],cats:[["a","b","c","d","e","f"]],catnames:["+abc"],options:["c","e","f","a","b","d"]},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(1);
              done();
          });
        });
        it("should fail evaluated useranswer where answer is shorter than orig, but differs from target", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"simplify 2x+3+3x-2-1 [[eva:5x|2x+3+3x-2-1|5x]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["3x"]',
                   { optorder:'',options:'',fasit:[ 'eva:5x|2x+3+3x-2-1|5x']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.be.equal(0);
              done();
          });
        });
        it("should give some credit for evaluated useranswer where answer is shorter than orig", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"simplify 2x+3+3x-2-1 [[eva:5x|2x+3+3x-2-1|5x]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["2x+3x"]',
                   { optorder:'',options:'',fasit:[ 'eva:5x|2x+3+3x-2-1|5x']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.be.within(0.4,0.5);
              done();
          });
        });
        it("should fail evaluated useranswer where answer == original expr", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"simplify 2x+3+3x-2-1 [[eva:5x|2x+3+3x-2-1|5x]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["2x+3+3x-2-1"]',
                   { optorder:'',options:'',fasit:[ 'eva:5x|2x+3+3x-2-1|5x']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(0);
              expect(constring).to.contain('sicut prius');
              done();
              constring = '';
          });
        });
        it("should give some credit for evaluated useranswer", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[eva:-x+2]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["-x+2.001"]',
                   { optorder:'',options:'',fasit:[ 'eva:-x+2']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.be.within(0.001,0.999);
              done();
          });
        });
        it("should fail evaluated useranswer", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[eva:-x+2]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["-x+2.01"]',
                   { optorder:'',options:'',fasit:[ 'eva:-x+2']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(0);
              done();
          });
        });
        it("should pass evaluated useranswer", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[eva:x+2]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["x+2"]',
                   { optorder:'',options:'',fasit:[ 'eva:x+2']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(1);
              done();
          });
        });
        it("should fail numeric useranswer based on bad regexp", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[reg:abc++*d+]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["abccddd"]',
                   { optorder:'',options:'',fasit:[ 'reg:abc++*d+']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(0);
              expect(constring).to.contain('BAD REG');
              constring = '';
              done();
          });
        });
        it("should pass numeric useranswer based on regexp", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[reg:abc+d+]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["abccddd"]',
                   { optorder:'',options:'',fasit:[ 'reg:abc+d+']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(1);
              done();
          });
        });
        it("should grade numeric useranswer value in list", function(done){
          var target = Math.floor(Math.random()*16);
          var score = (target > 0 && target <7) ? 1 : 0;
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[lis:1,2,3,4,5,6]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["'+target+'"]',
                   { optorder:'',options:'',fasit:[ 'lis:1,2,3,4,5,6']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(score);
              done();
          });
        });
        it("should fail approx numeric useranswer out of bounds", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[#a:0.3]]","code":"a=3","pycode":"","hints":""}',qtype:'numeric'},
                   '["3.8"]',
                   { optorder:'',options:'',fasit:[ '3:0.3']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(0);
              done();
          });
        });
        it("should pass numeric any value if criteria is any", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[any]]","code":"","pycode":"","hints":""}',qtype:'numeric'},
                   '["'+Math.random()+'"]',
                   { optorder:'',options:'',fasit:[ 'any']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(1);
              done();
          });
        });
        it("should grade approx numeric useranswer", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[#a:0.3]]","code":"a=3","pycode":"","hints":""}',qtype:'numeric'},
                   '["3.2"]',
                   { optorder:'',options:'',fasit:[ '3:0.3']},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(1);
              done();
          });
        });
        it("should grade exact numeric useranswer", function(done){
          qz.grade({ attemptcost:0,fiidback:'none',hintcost:0} ,
                   {},
                   {id:123,instance:0,points:1,qtext:'{"display":"drop dead [[#a]]","code":"a=3","pycode":"","hints":""}',qtype:'numeric'},
                   '["3"]',
                   { optorder:'',options:'',fasit:[3]},
                   0, 0, 314,0,0,
            function(score,feedback,completed,ua,overskip) {
              expect(score).to.equal(1);
              done();
          });
        });
      });
      
      // testing generateParams
      describe("#generateParams", function(){
        // setting up for generateParam
        quiz.__set__("db" ,{ quizbase:{}});
        qz.containers = { 11:{ 314:{ }  } };  // the container
        it("should take a raw question and expand macros", function(done){
          qz.generateParams({id:123,qtype:"info"},314,0,1,false,function(qobj) {
              expect(qobj).to.have.property("display","drop%20dead%203");
              done();
          });
        });
        it("should get subtypes for numeric", function(done){
          qz.generateParams({id:126,qtype:"numeric"},314,0,1,false,function(qobj) {
              expect(qobj.subtype).to.deep.equal([0,1,2,3,4,5,6,7]);
              done();
          });
        });
        it("should shuffle choices for dragdrop", function(done){
          qz.generateParams({id:124,qtype:"dragdrop"},314,0,1,false,function(qobj) {
              expect(qobj.fasit).to.not.equal(qobj.options);
              done();
          });
        });
        it("should be unable to shuffle choices for dragdrop with one option", function(done){
          qz.generateParams({id:125,qtype:"dragdrop"},314,0,1,false,function(qobj) {
              expect(qobj.fasit[0]).to.equal(qobj.options[0]);
              done();
          });
        });
      });

      // testing getQobj
      describe("#getQobj", function(){
        it("should parse info", function(){
          var result = qz.getQobj('{"display":"some stuff","code":"","pycode":"","hints":"","daze":""}',"info",123,0);
          expect(result).to.deep.equal(
            { display: 'some stuff',
              code: '',
              pycode: '',
              hints: '',
              daze: '',
              origtext: 'some stuff',
              fasit: [] }
          );
        });
        it("should parse dragdrop with graph", function(){
          var result = qz.getQobj('{"display":"drag and [[drop]] €€plot {1} { points:[ [[udata[1]]]] }€€","code":"","pycode":"","hints":"","daze":""}',"dragdrop",123,0);
          expect(result).to.deep.equal(
            { display: 'drag and <span id="dd123_0_0" class="drop">&nbsp;&nbsp;&nbsp;&nbsp;</span> €€plot {1} { points:[ [[udata[1]]]] }€€',
              code: '',
              pycode: '',
              hints: '',
              daze: '',
              origtext: 'drag and [[drop]] €€plot {1} { points:[ [[udata[1]]]] }€€',
              fasit: [ 'drop' ] }
          );
        });
        it("should parse dragdrop", function(){
          var result = qz.getQobj('{"display":"drag and [[drop]]","code":"","pycode":"","hints":"","daze":""}',"dragdrop",123,0);
          expect(result).to.deep.equal(
            { display: 'drag and <span id="dd123_0_0" class="drop">&nbsp;&nbsp;&nbsp;&nbsp;</span>',
              code: '',
              pycode: '',
              hints: '',
              daze: '',
              origtext: 'drag and [[drop]]',
              fasit: [ 'drop' ] }
          );
        });
        it("should parse multiple choice", function(){
          var result = qz.getQobj('{"display":"choose some","options":["yes","no"],"fasit":["1","0"],"code":"","pycode":"","hints":"","origtext":"","optorder":"ab"}',"multiple",123,0);
          expect(result).to.deep.equal(
            {
              "code": "",
              "display": "choose some",
              "fasit": [ "1" , "0"   ],
              "hints": "",
              "options": [  "yes" ,    "no"  ],
              "optorder": "ab",
              "origtext": "choose some",
              "pycode": ""
            }
          );
        });
        it("should parse numeric", function(){
          var result = qz.getQobj('{"display":"calculate 2+3=[[5]]","code":"","pycode":"","hints":"","daze":""}',"numeric",123,0);
          expect(result).to.deep.equal(
            { display: 'calculate 2+3=<span id=\"dd123_0_0\" class=\"fillin\">&nbsp;&nbsp;&nbsp;&nbsp;</span>',
              code: '',
              pycode: '',
              hints: '',
              daze: '',
              origtext: 'calculate 2+3=[[5]]',
              fasit: [ '5' ] }
          );
        });
        it("should parse sequence with newlines", function(){
          var result = qz.getQobj('{"display":"place in order [[+alfabeta:\\na\\nb\\nc\\nd\\ne]]","code":"","pycode":"","hints":"","daze":""}',"sequence",123,0);
          expect(result).to.deep.equal(
            { display: 'place in order <div class=\"catt\">alfabeta</div><ul id=\"dd123_0\" class=\"order sequence connectedSortable\"><li class=\"hidden\" >zzzz</li>ª</ul>',
              catnames: [ "+alfabeta" ],
              cats: [  [ "a","b","c","d","e"  ]   ],
              fasit:[ "a" ,    "b" ,    "c" ,    "d" ,    "e" ],
              code: '',
              pycode: '',
              hints: '',
              daze: '',
              origtext: 'place in order [[+alfabeta:\na\nb\nc\nd\ne]]'
              }
          );
        });
        it("should parse sequence", function(){
          var result = qz.getQobj('{"display":"place in order [[+alfabeta:a,b,c,d,e]]","code":"","pycode":"","hints":"","daze":""}',"sequence",123,0);
          expect(result).to.deep.equal(
            { display: 'place in order <div class=\"catt\">alfabeta</div><ul id=\"dd123_0\" class=\"order sequence connectedSortable\"><li class=\"hidden\" >zzzz</li>ª</ul>',
              catnames: [ "+alfabeta" ],
              cats: [  [ "a","b","c","d","e"  ]   ],
              fasit:[ "a" ,    "b" ,    "c" ,    "d" ,    "e" ],
              code: '',
              pycode: '',
              hints: '',
              daze: '',
              origtext: 'place in order [[+alfabeta:a,b,c,d,e]]'
              }
          );
        });
      });
  });
});

