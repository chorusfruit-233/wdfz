/* 里世界 3D · 回放轨迹编解码（纯规则）
   采样点 [t(十分之一秒), 场景序号, x/2, y/2, 朝向(0–63)]，按字段做差、zigzag、每字符 5 位的变长编码，
   字母表与楼层草图同一套（A–Z a–z 0–9 - _）。30 分钟一局约 15–20 KB。 */
'use strict';
var RunTrack=(function(){
  var B='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', F=5;
  function zig(n){ return n>=0?n*2:(-n*2-1); }
  function unzig(z){ return z%2===0?z/2:-(z+1)/2; }
  function put(out,v){
    v=zig(v);
    while(v>=32){ out.push(B.charAt((v%32)|32)); v=Math.floor(v/32); }
    out.push(B.charAt(v));
  }
  function encode(samples){
    var out=[], prev=[0,0,0,0,0], i, k, p;
    for(i=0;i<samples.length;i++){
      p=samples[i];
      for(k=0;k<F;k++){ var v=Math.round(+p[k]||0); put(out,v-prev[k]); prev[k]=v; }
    }
    return out.join('');
  }
  function decode(str){
    var res=[], prev=[0,0,0,0,0], cur=[], k=0, v=0, mul=1, i, c;
    str=String(str||'');
    for(i=0;i<str.length;i++){
      c=B.indexOf(str.charAt(i)); if(c<0) return res;             /* 坏数据：到此为止，前面的照用 */
      v+=(c&31)*mul;
      if(c&32){ mul*=32; continue; }
      prev[k]+=unzig(v); cur.push(prev[k]); v=0; mul=1; k++;
      if(k===F){ res.push(cur); cur=[]; k=0; }
    }
    return res;
  }
  /* 在时间 t 的位置：前后两个采样点之间线性插值（换场景时不插值） */
  function at(samples,t){
    if(!samples.length) return null;
    var lo=0, hi=samples.length-1;
    if(t<=samples[0][0]) return samples[0].slice();
    if(t>=samples[hi][0]) return samples[hi].slice();
    while(hi-lo>1){ var m=(lo+hi)>>1; if(samples[m][0]<=t) lo=m; else hi=m; }
    var a=samples[lo], b=samples[hi];
    if(a[1]!==b[1]||b[0]===a[0]) return a.slice();
    var u=(t-a[0])/(b[0]-a[0]);
    return [t,a[1],a[2]+(b[2]-a[2])*u,a[3]+(b[3]-a[3])*u,a[4]];
  }
  return {encode:encode,decode:decode,at:at};
})();
