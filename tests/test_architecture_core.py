"""模块接线、无渲染空间、模拟收尾与随机流的行为边界。"""
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ArchitectureCoreTest(unittest.TestCase):
    def js(self, source):
        result = subprocess.run(['node', '-e', "const assert=require('node:assert/strict');\n" + source], cwd=ROOT,
                                capture_output=True, text=True, timeout=40)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_separate_random_sources_are_reproducible_and_replaceable(self):
        self.js("""
const {RandomRules,GameRandom,PresentationRandom}=require('./game3d/js/domain/random.js');
const world=RandomRules.create(912),expected=RandomRules.create(912);GameRandom.bind(world.next);
for(let i=0;i<100;i++){
 PresentationRandom.seed(i);for(let j=0;j<100;j++)PresentationRandom.next();
 assert.equal(GameRandom.next(),expected.next());
}
const saved=world.snapshot(),value=world.next();world.restore(saved);assert.equal(world.next(),value);
GameRandom.bind(()=>.125);assert.equal(GameRandom.next(),.125);
assert.throws(()=>GameRandom.bind(null));
""")

    def test_optional_ambient_sound_uses_only_presentation_random(self):
        self.js("""
const {context,load}=require('./tests/support/capsules.cjs');
const {PresentationRandom}=require('./game3d/js/domain/random.js');
let scape,played=[],draws=0;
const c=context({PresentationRandom,GameRandom:{next:()=>{draws++;return .5;}},
 GameModules:{on:()=>{}},SFX:{scape:(_name,def)=>scape=def},SoundPlayer:{play:id=>played.push(id)}});
load('game3d/js/modules/void-maze/maze-sound.js',c);
const node=()=>({gain:{value:0},frequency:{value:0},Q:{value:0},connect:()=>{},start:()=>{}});
const api={ctx:()=>({createGain:node,createOscillator:node,createBiquadFilter:node}),master:node,reverb:node,
 loopNoise:()=>({g:node(),f:node()})};
const instance=scape.build(api);assert.ok(instance.nextPing>=5&&instance.nextPing<=11);
for(let i=0;i<20;i++)scape.tick(30,api,instance);
assert.ok(played.includes('void.ping')&&played.includes('void.moan'));assert.equal(draws,0);
""")

    def test_pipeline_always_settles_started_steps_once(self):
        self.js("""
const Pipeline=require('./game3d/js/domain/step-pipeline.js');
for(const mode of ['normal','death','failure']){
 let log=[],p=Pipeline.create({begin:()=>log.push('begin'),finish:()=>log.push('finish')});
 p.use('hazard',()=>{log.push('hazard');if(mode==='death')return Pipeline.STOP;if(mode==='failure')throw Error('hazard failure');});
 p.use('recovery',()=>log.push('recovery'));
 if(mode==='failure')assert.throws(()=>p.run(.1),/hazard failure/);else p.run(.1);
 assert.deepEqual(log,mode==='normal'?['begin','hazard','recovery','finish']:['begin','hazard','finish']);
 assert.throws(()=>p.use('late',()=>{}));
}
let p=Pipeline.create({begin:()=>{throw Error('not started');},finish:()=>assert.fail('not started')});
assert.throws(()=>p.run(.1),/not started/);
""")

    def test_world_collision_is_available_without_dom_webgl_or_assets_loader(self):
        self.js("""
const {context,load}=require('./tests/support/capsules.cjs');
let draws=0;const c=context({console,Quality:{get:()=>({lod:1,lodLow:false,segments:1})},QUALITY:2,
  S:{mode:'in',room:'teach1'},RT:{runSeed:0},GameModules:{emit:()=>{},on:()=>{}}});
const files=['domain/random','core','quality','domain/spatial-kit','domain/spatial-math','map',
 'content/collision-assets','content/palette','content/spiral-data','content/scene-data',
 'content/props-recipe','content/furniture-recipe','content/room-recipe','content/outdoor-recipe',
 'content/sports-recipe','content/spiral-recipe','content/elevator-prefab-recipe','content/lift-recipe',
 'app/space-layout','app/classmates','world','collision'];
for(const f of files)load('game3d/js/'+f+'.js',c);
c.GameRandom.bind(()=>{draws++;return .5;});
c.buildInteriorData();c.buildRoomBounds();
assert.ok(Object.keys(c.INTERIORS).length>=30);assert.ok(c.OUT_SOLID.length>200);
assert.ok(Object.keys(c.INTERIORS.teach1.foot).length>30);
let room=c.INTERIORS.teach1;assert.equal(c.Collision.depth(room.ox,room.oy,3,room),Infinity);
const solid=c.OUT_SOLID,before=JSON.stringify(c.S);c.SpaceLayout.ensureOutside();
assert.equal(c.OUT_SOLID,solid);assert.equal(JSON.stringify(c.S),before);assert.equal(draws,0);
for(const name of ['document','window','THREE','GLR','Assets'])assert.equal(c[name],undefined,name);
""")

    def test_loader_links_live_ports_and_rejects_unauthorized_replacement(self):
        self.js("""
const fs=require('fs'),vm=require('vm'),c=vm.createContext({console});
vm.runInContext(fs.readFileSync('game3d/js/modules.js','utf8'),c);const G=c.GameModules;
G.configureContracts([{file:'owner',provides:['State'],imports:{}},{file:'reader',provides:[],imports:{State:'owner'}}]);
let state={value:1};G.publish('owner',{State:{get:()=>state,set:v=>{state=v;}}});
const ports=G.imports('reader');assert.equal(ports.State.value,1);state={value:2};assert.equal(ports.State.value,2);
assert.throws(()=>{ports.State={value:9};},/未授权/);
assert.throws(()=>G.publish('owner',{}),/重复/);assert.throws(()=>G.imports('missing'),/未声明/);
assert.throws(()=>G.configureContracts([{file:'reader'}]),/重复/);
""")

    def test_presentation_ports_reject_nested_state_writes(self):
        self.js("""
const fs=require('fs'),vm=require('vm'),c=vm.createContext({console});
vm.runInContext(fs.readFileSync('game3d/js/modules.js','utf8'),c);const G=c.GameModules;
G.configureContracts([{file:'owner',provides:['S'],imports:{}},{file:'view',provides:[],imports:{S:'owner'},readonly:['S']}]);
let state={bag:['key'],pos:{x:1}};G.publish('owner',{S:{get:()=>state,set:v=>state=v}});
const view=G.imports('view').S;assert.equal(view.pos.x,1);assert.equal(view.pos,view.pos);
assert.throws(()=>{view.pos.x=2;},/表现层/);assert.throws(()=>view.bag.push('extra'),/表现层/);
assert.throws(()=>{delete view.pos;},/表现层/);assert.deepEqual(state,{bag:['key'],pos:{x:1}});
state.pos.x=3;assert.equal(view.pos.x,3);
""")

    def test_driving_rules_work_without_ui_and_keep_failure_checkpoints(self):
        self.js("""
const {CarChaseRules:R}=require('./game3d/js/domain/car-chase.js');
let state={distance:0,x:0,speed:0,hp:3,pursuit:0,nextObstacle:0,nextFork:0};
for(let i=0;i<180;i++)R.step(state,{throttle:true},1/60);
assert.ok(state.speed>20&&state.distance>20&&state.pursuit<10);
state={distance:149.9,x:0,speed:22,hp:3,pursuit:0,nextObstacle:3,nextFork:0};
let result=R.step(state,{throttle:true},.1);assert.equal(result.failure.checkpoint,120);
state={distance:319.9,x:0,speed:22,hp:3,pursuit:0,nextObstacle:6,nextFork:2};
assert.equal(R.step(state,{throttle:true},.1).won,true);
""")

    def test_ast_guard_detects_an_aliased_presentation_write(self):
        self.js("""
const fs=require('fs'),os=require('os'),path=require('path'),{check}=require('./tools/check_architecture.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'wdfz-boundary-'));
try{
 fs.mkdirSync(path.join(root,'game3d/js/fx'),{recursive:true});
 fs.writeFileSync(path.join(root,'game3d/manifest.js'),"[{id:'state',files:['game3d/js/state.js']},{id:'view',files:['game3d/js/fx/invalid.js']}].forEach(m=>GameModules.define(m));");
 fs.writeFileSync(path.join(root,'game3d/js/state.js'),'var S={san:10,nested:{x:0}};');
 fs.writeFileSync(path.join(root,'game3d/js/fx/invalid.js'),'function draw(){var nested=S.nested;nested.x++;} function badRoom(room){room.foot={};}');
 assert.ok(check(root).some(e=>e.includes('presentation writes game state')));
 assert.ok(check(root).some(e=>e.includes('presentation writes authoritative collision data')));
}finally{fs.rmSync(root,{recursive:true,force:true});}
""")
