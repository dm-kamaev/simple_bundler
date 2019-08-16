'use strict';

const bundler = require('../bundler.js');
const path = require('path');
const assert = require('assert');

const wf_sync = require('../wf_sync.js');


describe('bundler.js', function() {

  it('test dev build', async function (done) {
    this.timeout(15000);
    await dev(done);
  });

});


async function dev() {
  var input_folder = '/j';

  var src_dir = path.join(__dirname, '..'+input_folder+'/' );
  var out_dir = path.join(__dirname, '../stat/j/');

  var src = { input_dir: src_dir, };
  var out = { output_dir: out_dir, root_browser_folder: input_folder };
  var option = {
    is_prod: false,
    path_describe_module: path.join(__dirname, './description_modules.json')
  };

  try {
    var { hash } = await bundler.build(src, out, option);
    console.log('Start watching -->');


    assert.ok(wf_sync.exist(option.path_describe_module), 'Not created '+option.path_describe_module);

    // path_module = Object.keys(hash)[0];
    var path_module = path.join(__dirname, '../j/base/fn.js');
    console.log(path_module);
    wf_sync.append(path_module, 'console.log("I am appended");\n');
    console.log('APPEND', path_module);

    console.log(hash);

    return new Promise((resolve) => {
      bundler.start_watcher(src, async function (filename) {
        console.log('THIS');
        option.filename = filename;
        await bundler.build(src, out, option);
        option.filename = null;

        assert.ok(filename === path_module, 'Changed '+filename+' but must be '+path_module);
        console.log('DEBUG=', filename === path_module);
        resolve();
      });
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}