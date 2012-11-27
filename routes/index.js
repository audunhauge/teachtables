
/*
 * GET home page.
 */

var base = siteinf.base;
var mytitle = siteinf.title;
var schoolyear = siteinf.schoolyear;
var language = siteinf.language;

exports.index = function(req, res){
	res.render('index', { mytitle:mytitle, schoolyear:schoolyear, menu:siteinf.menu, language:language, base:base, version:siteinf.version });
};
