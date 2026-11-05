/* 示例 Mod：进门提示与纸条
   演示 Mod 的三件事：① 挂钩子（enterRoom）；② 存自己的状态（api.store）；③ 用 api 加一件物品（调试面板物品页可以拿到）。
   打开方式：暂停菜单「Mod 与模块」→ 自带的 Mod → 打开 → 刷新；或网址加 ?mod=example-hello。 */
GameModules.mod({
  id:'example-hello',
  name:'示例：进门提示与纸条',
  version:'1.0.0',
  author:'wdfz',
  api:'1.0',
  desc:'每进一个没去过的地方提示一次地名；加一件「示例纸条」（调试面板物品页可以拿）。',
  init:function(api){
    var seen={};
    api.addItem('mod_note',{name:'示例纸条',desc:'一张 DLC 加进来的纸条。',glyph:'✉',color:'#d8c48a',
      use:function(){ api.say('我：纸条上写着：「这一行字是 DLC 写的。」'); }});
    api.store({
      save:function(){ return {seen:seen}; },
      load:function(d){ seen=(d&&d.seen)||{}; },
      reset:function(){ seen={}; }
    });
    api.on('enterRoom',function(id,restoring){
      if(restoring||seen[id]) return;
      seen[id]=1;
      var R=INTERIORS[id];
      api.toast('【示例 DLC】第一次来到：'+(R?R.name:id));
    });
  }
});
