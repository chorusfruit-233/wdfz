/* 里世界 3D · 调试面板 */
'use strict';

var DEV={on:false,fast:false,god:false};
var DEV_POI=[
  ['北门',514,115],['西小门',214,624],['南门',386,1276],
  ['大操场',344,350],['花园雕塑',535,1020],['车库入口',485,163],
  ['宿舍区',420,1160],['食堂西门',530,1160],['教学楼前',561,995],
  ['东干道',704,600],['东围墙',800,700],['垃圾房',768,1134]
];
var DEV_DEATH=[
  ['黑影逼近','vignette'],['地面翻起','floor'],['脚下伸手','grip'],['侧向长条','neck'],
  ['影子','shadow'],['蛾群','swarm'],['雨','drown'],['水','water'],['冻','freeze'],
  ['回头','gaze'],['围观','stare'],['广播','voice'],['钟声','bell'],['跟随','follow'],
  ['碎裂','shatter'],['深坑','deep'],['仪式圈','ring'],['名单','names'],['黑板','chalk'],
  ['走廊','loop'],['双生','twin'],['灯','lamps'],['缝隙','slit'],['挤墙','squeeze'],
  ['对视','face'],['墙','wall'],['笑','laugh'],['镜子','mirror']];
var Dev={
  open:function(){
    resetInputState();releaseMouseLook();
    var password=window.prompt('请输入调试密码');
    if(password!=='114514'){
      if(password!==null) toast('密码错误');
      resumeMouseLook();
      return;
    }
    DEV.on=true;
    var el=document.getElementById('dev'); if(el) el.style.display='block';
    var rs=document.getElementById('devroom');
    if(rs&&!rs.options.length){
      for(var k in INTERIORS){ var o=document.createElement('option'); o.value=k; o.textContent=(INTERIORS[k].name||k)+' ('+k+')'; rs.appendChild(o); }
      var os2=document.getElementById('devout');
      for(var i=0;i<DEV_POI.length;i++){ var p=document.createElement('option'); p.value=String(i); p.textContent=DEV_POI[i][0]; os2.appendChild(p); }
      var ds=document.getElementById('devdeath');
      for(var j=0;j<DEV_DEATH.length;j++){ var d=document.createElement('option'); d.value=DEV_DEATH[j][1]; d.textContent=DEV_DEATH[j][0]; ds.appendChild(d); }
      var ans=document.getElementById('devanom');
      for(var m=0;m<AN_ID.length;m++){ var a=document.createElement('option'); a.value=AN_ID[m]; a.textContent=(AN_NAME[AN_ID[m]]||AN_ID[m])+' ('+AN_ID[m]+')'; ans.appendChild(a); }
    }
    Dev.paint();
  },
  pos:function(){
    var el=document.getElementById('devpos'); if(!el) return;
    var s='地图 ('+Math.round(S.x/SC)+','+Math.round(S.y/SC)+')  ';
    var best=null,bd=1e9,i,o;
    for(i=0;i<OBJ.length;i++){
      o=OBJ[i];
      var cx=(o.x+o.w/2)*SC, cy=(o.y+o.h/2)*SC;
      var d=Math.sqrt((cx-S.x)*(cx-S.x)+(cy-S.y)*(cy-S.y));
      if(d<bd){ bd=d; best=o; }
    }
    if(best) s+= best.id+' ('+best.k+') '+Math.round(bd/9)+'m';
    s+='  '+(S.mode==='in'?(S.room||''):'室外');
    el.textContent=s;
  },
  fakeNormal:function(){
    var f=S.fn||(S.fn={v:0,on:false,note:true,n:0,next:0,used:{},shown:false});
    if(f.on){ f.on=false; f.v=0; try{ fnPeopleClear(); }catch(e){} toast('假正常：关'); return; }
    f.on=true; f.v=0; f.n=0; f.next=3; f.used={}; f.shown=false; f.left=(f.left||4);
    try{ fnPeopleBuild(); }catch(e){}
    toast('假正常：开（事件 4 次内结束）');
  },
  prologue:function(){
    try{ localStorage.removeItem('wdfz_pro'); }catch(e){}
    try{ Game.start(S.diff||'easy'); }catch(e){}
  },
  lamps:function(){
    try{
      S.room=S.room||'teach1'; S.mode='in';
      AN.id='lamps'; AN.active=true; AN.t=0; AN.acc=0; AN.data={};
      os('我：走廊的灯一盏一盏亮起来。',3.2);
    }catch(e){}
  },
  status:function(){
    try{
      toast('SAN '+Math.round(S.san)+' · 违规 '+Math.round(S.viol)+' · 假正常 v='+(S.fn?Math.round(S.fn.v):0)+
            ' · 第'+S.day+'天 '+fmtClock(S.tsec));
    }catch(e){}
  },
  hide:function(k){
    DEV_HIDE[k]=DEV_HIDE[k]?0:1;
    try{ if(S.mode==='out'){ clearWorldMesh(); enterWorldOut(); } }catch(e){}
    toast(k+' '+(DEV_HIDE[k]?'隐藏':'显示'));
  },
  look:function(){
    var el=document.getElementById('devlook'); if(!el) return;
    try{
      if(!GLR.outMesh||!THREE.Raycaster){ el.textContent='—'; return; }
      var rc=new THREE.Raycaster();
      var dir=new THREE.Vector3(0,0,-1).applyQuaternion(GLR.cam.quaternion);
      rc.set(GLR.cam.position, dir);
      var hits=rc.intersectObject(GLR.outMesh, true);
      if(!hits||!hits.length){ el.textContent='（没打到东西）'; return; }
      var h=hits[0], geo=h.object.geometry, col=geo.attributes.color;
      var hex='??', i0=0;
      if(col){
        i0=geo.index?geo.index.getX(h.faceIndex*3):h.faceIndex*3;
        var r=Math.round(col.getX(i0)*255), g=Math.round(col.getY(i0)*255), b=Math.round(col.getZ(i0)*255);
        hex=(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1);
      }
      var mx=Math.round(h.point.x/(SC*U2M)), mz=Math.round(h.point.z/(SC*U2M));
      el.textContent='#'+hex+'  ('+mx+','+mz+')  '+Math.round(h.distance)+'m  高'+h.point.y.toFixed(1);
    }catch(e){ el.textContent='探测失败: '+e.message; }
  },
  close:function(){DEV.on=false;var el=document.getElementById('dev');if(el)el.style.display='none';resetInputState();resumeMouseLook();},
  toggle:function(){ if(DEV.on) Dev.close(); else Dev.open(); },
  paint:function(){
    var f=document.getElementById('devfast'), g=document.getElementById('devgod'), s=document.getElementById('devst');
    if(f) f.className=DEV.fast?'on':'';
    if(g) g.className=DEV.god?'on':'';
    var sr=document.getElementById('devsearch'); if(sr) sr.className=SEARCH.on?'on':'';
    if(s) s.textContent='· ON';
  },
  fast:function(){ DEV.fast=!DEV.fast; Dev.paint(); toast(DEV.fast?'快跑 开':'快跑 关'); },
  search:function(){ SEARCH.on=!SEARCH.on; clearSearch(); Dev.paint(); toast(SEARCH.on?'翻找读条 0.8 秒：开':'翻找读条：关（立刻翻完）'); },
  god:function(){ DEV.god=!DEV.god; Dev.paint(); toast(DEV.god?'无敌 开':'无敌 关'); },
  san:function(){ S.san=100; S.stam=100; toast('SAN / 体力 已满'); },
  time:function(min){ if(min>=0) advanceGameTime(min); else rewindGameTime(-min); toast('时间 '+(min>0?'+':'')+min+' 分钟'); },
  tp:function(){
    var v=document.getElementById('devroom').value; if(!v) return;
    try{ enterRoom(v); toast('传送 → '+v); }catch(e){ toast('传送失败'); }
  },
  tpo:function(){
    var i=+document.getElementById('devout').value, p=DEV_POI[i]; if(!p) return;
    S.mode='out'; S.room=null;
    S.x=p[1]*SC; S.y=p[2]*SC; S.ang=Math.PI/2; S.pitch=0; S.seated=false;
    try{ enterWorldOut(); }catch(e){}
    toast('传送 → '+p[0]);
  },
  anom:function(){
    var id=document.getElementById('devanom').value; if(!id) return;
    try{
      if(AN.active){ try{ anEnd(); }catch(e){} }
      AN.id=id; AN.t=0; AN.acc=0; AN.active=true; AN.data={}; AN.sub=0;
      AN.lastBig=!AN_SMALL[id];
      os('【Dev】'+((AN_NAME&&AN_NAME[id])||id),2.6);
      anOn(id);
      toast('异象：'+id);
    }catch(e){ toast('触发失败：'+e.message); }
  },
  anomEnd:function(){
    try{ if(AN.active) anEnd(); toast('异象已结束'); }catch(e){ AN.active=false; AN.id=null; }
  },
  death:function(){
    var t=document.getElementById('devdeath').value||'vignette';
    var wasGod=DEV.god;
    DEV.god=false;
    S.dead=false; S.death=null; S.deadT=0;
    var dEl=document.getElementById('die'); if(dEl) dEl.style.display='none';
    try{ kill('【Dev】测试死亡演出：'+t,t); }catch(e){}
    DEV.god=wasGod;
  },
  revive:function(){
    S.dead=false; S.death=null; S.deadT=0;
    var dEl=document.getElementById('die'); if(dEl) dEl.style.display='none';
    var fEl=document.getElementById('flash'); if(fEl) fEl.style.opacity='0';
    try{ anfxClear(); }catch(e){}
    try{ if(GLR.postMat){ GLR.postMat.uniforms.uDm.value=0; GLR.postMat.uniforms.uDt.value=0; } }catch(e){}
    GLR.deathAnim=null;
    PAUSE.on=false;
    var pEl=document.getElementById('pause'); if(pEl) pEl.style.display='none';
    S.screen='play';
    toast('已复活');
  }
};
