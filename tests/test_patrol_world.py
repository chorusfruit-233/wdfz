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
    def test_cross_scene_replanning_reuses_skeleton_shortest_paths(self):
        """跨场景重规划：骨架图上两节点间的最短路只算一次（以前每次重规划逐对重算，一次 8 毫秒左右、会卡一帧）。
        结果和直接调用 RouteGraph.shortest 完全相同。"""
        p=self.game()
        r=p.evaluate("""() => {const g=PatrolNav.graph(),real=RouteGraph.shortest;let calls=0;
          RouteGraph.shortest=function(){calls++;return real.apply(this,arguments);};
          try{
            const a=PatrolNav.point('admin1',g.nodes['admin1:stairs'].x,g.nodes['admin1:stairs'].y),b=PatrolNav.tilePoint('teach3',30,18);
            const first=JSON.stringify(PatrolNav.route(a,b)),c1=calls;
            const second=JSON.stringify(PatrolNav.route(a,b)),c2=calls-c1;
            const near=PatrolNav.nearestRoute(a,PATROL_ROUTE.nodes),c3=calls-c1-c2;
            const same=JSON.stringify(real(g,'admin1:stairs','teach3:stairs'))===JSON.stringify(real(g,'admin1:stairs','teach3:stairs'));
            return {first:c1>0,second:c2,same:first===second&&same,near:!!near,c3};
          }finally{RouteGraph.shortest=real;}}""")
        self.assertEqual(r['second'],0)
        self.assertTrue(r['first'] and r['same'] and r['near'],r)
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
          let R=INTERIORS.teach1;S.x=R.ox+10.5*9;S.y=R.oy+9.5*9;let last=JSON.stringify(PAT.lastSeen);PatrolWorld.tick(.2);
          return moved&&JSON.stringify(PAT.lastSeen)===last;})()""")
    def test_permanent_investigation_does_not_use_remote_pressure_or_consume_seal(self):
        p=self.game()
        self.assert_js(p,"""(() => {addItem('seal');PAT.permanent=true;PAT.locked=true;let before=S.san;PatrolWorld.tick(1);Mechanics.finish(.1);
          return hasItem('seal')&&S.san===before&&PAT.permanent&&PAT.state==='walk';})()""")
    def test_saved_midflight_and_non_grid_position_are_restored_exactly(self):
        p=self.game()
        r=p.evaluate("""() => {let a=StairWorld.point('stair_admin',{x:-1.25,z:3.2,h:.8});PAT.room=a.scene;PAT.x=a.x+.07;PAT.y=a.y;PAT.fy=a.fy;
          PAT.routeIndex=0;PAT.transition=null;saveGame();let before=structuredClone(PAT);applySave(loadGame());
          return {before,after:structuredClone(PAT)};}""")
        for k in ['x','y','fy','room','transition','permanent','routeIndex']:self.assertEqual(r['before'][k],r['after'][k])
    def test_stair_portal_is_immediate_but_height_requires_walking(self):
        p=self.game()
        r=p.evaluate("""(() => {let g=PatrolNav.graph(),a=g.nodes['admin1:stairs'],b=g.nodes['admin2:stairs'];
          doEnterRoom('admin2',b);Object.assign(PAT,{room:a.scene,x:a.x,y:a.y,fy:0,permanent:true,locked:false,transition:null,safety:0});DEV.god=true;
          for(let i=0;i<20;i++)PatrolWorld.tick(.1);const middle={room:PAT.room,fy:PAT.fy};
          for(let i=0;i<200&&PAT.room!=='admin2';i++)PatrolWorld.tick(.1);
          return {middle,room:PAT.room,zeroPortals:g.edges.filter(e=>e.kind==='stair-portal').every(e=>e.weight===0),
            physical:g.edges.some(e=>e.a==='stair_admin:0'&&e.b==='stair_admin:1'&&e.kind==='walk'&&e.weight>2)};})()""")
        self.assertEqual(r['middle']['room'],'stair_admin');self.assertGreater(r['middle']['fy'],0)
        self.assertLess(r['middle']['fy'],3.2);self.assertEqual(r['room'],'admin2');self.assertTrue(r['zeroPortals'] and r['physical'])
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
        self.assert_js(p,"""(()=>{let g=PatrolNav.graph(),a=StairWorld.point('stair_admin',{x:1.25,z:6.3,h:1.6}),b=g.nodes['admin2:stairs'];
          doEnterRoom('admin2',b);PAT.room=a.scene;PAT.x=a.x;PAT.y=a.y;PAT.fy=a.fy;PAT.safety=0;PAT.near=false;PAT.permanent=true;
          PatrolWorld.tick(.1);return PAT.warning>3&&!PatrolWorld.localThreat()&&PatrolWorld.pressure()===0;})()""")
    def test_permanent_local_lock_can_reset_without_clearing_tracking_or_bypassing_seal(self):
        p=self.game()
        self.assert_js(p,"""(()=>{PAT.permanent=true;PAT.locked=true;PatrolWorld.tick(2.6);let lost=!PAT.locked&&PAT.permanent;
          let q=PatrolNav.tilePoint('teach1',30,18);doEnterRoom('teach1',q);PAT.room=S.room;PAT.x=S.x+50;PAT.y=S.y;PAT.transition=null;
          PAT.near=true;PAT.warning=0;PAT.safety=0;PAT.blinkCD=100;addItem('seal');PatrolWorld.tick(1.1);
          return lost&&PAT.state==='idle'&&PAT.permanent&&!hasItem('seal')&&PAT.respawn>29;})()""")
    def test_observed_exit_remembers_connector_and_ignores_unseen_motion(self):
        p=self.game()
        self.assert_js(p,"""(()=>{let g=PatrolNav.graph(),a=g.nodes['teach1:stairs'];S.x=a.x;S.y=a.y;PAT.room=S.room;PAT.x=S.x;PAT.y=S.y-25;
          PAT.locked=true;PAT.lastSeen=PatrolNav.point(S.room,S.x,S.y);let seen=PatrolWorld.sees();
          doEnterRoom('stair_teach_w',Object.assign({},g.nodes['stair_teach_w:0'],{stairHeight:0}));let target=PAT.lastSeen;
          S.x+=6;S.y+=4;PatrolWorld.tick(.1);
          return seen&&target.scene==='stair_teach_w'&&target.x===g.nodes['stair_teach_w:0'].x&&JSON.stringify(PAT.lastSeen)===JSON.stringify(target);})()""")

    def test_inspection_and_calm_hold_only_the_local_permanent_entity(self):
        p=self.game()
        self.assert_js(p,"""(()=>{PAT.permanent=true;PAT.room=S.room;PAT.x=S.x+80;PAT.y=S.y;PAT.warning=0;PAT.safety=0;PAT.near=true;
          Inspection.start({day:1,slot:0});let x=PAT.x,y=PAT.y,c=RT.inspection.current;PatrolWorld.tick(8);
          let held=PAT.x===x&&PAT.y===y&&!PAT.locked&&PAT.permanent;
          Inspection.finish(c);for(let i=0;i<70;i++){Inspection.tick(.1);PatrolWorld.tick(.1);}
          let calm=PAT.x===x&&PAT.y===y&&!PAT.locked&&PAT.permanent;
          // 缓冲结束后恢复连续步行，远端永久追踪策略不被这次等待清除。
          for(let i=0;i<25;i++){Inspection.tick(.1);PatrolWorld.tick(.1);}
          return held&&calm&&PAT.permanent&&(PAT.x!==x||PAT.y!==y);})()""")
