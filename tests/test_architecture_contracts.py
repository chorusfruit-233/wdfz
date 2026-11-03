"""私有模块、无模型玩法与渲染隔离的浏览器回归。"""
from browser_case import BrowserCase


class ArchitectureBrowserTest(BrowserCase):
    def test_render_and_audio_do_not_consume_gameplay_random(self):
        page = self.page()
        result = page.evaluate("""()=>{
          doEnterRoom('teach1');running=false;S.screen='play';S.intro=0;AN.next=1000;
          let draws=0;GameRandom.bind(()=>{draws++;return .5;});
          const state=JSON.stringify([S,RT,AN,PAT]);
          for(let i=0;i<20;i++){render(.016);ncUpdate(.016);}
          SFX.resume();SFX.click();SFX.patStep(.2,.8,true,true);handTex('不要回头');
          return {draws,same:JSON.stringify([S,RT,AN,PAT])===state};
        }""")
        self.assertEqual(result, {'draws': 0, 'same': True})

    def test_classmate_pressure_and_door_block_survive_missing_meshes(self):
        page = self.page()
        result = page.evaluate("""()=>{
          doEnterRoom('teach1');running=false;S.screen='play';S.san=80;S.viol=95;
          Classmates.tick();let keys=Object.keys(Classmates.layout(INTERIORS.teach1).occupied);
          ncClear();ncPressureTick(2);
          const blocked=Classmates.blocked('teach1'),san=S.san;
          const seat=keys[0].split(',').map(Number),occupied=ncOccupied(seat[0],seat[1]);
          S.viol=0;Classmates.tick();
          return {blocked,san,occupied,cleared:!Classmates.blocked('teach1')};
        }""")
        self.assertEqual(result, {'blocked': True, 'san': 79.76, 'occupied': True, 'cleared': True})

    def test_inspection_cooldown_and_save_do_not_require_figures(self):
        page = self.page()
        result = page.evaluate("""()=>{
          doEnterRoom('teach1');running=false;S.screen='play';S.san=80;S.tsec=770;
          Inspection.start({day:S.day,slot:0});Inspection.clearFx();
          Inspection.finish(Inspection.state().current);const started=Inspection.pending();
          saveGame();const saved=loadGame().rt.inspection.scatter;
          Inspection.tick(.4);const middle=Inspection.pending();
          Inspection.tick(.5);return {started,middle,done:!Inspection.pending(),saved:saved.duration};
        }""")
        self.assertEqual(result, {'started': True, 'middle': True, 'done': True, 'saved': .8})

    def test_all_room_collision_recipes_match_rendering_capture(self):
        page = self.page()
        result = page.evaluate("""()=>{
          let bad=[];for(const room of Object.values(INTERIORS)){
            if(room.build)continue;
            const draft=Object.assign({},room),kit=new Kit();buildRoomRecipe(draft,kit,{});
            const fields=['foot','stairExtra','propExtra','stats'];
            for(const name of fields)if(JSON.stringify(draft[name])!==JSON.stringify(room[name]))bad.push(room.id+':'+name);
          }return bad;
        }""")
        self.assertEqual(result, [])

    def test_legacy_state_facade_and_live_ports_share_one_authority(self):
        page = self.page()
        result = page.evaluate("""()=>{
          const prior=RT,copy=newRT();RT=copy;copy.pressureClock=2800;
          let read=CampusPressure.current().clock===2800;RT=prior;
          const files=GameModules.dependencies();
          return {read,verified:GameModules.verify(),missing:files.filter(f=>!f.linked&&GameModules.module(f.module)).map(f=>f.file)};
        }""")
        self.assertEqual(result, {'read': True, 'verified': True, 'missing': []})

    def test_rendering_every_scene_preserves_game_state(self):
        page = self.page()
        result = page.evaluate("""()=>{
          let bad=[];for(const id of Object.keys(INTERIORS)){
            doEnterRoom(id);running=false;S.screen='play';S.intro=0;AN.active=false;AN.next=1000;
            const before=JSON.stringify([S,RT,AN,PAT]);
            let draws=0;GameRandom.bind(()=>{draws++;return .5;});
            render(.016);render(.016);
            if(JSON.stringify([S,RT,AN,PAT])!==before||draws)bad.push({id,draws});
          }return {bad,errors:GameModules.errors()};
        }""")
        self.assertEqual(result, {'bad': [], 'errors': []})
