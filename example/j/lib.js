function getByID(id) {
  var el=document.getElementById(id);
  return (el) ? el : (err_trace('getByID not get element by id => "#'+id+'"'));
}

function $D (el) {
  el.show = function (display) { return showEl(el, display); };
  el.hide = function ()        { return hideEl(el); };
  return el;
}