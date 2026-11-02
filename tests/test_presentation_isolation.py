"""Presentation owns camera and staged scenery, never the saved player state."""
from browser_case import BrowserCase


class PresentationIsolationTest(BrowserCase):
    def test_camera_interpolation_is_owned_by_presentation(self):
        page = self.page()
        result = page.evaluate("""() => {
          Engine.resetCamera();S.moving=true;S.run=true;S.seated=false;
          const before=JSON.stringify(S);
          for(let i=0;i<90;i++)syncCamera(1/60);
          const advanced=VisualState.camera.walkPhase>1&&VisualState.camera.fov>80;
          const same=JSON.stringify(S)===before;
          Engine.resetCamera();
          return {same,advanced,reset:VisualState.camera.walkPhase===0&&VisualState.camera.fov===72&&VisualState.camera.eyeH===EYE};
        }""")
        self.assertEqual(result, {'same': True, 'advanced': True, 'reset': True})

    def test_real_and_preview_death_effects_do_not_write_player_state(self):
        page = self.page()
        result = page.evaluate("""() => {
          S.ang=.32;S.pitch=.18;S.eyeLift=.07;S.deathView={ang:S.ang,pitch:S.pitch,eyeLift:S.eyeLift};
          let changed=[];
          for(const preview of [true,false])for(const row of DEV_DEATH){
            const id=row[1],before=JSON.stringify(S);
            deathFX(id,{preview});
            for(let n=1;n<=4;n++)anfxUpdate(DeathTimeline.duration(id)/5);
            anfxClear();
            if(JSON.stringify(S)!==before)changed.push({id,preview});
          }
          return changed;
        }""")
        self.assertEqual(result, [])

    def test_outdoor_ending_stage_preserves_world_and_collision(self):
        page = self.page()
        result = page.evaluate("""() => {
          doEnterRoom('garage1');CUT.enabled=true;
          function state(){return JSON.stringify({mode:S.mode,room:S.room,x:S.x,y:S.y,ang:S.ang,san:S.san,rt:RT});}
          let out=[];
          for(const id of ['car','face']){
            const before=state(),solid=OUT_SOLID,lamps=OUT_LAMPS,room=GLR.roomMesh,nc=NC.grp;
            let done=0;playCut(id,()=>{done++;S.screen='play';});
            cutTick(4);
            const staged=!!VisualState.stage&&Engine.sceneView().mode==='out'&&!lightState().indoor;
            const untouched=state()===before&&solid===OUT_SOLID&&lamps===OUT_LAMPS&&GLR.roomMesh===room&&NC.grp===nc;
            cutSkip();cutSkip();
            out.push({id,staged,untouched,restored:!VisualState.stage&&room.visible&&lightState().indoor,done});
          }
          return out;
        }""")
        self.assertEqual(result, [
            {'id': 'car', 'staged': True, 'untouched': True, 'restored': True, 'done': 1},
            {'id': 'face', 'staged': True, 'untouched': True, 'restored': True, 'done': 1},
        ])

    def test_replacing_preview_disposes_it_once_without_disposing_real_death(self):
        page = self.page()
        result = page.evaluate("""() => {
          deathFX('grip',{preview:true});DEV.previewFx=ANFX.grp;
          const preview=ANFX.grp,old=ThreeBackend.disposeGroup;let disposed=0;
          ThreeBackend.disposeGroup=function(g){if(g===preview)disposed++;return old(g);};
          deathFX('neck');const real=ANFX.grp;Dev.clearPreview();
          const realKept=ANFX.grp===real&&real.parent===GLR.scene;
          anfxClear();ThreeBackend.disposeGroup=old;
          return {disposed,realKept};
        }""")
        self.assertEqual(result, {'disposed': 1, 'realKept': True})

    def test_stage_draw_keeps_old_scene_enemies_hidden(self):
        page = self.page()
        result = page.evaluate("""() => {
          doEnterRoom('garage1');CUT.enabled=true;playCut('car',()=>{});cutTick(4);
          ROAM.on=true;ROAM.x=S.x;ROAM.y=S.y;
          PAT.state='walk';PAT.room='garage1';PAT.x=S.x;PAT.y=S.y;patAddFig();
          Engine.draw(.016);
          const hidden=(!GLR.roamFig||!GLR.roamFig.visible)&&!GLR.patFig.visible;
          patReset();cutSkip();return hidden;
        }""")
        self.assertTrue(result)

    def test_car_stage_handoff_starts_the_real_driving_session_once(self):
        page = self.page()
        result = page.evaluate("""() => {
          doEnterRoom('garage1');CUT.enabled=true;
          let done=0;playCut('car',()=>{done++;CarChase.start();});cutTick(4);
          const inGarage=S.mode==='in'&&S.room==='garage1';cutSkip();cutSkip();
          return {inGarage,done,driving:CarChase.active()&&S.mode==='out'&&S.screen==='play',stageCleared:!VisualState.stage};
        }""")
        self.assertEqual(result, {'inGarage': True, 'done': 1, 'driving': True, 'stageCleared': True})

    def test_stage_quality_rebuild_preserves_player_and_returns_to_room(self):
        page = self.page()
        page.evaluate("""doEnterRoom('garage1');CUT.enabled=true;window.beforeStage=JSON.stringify(S);
          playCut('face',()=>{S.screen='play';});""")
        self.set_quality(page, 1)
        self.assert_js(page, "VisualState.stage&&Engine.sceneView().mode==='out'&&S.mode==='in'&&S.room==='garage1'")
        page.evaluate("cutSkip();syncCamera(0)")
        self.assert_js(page, "!VisualState.stage&&GLR.roomMesh.visible&&JSON.stringify(S)===beforeStage")

    def test_failed_stage_setup_is_reported_and_cleaned_before_handoff(self):
        page = self.page()
        result = page.evaluate("""() => {
          doEnterRoom('garage1');CUT.enabled=true;
          const original=CUT_DEF.face.setup;let done=0;
          CUT_DEF.face.setup=function(){Engine.beginOutsideStage();throw new Error('stage fixture');};
          try{playCut('face',()=>{done++;S.screen='play';});}
          finally{CUT_DEF.face.setup=original;}
          cutSkip();
          return {done,clean:!CUT.on&&!VisualState.stage&&GLR.roomMesh.visible,
            reported:Lifecycle.snapshot().errors.some(x=>x.module==='cutscene.setup:face'&&x.message==='stage fixture')};
        }""")
        self.assertEqual(result, {'done': 1, 'clean': True, 'reported': True})
