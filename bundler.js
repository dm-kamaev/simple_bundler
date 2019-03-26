'use strict';

// Check changes version via md5, for production
// if dev, not change version

// TODO: make config file for different environments

const fs = require('fs');
const wf = require('./wf.js');
const path = require('path');
const crypto = require('crypto');
const Terser = require('terser');
const node_watch = require('node-watch');


async function main(src_dir, out_dir, { is_prod, path_describe_module, filename }) {
  console.time('Build');

  let hash = {};
  if (exist(path_describe_module)) {
    hash = JSON.parse(sync_read(path_describe_module));
  }

  var list_src_paths;
  if (filename) {
    list_src_paths = [ filename ];
  } else {
    list_src_paths = get_list_files(src_dir);
  }
  list_src_paths = list_src_paths.filter(p => path.extname(p) === '.js');

  var list_out_paths = list_src_paths.map(p => p.replace(new RegExp('^'+src_dir), out_dir));

  create_folder(out_dir);

  // cache for exist dir
  var already_exist_dir = {};

  // TODO: maybe minify in pools worker thread
  var actions = list_out_paths.map(function (p, i) {
    return (async function () {
      var dir = path.parse(p).dir;
      if (!already_exist_dir[dir]) {
        create_folder(dir);
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
          manage_hash.init();
        }
      }

      await wf.write(p, code);
    }());
  });
  await Promise.all(actions);
  console.log(list_src_paths, list_out_paths);

  write(path_describe_module, JSON.stringify(hash, null, 2));

  console.timeEnd('Build');
}


function start_watcher(src_dir, cb) {
  // filename - /Users/mitya/Desktop/Start/bundler/src_client/app_interface_select_report/h_list_banks.js
  node_watch(src_dir, { recursive: true }, function (event, filename) {
    console.log('[event]', event, 'filename = ', filename);
    cb(filename);
  });
}

/**
 * get_list_files - recursive
 * @param  {string} dir
 * @return {string[]}
 */
function get_list_files(dir) {
  var files = fs.readdirSync(dir);
  var filelist = [];
  files.forEach(function(file) {
    if (fs.statSync(dir + file).isDirectory()) {
      filelist = filelist.concat(get_list_files(dir + file + '/', filelist));
    } else {
      filelist.push(dir+file);
    }
  });
  return filelist;
}


/**
 * create_folder - create folder if not exist
 * @param  {string} path - folder path
 */
function create_folder(path) {
  try {
    fs.statSync(path);
  } catch (err) {
    fs.mkdirSync(path, { recursive: true });
  }
}

function sync_read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, data) { return fs.writeFileSync(path, data, 'utf8'); }
function exist(path) {
  try {
    return Boolean(fs.statSync(path));
  } catch (err) {
    return false;
  }
}


function create_md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}


class Manage_hash {
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
    const src_dir = path.join(__dirname, './src_client/');
    const out_dir = path.join(__dirname, './j/');
    const is_prod = true;
    const path_describe_module = path.join(__dirname, './description_modules.json');

    try {
      await main(src_dir, out_dir, { is_prod, path_describe_module });
      if (!is_prod) {
        start_watcher(src_dir, async function (filename) {
          await main(src_dir, out_dir, { is_prod, path_describe_module, filename });
        });
      }
    } catch (err) {
      console.error(err);
    }
  }();
}