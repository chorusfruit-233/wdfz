"""全部音效重做（2026-11-02）：声音库配方、调用点、按类别校准的响度、每次播放的随机变化、上下课铃、
脚下材质钩子、试听面板，以及以前调用了却不存在的 SFX.chalk / SFX.deep / SFX.stopDeath。"""
import math
import re
from pathlib import Path

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]
SPY = """window.played=[];(function(){const p=SoundPlayer.play;SoundPlayer.play=function(id,o){played.push([id,o||{}]);return p.apply(this,arguments);};})();0;"""


class SoundBankTest(BrowserCase):
    def game(self, start=False):
        page = self.page()
        if start:
            page.evaluate("Game.start('hard')")
            page.wait_for_function("S.room==='teach1'")
            page.evaluate("""running=false;clearIntroTimers();S.intro=0;AN.active=false;AN.id=null;AN.next=1e5;
              patReset();PAT.next=1e5;RT.inspection=null;S.dead=false;""")
        page.evaluate(SPY)
        return page

    def test_recipes_are_valid_and_every_call_site_has_a_sound(self):
        page = self.game()
        r = page.evaluate("""()=>({bad:SoundPlayer.validate(), ids:SoundPlayer.ids(), sfx:Object.keys(SFX),
          an:AN_ID.slice(), dfx:Object.values(DFX_MAP).filter(Boolean), kinds:SFX.deathKinds(),
          cats:Object.keys(SOUND_CATS), used:SoundPlayer.ids().map(id=>SoundPlayer.cat(id))})""")
        self.assertEqual(r['bad'], [])
        ids = set(r['ids'])
        self.assertGreaterEqual(len(ids), 120)
        src = {p: p.read_text(encoding='utf-8') for p in (ROOT / 'game3d/js').rglob('*.js')}
        # 代码里写死的音效名都在声音库里
        literal = set()
        for text in src.values():
            literal |= set(re.findall(r"(?:SoundPlayer\.play|\bP)\('([a-z]+\.[A-Za-z0-9]+)'", text))
        self.assertTrue(literal)
        self.assertEqual(sorted(literal - ids), [])
        # 拼出来的名字：每种异象、每种死因、每种假威胁、每种脚下材质都有
        self.assertEqual([a for a in r['an'] if 'anomaly.' + a not in ids], [])
        self.assertEqual(sorted({d for d in r['dfx'] if 'death.' + d not in ids}), [])
        for kind in ('knock', 'steps', 'chair', 'whisper', 'door', 'call', 'run', 'desk', 'radio'):
            self.assertIn('dread.' + kind, ids)
        for sf in ('tile', 'stair', 'garage', 'roof', 'grass', 'track', 'court', 'road', 'void', 'wet', 'squeak'):
            self.assertIn('step.' + sf, ids)
        self.assertEqual(len(r['kinds']), 28)
        # 游戏里调用的 SFX.xxx 都存在（以前 SFX.chalk、SFX.deep、SFX.stopDeath 调了却不存在，被 try 吞掉没声音）
        calls = set()
        for text in src.values():
            calls |= set(re.findall(r'\bSFX\.([a-zA-Z]+)\b', text))
        self.assertEqual(sorted(calls - set(r['sfx'])), [])
        for name in ('chalk', 'deep', 'stopDeath', 'schoolBell'):
            self.assertIn(name, r['sfx'])
        # 每个类别都有音效
        self.assertEqual([c for c in r['cats'] if c not in r['used']], [])

    def test_levels_table_is_current_and_categories_are_even(self):
        """校准表必须是最新的：按校准后再量一遍，每个音效都落在「类别目标 + lv」±1 dB 内，峰值不超过 −1 dBFS。"""
        page = self.game()
        r = page.evaluate("""async()=>{
          const rows=await SoundPlayer.measure(null,{seeds:4});
          return {rows:rows.map(x=>({id:x.id,st:x.st,pk:x.pk,target:SOUND_CATS[x.cat].target+(SoundPlayer.def(x.id).lv||0)})),
            levels:Object.keys(SOUND_LEVELS).sort(), ids:SoundPlayer.ids().sort()};}""")
        self.assertEqual(r['levels'], r['ids'], '响度表和声音库对不上：运行 python tools/sound_levels.py')
        off = [f"{x['id']} {x['st']} → {x['target']}" for x in r['rows'] if abs(x['st'] - x['target']) > 1.0]
        self.assertEqual(off, [], '响度表过期：运行 python tools/sound_levels.py')
        loud = [f"{x['id']} 峰值 {x['pk']}" for x in r['rows'] if x['pk'] > -1.0]
        self.assertEqual(loud, [])

    def test_layer_reverb_follows_calibration_volume_and_stop(self):
        """PR #27 审查意见：写在单层上的混响（例如 event.bell 的泛音 wet）也要吃出口增益——响度校准、opt.k、stop 淡出。
        离线渲染时把混响发送接到输出、干声接到不出声的节点，只听混响那一路。"""
        page = self.game()
        r = page.evaluate("""async()=>{
          async function wetOnly(opt,fadeAt){
            SoundPlayer.seed(5);
            const sr=22050,a=new OfflineAudioContext(1,sr*4,sr),wet=a.createGain(),sink=a.createGain();
            wet.connect(a.destination);
            const nb=a.createBuffer(1,sr*2,sr),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=((i*7919)%2003)/1001.5-1;
            const E={ctx:a,now:()=>0,noise:()=>nb,strict:true,dry:()=>sink,pan:()=>null,
              send:(c,w)=>{const g=a.createGain();g.gain.value=w;g.connect(wet);return g;}};
            const h=SoundPlayer.render(E,'event.bell',opt,false);
            if(fadeAt!==undefined)SoundPlayer.fade(h,fadeAt);
            const x=(await a.startRendering()).getChannelData(0);
            let pk=0,late=0;for(let i=0;i<x.length;i++){const v=Math.abs(x[i]);if(v>pk)pk=v;if(i>sr*0.8&&v>late)late=v;}
            return {pk,late,fx:!!h.fx};
          }
          const raw=await wetOnly({raw:true}), cal=await wetOnly({}), half=await wetOnly({k:0.5}), mute=await wetOnly({k:0}), stopped=await wetOnly({},0.3);
          SoundPlayer.seed(null);
          const live=SoundPlayer.play('event.bell'), click=SoundPlayer.play('ui.click');
          return {raw,cal,half,mute,stopped,level:SOUND_LEVELS['event.bell'],liveFx:!!(live&&live.fx),clickFx:!!(click&&click.fx)};}""")
        self.assertTrue(r['cal']['fx'])
        db = 20 * math.log10(r['cal']['pk'] / r['raw']['pk'])
        self.assertAlmostEqual(db, r['level'], delta=0.3)                    # 混响也吃响度校准（event.bell 约 −9 dB）
        self.assertAlmostEqual(r['half']['pk'] / r['cal']['pk'], 0.5, delta=0.02)   # 也跟着 opt.k
        self.assertEqual(r['mute']['pk'], 0)                                 # k=0：连混响都没有
        self.assertLess(r['stopped']['late'], r['cal']['late'] * 0.01)        # 淡出时混响一起停
        self.assertTrue(r['liveFx'])                                         # 游戏混音里：钟有自己的那一路混响
        self.assertFalse(r['clickFx'])                                       # 没写单层 wet 的音效不多建节点

    def test_each_play_is_slightly_different_but_equally_loud(self):
        page = self.game()
        r = page.evaluate("""async()=>{const out={};
          for(const id of ['step.tile','ui.click','dread.knock','foley.door']){
            const v=[]; for(let s=0;s<6;s++){ const m=await SoundPlayer.measure([id],{seeds:1,seed:s*101}); v.push(m[0].st); }
            out[id]=v; }
          return out;}""")
        for sid, values in r.items():
            self.assertGreater(len(set(values)), 1, sid)                       # 不会两次一模一样
            self.assertLess(max(values) - min(values), 4.5, (sid, values))       # 但响度只在几 dB 内浮动

    def test_school_bells_tell_class_start_from_class_end(self):
        """上课铃（进入「教室」时段）是电铃，下课铃是四音钟声；室外更轻更闷；异空间里不响。"""
        page = self.game(start=True)
        r = page.evaluate("""()=>{SFX.ambient();S.screen='play';S.dead=false;AMB_ON=true;
          const bells=()=>played.filter(p=>p[0].indexOf('event.bell')===0).map(p=>[p[0],+(p[1].k||1).toFixed(2),+(p[1].lp===undefined?1:p[1].lp).toFixed(2)]);
          S.tsec=539.5;SFX.tick(0.1);played.length=0;S.tsec=540.2;SFX.tick(0.1);const start=bells();       // 课间 → 第 2 节
          played.length=0;S.tsec=584.8;SFX.tick(0.1);S.tsec=585.3;SFX.tick(0.1);const end=bells();          // 第 2 节 → 课间操
          S.mode='out';played.length=0;S.tsec=619.8;SFX.tick(0.1);S.tsec=620.2;SFX.tick(0.1);const outside=bells();  // 室外：课间操 → 第 3 节
          S.mode='in';GameModules.on('soundscape',function(){return 'void';},{owner:'probe'});
          played.length=0;S.tsec=664.8;SFX.tick(0.1);S.tsec=665.2;SFX.tick(0.1);const quiet=bells();
          return {start,end,outside,quiet,tune:BELL_TUNE.length};}""")
        self.assertEqual(r['start'], [['event.bellStart', 1, 1]])
        self.assertEqual(r['end'], [['event.bellEnd', 1, 1]])
        self.assertEqual(r['outside'], [['event.bellStart', 0.45, 0.6]])
        self.assertEqual(r['quiet'], [])
        self.assertEqual(r['tune'], 8)

    def test_step_surface_hook_and_feet_alternate(self):
        page = self.game(start=True)
        r = page.evaluate("""()=>{const before=SFX.surface();
          GameModules.on('stepSurface',function(){return window.surf;},{owner:'probe'});
          window.surf='garage';const hooked=SFX.surface();window.surf='lava';const unknown=SFX.surface();window.surf=undefined;
          played.length=0;S.run=false;SFX.step();SFX.step();S.run=true;SFX.step();S.run=false;
          const steps=played.filter(p=>p[0].indexOf('step.')===0).map(p=>[p[0],+p[1].k.toFixed(2),+p[1].pitch.toFixed(2)]);
          played.length=0;SFX.patStep(-0.6,0.8,true,true);const pat=played[0];
          return {before,hooked,unknown,steps,pat:[pat[0],+pat[1].k.toFixed(2),+pat[1].lp.toFixed(2),pat[1].pan<0]};}""")
        self.assertEqual(r['before'], 'tile')
        self.assertEqual(r['hooked'], 'garage')
        self.assertEqual(r['unknown'], 'tile')                          # 声音库里没有的材质不用
        self.assertEqual([s[0] for s in r['steps']], ['step.tile'] * 3)
        self.assertNotEqual(r['steps'][0][2], r['steps'][1][2])          # 左右脚音高差一点
        self.assertEqual(r['steps'][2][1], 1.35)                         # 跑起来更响
        self.assertEqual(r['pat'], ['step.tile', 1.2, 0.55, True])       # 巡察者在背后：发闷、在左边

    def test_old_missing_calls_now_play_and_death_sounds_can_be_stopped(self):
        page = self.game()
        r = page.evaluate("""()=>{played.length=0;SFX.chalk();SFX.deep();
          const ids=played.map(p=>p[0]);
          SFX.deathFx('drown');SFX.deathFx('bell');const before=SoundPlayer.active().filter(i=>i.indexOf('death.')===0).length;
          const n=SFX.stopDeath();const after=SoundPlayer.active().filter(i=>i.indexOf('death.')===0).length;
          return {ids,before,n,after};}""")
        self.assertEqual(r['ids'], ['foley.chalk', 'void.fall'])
        self.assertGreaterEqual(r['before'], 3)
        self.assertGreaterEqual(r['n'], 3)
        self.assertEqual(r['after'], 0)

    def test_dread_and_thunder_map_to_direction_distance_and_muffling(self):
        page = self.game()
        r = page.evaluate("""()=>{played.length=0;
          SFX.dread('knock',{pan:-2,k:0.4,muffled:true,behind:true});SFX.thunder(0.5,1,false);SFX.thunder(0,0.3,true);
          SFX.crackle(0.01,0);SFX.cupHit(28);
          return played.map(p=>[p[0],p[1].pan===undefined?null:+p[1].pan.toFixed(2),p[1].k===undefined?null:+p[1].k.toFixed(3),
            p[1].lp===undefined?null:+p[1].lp.toFixed(3),p[1].at===undefined?null:p[1].at]);}""")
        self.assertEqual(r[0], ['dread.knock', -1, 0.4, 0.245, None])
        self.assertEqual(r[1], ['event.thunder', None, 1, 1, 0.5])
        self.assertEqual(r[2], ['event.thunderFar', None, 0.3, 0.45, 0])
        self.assertEqual(r[3], ['foley.cupHit', None, 0.15, None, None])   # 太轻的噼啪不放；杯子掉得远最轻 0.15
        self.assertEqual(len(r), 4)

    def test_mods_can_add_their_own_sound(self):
        page = self.game()
        r = page.evaluate("""()=>{const ok=SoundPlayer.add('mod.ding',{cat:'ui',name:'Mod 的提示音',layers:[{t:'bell',f:880,dur:0.8,g:0.1}]});
          const bad=SoundPlayer.validate(), h=SoundPlayer.play('mod.ding'), refused=SoundPlayer.add('mod.bad',{cat:'ui'});
          return {ok,bad,id:h&&h.id,refused,listed:SoundPlayer.ids().indexOf('mod.ding')>=0};}""")
        self.assertEqual(r, {'ok': True, 'bad': [], 'id': 'mod.ding', 'refused': False, 'listed': True})

    def test_dev_tools_page_auditions_every_sound(self):
        page = self.game(start=True)
        page.evaluate("window.prompt=()=>Dev.open.toString().match(/password!==(?:'|\")([^'\"]+)/)[1]")   # 密码另有用例
        page.keyboard.press('F2')
        page.locator('#dev').wait_for(state='visible')
        page.evaluate("Dev.tab('tools')")
        r = page.evaluate("""()=>{const cat=document.getElementById('devsndCat'), snd=document.getElementById('devsnd');
          const cats=Array.from(cat.options).map(o=>o.value);
          let total=0; cats.forEach(c=>{cat.value=c;cat.onchange();total+=snd.options.length;});
          cat.value='event';cat.onchange();snd.value='event.bellStart';snd.onchange();
          played.length=0;document.getElementById('devsndGo').click();
          const info=document.getElementById('devsndInfo').textContent;
          document.getElementById('devsndAll').click();const all=played.length;const label=document.getElementById('devsndAll').textContent;
          document.getElementById('devsndAll').click();
          return {cats:cats.length,total,first:played[0][0],info,all,label,after:document.getElementById('devsndAll').textContent,n:SoundPlayer.ids().length};}""")
        self.assertEqual(r['total'], r['n'])
        self.assertEqual(r['cats'], 11)
        self.assertEqual(r['first'], 'event.bellStart')
        self.assertIn('event.bellStart', r['info'])
        self.assertIn('dB', r['info'])
        self.assertGreater(r['all'], 20)
        self.assertEqual((r['label'], r['after']), ('停止', '整类连放'))

    def test_wiki_explains_the_two_bells_without_internal_names(self):
        text = (ROOT / 'wiki/index.html').read_text(encoding='utf-8')
        self.assertIn('上课铃', text)
        self.assertIn('下课铃', text)
        for word in ('void.', 'sound-bank', 'SOUND_BANK', '异空间'):
            self.assertNotIn(word, text)

    def test_session_boundary_stops_scheduled_audio(self):
        page = self.game(start=True)
        r = page.evaluate("""()=>{
          SoundPlayer.play('event.bell',{at:30});
          const before=SoundPlayer.active();freshState('hard');running=false;
          return {before,after:SoundPlayer.active()};
        }""")
        self.assertIn('event.bell', r['before'])
        self.assertEqual(r['after'], [])

    def test_stopping_audition_preserves_game_audio(self):
        page = self.game()
        r = page.evaluate("""()=>{
          SoundPlayer.stop();SoundPlayer.play('foley.door',{at:30});
          document.getElementById('devsndCat').value='ui';SoundBoard.fill();
          SoundBoard.playAll();SoundBoard.playAll();
          return {active:SoundPlayer.active(),playing:SoundBoard.playing};
        }""")
        self.assertEqual(r, {'active': ['foley.door'], 'playing': False})

    def test_old_audition_timer_cannot_reset_new_sequence_or_next_session(self):
        page = self.game(start=True)
        page.clock.install()
        duration = page.evaluate("""()=>{
          document.getElementById('devsndCat').value='ui';SoundBoard.fill();
          const duration=SoundBoard.ids('ui').reduce((t,id)=>t+SoundPlayer.length(id)+0.6,0);
          SoundBoard.playAll();SoundBoard.playAll();
          document.getElementById('devsndCat').value='death';SoundBoard.fill();SoundBoard.playAll();
          return duration;
        }""")
        page.clock.fast_forward(round((duration + 2) * 1000))
        self.assert_js(page, "SoundBoard.playing&&document.getElementById('devsndAll').textContent==='停止'")
        page.evaluate('Game.quit()')
        self.assert_js(page, "!SoundBoard.playing&&SoundPlayer.active().length===0&&document.getElementById('devsndAll').textContent==='整类连放'")
        page.clock.fast_forward(300000)
        self.assert_js(page, "!SoundBoard.playing&&SoundPlayer.active().length===0")
