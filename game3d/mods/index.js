/* 里世界 3D · 自带 DLC 登记表（代码里仍叫 mod）
   game3d/mods/ 里自带的 DLC 在这里登记一行，玩家在暂停菜单「DLC 与模块」或调试面板「DLC」页里打开（默认都关着）。
   不想登记也行：网址加 ?mod=文件名（不带 .js，多个用逗号隔开）直接加载 game3d/mods/文件名.js。
   写法见 docs/模块化与Mod规范.md 和 game3d/mods/README.md。 */
'use strict';
GameModules.builtin([
  {id:'example-hello', name:'示例：进门提示与纸条', desc:'演示钩子、存档和加物品；每进一个新地方提示一次地名'},
  {id:'campus-rules', name:'规则怪谈', desc:'校园里会出现一些相互矛盾的文字，部分会影响你的行动。打开后刷新，下一局生效。'}
]);
