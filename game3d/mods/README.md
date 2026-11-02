# game3d/mods：自带 Mod

这里放随游戏一起发布、默认关闭的 Mod。完整规范见 [docs/模块化与Mod规范.md](../../docs/模块化与Mod规范.md)。

- 新 Mod：新建 `game3d/mods/<id>.js`，文件里调用一次 `GameModules.mod({...})`。
- 想在暂停菜单「Mod 与模块」里出现开关：在 `index.js` 里加一行登记。
- 不登记也能用：网址加 `?mod=<id>`（多个用逗号隔开）。
- 玩家也可以不放进仓库，直接在「Mod 与模块」里导入 `.js` 文件，存在自己浏览器里。
- `?nomod` 是安全模式：一个 Mod 都不加载。

最小模板：

```js
GameModules.mod({
  id:'my-mod', name:'我的 Mod', version:'1.0.0', api:'1.0',
  init:function(api){
    api.on('enterRoom',function(id){ api.toast('进入 '+id); });
  }
});
```
