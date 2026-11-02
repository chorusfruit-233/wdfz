"""《传送门建模、死亡CG档案室与速通模式》第 6 节：清华水杯前摇、连锁异象、电梯异界配色。
连锁异象按内部潜在彩蛋处理：只在内部测试里出现，不进玩家 Wiki。"""
from browser_case import BrowserCase


NIGHT_OUT = """S.tsec=1350;S.mode='out';S.room=null;S.x=560*SC;S.y=857*SC;S.san=100;S.dead=false;
  AN.active=false;AN.id=null;AN.data={};AN.next=1e6;PAT.state='idle';PAT.next=1e6;"""


class CupTimingTest(BrowserCase):
    def test_cup_wobble_is_shorter_and_keeps_the_difficulty_order(self):
        page = self.page()
        got = page.evaluate("""(()=>{let r={};['easy','hard'].forEach(function(df){
            S.diff=df;AN.data={};AN_DEFS.cup.place(AN.data);r[df]=AN.data.wob;});return r;})()""")
        self.assertEqual(got, {'easy': 0.85, 'hard': 0.40})
        self.assert_js(page, "CUP_WOB.normal===0.6&&cupFallTime()>1.4")

    def test_short_wobble_still_leaves_time_to_step_aside(self):
        """前摇短了，但「看到它掉」以后仍有约 1.5 秒真实下坠，侧移 1.6 米能躲开。"""
        page = self.page()
        page.evaluate("""S.diff='hard';S.x=560*SC;S.y=857*SC;S.san=100;AN.pre='cup';AN.locked=true;anStart();
            for(var i=0;i<40&&AN.data.phase<1;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "AN.data.phase===1&&AN.t<0.5&&ANFX.cup.ring.visible")
        page.evaluate("S.y-=14;for(var i=0;i<120&&AN.active;i++){ anTick(0.05); anfxUpdate(0.05); }")
        self.assert_js(page, "!S.dead&&!AN.active")


class ColaChainTest(BrowserCase):
    def cup(self, page):
        page.evaluate("S.tsec=900;S.x=560*SC;S.y=857*SC;S.san=100;AN.pre='cup';AN.locked=true;anStart()")

    def run_until(self, page, cond, steps=600, dt=0.05):
        page.evaluate(f"""for(var i=0;i<{steps}&&!({cond});i++){{ anDrive({dt}); anfxUpdate({dt}); }}""")

    def test_only_a_real_cup_owes_one_cola_and_debug_does_not(self):
        page = self.page()
        page.evaluate("Dev.triggerAnomaly('cup');Dev.endActiveAnomaly()")
        self.assert_js(page, "!RT.colaPending")
        self.cup(page)
        self.assert_js(page, "RT.colaPending&&RT.colaPending.seq===1&&RT.colaPending.day===S.day")
        page.evaluate("anEnd();AN.pre='cup';AN.locked=true;anStart();anEnd()")
        self.assert_js(page, "RT.colaPending.seq===1&&RT.colaSeq===1")   # 只欠一罐
        self.assert_js(page, "!anAllowed('cola')&&pickAnomaly()!=='cola'")

    def test_daytime_and_indoors_keep_it_pending_until_a_safe_night_outdoors(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();S.tsec=900;AN.next=1e6;PAT.next=1e6")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&RT.colaPending")             # 白天不来
        page.evaluate("S.tsec=1350;doEnterRoom('teach1');running=false")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&RT.colaPending")             # 夜里在楼里不来
        page.evaluate(NIGHT_OUT + "PAT.state='walk'")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&RT.colaPending")             # 巡察在场时先不来
        page.evaluate("PAT.state='idle'")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "AN.id==='cola'&&!RT.colaPending&&RT.colaDone===1&&ANFX.kind==='cola'")

    def test_cup_at_night_is_followed_by_cola_after_it_ends(self):
        page = self.page()
        page.evaluate(NIGHT_OUT + "AN.pre='cup';AN.locked=true;anStart()")
        self.assert_js(page, "AN.id==='cup'&&RT.colaPending")
        page.evaluate("""for(var i=0;i<40&&AN.data.phase<1;i++){ anTick(0.05); anfxUpdate(0.05); }
            S.y-=40;for(i=0;i<200&&AN.active;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "!AN.active&&!S.dead")
        page.evaluate("AN.next=1e6")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "AN.id==='cola'&&AN.t<0.2")

    def test_cola_can_be_dodged_and_a_hit_only_costs_san(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();" + NIGHT_OUT)
        self.run_until(page, 'AN.active', steps=200)
        self.run_until(page, 'AN.data.phase>=1', steps=100)
        self.assert_js(page, "AN.id==='cola'&&AN.data.phase===1&&ANFX.cola.core.visible")
        page.evaluate("S.y-=30")                                       # 约 3.5 米外：干净地躲开
        self.run_until(page, '!AN.active', steps=200)
        self.assert_js(page, "!S.dead&&S.san===100&&!RT.colaPending")
        # 擦着脚边落下：只吓一下、扣一点
        page.evaluate("RT.colaPending={seq:2,day:S.day,clock:0};" + NIGHT_OUT)
        self.run_until(page, 'AN.data&&AN.data.phase>=1', steps=300)
        page.evaluate("S.y-=14")
        self.run_until(page, '!AN.active', steps=200)
        self.assert_js(page, "!S.dead&&S.san<100&&S.san>=95")
        # 第二局：原地不动，砸中只扣 SAN
        page.evaluate("RT.colaPending={seq:3,day:S.day,clock:0};" + NIGHT_OUT)
        self.run_until(page, 'AN.data&&AN.data.phase===2', steps=300)
        self.assert_js(page, "AN.id==='cola'&&AN.data.hit===1&&!S.dead&&S.san<90&&S.san>80")

    def test_pending_and_running_cola_survive_save_without_repeating(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();saveGame();RT.colaPending=null;applySave(loadGame())")
        self.assert_js(page, "RT.colaPending&&RT.colaPending.seq===1")
        page.evaluate(NIGHT_OUT)
        self.run_until(page, 'AN.active', steps=200)
        page.evaluate("anDrive(0.1);saveGame();anfxClear();Game.continue_();running=false")
        self.assert_js(page, "AN.id==='cola'&&!RT.colaPending&&RT.colaDone===1&&ANFX.kind==='cola'&&!!ANFX.cola")
        self.run_until(page, '!AN.active', steps=300)
        page.evaluate("AN.next=1e6")
        self.run_until(page, 'AN.active', steps=300)
        self.assert_js(page, "!AN.active")                               # 演过一次就不再来
        # 欠条号已演过（例如旧存档里残留），不会再开场
        page.evaluate("RT.colaPending={seq:1,day:S.day,clock:0}")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&!RT.colaPending")

    def test_forecast_survives_the_cola(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();" + NIGHT_OUT + "AN.pre='chalk';AN.locked=true;AN.next=30")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "AN.id==='cola'")
        page.evaluate("S.y-=40")
        self.run_until(page, '!AN.active', steps=300)
        self.assert_js(page, "AN.pre==='chalk'&&AN.locked&&AN.next>=12")


class DreamPaletteTest(BrowserCase):
    def test_dream_space_is_a_dark_red_room_with_one_green_exit(self):
        """异色空间按恐怖感重做：整层暗红、远处沉进红黑的雾，唯一不是红的是尽头的绿色「安全出口」；出口照旧能走。"""
        page = self.page()
        page.evaluate("""Game.start('hard');clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=760;
          AN.active=false;AN.id=null;AN.next=1000;patReset();PAT.next=1000;RT.inspection=null;""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("""clearIntroTimers();running=false;S.san=80;AN.active=false;AN.next=1000;PAT.next=1000;
          doEnterRoom('lab1',Elevator.landing('lab',1));Math.random=()=>0;Elevator.board('lab',1);Elevator.controls();""")
        page.locator('#choices button').filter(has_text='67 层').click()
        page.wait_for_function("S.room==='lift_dream'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lift_dream")
        # 房间是合并过的网格，颜色在顶点上：有颜色的顶点几乎都是红色调，整体很暗；绿只在出口的门缝光上
        st = page.evaluate("""(()=>{let n=0,red=0,col=0,green=0,lum=0,c=new THREE.Color(),hsl={};GLR.roomMesh.traverse(o=>{
            if(!o.isMesh||!o.geometry||!o.geometry.attributes.color) return;
            const a=o.geometry.attributes.color;
            for(let i=0;i<a.count;i+=3){ c.setRGB(a.getX(i),a.getY(i),a.getZ(i)); c.getHSL(hsl); n++; lum+=hsl.l;
              if(hsl.s>0.3&&hsl.l>0.005){ col++; if(hsl.h<0.06||hsl.h>0.94) red++; if(hsl.h>0.25&&hsl.h<0.5) green++; } }});
            return {n,red,col,green,lum:lum/Math.max(1,n)};})()""")
        self.assertGreater(st['red'] / max(1, st['col']), 0.9, st)
        self.assertLess(st['lum'], 0.3, st)
        self.assertGreater(st['green'], 0, st)
        self.assert_js(page, "ROOM_THEMES.dream.wall!==0xf5f5f0&&INTERIORS.lift_dream.name==='异色空间'")
        # 出口：自发光的「安全出口」灯牌（不吃红光），三盏暗红的安全灯加一盏照门的绿灯
        self.assert_js(page, """(()=>{let s=null;GLR.scene.traverse(o=>{if(o.userData&&o.userData.wayfinding==='安全出口')s=o;});
            return !!s&&[].concat(s.material).some(m=>m.isMeshBasicMaterial&&!!m.map);})()""")
        page.evaluate("render(0.016)")
        self.assert_js(page, "GLR.roomLights.filter(L=>L.color.r>L.color.g*4).length===3&&GLR.roomLights.filter(L=>L.color.g>L.color.r*1.5).length===1")
        # 灯光、雾、后期：暗红的环境光、红黑色的雾；暗角和颗粒开着，关掉镜头晃动时画面不「呼吸」
        self.assert_js(page, "GLR.amb.color.r>GLR.amb.color.g*4&&GLR.scene.fog.color.r>GLR.scene.fog.color.g*4&&GLR.scene.fog.density>=0.05")
        self.assert_js(page, "GLR.postMat.uniforms.uFx.value>=0.85&&GLR.postMat.uniforms.uDream.value===1")
        page.evaluate("SHAKE_ON=false;render(0.016)")
        self.assert_js(page, "GLR.postMat.uniforms.uBreath.value===0")
        page.evaluate("SHAKE_ON=true")
        page.evaluate("S.x=INTERIORS.lift_dream.ox+15.5*9;S.y=INTERIORS.lift_dream.oy+5.5*9;S.ang=0;tryInteract()")
        page.wait_for_function("S.room==='lab1'&&!RT.elevatorRide")
        page.evaluate("render(0.016)")
        self.assert_js(page, "GLR.postMat.uniforms.uFx.value<0.85&&GLR.postMat.uniforms.uDream.value===0&&GLR.postMat.uniforms.uBreath.value===0")
        self.assert_js(page, "!(GLR.amb.color.r>GLR.amb.color.g*4)")


class DreamFiguresTest(BrowserCase):
    """异色空间里的人影（fx/dream-figures.js）：站在光前面的黑影，没看着时转过来；走近、盯着看就不见；
    走远、背对电梯口时身后先响脚步声，回头看电梯门里站着一个。只是吓人：没有碰撞、不扣 SAN、每次进来重摆。"""

    def enter(self, page):
        page.evaluate("Game.start('hard');clearIntroTimers();running=false;S.intro=0;AN.active=false;AN.next=1e6;PAT.next=1e6;")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("""doEnterRoom('lift_dream',Elevator.spawn('lift_dream',2,5,0));running=false;
          window.vanished=0;window.steps=0;SFX.vanish=function(){vanished++;};SFX.dread=function(k){if(k==='steps')steps++;};""")
        page.wait_for_function("S.room==='lift_dream'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lift_dream")
        page.evaluate("syncCamera(0);render(0.016)")

    @staticmethod
    def put(page, c, r, ang):
        page.evaluate(f"(()=>{{const R=INTERIORS.lift_dream;S.x=R.ox+{c}*R.tw;S.y=R.oy+{r}*R.th;S.ang={ang};S.pitch=0;syncCamera(0);}})()")

    def test_figures_turn_when_unseen_vanish_up_close_or_under_a_stare_and_never_hurt(self):
        page = self.page()
        self.enter(page)
        self.assert_js(page, "DFIG.items.length===4&&DFIG.items.every(i=>i.g.visible&&!i.gone)&&!DFIG.follow.g.visible")
        self.assert_js(page, "DFIG.items.concat([DFIG.follow]).every(i=>{const w=dreamFigWorld(INTERIORS.lift_dream,i.d);return !solidAt(w.x,w.y);})")
        self.assert_js(page, "DFIG.mat.isMeshBasicMaterial&&DFIG.mat.color.getHex()<0x101010")
        san = page.evaluate("S.san")
        # 背过身去：东边那几个转过来朝着你
        page.evaluate("S.ang=Math.PI;syncCamera(0);render(0.016)")
        self.assert_js(page, """(()=>{const it=DFIG.items.find(i=>i.d.id==='north'),p=it.g.position,c=GLR.cam.position;
            return angDiff(it.g.rotation.y,Math.atan2(c.x-p.x,c.z-p.z))<1e-6;})()""")
        # 面壁的那个不转
        self.assert_js(page, "Math.abs(DFIG.items.find(i=>i.d.id==='wall').g.rotation.y-Math.PI)<1e-9")
        # 盯着看一会儿就不见（高的那个，8 米外）
        page.evaluate("""(()=>{const R=INTERIORS.lift_dream,t=DFIG.items.find(i=>i.d.id==='tall'),w=dreamFigWorld(R,t.d);
            S.x=R.ox+8.5*R.tw;S.y=R.oy+5.5*R.th;S.ang=Math.atan2(w.y-S.y,w.x-S.x);syncCamera(0);})()""")
        page.evaluate("render(0.016)")
        self.assert_js(page, "!DFIG.items.find(i=>i.d.id==='tall').gone")
        for _ in range(4):
            page.evaluate("render(0.4)")
        self.assert_js(page, "DFIG.items.find(i=>i.d.id==='tall').gone&&vanished>=1")
        # 走近也不见
        self.assert_js(page, "!DFIG.items.find(i=>i.d.id==='north').gone")
        self.put(page, 13.0, 3.2, 0)
        page.evaluate("render(0.016)")
        self.assert_js(page, "DFIG.items.find(i=>i.d.id==='north').gone")
        self.assertEqual(page.evaluate("S.san"), san)

    def test_the_one_that_follows_you_out_of_the_elevator(self):
        page = self.page()
        self.enter(page)
        self.put(page, 5.0, 5.5, 0.0)           # 离电梯口不到 6 米：不来
        for _ in range(4):
            page.evaluate("render(0.5)")
        self.assert_js(page, "!DFIG.follow.shown&&steps===0")
        self.put(page, 9.6, 5.5, 0.0)           # 走远了、背对电梯口：先响脚步声，过一会儿它才站好
        page.evaluate("render(0.5)")
        self.assert_js(page, "steps===1&&!DFIG.follow.shown")
        for _ in range(3):
            page.evaluate("render(0.5)")
        self.assert_js(page, "DFIG.follow.shown&&DFIG.follow.g.visible&&steps===1")
        self.put(page, 9.6, 5.5, 3.14159)       # 回头：它站在半开的电梯门前；盯着看一秒就不见了
        page.evaluate("render(0.016)")
        self.assert_js(page, "DFIG.follow.g.visible&&!DFIG.follow.gone")
        for _ in range(3):
            page.evaluate("render(0.5)")
        self.assert_js(page, "DFIG.follow.gone&&!DFIG.follow.g.visible")

    def test_figures_reset_each_visit_hide_outside_and_replace_the_random_apparition(self):
        page = self.page()
        self.enter(page)
        self.put(page, 13.0, 3.2, 0)
        page.evaluate("render(0.016)")
        self.assert_js(page, "DFIG.items.find(i=>i.d.id==='north').gone")
        page.evaluate("APPAR.next=0;apparTick(0.016)")               # 这里不另出随机的远处人影
        self.assert_js(page, "!APPAR.g||!APPAR.g.visible")
        page.evaluate("doEnterRoom('lab1',Elevator.landing('lab',1));running=false;syncCamera(0);render(0.016)")
        self.assert_js(page, "!DFIG.g.visible&&DFIG.room===null")
        page.evaluate("doEnterRoom('lift_dream',Elevator.spawn('lift_dream',2,5,0));running=false;syncCamera(0);render(0.016)")
        self.assert_js(page, "DFIG.g.visible&&DFIG.items.every(i=>!i.gone&&i.g.visible)&&!DFIG.follow.shown")
