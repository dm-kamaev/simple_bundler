'use strict';

const bundler = require('../bundler.js');
const path = require('path');
const assert = require('assert');

const wf_sync = require('../wf_sync.js');

// ### settings for build
const input_folder = '/j';

const src_dir = path.join(__dirname, '.'+input_folder+'/' );
const out_dir = path.join(__dirname, './stat/j/');

const src = { input_dir: src_dir, };
const out = { output_dir: out_dir, root_browser_folder: input_folder };
const path_describe_module = path.join(__dirname, './description_modules.json');
const option = {
  prefix_for_version: 'a',
  path_describe_module,
  exclude_file: /^\./,
  not_wrapping_to_module: function (file_path) {
    if (/lib\.js/.test(file_path)) {
      return true;
    }
  }
};
// ### end settings for build ###


describe('bundler.js', function() {

  it('test dev build', async function () {
    await dev(src, out, option);
  });

  it('test prod build', async function () {
    this.timeout(15000);
    return await prod(src, out, option);
  });

});


async function dev(src, out, option) {
  try {
    await bundler.build(src, out, option);


    assert.ok(wf_sync.exist(option.path_describe_module), 'Not created '+option.path_describe_module);

    // path_module = Object.keys(hash)[0];
    var path_module = path.join(__dirname, './j/base/fn.js');

    var ignore_file = path.join(__dirname, './j/.eslintrc.js');

    var previous_vesrion;
    var previous_md5;
    var scenarios = [{
      handler: function(filename) {
        assert.ok(path.basename(filename) === path.basename(path_module), 'Changed ' + filename + ' but must be ' + path_module);
        var modules = JSON.parse(wf_sync.read(path_describe_module)).modules;
        var { version, md5 } = modules['/j/base/fn.js'];

        assert.ok(wf_sync.read(path.join(__dirname, './j/lib.js')) === wf_sync.read(path.join(__dirname, './stat/j/lib.js')), 'Not equal files');

        assert.ok(typeof version === 'number', 'Wrong version');
        assert.ok(typeof md5 === 'string', 'Wrong md5');
        previous_vesrion = version;
        previous_md5 = md5;

        // console.log('FIRST=', previous_vesrion, previous_md5);
      }
    }, {
      action: function() {
        wf_sync.append(path_module, '\nconsole.log("I am appended");\n');
      },
      handler: function(filename) {
        assert.ok(path.basename(filename) === path.basename(path_module), 'Changed ' + filename + ' but must be ' + path_module);
        var modules = JSON.parse(wf_sync.read(path_describe_module)).modules;
        var { version, md5 } = modules['/j/base/fn.js'];

        // console.log('SECOND=', version, md5);
        assert.ok(previous_vesrion === version, 'Not equalent version');
        assert.ok(previous_md5 === md5, 'Not equalent md5');
      }
    }];
    var i = 0;

    assert.ok(wf_sync.exist(ignore_file) && !wf_sync.exist(ignore_file.replace(/\/j\//, '/stat/j/')), 'Not work option exclude_file');

    return new Promise((resolve) => {
      var watcher = bundler.start_watcher(src, async function (filename) {
        option.filename = filename;
        await bundler.build(src, out, option);
        option.filename = null;

        scenarios[i].handler(filename);

        i++;

        if (!scenarios[i]) {
          watcher.close();
        } else {
          if (scenarios[i].action) {
            scenarios[i].action();
          }
        }
      });

      watcher.on('close', function() {
        resolve();
      });

      watcher.on('ready', function() {
        console.log('Start watching -->');
        wf_sync.append(path_module, 'console.log("I am appended");\n');
      });

    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}


async function prod(src, out, option) {

  option = Object.assign({}, option, { is_prod: true });

  try {
    await bundler.build(src, out, option);

    var path_module = path.join(__dirname, './j/base/fn.js');

    var modules = JSON.parse(wf_sync.read(path_describe_module)).modules;
    var { version: previous_vesrion, md5: previous_md5 } = modules['/j/base/fn.js'];

    assert.ok(typeof previous_vesrion === 'number', 'Wrong version');
    assert.ok(typeof previous_md5 === 'string', 'Wrong md5');

    // console.log('FIRST=', previous_vesrion, previous_md5);

    // ############### REPEAT BUILD WITHOUT MODIFY FILE #################

    await bundler.build(src, out, option);

    modules = JSON.parse(wf_sync.read(path_describe_module)).modules;
    var { version, md5 } = modules['/j/base/fn.js'];


    // console.log('SECOND=', version, md5);
    assert.ok(previous_vesrion === version, 'Must be equaled versions');
    assert.ok(previous_md5 === md5, 'Must be equaled md5s');

    // ############### MODIFY FILE #################

    wf_sync.append(path_module, '\nconsole.log("I am appended '+Date.now()+'");\n');

    await bundler.build(src, out, option);

    modules = JSON.parse(wf_sync.read(path_describe_module)).modules;
    ({ version, md5 } = modules['/j/base/fn.js']);


    // console.log('SECOND=', version, md5);
    assert.ok(previous_vesrion < version, 'Must be incremented version');
    assert.ok(previous_md5 !== md5, 'Must not be equaled md5');

  } catch (err) {
    console.error(err);
    throw err;
  }
}