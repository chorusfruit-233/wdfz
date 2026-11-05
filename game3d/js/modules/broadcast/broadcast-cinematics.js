/* @module-capsule */
(function($imports){
/* Approved four-part dismissal ending and the public "misread" death. Both renderers use these Three.js meshes. */
'use strict';
(function(){
  var B=$imports.BroadcastView.box;
  function block(g,w,h,d,c,x,y,z){return B(g,w,h,d,c,x,y,z);}
  function room(g,w,d){block(g,w,.08,d,0x414944,0,-.04,0);block(g,w,3,.08,0x65706a,0,1.5,-d/2);block(g,.08,3,d,0x4e5b58,-w/2,1.5,0);}
  function person(g,kind,x,z){var f=new $imports.THREE.Group();block(f,.23,.3,.1,0x1b242b,0,1.1,.15);var mesh=(0,$imports.figMesh)(kind,new $imports.THREE.MeshBasicMaterial({color:0x465353,fog:false}),1);f.add(mesh);f.userData.body=mesh;f.position.set(x,0,z);g.add(f);return f;}
  $imports.CUT_DEF.dismissal={dur:18,setup:function(d){
    $imports.Engine.beginOutsideStage();d.hour=$imports.VisualState.stageHour;$imports.VisualState.stageHour=17.4;
    d.caption=document.createElement('p');d.caption.className='broadcast-cut-caption';d.caption.setAttribute('aria-live','polite');document.body.appendChild(d.caption);
    d.stages=[];d.students=[];
    for(var i=0;i<3;i++){var g=new $imports.THREE.Group();g.position.x=i*28;(0,$imports.cutAdd)(g);d.stages.push(g);}
    var a=d.stages[0];room(a,5,5);block(a,2,.12,.7,0x564d3e,0,.88,0);block(a,.1,.42,.1,0x202c29,-.4,1.15,0);
    var record=$imports.BroadcastView.label('放学通知\n第二天 · 全体离校',1.5,.48);record.position.set(0,1.7,-2.35);a.add(record);
    d.speakers=[];for(i=0;i<5;i++)d.speakers.push(block(a,.35,.22,.12,0x465047,-1.6+i*.8,2.55,-2.37));
    var b=d.stages[1];room(b,12,10);var board=$imports.BroadcastView.label('放  学',3.6,1.2,'#e7e2ca');board.position.set(0,1.8,-4.93);b.add(board);
    for(i=0;i<24;i++){var x=(i%6-2.5)*1.6,z=Math.floor(i/6)*1.8-2.5;
      block(b,.9,.08,.55,0x655944,x,.76,z+.4);var chair=block(b,.42,.55,.08,0x605541,x,.64,z-.3);
      var student=person(b,'sit',x,z);student.rotation.y=Math.PI;d.students.push({fig:student,chair:chair,z:z});}
    var c=d.stages[2];room(c,7,10);
    for(i=0;i<12;i++){block(c,1.5,(i+1)*.17,.28,0x737c75,-1,(i+1)*.17/2,2.5-i*.28);block(c,1.5,.13,.28,0x626d69,1,2.04+(i+1)*.17-.065,-.58+i*.28);}
    block(c,3.6,.12,1,0x7e8780,0,2.04,-1.1);
    d.line=[];for(i=0;i<10;i++)d.line.push(person(c,'person',-1,1.5));
    block(c,.04,1.0,3.8,0x263c37,-1.8,2.65,.6);block(c,.04,1.0,3.8,0x263c37,1.8,3.3,.6);
    d.patrol=person(c,'tall',2.6,3.7);
    d.gate=(0,$imports.cutW2S)($imports.GATE_N.x,$imports.GATE_N.y);d.walkers=[];
    for(i=0;i<16;i++){var f=(0,$imports.cutAdd)((0,$imports.cutFigure)(0x3b4847,1));d.walkers.push(f);}
    d.ledger=$imports.BroadcastView.label('放学 · 全体\n准予离校',1.2,.5);d.ledger.position.set(d.gate.x-1.3,1.1,d.gate.z+1);d.ledger.rotation.x=-.4;(0,$imports.cutAdd)(d.ledger);
    d.building=(0,$imports.objWorld)((0,$imports.objById)('teach'));d.windows=[];
    var front=(0,$imports.teachFrontZ)();for(i=0;i<5;i++){
      var strip=block($imports.CUT.grp,20,.5,.03,0x050909,(d.building.x+d.building.w/2)*$imports.U2M,2.7+i*3.2,front+.04);strip.visible=false;d.windows.push(strip);}
    d.said={};
  },frame:function(k,d){
    var t=k*18,stage=t<3.2?0:t<7.8?1:t<12?2:3;
    var captions=['广播：放学。全体同学，从北门离校。\n你的声音从走廊尽头传回来，慢了半拍。','几十把椅子同时往后挪。同学们收好书包。','走廊尽头的高个子没有动。人流从它身边经过。','登记簿：放学 · 全体。'];d.caption.textContent=captions[stage];
    d.stages.forEach(function(g,i){g.visible=i===stage;});d.walkers.forEach(function(f){f.visible=stage===3;});d.ledger.visible=stage===3;
    if(stage===0){
      (0,$imports.cutLook)(1.5,1.55,2.1,0,1.25,-1.4);d.speakers.forEach(function(m,i){m.material.color.setHex(t>.25+i*.35?0x8b9d83:0x313b34);});
      if(!d.said.a){d.said.a=true;(0,$imports.os)('你的声音从走廊尽头传回来，慢了半拍。',3,$imports.OS_FORCE);$imports.SoundPlayer.play('dread.radio',{k:.4});}
    }else if(stage===1){
      var p=(0,$imports.cutPhase)(k,3.2/18,7.8/18);(0,$imports.cutLook)(33,2.1,3.9,27.5,1.2,-2);
      d.students.forEach(function(o,i){var u=Math.max(0,Math.min(1,(p-i*.012)*3));o.chair.position.z=o.z-.3-u*.3;
        if(u>.45)o.fig.userData.body.geometry=(0,$imports.figGeo)('person');o.fig.position.z=o.z+Math.max(0,u-.65)*.8;});
      if(!d.said.b){d.said.b=true;(0,$imports.os)('几十把椅子同时往后挪。没有人说话。',4,$imports.OS_FORCE);$imports.SoundPlayer.play('dread.chair',{k:.6});}
    }else if(stage===2){
      var u=(t-7.8)/4.2;(0,$imports.cutLook)(59.6,6.2,7.6,55.6,1.4,.4);   /* 楼梯井斜上方往下看：看得见两段楼梯的人流和走廊尽头的高个子 */
      d.line.forEach(function(f,i){var p=(u*.7+i*.08)%1;if(p<.5){f.position.set(-1,2.04*(1-p*2),-.9+p*6.7);}else{f.position.set(1,4.08-(p-.5)*4.08,2.5-(p-.5)*6.7);}f.rotation.y=p<.5?0:Math.PI;});
      if(!d.said.c){d.said.c=true;(0,$imports.os)('走廊尽头的高个子没有动。人流从它身边经过。',4,$imports.OS_FORCE);}
    }else{
      var v=(t-12)/6,g=d.gate;
      d.walkers.forEach(function(f,i){f.position.set(g.x+(i%4<2?-1.2-(i%2)*.65:1.2+(i%2)*.65),0,g.z+3.8-Math.floor(i/4)*.9-v*8);f.rotation.y=Math.PI;});
      if(v<.2)(0,$imports.cutLook)(g.x-1.3,1.6,g.z+2.1,g.x-1.3,1.1,g.z+1);
      else if(v<.6)(0,$imports.cutLook)(g.x+1.6,1.6,g.z-6-(v-.2)*4,g.x,1.4,g.z+3);   /* 站在门外回看：人流从校门里走出来（以前对着校外的空地，整屏灰） */
      else{var teachX=(d.building.x+d.building.w/2)*$imports.U2M,teachZ=(d.building.y+d.building.h/2)*$imports.U2M;(0,$imports.cutLook)(g.x,1.8,g.z-7,teachX,6,teachZ);}
      d.windows.forEach(function(m,i){m.visible=v>.6+i*.065;});$imports.GLR.worldNorm=.8;
      if(!d.said.d){d.said.d=true;(0,$imports.os)('登记簿翻到了新的一页：放学 · 全体。',4,$imports.OS_FORCE);}
    }
    var fades=[3.2,7.8,12],edge=0;fades.forEach(function(s){edge=Math.max(edge,Math.max(0,1-Math.abs(t-s)/.12));});
    (0,$imports.cutFade)(Math.max(edge,t>17.4?(t-17.4)/.6:0));
  },clean:function(d){if(d.caption)d.caption.remove();$imports.VisualState.stageHour=d.hour;}};

  var U=$imports.DeathCG.kit;
  $imports.DeathCG.register('misread',{
    build:function(c){
      c.hideWorld();c.box(3.6,.05,4.5,0x272e2b,undefined,0,-.025,1.2);
      c.box(3.6,2.8,.08,0x3c4843,undefined,0,1.4,3.4);c.box(.08,2.8,4.5,0x34403c,undefined,-1.8,1.4,1.2);
      c.box(1.3,.12,.6,0x4b4438,undefined,0,.88,1.15);c.box(.08,.35,.08,0x151f1d,undefined,0,1.1,1.2);
      c.doors=[];for(var i=0;i<4;i++)c.doors.push(c.box(.72,2,.06,0x26322e,undefined,-1.3+i*.86,1,3.28));
      var text=$imports.BroadcastView.label('播 音 中',1,.3,'#d86b51');c.add(text,0,2.22,3.2);text.rotation.y=Math.PI;c.sign=text;
      var demand=$imports.BroadcastView.label('高二（二）班\n请留在原地',1.7,.55,'#dddcc8');c.add(demand,0,1.6,3.18);demand.rotation.y=Math.PI;c.demand=demand;
      c.speakers=[];for(i=0;i<6;i++)c.speakers.push(c.box(.24,.2,.12,0x54625b,undefined,-1.35+(i%3)*1.35,2.35,1+(i>=3?1.4:0)));
      c.veil(0x020707);
    },update:function(c,t,view){
      var close=U.ss(U.seg(t,.35,1.8));c.doors.forEach(function(m,i){m.position.x=-1.3+i*.86+(i%2?1:-1)*.3*(1-close);});
      c.demand.visible=t>.8;c.sign.visible=t<3.3;c.speakers.forEach(function(m,i){m.scale.setScalar(1+.04*Math.sin(t*5+i));});
      c.cam(view,t,0,.03*c.shk*Math.sin(t*5),-.02*close);c.shade(t>3.3?Math.min(.92,(t-3.3)*1.4):.08);
    }
  });
  $imports.DeathTimeline.define('misread',4.1);
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/broadcast/broadcast-cinematics.js",{

});
})(GameModules.imports("game3d/js/modules/broadcast/broadcast-cinematics.js"));
