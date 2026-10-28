'use strict';
/* ---- 建模：柱子、台阶、栏杆、顶层平台和钟 ---- */
function buildSpiral(c){
  var K=c.K, s=SPIRAL, i, n=s.steps*s.turns, da=TAU/s.steps, rise=s.turnH/s.steps;
  var rm=(s.rIn+s.rOut)/2, len=s.rOut-s.rIn;
  K.cyl('stone',s.cx,0,s.cz,s.rCol+0.08,s.rCol,s.topH,16,0x7a746a,1.0);              /* 中间的石柱 */
  K.cyl('stone',s.cx,0,s.cz,s.rCol+0.22,s.rCol+0.18,0.25,16,0x6a645a,0.95);
  for(i=0;i<n;i++){
    var a=s.th0+(i+0.5)*da, h=(i+1)*rise;
    var x=s.cx+Math.cos(a)*rm, z=s.cz+Math.sin(a)*rm;
    /* Kit 的 frame 旋转：局部 x 轴转到 (cos, -sin)。台阶长边沿半径方向 */
    K.frame(x,z,-a,0);
    K.box('stone',0,h-0.07,0,len,0.14,rm*da*1.08,shadeHex(0x8a8478,(i&1)?1.0:0.92),1.0);
    K.box('stone',0,h-0.30,0,len*0.92,0.32,rm*da*0.9,0x5a544c,0.85);                  /* 台阶底下的石梁 */
    K.box('metal',len/2-0.06,h+0.45,0,0.04,0.90,0.04,0x2a2622,1.0);                      /* 外侧栏杆柱 */
    K.unframe();
    if(i>0){
      var a0=s.th0+(i-0.5)*da, h0=i*rise;
      K.rod('wood',s.cx+Math.cos(a0)*(s.rOut-0.06),h0+0.92,s.cz+Math.sin(a0)*(s.rOut-0.06),
                   s.cx+Math.cos(a)*(s.rOut-0.06),h+0.92,s.cz+Math.sin(a)*(s.rOut-0.06),0.03,0.03,5,0x4a3626);   /* 扶手 */
    }
  }
  /* 顶层平台：一圈扇形石板，最后一段楼梯上方留口子 */
  var segs=40, sa=TAU/segs, top=s.topH, tEnd=s.th0+s.amax;
  K.cyl('stone',s.cx,top-0.16,s.cz,s.rIn+0.02,s.rIn+0.02,0.16,16,0x6e685e,1.0);
  for(i=0;i<segs;i++){
    var am=i*sa+sa/2, d=spTopOffset(am);
    if(d<=0&&d>=-s.hole) continue;
    K.frame(s.cx+Math.cos(am)*rm,s.cz+Math.sin(am)*rm,-am,0);
    K.box('stone',0,top-0.08,0,len,0.16,rm*sa*1.12,0x7e786c,1.0);
    K.box('metal',len/2-0.05,top+0.5,0,0.04,1.0,0.04,0x2a2622,1.0);
    K.unframe();
    var a1=i*sa, a2=(i+1)*sa;
    K.rod('wood',s.cx+Math.cos(a1)*(s.rOut-0.05),top+0.98,s.cz+Math.sin(a1)*(s.rOut-0.05),
                 s.cx+Math.cos(a2)*(s.rOut-0.05),top+0.98,s.cz+Math.sin(a2)*(s.rOut-0.05),0.03,0.03,5,0x4a3626);
  }
  /* 口子靠下那一边的栏杆（楼梯在它下面两米多） */
  var ae=tEnd-s.hole, ce=Math.cos(ae), se=Math.sin(ae), rr;
  for(rr=s.rIn+0.15;rr<s.rOut;rr+=0.6) K.rod('metal',s.cx+ce*rr,top,s.cz+se*rr,s.cx+ce*rr,top+0.96,s.cz+se*rr,0.02,0.02,5,0x2a2622);
  K.rod('wood',s.cx+ce*(s.rIn+0.05),top+0.98,s.cz+se*(s.rIn+0.05),s.cx+ce*(s.rOut-0.05),top+0.98,s.cz+se*(s.rOut-0.05),0.03,0.03,5,0x4a3626);
  /* 钟：挂在横贯两面墙的木梁上（以前两根立柱立在平台边，现在那里是楼梯口，柱子会挡头） */
  var cc={K:K,R:c.R,ao:function(){},solid:function(){},beamW:c.W-1.2};
  K.frame(0,0,0,top); FURN.U(cc,Math.floor(s.cx+c.halfW),Math.floor(s.cz+c.halfH),s.cx,s.cz); K.unframe();
}
