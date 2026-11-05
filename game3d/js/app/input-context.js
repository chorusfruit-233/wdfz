/* 输入与暂停策略：只读上下文，不依赖浏览器、渲染器或全局游戏状态。 */
'use strict';

var GamePolicy={
  mode:function(c){
    /* 新旧演出可同时留有兼容标志，正式过场拥有跳过动作。 */
    if(c.screen==='cut')return 'cutscene';
    if(c.dead)return 'death';
    if(c.prologue)return 'prologue';
    return c.screen==='play'?'play':c.screen||'menu';
  },
  presentationAllowed:function(c){
    return c.screen==='play'&&!c.prologue&&!c.debugFrozen&&!c.hidden&&!c.rendererBusy;
  },
  simulationAllowed:function(c){
    return this.presentationAllowed(c)&&!c.dead&&!c.paused&&!c.panelOpen&&!c.computer&&!c.intro;
  },
  playerAllowed:function(c){
    return this.simulationAllowed(c)&&!c.phone&&!c.terminal&&!c.lesson&&!c.broadcast&&!c.debugDragging&&!c.intro;
  },
  inputOwner:function(c){
    if(c.rendererBusy)return 'blocked';
    if(c.targetDebug)return 'debug';
    if(c.terminal)return 'terminal';
    if(c.editing)return 'text';
    var mode=this.mode(c);
    if(mode==='cutscene')return 'cutscene';
    if(mode==='death')return c.deathPending?'death':'inactive';
    if(mode==='prologue')return 'prologue';
    if(mode!=='play')return 'inactive';
    if(c.computer)return 'computer';
    if(c.lesson)return 'lesson';
    if(c.phone)return 'phone';
    if(c.paused)return 'pause';
    if(c.choice)return 'choice';
    if(c.broadcast)return 'broadcast';
    if(c.debugFrozen||c.debugDragging||c.intro)return 'blocked';
    if(c.driving)return 'driving';
    if(c.panelOpen)return 'panel';
    return 'player';
  },
  describe:function(c){
    return {mode:this.mode(c),input:this.inputOwner(c),simulation:this.simulationAllowed(c),
      presentation:this.presentationAllowed(c),player:this.playerAllowed(c)};
  }
};
