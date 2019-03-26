'use strict';

const fs = require('fs');

const wf = module.exports;

wf.read = function(path) {
  return new Promise((res, rej) => {
    fs.readFile(path, { encoding: 'utf8' }, function(err, data) {
      return (err) ? rej(err) : res(data);
    });
  });
};


wf.write = function (path, data) {
  return new Promise((res, rej) => {
    fs.writeFile(path, data, 'utf8', function (err) {
      return (err) ? rej(err) : res();
    });
  });
};