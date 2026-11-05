"""生成巡察离屏碰撞栅格。只构建几何代理；运行时不依赖渲染缓存。"""
from pathlib import Path
import json, sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tests'))
from browser_case import BrowserCase
ROOT = Path(__file__).resolve().parents[1]
BAKE = r'''() => {
 const out={};
 function bake(W,H,step,ox,oy,rects){
   const bytes=new Uint8Array(Math.ceil(W*H/8)),r=.30/U2M;
   for(const b of rects){
     const i0=Math.max(0,Math.floor((b[0]-r-ox)/step)),i1=Math.min(W-1,Math.floor((b[2]+r-ox)/step));
     const j0=Math.max(0,Math.floor((b[1]-r-oy)/step)),j1=Math.min(H-1,Math.floor((b[3]+r-oy)/step));
     for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
       const x=ox+(i+.5)*step,y=oy+(j+.5)*step;
       if(x>b[0]-r&&x<b[2]+r&&y>b[1]-r&&y<b[3]+r){const k=i+j*W;bytes[k>>3]|=1<<(k&7);}
     }
   }
   let raw='';bytes.forEach(v=>raw+=String.fromCharCode(v));return {W,H,step,ox,oy,bits:btoa(raw)};
 }
 for(const [id,R] of Object.entries(INTERIORS)){
   if(R.build||R.host==='lift')continue;
   const group=buildRoomGeometry(R),rects=[];
   // 电梯门格（J）对玩家只有两侧门框挡人、门洞按门的开度挡；巡察者不进轿厢，所以对它整格算墙
   for(let y=0;y<R.rows;y++)for(let x=0;x<R.cols;x++)if((isSolidCh(R.grid[y][x])&&!(R.grid[y][x]==='S'&&STAIR_LAYOUT.some(s=>s.rooms.includes(id))))||R.grid[y][x]==='O'||R.grid[y][x]==='J')rects.push([R.ox+x*R.tw,R.oy+y*R.th,R.ox+(x+1)*R.tw,R.oy+(y+1)*R.th]);
   Object.values(R.foot||{}).flat().concat(R.stairExtra||[],R.propExtra||[]).forEach(b=>rects.push([R.cx+b.x0/U2M,R.cy+b.z0/U2M,R.cx+b.x1/U2M,R.cy+b.z1/U2M]));
   out[id]=bake(R.cols*4,R.rows*4,R.tw/4,R.ox,R.oy,rects);ThreeBackend.disposeGroup(group);
 }
 const group=buildOutdoorGeometry(),r=[];
 OBJ.filter(o=>o.k==='roof'&&!o.open).forEach(o=>r.push([o.x*SC,o.y*SC,(o.x+o.w)*SC,(o.y+o.h)*SC]));
 OUT_SOLID.forEach(b=>r.push([b.x0*SC,b.y0*SC,b.x1*SC,b.y1*SC]));
 const step=9,ox=(BOUND.x0+4)*SC,oy=(BOUND.y0+4)*SC,W=Math.floor(((BOUND.x1-4)*SC-ox)/step),H=Math.floor(((BOUND.y1-4)*SC-oy)/step);
 out.out=bake(W,H,step,ox,oy,r);out.out.occluders=r;ThreeBackend.disposeGroup(group);
 return out;
}'''
if __name__ == '__main__':
    BrowserCase.setUpClass(); test=BrowserCase(); test.setUp()
    try:
        p=test.page(); data=p.evaluate(BAKE)
        target=ROOT/'game3d/js/modules/patrol-world/geometry.js'
        target.write_text("/* tools/patrol_geometry.py 生成；0.25 米室内 / 1 米室外栅格，身体半径 0.30 米，门可穿行。 */\n'use strict';\nvar PATROL_GEOMETRY="+json.dumps(data,separators=(',',':'))+';\n')
        print(f'{len(data)} 个静态场景，{target.stat().st_size} 字节')
    finally:
        test.tearDown(); BrowserCase.tearDownClass()
