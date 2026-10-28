/* Three.js 后端：设备、离屏目标与后期。游戏逻辑通过 Engine 调用。 */
'use strict';
var ThreeBackend={name:'three',version:1};
ThreeBackend.boot=function(){
  var cv=document.getElementById('cv');
  var renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  try{ renderer.useLegacyLights=false; }catch(e){}
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=false;   /* 阴影每帧要额外整场景一遍，关掉 */
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  var scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(FOG_COL,0.040);
  scene.background=new THREE.Color(SKY_COL);

  var cam=new THREE.PerspectiveCamera(74,window.innerWidth/window.innerHeight,0.08,240);
  cam.position.set(0,EYE,0);
  scene.add(cam);

  var amb=new THREE.AmbientLight(0x7a7772,1.0);
  scene.add(amb);
  var hemi=new THREE.HemisphereLight(0xa8adae,0x3a362f,1.0);
  scene.add(hemi);
  var moon=new THREE.DirectionalLight(0xc8dae6,1.0);
  moon.position.set(-8.4,16,8.6);
  moon.castShadow=false;
  scene.add(moon);

  var torch=new THREE.SpotLight(0xdceaf0,0,20,0.42,0.62,1.1);
  torch.position.set(0,0,0);
  torch.castShadow=false;
  torch.shadow.mapSize.width=1024;
  torch.shadow.mapSize.height=1024;
  torch.shadow.camera.near=0.3;
  torch.shadow.camera.far=20;
  torch.shadow.bias=-0.0012;
  var torchT=new THREE.Object3D(); torchT.position.set(0,0,-1);
  cam.add(torch); cam.add(torchT); torch.target=torchT;

  var camLight=new THREE.PointLight(0xbfd0d8,LCFG.camI,LCFG.camDist,LCFG.camDecay);
  cam.add(camLight);
  var lampPool=[], lp;
  for(lp=0;lp<3;lp++){                       /* 数量固定：室内也留着（强度 0），免得切场景重编着色器 */
    var pl0=new THREE.PointLight(0xffd9a0,0,LCFG.lampDist,1.6);
    pl0.userData={on:false};
    pl0.position.set(0,-50,0);
    scene.add(pl0); lampPool.push(pl0);
  }

  var rt=new THREE.WebGLRenderTarget(2,2,{
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
    format:THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false
  });

  var postScene=new THREE.Scene();
  var postCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  var postMat=new THREE.ShaderMaterial({
    uniforms:{
      tDiffuse:{value:rt.texture},tDepth:{value:rt.texture},uAO:{value:0},uNear:{value:cam.near},uFar:{value:cam.far},uAA:{value:0},
      uTime:{value:0}, uRes:{value:new THREE.Vector2(2,2)},
      uSan:{value:1}, uHurt:{value:0}, uFlash:{value:0}, uDm:{value:0}, uDt:{value:0}, uBright:{value:1.0}, uExpo:{value:1.0}, uRed:{value:0}, uGaze:{value:0},
      uFx:{value:GLRTEST.nofx?1.0:0.0}
    },
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:[
'precision highp float;',
'uniform sampler2D tDiffuse;uniform float uTime;uniform vec2 uRes;',
'uniform sampler2D tDepth;uniform float uAO;uniform float uNear;uniform float uFar;uniform float uAA;',
'uniform float uSan;uniform float uHurt;uniform float uFlash;uniform float uFx;uniform float uDm;uniform float uDt;uniform float uBright;uniform float uExpo;uniform float uRed;uniform float uGaze;',
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
'  float wob=(1.0-uSan);',
'  uv.x+=sin(uv.y*11.0+uTime*0.9)*0.0012*wob;',
'  vec3 col=sceneColor(uv)*contactAO(uv);',
'  col=aces(col*uBright*uExpo*1.12);',
'  float lum=dot(col,vec3(0.2126,0.7152,0.0722));',
'  col=mix(vec3(lum),col,0.70+0.25*uGaze);',
'  col*=vec3(1.03,1.00,0.985);',
'  float lm2=dot(col,vec3(0.299,0.587,0.114));',
'  vec3 tint=mix(vec3(0.72,0.92,1.18), vec3(1.0), smoothstep(0.04,0.42,lm2));',
  '  col*=mix(tint, vec3(1.0), uFx);',
'  col=col*col*(3.0-2.0*clamp(col,0.0,1.0))*0.28+col*0.72;',
'  float n=hash(gl_FragCoord.xy+fract(uTime)*91.0);',
'  col+=(n-0.5)*0.010*(1.0-uFx);',
'  float vg=distance(uv,vec2(0.5,0.5));',
'  col*=1.0-0.55*smoothstep(0.34,1.04,vg*1.24)*(1.0-uFx);',
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
'  gl_FragColor=vec4(toSRGB(col),1.0);',
'}',
    ].join('\n'),
    depthTest:false,depthWrite:false
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMat));

  GLR={renderer:renderer,scene:scene,cam:cam,torch:torch,camLight:camLight,lampPool:lampPool,
       amb:amb,hemi:hemi,moon:moon,
       rt:rt,postScene:postScene,postCam:postCam,postMat:postMat,
       roomLights:[],roomLightBase:[],roomMesh:null,outMesh:null,time:0,hurt:0,flash:0};

  window.addEventListener('resize',resizeGL);
  window.addEventListener('orientationchange',function(){ setTimeout(resizeGL,260); });
  try{ if(window.visualViewport) window.visualViewport.addEventListener('resize',resizeGL); }catch(e){}
  resizeGL();
  return GLR;
};

ThreeBackend.resize=function(){
  var w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight),q=Quality.get();
  /* 限制高分屏的总像素，避免旋转或大屏下离屏目标无限膨胀。 */
  var dpr=Math.min(window.devicePixelRatio||1,q.dpr,Math.sqrt(5000000/(w*h)));
  GLR.renderer.setPixelRatio(dpr);
  GLR.renderer.setSize(w,h,false);
  GLR.cam.aspect=w/h; GLR.cam.updateProjectionMatrix();
  var cap=GLR.renderer.capabilities;
  var samples=cap.isWebGL2?Math.min(q.samples,cap.maxSamples||0):0;
  var ao=!!q.ao&&(cap.isWebGL2||GLR.renderer.extensions.has('WEBGL_depth_texture'));
  if(GLR.rt.samples!==samples||!!GLR.rt.depthTexture!==ao){
    if(GLR.rt.depthTexture)GLR.rt.depthTexture.dispose();
    GLR.rt.dispose();
    GLR.rt=new THREE.WebGLRenderTarget(2,2,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false});
    GLR.rt.samples=samples;
    if(ao)GLR.rt.depthTexture=new THREE.DepthTexture(2,2,THREE.UnsignedIntType);
  }
  var u=GLR.postMat.uniforms;
  u.tDiffuse.value=GLR.rt.texture;u.tDepth.value=GLR.rt.depthTexture||GLR.rt.texture;
  u.uAO.value=ao?q.ao:0;u.uAA.value=q.samples&&!samples?1:0;
  var RTS=(GLRTEST&&GLRTEST.hq)?1:q.scale;
  var rw=Math.max(2,Math.round(w*dpr*RTS)), rh=Math.max(2,Math.round(h*dpr*RTS));
  GLR.rt.setSize(rw,rh);
  GLR.postMat.uniforms.uRes.value.set(rw,rh);
};
