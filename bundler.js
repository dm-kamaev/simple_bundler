'use strict';

// Check changes version via md5, for production
// if dev, not change version

// TODO: fix this /Users/mitya/Desktop/Start/bundler/j/app_interface_select_report/app_interface_select_report.js in description_modules.json
// TODO: make config file for different environments

const wf = require('./wf.js');
const wf_sync = require('./wf_sync.js');
const path = require('path');
const crypto = require('crypto');
const Terser = require('terser');
const node_watch = require('node-watch');

const bundler = module.exports;


/**
 * build
 * @param  {{ input_dir: string }} src, input_dir - absolute path(file system) to source code
 * @param  {{ output_dir: string, root_browser_folder: string }} out, output_dir - absolute path(file system) for result, root_browser_folder - root folder, which used into frontend code for loading modules
 * @param  {boolean} options.is_prod
 * @param  {string} options.path_describe_module - path where file with info for client js
 * @param  {[string]} options.filename - path to filename, if rebuild one file
 * @param  {[regexp]} options.exclude_file - regexp for ignore file
 * @param  {[function(): boolean]} options.not_wrapping_to_module - filter for file, which not wrap as module
 */
bundler.build = async function (src, out, { is_prod, prefix_for_version, path_describe_module, filename, exclude_file, not_wrapping_to_module }) {
  if (!prefix_for_version) {
    throw new Error('Not exist prefix_for_version');
  }

  console.time('Build');

  var input_dir = src.input_dir;
  var output_dir = out.output_dir;
  var root_browser_folder = out.root_browser_folder;

  var description_modules = new Description_modules(prefix_for_version, path_describe_module);
  var hash = description_modules.get_hash();

  var list_src_paths;
  if (filename) {
    list_src_paths = [ filename ];
  } else {
    list_src_paths = wf_sync.get_list_files(input_dir);
  }

  list_src_paths = list_src_paths.filter(p => path.extname(p) === '.js');

  // filter files by regexp
  if (exclude_file) {
    list_src_paths = list_src_paths.filter(p => !exclude_file.test(path.basename(p)));
  }

  /**
   * @type {Array<{ key: string, path: string }>} list_out_paths -
   * [{ key: '/j/app_interface_reports_to_xlsx/app_interface_reports_to_xlsx.js', path: '/Users/mitya/Desktop/Start/bundler/stat/j/app_interface_reports_to_xlsx/app_interface_reports_to_xlsx.js' }]
   */
  var list_out_paths = list_src_paths.map(p => {
    return {
      // remove part path before root_browser_folder
      key: p.replace(new RegExp('^(.+?)(' + root_browser_folder + ')'), '$2'),
      path: p.replace(new RegExp('^' + input_dir), output_dir),
    };
  });
  // console.log(list_out_paths);
  // global.process.exit();

  wf_sync.create_folder(output_dir);

  // cache for exist dir
  var already_exist_dir = {};

  // TODO: maybe minify in pools worker thread
  var actions = list_out_paths.map(function (el, i) {
    return (async function () {
      var dir = path.parse(el.path).dir;
      if (!already_exist_dir[dir]) {
        wf_sync.create_folder(dir);
        already_exist_dir[dir] = true;
      }
      var code = await wf.read(list_src_paths[i]);
      var manage_hash = new Manage_hash(hash, el.key);
      if (is_prod) {
        var md5 = create_md5(code);
        if (hash[el.key]) {
          if (manage_hash.was_changed(md5)) {
            manage_hash.update(md5);
          }
        } else {
          manage_hash.init(md5);
        }
        code = minify_code(code);
      } else {
        if (!hash[el.key]) {
          manage_hash.init(create_md5(code));
        }
      }

      if (!not_wrapping_to_module || not_wrapping_to_module(el.path) !== true) {
        code = wrap_code(code, el.path, el.key);
      }
      await wf.write(el.path, code);
    }());
  });
  await Promise.all(actions);

  console.log(list_src_paths, list_out_paths);

  description_modules.save(root_browser_folder, hash);

  console.timeEnd('Build');
};


/**
 * start_watcher
 * @param  {{ input_dir: string }} src, input_dir - absolute path(file system) to source code
 * @param  {Function} cb      [description]
 * @return {node-watch}
 */
bundler.start_watcher = function (src, cb) {
  var watcher = node_watch(src.input_dir, { recursive: true }, function (event, filename) {
    // filename - /Users/mitya/Desktop/Start/bundler/src_client/app_interface_select_report/h_list_banks.js
    console.log('[event]', event, 'filename = ', filename);
    cb(filename);
  });
  return watcher;
};


/**
 * create_md5
 * @param  {string} str
 * @return {string}
 */
function create_md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}


/**
 * wrap_code - add global variable for module
 * @param  {string} code - js code
 * @param  {string} src - original path to code
 * @return {string} - js code with anounym function
 */
function wrap_code(code, src, module_name) {
  return (
    '(function(__module_name){'+
      code+
    '}("'+module_name+'"));'
  );
}


class Description_modules {
  /**
   * constructor
   * @param  {string} prefix_for_version
   * @param  {string} path_describe_module
   */
  constructor(prefix_for_version, path_describe_module) {
    this._path_describe_module = path_describe_module;
    this._prefix_for_version = prefix_for_version;
  }

  get_hash() {
    var hash = this._build_hash();
    if (wf_sync.exist(this._path_describe_module)) {
      hash = JSON.parse(wf_sync.read(this._path_describe_module));
    }
    return hash.modules;
  }

  /**
   * save - write to file hash with description modules
   * @param  {string} out_folder - '/j/'
   * @param  {{ [path: string]: md5: string, version: number }} input_hash
   */
  save(out_folder, input_hash) {
    // /^(.+?)(\/j\/)/
    // reg exp for remove extra path
    var reg_exp = new RegExp('^(.+?)('+out_folder+')');
    var out_hash = {};
    Object.keys(input_hash).forEach(path => {
      out_hash[path.replace(reg_exp, '$2')] = input_hash[path] ;
    });

    wf_sync.write(this._path_describe_module, JSON.stringify(this._build_hash(out_hash), null, 2));
  }


  _build_hash(modules = {}) {
    return {
      prefix_for_version: this._prefix_for_version,
      modules
    };
  }

}


class Manage_hash {

  /**
   * constructor
   * @param  {{ md5: string, version: string }} hash - modules
   * @param  {string} path - path as key
   */
  constructor(hash, key) {
    this._hash = hash;
    this._key = key;
  }

  /**
   * init
   * @param  {string} md5
   */
  init(md5) {
    this._hash[this._key] = {
      md5,
      version: 1
    };
  }

  /**
   * was_changed
   * @param  {string} md5
   * @return {boolean}
   */
  was_changed(md5) {
    return this._hash[this._key].md5 !== md5;
  }

  /**
   * update - up version and update md5
   * @param  {string} md5
   */
  update(md5) {
    var module = this._hash[this._key];
    module.md5 = md5;
    module.version = parseInt(module.version, 10) + 1;
  }
}


/**
 * minify_code
 * @param  {string} code - `window.asdadsads = function test(petya. vasya) { return petya + vasya; }; window.asdadsads(1,2);`
 * @return {string} code - minify code
 * @throws {Error} Terser error
 */
function minify_code(code) {
  var res = Terser.minify(code, {
    mangle: {
      // mangle function name
      // toplevel: true,
    },
  });
  if (res.error) {
    throw res.error;
  }
  return res.code;
}


