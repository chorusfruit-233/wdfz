/* 宣传片镜头脚本（不随游戏加载，只由 video/render.py 注入页面）
   每一帧：按时间找到当前镜头 → 第一次进入时搭场景 → 摆镜头和特效 → 用固定步长调一次游戏的 render()。
   镜头表和时长在 video/timeline.json，配乐也按同一张表对齐。 */
'use strict';

var TRL={tl:null,fps:24,cur:-1,starts:[],d:{},grp:null};

/* ---------- 画面上的字 ---------- */
function trlCss(){
  var st=document.createElement('style');
  st.textContent=[
    '#hud,#prompt,#cross,#touch,#lookhint,#sub,#searchring,.screen-control,#toast,#banner,#mini,#skip{display:none!important}',
    '#trlbars i{position:fixed;left:0;right:0;height:9vh;background:#000;z-index:60}',
    '#trlbars i:first-child{top:0}#trlbars i:last-child{bottom:0}',
    '#trlblack{position:fixed;inset:0;background:#000;z-index:61;opacity:0}',
    '#trlslits{position:fixed;inset:0;z-index:59;opacity:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,.97) 0 7.2vh,rgba(0,0,0,.15) 7.2vh 10.4vh);box-shadow:inset 0 0 22vh 6vh #000}',
    '#trltxt{position:fixed;inset:0;z-index:62;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;',
    '  font-family:"WenQuanYi Zen Hei",sans-serif;color:#d9dcd4}',
    '#trltxt .l{font-size:4.6vh;letter-spacing:1.6vh;margin:1.4vh 0;opacity:0;text-shadow:0 0 2.4vh rgba(0,0,0,.9)}',
    '#trltxt .big{font-size:8.4vh;letter-spacing:2.6vh;color:#e8e2d6;text-shadow:0 0 3vh rgba(160,20,10,.55),0 0 1vh #000}',
    '#trltxt .sub{font-size:2.8vh;letter-spacing:1.2vh;color:#8f9a92;margin-top:4vh}',
    '#trlloc{position:fixed;left:6vw;bottom:13vh;z-index:62;font-family:"WenQuanYi Zen Hei",sans-serif;color:#cfd3cb;opacity:0;text-shadow:0 0 1.4vh #000}',
    '#trlloc b{display:block;font-weight:400;font-size:4.2vh;letter-spacing:1.2vh}',
    '#trlloc i{display:block;font-style:normal;font-size:2.3vh;letter-spacing:.7vh;color:#8d9a92;margin-top:1.2vh;border-top:1px solid rgba(200,60,40,.55);padding-top:1.2vh}',
    '#trlttl{position:fixed;left:0;right:0;top:50%;transform:translateY(-50%);z-index:62;text-align:center;font-family:"WenQuanYi Zen Hei",sans-serif;',
    '  font-size:7.4vh;letter-spacing:3vh;color:#efe6da;opacity:0;text-shadow:0 0 3vh rgba(170,10,0,.85),0 0 .6vh #000}',
    '#trlcap{position:fixed;left:0;right:0;bottom:13vh;z-index:62;text-align:center;font-family:"WenQuanYi Zen Hei",sans-serif;font-size:3.4vh;letter-spacing:1vh;color:#d6d8d0;opacity:0;text-shadow:0 0 1.2vh #000}'
  ].join('\n');
  document.head.appendChild(st);
  document.body.insertAdjacentHTML('beforeend',
    '<div id="trlslits"></div><div id="trlbars"><i></i><i></i></div><div id="trlblack"></div>'+
    '<div id="trltxt"></div><div id="trlloc"><b></b><i></i></div><div id="trlttl"></div><div id="trlcap"></div>');
}
function $t(id){ return document.getElementById(id); }
function trlOp(id,v){ $t(id).style.opacity=String(clamp(v,0,1)); }
/* 淡入 → 停 → 淡出；加一点老灯管似的抖 */
function trlEnv(t,a,b,fin,fout){ return clamp(Math.min((t-a)/(fin||0.5),(b-t)/(fout||0.5)),0,1); }
function trlFlick(t,seed){ var x=Math.sin(t*61.7+seed*7.3)*Math.sin(t*23.1+seed); return x>0.93?0.35:1; }

/* ---------- 工具 ---------- */
function trlLook(px,py,pz,tx,ty,tz){ GLR.cam.position.set(px,py,pz); GLR.cam.up.set(0,1,0); GLR.cam.lookAt(tx,ty,tz); }
function trlRoom(id){ S.mode='in'; S.room=id; doEnterRoom(id); running=false; S.screen='cut'; }
function trlOut(){ S.mode='out'; S.room=null; enterWorldOut(); }
function trlCell(room,c,r){ var R=INTERIORS[room]; return worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r+0.5)*R.th,R); }
function trlWorld(room,c,r){ var R=INTERIORS[room]; return {x:R.ox+(c+0.5)*R.tw,y:R.oy+(r+0.5)*R.th}; }
function trlMap(mx,my){ return worldToScene(mx*SC,my*SC,null); }
function trlAdd(o){ if(!TRL.grp){ TRL.grp=new THREE.Group(); GLR.scene.add(TRL.grp); } TRL.grp.add(o); return o; }
function trlReset(){
  try{ anfxClear(); }catch(e){}
  try{ patRemoveFig(); }catch(e){}
  if(TRL.grp){ GLR.scene.remove(TRL.grp); TRL.grp=null; }
  if(CUT.grp){ GLR.scene.remove(CUT.grp); CUT.grp=null; }
  AN.active=false; AN.id=null; AN.acc=0; AN.t=0; AN.data={};
  PAT.state='idle'; GLR.patrolRed=0; GLR.patrolFlick=0; GLR.gazeT=0; GLR.gaze=0; GLR.flash=0; GLR.worldNorm=0; GLR.hurt=0;
  ROAM.on=false; USE.torch=false; GLR.torch.intensity=0; S.san=100; S.dead=false;
  S.floorY=0; GLR.dayExpo=1;
  ['trlloc','trlttl','trlcap','trlslits'].forEach(function(id){ trlOp(id,0); });
  trlOp('trltxt',1);
  $t('trltxt').innerHTML='';
}
function trlLines(lines,cls,sub){
  $t('trltxt').innerHTML=lines.map(function(s,i){ return '<div class="l '+(cls||'')+'" data-i="'+i+'">'+s+'</div>'; }).join('')+
    (sub?'<div class="l sub" data-i="'+lines.length+'">'+sub+'</div>':'');
}
function trlLinesOp(fn){ var ls=$t('trltxt').querySelectorAll('.l'); for(var i=0;i<ls.length;i++) ls[i].style.opacity=String(clamp(fn(i),0,1)); }
/* 高二（六）班坐满：游戏里一层楼最多刷 34 个同学，按行从左到右排，六班常常只剩几个 */
function trlFillClass(){
  var R=INTERIORS.teach1, c, r;
  for(r=1;r<R.rows-1;r++) for(c=45;c<=51;c++){
    if(R.grid[r][c]!=='d'||NC.occ[c+','+r]||(c===48&&r===6)) continue;
    var sp=worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r+0.82)*R.th,R);
    var f=ncSeatFigure(NC.matS,sp.x,0,sp.z,0); NC.grp.add(f); NC.list.push(f); NC.occ[c+','+r]=1;
  }
}
function trlLoc(sh){ $t('trlloc').querySelector('b').textContent=sh.loc||''; $t('trlloc').querySelector('i').textContent=sh.note||''; }

/* ---------- 镜头 ---------- */
var TRL_SHOT={
  /* 黑场，两行字 */
  open:{setup:function(sh){ trlOut(); S.tsec=1360; trlLines(sh.lines); },
    frame:function(k,t,sh){ trlOp('trlblack',1);
      trlLinesOp(function(i){ return trlEnv(t,1.0+i*2.0,sh.dur-0.6,0.9,0.6)*trlFlick(t,i); });
      var g=trlMap(GATE_N.x,GATE_N.y); trlLook(g.x,1.6,g.z-14,g.x,2.4,g.z+24); }},
  /* 北门外，雾里慢慢往门口推：门头写着校名，里面一盏灯都没有 */
  gate:{setup:function(sh){ trlOut(); S.tsec=1128; trlLoc(sh); },
    frame:function(k,t,sh){
      var g=trlMap(GATE_N.x,GATE_N.y), z=cutLerp(g.z-17,g.z-6.5,cutEase(k));
      trlLook(g.x+Math.sin(t*0.4)*0.25,1.55,z,g.x,3.0,g.z+30);
      trlOp('trlblack',1-clamp(t/1.6,0,1)+clamp((t-sh.dur+0.35)/0.35,0,1));
      trlOp('trlloc',trlEnv(t,1.2,sh.dur-0.4,0.8,0.5)); }},
  /* 教学楼北墙，从一楼慢慢仰到楼顶 */
  facade:{setup:function(sh){ trlOut(); S.tsec=1125; trlLoc(sh); },
    frame:function(k,t,sh){
      var p=trlMap(560,800), w=trlMap(560,865);
      trlLook(p.x-6+k*4,1.5,p.z,w.x,2+cutEase(k)*15,w.z);
      trlOp('trlblack',clamp(1-t/0.5,0,1)); trlOp('trlloc',trlEnv(t,0.6,sh.dur-0.3,0.7,0.4)); }},
  /* 教室后排往讲台慢慢推；同学都背对着你，中间那个座位空着 */
  class:{setup:function(sh){ S.tsec=600; trlRoom('teach1'); trlFillClass(); S.tsec=1300; trlLoc(sh); },     /* 上课时间进屋：同学坐满，再把天调到夜里 */
    frame:function(k,t,sh){
      var a=trlCell('teach1',48,13.4), b=trlCell('teach1',48,8.5), f=trlCell('teach1',48,1);
      trlLook(a.x+Math.sin(t*0.7)*0.05,1.45,cutLerp(a.z,b.z,cutEase(k)),f.x,1.25,f.z);
      trlOp('trlblack',clamp(1-t/0.4,0,1)); trlOp('trlloc',trlEnv(t,0.5,sh.dur-0.3,0.7,0.4)); }},
  /* 夜里的走廊：灯按两短一长闪，尽头站着一个人 */
  hall:{setup:function(sh){ trlRoom('teach1'); S.tsec=1350; trlLoc(sh);
      patAddFig(); var w=trlWorld('teach1',21,18.2); PAT.state='walk'; PAT.room='teach1'; PAT.x=w.x; PAT.y=w.y; },
    frame:function(k,t,sh){
      var a=trlCell('teach1',4,18), b=trlCell('teach1',58,18);
      var x=cutLerp(a.x,a.x+5.5,k);
      trlLook(x,1.55+Math.sin(t*5.2)*0.015,a.z+Math.sin(t*2.6)*0.03,b.x,1.5,b.z);
      GLR.patrolFlick=clamp((t-1.2)/1.2,0,1);
      if(GLR.patFig) GLR.patFig.visible=t>2.4&&(Math.sin(t*90)>-0.2||t>3.2);
      trlOp('trlblack',clamp(1-t/0.3,0,1)); trlOp('trlloc',trlEnv(t,0.5,sh.dur-0.3,0.7,0.4)); }},
  /* 钟楼：站在旋转楼梯底下往上看，镜头慢慢转 */
  bell:{setup:function(sh){ trlRoom('bell1'); S.tsec=1355; trlLoc(sh); },
    frame:function(k,t,sh){
      /* 站在门口（两张供桌中间）往上看整座旋转楼梯，镜头慢慢横移，最后抬到顶上的钟 */
      var cx=SPIRAL.cx, cz=SPIRAL.cz;
      trlLook(cx+1.3-k*2.2,0.75,cz+5.7, cx,2.6+cutEase(k)*5.8,cz);
      trlOp('trlblack',clamp(1-t/0.4,0,1)); trlOp('trlloc',trlEnv(t,0.6,sh.dur-0.3,0.7,0.4)); }},
  /* 车库：手电照着一排排车走，最后一照，车之间站着那个人 */
  garage:{setup:function(sh){ trlRoom('garage1'); S.tsec=1355; trlLoc(sh); USE.torch=true;
      var w=trlWorld('garage1',36,10.5); ROAM.on=true; ROAM.x=w.x; ROAM.y=w.y; },
    frame:function(k,t,sh){
      var a=trlCell('garage1',6,11), b=trlCell('garage1',20,11), z=trlCell('garage1',40,10.5);
      var x=cutLerp(a.x,b.x,k), sw=Math.sin(t*1.7)*0.35;
      var tx=t<3.6?x+6:z.x, tz=t<3.6?a.z+sw*3:z.z;
      trlLook(x,1.55+Math.abs(Math.sin(t*4.4))*0.03,a.z,tx,1.3,tz);
      GLR.torch.intensity=55*((Math.sin(t*37)>0.85&&t>3.2)?0.15:1);
      GLR.roamFig&&(GLR.roamFig.visible=t>3.5);
      trlOp('trlblack',clamp(1-t/0.4,0,1)+clamp((t-sh.dur+0.2)/0.2,0,1));
      trlOp('trlloc',trlEnv(t,0.5,sh.dur-0.8,0.7,0.4)); }},
  card1:{setup:function(sh){ trlLines(sh.lines); },
    frame:function(k,t,sh){ trlOp('trlblack',1); trlLinesOp(function(i){ return trlEnv(t,0.3+i*0.9,sh.dur-0.2,0.5,0.3)*trlFlick(t,i+3); }); }},
  /* 雨：校门里的路上，抬头看雨落下来，打两道闪 */
  rain:{setup:function(sh){ trlOut(); S.tsec=1350; S.x=560*SC; S.y=820*SC;
      AN.active=true; AN.id='rain'; anfxSpawn('rain',S.x,S.y); $t('trlttl').textContent=sh.title; },
    frame:function(k,t,sh){
      var p=trlMap(560,820), w=trlMap(590,865);
      trlLook(p.x,1.55,p.z,w.x,3.2+k*2,w.z);
      if(WX.rain){ if((t>0.9&&!TRL.d.b1)){ TRL.d.b1=1; WX.rain.nextBolt=0; } if(t>3.0&&!TRL.d.b2){ TRL.d.b2=1; WX.rain.nextBolt=0; } }
      GLR.overcast=1;
      trlOp('trltxt',0); trlOp('trlttl',trlEnv(t,1.0,sh.dur-0.2,0.15,0.2)*trlFlick(t,2));
      trlOp('trlblack',clamp(1-t/0.15,0,1)); }},
  /* 蛾群：路灯下，一整团扑过来 */
  moth:{setup:function(sh){ trlOut(); S.tsec=1112; S.x=560*SC; S.y=800*SC; S.ang=PI/2;
      AN.active=true; AN.id='moth'; AN.data={src:{x:S.x+25,y:S.y+8}}; anfxSpawn('moth',S.x+25,S.y+8); $t('trlttl').textContent=sh.title; },
    frame:function(k,t,sh){
      var p=trlMap(560,800), s=trlMap(572.5,804);
      AN.acc=k*7;
      trlLook(p.x,1.5,p.z,s.x,2.6-k*0.7,s.z);                        /* 往上看：黑蛾子衬着傍晚的天 */
      trlOp('trlttl',trlEnv(t,0.9,sh.dur-0.2,0.15,0.2)*trlFlick(t,5)); trlOp('trlblack',clamp(1-t/0.15,0,1)); }},
  /* 全体回头：教室墙上一只只睁开的眼睛 */
  stare:{setup:function(sh){ S.tsec=600; trlRoom('teach1'); trlFillClass(); S.tsec=1300; var w=trlWorld('teach1',48,9); S.x=w.x; S.y=w.y; S.ang=-PI/2;
      AN.active=true; AN.id='stare'; AN.acc=0; AN.data={}; anfxSpawn('stare',S.x,S.y); $t('trlttl').textContent=sh.title; },
    frame:function(k,t,sh){
      var a=trlCell('teach1',48,9), f=trlCell('teach1',48+Math.sin(t*0.5)*3,1);
      AN.acc=k*2.2; if(t>2.8) AN.data.hit=1;
      trlLook(a.x,1.5,a.z+0.6-k*0.6,f.x,1.5,f.z);
      trlOp('trlttl',trlEnv(t,1.0,sh.dur-0.2,0.15,0.2)*trlFlick(t,7)); trlOp('trlblack',clamp(1-t/0.15,0,1)); }},
  /* 清华水杯：抬头，四楼窗台上在晃；它掉下来，正对着镜头 */
  cup:{setup:function(sh){ trlOut(); S.tsec=1110; S.x=560*SC; S.y=857*SC; S.ang=PI/2;
      AN.active=true; AN.id='cup'; AN.t=0; AN.data={wall:cupWall(),phase:0,wob:1.6}; anfxSpawn('cup',S.x,S.y);
      $t('trlttl').textContent=sh.title; },
    frame:function(k,t,sh){
      var d=AN.data, p=trlMap(560,834), sill=ANFX.cup&&ANFX.cup.sill;
      AN.t=t;
      if(t>=1.6&&d.phase===0){ d.phase=1; d.tf=1.6; d.lx=560*SC; d.ly=850*SC; }
      if(d.phase===1&&t-d.tf>=cupFallTime()){ d.phase=2; d.tl=t; GLR.flash=0.9; }
      var up=d.phase===0?1:(d.phase===1?1-cutEase((t-d.tf)/cupFallTime()):0);
      var ty=d.phase===2?0.1:(sill?cutLerp(0.3,CUP_H,up):10);
      var shake=d.phase===2&&t-d.tl<0.4?(Math.random()-0.5)*0.12:0;
      trlLook(p.x+shake,1.6,p.z,sill?sill.x:p.x,ty,sill?sill.z:p.z+5);
      trlOp('trlttl',trlEnv(t,0.5,sh.dur-0.2,0.15,0.2)*trlFlick(t,9));
      trlOp('trlblack',clamp(1-t/0.15,0,1)+(d.phase===2&&t-d.tl>0.25?1:0)); }},
  /* 巡察者：灯一下子全红，它从走廊尽头走过来 */
  patrol:{setup:function(sh){ trlRoom('teach1'); S.tsec=600; patAddFig(); PAT.state='walk'; PAT.room='teach1'; PAT.locked=false;
      $t('trlttl').textContent=sh.title; },
    frame:function(k,t,sh){
      var c=trlCell('teach1',20,18), w0=trlWorld('teach1',44,18), w1=trlWorld('teach1',24.5,18);
      var u=cutEase(clamp((t-0.6)/(sh.dur-0.9),0,1));
      PAT.x=cutLerp(w0.x,w1.x,u); PAT.y=w0.y; PAT.locked=t>1.6;
      GLR.patrolFlick=clamp(t/0.8,0,1); GLR.patrolRed=clamp((t-1.6)/0.5,0,1);
      var pz=trlCell('teach1',44,18), tgt=cutLerp(pz.x,c.x+4.5,u);
      trlLook(c.x,1.55,c.z,tgt,2.0+u*0.6,c.z);
      trlOp('trlttl',trlEnv(t,1.7,sh.dur-0.2,0.15,0.2)*trlFlick(t,11));
      trlOp('trlblack',clamp(1-t/0.15,0,1)+clamp((t-sh.dur+0.12)/0.12,0,1)); }},
  card2:{setup:function(sh){ trlLines(sh.lines); },
    frame:function(k,t,sh){ trlOp('trlblack',1); trlLinesOp(function(i){ return trlEnv(t,0.3+i*1.0,sh.dur-0.2,0.5,0.3)*(i===1?1:trlFlick(t,i+13)); }); }},
  /* 柜子里：从门缝往外看，它从面前走过去 */
  locker:{setup:function(sh){ trlRoom('teach1'); S.tsec=600; patAddFig(); PAT.state='walk'; PAT.room='teach1'; PAT.locked=true; $t('trlcap').textContent=sh.caption; },
    frame:function(k,t,sh){
      var c=trlCell('teach1',30,16.2), o=trlCell('teach1',30,19.5), w0=trlWorld('teach1',22,18.6), w1=trlWorld('teach1',38,18.6);
      PAT.x=cutLerp(w0.x,w1.x,k); PAT.y=w0.y;
      GLR.patrolRed=0.85; GLR.patrolFlick=0.6;
      trlLook(c.x,1.5+Math.sin(t*1.1)*0.01,c.z,o.x,1.6,o.z);
      trlOp('trlslits',1); trlOp('trlcap',trlEnv(t,0.6,sh.dur-0.3,0.6,0.4)); trlOp('trlblack',clamp(1-t/0.4,0,1)); }},
  /* 门：物理实验室里撑开一个光圈 */
  portal:{setup:function(sh){ trlRoom('lab1'); S.tsec=1300; TRL.d.pd={}; CUT_DEF.portal.setup(TRL.d.pd); $t('trlcap').textContent=sh.caption; },
    frame:function(k,t,sh){ CUT_DEF.portal.frame(k*0.7,TRL.d.pd);      /* 只推到光圈前面，不钻进去（不然最后一秒是整屏白） */
      trlOp('trlcap',trlEnv(t,0.5,sh.dur-0.3,0.6,0.4)); trlOp('trlblack',clamp(1-t/0.4,0,1)); }},
  /* 车：冲出北门，后视镜里学校的窗一扇扇暗下去 */
  escape:{setup:function(sh){ TRL.d.ed={}; CUT_DEF.car.setup(TRL.d.ed); S.tsec=1125; $t('trlcap').textContent=sh.caption; },
    frame:function(k,t,sh){ GLR.dayExpo=1; CUT_DEF.car.frame(k*0.8,TRL.d.ed); cutFade(0);
      trlOp('trlcap',trlEnv(t,0.5,sh.dur-0.3,0.6,0.4)); trlOp('trlblack',clamp(1-t/0.4,0,1)+clamp((t-sh.dur+0.3)/0.3,0,1)); }},
  /* 最后一串闪切：脸、眼睛、红灯、雨 */
  flurry:{setup:function(sh){ trlRoom('teach1'); S.tsec=600; patAddFig(); PAT.state='walk'; PAT.room='teach1'; PAT.locked=true;
      var w=trlWorld('teach1',30,18); PAT.x=w.x; PAT.y=w.y; },
    frame:function(k,t,sh){
      var c=trlCell('teach1',30,18), n=Math.floor(t/0.3), on=(t%0.3)<0.16+k*0.1;
      GLR.patrolRed=1; GLR.patrolFlick=1;
      var d=1.6-k*1.15, a=n*1.7;
      trlLook(c.x+Math.cos(a)*d,1.6+Math.sin(n*2.3)*0.3,c.z+Math.sin(a)*0.25+d*0.4,c.x,2.55,c.z);
      GLR.flash=on&&n%3===0?0.4:0;
      trlOp('trlblack',on?0:1); }},
  title:{setup:function(sh){ trlLines(sh.lines,'big',sh.sub); },
    frame:function(k,t,sh){ trlOp('trlblack',1);
      trlLinesOp(function(i){ return i===0?trlEnv(t,0.6,sh.dur-0.4,1.8,0.8)*trlFlick(t,21):trlEnv(t,3.2,sh.dur-0.4,1.4,0.8); }); }},
  whisper:{setup:function(sh){ trlLines(sh.lines); },
    frame:function(k,t,sh){ trlOp('trlblack',1); trlLinesOp(function(){ return trlEnv(t,0.8,sh.dur-0.5,0.2,0.5)*0.75; }); }}
};

/* ---------- 入口 ---------- */
function trailerInit(tl){
  TRL.tl=tl; TRL.fps=tl.fps; var s=0;
  TRL.starts=tl.shots.map(function(sh){ var a=s; s+=sh.dur; return a; });
  TRL.total=s;
  trlCss();
  PHOTO_TRIED=true; running=false; CUT.enabled=false;
  document.getElementById('menu').style.display='none';
  S.screen='cut'; S.dead=false; S.diff='normal'; S.san=100; PRO.on=false; PAUSE.on=false; AMB_ON=false;
  Settings.q(2);
  GLR.postMat.uniforms.uBright.value=1.25;          /* 宣传片整体提一点亮度，暗部还是黑的 */
  return Math.round(s*TRL.fps);
}
function trailerFrame(i){
  var t=i/TRL.fps, n=TRL.tl.shots.length, j=0;
  while(j<n-1&&t>=TRL.starts[j+1]) j++;
  var sh=TRL.tl.shots[j], lt=t-TRL.starts[j];
  if(j!==TRL.cur){ TRL.cur=j; TRL.d={}; trlReset(); TRL_SHOT[sh.id].setup(sh); }
  S.screen='cut';
  TRL_SHOT[sh.id].frame(clamp(lt/sh.dur,0,1),lt,sh);
  GLR.time=(GLR.time||0)+1/TRL.fps;
  render(1/TRL.fps);
  return sh.id;
}
