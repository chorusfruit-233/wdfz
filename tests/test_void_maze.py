"""虚空迷宫（错误的电梯通往的空间）：布局连通、两个出口、楼梯改变高度、坠入虚空、SAN 流失、地图与时间、读档。

内部测试；玩家 Wiki 不写这个空间的细节。"""
from browser_case import BrowserCase

WALK = """
window.walk=function(pts){
  for(var k=0;k<pts.length;k++){
    var t=pts[k], guard=0;
    while(guard++<5000){
      var p=VoidMaze.toScene(S.x,S.y), dx=t[0]-p.x, dz=t[1]-p.z;
      if(Math.hypot(dx,dz)<0.15) break;
      S.ang=Math.atan2(dz,dx); KEY.w=true; update(1/60); KEY.w=false;
      if(S.room!==MAZE_CFG.room||S.dead) return {ok:false,at:k,room:S.room};
    }
    if(guard>=5000) return {ok:false,at:k,stuck:true};
  }
  KEY.w=false; var q=VoidMaze.toScene(S.x,S.y);
  return {ok:true,x:q.x,z:q.z,fy:S.floorY};
};
window.goMaze=function(host,floor){
  floor=floor||1; doEnterRoom(host+floor,Elevator.landing(host,floor));
  var r=Math.random; Math.random=function(){return 0;}; Elevator.board(host,floor); Math.random=r;
  Elevator.enterDream('67');
  var w=VoidMaze.toWorld(0,0); S.x=w.x; S.y=w.y; S.floorY=0; VoidMaze.MZ.air=false; VoidMaze.MZ.t=0;
};
0;
"""


class VoidMazeTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("""Game.start('hard');""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("""running=false;clearIntroTimers();S.intro=0;S.day=1;S.tsec=760;S.san=100;AN.active=false;AN.id=null;
          AN.next=1e5;patReset();PAT.next=1e5;RT.inspection=null;DEV.god=false;""" + WALK)
        return page

    def test_wrong_elevator_leads_into_the_dark_maze(self):
        page = self.game()
        page.evaluate("""doEnterRoom('lab3',Elevator.landing('lab',3));S.san=80;
          Math.random=()=>0;Elevator.board('lab',3);Elevator.controls();""")
        page.locator('#choices button').filter(has_text='67 层').click()
        result = page.evaluate("""()=>{const R=INTERIORS.lift_dream, p=VoidMaze.toScene(S.x,S.y), sp=MAZE_CFG.spawn; updateHUD();
          return {room:S.room, san:S.san, phase:RT.elevatorRide.phase, fy:S.floorY,
            inSpawn:p.x>=sp.x0&&p.x<=sp.x1&&p.z>=sp.z0&&p.z<=sp.z1, free:Collision.depth(S.x,S.y,PRAD)<1e-7,
            clock:document.getElementById('clock').textContent, period:document.getElementById('period').textContent,
            flags:[R.noMap,R.noClock,R.ownHeight,typeof R.build], fog:lightState().fog, mesh:GLR.roomMesh.userData.voidMaze,
            sub:document.getElementById('sub').innerText}}""")
        self.assertEqual(result['room'], 'lift_dream')
        self.assertEqual(result['san'], 75)
        self.assertEqual(result['phase'], 'dream')
        self.assertTrue(result['inSpawn'] and result['free'])
        self.assertEqual(result['fy'], 0)
        self.assertEqual(result['clock'], '???')
        self.assertEqual(result['period'], '???')
        self.assertEqual(result['flags'], [True, True, True, 'function'])
        self.assertLess(result['fog']['density'], 0.2)
        self.assertEqual(result['mesh'], 1)
        self.assertIn('方方正正的白色墙面', result['sub'])
        # 地图打不开、手表只转圈；游戏钟不走但能走动
        result = page.evaluate("""()=>{UI.open('mapv');const map=UI.openPanel;S.bag.push('watch');useItem('watch');
          const before=S.tsec,x=S.x,y=S.y;KEY.w=true;update(1);KEY.w=false;
          return {map, sub:document.getElementById('sub').innerText, before, after:S.tsec, moved:Math.hypot(S.x-x,S.y-y)>1}}""")
        self.assertIsNone(result['map'])
        self.assertIn('指针一圈一圈地转', result['sub'])
        self.assertEqual(result['before'], result['after'])
        self.assertTrue(result['moved'])

    def test_both_exits_are_reachable_only_by_stairs_and_lead_to_their_floors(self):
        page = self.game()
        # 出口 2：主桥 → 平台 A → 楼梯上 4 米 → 平台 B → 北桥（断口要绕）→ 北走廊
        r = page.evaluate("""()=>{goMaze('teach',2);
          const w=walk([[0,-4],[0,-12],[0,-27],[0,-30],[3.2,-30],[8.6,-30],[10.5,-30],[10.5,-32],[3,-32],[3,-26],[-3,-26],[-3,-32],[-7,-32],[-7,-35],[-7,-37.4]]);
          const hint=interactHint(); tryInteract(); return {w, hint, room:S.room, ride:RT.elevatorRide, lift:Elevator.state('teach').phase}}""")
        self.assertTrue(r['w']['ok'], r['w'])
        self.assertEqual(r['w']['fy'], 4)
        self.assertEqual(r['hint'], '推开门（出口 2）')
        self.assertEqual(r['room'], 'lab2')                       # 出口 2：另一栋楼、同一层
        self.assertIsNone(r['ride'])
        self.assertEqual(r['lift'], 'idle')                       # 原来那台电梯不会一直被占着
        # 出口 1：南厅 → 西阶梯塔往下绕一圈到 −8 米 → 长走廊（中间矮墙要绕）
        r = page.evaluate("""()=>{goMaze('lab',4);
          const w=walk([[0,4],[0,13],[-5,13],[-9,13],[-15,13],[-15,23],[-9,23],[-9,13.2],[-7,13],[-3,13],[-3,25],[-6,25.5],[-6,27.5],[-3,28],[-3,37.4]]);
          const hint=interactHint(); tryInteract(); return {w, hint, room:S.room, free:Collision.depth(S.x,S.y,PRAD)<1e-7}}""")
        self.assertTrue(r['w']['ok'], r['w'])
        self.assertEqual(r['w']['fy'], -8)
        self.assertEqual(r['hint'], '推开门（出口 1）')
        self.assertEqual(r['room'], 'lab4')                       # 出口 1：回到上电梯的那一层
        self.assertTrue(r['free'])

    def test_stairs_tower_climbs_to_a_dead_end_and_walls_block(self):
        page = self.game()
        r = page.evaluate("""()=>{goMaze('teach');
          const a=walk([[0,1],[11,1],[13,1],[19,1]]), h1=S.floorY;
          const b=walk([[19,-9]]), h2=S.floorY;
          const c=walk([[13,-9],[13,1]]), top=S.floorY, hint=interactHint();
          return {a,b,c,h1,h2,top,hint}}""")
        self.assertTrue(r['a']['ok'] and r['b']['ok'] and r['c']['ok'], r)
        self.assertEqual([r['h1'], r['h2'], r['top']], [1.5, 4, 8])
        self.assertEqual(r['hint'], '')                           # 塔顶没有出口
        # 没有楼梯就上不去：在 0 米高的出生区域对着墙走，被挡住，高度不变
        r = page.evaluate("""()=>{goMaze('teach');const w=VoidMaze.toWorld(3,4.2);S.x=w.x;S.y=w.y;S.floorY=0;
          S.ang=Math.PI/2;const y=S.y;KEY.w=true;for(let i=0;i<120;i++)update(1/60);KEY.w=false;
          return {dz:(S.y-y)/9, fy:S.floorY, free:Collision.depth(S.x,S.y,PRAD)<1e-7}}""")
        self.assertLess(r['dz'], 0.5)
        self.assertEqual(r['fy'], 0)
        self.assertTrue(r['free'])

    def test_falling_into_the_void_costs_a_little_san_and_respawns_in_the_spawn_area(self):
        page = self.game()
        page.evaluate("""goMaze('teach');S.san=60;walk([[0,-15]]);
          window.__san=S.san;const w=VoidMaze.toWorld(-1.4,-15);S.x=w.x;S.y=w.y;S.ang=Math.PI;
          for(let i=0;i<200&&!VoidMaze.MZ.respawning;i++){KEY.w=true;update(1/60);}KEY.w=false;""")
        self.assert_js(page, 'VoidMaze.MZ.respawning&&S.floorY<MAZE_CFG.voidY')
        # The fixture stops the render loop; the transition completes on its own timer.
        # Poll that state independently of headless WebGL animation-frame scheduling.
        page.wait_for_function('!VoidMaze.MZ.respawning', timeout=5000, polling=50)
        r = page.evaluate("""()=>{const p=VoidMaze.toScene(S.x,S.y), sp=MAZE_CFG.spawn;
          return {lost:window.__san-S.san, falls:VoidMaze.MZ.falls, fy:S.floorY, air:VoidMaze.MZ.air, dead:S.dead,
            inSpawn:p.x>=sp.x0&&p.x<=sp.x1&&p.z>=sp.z0&&p.z<=sp.z1, ground:VoidMaze.groundAt(p.x,p.z,0.4),
            free:Collision.depth(S.x,S.y,PRAD)<1e-7, sub:document.getElementById('sub').innerText}}""")
        self.assertGreaterEqual(r['lost'], 3)
        self.assertLess(r['lost'], 3.5)
        self.assertEqual(r['falls'], 1)
        self.assertFalse(r['dead'] or r['air'])
        self.assertTrue(r['inSpawn'] and r['free'])
        self.assertEqual([r['fy'], r['ground']], [0, 0])
        self.assertIn('一开始的地方', r['sub'])
        # 从上层桥掉下去落在下层桥上：不算掉进虚空
        r = page.evaluate("""()=>{const w=VoidMaze.toWorld(0,-19.5);S.x=w.x;S.y=w.y;S.floorY=4;VoidMaze.MZ.air=true;VoidMaze.MZ.vy=0;
          for(let i=0;i<120;i++)update(1/60);return {fy:S.floorY,air:VoidMaze.MZ.air,falls:VoidMaze.MZ.falls}}""")
        self.assertEqual(r, {'fy': 0, 'air': False, 'falls': 1})

    def test_san_drains_faster_the_longer_you_stay_and_runs_out_in_about_twenty_minutes(self):
        page = self.game()
        r = page.evaluate("""()=>{goMaze('teach');S.san=100;let t=0,at={};
          while(!S.dead&&t<1800){update(0.5);t+=0.5;if(t===300)at[300]=S.san;if(t===600)at[600]=S.san;if(t===900)at[900]=S.san;}
          return {at,t,dead:S.dead,early:VoidMaze.drainRate(60),late:VoidMaze.drainRate(900),
            saved:!!Talent.state().consumed.fatalProtection}}""")
        self.assertTrue(r['dead'])
        self.assertGreaterEqual(r['t'], 1140)
        # 新局随机抽天赋：抽到「天生免疫」时，第一次耗尽（约 1200 秒）被挡下、SAN 回升，要 1400 多秒才死——这是成立的，放行
        self.assertLessEqual(r['t'], 1700 if r['saved'] else 1260)
        loss = [100 - r['at']['300'], r['at']['300'] - r['at']['600'], r['at']['600'] - r['at']['900']]
        self.assertTrue(loss[0] < loss[1] < loss[2], loss)       # 越久掉得越快
        self.assertGreater(r['late'], r['early'] * 4)

    def test_save_and_load_keep_height_and_time_inside(self):
        page = self.game()
        r = page.evaluate("""()=>{goMaze('teach');walk([[0,1],[11,1],[13,1],[19,1],[19,-9]]);
          VoidMaze.MZ.t=400;const p=VoidMaze.toScene(S.x,S.y);saveGame();const d=loadGame();
          freshState('hard');running=false;applySave(d);
          const before={fy:S.floorY,ready:VoidMaze.MZ.ready};
          for(let i=0;i<30;i++)update(1/60);                       // 淡入之前世界照走：高度还没恢复，不能先掉下去
          const waiting={fy:S.floorY,air:VoidMaze.MZ.air};
          window.__back=0;enterRoom(S.room,{x:S.x,y:S.y,ang:S.ang,restoreVisit:true},function(){window.__back=1;});
          return {saved:d.mods['void-maze'], p, before, waiting}}""")
        self.assertEqual(r['saved']['fy'], 4)
        self.assertEqual(r['before']['ready'], False)
        self.assertEqual(r['waiting'], {'fy': 0, 'air': False})
        page.wait_for_function("window.__back===1")
        r2 = page.evaluate("""()=>{const p=VoidMaze.toScene(S.x,S.y);
          return {fy:S.floorY, t:VoidMaze.MZ.t, x:p.x, z:p.z, free:Collision.depth(S.x,S.y,PRAD)<1e-7, phase:RT.elevatorRide&&RT.elevatorRide.phase}}""")
        self.assertEqual(r2['fy'], 4)
        self.assertEqual(r2['t'], 400)
        self.assertAlmostEqual(r2['x'], r['p']['x'], places=3)
        self.assertTrue(r2['free'])
        self.assertEqual(r2['phase'], 'dream')
        # 存档里的高度站不住（例如悬在虚空上方）：回到出生区域
        r3 = page.evaluate("""()=>{const w=VoidMaze.toWorld(6,-18);S.x=w.x;S.y=w.y;S.floorY=0;saveGame();const d=loadGame();
          freshState('hard');running=false;applySave(d);doEnterRoom('lift_dream',{x:S.x,y:S.y,ang:0,restoreVisit:true});
          const p=VoidMaze.toScene(S.x,S.y),sp=MAZE_CFG.spawn;return p.x>=sp.x0&&p.x<=sp.x1&&p.z>=sp.z0&&p.z<=sp.z1&&S.floorY===0}""")
        self.assertTrue(r3)

    def test_chalk_lies_in_the_spawn_area_and_old_marks_are_drawn(self):
        page = self.game()
        r = page.evaluate("""()=>{goMaze('teach');S.bag=S.bag.filter(i=>i!=='chalk');
          const w=VoidMaze.toWorld(MAZE_CFG.chalk.x+0.6,MAZE_CFG.chalk.z);S.x=w.x;S.y=w.y;S.floorY=0;
          const hint=interactHint();tryInteract();
          return {hint, has:hasItem('chalk'), marks:ChalkFx.count(), preset:ChalkMarks.visible('lift_dream').filter(m=>m.old).length}}""")
        self.assertEqual(r['hint'], '捡起粉笔')
        self.assertTrue(r['has'])
        self.assertEqual(r['preset'], 11)
        self.assertEqual(r['marks'], 11)

    def test_layout_tables_are_consistent(self):
        page = self.game()
        r = page.evaluate("""()=>{const C=MAZE_CFG, bad=[];
          const inside=b=>b[0]>C.x0&&b[1]<C.x0+C.cols&&b[4]>C.z0&&b[5]<C.z0+C.rows&&b[2]>=C.y0&&b[3]<C.y0+C.ny;
          MAZE_AIR.concat(MAZE_SOLID).forEach(a=>{if(!(a.b[0]<a.b[1]&&a.b[2]<a.b[3]&&a.b[4]<a.b[5])||!inside(a.b))bad.push(a.id);});
          MAZE_WALK.forEach(w=>{const ok=w.x0<w.x1&&w.z0<w.z1&&(w.t==='plat'?Number.isFinite(w.h):w.a0!==w.a1);if(!ok)bad.push(w.id);
            const steep=w.t==='ramp'?Math.abs(w.h1-w.h0)/Math.abs(w.a1-w.a0):0; if(steep>0.7)bad.push(w.id+':steep');});
          const sp=C.spawn, exits=C.exits.map(e=>[e.id,VoidMaze.groundAt(e.x,e.z,e.h+0.4)===e.h]);
          return {bad, exits, spawnFloor:VoidMaze.groundAt((sp.x0+sp.x1)/2,(sp.z0+sp.z1)/2,0.4)}}""")
        self.assertEqual(r['bad'], [])
        self.assertEqual(r['exits'], [['exit1', True], ['exit2', True]])
        self.assertEqual(r['spawnFloor'], 0)

    def test_new_structures_pillar_hall_catwalk_and_loop_are_walkable(self):
        """第三轮新结构：柱林（南厅往东）、窄梁（4 米走廊往北，没有栏杆）、回环（出口走廊中间往西，绕一圈回原地）。"""
        page = self.game()
        r = page.evaluate("""()=>{goMaze('teach');
          const ph=walk([[0,4],[0,13],[4.5,13],[4.5,16],[9,15.5],[12,15],[12,27],[15,27],[15,33]]), phH=S.floorY;
          goMaze('teach');
          const cw=walk([[0,1],[11,1],[13,1],[19,1],[19,-9],[19,-11],[19,-24],[17,-24],[17,-26],[16.5,-27.5],[16.5,-35.6],[19,-36.5]]), cwH=S.floorY;
          goMaze('teach');
          const lp=walk([[0,4],[0,13],[-5,13],[-9,13],[-15,13],[-15,23],[-9,23],[-9,13.2],[-7,13],[-3,13],[-3,25],[-6,25.5],[-6,28],[-10,28],
            [-20,28],[-20,36],[-10,36],[-10,28]]), lpH=S.floorY;
          const core=VoidMaze.depthAt(-15,32,0,-8)>0;
          return {ph,phH,cw,cwH,lp,lpH,core,pillars:MAZE_SOLID.filter(s=>s.id.indexOf('PHcols')===0).length};}""")
        self.assertTrue(r['ph']['ok'], r['ph'])
        self.assertEqual(r['phH'], 0)
        self.assertEqual(r['pillars'], 28)
        self.assertTrue(r['cw']['ok'], r['cw'])
        self.assertEqual(r['cwH'], 4)                                   # 走过窄梁到了对面平台
        self.assertTrue(r['lp']['ok'], r['lp'])
        self.assertEqual(r['lpH'], -8)
        self.assertTrue(r['core'])                                      # 回环中间是实心的
        # 窄梁两侧就是虚空：往旁边一步就掉下去
        r = page.evaluate("""()=>{goMaze('teach');const w=VoidMaze.toWorld(16.5,-31);S.x=w.x;S.y=w.y;S.floorY=4;VoidMaze.MZ.air=false;VoidMaze.MZ.ready=true;
          S.ang=0;KEY.w=true;for(let i=0;i<40;i++)update(1/60);KEY.w=false;return {air:VoidMaze.MZ.air,fy:S.floorY};}""")
        self.assertTrue(r['air'])
        self.assertLess(r['fy'], 4)


    def test_dying_in_the_maze_plays_its_own_cinematics_and_records_its_own_cause(self):
        """死在迷宫里不再用校园里那一圈黑影：理智耗尽是「迷失」（void），掉进虚空死掉是「坠落」（abyss）。
        各有自己的死因（复盘提示、死亡档案）和墓志铭；演出期间迷宫本身和地上的粉笔都藏起来，清场后还原。"""
        page = self.game()
        r = page.evaluate("""()=>{localStorage.removeItem('wdfz3d_death_archive_v1');
          goMaze('teach');S.talent='code';S.bag=[];S.san=0.01;
          const chalk=()=>GLR.scene.children.find(o=>o.name==='chalk-marks');
          const before={room:GLR.roomMesh.visible,chalk:!!chalk()&&chalk().visible};
          update(0.5);
          const during={dead:S.dead,death:S.death,cg:ANFX.cg&&ANFX.cg.type,room:GLR.roomMesh.visible,chalk:chalk().visible,
            hold:DeathTimeline.duration(S.death),epi:DFX_EPI[S.death],hint:!!DEATH_SOURCES.void_lost.hint,
            arc:Object.keys(DeathArchive.state().unlocked)};
          anfxClear();
          return {before,during,after:{room:GLR.roomMesh.visible,chalk:chalk().visible}};}""")
        self.assertEqual(r['before'], {'room': True, 'chalk': True})
        self.assertEqual(r['during']['death'], 'void')
        self.assertEqual(r['during']['cg'], 'void')
        self.assertTrue(r['during']['dead'])
        self.assertFalse(r['during']['room'] or r['during']['chalk'])
        self.assertGreaterEqual(r['during']['hold'], 3.5)
        self.assertEqual(r['during']['epi'], '你从那扇门前走过了很多次。')
        self.assertTrue(r['during']['hint'])
        self.assertEqual(r['during']['arc'], ['void_lost'])               # 不再记成校园里的「那根弦」（san）
        self.assertEqual(r['after'], {'room': True, 'chalk': True})
        # 理智只剩一点的时候掉进虚空：坠落
        page = self.game()
        r = page.evaluate("""()=>{localStorage.removeItem('wdfz3d_death_archive_v1');
          goMaze('teach');S.talent='code';S.bag=[];S.san=2;walk([[0,-15]]);
          const w=VoidMaze.toWorld(-1.4,-15);S.x=w.x;S.y=w.y;S.ang=Math.PI;
          for(let i=0;i<300&&!S.dead;i++){KEY.w=true;update(1/60);}KEY.w=false;
          const out={dead:S.dead,death:S.death,cg:ANFX.cg&&ANFX.cg.type,epi:DFX_EPI[S.death],arc:Object.keys(DeathArchive.state().unlocked),
            hidden:!GLR.roomMesh.visible};
          anfxClear();return out;}""")
        self.assertEqual(r, {'dead': True, 'death': 'abyss', 'cg': 'abyss', 'epi': '下面站着的，是刚进来的你。',
                             'arc': ['void_fall'], 'hidden': True})

    def test_the_two_storyboards_move_through_their_beats(self):
        """分镜按时间走：迷失——前面那扇门先暗、再合成一道缝，转身以后两边的门一扇扇裂开亮起，最后一格格暗下去；
        坠落——画着箭头的方块三次从面前掠过，下面那块方地越来越近，手电最后照到镜头。"""
        page = self.game()
        r = page.evaluate("""()=>{doEnterRoom('teach1');S.ang=0.3;S.pitch=0;syncCamera(0);
          function at(id,k,fn){deathFX(id,{preview:true});anfxUpdate(k);const v=fn(ANFX.cg);anfxClear();return v;}
          const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
          function sc(im,i){im.getMatrixAt(i,m);return +s.setFromMatrixColumn(m,0).length().toFixed(2);}   /* r187 的 decompose 遇到缩放 0 返回 1，直接量第一列 */
          const door=k=>at('void',k,c=>({front:sc(c.doors[2],0),frontLit:sc(c.doors[1],0)>0,
            side:[2,3,4,5,6,7].map(i=>sc(c.doors[2],i)),lit:[1,2,3,4,5,6,7].filter(i=>sc(c.doors[1],i)>0).length}));
          const fall=k=>at('abyss',k,c=>{const cam=GLR.cam.position.clone(),b=new THREE.Vector3();c.beam.getWorldPosition(b);
            const dir=new THREE.Vector3(0,0,1).applyQuaternion(c.beam.getWorldQuaternion(new THREE.Quaternion()));
            return {mark:c.mark.visible,below:+(cam.y-c.pad.getWorldPosition(new THREE.Vector3()).y).toFixed(1),
              aim:+dir.dot(cam.sub(b).normalize()).toFixed(2)};});
          return {v:[0.3,1.0,1.6,2.1,2.9,3.3].map(door),a:[0.4,0.8,1.1,1.55,2.3,2.6,2.98].map(fall)};}""")
        v, a = r['v'], r['a']
        self.assertEqual(v[0]['front'], 1)
        self.assertTrue(v[0]['frontLit'])                               # 一开始：前面那扇门的门缝亮着
        self.assertFalse(v[1]['frontLit'])                              # 1.0 秒：灭了
        self.assertEqual(v[2]['front'], 0)                              # 1.6 秒：合成一道缝，没了
        self.assertEqual(v[0]['side'], [0] * 6)                         # 两边的门一开始都不在
        self.assertEqual(v[3]['side'], [1] * 6)                         # 2.1 秒：全部裂开了，门缝都亮着
        self.assertEqual(v[3]['lit'], 7)
        self.assertLess(v[4]['lit'], 3)                                 # 一格格暗下去
        self.assertEqual(v[5]['lit'], 0)
        self.assertEqual([x['mark'] for x in a], [False, False, True, True, True, False, False])   # 三次：1.1、1.55、2.45 秒前后
        below = [x['below'] for x in a]
        self.assertTrue(all(x > y for x, y in zip(below, below[1:])), below)   # 下面那块方地越来越近
        self.assertGreater(below[0], 30)
        self.assertLess(a[3]['aim'], 0.9)                               # 手电先在地上找
        self.assertGreater(a[-1]['aim'], 0.99)                          # 最后照到脸上

    def test_secret_archive_entries_appear_only_after_dying_here_and_replay_in_the_maze(self):
        """迷宫里两种死法的死亡档案标了 secret：没死过不出现、不算进总数；死过以后单独记一个「隐藏」数，可以重看（回放舞台就是迷宫）。"""
        page = self.page()
        page.evaluate("""localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({version:1,unlocked:{'an:cup':true},first:{'an:cup':1},count:{'an:cup':1},migrated:1}));
          S.screen='menu';document.getElementById('menu').style.display='block';running=true""")
        page.locator('#btnarchive').click()
        public = page.evaluate("DEATH_ARCHIVE.filter(e=>!e.secret).length")
        state = "()=>({cards:[...document.querySelectorAll('#arcards .arcard')].map(c=>c.dataset.id),head:document.getElementById('arCount').textContent,html:document.getElementById('archive').innerHTML})"
        r = page.evaluate(state)
        self.assertEqual(len(r['cards']), public)
        self.assertEqual(r['head'], f'已记录 1 / {public}')
        self.assertNotIn('void_lost', r['cards'])
        self.assertNotIn('哪一扇门', r['html'])
        page.evaluate("DeathArchive.record('void_lost','void');DeathArchive.paint()")
        r = page.evaluate(state)
        self.assertEqual(len(r['cards']), public + 1)
        self.assertEqual(r['head'], f'已记录 1 / {public} · 隐藏 1')
        self.assertIn('哪一扇门', r['html'])
        self.assertNotIn('void_fall', r['cards'])
        page.locator('#arcards .arcard[data-id="void_lost"] button').click()
        page.wait_for_function("ArchiveReplay.on&&ANFX.kind==='death'&&ANFX.deathType==='void'", timeout=20000)
        self.assert_js(page, "S.room==='lift_dream'&&S.screen==='replay'&&!GLR.roomMesh.visible")
        page.wait_for_timeout(500)
        page.mouse.click(500, 350)
        page.wait_for_function("!ArchiveReplay.on")
        self.assert_js(page, "S.screen==='menu'&&ANFX.kind!=='death'&&GLR.roomMesh.visible&&!document.getElementById('archive').hidden")
