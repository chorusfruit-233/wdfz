"""新巡察权威、特殊空间、导航、单实体与信息边界。"""
from browser_case import BrowserCase
class PatrolWorldTest(BrowserCase):
    def game(self):
        p=self.page();p.evaluate("""freshState('hard');running=false;S.intro=0;PRO.on=false;AN.active=false;AN.next=1e6;
          S.talent='none';S.day=1;S.tsec=860;doEnterRoom('teach1',PatrolNav.tilePoint('teach1',30,18));S.seated=false;
          PAT.safety=0;PAT.warning=0;PAT.near=true;""");return p
    def test_graph_is_connected_and_route_covers_every_selected_edge(self):
        p=self.game()
        result=p.evaluate("""() => {const g=PatrolNav.graph(),r=PATROL_ROUTE.nodes,walked=new Set();
          for(let i=1;i<r.length;i++)walked.add([r[i-1],r[i]].sort().join('|'));
          return {closed:r[0]===r.at(-1),missing:g.patrolEdges.filter(i=>!walked.has([g.edges[i].a,g.edges[i].b].sort().join('|'))),
            rooms:[...new Set(Object.values(g.nodes).map(p=>p.scene))]};}""")
        self.assertTrue(result['closed']);self.assertEqual(result['missing'],[])
        for room in ['teach6','garage1','trash1','bell1','portal_tunnel','dorm6','link1','link2']:
            self.assertIn(room,result['rooms'])
    def test_static_navigation_survives_cleared_renderer_caches(self):
        p=self.game()
        self.assert_js(p,"""(() => {let a=PatrolNav.entry('lab3','S'),b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,12));
          let path=PatrolNav.path(a,b),saved=JSON.stringify(path);delete INTERIORS.lab3.foot;delete INTERIORS.lab3.stairExtra;delete INTERIORS.lab3.propExtra;
          return path.length>0&&JSON.stringify(PatrolNav.path(a,b))===saved;})()""")
    def test_locked_door_is_registered_and_counts_distance_without_opening_it(self):
        p=self.game()
        self.assert_js(p,"""(() => {let a=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,17)),b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,12));
          OPENDOORS={};let path=PatrolNav.path(a,b);return path&&path.some(PatrolNav.doorAt)&&PatrolNav.length(path)>40&&!PatrolNav.los(a,b)&&Object.keys(OPENDOORS).length===0;})()""")
    def test_two_maze_exits_and_bell_spiral_are_reachable_on_walk_surfaces(self):
        p=self.game()
        r=p.evaluate("""() => {const origin=VoidMaze.toWorld(0,0),a=PatrolNav.point('lift_dream',origin.x,origin.y,0);
          const exits=MAZE_CFG.exits.map(e=>{const w=VoidMaze.toWorld(e.x,e.z),path=PatrolNav.path(a,PatrolNav.point('lift_dream',w.x,w.y,e.h));
            return {exists:!!path,valid:!!path&&path.every(p=>{let q=VoidMaze.toScene(p.x,p.y);return VoidMaze.depthAt(q.x,q.z,.30,p.fy)<1e-7&&Number.isFinite(VoidMaze.groundAt(q.x,q.z,p.fy+.01));})};});
          const R=INTERIORS.bell1,C=SPIRAL,end=PatrolNav.point('bell1',R.cx+Math.cos(C.th0+1)*1.65/U2M,R.cy+(C.cz+Math.sin(C.th0+1)*1.65)/U2M,C.topH);
          const b=PatrolNav.path(PatrolNav.entry('bell1','O'),end);return {exits,bell:!!b&&b.some(p=>p.fy>3)&&b.at(-1).fy===C.topH};}""")
        self.assertEqual(r['exits'],[dict(exists=True,valid=True)]*2);self.assertTrue(r['bell'])
    def test_unseen_motion_does_not_update_last_seen_and_back_turn_does_not_end_chase(self):
        p=self.game()
        self.assert_js(p,"""(() => {PAT.room=S.room;PAT.x=S.x+80;PAT.y=S.y;PAT.locked=true;PAT.lastSeen=PatrolNav.point(S.room,S.x,S.y);PAT.safety=0;PAT.near=true;
          PAT.blinkCD=0;let oldX=PAT.x;S.ang=Math.PI;S.moving=false;PatrolWorld.tick(.8);let moved=PAT.x<oldX&&PAT.state==='walk';
          let R=INTERIORS.teach1;S.x=R.ox+5.5*9;S.y=R.oy+4.5*9;let last=JSON.stringify(PAT.lastSeen);PatrolWorld.tick(.2);
          return moved&&JSON.stringify(PAT.lastSeen)===last;})()""")
    def test_permanent_investigation_does_not_use_remote_pressure_or_consume_seal(self):
        p=self.game()
        self.assert_js(p,"""(() => {addItem('seal');PAT.permanent=true;PAT.locked=true;let before=S.san;PatrolWorld.tick(1);Mechanics.finish(.1);
          return hasItem('seal')&&S.san===before&&PAT.permanent&&PAT.state==='walk';})()""")
    def test_saved_mid_connector_and_non_grid_position_are_restored_exactly(self):
        p=self.game()
        r=p.evaluate("""() => {let g=PatrolNav.graph(),a=g.nodes['admin1:stairs'],b=g.nodes['admin2:stairs'];PAT.room=a.scene;PAT.x=a.x+.07;PAT.y=a.y+.03;
          PAT.routeIndex=0;PAT.transition={from:a,to:b,kind:'stairs',remaining:1.125,total:2};saveGame();let before=structuredClone(PAT);applySave(loadGame());
          return {before,after:structuredClone(PAT)};}""")
        for k in ['x','y','room','transition','permanent','routeIndex']:self.assertEqual(r['before'][k],r['after'][k])
    def test_plain_stair_transition_takes_two_active_seconds(self):
        p=self.game()
        self.assert_js(p,"""(() => {let g=PatrolNav.graph(),a=g.nodes['admin1:stairs'],b=g.nodes['admin2:stairs'];PAT.room=a.scene;PAT.x=a.x;PAT.y=a.y;
          PAT.transition={from:a,to:b,kind:'stairs',remaining:2,total:2};PatrolWorld.tick(1.9);let first=PAT.room==='admin1'&&PAT.transition.remaining>0;
          PatrolWorld.tick(.1);return first&&PAT.room==='admin2'&&!PAT.transition&&PAT.afterBlink>0;})()""")
    def test_corrupt_new_domains_repair_without_erasing_inactive_mods(self):
        p=self.game()
        self.assert_js(p,"""(() => {addItem('phone');saveGame();let d=loadGame();d.mods['mod:sleeping']={keep:42};d.mods.phoneDevice.battery='bad';d.mods.terminalPuzzle.work={'/etc/passwd':'fake'};
          d.mods.termination={status:'accepted',requestId:'corrupt',remaining:0};applySave(d);saveGame();let saved=loadGame();
          return PhoneNetwork.device.battery===0&&!PhoneNetwork.device.network&&Termination.state.status==='idle'&&Object.keys(TerminalUI.puzzle.work).length===0&&saved.mods['mod:sleeping'].keep===42;})()""")
        self.assert_js(p,"""(()=>{for(const room of ['missing-room','lift_lab','lift_dream','bell1']){
          let d=loadGame();Object.assign(d.mods.patrolWorld,{room,x:1e8,y:1e8,fy:999,transition:null,permanent:true});applySave(d);
          if(PAT.room!=='admin1'||!PAT.permanent||PAT.safety!==3.6)return false;
        }return true;})()""")
    def test_debug_invulnerability_is_not_a_rescue(self):
        p=self.game()
        self.assert_js(p,"""(() => {PAT.permanent=true;DEV.god=true;kill('x','grip','patrol');DEV.god=false;return PAT.permanent&&!S.dead;})()""")
    def test_adjacent_stairs_warn_from_the_entrance_without_remote_damage(self):
        p=self.game()
        self.assert_js(p,"""(()=>{let g=PatrolNav.graph(),a=g.nodes['admin1:stairs'],b=g.nodes['admin2:stairs'];
          doEnterRoom('admin2',b);PAT.room=a.scene;PAT.x=a.x;PAT.y=a.y;PAT.safety=0;PAT.near=false;PAT.permanent=true;
          PatrolWorld.tick(.1);return PAT.warning>3&&!PatrolWorld.localThreat()&&PatrolWorld.pressure()===0;})()""")
    def test_permanent_local_lock_can_reset_without_clearing_tracking_or_bypassing_seal(self):
        p=self.game()
        self.assert_js(p,"""(()=>{PAT.permanent=true;PAT.locked=true;PatrolWorld.tick(2.6);let lost=!PAT.locked&&PAT.permanent;
          let q=PatrolNav.tilePoint('teach1',30,18);doEnterRoom('teach1',q);PAT.room=S.room;PAT.x=S.x+50;PAT.y=S.y;PAT.transition=null;
          PAT.near=true;PAT.warning=0;PAT.safety=0;PAT.blinkCD=100;addItem('seal');PatrolWorld.tick(1.1);
          return lost&&PAT.state==='idle'&&PAT.permanent&&!hasItem('seal')&&PAT.respawn>29;})()""")
    def test_observed_exit_remembers_connector_and_ignores_unseen_motion(self):
        p=self.game()
        self.assert_js(p,"""(()=>{let g=PatrolNav.graph(),a=g.nodes['teach1:stairs'];S.x=a.x;S.y=a.y;PAT.room=S.room;PAT.x=S.x+25;PAT.y=S.y;
          PAT.locked=true;PAT.lastSeen=PatrolNav.point(S.room,S.x,S.y);let seen=PatrolWorld.sees();
          GameModules.emit('leaveRoom','teach1','teach2');let target=PAT.lastSeen;
          doEnterRoom('teach2',PatrolNav.tilePoint('teach2',42,18));PatrolWorld.tick(.1);
          return seen&&target.scene==='teach2'&&target.x===g.nodes['teach2:stairs'].x&&JSON.stringify(PAT.lastSeen)===JSON.stringify(target);})()""")

    def test_inspection_and_calm_hold_only_the_local_permanent_entity(self):
        p=self.game()
        self.assert_js(p,"""(()=>{PAT.permanent=true;PAT.room=S.room;PAT.x=S.x+80;PAT.y=S.y;PAT.warning=0;PAT.safety=0;PAT.near=true;
          Inspection.start({day:1,slot:0});let x=PAT.x,y=PAT.y,c=RT.inspection.current;PatrolWorld.tick(8);
          let held=PAT.x===x&&PAT.y===y&&!PAT.locked&&PAT.permanent;
          Inspection.finish(c);for(let i=0;i<70;i++){Inspection.tick(.1);PatrolWorld.tick(.1);}
          let calm=PAT.x===x&&PAT.y===y&&!PAT.locked&&PAT.permanent;
          // 缓冲结束后还须等既有 1.1 秒瞬移冷却，不能在仅 1 秒时断言已迈步。
          for(let i=0;i<25;i++){Inspection.tick(.1);PatrolWorld.tick(.1);}
          return held&&calm&&PAT.permanent&&(PAT.x!==x||PAT.y!==y);})()""")
