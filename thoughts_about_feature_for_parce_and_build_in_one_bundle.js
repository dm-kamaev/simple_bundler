'use strict';

const esprima = require('/usr/local/lib/node_modules/esprima');
const estraverse = require('/usr/local/lib/node_modules/estraverse');

var ast = esprima.parse(`
  loader.require_parallel([
    '/client/my/fn.js',
    '/client/local_storage.js',
    '/client/ui/Ui_pick_year_month.js',
    '/client/router.js',
    '/client/lib/scroll_into_view.js',
    '/client/lib/awesomplete.js',
    '/client/component.js'
  ], function () {
    loader.done(__module_name, { start: start });
  });
  loader.done(__module_name, { start: start });

  function start(main_id, str_data) {
    var fn = loader.get('/client/my/fn.js');
    var Local_storage = loader.get('/client/local_storage.js');
    var build_url = loader.get('/client/router.js').build_url;
    var Ui_pick_year_month = loader.get('/client/ui/Ui_pick_year_month.js');
    var scroll_into_view = loader.get('/client/lib/scroll_into_view.js');
    var Awesomplete = loader.get('/client/lib/awesomplete.js');
    var createComp = loader.get('/client/component.js');
  }
`);

// Читаем все файлы и находим все нужные модули и запихиваем все в стэк
// Потом делаем reverse стэк чтобы повторяющиеся модули оказались в самом верху, затем удаляем повторяющиеся модули
// Читаем из стэка модули в результирующий bundle и все вроде.
const list_modules = [];

estraverse.traverse(ast, {
  enter: function(node, parent) {
    if (node.type !== 'CallExpression') {
      return;
    }
    var { callee, arguments: argv } = node;
    if (callee.object.type !== 'Identifier' || callee.object.name !== 'loader') {
      return;
    }
    if (callee.property.name !== 'get') {
      return;
    }
    list_modules.push(argv[0].value);
    // console.log(argv.value);
    // global.process.exit();
    // if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
    //   return estraverse.VisitorOption.Skip;
    // }
  },
  leave: function(node, parent) {
    // if (node.type == 'VariableDeclarator')
      // console.log(node.id.name);
  }
});

console.log(list_modules);