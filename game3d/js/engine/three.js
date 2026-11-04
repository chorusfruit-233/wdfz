/* @module-capsule */
(function($imports){
/* Three.js 后端：设备、离屏目标与后期。游戏逻辑通过 Engine 调用。 */
'use strict';
var ThreeBackend={name:'three',version:2};
ThreeBackend.configure=function(renderer){
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  renderer.outputColorSpace=$imports.THREE.SRGBColorSpace;
  try{ renderer.useLegacyLights=false; }catch(e){}
  renderer.toneMapping=$imports.THREE.NoToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=false;   /* 阴影每帧要额外整场景一遍，关掉 */
  renderer.shadowMap.type=$imports.THREE.PCFShadowMap;
  renderer.info.autoReset=false;
};
ThreeBackend.target=function(w,h,options){
  return $imports.RenderDevice.gpu()?new $imports.THREE.RenderTarget(w,h,options):new $imports.THREE.WebGLRenderTarget(w,h,options);
};
ThreeBackend.setup=function(renderer){
  ThreeBackend.configure(renderer);

  var scene=new $imports.THREE.Scene();
  scene.fog=new $imports.THREE.FogExp2($imports.FOG_COL,0.040);
  scene.background=new $imports.THREE.Color($imports.SKY_COL);

  var cam=new $imports.THREE.PerspectiveCamera(74,window.innerWidth/window.innerHeight,0.08,240);
  cam.position.set(0,$imports.EYE,0);
  scene.add(cam);

  var amb=new $imports.THREE.AmbientLight(0x7a7772,1.0);
  scene.add(amb);
  var hemi=new $imports.THREE.HemisphereLight(0xa8adae,0x3a362f,1.0);
  scene.add(hemi);
  var moon=new $imports.THREE.DirectionalLight(0xc8dae6,1.0);
  moon.position.set(-8.4,16,8.6);
  moon.castShadow=false;
  scene.add(moon);

  var torch=new $imports.THREE.SpotLight(0xdceaf0,0,20,0.42,0.62,1.1);
  torch.position.set(0,0,0);
  torch.castShadow=false;
  torch.shadow.mapSize.width=1024;
  torch.shadow.mapSize.height=1024;
  torch.shadow.camera.near=0.3;
  torch.shadow.camera.far=20;
  torch.shadow.bias=-0.0012;
  var torchT=new $imports.THREE.Object3D(); torchT.position.set(0,0,-1);
  cam.add(torch); cam.add(torchT); torch.target=torchT;

  var camLight=new $imports.THREE.PointLight(0xbfd0d8,$imports.LCFG.camI,$imports.LCFG.camDist,$imports.LCFG.camDecay);
  cam.add(camLight);
  var lampPool=[], lp;
  for(lp=0;lp<3;lp++){                       /* 数量固定：室内也留着（强度 0），免得切场景重编着色器 */
    var pl0=new $imports.THREE.PointLight(0xffd9a0,0,$imports.LCFG.lampDist,1.6);
    pl0.userData={on:false};
    pl0.position.set(0,-50,0);
    scene.add(pl0); lampPool.push(pl0);
  }

  var rt=ThreeBackend.target(2,2,{
    minFilter:$imports.THREE.LinearFilter,magFilter:$imports.THREE.LinearFilter,
    format:$imports.THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false
  });

  var postScene=new $imports.THREE.Scene();
  var postCam=new $imports.THREE.OrthographicCamera(-1,1,1,-1,0,1);
  var postMat=new $imports.THREE.ShaderMaterial({
    uniforms:{
      tDiffuse:{value:rt.texture},tDepth:{value:rt.texture},tHands:{value:rt.texture},uHands:{value:0},uAO:{value:0},uNear:{value:cam.near},uFar:{value:cam.far},uAA:{value:0},
      uTime:{value:0}, uRes:{value:new $imports.THREE.Vector2(2,2)},
      uWarp:{value:0},uEdge:{value:0},uFocus:{value:0},uSan:{value:1}, uHurt:{value:0}, uFlash:{value:0}, uDm:{value:0}, uDt:{value:0}, uBright:{value:1.0}, uExpo:{value:1.0}, uRed:{value:0}, uGaze:{value:0}, uBloom:{value:0}, uGrain:{value:1}, uInvert:{value:0},
      uFx:{value:$imports.GLRTEST.nofx?1.0:0.0}
    },
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:[
'precision highp float;',
'uniform sampler2D tDiffuse;uniform float uTime;uniform vec2 uRes;',
'uniform sampler2D tDepth;uniform float uAO;uniform float uNear;uniform float uFar;uniform float uAA;',
'uniform sampler2D tHands;uniform float uHands;',
'uniform float uWarp;uniform float uEdge;uniform float uFocus;uniform float uSan;uniform float uHurt;uniform float uFlash;uniform float uFx;uniform float uDm;uniform float uDt;uniform float uBright;uniform float uExpo;uniform float uRed;uniform float uGaze;uniform float uBloom;uniform float uGrain;uniform float uInvert;',
'varying vec2 vUv;',
'float hash(vec2 p){',
'  p = fract(p * vec2(443.8975, 397.2973));',
'  p += dot(p, p.yx + 19.19);',
'  return fract((p.x + p.y) * p.x);',
'}',
'vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}',
'vec3 toSRGB(vec3 c){c=clamp(c,0.0,1.0);',
'  return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}',
/* 八向深度邻域遮蔽：只压暗近处接触面，远景和天空不着色。 */
'float viewDepth(vec2 p){float d=texture2D(tDepth,p).x;return uNear*uFar/(uFar-d*(uFar-uNear));}',
'float contactAO(vec2 uv){',
'  if(uAO<=0.0)return 1.0;',
'  float z=viewDepth(uv);if(z>55.0)return 1.0;',
'  float radius=clamp(uRes.y*0.16/max(z,0.2),2.0,32.0);float occ=0.0;',
'  for(int i=0;i<8;i++){float a=float(i)*0.785398;vec2 d=vec2(cos(a),sin(a));',
'    float dz=z-viewDepth(clamp(uv+d*radius/uRes,vec2(0.001),vec2(0.999)));',
'    occ+=smoothstep(0.035,0.22,dz)*(1.0-smoothstep(0.35,1.2,dz));}',
'  return 1.0-uAO*occ/8.0;',
'}',
/* 无多重采样支持时的边缘平滑；只有超精细开启。 */
'vec3 sceneColor(vec2 uv){',
'  vec3 c=texture2D(tDiffuse,uv).rgb;if(uAA<0.5)return c;',
'  vec2 px=1.0/uRes;vec3 n=texture2D(tDiffuse,uv+vec2(0.0,px.y)).rgb;',
'  vec3 s=texture2D(tDiffuse,uv-vec2(0.0,px.y)).rgb;',
'  vec3 e=texture2D(tDiffuse,uv+vec2(px.x,0.0)).rgb;vec3 w=texture2D(tDiffuse,uv-vec2(px.x,0.0)).rgb;',
'  vec3 l=vec3(0.299,0.587,0.114);float edge=max(abs(dot(n-s,l)),abs(dot(e-w,l)));',
'  return mix(c,(n+s+e+w+c*4.0)/8.0,smoothstep(0.08,0.25,edge)*0.7);',
'}',
'void main(){',
'  vec2 uv=vUv;',
'  float wob=clamp((0.75-uSan)/0.75,0.0,1.0);',
'  vec2 dc=uv-vec2(0.5);',
'  float edge=smoothstep(0.25,0.5,max(abs(dc.x),abs(dc.y)));',
'  float breath=sin(uTime*1.8+dot(dc,dc)*9.0);',
'  uv+=normalize(dc*uRes+vec2(0.00001))*edge*breath*uWarp*(10.0*min(uRes.x,uRes.y)/720.0)/uRes*(1.0-uFx);',
'  uv=clamp(uv,vec2(0.001),vec2(0.999));',
'  float ca=uFocus*edge*0.004*(1.0-uFx);',
'  vec3 col=sceneColor(uv);',
'  col.r=sceneColor(uv+dc*ca).r;col.b=sceneColor(uv-dc*ca).b;',
'  col*=contactAO(uv);',
'  col*=1.0-uEdge*smoothstep(0.18,0.7,distance(uv,vec2(0.5)));',
'  if(uHands>0.5){vec4 hand=texture2D(tHands,vUv);col=mix(col,hand.rgb,hand.a);}',
/* 「真实」档的辉光：灯管、手电光斑、亮窗周围晕开一圈（三圈采样，只取超过阈值的部分） */
'  if(uBloom>0.0){vec3 bl=vec3(0.0);vec2 asp=vec2(uRes.y/uRes.x,1.0);',
'    for(int i=0;i<12;i++){float a=float(i)*0.5236+0.26;vec2 o=vec2(cos(a),sin(a))*asp;',
'      bl+=max(texture2D(tDiffuse,uv+o*0.007).rgb-0.62,0.0);',
'      bl+=max(texture2D(tDiffuse,uv+o*0.017).rgb-0.62,0.0)*0.65;',
'      bl+=max(texture2D(tDiffuse,uv+o*0.034).rgb-0.62,0.0)*0.35;}',
'    col+=bl/12.0*uBloom;}',
'  col=aces(col*uBright*uExpo*0.96);',
'  float lum=dot(col,vec3(0.2126,0.7152,0.0722));',
'  col=mix(vec3(lum),col,mix(0.46+0.49*uGaze,1.0,uFx));',
'  col*=vec3(1.03,1.00,0.985);',
'  float lm2=dot(col,vec3(0.299,0.587,0.114));',
'  vec3 tint=mix(vec3(0.66,0.90,1.02), vec3(1.0,0.98,0.90), smoothstep(0.04,0.50,lm2));',
  '  col*=mix(tint, vec3(1.0), uFx);',
'  col=col*col*(3.0-2.0*clamp(col,0.0,1.0))*0.28+col*0.72;',
'  col=max(col-0.009*(1.0-uFx),0.0)*(1.0+0.009*(1.0-uFx));',
'  float vg=distance(uv,vec2(0.5,0.5));',
'  col*=1.0-0.84*smoothstep(0.20,0.95,vg*1.28)*(1.0-uFx);',
'  col*=mix(vec3(1.0),vec3(1.0,0.32,0.27),uHurt*0.85);',
'  col=mix(col,vec3(0.16,0.0,0.0),uHurt*0.55*smoothstep(0.28,0.95,vg*1.3));',
'  col+=vec3(0.90,0.95,1.0)*uFlash*0.8;',
/* 巡察者锁定：整个画面浸在红光里 */
'  col=mix(col,vec3(dot(col,vec3(0.5,0.4,0.1)))*vec3(1.35,0.22,0.18),uRed*0.75);',
/* 目光：场景本身已经被压暗（lighting.js），这里再偏暖一点，四周沉进黑里；眼睛不吃光，保持亮黄 */
'  col=mix(col,col*vec3(1.12,0.93,0.66),uGaze*0.7);',
'  col=mix(col,vec3(0.022,0.011,0.0),uGaze*0.85*smoothstep(0.24,0.86,vg*1.25));',
      '  if(uDm>0.5&&uDm<1.5){',
      '    col*=1.0-uDt*0.72;',
      '    for(int i=0;i<12;i++){',
      '      float a=float(i)*0.5236;',
      '      vec2 dd=vec2(cos(a),sin(a));',
      '      vec2 q=uv-vec2(0.5,0.5);',
      '      float proj=dot(q,dd); float perp=abs(dot(q,vec2(-dd.y,dd.x)));',
      '      if(proj>0.0&&perp<0.0030*(0.3+uDt)) col=mix(col,vec3(0.03,0.025,0.02),0.62*uDt);',
      '    }',
      '  }',
      '  if(uDm>1.5&&uDm<2.5){',
      '    col=mix(col,vec3(0.24,0.31,0.39),0.42*uDt);',
      '    float sx=uv.x*3.0+uv.y*1.6-uTime*0.9;',
      '    col+=vec3(0.62,0.70,0.80)*step(0.88,fract(sx*38.0))*0.22*uDt;',
      '    col*=1.0-smoothstep(0.5,1.0,uDt)*0.92;',
      '  }',
      '  if(uDm>2.5){',
      '    col*=1.0-0.55*uDt;',
      '    vec2 q2=uv-vec2(0.5,0.5);',
      '    float fr=max(abs(q2.x)/0.20,abs(q2.y)/0.34);',
      '    col=mix(col,vec3(0.78,0.86,0.92)*(0.5+0.3*sin(uTime*8.0)),(step(0.97,fr)-step(1.0,fr))*0.85);',
      '    float sc=1.0-uDt*0.75;',
      '    float ee=length(vec2(q2.x/(0.10*sc),q2.y/(0.19*sc)));',
      '    col=mix(col,vec3(0.82,0.81,0.78),step(ee,1.0)*0.8*(1.0-uDt*0.7));',
      '    for(int j=0;j<8;j++){',
      '      float a2=float(j)*0.7854;',
      '      vec2 d2=vec2(cos(a2),sin(a2));',
      '      float pr=dot(q2,d2); float pp=abs(dot(q2,vec2(-d2.y,d2.x)));',
      '      if(pr>0.0&&pp<0.0016) col=mix(col,vec3(1.0),0.32*uDt);',
      '    }',
      '  }',
'  vec3 outc=toSRGB(col);',
/* 颗粒加在显示空间、按 24 帧换一次：以前加在线性空间、每帧都换，暗部被伽马放大成满屏跳动的白点。
   暗处略多、亮处很少；SAN 越低颗粒越重一点（感知反馈的一部分） */
'  float gn=hash(gl_FragCoord.xy+floor(uTime*24.0)*17.31)-0.5;',
'  float gLum=dot(outc,vec3(0.299,0.587,0.114));',
/* 以前满屏的颗粒顺带把纯黑抬亮了一点；颗粒减弱后补一个很浅的暗部抬升，暗处的轮廓仍看得出来 */
'  outc+=vec3(0.011)*(1.0-smoothstep(0.0,0.3,gLum))*(1.0-uFx);',
'  outc+=gn*(0.012+0.026*(1.0-smoothstep(0.03,0.45,gLum)))*(1.0+0.7*wob)*(1.0-uFx)*uGrain;',
/* 反色（表现层的彩蛋用；0 = 正常，1 = 完全反色）：只作用于 3D 画面，界面和字幕不受影响 */
'  outc=mix(outc,vec3(1.0)-clamp(outc,0.0,1.0),uInvert);',
'  gl_FragColor=vec4(outc,1.0);',
'}',
    ].join('\n'),
    depthTest:false,depthWrite:false
  });
  var glPost=postMat;
  if($imports.RenderDevice.gpu())postMat=$imports.WebGPUPost.create(postMat.uniforms);
  postScene.add(new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(2,2),postMat));

  $imports.GLR={renderer:renderer,scene:scene,cam:cam,torch:torch,camLight:camLight,lampPool:lampPool,
       amb:amb,hemi:hemi,moon:moon,
       rt:rt,postScene:postScene,postCam:postCam,postMat:postMat,glPost:glPost,
       roomLights:[],roomLightBase:[],roomMesh:null,outMesh:null,time:0,hurt:0,flash:0};

  ThreeBackend.resize();
  return $imports.GLR;
};
ThreeBackend.boot=async function(){
  var renderer=await $imports.RenderDevice.create();
  try{
    ThreeBackend.setup(renderer);
    if($imports.RenderDevice.gpu()){
      await $imports.RenderDevice.prepare(renderer.compileAsync($imports.GLR.postScene,$imports.GLR.postCam));
      await renderer.backend.device.queue.onSubmittedWorkDone();
      if($imports.RenderDevice.startupError())throw new Error($imports.RenderDevice.startupError());
    }
    $imports.RenderDevice.activate(renderer);
  }catch(e){
    if($imports.RenderDevice.gpu()){await $imports.RenderDevice.fallback('gpu-pipeline-failed',e);$imports.RenderDevice.dispose(renderer);}
    else{$imports.RenderDevice.failed();$imports.RenderDevice.dispose(renderer);throw e;}
    if(!$imports.RenderDevice.ready())throw e;
  }
  ThreeBackend.resize(); // The viewport may have changed while the GPU was being prepared.
  window.addEventListener('resize',$imports.resizeGL);
  window.addEventListener('orientationchange',function(){setTimeout($imports.resizeGL,260);});
  try{if(window.visualViewport)window.visualViewport.addEventListener('resize',$imports.resizeGL);}catch(e){}
  return $imports.GLR;
};
ThreeBackend.replaceRenderer=function(renderer){
  ThreeBackend.configure(renderer);$imports.GLR.renderer=renderer;
  if($imports.GLR.rt)$imports.GLR.rt.dispose();if($imports.GLR.handRT)$imports.GLR.handRT.dispose();
  $imports.GLR.rt=ThreeBackend.target(2,2,{depthBuffer:true,stencilBuffer:false});$imports.GLR.handRT=null;
  if($imports.GLR.postMat!==$imports.GLR.glPost)$imports.GLR.postMat.dispose();
  $imports.GLR.postMat=$imports.GLR.glPost;$imports.GLR.postScene.children[0].material=$imports.GLR.postMat;
  if($imports.GLR.envTarget)$imports.GLR.envTarget.dispose();else if($imports.GLR.envTex)$imports.GLR.envTex.dispose();
  $imports.GLR.envTarget=null;$imports.GLR.envTex=null;$imports.GLR.scene.environment=null;
  $imports.GLR.scene.traverse(function(o){
    if(o.isCamera){o.coordinateSystem=$imports.THREE.WebGLCoordinateSystem;o.updateProjectionMatrix();}
    if(o.shadow){
      o.shadow.camera.coordinateSystem=$imports.THREE.WebGLCoordinateSystem;o.shadow.camera.updateProjectionMatrix();
      if(o.shadow.map)o.shadow.map.dispose();o.shadow.map=null;if(o.shadow.mapPass)o.shadow.mapPass.dispose();o.shadow.mapPass=null;
    }
  });
  $imports.GLR.postCam.coordinateSystem=$imports.THREE.WebGLCoordinateSystem;$imports.GLR.postCam.updateProjectionMatrix();
  ThreeBackend.resize();renderer.shadowMap.enabled=$imports.Quality.get().shadow>0;
};

/* 画面颗粒：设置里的强度（0 关、1 开）乘画质系数（真实档画面干净，颗粒再轻一些） */
ThreeBackend.grainLevel=1;
ThreeBackend.grain=function(level){
  if(level!==undefined)ThreeBackend.grainLevel=level;
  if(typeof $imports.GLR==='undefined'||!$imports.GLR||!$imports.GLR.postMat)return;
  $imports.GLR.postMat.uniforms.uGrain.value=ThreeBackend.grainLevel*($imports.Quality.get().pbr?0.6:1);
};
/* 「真实」档的环境反射：一个暗的灰绿色房间，顶上几根灯管。金属、玻璃、瓷砖上有一点点反光，不会发亮 */
function buildEnvTex(){
  var pm=$imports.RenderDevice.gpu()?new ($imports.RenderDevice.library().PMREMGenerator)($imports.GLR.renderer):new $imports.THREE.PMREMGenerator($imports.GLR.renderer), sc=new $imports.THREE.Scene(), i;
  var geo=new $imports.THREE.SphereGeometry(10,32,16), cols=[], pos=geo.attributes.position;
  for(i=0;i<pos.count;i++){ var t=pos.getY(i)/10, v=t>0?0.06+0.05*t:0.06+0.035*t; cols.push(v*0.9,v,v*0.92); }
  geo.setAttribute('color',new $imports.THREE.Float32BufferAttribute(cols,3));
  var room=new $imports.THREE.Mesh(geo,new $imports.THREE.MeshBasicMaterial({side:$imports.THREE.BackSide,vertexColors:true}));
  sc.add(room);
  var tube=new $imports.THREE.BoxGeometry(5,0.3,0.6), tm=new $imports.THREE.MeshBasicMaterial({color:0x8c958a});
  for(i=-1;i<=1;i++){ var b=new $imports.THREE.Mesh(tube,tm); b.position.set(i*3.4,8.6,0); sc.add(b); }
  $imports.GLR.envTarget=pm.fromScene(sc,0.035);var tex=$imports.GLR.envTarget.texture;
  pm.dispose(); geo.dispose(); tube.dispose(); room.material.dispose(); tm.dispose();
  return tex;
}
ThreeBackend.resize=function(){
  var w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight),q=$imports.Quality.get();
  /* 限制高分屏的总像素，避免旋转或大屏下离屏目标无限膨胀。 */
  var dpr=Math.min(window.devicePixelRatio||1,q.dpr,Math.sqrt(5000000/(w*h)));
  $imports.GLR.renderer.setPixelRatio(dpr);
  $imports.GLR.renderer.setSize(w,h,false);
  $imports.GLR.cam.aspect=w/h; $imports.GLR.cam.updateProjectionMatrix();
  var cap=$imports.GLR.renderer.capabilities;
  var samples=cap.isWebGL2||cap.isWebGPU?Math.min(q.samples,cap.maxSamples||0):0;
  var ao=!!q.ao&&(cap.isWebGL2||cap.isWebGPU||$imports.GLR.renderer.extensions.has('WEBGL_depth_texture'));
  var depth=ao||$imports.RenderDevice.gpu();
  if($imports.GLR.rt.samples!==samples||!!$imports.GLR.rt.depthTexture!==depth){
    if($imports.GLR.rt.depthTexture)$imports.GLR.rt.depthTexture.dispose();
    $imports.GLR.rt.dispose();
    $imports.GLR.rt=ThreeBackend.target(2,2,{minFilter:$imports.THREE.LinearFilter,magFilter:$imports.THREE.LinearFilter,depthBuffer:true,stencilBuffer:false});
    $imports.GLR.rt.samples=samples;
    if(depth){$imports.GLR.rt.depthTexture=new $imports.THREE.DepthTexture(2,2,$imports.THREE.UnsignedIntType);if($imports.RenderDevice.gpu())$imports.GLR.rt.depthTexture.samples=samples;}
  }
  var u=$imports.GLR.postMat.uniforms;
  u.tDiffuse.value=$imports.GLR.rt.texture;u.tDepth.value=$imports.GLR.rt.depthTexture||$imports.GLR.rt.texture;
  u.uAO.value=ao?q.ao:0;u.uAA.value=q.samples&&!samples?1:0;
  u.uBloom.value=q.bloom||0;ThreeBackend.grain();
  if(q.pbr&&!$imports.GLR.envTex)$imports.GLR.envTex=buildEnvTex();
  $imports.GLR.scene.environment=q.pbr?$imports.GLR.envTex:null;
  var RTS=($imports.GLRTEST&&$imports.GLRTEST.hq)?1:q.scale;
  var rw=Math.max(2,Math.round(w*dpr*RTS)), rh=Math.max(2,Math.round(h*dpr*RTS));
  $imports.GLR.rt.setSize(rw,rh);
  if(!$imports.GLR.handRT||$imports.GLR.handRT.samples!==samples){
    if($imports.GLR.handRT)$imports.GLR.handRT.dispose();
    $imports.GLR.handRT=ThreeBackend.target(2,2,{depthBuffer:true,stencilBuffer:false});
    $imports.GLR.handRT.samples=samples;
  }
  $imports.GLR.handRT.setSize(rw,rh);u.tHands.value=$imports.GLR.handRT.texture;
  $imports.GLR.postMat.uniforms.uRes.value.set(rw,rh);
  if($imports.RenderDevice.gpu()&&$imports.GLR.postMat.userData.multisampled!==!!samples){
    var uniforms=$imports.GLR.postMat.uniforms;$imports.GLR.postMat.dispose();
    $imports.GLR.postMat=$imports.WebGPUPost.create(uniforms,!!samples);$imports.GLR.postScene.children[0].material=$imports.GLR.postMat;
  }
};

/* @module-exports */
GameModules.publish("game3d/js/engine/three.js",{
"ThreeBackend":{get:function(){return ThreeBackend;},set:function($value){ThreeBackend=$value;}},
"buildEnvTex":{get:function(){return buildEnvTex;},set:function($value){buildEnvTex=$value;}}
});
})(GameModules.imports("game3d/js/engine/three.js"));
