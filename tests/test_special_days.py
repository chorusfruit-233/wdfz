"""《传送门建模、死亡CG档案室与速通模式》第 6.5、6.6 节：特殊校园日（校庆、占课）。"""
from browser_case import BrowserCase


DAY = "S.day=3;S.tsec=900;S.dead=false;S.screen='play';S.san=80;AN.active=false;AN.id=null;AN.data={};AN.next=1e6;PAT.next=1e6;"


class SpecialDayTest(BrowserCase):
    def test_days_are_rolled_once_from_the_run_seed(self):
        page = self.page()
        got = page.evaluate("""(()=>{
          DAY_EVENT_CFG.p=window.__dayP;RT.runSeed=12345;RT.dayEvents={};let a=[];
          for(let d=1;d<=40;d++){S.day=d;a.push(DayEvents.ensure());}
          let first=a.slice();RT.dayEvents={};let b=[];
          for(let d=1;d<=40;d++){S.day=d;b.push(DayEvents.ensure());}
          let ann=a.filter(x=>x==='anniversary').length, twice=a.some((x,i)=>i>0&&x==='occupied'&&a[i-1]==='occupied');
          S.day=7;RT.dayEvents[7]='occupied';let kept=DayEvents.ensure();
          return {same:JSON.stringify(first)===JSON.stringify(b),day1:a[0],ann,twice,kept,kinds:[...new Set(a)].sort()};
        })()""")
        self.assertTrue(got['same'])
        self.assertEqual(got['day1'], 'none')
        self.assertLessEqual(got['ann'], 1)
        self.assertFalse(got['twice'])
        self.assertEqual(got['kept'], 'occupied')
        self.assertIn('occupied', got['kinds'])
        # 存档、读档以后同一天的结果不变，也不会重新抽
        page.evaluate("S.day=9;S.tsec=900;DayEvents.ensure();saveGame();window.__d=RT.dayEvents[9];RT.dayEvents={};RT.runSeed=1;applySave(loadGame())")
        self.assert_js(page, "RT.dayEvents[9]===window.__d&&RT.runSeed===12345")

    def test_anniversary_halves_every_per_second_drain(self):
        page = self.page()
        got = page.evaluate(DAY + """(()=>{
          function drop(kind,setup){
            let r={};
            ['none','anniversary'].forEach(function(ev){
              RT.dayEvents={3:ev};S.san=80;setup();let s0=S.san;
              for(let i=0;i<120;i++) kind(1/60);
              r[ev]=s0-S.san;
              AN.active=false;AN.id=null;PAT.state='idle';PAT.locked=false;HIDE.on=false;S.mode='out';S.room=null;
            });
            return +(r.anniversary/r.none).toFixed(3);
          }
          return {
            anomaly:drop(function(dt){AN_DEFS.raindots.tick(dt,AN.data,false);},function(){AN.active=true;AN.id='raindots';AN.t=0;AN.data={};}),
            patrol:drop(function(dt){Mechanics.finish(dt);},function(){patReset();PAT.state='walk';PAT.room='out';PAT.x=S.x+12;PAT.y=S.y;PAT.safety=0;PAT.locked=true;}),
            danger:drop(function(dt){dangerTick(dt);},function(){doEnterRoom('trash1');running=false;}),
            direct:drop(function(dt){sanDrain(1,dt);},function(){}),
          };
        })()""")
        self.assertEqual(got, {'anomaly': 0.5, 'patrol': 0.5, 'danger': 0.5, 'direct': 0.5})

    def test_inspection_gaze_is_halved_too(self):
        page = self.page()
        got = page.evaluate(DAY + """(()=>{let r={};['none','anniversary'].forEach(function(ev){
            RT.dayEvents={3:ev};S.san=80;let c={look:0};
            Inspection.looking=function(){return true;};
            for(let i=0;i<243;i++){ c.look+=(1/60)*DayEvents.drainMul(); while(c.look>=1){c.look-=1;S.san-=INSPECT_CONFIG.gazeSan;} }
            r[ev]=80-S.san;});return r;})()""")
        self.assertEqual(got['anniversary'] * 2, got['none'])
        src = page.evaluate("Inspection.tick.toString()")
        self.assertRegex(src, r'c\.look\s*\+=\s*dt\*(?:\$imports\.)?DayEvents\.drainMul\(\)')

    def test_one_off_losses_recovery_and_night_are_unchanged(self):
        page = self.page()
        got = page.evaluate(DAY + """(()=>{let r={};['none','anniversary'].forEach(function(ev){
            RT.dayEvents={3:ev};S.tsec=900;S.san=80;anHurt('x',10,{keep:1,quiet:1});let hurt=80-S.san;
            S.san=50;let rule={san:function(dt){S.san+=0.8*dt;}};for(let i=0;i<60;i++) sanTick(1/60,rule,false);
            let heal=S.san-50;
            S.tsec=1400;S.san=80;sanDrain(1,1);let night=80-S.san;
            S.tsec=430;S.san=80;sanDrain(1,1);let dawn=80-S.san;
            r[ev]=[+hurt.toFixed(3),+heal.toFixed(3),night,dawn];});return r;})()""")
        self.assertEqual(got['none'], got['anniversary'])

    def test_anniversary_is_announced_once_with_a_banner_outdoors(self):
        page = self.page()
        page.evaluate(DAY + "RT.dayEvents={3:'anniversary'};RT.daySaid={};window.said=[];os=function(m){said.push(m)};DayEvents.tick();DayEvents.tick();updateHUD()")
        self.assertEqual(page.evaluate("said.length"), 1)
        self.assertIn('建校纪念日', page.evaluate("said[0]"))
        self.assertIn('校庆日', page.locator('#place').inner_text())
        self.assert_js(page, "!!DayDecor.grp&&GLR.scene.children.indexOf(DayDecor.grp)>=0")
        page.evaluate("doEnterRoom('teach1');running=false;DayEvents.tick()")
        self.assert_js(page, "!DayDecor.grp")
        page.evaluate("S.mode='out';S.room=null;enterWorldOut();S.tsec=1400;DayEvents.tick();updateHUD()")
        self.assert_js(page, "!DayDecor.grp")
        self.assertNotIn('校庆', page.locator('#place').inner_text())

    def test_occupied_changes_content_but_not_attendance(self):
        page = self.page()
        before = page.evaluate("JSON.stringify({t:INSPECT_CONFIG.times,p:DAY_PHASES,s:SCHED})")
        page.evaluate(DAY + "RT.dayEvents={3:'occupied'};S.actCool={};window.said=[];os=function(m){said.push(m)};doSanAct('piano')")
        self.assert_js(page, "S.san===80&&!S.actCool.piano")
        self.assertIn('音乐课', page.evaluate("said[0]"))
        page.evaluate("doSanAct('run')")
        self.assert_js(page, "S.san>80")                         # 体育活动照常
        self.assertEqual(page.evaluate("JSON.stringify({t:INSPECT_CONFIG.times,p:DAY_PHASES,s:SCHED})"), before)
        self.assert_js(page, "DayEvents.drainMul()===1&&DayEvents.lessonBonus()===2")
        page.evaluate("S.tsec=1400")
        self.assert_js(page, "!DayEvents.closed('piano')&&DayEvents.lessonBonus()===0")

    def test_old_saves_do_not_turn_special_mid_day(self):
        page = self.page()
        page.evaluate(DAY + "saveGame();let d=loadGame();delete d.rt.dayEvents;delete d.rt.runSeed;freshState('easy');running=false;applySave(d)")
        self.assert_js(page, "RT.dayEvents[3]==='none'&&Number.isFinite(RT.runSeed)")
        seed = page.evaluate("RT.runSeed")
        page.evaluate("let d=loadGame();delete d.rt.dayEvents;delete d.rt.runSeed;freshState('easy');running=false;applySave(d)")
        self.assertEqual(page.evaluate("RT.runSeed"), seed)
