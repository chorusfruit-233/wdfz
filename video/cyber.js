/* Optional recorded player for the public server route. No game-state writes.
 * Puzzle answers are derived only from text actually printed by the terminal.
 */
'use strict';
var PilotCyber=(function(){
  function solve(files){
    const zone=/试点区域=(\S+)/.exec(files['/school/site.txt'])?.[1];
    const batch=/当前运行批次=(\S+)/.exec(files['/school/site.txt'])?.[1];
    const assets=files['/school/assets.tsv'].trim().split('\n').slice(1).map(row=>row.trim().split(/\s+/));
    const matches=assets.filter(row=>row[1]===zone&&row[2]===batch&&row[3]==='controller'&&row[4]==='online');
    if(matches.length!==1)throw Error('屏幕上的资产证据没有唯一控制器');
    const controller=matches[0][0];
    const logs=files['/school/runtime.log'].trim().split('\n').map(row=>Object.fromEntries(row.trim().split(/\s+/).map(x=>x.split('='))));
    const chains=new Map();
    for(const row of logs.filter(row=>row.node===controller&&row.actor==='control')){
      if(!chains.has(row.tx))chains.set(row.tx,[]);chains.get(row.tx).push(row);
    }
    const complete=[...chains.values()].map(rows=>rows.sort((a,b)=>+a.active-+b.active))
      .filter(rows=>rows.map(row=>row.event).join(',')==='prepare,authorize,commit'&&rows[2].token);
    if(complete.length!==1)throw Error('屏幕上的事务链不唯一或不完整');
    const commit=complete[0][2],edges=files['/school/services.txt'].split('\n')
      .filter(row=>/^\w+ -> \w+$/.test(row)).map(row=>row.split(' -> '));
    const roots=edges.filter(([a])=>!edges.some(([,b])=>a===b));
    if(roots.length!==1)throw Error('服务依赖没有唯一起点');
    const order=[];let current=roots[0][0];
    while(current!=='control'){
      if(order.includes(current)||order.length>3)throw Error('服务依赖有环');
      order.push(current);const next=edges.filter(([a])=>a===current);
      if(next.length!==1)throw Error('服务依赖链中断');current=next[0][1];
    }
    if(order.length!==3)throw Error('功能服务数量不正确');
    const body=['controller='+controller,'transaction='+commit.tx,'token='+commit.token,'clock=active',...order.map(x=>'stop '+x)].join('\\n');
    return {controller,transaction:commit.tx,body};
  }
  async function run(p){
    const {sleep,chapter,event,stop,tap,look,alive,defense,go,cells,interact,nearest,building,floor,officeKey,choose,bagAction,finishEnding}=p;
    const chair=()=>{const R=INTERIORS.teach1;return {x:R.ox+48.5*R.tw,y:R.oy+6.5*R.th};};
    function closePhone(){if(PHONE.on){document.querySelector('#phone .phx').click();event('input',{phone:'close'});}}
    async function phone(app){
      if(!PHONE.on)await bagAction('phone','使用',false);
      if(!PHONE.on)throw Error('正常背包操作未能打开手机');
      document.querySelector('#phapps [data-app="'+app+'"]').click();event('input',{phone:app});await sleep(1200);
    }
    async function seat(){
      closePhone();if(S.seated&&atMySeat())return;
      await go(chair(),11);await tap('e');await sleep(600);
      if(!S.seated||!atMySeat())throw Error('没有通过普通交互坐回教室座位');
    }
    async function classWait(done,app){
      stop();let showAt=0,standing=false,lastStatus=0;
      const deadline=performance.now()+2400000;
      while(!done()){
        alive();if(performance.now()>deadline)throw Error('教室等待超时');
        // Stand periodically: remaining seated indefinitely causes assimilation.
        if(!Inspection.active()&&!UI.anyOpen()){
          if(S.seated&&S.tt>52){closePhone();await tap('e');standing=true;event('rest','起身缓解同化');}
          else if(!S.seated&&(S.tt<12||PatrolWorld.localChase()||AN.id==='bell13')){await seat();standing=false;event('rest','坐回原位');}
        }
        await defense();
        if(S.san<48&&hasItem('pill')){closePhone();await bagAction('pill','使用');}
        if(!PHONE.on&&PhoneNetwork.available()&&!UI.anyOpen()&&!Inspection.active()&&performance.now()>showAt){
          await phone(app);showAt=performance.now()+30000;
        }
        if(performance.now()-lastStatus>30000){lastStatus=performance.now();event('wait',{standing,app});}
        await sleep(200);
      }
      closePhone();
    }
    chapter('科技党：在原教室充电并接入校园无线网');
    await seat();await phone('wireless');
    document.querySelector('#phone [data-action="wireless"]').click();
    event('input',{phone:'startWireless'});event('milestone','wirelessStarted');
    await classWait(()=>PhoneNetwork.device.network,'wireless');event('milestone','wirelessConnected');
    chapter('完成容器下载，留足外出电量');
    await classWait(()=>PhoneNetwork.device.download.status==='complete','container');event('milestone','containerReady');
    await classWait(()=>PhoneNetwork.device.battery>=97,'home');
    await phone('location');await sleep(4000);closePhone();
    await officeKey('roomkey');
    chapter('携带手机与钥匙，进入实验楼三楼机房');
    await floor(1);await nearest('O',16);await building('lab');await floor(3);
    async function openTerminal(){
      if(TerminalUI.on)return;
      closePhone();await nearest('nK',10);
      const options=[...document.querySelectorAll('#choices button')];
      const n=options.findIndex(b=>b.textContent.includes('打开服务器终端'));
      if(n<0)throw Error('没有机房电脑的终端选项');await choose(n+1);
      if(!TerminalUI.on)throw Error('终端没有打开（电量、容器或接线条件不足）');
    }
    async function command(line,pause=2600){
      await openTerminal();
      const input=document.getElementById('campus-command');input.focus();input.value=line;
      input.dispatchEvent(new Event('input',{bubbles:true}));event('input',{terminal:line});
      await sleep(1000);input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
      await sleep(200);
      const output=document.querySelector('#campus-terminal pre').textContent,marker='$ '+line+'\n';
      const at=output.lastIndexOf(marker);if(at<0)throw Error('命令未经过终端输入处理：'+line);
      const printed=output.slice(at+marker.length);
      if(printed.startsWith('错误：'))throw Error(printed);
      event('terminal-output',{command:line,text:printed});await sleep(pause);alive();return printed;
    }
    chapter('维护终端：阅读实际档案，关联控制器与事务');
    await openTerminal();await command('help');await command('cat /school/README');await command('man campusctl');
    const files={};
    for(const file of ['/school/site.txt','/school/assets.tsv','/school/runtime.log','/school/services.txt']){
      files[file]=await command('cat '+file,4500);event('terminal-file',{file,text:files[file]});
    }
    const solution=solve(files);
    await command('campusctl select '+solution.controller+' /school/assets.tsv');event('milestone','controllerSelected');
    await command('campusctl trace '+solution.transaction+' /school/runtime.log');event('milestone','transactionTraced');
    chapter('阅读公司的解释与矛盾档案，提交有序停机清单');
    await command('cat /school/company.txt',5000);await command('cat /school/archive.txt',6000);
    await command('edit /work/shutdown "'+solution.body+'"');await command('cat /work/shutdown',4500);
    await command('campusctl validate /work/shutdown');event('milestone','shutdownValidated');
    await command('campusctl shutdown --confirm',0);event('milestone','shutdownAccepted');
    if(Termination.state.status!=='accepted')throw Error('服务器没有接受请求');
    document.querySelector('#campus-terminal [data-exit]').click();event('input',{terminal:'exit'});
    chapter('停机请求已提交：返回教室，实际存活十分钟');
    await floor(1);await nearest('O',16);await building('teach');await seat();
    await classWait(()=>Termination.state.status!=='accepted','container');
    if(Termination.state.status!=='completed')throw Error('停机请求在等待中失效');
    event('milestone','serverCompleted');await finishEnding('cyber');
  }
  return {solve,run};
})();
if(typeof module!=='undefined')module.exports=PilotCyber;
