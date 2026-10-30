/* 里世界 3D · 常见小物件（摆放；模型见 tools/blender/assets/props.py）
   房间、走廊、室外都会用到的、照着真东西做的小件：吊扇、吊装的灯、安全出口灯、应急灯、监控探头、烟感、
   开关面板、饮水机、分类垃圾桶、卫生角（拖把、扫把、水桶、簸箕）、盆栽、柜式空调、吊装投影机、
   窗帘、书立和竖着的书、水杯。

   约定：
     · K 是 Kit；坐标是房间（或室外）坐标，米；rot 是绕竖轴的转角，局部 +z 朝屋里（朝人）。
     · 贴墙的东西的「背面」在局部 z=0 处，往 +z 长出来。
     · 落地的东西由调用方登记碰撞（c.solid / addSolidM），这里只管模型。
     · 细节按档位取舍：流畅档（lodLow）省掉看不清的小零件。 */
'use strict';

/* 道具都在 Blender 里建（tools/blender/assets/props.py），这里只管摆。吊在顶上的按吊顶 3 米建，ceilY 不是 3 米时整体平移 */
/* ---- 吊扇：吸顶罩、吊杆、电机罩、三片带倾角的扇叶。扇叶离地 2.70 米（巡察者 2.6 米高，不会扫到头） ---- */
function propCeilFan(K,x,z,ceilY,seed){
  K.asset('fan_ceiling',x,ceilY-3,z,hash2(seed||1,7)*6.283);
}

/* ---- 吊装的灯具（教室护眼灯）：灯面离地 2.68 米 ----
   state：'off' 熄掉的（灰白磨砂面）、'dying' 快坏的（一阵阵抽搐），其余是亮的 */
function lampOpt(state){
  if(state==='off') return {mat:{emit:'dead'},tint:{lamp:0x8a9094}};
  if(state==='dying') return {mat:{emit:'emitDying'}};
  return null;
}
function propHangLamp(K,x,z,len,wid,ceilY,lampY,rot,state){
  K.asset('lamp_hang_120',x,ceilY-3,z,rot||0,lampOpt(state));
}

function lampMat(state){ return state==='off'?'dead':(state==='dying'?'emitDying':'emit'); }
/* ---- 安全出口灯：绿色灯箱，白色的人往门跑（背面在 z，中心高 y） ---- */
function propExitSign(K,x,y,z,rot,arrow){ K.asset(arrow?'sign_exit_arrow':'sign_exit',x,y,z,rot||0); }
/* ---- 应急照明灯：白壳、两个圆灯头 ---- */
function propEmergencyLight(K,x,y,z,rot){ K.asset('light_emergency',x,y,z,rot||0); }
/* ---- 监控探头（半球） / 烟感 ---- */
function propCamDome(K,x,z,ceilY){ K.asset('cam_dome',x,ceilY-3,z,0); }
function propSmoke(K,x,z,ceilY){ K.asset('smoke_detector',x,ceilY-3,z,0); }
/* ---- 墙上的开关面板（三联） / 插座 ---- */
function propSwitch(K,x,y,z,rot,n){ K.asset('switch_3',x,y,z,rot||0); }
function propSocket(K,x,y,z,rot){ K.asset('socket',x,y,z,rot||0); }

/* ---- 饮水机 + 一桶水（占地 0.34 × 0.34） ---- */
function propWaterDispenser(K,x,z,rot){ K.asset('water_dispenser',x,0,z,rot||0); }
/* ---- 分类垃圾桶：一组两个（可回收 / 其他），翻盖 ---- */
function propBinPair(K,x,z,rot){ K.asset('bin_pair',x,0,z,rot||0); }
/* ---- 卫生角：水桶、拖把、扫把、簸箕，靠墙放（墙在局部 z=0，往 +z 摆开，占地约 0.9 × 0.4） ---- */
function propCleaning(K,x,z,rot){ K.asset('cleaning_corner',x,0,z,rot||0); }
/* ---- 盆栽（发财树 / 绿萝），h 是大小 ---- */
function propPlant(K,x,z,h,seed){ K.asset((seed||1)%2?'plant_money':'plant_pothos',x,0,z,hash2(seed||1,3)*6.283,{s:h||1}); }
/* ---- 柜式空调（占地 0.50 × 0.30，背靠墙） ---- */
function propACCabinet(K,x,z,rot){ K.asset('ac_cabinet',x,0,z,rot||0); }
/* ---- 吊装投影机（镜头朝 -z） ---- */
function propProjector(K,x,z,ceilY,rot){ K.asset('projector',x,ceilY-3,z,rot||0); }
/* ---- 窗帘（1.5 米宽的窗）：帘杆，两边各一幅收起来的布；局部 z=0 是墙面 ---- */
function propCurtains(K,x,z,rot,w,y0,y1,col,seed){ K.asset('curtains_150',x,0,z,rot||0,{tint:{c:col}}); }
/* ---- 课桌上的书立：两片金属挡板中间竖着一排书（沿局部 x 排开，书脊朝 -z）。长度就近挑一款 ---- */
var BOOK_ROWS=[26,32,38,44];
function propBooksUpright(K,x,y,z,len,seed,rot){
  var L=BOOK_ROWS[0], i;
  for(i=0;i<BOOK_ROWS.length;i++) if(BOOK_ROWS[i]<=len*100+3) L=BOOK_ROWS[i];
  K.asset('books_row_'+L+((seed&1)?'b':'a'),x,y,z,rot||0);
}
/* ---- 一摞横放的书（大小不一，错开一点）；返回书顶的高度 ---- */
function propBookPile(K,x,y,z,n,seed){
  var name='books_pile_'+Math.max(2,Math.min(4,n|0)), a=Assets.get(name);
  K.asset(name,x,y,z,(hash2(seed,2)-0.5)*0.6);
  return y+((a&&a.m.k&&a.m.k.h)||0.05);
}
/* ---- 水杯：磨砂塑料杯身 + 盖（h 是高度） ---- */
function propBottle(K,x,y,z,col,h){ K.asset('bottle_water',x,y,z,hash2(x*31|0,z*17|0)*6.28,{tint:{b:col||0x8ab8d8},s:(h||0.22)/0.20}); }
/* ---- 墙上挂的东西：画框里的一张纸（标语、名人名言、课程表），局部 z=0 是墙面 ---- */
var FRAME_HEAD=[0xb8483a,0x3a6a9a,0x4a7a4a,0xc8902a];
function propFrame(K,x,y,z,rot,w,h,paper,frame,seed){
  var sd=seed||1;
  K.asset('frame_poster_'+'abcd'[sd%4],x,y,z,rot||0,{tint:{p:paper||0xe8e4d8,h:FRAME_HEAD[sd%4]}});
}

/* ---- 污渍贴花：kind 0 水渍、1 霉斑、2 手印、3 蹭痕（图集里的一格）。
   face：'u' 地上（朝上）、'd' 吊顶（朝下）、'n'/'s'/'e'/'w' 墙面（法线朝 -z/+z/+x/-x）。
   (x,y,z) 是中心，w×h 是大小，rot 在面内转（只对地上、吊顶有效） ---- */
var DECAL_UV=[[0,0.5],[0.5,0.5],[0,0],[0.5,0]];
function propDecal(K,kind,face,x,y,z,w,h,col,rot){
  var o=DECAL_UV[kind], u0=o[0]+0.01, v0=o[1]+0.01, u1=o[0]+0.49, v1=o[1]+0.49, UV=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
  var c=Math.cos(rot||0), s=Math.sin(rot||0), hw=w/2, hh=h/2, P, n;
  function F(a,b){ return [a*c-b*s, a*s+b*c]; }
  if(face==='u'||face==='d'){
    var q=[F(-hw,hh),F(hw,hh),F(hw,-hh),F(-hw,-hh)];
    P=q.map(function(p){ return [x+p[0],y,z+p[1]]; });
    n=[0,1,0];
    if(face==='d'){ P=[P[1],P[0],P[3],P[2]]; UV=[UV[1],UV[0],UV[3],UV[2]]; n=[0,-1,0]; }
  }else if(face==='s'){ P=[[x-hw,y-hh,z],[x+hw,y-hh,z],[x+hw,y+hh,z],[x-hw,y+hh,z]]; n=[0,0,1]; }
  else if(face==='n'){ P=[[x+hw,y-hh,z],[x-hw,y-hh,z],[x-hw,y+hh,z],[x+hw,y+hh,z]]; n=[0,0,-1]; }
  else if(face==='e'){ P=[[x,y-hh,z+hw],[x,y-hh,z-hw],[x,y+hh,z-hw],[x,y+hh,z+hw]]; n=[1,0,0]; }
  else { P=[[x,y-hh,z-hw],[x,y-hh,z+hw],[x,y+hh,z+hw],[x,y+hh,z-hw]]; n=[-1,0,0]; }
  var b=K.g('grime'); b.face(P,n,b._rgb(col,1),false,null,UV);
}
/* ---- 地上一张纸（卷子、通知、作业本撕下来的一页），边角微卷，随便一个角度 ---- */
function propFloorPaper(K,x,z,rot,seed){
  var F=K.sub(x,z,rot);
  K.asset('paper_floor',0,0,0,0,{shade:[1,0.95,0.92][seed%3]});
  if(seed%4===0) K.asset('paper_floor',0.03,0.0025,0.05,0.35,{shade:0.9});
  K.restore(F);
}
