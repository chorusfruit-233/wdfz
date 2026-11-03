"""Presentation-only sensation, shared muted sound events and readable small screens."""
from browser_case import BrowserCase


class SensoryTest(BrowserCase):
    def game(self, touch=False):
        p=self.page(touch=touch)
        p.evaluate("freshState('hard');running=false;S.intro=0;S.tsec=700;PRO.on=false;AN.next=99999;AN.active=false;doEnterRoom('teach1');S.seated=false;S.san=100;RT.leaveUntil=0;Sensory.reset()")
        return p

    def test_smoothing_recovers_gradually_and_does_not_change_rules_or_random(self):
        p=self.game()
        v=p.evaluate("""()=>{
          let draws=0;GameRandom.bind(()=>{draws++;return .5});
          const original=JSON.stringify([S,RT,AN,PAT]);Sensory.frame(.1);
          const normal=Sensory.view().warp,initial=Sensory.state().body;
          for(let i=0;i<80;i++)GameModules.emit('frame',.1);
          const unchanged=JSON.stringify([S,RT,AN,PAT])===original;
          S.san=8;for(let i=0;i<20;i++)Sensory.frame(.1);const low=Sensory.view().warp;
          S.san=100;Sensory.frame(.1);const recovering=Sensory.view().warp;
          for(let i=0;i<200;i++)Sensory.frame(.1);const recovered=Sensory.view().warp;
          return {normal,initial,low,recovering,recovered,draws,unchanged};
        }""")
        self.assertEqual((v['normal'],v['initial'],v['draws'],v['unchanged']),(0,0,0,True))
        self.assertGreater(v['low'],.7)
        self.assertTrue(0<v['recovering']<v['low'])
        self.assertLess(v['recovered'],.000001)

    def test_muted_caption_is_same_dispatch_as_audio_and_has_no_secret_identity(self):
        p=self.game()
        v=p.evaluate("""()=>{
          SET.vol=0;SET.soundCaptions=0;SoundCaptions.reset();
          const plays=[],original=SoundPlayer.play;
          SoundPlayer.play=function(id,opt){plays.push({id,event:opt.event});return original.apply(this,arguments)};
          SFX.dread('knock',{pan:-.7,behind:true,m:12,muffled:true});
          const event=SoundCaptions.events()[0],text=document.getElementById('soundcaptions').innerText;
          return {text,event,plays};
        }""")
        self.assertIn('左',v['text']); self.assertIn('后方',v['text']); self.assertIn('隔着墙',v['text'])
        self.assertNotRegex(v['text'],r'SAN|巡察|真假|dread|12|上方')
        self.assertEqual(len(v['plays']),1)
        self.assertEqual(v['plays'][0]['event'],v['event']['dispatch'])

    def test_priority_merging_expiry_and_pause_clear(self):
        p=self.game()
        v=p.evaluate("""()=>{
          SoundCaptions.reset();SET.soundCaptions=1;
          for(let i=0;i<30;i++)SoundCaptions.publish('dread.steps',{source:'steps'+i});
          SoundCaptions.publish('step.tile',{patrol:true,source:'patrol'});
          for(let i=0;i<20;i++)SoundCaptions.publish('step.tile',{patrol:true,source:'patrol'});
          const bounded=SoundCaptions.events().length,visible=document.querySelectorAll('#soundcaptions div').length;
          const lead=SoundCaptions.events()[0];
          PAUSE.on=true;GameModules.emit('frame',.1);const cleared=SoundCaptions.events().length;PAUSE.on=false;
          SoundCaptions.publish('dread.knock',{});for(let i=0;i<40;i++)GameModules.emit('frame',.1);
          return {bounded,visible,lead,cleared,expired:SoundCaptions.events().length};
        }""")
        self.assertEqual(v['bounded'],8);self.assertEqual(v['visible'],2)
        self.assertEqual(v['lead']['source'],'patrol')
        self.assertEqual(v['cleared'],0);self.assertEqual(v['expired'],0)

    def test_old_settings_respect_reduced_motion_and_explicit_choice(self):
        p=self.game()
        v=p.evaluate("""()=>{
          localStorage.setItem('zw3d_set',JSON.stringify({shake:0}));loadSet();const old=SET.distortion,captionsDefault=SET.soundCaptions;
          Settings.sensory('distortion',2);loadSet();const explicit=SET.distortion;
          Settings.sensory('soundCaptions',2);loadSet();const captionsOff=SET.soundCaptions;
          SET.distortion=99;SET.soundCaptions=-1;normalizeComfort();
          return {old,explicit,captionsDefault,captionsOff,valid:SET.distortion===2&&SET.soundCaptions===1};
        }""")
        self.assertEqual(v,dict(old=0,explicit=2,captionsDefault=1,captionsOff=2,valid=True))

    def test_off_distortion_keeps_shader_center_and_touch_aim_stable(self):
        p=self.game(True)
        v=p.evaluate("""()=>{
          S.san=8;Sensory.reset();SET.distortion=0;let pose=[S.x,S.y,S.ang,S.pitch,S.floorY];
          Sensory.frame(.1);render(.016);
          return {view:Sensory.view(),same:JSON.stringify(pose)===JSON.stringify([S.x,S.y,S.ang,S.pitch,S.floorY]),
            uniform:GLR.postMat.uniforms.uWarp.value,labels:!!document.getElementById('sanfeel')||!!document.getElementById('campuspressure')||!!document.body.dataset.san};
        }""")
        self.assertEqual(v['view']['warp'],0);self.assertEqual(v['uniform'],0)
        self.assertTrue(v['same']);self.assertFalse(v['labels'])

    def test_caption_fits_small_mobile_landscape_and_large_text(self):
        p=self.game(True)
        for width,height in [(320,640),(390,844),(844,390)]:
            with self.subTest(width=width,height=height):
                p.set_viewport_size(dict(width=width,height=height))
                p.evaluate("useTouchInput();updateTouchUI();SET.soundCaptions=1;Settings.comfort('textSize',150);SoundCaptions.reset();SoundCaptions.publish('step.tile',{patrol:true,place:{pan:-.9,behind:true,m:12,muffled:true}});SoundCaptions.publish('event.thunder',{})")
                r=p.locator('#soundcaptions').bounding_box()
                self.assertGreaterEqual(r['x'],0);self.assertLessEqual(r['x']+r['width'],width)
                self.assertGreaterEqual(r['y'],0);self.assertLess(r['y']+r['height'],height*.55)
                self.assertEqual(p.locator('#soundcaptions div').count(),2)
                self.assertLess(r['y']+r['height'],height/2-4,'字幕不能盖住准星')

    def test_phone_at_full_health_does_not_claim_recovery_or_heat(self):
        p=self.game()
        v=p.evaluate("""()=>{S.san=100;PHONE.cool=0;PHONE.score=4;PHONE.end();let full=PHONE.msg;PHONE.end();return {full,hot:PHONE.msg,san:S.san};}""")
        self.assertNotIn('清楚',v['full']);self.assertNotIn('发烫',v['full']);self.assertIn('发烫',v['hot']);self.assertEqual(v['san'],100)

    def test_real_hazard_and_scene_change_cancel_scheduled_scare(self):
        p=self.game()
        v=p.evaluate("""()=>{
          RT.age=120;RT.runSeconds=120;S.tsec=700;S.day=2;
          const age=gameAge;gameAge=()=>120;Dread.allow=()=>true;
          const first=SensoryScenes.lamp();AN.active=true;SensoryScenes.frame(.1);const cancelled=!SensoryScenes.state();
          AN.active=false;const second=SensoryScenes.lamp();GameModules.emit('leaveRoom','teach1','teach2');
          gameAge=age;return {first,cancelled,second,left:!SensoryScenes.state()};
        }""")
        self.assertEqual(v,dict(first=True,cancelled=True,second=True,left=True))

    def test_results_hide_precise_state_without_changing_legacy_score(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const m=DebugArchiveTab.sampleMeta('C','car','easy');
          m.san={end:37,min:8};m.score=ScoreRules.total([
            {cat:'应对 · 异象',text:'化解异象',pts:20},
            {cat:'校规与巡察',text:'检查合规',pts:15}],
            {ending:true,diff:'easy',san:37,minSan:8,explore:{pct:20}});
          const before=JSON.stringify(m);ResultsUI.open(m,{silent:true});
          const root=document.getElementById('rsBody'),text=root.textContent;
          const sum=Array.from(root.querySelectorAll('details summary b')).reduce((n,b)=>n+Number(b.textContent),0);
          return {text,sum,expected:m.score.sum,unchanged:before===JSON.stringify(m),sections:root.querySelectorAll('details').length};
        }""")
        self.assertNotRegex(v['text'],r'SAN|呼吸平稳|有点不适|精神恍惚')
        self.assertIn('生存经历',v['text'])
        self.assertEqual(v['sum'],v['expected']);self.assertTrue(v['unchanged']);self.assertGreater(v['sections'],1)

    def test_reopening_door_cancels_its_delayed_response(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const R=INTERIORS.teach1,[c,r]=ClassroomLayout.doors(ClassroomLayout.ownSeat.classId)[0];
          const x=R.ox+(c+.5)*R.tw,y=R.oy+(r+.5)*R.th;
          doEnterRoom(R.id,{x,y:y+14,ang:-Math.PI/2});
          gameAge=()=>120;Dread.allow=()=>true;SoundPlayer.play=()=>null;
          const key=doorKeyAt(R,c,r);OPENDOORS[key]=1;roomDoorRefresh(R,c,r);
          PresentationRandom.seed(1);tryInteract();const queued=SensoryScenes.state(),closed=!OPENDOORS[key];
          tryInteract();const reopened=!!OPENDOORS[key],cancelled=!SensoryScenes.state();
          return {queued:queued&&queued.kind,closed,reopened,cancelled};
        }""")
        self.assertEqual(v,dict(queued='door',closed=True,reopened=True,cancelled=True))

    def test_patrol_steps_keep_wet_layers_and_observed_direction(self):
        p=self.game()
        v=p.evaluate("""()=>{
          S.mode='out';S.room=null;S.x=1580;S.y=1800;AN.active=true;AN.id='rain';underCover=()=>false;
          const calls=[];SoundPlayer.play=(id,opt)=>{calls.push({id,opt});return null;};
          SoundCaptions.reset();SFX.patStep(-.5,.7,true,false,{m:12,muffled:true});
          return {calls,caption:document.getElementById('soundcaptions').textContent};
        }""")
        self.assertIn('step.wet',[x['id'] for x in v['calls']])
        step=v['calls'][0]['opt']
        self.assertAlmostEqual(step['lp'],.35*.55)
        self.assertTrue(step['patrol']);self.assertIn('左',v['caption']);self.assertIn('隔着墙',v['caption'])

    def test_bell_caption_runs_without_ambient_nodes_or_audio_output(self):
        p=self.game()
        v=p.evaluate("""()=>{
          AMB_ON=false;SET.vol=0;SET.soundCaptions=0;SoundCaptions.reset();
          GameModules.emit('boundary','test');S.tsec=539.5;SFX.tick(.1);
          S.tsec=540.2;SFX.tick(.1);const text=document.getElementById('soundcaptions').textContent;
          SoundCaptions.reset();SFX.tick(.1);const repeated=SoundCaptions.events().length;
          PAUSE.on=true;S.tsec=585.2;SFX.tick(.1);const paused=SoundCaptions.events().length;
          return {text,repeated,paused};
        }""")
        self.assertIn('上课铃',v['text']);self.assertEqual((v['repeated'],v['paused']),(0,0))
