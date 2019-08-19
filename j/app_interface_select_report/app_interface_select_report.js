

loader.require([ '/j/base/fn.js', ], function () {

  var module = {
    start: function() {
      write_log('I am START '+ __module_name);
    }
  };
  write_log('LOAD app_interface_select_report ...');

  var fn = loader.get('/j/base/fn.js');
  fn.foreach_value([ 1, 2, 3 ], function (el) {
    write_log(el);
  });

  loader.done(__module_name, module);
});


