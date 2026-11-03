/* @module-capsule */
(function($imports){
/* 新终端不占 PC.on；文本输入拥有键盘，但世界仍推进。 */
'use strict';
var TerminalUI={on:false,puzzle:null,
  fitViewport:function(){
    if(!this.on)return;var el=this.element(),v=window.visualViewport,h=v?v.height:innerHeight,w=v?v.width:innerWidth;
    el.style.top=((v?v.offsetTop:0)+h/2)+'px';el.style.left=((v?v.offsetLeft:0)+w/2)+'px';
    el.style.width=Math.min(740,w-16)+'px';el.style.maxHeight=Math.max(120,h-16)+'px';
    el.classList.toggle('term-compact',h<460);
  },
  resetPuzzle:function(){this.close();this.puzzle=$imports.CampusTerminal.fresh($imports.Mechanics.runSeed,$imports.Mechanics.attemptId);},
  element:function(){
    var el=document.getElementById('campus-terminal');if(el)return el;
    el=document.createElement('section');el.id='campus-terminal';el.hidden=true;el.setAttribute('aria-label','校园维护终端');
    el.innerHTML='<header><b>机房 · 模拟 Linux 终端</b><button type="button" data-exit>退出 / Esc</button></header>'+
      '<p class="term-warning">世界仍在运行。留意脚步与灯光；退出可立即恢复操作。</p><pre aria-live="polite" tabindex="0"></pre>'+
      '<form><label for="campus-command">命令</label><textarea id="campus-command" rows="2" maxlength="4096" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="help"></textarea>'+
      '<button type="submit">执行</button></form><footer><button type="button" data-help>帮助</button><button type="button" data-hint="1">线索位置</button><button type="button" data-hint="2">关联方法</button><span data-power></span></footer>';
    document.body.appendChild(el);
    if(window.visualViewport){visualViewport.addEventListener('resize',function(){TerminalUI.fitViewport();});visualViewport.addEventListener('scroll',function(){TerminalUI.fitViewport();});}
    window.addEventListener('resize',function(){TerminalUI.fitViewport();});
    el.querySelector('[data-exit]').onclick=function(){TerminalUI.close();};
    el.querySelector('[data-help]').onclick=function(){TerminalUI.execute('help');};
    el.querySelectorAll('[data-hint]').forEach(function(b){b.onclick=function(){TerminalUI.execute('campusctl hint '+b.dataset.hint);};});
    el.querySelector('form').onsubmit=function(e){e.preventDefault();TerminalUI.execute();};
    var input=el.querySelector('textarea');input.addEventListener('input',function(){TerminalUI.puzzle.buffer=input.value;});
    /* 在目标阶段拦截，既不污染全局 KEY，也不让 Ctrl、数字或 WASD 成为游戏动作。 */
    el.addEventListener('keydown',function(e){
      if(e.key==='Escape'){e.preventDefault();TerminalUI.close();}
      else if(e.key==='Enter'&&!e.shiftKey&&e.target===input){e.preventDefault();TerminalUI.execute();}
      e.stopPropagation();
    });
    el.addEventListener('keyup',function(e){e.stopPropagation();});return el;
  },
  open:function(hit){
    if(hit&&!$imports.PhoneNetwork.connectedComputer())$imports.PhoneNetwork.connect(hit);
    if(!$imports.PhoneNetwork.connectedComputer()){(0,$imports.toast)('请先在机房电脑旁连接手机');return false;}
    if(!$imports.PhoneNetwork.available()||!$imports.PhoneNetwork.device.network||$imports.PhoneNetwork.device.download.status!=='complete'){
      (0,$imports.toast)('需要手机有电、接入网络并完成容器下载');return false;}
    if(!this.puzzle)this.resetPuzzle();
    $imports.PHONE.stop();$imports.UI.closeChoice();(0,$imports.resetInputState)();(0,$imports.releaseMouseLook)();this.on=true;
    var el=this.element();el.hidden=false;el.querySelector('textarea').value=this.puzzle.buffer;
    if(!this.puzzle.history.length)this.puzzle.history.push('模拟维护环境已连接。输入 help 或 cat /school/README。');
    this.paint();this.fitViewport();el.querySelector('textarea').focus({preventScroll:true});(0,$imports.updateTouchUI)();return true;
  },
  close:function(){
    var el=document.getElementById('campus-terminal');if(el){if(this.on&&this.puzzle)this.puzzle.buffer=el.querySelector('textarea').value;el.hidden=true;}
    if(!this.on)return;this.on=false;if(el&&el.contains(document.activeElement))document.activeElement.blur();(0,$imports.resetInputState)();(0,$imports.resumeMouseLook)();(0,$imports.updateTouchUI)();
  },
  interrupt:function(){
    if(!this.on)return;
    if($imports.S.dead||$imports.S.screen!=='play'||$imports.PAUSE.on||$imports.UI.anyOpen()||$imports.Inspection.active()||!$imports.PhoneNetwork.available()||!$imports.PhoneNetwork.connectedComputer())this.close();
    else this.paint();
  },
  execute:function(line){
    if(!this.on)return;
    if(!$imports.PhoneNetwork.available()||!$imports.PhoneNetwork.connectedComputer()){this.close();return;}
    var input=this.element().querySelector('textarea');line=line===undefined?input.value:line;
    if(!line.trim())return;
    var result=$imports.CampusTerminal.run(this.puzzle,line);
    if(result.request==='shutdown'&&!$imports.Termination.submit()){result.text='请求未被接受，请重新校验。';result.error=true;}
    this.puzzle.history.push(this.puzzle.cwd+' $ '+line,result.text);
    this.puzzle.history=this.puzzle.history.slice(-40);this.puzzle.buffer='';input.value='';this.paint();(0,$imports.autoSave)();input.focus({preventScroll:true});
  },
  paint:function(){
    if(!this.on)return;var el=this.element(),out=el.querySelector('pre'),text=this.puzzle.history.join('\n');
    if(out.textContent!==text){out.textContent=text;out.scrollTop=out.scrollHeight;}
    var p=el.querySelector('[data-power]'),label='手机 '+Math.floor($imports.PhoneNetwork.device.battery)+'% · '+($imports.Termination.state.status==='accepted'?'服务器剩余 '+Math.ceil($imports.Termination.state.remaining)+' 秒':this.puzzle.cwd);
    if(p.textContent!==label)p.textContent=label;
  }
};
GameModules.persistent('terminalPuzzle',{
  reset:function(){TerminalUI.resetPuzzle();},save:function(){return TerminalUI.puzzle;},
  load:function(d){
    try{
      if(!d||d.version!==1||d.runSeed!==$imports.Mechanics.runSeed||d.attemptId!==$imports.Mechanics.attemptId||!d.work||typeof d.work!=='object'||Array.isArray(d.work))throw new Error('谜题种子或工作区无效');
      if(Object.keys(d.work).length>32||JSON.stringify(d).length>750000)throw new Error('谜题数据过大');
      var t=$imports.CampusTerminal.fresh(d.runSeed,d.attemptId);
      Object.keys(d.work).forEach(function(p){if(p.indexOf('/work/')!==0||p.includes('..')||p.length>160||typeof d.work[p]!=='string'||d.work[p].length>8192)throw new Error('非法工作文件');t.work[p]=d.work[p];});
      t.dirs=['/work'].concat((Array.isArray(d.dirs)?d.dirs:[]).filter(function(p){return typeof p==='string'&&p.indexOf('/work/')===0&&!p.includes('..')&&p.length<=160;}).slice(0,31));
      t.cwd=d.cwd==='/'||d.cwd==='/school'||t.dirs.includes(d.cwd)?d.cwd:'/school';
      t.buffer=typeof d.buffer==='string'?d.buffer.slice(0,4096):'';t.helpRead=!!d.helpRead;t.hint=(0,$imports.networkNumber)(d.hint,0,2,0);
      t.history=(Array.isArray(d.history)?d.history:[]).filter(function(x){return typeof x==='string';}).slice(-40).map(function(x){return x.slice(0,8192);});
      var a=$imports.CampusTerminal.generate(t.runSeed,t.attemptId).answer;
      if(d.controllerId===a.controller&&Array.isArray(d.evidence)&&d.evidence.includes('/school/assets.tsv')){t.controllerId=d.controllerId;t.evidence.push('/school/assets.tsv');}
      if(t.controllerId&&d.chainId===a.tx&&d.evidence.includes('/school/runtime.log')){t.chainId=d.chainId;t.evidence.push('/school/runtime.log');}
      if(d.validated&&typeof d.validated.path==='string'&&$imports.CampusTerminal.validate(t,d.validated.path).ok)t.validated=d.validated;
      if($imports.Termination.state.status==='accepted'&&d.acceptedRequestId===$imports.Termination.state.requestId)t.acceptedRequestId=d.acceptedRequestId;
      TerminalUI.puzzle=t;
    }catch(e){TerminalUI.resetPuzzle();(0,$imports.networkDiagnostic)('terminalPuzzle',e.message+'；仅重置谜题');(0,$imports.toast)('谜题数据已修复，其他进度保留');}
  }
});
GameModules.on('interact',function(){
  if($imports.S.mode!=='in'||$imports.S.room!=='lab3')return false;var hit=(0,$imports.nearWorld)(24);
  if(hit&&['n','K'].includes(hit.ch)){$imports.PhoneNetwork.computerMenu(hit);return true;}return false;
},{owner:'cyber-route',priority:10});

/* @module-exports */
GameModules.publish("game3d/js/modules/cyber-route/terminal-ui.js",{
"TerminalUI":{get:function(){return TerminalUI;},set:function($value){TerminalUI=$value;}}
});
})(GameModules.imports("game3d/js/modules/cyber-route/terminal-ui.js"));
