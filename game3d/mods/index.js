/* 里世界 3D · 自带 Mod 登记表
   game3d/mods/ 里自带的 Mod 在这里登记一行，玩家在暂停菜单「Mod 与模块」或调试面板「Mod」页里打开（默认都关着）。
   不想登记也行：网址加 ?mod=文件名（不带 .js，多个用逗号隔开）直接加载 game3d/mods/文件名.js。
   写法见 docs/模块化与Mod规范.md 和 game3d/mods/README.md。 */
'use strict';
GameModules.builtin([
  {id:'example-hello', name:'示例：进门提示与纸条', desc:'演示钩子、存档和加物品；每进一个新地方提示一次地名'}
]);
