(function({ __module_path }) {

 // insert code

}());

var app_something = {};
app_something.start = function () {
 var a = MODULES.get('a.js');
};

app_something.vasya = function () {
 var b = MODULES.get('b.js');
};


ljs.list([ 'a.js', 'b.js' ], function () {
 W.app_something = app_something;
 ljs.done(__module_path);
});