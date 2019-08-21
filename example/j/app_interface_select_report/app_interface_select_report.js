

loader.require([ '/j/base/fn.js', ], function () {

  var module = {
    start: function() {
      write_log('Call module '+ __module_name);
    }
  };

  var fn = loader.get('/j/base/fn.js');
  fn.foreach_value([ 1, 2, 3 ], function (el) {
    write_log('<p style=margin-left:40px;>Action before load '+__module_name+' '+el+'</p>');
  });

  write_log('<p style=margin-left:20px;># Finish load '+__module_name+'</p>');
  loader.done(__module_name, module);
});


