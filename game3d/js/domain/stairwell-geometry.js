/* Metres, two flights per level. No DOM, models or current scene globals. */
'use strict';
var StairGeometry=(function(){
  var C=Object.freeze({halfWidth:2.2,slot:.3,front:-1.2,door:-2.8,runStart:.8,runEnd:5.6,back:7.2,rail:.09});
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function surfaces(levels,rise){
    var a=[];
    for(var f=0;f<levels;f++){
      a.push({x0:-2.2,x1:2.2,z0:-1.2,z1:.8,h0:f*rise,h1:f*rise});
      a.push({x0:-.85,x1:.85,z0:-3.5,z1:-1.2,h0:f*rise,h1:f*rise});
      if(f===levels-1)continue;
      a.push({x0:-2.2,x1:-.3,z0:.8,z1:5.6,h0:f*rise,h1:(f+.5)*rise});
      a.push({x0:-2.2,x1:2.2,z0:5.6,z1:7.2,h0:(f+.5)*rise,h1:(f+.5)*rise});
      a.push({x0:.3,x1:2.2,z0:.8,z1:5.6,h0:(f+1)*rise,h1:(f+.5)*rise});
    }
    return a;
  }
  function height(s,z){return s.h0+(s.h1-s.h0)*clamp((z-s.z0)/(s.z1-s.z0),0,1);}
  function surface(list,x,z,near,maxDelta){
    var best=null,dist=Infinity;
    list.forEach(function(s){if(x<s.x0||x>s.x1||z<s.z0||z>s.z1)return;var h=height(s,z),d=Math.abs(h-near);if(d<dist){dist=d;best={h:h,s:s};}});
    return best&&dist<=(maxDelta===undefined?.28:maxDelta)+1e-8?best:null;
  }
  function depth(list,x,z,r,h){
    if(r<=0)return surface(list,x,z,h)?0:1;
    var bad=surface(list,x,z,h)?0:r;
    for(var i=0;i<12;i++)if(!surface(list,x+Math.cos(i*Math.PI/6)*r,z+Math.sin(i*Math.PI/6)*r,h,.4))bad+=r/12;
    return bad;
  }
  function line(levels,rise){
    var p=[];for(var f=0;f<levels;f++){
      p.push({x:0,z:-.3,h:f*rise});
      if(f<levels-1)p.push({x:-1.25,z:.8,h:f*rise},{x:-1.25,z:5.6,h:(f+.5)*rise},{x:-1.25,z:6.3,h:(f+.5)*rise},
        {x:1.25,z:6.3,h:(f+.5)*rise},{x:1.25,z:5.6,h:(f+.5)*rise},{x:1.25,z:.8,h:(f+1)*rise});
    }return p;
  }
  function project(p,line){
    var best=null,dist=Infinity;
    for(var i=1;i<line.length;i++){
      var a=line[i-1],b=line[i],dx=b.x-a.x,dz=b.z-a.z,dh=b.h-a.h,n=dx*dx+dz*dz+dh*dh;
      var t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz+(p.h-a.h)*dh)/n,0,1),q={x:a.x+t*dx,z:a.z+t*dz,h:a.h+t*dh};
      var d=Math.hypot(q.x-p.x,q.z-p.z,(q.h-p.h)*3);
      if(d<dist){dist=d;best={q:q,index:i-1+t};}
    }return best;
  }
  function segment(list,a,b,radius){
    var n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z,a.h-b.h)/.12));
    for(var i=0;i<=n;i++){var t=i/n;
      if(depth(list,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,radius===undefined?.30:radius,a.h+(b.h-a.h)*t)>1e-7)return false;
    }return true;
  }
  function path(a,b,levels,rise){
    if(segment(surfaces(levels,rise),a,b))return [a,b];
    var l=line(levels,rise),aa=project(a,l),bb=project(b,l);if(!aa||!bb)return null;
    var out=[a,aa.q],mid=[];
    for(var i=0;i<l.length;i++)if(i>Math.min(aa.index,bb.index)&&i<Math.max(aa.index,bb.index))mid.push(l[i]);
    if(aa.index>bb.index)mid.reverse();return out.concat(mid,[bb.q,b]);
  }
  function los(list,a,b){
    if(Math.abs(a.h-b.h)>1.3)return false;
    for(var i=1;i<20;i++){
      var t=i/20,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,h=a.h+(b.h-a.h)*t+1.4;
      if(Math.abs(x)>2.2||z< -3.5||z>7.2)return false;
      // Opaque slabs between floors and the solid stair soffits occlude vision.
      if(list.some(function(s){var y=height(s,z);return x>s.x0&&x<s.x1&&z>s.z0&&z<s.z1&&h>y-.22&&h<y;}))return false;
    }return true;
  }
  return Object.freeze({config:C,surfaces:surfaces,height:height,surface:surface,depth:depth,segment:segment,path:path,los:los});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StairGeometry;
