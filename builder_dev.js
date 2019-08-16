'use strict';

// DEV BUILD
// if dev, not change version

// TODO: fix this /Users/mitya/Desktop/Start/bundler/j/app_interface_select_report/app_interface_select_report.js in description_modules.json
// TODO: make config file for different environments

const bundler = require('./bundler.js');
const path = require('path');

void async function () {
  var input_folder = '/j';

  var src_dir = path.join(__dirname, '.'+input_folder+'/' );
  var out_dir = path.join(__dirname, './stat/j/');

  var src = { input_dir: src_dir, };
  var out = { output_dir: out_dir, root_browser_folder: input_folder };
  var option = {
    is_prod: false,
    path_describe_module: path.join(__dirname, './description_modules.json')
  };

  try {
    await bundler.build(src, out, option);
    console.log('Start watching -->');
    bundler.start_watcher(src, async function (filename) {
      option.filename = filename;
      await bundler.build(src, out, option);
      option.filename = null;
    });
  } catch (err) {
    console.error(err);
    global.process.exit(1);
  }
}();
