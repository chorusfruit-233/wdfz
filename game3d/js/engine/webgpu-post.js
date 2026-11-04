/* @module-capsule */
(function($imports){
/* Native WGSL equivalent of the WebGL post pass. UI and input stay outside this pass. */
'use strict';
var WebGPUPost={create:function(uniforms,multisampled){
  var N=$imports.RenderDevice.library();
  var depthType=multisampled?'texture_depth_multisampled_2d':'texture_depth_2d';
  var hash=N.wgslFn(`fn schoolHash(p:vec2<f32>)->f32{
    // Float products lose fractional precision as the pixel/time offset grows, creating bands.
    var h=bitcast<u32>(p.x)^(bitcast<u32>(p.y)*0x9e3779b9u);
    h=(h^(h>>16u))*0x7feb352du;h=(h^(h>>15u))*0x846ca68bu;h=h^(h>>16u);
    return f32(h&0x00ffffffu)/16777216.0;
  }`);
  var color=N.wgslFn(`fn schoolColor(tex:texture_2d<f32>,texSampler:sampler,uv:vec2<f32>,res:vec2<f32>,aa:f32)->vec3<f32>{
    let c=textureSampleLevel(tex,texSampler,uv,0.0).rgb;if(aa<0.5){return c;}
    let px=vec2<f32>(1.0)/res;
    let n=textureSampleLevel(tex,texSampler,uv+vec2<f32>(0.0,px.y),0.0).rgb;
    let s=textureSampleLevel(tex,texSampler,uv-vec2<f32>(0.0,px.y),0.0).rgb;
    let e=textureSampleLevel(tex,texSampler,uv+vec2<f32>(px.x,0.0),0.0).rgb;
    let w=textureSampleLevel(tex,texSampler,uv-vec2<f32>(px.x,0.0),0.0).rgb;
    let l=vec3<f32>(0.299,0.587,0.114);let edge=max(abs(dot(n-s,l)),abs(dot(e-w,l)));
    return mix(c,(n+s+e+w+c*4.0)/8.0,smoothstep(0.08,0.25,edge)*0.7);
  }`);
  var depth=N.wgslFn(`fn schoolDepth(tex:${depthType},uv:vec2<f32>,near:f32,far:f32)->f32{
    let size=vec2<i32>(textureDimensions(tex));let at=clamp(vec2<i32>(uv*vec2<f32>(size)),vec2<i32>(0),size-vec2<i32>(1));
    ${multisampled?'var d=0.0;let count=textureNumSamples(tex);for(var i=0u;i<count;i++){d+=textureLoad(tex,at,i32(i));}d/=f32(count);':'let d=textureLoad(tex,at,0);'}
    return near*far/(far-d*(far-near));
  }`);
  var ao=N.wgslFn(`fn schoolAO(tex:${depthType},uv:vec2<f32>,res:vec2<f32>,strength:f32,near:f32,far:f32)->f32{
    if(strength<=0.0){return 1.0;}let z=schoolDepth(tex,uv,near,far);if(z>55.0){return 1.0;}
    let radius=clamp(res.y*0.16/max(z,0.2),2.0,32.0);var occ=0.0;
    for(var i=0;i<8;i++){let a=f32(i)*0.785398;let d=vec2<f32>(cos(a),sin(a));
      let dz=z-schoolDepth(tex,clamp(uv+d*radius/res,vec2<f32>(0.001),vec2<f32>(0.999)),near,far);
      occ+=smoothstep(0.035,0.22,dz)*(1.0-smoothstep(0.35,1.2,dz));}
    return 1.0-strength*occ/8.0;
  }`,[depth]);
  var fn=N.wgslFn(`fn schoolPost(vUv:vec2<f32>,pixel:vec2<f32>,tDiffuse:texture_2d<f32>,sceneSampler:sampler,tDepth:${depthType},
    tHands:texture_2d<f32>,handSampler:sampler,uRes:vec2<f32>,uTime:f32,uWarp:f32,uEdge:f32,uFocus:f32,uSan:f32,
    uHurt:f32,uFlash:f32,uFx:f32,uDm:f32,uDt:f32,uBright:f32,uExpo:f32,uRed:f32,uGaze:f32,uBloom:f32,uGrain:f32,
    uInvert:f32,uAO:f32,uNear:f32,uFar:f32,uAA:f32,uHands:f32)->vec4<f32>{
    var uv=vUv;let wob=clamp((0.75-uSan)/0.75,0.0,1.0);let dc=uv-vec2<f32>(0.5);
    let edge=smoothstep(0.25,0.5,max(abs(dc.x),abs(dc.y)));let breath=sin(uTime*1.8+dot(dc,dc)*9.0);
    uv+=normalize(dc*uRes+vec2<f32>(0.00001))*edge*breath*uWarp*(10.0*min(uRes.x,uRes.y)/720.0)/uRes*(1.0-uFx);
    uv=clamp(uv,vec2<f32>(0.001),vec2<f32>(0.999));let ca=uFocus*edge*0.004*(1.0-uFx);
    var col=schoolColor(tDiffuse,sceneSampler,uv,uRes,uAA);
    col.r=schoolColor(tDiffuse,sceneSampler,uv+dc*ca,uRes,uAA).r;
    col.b=schoolColor(tDiffuse,sceneSampler,uv-dc*ca,uRes,uAA).b;
    col*=schoolAO(tDepth,uv,uRes,uAO,uNear,uFar);
    col*=1.0-uEdge*smoothstep(0.18,0.7,distance(uv,vec2<f32>(0.5)));
    if(uHands>0.5){let hand=textureSampleLevel(tHands,handSampler,vUv,0.0);col=mix(col,hand.rgb,hand.a);}
    if(uBloom>0.0){var bl=vec3<f32>(0.0);let asp=vec2<f32>(uRes.y/uRes.x,1.0);
      for(var i=0;i<12;i++){let a=f32(i)*0.5236+0.26;let o=vec2<f32>(cos(a),sin(a))*asp;
        bl+=max(textureSampleLevel(tDiffuse,sceneSampler,uv+o*0.007,0.0).rgb-vec3<f32>(0.62),vec3<f32>(0.0));
        bl+=max(textureSampleLevel(tDiffuse,sceneSampler,uv+o*0.017,0.0).rgb-vec3<f32>(0.62),vec3<f32>(0.0))*0.65;
        bl+=max(textureSampleLevel(tDiffuse,sceneSampler,uv+o*0.034,0.0).rgb-vec3<f32>(0.62),vec3<f32>(0.0))*0.35;}
      col+=bl/12.0*uBloom;}
    let x=col*uBright*uExpo*0.96;col=clamp((x*(2.51*x+vec3<f32>(0.03)))/(x*(2.43*x+vec3<f32>(0.59))+vec3<f32>(0.14)),vec3<f32>(0.0),vec3<f32>(1.0));
    let lum=dot(col,vec3<f32>(0.2126,0.7152,0.0722));col=mix(vec3<f32>(lum),col,mix(0.46+0.49*uGaze,1.0,uFx));
    col*=vec3<f32>(1.03,1.00,0.985);let lm2=dot(col,vec3<f32>(0.299,0.587,0.114));
    let tint=mix(vec3<f32>(0.66,0.90,1.02),vec3<f32>(1.0,0.98,0.90),smoothstep(0.04,0.50,lm2));
    col*=mix(tint,vec3<f32>(1.0),uFx);col=col*col*(vec3<f32>(3.0)-2.0*clamp(col,vec3<f32>(0.0),vec3<f32>(1.0)))*0.28+col*0.72;
    col=max(col-vec3<f32>(0.009*(1.0-uFx)),vec3<f32>(0.0))*(1.0+0.009*(1.0-uFx));let vg=distance(uv,vec2<f32>(0.5));
    col*=1.0-0.84*smoothstep(0.20,0.95,vg*1.28)*(1.0-uFx);
    col*=mix(vec3<f32>(1.0),vec3<f32>(1.0,0.32,0.27),uHurt*0.85);
    col=mix(col,vec3<f32>(0.16,0.0,0.0),uHurt*0.55*smoothstep(0.28,0.95,vg*1.3));
    col+=vec3<f32>(0.90,0.95,1.0)*uFlash*0.8;
    col=mix(col,vec3<f32>(dot(col,vec3<f32>(0.5,0.4,0.1)))*vec3<f32>(1.35,0.22,0.18),uRed*0.75);
    col=mix(col,col*vec3<f32>(1.12,0.93,0.66),uGaze*0.7);
    col=mix(col,vec3<f32>(0.022,0.011,0.0),uGaze*0.85*smoothstep(0.24,0.86,vg*1.25));
    if(uDm>0.5&&uDm<1.5){col*=1.0-uDt*0.72;
      for(var i=0;i<12;i++){let a=f32(i)*0.5236;let dd=vec2<f32>(cos(a),sin(a));let q=uv-vec2<f32>(0.5);
        if(dot(q,dd)>0.0&&abs(dot(q,vec2<f32>(-dd.y,dd.x)))<0.0030*(0.3+uDt)){col=mix(col,vec3<f32>(0.03,0.025,0.02),0.62*uDt);}}}
    if(uDm>1.5&&uDm<2.5){col=mix(col,vec3<f32>(0.24,0.31,0.39),0.42*uDt);let sx=uv.x*3.0+uv.y*1.6-uTime*0.9;
      col+=vec3<f32>(0.62,0.70,0.80)*step(0.88,fract(sx*38.0))*0.22*uDt;col*=1.0-smoothstep(0.5,1.0,uDt)*0.92;}
    if(uDm>2.5){col*=1.0-0.55*uDt;let q=uv-vec2<f32>(0.5);let fr=max(abs(q.x)/0.20,abs(q.y)/0.34);
      col=mix(col,vec3<f32>(0.78,0.86,0.92)*(0.5+0.3*sin(uTime*8.0)),(step(0.97,fr)-step(1.0,fr))*0.85);
      let sc=1.0-uDt*0.75;let ee=length(vec2<f32>(q.x/(0.10*sc),q.y/(0.19*sc)));
      col=mix(col,vec3<f32>(0.82,0.81,0.78),step(ee,1.0)*0.8*(1.0-uDt*0.7));
      for(var j=0;j<8;j++){let a=f32(j)*0.7854;let d=vec2<f32>(cos(a),sin(a));
        if(dot(q,d)>0.0&&abs(dot(q,vec2<f32>(-d.y,d.x)))<0.0016){col=mix(col,vec3<f32>(1.0),0.32*uDt);}}}
    col=clamp(col,vec3<f32>(0.0),vec3<f32>(1.0));
    var outc=select(col*12.92,1.055*pow(col,vec3<f32>(1.0/2.4))-vec3<f32>(0.055),col>=vec3<f32>(0.0031308));
    let gn=schoolHash(pixel+vec2<f32>(floor(uTime*24.0)*17.31))-0.5;
    let gLum=dot(outc,vec3<f32>(0.299,0.587,0.114));
    outc+=vec3<f32>(0.011)*(1.0-smoothstep(0.0,0.3,gLum))*(1.0-uFx);
    outc+=vec3<f32>(gn*(0.012+0.026*(1.0-smoothstep(0.03,0.45,gLum)))*(1.0+0.7*wob)*(1.0-uFx)*uGrain);
    outc=mix(outc,vec3<f32>(1.0)-clamp(outc,vec3<f32>(0.0),vec3<f32>(1.0)),uInvert);
    // Node output performs the final sRGB transfer; return working-space values to avoid a second transfer.
    outc=max(outc,vec3<f32>(0.0));
    let linear=select(outc/12.92,pow((outc+vec3<f32>(0.055))/1.055,vec3<f32>(2.4)),outc>vec3<f32>(0.04045));
    return vec4<f32>(linear,1.0);
  }`,[hash,color,ao]);
  var bindings={vUv:N.screenUV,pixel:N.screenCoordinate};
  Object.keys(uniforms).forEach(function(key){
    var u=uniforms[key],node=key[0]==='t'?N.texture(u.value):N.uniform(u.value);
    bindings[key]=node;
    Object.defineProperty(u,'value',{configurable:true,enumerable:true,get:function(){return node.value;},set:function(value){node.value=value;}});
  });
  bindings.sceneSampler=N.sampler(bindings.tDiffuse);bindings.handSampler=N.sampler(bindings.tHands);
  var material=new N.NodeMaterial();material.name='School WebGPU post';material.fog=false;material.toneMapped=false;
  material.depthTest=false;material.depthWrite=false;
  material.vertexNode=N.vec4(N.positionLocal.xy,0,1);material.fragmentNode=fn(bindings);material.uniforms=uniforms;
  material.userData.multisampled=!!multisampled;
  return material;
}};

/* @module-exports */
GameModules.publish("game3d/js/engine/webgpu-post.js",{
"WebGPUPost":{get:function(){return WebGPUPost;},set:function($value){WebGPUPost=$value;}}
});
})(GameModules.imports("game3d/js/engine/webgpu-post.js"));
