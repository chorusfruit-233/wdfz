"""Seat identity, neutral leave, active effects and real staircase integration."""
from browser_case import BrowserCase


class SchoolRebuildTest(BrowserCase):
    def game(self):
        p=self.page()
        p.evaluate("freshState('hard');running=false;S.screen='play';S.intro=0;S.day=2;S.tsec=770;AN.next=9999;PRO.on=false;S.talent='code'")
        return p

    def test_inspection_needs_own_seat_for_entire_check(self):
        p=self.game()
        value=p.evaluate("""()=>{
          const R=INTERIORS.teach1,own=ClassroomLayout.ownSeat,seat=ClassroomLayout.anchor(R,own);
          doEnterRoom('teach1',Object.assign({},seat,{seated:true}));S.san=80;S.viol=30;S.tt=10;
          Inspection.start({day:2,slot:0});const c=Inspection.state().current;
          S.pitch=-1;Inspection.tick(2);S.seated=false;Inspection.tick(.1);S.seated=true;Inspection.tick(6);
          const left={result:c.result,san:S.san,viol:S.viol,tt:S.tt};
          Inspection.start({day:2,slot:1});S.pitch=-1;Inspection.tick(8);
          const good={san:S.san,viol:S.viol,tt:S.tt,own:atMySeat()};
          doEnterRoom('teach2',Object.assign(ClassroomLayout.anchor(INTERIORS.teach2,own),{seated:true}));
          Inspection.start({day:3,slot:0});const wrong=Inspection.state().current.compliant;
          return {left,good,wrong};
        }""")
        self.assertEqual(value['left'],dict(result='absent',san=72,viol=40,tt=7))
        self.assertEqual(value['good'],dict(san=69,viol=32,tt=10,own=True))
        self.assertFalse(value['wrong'])

    def test_leave_settles_neutrally_once_and_does_not_cancel_other_tracking(self):
        p=self.game()
        v=p.evaluate("""()=>{
          S.mode='out';S.room=null;S.san=65;S.viol=44;S.tt=31;RT.leaveUntil=gameClock()+180;
          AttendanceDuty.state.duties=[{dutyId:'duty-1',targetCheckId:'2:0',status:'pending'}];PAT.permanent=true;
          const facts=[];GameModules.on('gameFact',f=>{if(f.kind==='inspection')facts.push(f)});
          Inspection.start({day:2,slot:0});Inspection.start({day:2,slot:0});
          return {san:S.san,viol:S.viol,tt:S.tt,duty:AttendanceDuty.state.duties[0].status,permanent:PAT.permanent,
            active:Inspection.active(),fx:!!INSPECT_FX.group,processed:AttendanceDuty.state.processed['2:0']};
        }""")
        self.assertEqual(v,dict(san=65,viol=44,tt=31,duty='excused',permanent=True,active=False,fx=False,processed='excused'))

    def test_snack_speed_boundary_timer_and_legacy_talent(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const R=INTERIORS.teach1;doEnterRoom('teach1',{x:R.ox+30*9,y:R.oy+18.5*9,ang:0});S.seated=false;S.stam=100;KEY={w:true};S.snackT=.5;
          const x=S.x;ActiveEffects.begin(1);updatePlayer(1);const dx=S.x-x;
          S.snackT=30;HIDE.on=true;ActiveEffects.begin(4);const hidden=S.snackT;HIDE.on=false;
          Talent.normalizeSaved({talent:'stomach',talentState:{rulesVersion:2,consumed:{faceRemedy:true}}});
          return {dx,hidden,talent:S.talent,pool:TAL_KEYS.includes('stomach'),eat:Talent.modifier('activity.eat'),feast:Talent.modifier('anomaly.feast'),leave:LEAVE_MIN};
        }""")
        self.assertAlmostEqual(v['dx'],26.25,places=6)
        self.assertEqual({k:v[k] for k in v if k!='dx'},dict(hidden=26,talent='none',pool=False,eat=18,feast=9,leave=180))

    def test_all_stair_flights_walk_both_directions_and_restore_midflight(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const errors=[],completed=[];let saved=false;
          function walk(path){for(const q of path){let max=1200;while(Math.hypot(S.x-q.x,S.y-q.y)>.08&&max-->0){let dx=q.x-S.x,dy=q.y-S.y,d=Math.hypot(dx,dy);moveBy(dx/d*.12,dy/d*.12,1/240);}if(max<=0)throw Error('blocked '+JSON.stringify({room:S.room,x:S.x,y:S.y,fy:S.floorY,q}));}}
          for(const s of STAIR_LAYOUT){try{
            const a=StairWorld.point(s.id,{x:0,z:-1.8,h:0});doEnterRoom(s.id,{x:a.x,y:a.y,stairHeight:0});
            for(let f=1;f<s.rooms.length;f++){
              const b=StairWorld.point(s.id,{x:0,z:-1.8,h:f*s.rise});walk(StairWorld.navPath({scene:S.room,x:S.x,y:S.y,fy:S.floorY},b));
              if(Math.abs(S.floorY-b.fy)>.03)throw Error('height mismatch');
            }
            const b=StairWorld.point(s.id,{x:0,z:-1.8,h:0});walk(StairWorld.navPath({scene:S.room,x:S.x,y:S.y,fy:S.floorY},b));completed.push(s.id);
          }catch(e){errors.push(String(e));}}
          const s=STAIR_LAYOUT[0],q=StairWorld.point(s.id,{x:-1.25,z:3.2,h:.8});doEnterRoom(s.id,{x:q.x,y:q.y,stairHeight:q.fy});saveGame();let d=loadGame();freshState('hard');applySave(d);saved=Math.abs(S.floorY-.8)<.001&&S.room===s.id;
          return {errors,completed,saved};
        }""")
        self.assertEqual(v['errors'],[])
        self.assertEqual(len(v['completed']),7)
        self.assertTrue(v['saved'])

    def test_walk_into_stair_and_out_onto_next_floor_without_fade(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const s=STAIR_LAYOUT[0],a=StairWorld.port(s,0);doEnterRoom('teach1',{x:a.x,y:a.y-8,ang:Math.PI/2});
          for(let i=0;i<80;i++)moveBy(0,.12,1/240);
          const entered=S.room===s.id,levels=[];
          const b=StairWorld.point(s.id,{x:0,z:-3.05,h:s.rise}),path=StairWorld.navPath({scene:S.room,x:S.x,y:S.y,fy:S.floorY},b);
          for(const q of path){let count=2000;while(S.room===s.id&&Math.hypot(S.x-q.x,S.y-q.y)>.09&&count-->0){let dx=q.x-S.x,dy=q.y-S.y,d=Math.hypot(dx,dy);moveBy(dx/d*.12,dy/d*.12,1/240);levels.push(StairWorld.height());}}
          const maxJump=Math.max(...levels.slice(1).map((h,i)=>Math.abs(h-levels[i])));
          return {entered,room:S.room,maxJump,fade:document.getElementById('fade').style.opacity,depth:Collision.depth(S.x,S.y,PRAD)};
        }""")
        self.assertTrue(v['entered'])
        self.assertEqual(v['room'],'teach2')
        self.assertLess(v['maxJump'],.03)
        self.assertNotEqual(v['fade'],'1')
        self.assertLess(v['depth'],.0001)

    def test_two_doors_independent_and_aimed_interaction(self):
        p=self.game()
        v=p.evaluate("""()=>{
          let count=0;for(let f=1;f<=5;f++){let R=INTERIORS['teach'+f];for(let i=0;i<ClassroomLayout.spans.length;i++)for(let d of ClassroomLayout.doors(i))if(R.grid[d[1]][d[0]]==='=')count++;}
          let R=INTERIORS.teach1,doors=ClassroomLayout.doors(ClassroomLayout.ownSeat.classId),front=doors[0],back=doors[1];
          doEnterRoom('teach1',{x:R.ox+(front[0]+.5)*9,y:R.oy+17*9,ang:-Math.PI/2});tryInteract();
          const result={count,opened:!!OPENDOORS[doorKeyAt(R,...front)],other:!!OPENDOORS[doorKeyAt(R,...back)],hint:interactHint(),seated:S.seated};
          OPENDOORS[doorKeyAt(R,...back)]=1;
          const f={x:R.ox+(front[0]+.5)*9,y:R.oy+(front[1]+.5)*9},b={x:R.ox+(back[0]+.5)*9,y:f.y};
          Classmates.state={room:R.id,blocking:true,door:f};
          result.frontBlocked=Collision.depth(f.x,f.y,PRAD)>0;result.backClear=Collision.depth(b.x,b.y,PRAD)<1e-7;
          return result;
        }""")
        self.assertEqual(v['count'],40)                      # 每层四间、每间前后两扇
        self.assertTrue(v['opened'])
        self.assertFalse(v['other'])
        self.assertFalse(v['seated'])
        self.assertTrue(v['frontBlocked'] and v['backClear'])

    def test_interaction_target_survives_multiple_complete_turns(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const R=INTERIORS.lab2,x=R.ox+2.5*R.tw,y=R.oy+16.5*R.th;
          doEnterRoom('lab2',{x:x+3.4,y:y+4,ang:0});S.seated=false;
          const yaw=Math.atan2(y-S.y,x-S.x),out=[];
          for(const turns of [-100,-5,0,5,100]){
            S.ang=yaw+turns*Math.PI*2;
            const hit=nearWorld(24);out.push({turns,target:hit&&[hit.ch,hit.c,hit.r],hint:interactHint(),delta:angDiff(yaw,S.ang)});
          }
          return out;
        }""")
        for result in v:
            self.assertEqual(result['target'],['L',2,16],result)
            self.assertEqual(result['hint'],'')          # 连续校园（campus-link）：连廊门洞直接走过去，入口吊牌不再提示按 E
            self.assertLess(result['delta'],1e-10)

    def test_patrol_midflight_and_wireless_snapshot_survive_loading(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const s=STAIR_LAYOUT[0],p=StairWorld.point(s.id,{x:-1.25,z:3.2,h:.8});
          Object.assign(PAT,{room:s.id,x:p.x,y:p.y,fy:p.fy,permanent:true,routeVersion:3});
          PAT.wirelessSignal={point:p,remaining:2,locker:null};saveGame();const d=loadGame();
          freshState('hard');running=false;applySave(d);
          return {room:PAT.room,fy:PAT.fy,permanent:PAT.permanent,signal:PAT.wirelessSignal,version:PAT.routeVersion};
        }""")
        self.assertEqual(v['room'],'stair_teach_w');self.assertAlmostEqual(v['fy'],.8)
        self.assertTrue(v['permanent']);self.assertEqual(v['signal']['point']['fy'],.8);self.assertEqual(v['version'],3)

    def test_old_layout_moves_overlap_and_splits_door_without_extending_leave(self):
        p=self.game()
        # 布局 4 以前的档：站的地方（旧本人座位的椅子，现在是教室北边填实的地方）挪到附近空地；
        # 布局 1 的双开门（第 48 列）、布局 3 的单门（第 50 列）记着开着，换成最近的新门开着；假条不延长
        v=p.evaluate("""()=>{
          const R=INTERIORS.teach1;doEnterRoom('teach1');S.seated=false;
          S.x=R.ox+48.8*R.tw;S.y=R.oy+6.39*R.th;
          RT.leaveUntil=gameClock()+73;OPENDOORS['teach1:'+CLS_DOOR[5]+':15']=1;OPENDOORS['teach2:50:15']=1;
          saveGame();const d=loadGame(),expiry=d.rt.leaveUntil;delete d.layoutVersion;
          d.snackT=999;d.talent='stomach';freshState('hard');running=false;applySave(d);
          return {safe:Collision.depth(S.x,S.y,PRAD)<1e-7,expiry:RT.leaveUntil===expiry,
            inClass:ClassroomLayout.classAt(Math.floor((S.x-R.ox)/R.tw),Math.floor((S.y-R.oy)/R.th))===ClassroomLayout.ownSeat.classId,
            doors:!!OPENDOORS['teach1:46:15']&&!OPENDOORS['teach1:48:15']&&!OPENDOORS['teach2:50:15']&&!!OPENDOORS['teach2:46:15'],
            snack:S.snackT,talent:S.talent,seated:S.seated};
        }""")
        self.assertEqual(v,dict(safe=True,expiry=True,inClass=True,doors=True,snack=30,talent='none',seated=False))
        # 坐在旧本人座位（teach1:48:6）上存的档：读进来坐到新本人座位上
        v=p.evaluate("""()=>{
          const R=INTERIORS.teach1;doEnterRoom('teach1');
          S.x=R.ox+48.8*R.tw;S.y=R.oy+6.39*R.th;S.seated=true;S.seat={room:'teach1',seatId:'teach1:48:6',col:48,row:6,facing:Math.PI};
          saveGame();const d=loadGame();delete d.layoutVersion;freshState('hard');running=false;applySave(d);
          const a=ClassroomLayout.anchor(R,ClassroomLayout.ownSeat);
          return {seated:S.seated,seat:S.seat&&S.seat.seatId,onChair:Math.hypot(S.x-a.x,S.y-a.y)<1e-6,mine:atMySeat()};
        }""")
        self.assertEqual(v,dict(seated=True,seat='teach1:48:11',onChair=True,mine=True))

    def test_stair_rail_and_floor_slabs_block_shortcuts(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const s=STAIR_LAYOUT[0],R=INTERIORS[s.id],a=StairWorld.point(s.id,{x:-1.25,z:3.2,h:.8});
          doEnterRoom(s.id,{x:a.x,y:a.y,stairHeight:a.fy});
          for(let i=0;i<80;i++)moveBy(.15,0,1/240);
          return {x:(S.x-R.cx)*U2M,safe:Collision.depth(S.x,S.y,PRAD)<1e-7,
            betweenFloors:PatrolNav.los(a,StairWorld.point(s.id,{x:-1.25,z:3.2,h:4})),
            voidSolid:StairWorld.depth(s.id,R.cx,R.cy+3/U2M,0,.8)>0};
        }""")
        self.assertLessEqual(v['x'],-.6);self.assertTrue(v['safe']);self.assertTrue(v['voidSolid']);self.assertFalse(v['betweenFloors'])

    def test_every_stair_portal_can_be_crossed_on_foot(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const failures=[],ok=[];
          for(const s of STAIR_LAYOUT)for(let f=0;f<s.rooms.length;f++){
            const a=StairWorld.port(s,f),start={x:a.x-a.n[0]*7,y:a.y-a.n[1]*7,ang:Math.atan2(a.n[1],a.n[0])};
            if(a.scene==='out'){doEnterRoom('garage1');doExitRoom();Object.assign(S,start);}else doEnterRoom(a.scene,start);
            S.seated=false;S.enterCool=0;
            for(let j=0;j<70&&S.room!==s.id;j++)moveBy(a.n[0]*.15,a.n[1]*.15,1/240);
            if(S.room!==s.id){failures.push({s:s.id,f,at:[S.x,S.y],phase:'entry',depth:Collision.depth(S.x,S.y,PRAD)});continue;}
            for(let j=0;j<40&&S.room===s.id;j++)moveBy(0,-.15,1/240);
            if((S.room||'out')!==a.scene||Collision.depth(S.x,S.y,PRAD)>1e-7)failures.push({s:s.id,f,phase:'exit',room:S.room});else ok.push([s.id,f]);
          }
          return {failures,count:ok.length};
        }""")
        self.assertEqual(v['failures'],[])
        self.assertEqual(v['count'],29)
