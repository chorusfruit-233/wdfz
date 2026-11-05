"""网络中心区域报点、固定调查点与旧行政楼队列兼容。"""
from browser_case import BrowserCase


class PatrolZonesTest(BrowserCase):
    def game(self, touch=False):
        p = self.page(touch=touch)
        p.evaluate("""freshState('hard');running=false;S.intro=0;PRO.on=false;S.tsec=860;S.talent='none';
          AN.active=false;AN.next=1e6;doEnterRoom('lab3',PatrolNav.tilePoint('lab3',41,17));S.seated=false;""")
        return p

    def test_corridor_student_computers_and_door_do_not_report(self):
        p = self.game()
        self.assert_js(p, """(()=>{for(const [c,r] of [[41,17],[41,15],[5,13],[16,15],[41,16]]){
          const q=PatrolNav.tilePoint('lab3',c,r);S.x=q.x;S.y=q.y;PatrolWorld.tick(.01);
          if(PatrolWorld.region()||PAT.queue.length||PAT.investigation)return false;
          }return PAT.regionSeq===0;})()""")

    def test_entry_reports_once_and_regions_keep_fifo_without_coordinates(self):
        p = self.game()
        r = p.evaluate("""()=>{PAT.state='idle';PAT.respawn=30;
          function enter(c,r,dt=.01){const q=PatrolNav.tilePoint('lab3',c,r);S.x=q.x;S.y=q.y;PatrolWorld.tick(dt);}
          enter(41,13);enter(43,11,16);enter(41,5);enter(41,13);enter(41,17);
          return {ids:PAT.queue.map(e=>e.regionId),seq:PAT.regionSeq,last:PAT.lastRegion,
            fields:PAT.queue.map(e=>Object.keys(e).sort()),wireless:PAT.wirelessSignal};}""")
        self.assertEqual(r['ids'], ['lab3:control', 'lab3:servers'])
        self.assertEqual(r['seq'], 2)
        self.assertIsNone(r['last'])
        self.assertIsNone(r['wireless'])
        self.assertEqual(r['fields'], [['enteredAt', 'regionId', 'sequence']] * 2)

    def test_patrol_investigates_fixed_region_after_player_leaves(self):
        p = self.game()
        r = p.evaluate("""()=>{let q=PatrolNav.tilePoint('lab3',45,13);S.x=q.x;S.y=q.y;PatrolWorld.tick(.01);
          const report=structuredClone(PAT.investigation);doEnterRoom('teach5',PatrolNav.tilePoint('teach5',30,18));
          const b=PatrolNav.snap('lab3',PatrolNav.tilePoint('lab3',41,13));
          Object.assign(PAT,{room:'lab3',x:b.x,y:b.y,fy:0,transition:null,safety:0,near:true,warning:0});
          PatrolWorld.tick(5.9);const waiting=PAT.investigation&&PAT.investigation.regionId==='lab3:control';
          PatrolWorld.tick(.2);return {waiting,finished:!PAT.investigation,permanent:PAT.permanent,
            locked:PAT.locked,room:PAT.room,report};}""")
        self.assertTrue(r['waiting'])
        self.assertTrue(r['finished'])
        self.assertFalse(r['permanent'])
        self.assertFalse(r['locked'])
        self.assertEqual(r['room'], 'lab3')
        self.assertNotIn('x', r['report'])
        self.assertNotIn('y', r['report'])

    def test_leaving_then_entering_again_can_report_after_investigation(self):
        p = self.game()
        self.assert_js(p, """(()=>{PAT.state='idle';PAT.respawn=30;
          function at(c,r){Object.assign(S,PatrolNav.tilePoint('lab3',c,r));PatrolWorld.tick(.01);}
          at(41,13);PAT.queue=[];at(41,17);at(41,13);
          return PAT.queue.length===1&&PAT.queue[0].regionId==='lab3:control'&&PAT.regionSeq===2;})()""")

    def test_new_and_old_regions_survive_save_without_replaying_entry(self):
        p = self.game()
        self.assert_js(p, """(()=>{PAT.state='idle';PAT.respawn=30;
          doEnterRoom('admin5',PatrolNav.tilePoint('admin5',5,14));PatrolWorld.tick(.01);
          doEnterRoom('lab3',PatrolNav.tilePoint('lab3',41,13));PatrolWorld.tick(.01);
          saveGame();const d=loadGame(),before=JSON.stringify(PAT.queue);applySave(d);PatrolWorld.tick(.01);
          return JSON.stringify(PAT.queue)===before&&PAT.queue.map(e=>e.regionId).join(',')==='admin5:office0,lab3:control'&&
            PAT.lastRegion==='lab3:control'&&PAT.regionSeq===2;})()""")

    def test_save_repairs_unknown_regions_and_keeps_network_investigation(self):
        p = self.game()
        self.assert_js(p, """(()=>{doEnterRoom('lab3',PatrolNav.tilePoint('lab3',41,5));PatrolWorld.tick(.01);
          PAT.investigation.remaining=2.4;saveGame();const d=loadGame();
          d.mods.patrolWorld.queue=[{regionId:'lab3:control',sequence:2,enteredAt:0},{regionId:'lab3:missing',sequence:3,enteredAt:0}];
          d.mods.patrolWorld.lastRegion='lab3:missing';applySave(d);
          return PAT.investigation.regionId==='lab3:servers'&&PAT.investigation.remaining===2.4&&
            PAT.queue.length===1&&PAT.queue[0].regionId==='lab3:control'&&PAT.lastRegion===null;})()""")

    def test_all_region_observation_points_are_navigable(self):
        p = self.game()
        rows = p.evaluate("""()=>PATROL_ZONES.map(z=>{const a=PatrolNav.entry(z.scene,'S'),
          b=PatrolNav.snap(z.scene,PatrolNav.tilePoint(z.scene,...z.observe)),path=PatrolNav.path(a,b);
          return {id:z.id,ok:!!path&&path.length>0};})""")
        self.assertEqual(len(rows), 9)
        self.assertEqual(sum(r['id']=='admin2:broadcast' for r in rows), 1)
        self.assertTrue(all(r['ok'] for r in rows), rows)

    def test_registration_does_not_exempt_alarm_zone_and_night_keeps_indoor_rule(self):
        p = self.game()
        self.assert_js(p, """(()=>{S.day=2;S.tsec=760;SchoolDay.grant(true);
          doEnterRoom('lab3',PatrolNav.tilePoint('lab3',41,13));PatrolWorld.tick(.01);
          const day=SchoolDay.permit()&&PatrolWorld.eligible()&&!PatrolWorld.exempt()&&PatrolWorld.hunting();
          S.tsec=1400;doEnterRoom('lab3',PatrolNav.tilePoint('lab3',41,5));PatrolWorld.tick(.01);
          return day&&!PatrolWorld.eligible()&&!PatrolWorld.hunting()&&PAT.regionSeq===2;})()""")

    def test_mobile_and_desktop_show_same_entry_warning_and_world_sign(self):
        for touch in [False, True]:
            p = self.game(touch=touch)
            self.assert_js(p, """(()=>{doEnterRoom('lab3',PatrolNav.tilePoint('lab3',41,13));PatrolWorld.tick(.01);
              return document.getElementById('toast').textContent.includes('区域门禁已上报')&&
                GLR.roomMesh.children.some(m=>(m.userData.wayfinding||'').includes('门禁报警区'));})()""")
