"""穿模审查、可达性、碰撞、巡察者寻路、画质档位和两个渲染后端的回归测试。

运行：CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium python3 -m unittest tests.test_engine
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import shutil
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class EngineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),
            headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.contexts = []
        self.errors = []

    def tearDown(self):
        for context in self.contexts:
            context.close()
        self.assertEqual(self.errors, [], 'Unexpected page errors')

    def page(self, q=1, engine='three'):
        context = self.browser.new_context(viewport={'width': 800, 'height': 450}, device_scale_factor=1)
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify(%s))"
                                % json.dumps({'q': q, 'amb': 0, 'vol': 0, 'engine': engine}))
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
        page.evaluate('running=false')
        return page

    def assert_js(self, page, expr, msg=None):
        self.assertTrue(page.evaluate(expr), msg or expr)

    # ---------- 穿模：问题数只降不升（现在是 0） ----------
    def test_clip_audit_whole_school_is_clean(self):
        page = self.page(q=1)
        page.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
        issues = page.evaluate('ClipAudit.all()')
        summary = {}
        for x in issues:
            summary.setdefault(x['type'], []).append('%s %s %s' % (x.get('room'), x.get('a'), x.get('b', '')))
        self.assertEqual({k: v[:5] for k, v in summary.items()}, {},
                         '穿模审查（互相插入 / 穿墙 / 碰撞不符 / 巡察者擦碰 / 走不到 / 坐着的同学）应当是 0')

    def test_clip_audit_ultra_modeling_is_clean_too(self):
        """超精细的分段数更高，模型形状不变：抽几间房再查一遍"""
        page = self.page(q=3)
        page.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
        issues = page.evaluate("['teach1','admin3','dorm1','garage1','bell1'].flatMap(id=>ClipAudit.room(id)).concat(ClipAudit.outdoor())")
        self.assertEqual([(x['type'], x.get('room'), x.get('a')) for x in issues][:8], [])

    # ---------- 碰撞跟着模型 ----------
    def test_furniture_collision_follows_the_model_and_seat_is_solid(self):
        page = self.page(q=1)
        page.evaluate("doEnterRoom('teach1');running=false")
        # 课桌的椅背伸出格子 0.02 米：以前的方块碰撞挡不住，现在挡得住
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,c=5,r=2,F=R.foot[c+','+r];
            if(!F) return false;
            var q=F.slice().sort(function(a,b){return b.z1-a.z1;})[0];         /* 伸得最远的那一块（椅背立杆） */
            var wx=R.ox+((q.x0+q.x1)/2+R.cols*0.5)/U2M, wy=R.oy+(q.z1-0.005+R.rows*0.5)/U2M;
            var cy=R.oy+(r+0.5)*R.th, f=FURN_SOLID.d;
            return solidAtInterior(R,wx,wy)&&Math.abs(wy-cy)>R.th*f/2;})()""")
        # 自己的座位（P）现在有碰撞；坐下会坐到椅子上，坐着时不会被「卡住自救」挪开
        page.evaluate("""var R=INTERIORS.teach1;S.mode='in';S.room='teach1';S.seated=false;
            S.x=R.ox+(MY_COL+0.5)*R.tw;S.y=R.oy+(MY_ROW+1.5)*R.th;sitDown();unstick();""")
        self.assert_js(page, "S.seated&&tileAt(INTERIORS.teach1,S.x,S.y)==='P'&&solidAt(S.x,S.y)")

    def test_every_room_is_reachable_with_new_collision(self):
        page = self.page(q=1)
        page.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
        bad = page.evaluate("Object.keys(INTERIORS).flatMap(id=>ClipAudit.room(id)).filter(x=>x.type==='reach').map(x=>x.room+' '+x.a)")
        self.assertEqual(bad, [])

    def test_ultra_exact_circle_collision_slides_along_walls(self):
        page = self.page(q=3)
        # 贴着走廊北墙斜着往墙里走：x 方向照样前进，y 方向被挡住，人和墙之间不会少于半径
        page.evaluate("doEnterRoom('dorm1');running=false")
        r = page.evaluate("""(()=>{var R=INTERIORS.dorm1;S.mode='in';S.room='dorm1';S.seated=false;
            S.x=R.ox+13.5*R.tw;S.y=R.oy+7*R.th+PRAD+0.5;var x0=S.x,y0=S.y;
            for(var i=0;i<30;i++) moveBy(1.0,-1.0);
            return {dx:S.x-x0,dy:S.y-y0,hit:circleHits(S.x,S.y,PRAD),wallGap:S.y-(R.oy+7*R.th)};})()""")
        self.assertGreater(r['dx'], 25)
        self.assertFalse(r['hit'])
        self.assertGreaterEqual(r['wallGap'], 2.99)
        # 课桌角：四个探测点之间斜着戳进来的角，以前会少算，现在圆形检测算得到
        page.evaluate("doEnterRoom('teach1');running=false")
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1;S.room='teach1';var F=R.foot['5,2'],q=F[0];
            var cx=q.x1+0.2, cz=q.z1+0.2, wx=(cx+R.cols*0.5)*9+R.ox, wy=(cz+R.rows*0.5)*9+R.oy;
            return circleHits(wx,wy,PRAD)&&!solidAt(wx,wy)&&!solidAt(wx+PRAD,wy)&&!solidAt(wx,wy+PRAD);})()""")

    def test_camera_near_plane_cannot_reach_walls(self):
        """镜头在人中心，人半径 0.333 米；近裁剪面的四个角离镜头最远也只有这么远，碰不到墙"""
        page = self.page(q=1)
        far = page.evaluate("""(()=>{var c=GLR.cam, n=c.near, f=81*Math.PI/180, a=16/9;
            var hh=Math.tan(f/2)*n, hw=hh*a; return Math.hypot(n,hh,hw);})()""")
        prad = page.evaluate('PRAD*U2M')
        self.assertLess(far, prad - 0.1)

    # ---------- 巡察者 ----------
    def test_patroller_paths_keep_body_clearance(self):
        page = self.page(q=1)
        r = page.evaluate("""(()=>{doEnterRoom('admin1');running=false;var R=INTERIORS.admin1,nv=patNav(R),worst=9,n=0;
            PAT.room='admin1';
            function dist(wx,wy){var lx=(wx-R.ox)*U2M-R.cols*0.5,lz=(wy-R.oy)*U2M-R.rows*0.5,d=9;
              for(var k in R.foot) R.foot[k].forEach(function(q){d=Math.min(d,Math.hypot(Math.max(q.x0-lx,0,lx-q.x1),Math.max(q.z0-lz,0,lz-q.z1)));});return d;}
            var pts=[], c, rr;                                   /* 能走的格子里每隔几格取一个 */
            for(rr=1;rr<R.rows-1;rr+=3) for(c=1;c<R.cols-1;c+=7) if(R.grid[rr][c]==='.'&&patNavFree(R,R.ox+(c+0.5)*R.tw,R.oy+(rr+0.5)*R.th)) pts.push([c+0.5,rr+0.5]);
            for(var a=0;a<pts.length;a+=2) for(var b=1;b<pts.length;b+=3){ if(a===b) continue;
              PAT.x=R.ox+pts[a][0]*R.tw; PAT.y=R.oy+pts[a][1]*R.th;
              var path=patPath(R.ox+pts[b][0]*R.tw,R.oy+pts[b][1]*R.th); if(!path) continue; n++;
              var px=PAT.x,py=PAT.y; path.forEach(function(w){ for(var s=1;s<=10;s++){ worst=Math.min(worst,dist(px+(w.x-px)*s/10,py+(w.y-py)*s/10)); } px=w.x;py=w.y; });
            }
            return {n:n,worst:worst};})()""")
        self.assertGreater(r['n'], 10)
        self.assertGreater(r['worst'], 0.27)

    # ---------- 画质档位 ----------
    def test_four_quality_tiers_share_one_profile_table(self):
        page = self.page(q=1)
        self.assert_js(page, "QPROF.length===4&&QPROF.every(p=>Object.keys(p).join()===Object.keys(QPROF[0]).join())")
        self.assert_js(page, "QPROF[3].name==='超精细'&&QPROF[3].engine==='babylon'&&QPROF[3].physHz===240&&QPROF[3].shadowMap===4096")
        self.assert_js(page, "[...document.querySelectorAll('#mq option')].map(o=>o.textContent).join()==='流畅,均衡,精细,超精细'")
        self.assert_js(page, "document.querySelectorAll('#sQ button').length===4&&document.querySelectorAll('#sEng button').length===3")
        page.evaluate("SET.engine='three';Settings.q(3)")
        self.assert_js(page, "QUALITY===3&&JSON.parse(localStorage.getItem('zw3d_set')).q===3&&GFX.name()==='three'")
        page.evaluate("Settings.q(9)")
        self.assert_js(page, "QUALITY===1")
        # 超精细的分段数比均衡多
        segs = page.evaluate("""(()=>{var out=[];[1,3].forEach(function(q){QUALITY=q;var g=new GeoBuilder();g.cyl(0,0,0,1,1,1,10,0xffffff);out.push(g.v);});QUALITY=1;return out;})()""")
        self.assertGreater(segs[1], segs[0])

    def test_low_fps_offers_to_drop_one_tier_once(self):
        page = self.page(q=2)
        page.evaluate("""Game.start('easy');running=false;clearIntroTimers();S.screen='play';PRO.on=false;running=true;
            PAUSE.on=false;UI.closeChoice();UI.openPanel=null;FPSW.acc=0;FPSW.n=0;FPSW.low=0;FPSW.asked=false;
            for(var i=0;i<100;i++){ dtG=0.1; fpsWatch(0.1); }""")
        self.assert_js(page, "UI.chooseOpen&&document.getElementById('choices').textContent.indexOf('降到「均衡」')>=0")
        page.evaluate("document.querySelector('#choices button').click()")
        self.assert_js(page, "QUALITY===1&&!UI.chooseOpen")
        page.evaluate("for(var i=0;i<100;i++){ dtG=0.1; fpsWatch(0.1); }")
        self.assert_js(page, "!UI.chooseOpen||document.getElementById('choices').textContent.indexOf('降到「流畅」')>=0")

    # ---------- 渲染后端 ----------
    def test_babylon_backend_renders_the_same_scene_and_falls_back(self):
        page = self.page(q=3, engine='auto')
        page.wait_for_function("GFX.name()==='babylon'||!!GFX.failed.babylon", timeout=120000)
        self.assert_js(page, "!GFX.failed.babylon&&GFX.name()==='babylon'", 'Babylon.js 应该能在软件渲染下初始化')
        page.evaluate("Game.start('easy');running=false;clearIntroTimers();S.screen='play';")
        page.wait_for_function("S.room==='teach1'&&!!GLR.roomMesh", timeout=20000)
        page.evaluate("running=false")
        page.wait_for_function("(function(){render(0.016);return GFX.cur.isReady();})()", timeout=120000, polling=200)
        page.evaluate("render(0.016);render(0.016)")
        st = page.evaluate("GFX.cur.stats()")
        self.assertGreater(st['meshes'], 20)
        self.assertGreater(st['lights'], 4)
        # 画出来的不是一片纯色
        spread = page.evaluate("""(()=>{var c=document.getElementById('cvb'),x=document.createElement('canvas');x.width=64;x.height=36;
            var g=x.getContext('2d');g.drawImage(c,0,0,64,36);var d=g.getImageData(0,0,64,36).data,mn=255,mx=0;
            for(var i=0;i<d.length;i+=4){var l=d[i]*0.3+d[i+1]*0.59+d[i+2]*0.11;mn=Math.min(mn,l);mx=Math.max(mx,l);}return mx-mn;})()""")
        self.assertGreater(spread, 40)
        self.assert_js(page, "document.getElementById('cv').style.opacity==='0'&&getComputedStyle(document.getElementById('cvb')).display!=='none'")
        # 手动切回 Three.js：Babylon 的画布藏起来，three.js 的画布恢复
        page.evaluate("Settings.engine(1);render(0.016)")
        self.assert_js(page, "GFX.name()==='three'&&document.getElementById('cv').style.opacity===''&&document.getElementById('cvb').style.display==='none'")
        # 加载失败时退回 Three.js
        page.evaluate("GFX.failed.babylon='测试';Settings.engine(2)")
        self.assert_js(page, "GFX.name()==='three'")

    def test_hands_are_drawn_in_their_own_pass(self):
        page = self.page(q=1)
        page.evaluate("Game.start('easy');running=false;clearIntroTimers();S.screen='play';S.bag=['torch'];USE.torch=true;handsTick(0.016);render(0.016)")
        self.assert_js(page, "GLR.handRoot.visible&&GLR.handRoot.parent===GLR.handScene&&HANDS.R.parent===GLR.handRoot")
        self.assert_js(page, "(function(){var inMain=false;GLR.scene.traverse(function(o){if(o===HANDS.R) inMain=true;});return !inMain;})()")


if __name__ == '__main__':
    unittest.main()
