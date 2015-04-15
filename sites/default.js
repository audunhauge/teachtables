var crypto = require('crypto');
// static data that doesn't need to be stored in db
//   list of rooms



// standard timeslots for lesson-slots
var slotlabels = '8.05-8.45,8.45-9.25,9.35-10.15,10.20-11.00,11.25-12.05,12.10-12.50,12.50-13.30,'
               + '13.40-14.20,14.25-15.05,15.05-15.30,15.30-16.00,16.00-16.30,16.30-17.00,17.00-17.30,'
               + '17.30-18.00,18.00-18.30,18.30-19.00,19.00-19.30,19.30-20.00,20.00-20.30,20.30-21.00';

var roominfo = {};

var romliste = { "A"   :  ("A001,A002,A003,A004,A006,A102,A107".split(',')),
                 "M0"  :  ("M001,M002,M003,M004,M005,M006".split(',')),
                 "M1"  :  ("M106,M107,M108,M109,M110,M111,M112,M113,M114,M115,M116,M117,M118,M119,B001,B002".split(',')),
                 "G1"  :  ("G101,G102,G103,G104".split(',')),
                 "R0"  :  ("R001,R002,R003,R004,R005,R008".split(',')),
                 "R1"  :  ("R105,R106,R107,R110,R111,R112,R113".split(',')),
                 "R2"  :  ("R201,R202,R203,R204,R205,R206,R207,R208,R210,R211,R212,R213,R214,R215,R216".split(',')) };

var menu = {
     login                : 'Login'
   , logout               : 'logout'
   , seek                 : 'seek'
   , yearplan             : 'Yearplan'
   , thisweek             : 'This week'
   , next4                : 'Next 4 weeks'
   , sss                  : 'Starbkurs'
   , restofyear           : 'Rest of year'
   , wholeyear            : 'Whole year'
   , mytests              : 'My tests'
   , bigtest              : 'Main tests'
   , alltests             : 'All tests'
   , plans                : 'Plans'
   , mycourses            : 'My courses'
   , othercourses         : 'Other courses'
   , away                 : 'Away'
   , quiz                 : 'Quiz'
   , subscribe            : 'Subscribe'
   , csubscribe           : 'ExtraSubscribe'
   , timeplans            : 'Timeplans'
   , teachers             : 'Teachers'
   , students             : 'Students'
   , groupings            : 'Groupings'
   , klasses              : 'Classes'
   , groups               : 'Groups'
   , courses              : 'Courses'
   , rooms                : 'Rooms'
   , multiview            : 'MultiView'
   , loading              : 'loading plans ...'
}

var site = {
   title                :       "My School"
 , base                 :       "/myschool"
 , guest                :       true          // guest user auto-logged in
 , guestpage            :       "1MT5_FREE"   // open course for guest user
 , language             :       "en"
 , timezone             :       -1
 , port                 :       3000
 , menu                 :       menu
 , admin                :       {  // get the admin menue
                                    'admin':true
                                }
 , depleader :                  {  // department -leaders  get email when people are sick
                                }
 , showrooms            :       [  ]   // booking for these rooms viewable for studs in category 10,11,12
 , course               :       [  ]   // missing course list
 , schoolyear           :       "2011-2012"
 , connectionString     :       "postgres://admin:123@localhost/planner"
 , supwd                :       crypto.createHash('md5').update('gto').digest("hex")
 , startpwd             :       crypto.createHash('md5').update('abd').digest("hex")
 , adminpwd             :       crypto.createHash('md5').update('13').digest("hex")
 , roominfo             :       roominfo
 , romliste             :       romliste
 , slotlabels           :       slotlabels
 , days                 :       5               // default number of days for reservations
 , slots                :       12              // default slots for reservations
}
module.exports = site;
