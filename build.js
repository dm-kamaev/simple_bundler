'use strict';


const Terser = require('terser');
const fs = require('fs');

try {
  let { error, code } = Terser.minify(fs.readFileSync('./loader.js', 'utf-8'));
  if (error) {
    throw error;
  }

  fs.writeFileSync('./loader.min.js', code, 'utf-8');

  fs.writeFileSync('./example/loader.min.js', code, 'utf-8');
} catch (err) {
  console.error(err);
} finally {
  global.process.exit();
}