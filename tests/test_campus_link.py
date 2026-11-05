"""连续校园 C1：两条连廊四个端口，越过门槛线无缝换场景（计划《校园直通、翻越受伤与国际交流》第 3 节、第 15.0a 节）。"""
import json
import math
from pathlib import Path

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]

SETUP = """Game.start('hard');clearIntroTimers();running=false;S.intro=0;AN.active=false;AN.next=1e9;PAT.next=1e9;
  CUT.enabled=false;S.screen='play';"""

# 把玩家放在 room 这一侧某个端口里面 back 个单位、面朝门洞
PLACE = """window.placeAt=(room,peer,back)=>{
  const v=CampusLink.ports(room).find(p=>p.peer.room===peer),P=v.self;
  doEnterRoom(room,{x:P.x-P.n[0]*back,y:P.y-P.n[1]*back,ang:Math.atan2(P.n[1],P.n[0]),seamless:true});
  running=false;S.screen='play';S.stam=100;S.tired=false;return v;};0"""


class CampusLinkTest(BrowserCase):
    def ready(self):
        page = self.page()
        page.evaluate(SETUP)
        page.wait_for_function("S.room==='teach1'")
        page.evaluate(PLACE)
        return page

    def test_real_keyboard_crosses_all_four_ports_both_ways_without_a_jump(self):
        page = self.ready()
        pairs = page.evaluate("CAMPUS_LINK.pairs.map(p=>[p[0].room,p[1].room])")
        self.assertEqual(len(pairs), 4)
        results = []
        for a, b in pairs:
            for room, peer in ((a, b), (b, a)):
                page.evaluate(f"placeAt('{room}','{peer}',30)")
                page.keyboard.down('w')
                r = page.evaluate("""([room,peer])=>{
                  const banner=document.getElementById('banner').textContent;
                  let prev=null,hit=null;
                  for(let i=0;i<240&&!hit;i++){
                    prev={room:S.room,x:S.x,y:S.y,ang:S.ang};updatePlayer(1/60);
                    if(S.room!==prev.room)hit={room:S.room,x:S.x,y:S.y,ang:S.ang};
                  }
                  if(!hit)return {room:S.room,crossed:false};
                  // 把落点换回原来那一侧：应当就在上一帧位置的前方，距离不超过一帧的步长
                  const v=CampusLink.ports(peer).find(p=>p.peer.room===room),T=CampusLink.between(v.self,v.peer);
                  const q=CampusLink.apply(T,hit.x,hit.y),step=Math.hypot(q.x-prev.x,q.y-prev.y);
                  const ahead=((q.x-prev.x)*Math.cos(prev.ang)+(q.y-prev.y)*Math.sin(prev.ang))/(step||1);
                  const dang=Math.atan2(Math.sin(hit.ang+T.phi-prev.ang),Math.cos(hit.ang+T.phi-prev.ang));
                  return {room:S.room,crossed:true,step,ahead,dang,fade:document.getElementById('fade').style.opacity||'0',
                    bannerSame:document.getElementById('banner').textContent===banner,depth:Collision.depth(S.x,S.y,PRAD)};
                }""", [room, peer])
                page.keyboard.up('w')
                results.append((room, peer, r))
        for room, peer, r in results:
            with self.subTest(room=room, peer=peer):
                self.assertTrue(r['crossed'], r)
                self.assertEqual(r['room'], peer)
                self.assertLess(r['step'], 1.2)                  # 一帧走路不到 0.6 单位、跑步不到 1.1；换算本身不引入位移
                self.assertGreater(r['ahead'], .99)              # 落点在原来的正前方：没有侧移、没有回弹
                self.assertLess(abs(r['dang']), math.radians(.1))
                self.assertEqual(r['fade'], '0')
                self.assertTrue(r['bannerSame'])                 # 不出场景名横幅
                self.assertLess(r['depth'], 1e-7)

    def test_backing_up_and_running_cross_too_and_walls_beside_the_doorway_stay_solid(self):
        page = self.ready()
        r = page.evaluate("""()=>{
          placeAt('teach2','link2',30);S.ang+=Math.PI;               // 背对门洞，倒着走过去
          KEY.s=true;for(let i=0;i<240&&S.room==='teach2';i++)updatePlayer(1/60);KEY.s=false;const back=S.room;
          placeAt('lab2','link1',40);KEY.w=true;KEY.shift=true;for(let i=0;i<240&&S.room==='lab2';i++)updatePlayer(1/60);
          KEY.w=false;KEY.shift=false;const run=S.room;
          // 门洞旁边的墙：沿墙外侧斜着推，换不了场景，也不会卡进墙里
          const v=placeAt('teach2','link2',6),P=v.self;S.x=P.x-P.n[0]*15;S.y=P.y-18;   // 门洞北边那一格走廊（门洞占 17–19 行）
          for(let i=0;i<200;i++)moveBy(P.n[0]*.4,P.n[1]*.4,1/240);
          return {back,run,wall:S.room,depth:Collision.depth(S.x,S.y,PRAD)};
        }""")
        self.assertEqual(r['back'], 'link2')
        self.assertEqual(r['run'], 'link1')
        self.assertEqual(r['wall'], 'teach2')
        self.assertLess(r['depth'], 1e-7)

    def test_doorway_annex_only_allows_the_door_width(self):
        page = self.ready()
        r = page.evaluate("""()=>{
          const R=INTERIORS.teach2,v=CampusLink.ports('teach2')[0],P=v.self,half=P.half-PRAD;
          const at=(along,lat)=>({x:P.x+P.n[0]*along-P.n[1]*lat,y:P.y+P.n[1]*along+P.n[0]*lat});
          const ok=[at(-3,0),at(-1,half-.1),at(5,-(half-.1))].every(p=>Collision.depth(p.x,p.y,PRAD,R)<1e-7);
          const blocked=[at(5,half+1),at(5,-(half+1)),at(16,0)].every(p=>!Number.isFinite(Collision.depth(p.x,p.y,PRAD,R))||Collision.depth(p.x,p.y,PRAD,R)>0);
          const open=P.cells.every(c=>R.grid[c[1]][c[0]]!=='#'),link=CampusLink.ports('link2').every(w=>w.self.cells.every(c=>INTERIORS.link2.grid[c[1]][c[0]]!=='#'));
          return {ok,blocked,open,link};
        }""")
        self.assertEqual(r, {'ok': True, 'blocked': True, 'open': True, 'link': True})

    def test_previews_show_the_bridge_and_far_building_and_rendering_changes_nothing(self):
        page = self.ready()
        r = page.evaluate("""()=>{
          placeAt('teach2','link2',30);syncCamera(0);
          const kids=GLR.roomMesh.children.filter(c=>c.userData.campusLinkPreview).map(c=>[c.userData.campusLinkPreview,c.userData.hop]);
          const before=JSON.stringify([S,RT,PAT]);let draws=0;GameRandom.bind(()=>{draws++;return .5;});
          render(.016);render(.016);const same=JSON.stringify([S,RT,PAT])===before;GameRandom.bind(RandomRules.create(7).next);
          placeAt('link2','teach2',60);
          const inLink=GLR.roomMesh.children.filter(c=>c.userData.campusLinkPreview).map(c=>c.userData.campusLinkPreview).sort();
          // 预览摆放：连廊南门洞在教学楼的场景里应当正好贴着西墙门洞
          placeAt('teach2','link2',30);
          const prev=GLR.roomMesh.children.find(c=>c.userData.campusLinkPreview==='link2'),L=INTERIORS.link2,T=INTERIORS.teach2;
          const pl=CampusLink.ports('link2').find(w=>w.peer.room==='teach2').self,pt=CampusLink.ports('teach2')[0].self;
          const v=new THREE.Vector3((pl.x-L.cx)*U2M,0,(pl.y-L.cy)*U2M);prev.updateMatrixWorld(true);v.applyMatrix4(prev.matrix);
          const err=Math.hypot(v.x-(pt.x-T.cx)*U2M,v.z-(pt.y-T.cy)*U2M);
          return {kids,same,draws,inLink,err,errors:GameModules.errors().length};
        }""")
        self.assertEqual(r['kids'], [['link2', 1], ['lab2', 2]])
        self.assertTrue(r['same'])
        self.assertEqual(r['draws'], 0)
        self.assertEqual(r['inLink'], ['lab2', 'link1', 'teach2'])
        self.assertLess(r['err'], .01)                           # 1 厘米以内
        self.assertEqual(r['errors'], 0)

    def test_mid_bridge_save_restores_and_doorway_needs_no_e(self):
        page = self.ready()
        r = page.evaluate("""()=>{
          placeAt('link1','lab2',80);const x=S.x,y=S.y;saveGame();const d=loadGame();freshState('hard');running=false;applySave(d);
          const restored=S.room==='link1'&&Math.abs(S.x-x)<1e-6&&Math.abs(S.y-y)<1e-6;
          placeAt('teach2','link2',20);const R=INTERIORS.teach2;let lc=null;
          R.grid.forEach((row,r)=>row.forEach((ch,c)=>{if(ch==='L')lc={c,r};}));
          S.x=R.ox+(lc.c+.5)*R.tw+12;S.y=R.oy+(lc.r+.5)*R.th;S.ang=Math.PI;
          return {restored,hint:interactHint(),room:S.room};
        }""")
        self.assertTrue(r['restored'])
        self.assertNotIn('连廊', r['hint'])
        self.assertEqual(r['room'], 'teach2')

    def test_patrol_crosses_the_doorway_through_the_same_threshold(self):
        page = self.ready()
        r = page.evaluate("""()=>{
          const g=PatrolNav.graph(),out=[];
          [['admin2','link1'],['lab2','link1'],['lab2','link2'],['teach2','link2']].forEach(([a,b])=>{
            const e=g.edges.find(e=>(e.a===a+':'+b&&e.b.startsWith(b+':'))||(e.b===a+':'+b&&e.a.startsWith(b+':')));
            const pa=g.nodes[e.a.startsWith(a)?e.a:e.b],pb=g.nodes[e.a.startsWith(a)?e.b:e.a];
            const v=CampusLink.ports(b).find(w=>w.peer.room===a),q=CampusLink.apply(CampusLink.between(v.self,v.peer),pb.x,pb.y);
            out.push({kind:e.kind,gap:Math.hypot(q.x-pa.x,q.y-pa.y)});
          });
          const route=PatrolNav.route(PatrolNav.point('teach2',INTERIORS.teach2.cx,INTERIORS.teach2.cy),PatrolNav.point('lab2',INTERIORS.lab2.cx,INTERIORS.lab2.cy));
          return {out,route:!!route};
        }""")
        for e in r['out']:
            self.assertEqual(e['kind'], 'stair-portal')
            self.assertLess(e['gap'], 4.0)                      # 门槛两侧各 0.5 单位；吸附到 0.25 米巡察栅格的格心后不到 0.45 米
        self.assertTrue(r['route'])

    def test_module_can_be_removed_and_links_fall_back_to_e(self):
        context = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));")
        src = (ROOT / 'game3d/manifest.js').read_text(encoding='utf-8')
        src = src.replace("].forEach(function(m){ GameModules.define(m); });",
                          "].filter(function(m){ return m.id!=='campus-link'; }).forEach(function(m){ GameModules.define(m); });")
        context.route('**/game3d/manifest.js', lambda route: route.fulfill(status=200, content_type='text/javascript', body=src))
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;" + SETUP)
        page.wait_for_function("S.room==='teach1'")
        r = page.evaluate("""()=>{const R=INTERIORS.teach2;return {mod:typeof CampusLink,wall:R.grid[18][0],
          kinds:PatrolNav.graph().edges.filter(e=>e.a.includes('link')||e.b.includes('link')).map(e=>e.kind).filter(k=>k!=='walk'),
          errors:GameModules.errors().length};}""")
        self.assertEqual(r['mod'], 'undefined')
        self.assertEqual(r['wall'], '#')
        self.assertEqual(sorted(set(r['kinds'])), ['bridge'])
        self.assertEqual(r['errors'], 0)
