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

    # —— R3 SAN 视觉效果重做（计划《电梯直通、新天赋、新结局与恐怖氛围》12.9 第二轮）——
    # 用户 2026-11-04：低 SAN 时画面越扭曲、视野越小、黑屏闪烁、视野模糊
    def test_san_visual_channels_follow_body_and_comfort_settings(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const R=SensoryRules,bodies=[60,45,30,22,8].map(s=>R.target(s)),
            keys=['warp','tunnel','blur','focus','drain','halo','pulseK','ghostMax','flickerK'];
          const at=o=>bodies.map(b=>{const x=R.view(b,Object.assign({time:1},o));return Object.fromEntries(keys.map(k=>[k,x[k]]));});
          return {std:at({distortion:2}),half:at({distortion:1}),off:at({distortion:0}),soft:at({distortion:2,reduceFlash:1}),
            threat:at({distortion:2,threat:true}),take:at({distortion:2,takeover:true})};
        }""")
        std,half,off,soft,threat,take=v['std'],v['half'],v['off'],v['soft'],v['threat'],v['take']
        for k in ('tunnel','blur','drain','halo'):
            seq=[x[k] for x in std]
            # 静态通道（视野变小、模糊、失色、灯晕）SAN ≥ 60 为 0，往下单调变强
            self.assertEqual(seq[0],0,k);self.assertTrue(all(a<b for a,b in zip(seq,seq[1:])),(k,seq))
            # 不跟「视野扭曲」设置：关掉晃动、关掉声音也看得出状态
            self.assertEqual([x[k] for x in off],seq,k);self.assertEqual([x[k] for x in half],seq,k)
        warp=[x['warp'] for x in std]
        self.assertTrue(all(a<b for a,b in zip(warp,warp[1:])),warp)
        for k in ('warp','focus','pulseK','ghostMax'):
            # 动态通道（扭曲、对不上焦、心跳收缩、重影）跟「视野扭曲」：减弱 35%，关闭为 0
            for a,b,c in zip(off,half,std):
                self.assertEqual(a[k],0,k);self.assertAlmostEqual(b[k],c[k]*.35,9)
        # 黑屏闪烁：SAN 约 39 以上没有，往下变强；不跟「视野扭曲」，跟「减少闪光」（最多一半）
        flick=[x['flickerK'] for x in std]
        self.assertEqual(flick[:2],[0,0]);self.assertTrue(0<flick[2]<flick[3]<=flick[4]==1,flick)
        self.assertEqual([x['flickerK'] for x in off],flick)
        for a,b in zip(soft,std):self.assertAlmostEqual(a['flickerK'],b['flickerK']*.5,9)
        # 心跳收缩只在有心跳声的档位（身体强度 > 0.35）
        self.assertEqual([x['pulseK'] for x in std],[0,0,1,1,1])
        # 真实危险时都减到 35%，接管（手机、过场、驾驶……）时全为 0
        for a,b in zip(threat,std):
            for k in a:self.assertAlmostEqual(a[k],b[k]*.35,9)
        self.assertTrue(all(x[k]==0 for x in take for k in x),take)

    def test_heartbeat_and_breath_on_screen_match_their_sounds(self):
        p=self.game()
        v=p.evaluate("""()=>{
          S.san=8;SET.distortion=2;Sensory.reset();
          const heard=[],orig=SFX.bodySound;SFX.bodySound=kind=>{heard.push(kind);return null;};
          const rows=[];
          for(let i=0;i<380;i++){heard.length=0;Sensory.frame(1/60);const s=Sensory.view();
            rows.push({heart:heard.includes('heart'),breath:heard.includes('breath'),pulse:s.pulse,inhale:s.inhale});}
          SFX.bodySound=orig;render(1/60);
          const u=GLR.postMat.uniforms,s=Sensory.view(),L=SOUND_BANK['threat.breath'].layers[0];
          return {rows,atk:L.atk,dur:L.dur,wired:[u.uPulse.value===s.pulse,u.uBreath.value===s.inhale,u.uDrain.value===s.drain,
            u.uHalo.value===s.halo,u.uGhost.value===s.ghost,u.uTunnel.value===s.tunnel,u.uBlur.value===s.blur,
            u.uFocus.value===s.focus,u.uBlack.value===s.black,u.uWarp.value===s.warp]};
        }""")
        rows=v['rows'];hearts=[i for i,r in enumerate(rows) if r['heart']];breaths=[i for i,r in enumerate(rows) if r['breath']]
        self.assertGreaterEqual(len(hearts),10);self.assertEqual(len(breaths),2)
        peak=max(r['pulse'] for r in rows);self.assertAlmostEqual(peak,1,9)
        for i in hearts:
            # 心跳声响起的那一帧，视野收得最紧；0.2 秒后已经放开
            self.assertAlmostEqual(rows[i]['pulse'],peak,9)
            if i+12<len(rows):
                self.assertFalse(any(rows[j]['heart'] for j in range(i+1,i+13)))
                self.assertLess(rows[i+12]['pulse'],.4*peak)
        for i in breaths:
            # 画面和呼吸声同时起，呼吸声最响（起音结束）时压得最深，声音落完时回来
            seg=[r['inhale'] for r in rows[i:i+int(v['dur']*60)+12]]
            top=max(range(len(seg)),key=lambda k:seg[k])
            self.assertEqual(seg[0],0);self.assertAlmostEqual(seg[top],1,6)
            self.assertLessEqual(abs(top/60-v['atk']),1/60+1e-9)
            self.assertEqual(seg[-1],0)
        self.assertTrue(all(v['wired']),v['wired'])

    def test_blackouts_are_brief_spaced_and_respect_reduce_flash(self):
        p=self.game()
        v=p.evaluate("""()=>{
          let draws=0;GameRandom.bind(()=>{draws++;return .5});SoundPlayer.play=()=>null;
          const before=JSON.stringify([S,RT,PAT]);
          function run(san,o,secs){
            S.san=san;SET.distortion=o.dist===undefined?2:o.dist;SET.reduceFlash=o.soft?1:0;AN.active=!!o.threat;Sensory.reset();
            const xs=[];for(let i=0;i<secs*60;i++){Sensory.frame(1/60);xs.push(Sensory.view().black);}
            AN.active=false;return xs;
          }
          const out={low:run(8,{},120),off:run(8,{dist:0},60),mid:run(30,{},60),high:run(45,{},60),soft:run(8,{soft:1},90),threat:run(8,{threat:1},60)};
          S.san=100;SET.reduceFlash=0;SET.distortion=2;Sensory.reset();
          out.draws=draws;out.unchanged=JSON.stringify([S,RT,PAT])===before;
          return out;
        }""")
        low=v['low']
        dark=[x>=.5 for x in low]
        starts=[i for i in range(1,len(dark)) if dark[i] and not dark[i-1]]
        events=[];last=-999
        for i in starts:
            if i-last>18:events.append([i])
            else:events[-1].append(i)
            last=i
        # 很低时（SAN 8）两分钟里黑十来次；开局、读档后头 6 秒不黑
        self.assertGreaterEqual(len(events),10,len(events));self.assertGreaterEqual(starts[0],6*60-1)
        # 一次最多两下，两次之间至少 2.5 秒；任意一秒内暗下去不超过 3 次（不是持续频闪）
        self.assertTrue(all(len(e)<=2 for e in events))
        self.assertGreaterEqual(min(b[0]-a[-1] for a,b in zip(events,events[1:])),int(2.5*60))
        self.assertLessEqual(max(sum(1 for s in starts if w<=s<w+60) for w in range(len(low))),3)
        runs=[];n=0
        for x in low+[0]:
            if x>=.999:n+=1
            elif n:runs.append(n);n=0
        self.assertLessEqual(max(runs),37)                     # 最长的一次「眼前一黑」全黑不超过 0.6 秒，再用 0.4 秒亮回来
        self.assertEqual(max(low),1)
        # 不跟「视野扭曲」；SAN 30 时只暗六成；SAN 45 没有
        self.assertEqual(max(v['off']),1)
        self.assertTrue(0<max(v['mid'])<=.6+1e-9,max(v['mid']));self.assertEqual(max(v['high']),0)
        # 「减少闪光」：最多压暗一半，而且慢慢暗、慢慢亮，没有硬切
        soft=v['soft'];self.assertTrue(0<max(soft)<=.5,max(soft))
        self.assertLess(max(abs(a-b) for a,b in zip(soft,soft[1:])),.08)
        # 真实危险时减到 35%
        self.assertTrue(0<max(v['threat'])<=.35+1e-9,max(v['threat']))
        # 只是表现：不抽玩法随机，不改状态
        self.assertEqual(v['draws'],0);self.assertTrue(v['unchanged'])

    def test_screen_closes_in_blurs_drains_and_warps_with_san(self):
        p=self.game()
        v=p.evaluate("""()=>{
          const R=INTERIORS.teach1,L=ClassroomLayout,u=GLR.postMat.uniforms,r=GLR.renderer;
          const W=GLR.rt.width,H=GLR.rt.height,out=ThreeBackend.target(W,H,{depthBuffer:false}),buf=new Uint8Array(W*H*4);
          function place(){S.mode='in';S.room='teach1';S.seated=false;S.x=R.ox+(L.spans[3][1]-0.4)*R.tw;S.y=R.oy+(L.mid+1.5)*R.th;S.ang=Math.PI;S.pitch=-.04;}
          function post(){r.setRenderTarget(out);r.render(GLR.postScene,GLR.postCam);r.readRenderTargetPixels(out,0,0,W,H,buf);r.setRenderTarget(null);return buf.slice();}
          function shot(san,dist){SET.distortion=dist;S.san=san;Sensory.reset();Sensory.frame(1/60);place();syncCamera(0);render(0);u.uGrain.value=0;return post();}
          function stats(b){
            let sat=0,n=0,inner=0,ni=0,outer=0,no=0,sharp=0,ns=0;
            const lum=i=>.2126*b[i]+.7152*b[i+1]+.0722*b[i+2];
            for(let y=0;y<H-1;y+=2)for(let x=0;x<W-1;x+=2){
              const i=(y*W+x)*4,mx=Math.max(b[i],b[i+1],b[i+2]),mn=Math.min(b[i],b[i+1],b[i+2]),l=lum(i);
              sat+=mx>10?(mx-mn)/mx:0;n++;
              const dx=Math.abs((x+.5)/W-.5),dy=Math.abs((y+.5)/H-.5);
              if(dx<.2&&dy<.2){inner+=l;ni++;sharp+=Math.abs(l-lum(i+4))+Math.abs(l-lum(i+W*4));ns++;}
              else if(Math.max(dx,dy)>.38){outer+=l;no++;}
            }
            return {sat:sat/n,ratio:(outer/no)/(inner/ni),sharp:sharp/ns};
          }
          const levels=[100,45,30,22,8].map(s=>stats(shot(s,0)));
          // 扭曲：只开扭曲，同一帧画面在两个时刻比——外圈在流动，准星一小圈不动；关掉扭曲则完全不动
          shot(8,2);['uTunnel','uBlur','uFocus','uDrain','uHalo','uGhost','uBlack','uPulse','uBreath','uGrain'].forEach(k=>u[k].value=0);
          function moved(){u.uTime.value=1;const a=post();u.uTime.value=3.7;const b=post();let c=0,cn=0,o=0,on=0;
            for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,rr=Math.hypot((x+.5-W/2)/H,(y+.5-H/2)/H);
              const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
              if(rr<.02){c+=d;cn++;}else if(rr>.25&&rr<.45){o+=d;on++;}}
            return {center:c/cn,ring:o/on};}
          const warped=moved();u.uWarp.value=0;const still=moved();
          out.dispose();
          return {levels,warped,still};
        }""")
        lv=v['levels'];sat=[x['sat'] for x in lv];ratio=[x['ratio'] for x in lv];sharp=[x['sharp'] for x in lv]
        # 同一机位（扭曲关闭，只看静态通道）：越低颜色越少、外圈越黑（视野越小）、中心越糊
        self.assertTrue(all(a>b for a,b in zip(sat,sat[1:])),sat);self.assertLess(sat[-1],sat[0]*.4,sat)
        self.assertTrue(all(a>b for a,b in zip(ratio,ratio[1:])),ratio);self.assertLess(ratio[-1],ratio[0]*.5,ratio)
        self.assertTrue(all(a>b for a,b in zip(sharp,sharp[1:])),sharp);self.assertLess(sharp[-1],sharp[0]*.75,sharp)
        # 扭曲：外圈明显在流动，准星附近基本不动；关掉扭曲就一动不动
        self.assertGreater(v['warped']['ring'],8,v['warped']);self.assertLess(v['warped']['center'],1,v['warped'])
        self.assertLess(v['still']['ring'],.01,v['still'])
