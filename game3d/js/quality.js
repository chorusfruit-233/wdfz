/* 画质配置：只控制表现。玩法、碰撞与移动步长不随画质改变。 */
'use strict';
var QUALITY=1;
var Quality=(function(){
  var profiles=[
    {id:0,label:'流畅',dpr:1.4,scale:0.55,texture:256,segments:0.6,grass:0,rain:500,moths:50,shadow:0,torchShadow:0,ceilingShadow:0,samples:0,ao:0},
    {id:1,label:'均衡',dpr:1.4,scale:0.70,texture:512,segments:1,grass:4200,rain:900,moths:80,shadow:0,torchShadow:0,ceilingShadow:0,samples:0,ao:0},
    {id:2,label:'精细',dpr:1.4,scale:1,texture:512,segments:1,grass:9000,rain:1500,moths:120,shadow:2048,torchShadow:1024,ceilingShadow:0,samples:0,ao:0},
    {id:3,label:'超精细',dpr:2,scale:1,texture:1024,segments:1.75,grass:14000,rain:2200,moths:180,shadow:4096,torchShadow:2048,ceilingShadow:512,samples:4,ao:0.38}
  ].map(function(p){return Object.freeze(p);});
  return Object.freeze({
    profiles:Object.freeze(profiles),
    normalize:function(q){return typeof q==='number'&&Number.isInteger(q)&&q>=0&&q<profiles.length?q:1;},
    get:function(q){return profiles[this.normalize(q===undefined?QUALITY:q)];}
  });
})();

/* 只建议降档，不擅自改设置；加载/切场景/后台/暂停不计入低帧率窗口。 */
var QualityWatch={warm:5,elapsed:0,frames:0,shown:false,
  reset:function(){this.warm=5;this.elapsed=0;this.frames=0;this.shown=false;var e=document.getElementById('qualityHint');if(e)e.hidden=true;},
  tick:function(dt,active){
    if(!active||QUALITY===0){this.elapsed=0;this.frames=0;return;}
    if(this.shown)return;
    if(!Number.isFinite(dt)||dt<=0||dt>1){this.warm=5;this.elapsed=0;this.frames=0;return;}
    if(this.warm>0){this.warm-=dt;return;}
    this.elapsed+=dt;this.frames++;
    if(this.elapsed<10)return;
    var fps=this.frames/this.elapsed;this.elapsed=0;this.frames=0;
    if(fps>=24)return;
    var e=document.getElementById('qualityHint');if(e)e.hidden=false;
    this.shown=true;
  },
  dismiss:function(){var e=document.getElementById('qualityHint');if(e)e.hidden=true;this.shown=true;}
};
