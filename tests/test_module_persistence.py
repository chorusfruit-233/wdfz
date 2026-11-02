"""Mod 停用、初始化失败和回调异常时不能破坏本局存档。"""
import json
from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ModulePersistenceTest(unittest.TestCase):
    def run_js(self, body):
        node = shutil.which('node')
        if not node:
            self.skipTest('需要 node')
        script = """
const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('game3d/js/modules.js','utf8'));
""" + body
        result = subprocess.run([node, '-e', script], cwd=ROOT, check=True, capture_output=True, text=True)
        return json.loads(result.stdout)

    def test_failed_init_unregisters_declared_and_api_persistence(self):
        result = self.run_js("""
let calls=[];
function spec(){return {save(){calls.push('save');return {}},load(){calls.push('load')},reset(){calls.push('reset')}}}
GameModules.mod({id:'declared',persist:spec(),init(){throw Error('failed')}});
GameModules.mod({id:'api-store',init(api){api.store(spec());throw Error('failed')}});
GameModules.loadAll({'mod:declared':{progress:4},'mod:api-store':{progress:7}});
const saved=GameModules.saveAll();GameModules.resetAll();
console.log(JSON.stringify({calls,saved,status:GameModules.mods().map(m=>m.status)}));
""")
        self.assertEqual(result['calls'], [])
        self.assertEqual(result['status'], ['failed', 'failed'])
        self.assertEqual(result['saved'], {'mod:declared': {'progress': 4}, 'mod:api-store': {'progress': 7}})

    def test_temporarily_unloaded_data_survives_saving_and_reenable(self):
        result = self.run_js("""
const source={'mod:counter':{value:7}};
GameModules.loadAll(source);source['mod:counter'].value=99;
const safeSave=GameModules.saveAll();
safeSave['mod:counter'].value=88;
const preserved=GameModules.saveAll();
let value=0;
GameModules.mod({id:'counter',persist:{save:()=>({value}),load:d=>{value=d.value},reset:()=>{value=0}}});
GameModules.loadAll(preserved);const loaded=value;
value++;const activeSave=GameModules.saveAll();GameModules.resetAll();
console.log(JSON.stringify({loaded,activeSave,newSave:GameModules.saveAll()}));
""")
        self.assertEqual(result['loaded'], 7)
        self.assertEqual(result['activeSave']['mod:counter'], {'value': 8})
        self.assertEqual(result['newSave']['mod:counter'], {'value': 0})

    def test_new_game_discards_unloaded_previous_game_data(self):
        self.assertEqual(self.run_js("""
GameModules.loadAll({'mod:disabled':{value:7}});GameModules.resetAll();
console.log(JSON.stringify(GameModules.saveAll()));
"""), {})

    def test_callback_failure_preserves_last_serializable_state(self):
        result = self.run_js("""
let fail=false;
GameModules.persistent('example',{load(d){d.value=99;throw Error('load failed')},save(){if(fail)throw Error('save failed');return {value:8}}});
GameModules.loadAll({example:{value:7}});fail=true;const before=GameModules.saveAll();
fail=false;GameModules.saveAll();fail=true;const after=GameModules.saveAll();
GameModules.persistent('example',{save(){return undefined}});const cleared=GameModules.saveAll();
console.log(JSON.stringify({before,after,cleared}));
""")
        self.assertEqual(result, {'before': {'example': {'value': 7}}, 'after': {'example': {'value': 8}}, 'cleared': {}})
