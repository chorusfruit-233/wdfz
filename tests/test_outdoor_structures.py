"""室外构筑物的碰撞：柱廊立柱、连廊落地柱、电动车棚（《电梯直通、新天赋、新结局与恐怖氛围》第 4 节）。

基线（main 0098480）：柱廊立柱 40/40、连廊立柱 16/16 能站进去，车棚棚下 0/18 能走进去。
位置只在 content/structure-recipe.js 算一次，建模和碰撞共用。"""
import unittest

from browser_case import BrowserCase


class OutdoorStructureTest(BrowserCase):
    def outside(self):
        page = self.page()
        page.evaluate("Game.start('easy');running=false;clearIntroTimers();S.intro=0;AN.active=false;AN.next=1e6;PAT.next=1e6")
        page.wait_for_function("S.screen==='play'")
        page.evaluate("doExitRoom();0")
        page.wait_for_function("S.mode==='out'")
        return page

    def test_columns_and_link_pillars_block_the_player(self):
        page = self.outside()
        r = page.evaluate("""()=>{const out={cols:0,colsInside:0,pillars:0,pillarsInside:0,between:0,betweenFree:0};
          OBJ.forEach(o=>{const w=objWorld(o),px=(w.x+w.w/2)*U2M,pz=(w.y+w.h/2)*U2M,sw=w.w*U2M,sd=w.h*U2M;
            if(o.k==='roof'&&o.open1f){const cs=colonnadeColumns(px,pz,sw,sd);
              cs.forEach(c=>{out.cols++;if(Collision.depth(c.x/U2M,c.z/U2M,PRAD)<1e-7)out.colsInside++;});
              for(let i=0;i+1<cs.length;i++){if(Math.abs(cs[i+1].x-cs[i].x)>6)continue;out.between++;
                if(Collision.depth((cs[i].x+cs[i+1].x)/2/U2M,cs[i].z/U2M,PRAD)<1e-7)out.betweenFree++;}}
            if(o.k==='link')linkPillars(px,pz,sw,sd).forEach(c=>{out.pillars++;if(Collision.depth(c.x/U2M,c.z/U2M,PRAD)<1e-7)out.pillarsInside++;});});
          return out;}""")
        self.assertEqual((r['cols'], r['colsInside']), (40, 0))
        self.assertEqual((r['pillars'], r['pillarsInside']), (16, 0))
        self.assertGreater(r['between'], 0)
        self.assertEqual(r['betweenFree'], r['between'])              # 柱子之间照样能走

    def test_bike_shed_is_walkable_but_frames_and_bikes_are_solid(self):
        page = self.outside()
        r = page.evaluate("""()=>{const o=OBJ.find(x=>x.id==='shed'),w=objWorld(o),px=(w.x+w.w/2)*U2M,pz=(w.y+w.h/2)*U2M,sw=w.w*U2M,sd=w.h*U2M,L=shedLayout(px,pz,sw,sd);
          const free=(x,z)=>Collision.depth(x/U2M,z/U2M,PRAD)<1e-7;let aisle=0,n=0;
          for(let k=1;k<10;k++){const z=pz-sd/2+sd*k/10;[px+1.6,px-2.6].forEach(x=>{n++;if(free(x,z))aisle++;});}
          return {open:!!o.open,aisle,n,frames:L.frames.length,frameSolid:L.frames.every(z=>L.colX.every(x=>!free(x,z))),
            bikes:L.bikes.length,bikeSolid:L.bikes.every(b=>!free(b.x,b.z)),solidAt:solidAt((px+1.6)/U2M,pz/U2M)};}""")
        self.assertTrue(r['open'])
        self.assertEqual((r['aisle'], r['n']), (18, 18))
        self.assertGreater(r['frames'], 5)
        self.assertTrue(r['frameSolid'])
        self.assertGreater(r['bikes'], 0)
        self.assertTrue(r['bikeSolid'])
        self.assertFalse(r['solidAt'])                                 # 旧的格子判定也不再把棚下当实心

    def test_standing_under_the_shed_counts_as_shelter_and_as_a_visited_place(self):
        page = self.outside()
        r = page.evaluate("""()=>{const o=OBJ.find(x=>x.id==='shed'),w=objWorld(o);
          S.x=w.x+w.w/2+1.6/U2M;S.y=w.y+w.h/2;
          const sheltered=underRoof(),zones=RunScore.totals().zones;GameModules.emit('tick',0.6);
          return {sheltered,listed:zones.indexOf('shed')>=0,visited:!!RunScore.state().zones.shed};}""")
        self.assertTrue(r['sheltered'])                               # 暴雨里站在棚下算有顶
        self.assertTrue(r['listed'] and r['visited'])                 # 探索度的室外场地包括车棚

    def test_layout_is_shared_by_model_and_collision(self):
        page = self.page()
        r = page.evaluate("""()=>{const src=bldShed.toString()+bldClassroom.toString()+bldLink.toString();
          return {shed:src.indexOf('shedLayout')>=0,col:src.indexOf('colonnadeColumns')>=0,link:src.indexOf('linkPillars')>=0,
            solids:SpaceLayout.ensureOutside.toString().indexOf('addStructureSolids')>=0}}""")
        self.assertEqual(r, {'shed': True, 'col': True, 'link': True, 'solids': True})


if __name__ == '__main__':
    unittest.main()
