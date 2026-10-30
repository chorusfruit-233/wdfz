"""模型占地、人物与可达性专项回归。"""
from pathlib import Path
from browser_case import BrowserCase
ROOT=Path(__file__).resolve().parents[1]

class GeometryTest(BrowserCase):
    # ---------- 穿模：问题数只降不升（现在是 0） ----------
    def test_clip_audit_whole_school_is_clean(self):
        page = self.page()
        page.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
        issues = page.evaluate('ClipAudit.all()')
        summary = {}
        for x in issues:
            summary.setdefault(x['type'], []).append('%s %s %s' % (x.get('room'), x.get('a'), x.get('b', '')))
        self.assertEqual({k: v[:5] for k, v in summary.items()}, {},
                         '穿模审查（互相插入 / 穿墙 / 碰撞不符 / 巡察者擦碰 / 走不到 / 坐着的同学）应当是 0')

    def test_clip_audit_ultra_modeling_is_clean_too(self):
        """超精细的分段数更高，模型形状不变：抽几间房再查一遍"""
        page = self.page(); self.set_quality(page, 3)
        page.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
        issues = page.evaluate("['teach1','admin3','dorm1','garage1','bell1'].flatMap(id=>ClipAudit.room(id)).concat(ClipAudit.outdoor())")
        self.assertEqual([(x['type'], x.get('room'), x.get('a')) for x in issues][:8], [])

    # ---------- 碰撞跟着模型 ----------
    def test_furniture_collision_follows_the_model_and_seat_is_solid(self):
        page = self.page()
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
        page = self.page()
        page.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
        bad = page.evaluate("Object.keys(INTERIORS).flatMap(id=>ClipAudit.room(id)).filter(x=>x.type==='reach').map(x=>x.room+' '+x.a)")
        self.assertEqual(bad, [])

    def test_ultra_exact_circle_collision_slides_along_walls(self):
        page = self.page(); self.set_quality(page, 3)
        # 贴着走廊北墙斜着往墙里走：x 方向照样前进，y 方向被挡住，人和墙之间不会少于半径
        page.evaluate("doEnterRoom('dorm1');running=false")
        r = page.evaluate("""(()=>{var R=INTERIORS.dorm1;S.mode='in';S.room='dorm1';S.seated=false;
            S.x=R.ox+13.5*R.tw;S.y=R.oy+7*R.th+PRAD+0.5;var x0=S.x,y0=S.y;
            for(var i=0;i<30;i++) moveBy(1.0,-1.0);
            return {dx:S.x-x0,dy:S.y-y0,hit:(Collision.depth(S.x,S.y,PRAD)>0),wallGap:S.y-(R.oy+7*R.th)};})()""")
        self.assertGreater(r['dx'], 25)
        self.assertFalse(r['hit'])
        self.assertGreaterEqual(r['wallGap'], 2.99)
        # 课桌角：四个探测点之间斜着戳进来的角，以前会少算，现在圆形检测算得到
        page.evaluate("doEnterRoom('teach1');running=false")
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1;S.room='teach1';var F=R.foot['5,2'],q=F[0];
            var cx=q.x1+0.2, cz=q.z1+0.2, wx=(cx+R.cols*0.5)*9+R.ox, wy=(cz+R.rows*0.5)*9+R.oy;
            return (Collision.depth(wx,wy,PRAD)>0)&&!solidAt(wx,wy)&&!solidAt(wx+PRAD,wy)&&!solidAt(wx,wy+PRAD);})()""")

    def test_camera_near_plane_cannot_reach_walls(self):
        """镜头在人中心，人半径 0.333 米；近裁剪面的四个角离镜头最远也只有这么远，碰不到墙"""
        page = self.page()
        far = page.evaluate("""(()=>{var c=GLR.cam, n=c.near, f=81*Math.PI/180, a=16/9;
            var hh=Math.tan(f/2)*n, hw=hh*a; return Math.hypot(n,hh,hw);})()""")
        prad = page.evaluate('PRAD*U2M')
        self.assertLess(far, prad - 0.1)

    # ---------- 巡察者 ----------
    def test_patroller_paths_keep_body_clearance(self):
        page = self.page()
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

    def test_hands_are_drawn_in_their_own_pass(self):
        page = self.page()
        page.evaluate("Game.start('easy');running=false;clearIntroTimers();S.screen='play';S.bag=['torch'];USE.torch=true;handsTick(0.016);render(0.016)")
        self.assert_js(page, "GLR.handRoot.visible&&GLR.handRoot.parent===GLR.handScene&&HANDS.R.parent===GLR.handRoot")
        self.assert_js(page, "(function(){var inMain=false;GLR.scene.traverse(function(o){if(o===HANDS.R) inMain=true;});return !inMain;})()")

    def test_player_can_leave_the_solid_starting_seat(self):
        page = self.page()
        page.evaluate("Game.start('easy');clearIntroTimers();running=false")
        page.wait_for_function("S.mode==='in'&&S.room==='teach1'&&!!GLR.roomMesh&&S.ang===-Math.PI/2")
        page.evaluate("""running=false;S.intro=0;PRO.on=false;PAUSE.on=false;UI.closePanelAll();UI.closeChoice();
            window.seatPosition=[S.x,S.y];unstick();window.stillSeated=S.seated&&S.x===seatPosition[0]&&S.y===seatPosition[1];
            KEY.w=true;for(let i=0;i<120;i++)updatePlayer(1/60);KEY.w=false;""")
        self.assert_js(page, 'stillSeated&&!S.seated&&canStand(S.x,S.y)&&Math.hypot(S.x-seatPosition[0],S.y-seatPosition[1])>10')

    def test_garage_actor_cannot_tunnel_through_a_thin_obstacle(self):
        page = self.page()
        page.evaluate("""doEnterRoom('garage1');running=false;var R=INTERIORS.garage1;
            window.originalGrid=R.grid;window.originalExtra=R.propExtra;window.originalFoot=R.foot;
            R.grid=Array.from({length:R.rows},()=>Array(R.cols).fill('.'));R.foot={};R.stairExtra=[];
            R.propExtra=[{x0:0,x1:.1,z0:-10,z1:10}];ROAM.x=R.cx-8;ROAM.y=R.cy;
            roamMove(R,34,10);window.blockedActor=[ROAM.x-R.cx,ROAM.y-R.cy,roamBlocked(R,ROAM.x,ROAM.y)];
            R.grid=originalGrid;R.propExtra=originalExtra;R.foot=originalFoot;""")
        self.assert_js(page, 'blockedActor[0]<=-2.5&&blockedActor[1]>9.9&&!blockedActor[2]')
