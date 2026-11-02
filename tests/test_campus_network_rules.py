"""纯规则：电量边界、VFS 隔离、谜题唯一性、路线最优性。"""
from pathlib import Path
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
class CampusNetworkRules(unittest.TestCase):
    def js(self, code):
        pre="const assert=require('node:assert/strict'); const fs=require('fs'),vm=require('vm');['phone-energy','campus-terminal','route-graph'].forEach(n=>vm.runInThisContext(fs.readFileSync('game3d/js/domain/'+n+'.js','utf8')));\n"
        r=subprocess.run(['node','-e',pre+code],cwd=ROOT,capture_output=True,text=True,timeout=30)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
    def test_energy_rates_and_complete_power_boundary(self):
        self.js("""
for(const tech of [false,true]){const d=PhoneEnergy.fresh();d.initialized=true;PhoneEnergy.advance(d,tech?300:600,{held:true,tech});assert.equal(d.battery,0);assert.equal(d.powered,false);}
for(const tech of [false,true]){const d=PhoneEnergy.fresh();d.initialized=true;d.wireless={status:'running',target:600,elapsed:0};PhoneEnergy.advance(d,tech?150:300,{held:true,tech});assert.equal(d.battery,0);assert.equal(d.powered,false);}
// 对齐计划能源表的 3 种供电 × 2 种天赋 × 2 种负载，采用独立的预期净功率。
for(const [supply,expected] of [['none',[-1/6,-1/3,-1/3,-2/3]],['classroom',[1/3,1/6,1/6,-1/6]],['computer',[0,-1/6,-1/6,-1/2]]]){
 for(let i=0;i<4;i++){let d=PhoneEnergy.fresh();d.initialized=true;d.battery=50;if(i%2)d.wireless={status:'running',target:600,elapsed:0};
 PhoneEnergy.advance(d,30,{held:true,tech:i>=2,classroom:supply==='classroom',computer:supply==='computer'});assert(Math.abs(d.battery-(50+30*expected[i]))<1e-7);}
}
let d=PhoneEnergy.fresh();d.initialized=true;d.wireless={status:'running',target:600,elapsed:0};
let events=PhoneEnergy.advance(d,600,{held:true,tech:true,classroom:true});
assert.equal(d.battery,0);assert.equal(d.wireless.status,'complete');assert(d.network);assert.equal(d.download.elapsed,0);assert(events.indexOf('connected')<events.indexOf('off'));
PhoneEnergy.advance(d,30,{held:true,tech:true,classroom:true});assert.equal(d.powered,true);assert.equal(d.download.elapsed,0);assert(Math.abs(d.battery-5)<1e-7);
PhoneEnergy.advance(d,60,{held:true,tech:true,classroom:true});assert.equal(d.download.status,'complete');assert(Math.abs(d.battery-15)<1e-7);
""")
    def test_base_drain_and_charging_do_not_depend_on_phone_ui(self):
        self.js("""
for(const tech of [false,true]){let d=PhoneEnergy.fresh();d.initialized=true;d.battery=0;d.powered=false;
PhoneEnergy.advance(d,tech?600:300,{held:true,tech,classroom:true});assert(Math.abs(d.battery-100)<1e-7);}
let d=PhoneEnergy.fresh();d.initialized=true;d.battery=50;PhoneEnergy.advance(d,120,{held:true,computer:true});assert.equal(d.battery,50);
PhoneEnergy.advance(d,120,{held:true,computer:true,tech:true});assert(Math.abs(d.battery-30)<1e-7);
d.wireless={status:'running',target:200,elapsed:10};PhoneEnergy.advance(d,60,{held:false});assert.equal(d.wireless.elapsed,10);assert(Math.abs(d.battery-20)<1e-7);
let warnings=PhoneEnergy.fresh();warnings.initialized=true;
let first=PhoneEnergy.advance(warnings,600,{held:true}),again=PhoneEnergy.advance(warnings,600,{held:true});
assert.deepEqual(first,['low20','low5','off']);assert.deepEqual(again,[]);
""")
    def test_segmentation_matches_many_small_steps(self):
        self.js("""
for(let i=0;i<40;i++){
 let d=PhoneEnergy.fresh();d.initialized=true;d.battery=10+i*2;d.wireless={status:'running',target:180+i*10,elapsed:0};
 let b=JSON.parse(JSON.stringify(d)),c={held:true,tech:!!(i%2),classroom:!!(i%3)};
 PhoneEnergy.advance(d,700,c);for(let k=0;k<7000;k++)PhoneEnergy.advance(b,.1,c);
 assert(Math.abs(d.battery-b.battery)<1e-6);assert.equal(d.powered,b.powered);assert.equal(d.wireless.status,b.wireless.status);assert(Math.abs(d.download.elapsed-b.download.elapsed)<1e-6);
}
""")
    def test_seeded_puzzles_have_unique_valid_chain_and_order(self):
        self.js("""
for(let seed=0;seed<100;seed++){
 let s=CampusTerminal.fresh('run-'+seed,1),a=CampusTerminal.generate(s.runSeed,s.attemptId).answer;
 assert.equal(CampusTerminal.run(s,'campusctl shutdown --confirm').error,true);
 assert.equal(CampusTerminal.run(s,'campusctl select ctl-old /school/assets.tsv').error,true);
 assert(!CampusTerminal.run(s,`campusctl select ${a.controller} /school/assets.tsv`).error);
 assert(!CampusTerminal.run(s,`campusctl trace ${a.tx} /school/runtime.log`).error);
 const body=`controller=${a.controller}\\ntransaction=${a.tx}\\ntoken=${a.token}\\nclock=active\\n${a.order.map(x=>'stop '+x).join('\\n')}`;
 assert(!CampusTerminal.run(s,`edit /work/shutdown "${body}"`).error);
 assert(CampusTerminal.validate(s,'/work/shutdown').ok);
 CampusTerminal.run(s,'campusctl validate /work/shutdown');assert.equal(CampusTerminal.run(s,'campusctl shutdown --confirm').request,'shutdown');
 s.work['/work/shutdown']+='\\nstop control';assert.equal(CampusTerminal.run(s,'campusctl shutdown --confirm').error,true);
 assert.deepEqual(a,CampusTerminal.generate('run-'+seed,1).answer);
 assert.notDeepEqual(a,CampusTerminal.generate('run-'+seed,2).answer);
}
""")
    def test_parser_cannot_escape_or_execute_host_code(self):
        self.js("""
let s=CampusTerminal.fresh('run',1);
for(const cmd of ['cat /etc/passwd','curl example.com','eval alert(1)','cat /school/README;pwd','cat $(id)','cat `id`','edit /school/README "bad"','edit /work/../../escape "bad"','help | campusctl shutdown --confirm','cat a|cat a|cat a|cat a|cat a'])assert(CampusTerminal.run(s,cmd).error,cmd);
assert(!CampusTerminal.run(s,'cat /school/assets.tsv | grep controller | sort | head -n 2').error);
assert(!CampusTerminal.run(s,'mkdir /work/a').error);assert(!CampusTerminal.run(s,'cd /work/a').error);
CampusTerminal.run(s,'edit test "<script>alert(1)</script>"');assert.equal(CampusTerminal.read(s,'test'),'<script>alert(1)</script>');
assert.equal(CampusTerminal.run(s,'head -n -1 /school/README').error,true);
""")
    def test_postman_matches_exact_small_graph_bound(self):
        self.js("""
let g={nodes:{a:{},b:{},c:{},d:{}},edges:[{a:'a',b:'b',weight:1},{a:'b',b:'c',weight:1},{a:'b',b:'d',weight:3}]};
let r=RouteGraph.postman(g,'a');assert.equal(r.totalWeight,10);assert.equal(r.nodes[0],r.nodes.at(-1));assert.equal(new Set(r.edges).size,3);
assert.deepEqual(r,RouteGraph.postman(g,'a'));
""")
