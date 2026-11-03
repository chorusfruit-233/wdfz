"""真实导航的逐帧位移、穿门和抓捕；室外赶路不允许扩散为追逐瞬移。"""
from browser_case import BrowserCase


class PatrolMotionTest(BrowserCase):
    def game(self):
        p = self.page()
        p.evaluate("""freshState('hard');running=false;S.intro=0;PRO.on=false;S.talent='none';
          S.tsec=860;AN.active=false;AN.next=1e6;
          doEnterRoom('teach5',PatrolNav.tilePoint('teach5',30,18));S.seated=false;""")
        return p

    def test_indoor_investigation_moves_every_frame_at_walk_speed(self):
        p = self.game()
        r = p.evaluate("""()=>{const a=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',20,17)),
          b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',40,17));
          Object.assign(PAT,{room:a.scene,x:a.x,y:a.y,fy:0,safety:0,warning:0,near:true,blinkCD:100,
            wirelessSignal:{point:b,remaining:3,locker:null}});
          let total=0,max=0,min=Infinity;
          for(let i=0;i<60;i++){const x=PAT.x,y=PAT.y;PatrolWorld.tick(1/60);
            const d=Math.hypot(PAT.x-x,PAT.y-y);total+=d;max=Math.max(max,d);min=Math.min(min,d);}
          return {total,max,min,after:PAT.afterBlink,behavior:PAT.behavior,dead:S.dead};}""")
        self.assertAlmostEqual(r['total'], 16, places=6)
        self.assertGreater(r['min'], 0)
        self.assertLessEqual(r['max'], 16 / 60 + 1e-7)
        self.assertEqual(r['after'], 0)
        self.assertEqual(r['behavior'], 'investigate')
        self.assertFalse(r['dead'])

    def test_chase_speed_is_continuous_and_independent_of_tick_size(self):
        p = self.game()
        rows = p.evaluate("""()=>{const a=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',20,17)),
          b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',44,17));doEnterRoom('lab3',b);
          return [30,60,144].map(hz=>{patReset();Object.assign(PAT,{room:a.scene,x:a.x,y:a.y,fy:0,
            permanent:true,safety:0,warning:0,near:true,blinkCD:0});
            let total=0,max=0,min=Infinity;
            for(let i=0;i<hz;i++){const x=PAT.x,y=PAT.y;PatrolWorld.tick(1/hz);
              const d=Math.hypot(PAT.x-x,PAT.y-y);total+=d;max=Math.max(max,d);min=Math.min(min,d);}
            return {hz,total,max,min,x:PAT.x,y:PAT.y,after:PAT.afterBlink};});}""")
        for r in rows:
            self.assertAlmostEqual(r['total'], 31, places=6)
            self.assertGreater(r['min'], 0)
            self.assertLessEqual(r['max'], 31 / r['hz'] + 1e-7)
            self.assertEqual(r['after'], 0)
            self.assertAlmostEqual(r['x'], rows[0]['x'], places=6)
            self.assertAlmostEqual(r['y'], rows[0]['y'], places=6)

    def test_closed_network_door_is_crossed_gradually_without_unlocking(self):
        p = self.game()
        r = p.evaluate("""()=>{const a=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,17)),
          b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,12)),path=PatrolNav.path(a,b);
          OPENDOORS={};Object.assign(PAT,{room:a.scene,x:a.x,y:a.y,fy:0,safety:0,warning:0,near:true,
            wirelessSignal:{point:b,remaining:3,locker:null}});
          let time=0,max=0,doorFrames=0,blocked=0;
          while(time<20&&Math.hypot(PAT.x-b.x,PAT.y-b.y)>=6){
            const x=PAT.x,y=PAT.y;PatrolWorld.tick(1/60);time+=1/60;
            max=Math.max(max,Math.hypot(PAT.x-x,PAT.y-y));if(PatrolNav.doorAt({scene:PAT.room,x:PAT.x,y:PAT.y}))doorFrames++;
            const g=PatrolNav.grid(PAT.room);if(!PatrolNav.free(PAT.room,Math.floor((PAT.x-g.ox)/g.step),Math.floor((PAT.y-g.oy)/g.step)))blocked++;
          }
          return {time,max,doorFrames,blocked,last:PAT.lastDoor,open:Object.keys(OPENDOORS),
            arrived:Math.hypot(PAT.x-b.x,PAT.y-b.y)<6,pathLength:PatrolNav.length(path)};}""")
        self.assertTrue(r['arrived'], r)
        self.assertGreater(r['doorFrames'], 1)
        self.assertEqual(r['last'], 'lab3:41:15')
        self.assertEqual(r['open'], [])
        self.assertEqual(r['blocked'], 0)
        self.assertLessEqual(r['max'], 16 / 60 + 1e-7)
        self.assertGreaterEqual(r['time'], (r['pathLength'] - 6) / 16 - .02)

    def test_walk_does_not_keep_refreshing_capture_protection(self):
        p = self.game()
        self.assert_js(p, """(()=>{const b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',40,17));doEnterRoom('lab3',b);
          Object.assign(PAT,{room:'lab3',x:b.x-23,y:b.y,fy:0,permanent:true,locked:true,lock:1,
            lastSeen:b,safety:0,warning:0,near:true,afterBlink:0,blinkCD:100});
          PatrolWorld.tick(.2);return S.dead&&PAT.afterBlink===0;})()""")

    def test_maze_and_bell_walk_on_supported_surfaces_at_bounded_speed(self):
        p = self.game()
        rows = p.evaluate("""()=>{const e=MAZE_CFG.exits[0],m=VoidMaze.toWorld(e.x,e.z),o=VoidMaze.toWorld(0,0),
          R=INTERIORS.bell1,C=SPIRAL,r=(C.rIn+C.rOut)/2,
          goals=[{a:PatrolNav.point('lift_dream',o.x,o.y,0),b:PatrolNav.point('lift_dream',m.x,m.y,e.h)},
            {a:PatrolNav.entry('bell1','O'),b:PatrolNav.point('bell1',R.cx+(C.cx+Math.cos(C.th0+1)*r)/U2M,
              R.cy+(C.cz+Math.sin(C.th0+1)*r)/U2M,C.topH)}];
          return goals.map(({a,b})=>{patReset();Object.assign(PAT,{room:a.scene,x:a.x,y:a.y,fy:a.fy,safety:0,
            wirelessSignal:{point:b,remaining:3,locker:null}});
            let time=0,bad=0,max=0;
            function dist(){return Math.hypot(PAT.x-b.x,PAT.y-b.y,(PAT.fy-b.fy)/U2M);}
            while(dist()>=6&&time<90){const old=PatrolWorld.position();PatrolWorld.tick(1/60);time+=1/60;
              max=Math.max(max,Math.hypot(PAT.x-old.x,PAT.y-old.y,(PAT.fy-old.fy)/U2M));
              if(a.scene==='lift_dream'){const q=VoidMaze.toScene(PAT.x,PAT.y),h=VoidMaze.groundAt(q.x,q.z,PAT.fy+MAZE_CFG.step);
                if(!Number.isFinite(h)||Math.abs(h-PAT.fy)>.45||VoidMaze.depthAt(q.x,q.z,.30,PAT.fy)>1e-7)bad++;
              }else if(PAT.fy>.01){const q=spPolar(R,PAT.x,PAT.y);if(q.r<C.rIn+.29||q.r>C.rOut-.29)bad++;}
            }
            return {room:a.scene,arrived:dist()<6,bad,max,time};});}""")
        for r in rows:
            self.assertTrue(r['arrived'], r)
            self.assertEqual(r['bad'], 0, r)
            self.assertLessEqual(r['max'], 16 / 60 + 1e-7, r)

    def test_replanning_connects_arbitrary_position_without_cutting_wall(self):
        p = self.game()
        self.assert_js(p, """(()=>{const a=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',33,13)),
          b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',35,13)),
          c=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,17)),d=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,12));
          return !PatrolNav.segment(a,b)&&PatrolNav.segment(c,d)&&PatrolNav.segment(c,c);})()""")

    def outdoor_edge(self, p):
        p.evaluate("""const g=PatrolNav.graph(),r=PATROL_ROUTE.nodes;
          window.__travelEdge=r.map((id,i)=>({i,a:g.nodes[r[i-1]],b:g.nodes[id]})).filter(e=>e.a&&e.a.scene==='out'&&e.b.scene==='out')
            .sort((a,b)=>PatrolNav.length(PatrolNav.path(b.a,b.b))-PatrolNav.length(PatrolNav.path(a.a,a.b)))[0];
          if(PatrolNav.length(PatrolNav.path(__travelEdge.a,__travelEdge.b))<480)throw Error('缺少长室外路径');""")

    def test_only_far_outdoor_patrol_can_blink_and_cooldown_survives_save(self):
        p = self.game()
        self.outdoor_edge(p)
        r = p.evaluate("""()=>{const e=__travelEdge;Object.assign(PAT,{room:'out',x:e.a.x,y:e.a.y,fy:0,routeIndex:e.i,
          safety:0,warning:0,near:false,blinkCD:0});PatrolWorld.tick(1/60);
          const jumped=Math.hypot(PAT.x-e.a.x,PAT.y-e.a.y),cooldown=PAT.blinkCD,after=PAT.afterBlink;
          saveGame();applySave(loadGame());const restored=PAT.blinkCD===cooldown;
          const x=PAT.x,y=PAT.y;PatrolWorld.tick(1/60);
          return {jumped,cooldown,after,restored,next:Math.hypot(PAT.x-x,PAT.y-y),behavior:PAT.behavior};}""")
        self.assertGreater(r['jumped'], 100)
        self.assertEqual(r['cooldown'], 8)
        self.assertEqual(r['after'], .22)
        self.assertTrue(r['restored'])
        self.assertLessEqual(r['next'], 16 / 60 + 1e-7)
        self.assertEqual(r['behavior'], 'patrol')

    def test_outdoor_chase_investigation_return_and_nearby_patrol_never_blink(self):
        p = self.game()
        self.outdoor_edge(p)
        rows = p.evaluate("""()=>['permanent','locked','wireless','search','return','nearby'].map(kind=>{
          patReset();const e=__travelEdge;Object.assign(PAT,{room:'out',x:e.a.x,y:e.a.y,fy:0,
            safety:0,warning:0,near:true,blinkCD:0,routeIndex:e.i});
          S.mode='in';S.room='teach5';S.tsec=860;
          if(kind==='permanent')PAT.permanent=true;
          if(kind==='locked'){PAT.locked=true;PAT.lastSeen=e.b;PAT.wirelessSignal={point:e.b,remaining:3};}
          if(kind==='wireless')PAT.wirelessSignal={point:e.b,remaining:3};
          if(kind==='search'){PAT.search=3;PAT.lastSeen=e.b;PAT.wirelessSignal={point:e.b,remaining:3};}
          if(kind==='return')PAT.behavior='return';
          if(kind==='nearby'){S.mode='out';S.room=null;S.x=e.a.x;S.y=e.a.y;S.tsec=700;}
          const x=PAT.x,y=PAT.y;PatrolWorld.tick(1/60);
          return {kind,d:Math.hypot(PAT.x-x,PAT.y-y),after:PAT.afterBlink};})""")
        for r in rows:
            self.assertLessEqual(r['d'], 31 / 60 + 1e-7, r)
            self.assertLess(r['after'], .22, r)

    def test_outdoor_blink_landing_keeps_clear_of_player(self):
        p = self.game()
        self.outdoor_edge(p)
        r = p.evaluate("""()=>{const e=__travelEdge;
          function start(){patReset();Object.assign(PAT,{room:'out',x:e.a.x,y:e.a.y,fy:0,routeIndex:e.i,safety:0,blinkCD:0});}
          start();PatrolWorld.tick(1/60);const landing={x:PAT.x,y:PAT.y};
          S.mode='out';S.room=null;S.x=landing.x;S.y=landing.y;S.tsec=700;
          start();PatrolWorld.tick(1/60);return {moved:Math.hypot(PAT.x-e.a.x,PAT.y-e.a.y),
            distance:Math.hypot(PAT.x-S.x,PAT.y-S.y),after:PAT.afterBlink};}""")
        self.assertTrue(r['moved'] <= 16 / 60 + 1e-7 or r['distance'] > 260, r)

    def test_save_mid_walk_resumes_without_snap_or_old_blink_pause(self):
        p = self.game()
        r = p.evaluate("""()=>{const a=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',20,17)),b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',40,17));
          Object.assign(PAT,{room:a.scene,x:a.x,y:a.y,fy:0,safety:0,warning:0,near:true,blinkCD:1.05,
            wirelessSignal:{point:b,remaining:3,locker:null}});
          PatrolWorld.tick(.137);const before={x:PAT.x,y:PAT.y};saveGame();const old=loadGame();old.mods.mechanics.rulesVersion=3;applySave(old);
          const exact=PAT.x===before.x&&PAT.y===before.y&&Mechanics.rulesVersion===5;PatrolWorld.tick(1/60);
          return {exact,d:Math.hypot(PAT.x-before.x,PAT.y-before.y)};}""")
        self.assertTrue(r['exact'])
        self.assertAlmostEqual(r['d'], 16 / 60, places=6)

    def test_new_speedrun_rules_preserve_legacy_records_without_using_old_best(self):
        p = self.game()
        self.assert_js(p, """(()=>{const old={version:1,recent:[{runId:'old',rules:2,ms:60000,status:'finished'}],best:{}};
          old.best[Speedrun.key(2,'hard','car')]={ms:60000,runId:'old'};localStorage.setItem(SPEEDRUN_KEY,JSON.stringify(old));
          const isolated=SPEEDRUN_RULES===4&&Speedrun.best('hard','car')===null;
          Speedrun.save({id:'new',rules:SPEEDRUN_RULES,diff:'hard',route:'car',ms:90000,status:'finished',game:SPEEDRUN_GAME});
          const d=Speedrun.read();return isolated&&Speedrun.best('hard','car')===90000&&d.recent.length===2&&
            d.best[Speedrun.key(2,'hard','car')].ms===60000;})()""")
