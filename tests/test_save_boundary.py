"""存档协议独立于浏览器，并保证坏档读取不破坏原始数据。"""
import json
from pathlib import Path
import subprocess
import unittest

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]


class SaveDataTest(unittest.TestCase):
    def node(self, code):
        sources = ['game3d/js/domain/save-data.js', 'game3d/js/adapters/storage.js']
        program = "const assert=require('node:assert/strict');\n" + '\n'.join(
            (ROOT / path).read_text() for path in sources
        ) + '\n' + code
        result = subprocess.run(['node', '-e', program], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_handwritten_legacy_midnight_migrates_once_without_mutating_source(self):
        self.node("""
          const old={v:1,mode:'in',room:'dorm1',x:128,y:256,tsec:10,day:2,
            san:63,viol:17,stam:44,bag:['torch','pill'],hot:['torch',null],
            actCool:{wash:2910},anCool:{rain:1438},rt:{key:true,pressureClock:1450},
            anId:'follow',anT:8.25,anData:{asked:true,chosen:null},anChoiceMs:1234,
            futureExtension:{note:'must survive'},immuneUsed:true};
          const before=JSON.stringify(old),d=SaveData.prepare(old);
          assert.equal(d.tsec,1450);assert.equal(d.clockVersion,2);
          assert.equal(d.actCool.wash,1470);assert.equal(d.anCool.rain,1438);
          assert.equal(d.anT,8.25);assert.equal(d.anChoiceMs,1234);assert.equal(d.immuneUsed,true);
          assert.equal(d.futureExtension.note,'must survive');
          assert.deepEqual(SaveData.prepare(d),d);assert.equal(JSON.stringify(old),before);
          d.rt.key=false;assert.equal(old.rt.key,true);
        """)

    def test_current_event_and_elevator_save_retains_continuous_state(self):
        self.node("""
          const d={v:1,clockVersion:2,mode:'in',room:'lift_teach',x:4,y:9,tsec:850,day:2,
            bag:['key'],hot:['key',null],san:70,viol:20,stam:50,
            anId:'turn',anT:3.5,anAcc:0.7,anNext:17,anPre:'rain',anPreNext:5,anChoiceMs:1800,
            anData:{asked:true,chosen:null,choiceRemaining:1800},anCool:{rain:1900},
            patrol:{state:'warn',room:'lift_teach',t:2,next:7,x:1,y:2,tx:3,ty:4},
            hiding:{c:3,r:5,seen:true,t:2},rt:{elevatorRide:{phase:'moving',target:5,t:2.75},
            pressureClock:2290,pressureSeen:2},custom:{version:9}};
          const copy=SaveData.parse(SaveData.encode(d));
          for(const key of ['anData','patrol','hiding','rt','custom','anCool'])assert.deepEqual(copy[key],d[key]);
          assert.equal(copy.anChoiceMs,1800);assert.equal(copy.anT,3.5);assert.equal(copy.anPreNext,5);
        """)

    def test_invalid_required_fields_rejected_and_optional_collections_normalized(self):
        self.node("""
          const base={v:1,clockVersion:2,mode:'out',x:1,y:2,tsec:700,day:1};
          for(const bad of [null,[],{},Object.assign({},base,{x:NaN}),Object.assign({},base,{day:0}),
            Object.assign({},base,{v:2}),Object.assign({},base,{clockVersion:3}),
            Object.assign({},base,{mode:'in',room:'gone'})]) {
            assert.throws(()=>SaveData.prepare(bad,{rooms:{teach1:{}}}));
          }
          const fixed=SaveData.prepare(Object.assign({},base,{bag:'key',hot:{0:'key'},rt:[],anData:3}));
          assert.deepEqual(fixed.bag,[]);assert.deepEqual(fixed.hot,[null,null]);assert.deepEqual(fixed.rt,{});
          const current=SaveData.prepare(Object.assign({},base,{bag:['torch','missing'],hot:['missing','torch']}),{items:{torch:{}}});
          assert.deepEqual(current.bag,['torch']);assert.deepEqual(current.hot,[null,'torch']);
        """)

    def test_storage_failure_preserves_previous_bytes_and_reports_operation(self):
        self.node("""
          const bytes={save:'original'}, errors=[];
          const backend={getItem:k=>bytes[k]||null,setItem:()=>{throw Error('quota');},removeItem:k=>delete bytes[k]};
          const storage=StorageAdapter.create(()=>backend,e=>errors.push(e));
          assert.equal(storage.write('save','replacement'),false);assert.equal(bytes.save,'original');
          assert.equal(storage.read('save').value,'original');assert.equal(errors[0].operation,'write');
          const denied=StorageAdapter.create(()=>{throw Error('denied');});assert.equal(denied.read('save').ok,false);
          storage.remove('save');assert.equal(storage.read('save').value,null);
        """)


class SaveBoundaryBrowserTest(BrowserCase):
    def test_bad_save_never_resets_current_game_or_overwrites_original_bytes(self):
        page = self.page()
        page.evaluate("saveGame();window.beforeGame=JSON.stringify(S)")
        for raw in ['{bad', '[]', '{}', json.dumps(dict(v=99, x=1, y=2, tsec=700, day=1))]:
            page.evaluate("raw=>localStorage.setItem('wdfz3d',raw)", raw)
            page.evaluate("Game.continue_()")
            self.assertEqual(page.evaluate("localStorage.getItem('wdfz3d')"), raw)
            self.assert_js(page, "JSON.stringify(S)===beforeGame&&loadGame()===null&&!!SAVE_DIAGNOSTIC")

    def test_apply_save_does_not_reuse_input_objects_or_change_presentation(self):
        page = self.page()
        page.evaluate("""S.bag=['torch'];USE.torch=true;saveGame();window.snapshot=loadGame();
          window.savedBytes=JSON.stringify(snapshot);window.torchCalls=0;window.oldTorch=Engine.torch;
          Engine.torch=()=>{torchCalls++};VisualState.patrolRed=.37;
          applySave(snapshot);
        """)
        self.assert_js(page, "torchCalls===0&&VisualState.patrolRed===.37&&USE.torch&&JSON.stringify(snapshot)===savedBytes")
        page.evaluate("RT.key=true;AN.cool.test=42;S.bag.push('pill')")
        self.assert_js(page, "JSON.stringify(snapshot)===savedBytes")
        page.evaluate("restoreSavePresentation();Engine.torch=oldTorch")
        self.assert_js(page, "torchCalls===1&&VisualState.patrolRed===0")

    def test_invalid_direct_restore_rejects_before_writing_game_state(self):
        page = self.page()
        self.assert_js(page, "(()=>{const before=JSON.stringify(S);try{applySave({x:1,y:2,tsec:NaN});return false;}catch(e){return JSON.stringify(S)===before;}})()")
