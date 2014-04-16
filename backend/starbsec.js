var badboyz = {};
exports.secure = function(n) {
  n = Math.max(1,Math.min(1000,+n));
  console.log("checking if secure");
  var justnow   = new Date();
  var timest = justnow.getTime();
  if (badboyz[n]) {
    var bad = badboyz[n];
    console.log(n,bad.time-timest);
    bad.count++;
    if (bad.count > 2 && (timest - bad.time) < 4000) {
      console.log("too quick");
      return false;
    }
    bad.time = timest;
  } else {
    badboyz[n] = { count:1, time:timest};
  }
  return true;
}
