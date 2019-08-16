'use strict';

// Check changes version via md5, for production
// if dev, not change version

const fs = require('fs');


const wf_sync = module.exports;


/**
 * get_list_files - recursive
 * @param  {string} dir
 * @return {string[]}
 */
wf_sync.get_list_files = function (dir) {
  var files = fs.readdirSync(dir);
  var filelist = [];
  files.forEach(function(file) {
    if (fs.statSync(dir + file).isDirectory()) {
      filelist = filelist.concat(wf_sync.get_list_files(dir + file + '/', filelist));
    } else {
      filelist.push(dir+file);
    }
  });
  return filelist;
};


/**
 * create_folder - create folder if not exist
 * @param  {string} path - folder path
 */
wf_sync.create_folder = function (path) {
  try {
    fs.statSync(path);
  } catch (err) {
    fs.mkdirSync(path, { recursive: true });
  }
};

wf_sync.read = function (path) { return fs.readFileSync(path, 'utf8'); };

wf_sync.write = function (path, data) { return fs.writeFileSync(path, data, 'utf8'); };

wf_sync.append = function (path, data) { return fs.appendFileSync(path, data, 'utf8'); };

wf_sync.exist = function (path) {
  try {
    return Boolean(fs.statSync(path));
  } catch (err) {
    return false;
  }
};