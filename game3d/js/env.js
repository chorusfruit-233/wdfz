/* 里世界 3D · 极简环境贴图
   目的：让金属材质（不锈钢门套、扶手、按钮圈）有方向性反光，而不是"要么纯黑要么死白"。
   做法：用 6 张 32×32 的渐变画布拼一个 CubeTexture（天花板亮、地面暗、四壁居中），
   直接给 scene.environment。没有 envMap 时金属材质在 THREE 里几乎全黑——这是之前电梯门套消失的原因。
   开销：6 张 32×32 画布，一次性；之后所有 MeshStandardMaterial 共享同一张。 */
'use strict';

var ENVMAP={tex:null,tried:false};

function envMapInit(){
  if(ENVMAP.tried) return ENVMAP.tex;
  ENVMAP.tried=true;
  if(typeof THREE==='undefined'||typeof GLR==='undefined') return null;
  /* 背景/天空色跟着当前灯光走：里世界偏冷灰，白房间偏白 */
  var sky=(GLR.scene&&GLR.scene.background&&GLR.scene.background.getHex)?GLR.scene.background.getHex():0xdfe4e3;
  var r=(sky>>16)&255, g=(sky>>8)&255, b=sky&255;
  var top='rgb('+Math.min(255,r*0.92+26|0)+','+Math.min(255,g*0.92+26|0)+','+Math.min(255,b*0.92+26|0)+')';
  var mid='rgb('+(r*0.62|0)+','+(g*0.62|0)+','+(b*0.62|0)+')';
  var bot='rgb('+(r*0.28|0)+','+(g*0.28|0)+','+(b*0.28|0)+')';
  var faces=[], i;
  for(i=0;i<6;i++){
    var cv=document.createElement('canvas');
    cv.width=32; cv.height=32;
    var c=cv.getContext('2d');
    if(!c) return null;
    var gr=c.createLinearGradient(0,0,0,32);
    if(i===2){ gr.addColorStop(0,top); gr.addColorStop(1,top); }          /* +Y 天花板 */
    else if(i===3){ gr.addColorStop(0,bot); gr.addColorStop(1,bot); }     /* -Y 地面 */
    else { gr.addColorStop(0,top); gr.addColorStop(0.6,mid); gr.addColorStop(1,bot); }
    c.fillStyle=gr; c.fillRect(0,0,32,32);
    faces.push(cv);
  }
  var tex=new THREE.CubeTexture(faces);
  tex.mapping=THREE.CubeReflectionMapping;
  tex.needsUpdate=true;
  ENVMAP.tex=tex;
  try{ if(GLR.scene) GLR.scene.environment=tex; }catch(e){}
  return tex;
}
