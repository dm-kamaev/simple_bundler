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
 * @param  {{ output_dir: string, browser_dir: string }} out, output_dir - absolute path(file system) for result
 * @param  {boolean} options.is_prod
 * @param  {string} options.path_describe_module - path where file with info for client js
 * @param  {[string]} options.filename - path to filename, if rebuild one file
 */
bundler.build = async function (src, out, { is_prod, path_describe_module, filename }) {
  console.time('Build');

  let hash = {};
  if (wf_sync.exist(path_describe_module)) {
    hash = JSON.parse(wf_sync.read(path_describe_module));
  }

  var input_dir = src.input_dir;
  var output_dir = out.output_dir;
  var list_src_paths;
  if (filename) {
    list_src_paths = [ filename ];
  } else {
    list_src_paths = wf_sync.get_list_files(input_dir);
  }
  list_src_paths = list_src_paths.filter(p => path.extname(p) === '.js');

  var list_out_paths = list_src_paths.map(p => p.replace(new RegExp('^'+input_dir), output_dir));

  wf_sync.create_folder(output_dir);

  // cache for exist dir
  var already_exist_dir = {};

  // TODO: maybe minify in pools worker thread
  var actions = list_out_paths.map(function (p, i) {
    return (async function () {
      var dir = path.parse(p).dir;
      if (!already_exist_dir[dir]) {
        wf_sync.create_folder(dir);
        already_exist_dir[dir] = true;
      }
      var code = await wf.read(list_src_paths[i]);
      var manage_hash = new Manage_hash(hash, p);
      if (is_prod) {
        var md5 = create_md5(code);
        if (hash[p]) {
          if (manage_hash.was_changed(md5)) {
            manage_hash.update(md5);
          }
        } else {
          manage_hash.init(md5);
        }
        code = minify_code(code);
      } else {
        if (!hash[p]) {
          manage_hash.init(create_md5(code));
        }
      }

      await wf.write(p, wrap_code(code, p, out.browser_dir));
    }());
  });
  await Promise.all(actions);
  console.log(list_src_paths, list_out_paths);

  Manage_hash.write(path_describe_module, out.browser_dir, hash);

  console.timeEnd('Build');
};


bundler.start_watcher = function (src_dir, cb) {
  // filename - /Users/mitya/Desktop/Start/bundler/src_client/app_interface_select_report/h_list_banks.js
  node_watch(src_dir, { recursive: true }, function (event, filename) {
    console.log('[event]', event, 'filename = ', filename);
    cb(filename);
  });
};


function create_md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}


/**
 * wrap_code - add global variable for module
 * @param  {string} code
 * @param  {string} module_name - path to code
 * @return {string} js
 */
function wrap_code(code, src, browser_dir) {
  var module_name = src.replace(new RegExp('^(.+?)('+browser_dir+')'), '$2');
  return (
    '(function(__module_name){'+
      code+
    '}("'+module_name+'"));'
  );
}


class Manage_hash {
  /**
   * write - write to file hash iwht description modules
   * @param  {string} path_describe_module
   * @param  {string} out_folder - '/j/'
   * @param  {{ [path: string]: md5: string, version: number }} input_hash
   */
  static write(path_describe_module, out_folder, input_hash) {
    // /^(.+?)(\/j\/)/
    // reg exp for remove extra path
    var reg_exp = new RegExp('^(.+?)('+out_folder+')');
    var out_hash = {};
    Object.keys(input_hash).forEach(path => {
      out_hash[path.replace(reg_exp, '$2')] = input_hash[path] ;
    });
    wf_sync.write(path_describe_module, JSON.stringify(out_hash, null, 2));
  }

  /**
   * constructor
   * @param  {{ md5: string, version: string }} hash - modules
   * @param  {string} path - path as key
   */
  constructor(hash, path) {
    this._hash = hash;
    this._key = path;
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
 * @param  {string} code
 * @return {string} code - minify code
 * @throws {Error} Terser error
 */
function minify_code(code) {
  var res = Terser.minify(code);
  if (res.error) {
    throw res.error;
  }
  return res.code;
}


if (!module.parent) {
  void async function () {
    const input_dir = '/j';

    const src_dir = path.join(__dirname, '.'+input_dir+'/' );
    const out_dir = path.join(__dirname, './stat/j/');

    const src = { input_dir: src_dir, };
    const out = { output_dir: out_dir, browser_dir: input_dir };

    const is_prod = false;
    const path_describe_module = path.join(__dirname, './description_modules.json');

    try {
      await bundler.build(src, out, { is_prod, path_describe_module });
      if (!is_prod) {
        console.log('Start watching -->');
        bundler.start_watcher(src_dir, async function (filename) {
          await bundler.build(src, out, { is_prod, path_describe_module, filename });
        });
      }
    } catch (err) {
      console.error(err);
    }
  }();
}