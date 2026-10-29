/* 无 DOM / WebGL 加载现有地图数据；家具精确碰撞仍需从建模层抽离。 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const shared=require('../shared/content/room-bounds');
const zones=require('../shared/content/zones');

const root=path.join(__dirname,'..');
const context=vm.createContext({});
for(const name of ['game3d/js/core.js','game3d/js/map.js']){
  const source=fs.readFileSync(path.join(root,name),'utf8');
  new vm.Script(source,{filename:name}).runInContext(context,{timeout:1000});
}
context.buildInteriorData();
const rooms=Object.create(null);
for(const id of Object.keys(context.INTERIORS)){
  const r=context.INTERIORS[id];
  rooms[id]={id:r.id,host:r.host,floor:r.floor,principal:!!r.principal,cols:r.cols,rows:r.rows,tw:r.tw,th:r.th,
    grid:Array.from(r.grid,row=>row.join('')),...shared.bounds(r,context.OBJ,context.SC)};
}
const expected=zones.ids.filter(id=>id!=='out').slice().sort().join(',');
if(Object.keys(rooms).sort().join(',')!==expected)throw new Error('地图与联机区域列表不一致');
const outdoor={x0:context.BOUND.x0*context.SC,y0:context.BOUND.y0*context.SC,
  x1:context.BOUND.x1*context.SC,y1:context.BOUND.y1*context.SC};

function contains(zone,x,y){
  if(zone==='out')return x>=outdoor.x0&&x<=outdoor.x1&&y>=outdoor.y0&&y<=outdoor.y1;
  const r=rooms[zone];
  return !!r&&x>=r.ox&&x<=r.ox+r.w&&y>=r.oy&&y<=r.oy+r.h;
}
const clockConfig=JSON.parse(JSON.stringify({schedule:context.SCHED,slowStart:context.BEAST_T0,
  slowEnd:context.BEAST_T1,slowRate:context.BEAST_RATE,dayAt:context.LIGHTS_OUT+10}));
const items=JSON.parse(JSON.stringify(context.ITEMS));
const locks=JSON.parse(JSON.stringify(context.DOOR_LOCKS));
module.exports={rooms,outdoor,contains,clockConfig,items,locks};
