window.loader = (function() {
  var loader = {};

  var _is_prod = false;
  var _disable_cache = false;
  var _prefix_for_version = '';
  var _debug = false;

  /**
   * _prefix - '/stat'
   * @type {[string='']}
   */
  var _prefix_url = '';

  /**
   * bus -list action for after download
   * @type {Array<{ src: string, make_load: function(src: string, module: any )}>}
   */
  var bus = [];

  var _modules = {};

  /**
   * listen_load
   * @param  {string} src - '/j/base/fn.js'
   * @param  {fcuntion(src: string, module: any)} make_load - action after load
   */
  function listen_load(src, make_load) {
    bus.push({ src: src, make_load: make_load });
  }

  loader.log = function () {
    if (_debug) {
      console.log.apply(console.log, arguments);
    }
  };

  /**
   * set_settings
   * @param {{ prefix_url: string, prefix_for_vesrion: string }} options - { prefix_url: string, prefix_for_version: string }
   * set prefix for nginx static
   */
  loader.set_settings = function (options) {
    _modules = options.description_modules.modules;
    _prefix_for_version = options.description_modules.prefix_for_version;

    _is_prod = options.is_prod;
    _disable_cache = options.disable_cache;
    _prefix_url = options.prefix_url;

    _debug = options.debug;
  };


  /**
   * done - action for emit event 'load'
   * @param  {string}   src '/j/base/fn.js'
   * @param  {[any]}   module
   */
  loader.done = function(src, module) {
    for (var i = 0, l = bus.length; i < l; i++) {
      var el = bus[i];
      if (!el) {
        continue;
      }
      if (el.src === src) {
        el.make_load(src, module);
        bus[i] = null;
      }
    }
    // TODO: clean bus, after length > 100
  };


  /**
   * require
   * @param  {string | Array<{ src: string }>} what
   * @param  {function(err)} cb
   */
  loader.require = function (what, cb) {
    if (what instanceof Array) {
      return require_list(what, cb);
    }

    var src;
    if (typeof what === 'string') {
      src = what;
    }

    check_exist(src);

    var describe_modules = _modules[src];

    if (is_loaded(src)) {
      write_log('is_loaded '+src);
      return cb();
    }
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    // script.text = 'alert("12313123");';
    var version = describe_modules.version;
    var src_attribute = '';
    if (_is_prod) {
      src_attribute = _prefix_url+src+'?'+_prefix_for_version+version;
    } else if (_disable_cache) {
      src_attribute = _prefix_url+src+'?no_cache='+Date.now();
    } else {
      src_attribute = _prefix_url+src;
    }

    loader.log('setAttribute=', src_attribute);


    script.setAttribute('src', src_attribute);

    // if (!_is_prod) {
    search_duplicate_and_circular_dependencies();
    // }

    listen_load(src, function(src, module) {
      set_loaded(src, module);
      write_log('load '+src+' '+JSON.stringify(module, null, 2));
      cb();
    });
    script.onload = function () {
      // console.log('onload');
    };
    script.onerror = function () {
      throw new Error('Fail loaded script '+src);
    };
    document.body.appendChild(script);
  };


  /**
   * set_loaded
   * @param {string} src - '/j/base/fn.js'
   */
  function set_loaded(src, module) {
    var el = _modules[src];
    el.loaded = true;
    el.module = module;
  }


  /**
   * is_loaded
   * @param  {string}  src - '/j/base/fn.js'
   * @throws {Error} If not found module
   */
  function check_exist(src) {
    if (!_modules[src]) {
      throw new Error('Not found module "'+ src+'"');
    }
  }


  function search_duplicate_and_circular_dependencies() {
    var hash = {};
    var scripts = document.scripts;
    for (var i = 0, l = scripts.length; i < l; i++) {
      let src = scripts[i].getAttribute('src');
      if (!src) {
        continue;
      }
      src = src.replace(/\.js\/\?.+$/, '.js');
      src = src.replace(/.js\?.+$/, '.js');
      if (hash[src]) {
        throw new Error('[loader.js]: Duplicate script '+src+', may be circular dependencies');
      } else {
        hash[src] = src;
      }
      console.log('DEBUG=', src);
      // console.log(src);
    }
  }

  /**
   * is_loaded
   * @param  {string}  src - '/j/base/fn.js'
   * @return {Boolean}
   */
  function is_loaded(src) {
    return _modules[src].loaded === true;
  }


  /**
   * require_list
   * @param  {string[] | Array<{ src: string }>} list
   * @param  {function(err)} cb
   */
  function require_list(list, cb) {
    var arr = [];
    for (var i = 0, l = list.length; i < l; i++) {
      var what_load = list[i];
      arr.push((function(wl) {
        return function (cb) {
          loader.require(wl, cb);
        };
      })(what_load));
    }
    step_by_step(arr, cb);
  }


  /**
   * get - get module
   * @param  {string} src - path to module('/j/base/fn.js')
   * @throws {Error} If not found module
   * @return {any} module
   */
  loader.get = function(src) {
    var el = _modules[src];
    if (!el || !el.module) {
      throw new Error('Not found module '+src);
    }
    return el.module;
  };


  /**
   * _step_by_step - loading via queue
   * @param  {Array<function>} f_array
   * @param  {function(err)} finish_callback
   */
  function step_by_step(f_array, finish_callback) {
    var current = 0;
    var finish = f_array.length;

    var internal_callback = function(err, data) {
      if (err) {
        finish_callback(err); // Если ошибка, взываем главный callback серии
      } else if (current < finish) { // Пока не кончился массив берем элемент массива (функцию)
        var el_array = f_array[current];
        current++;
        el_array(internal_callback, data);
      } else {
        finish_callback(null, data);
      }
    };
    internal_callback();
  }

  return loader;
}());