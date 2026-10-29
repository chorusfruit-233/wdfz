"""最新版建模内核、缓存、写实化和氛围回归。"""
from browser_case import BrowserCase

class ModelTest(BrowserCase):
    # ---------- 建模内核：紧凑顶点、隐藏面剔除、场景缓存、开门只换门扇 ----------
    def test_kit_uses_compact_vertex_data(self):
        page = self.page(); page.evaluate("Settings.q(1)")
        info = page.evaluate("""(function(){
          var K=new Kit({}); K.box('wood',0,0.5,0,1,1,1,0x808080,1.0);
          var g=K.build().children[0].geometry, a=g.attributes;
          return {n:a.normal.array.constructor.name, nn:a.normal.normalized,
                  c:a.color.array.constructor.name, cn:a.color.normalized,
                  i:g.index.array.constructor.name, v:a.position.count, t:g.index.count/3,
                  ny:a.normal.getY(0)};
        })()""")
        self.assertEqual((info['n'], info['nn'], info['i']), ('Int8Array', True, 'Uint16Array'))
        self.assertIn(info['c'], ('Uint8Array', 'Uint16Array'))
        self.assertEqual((info['v'], info['t']), (24, 12))
        self.assertIn(round(info['ny'], 3), (-1.0, 0.0, 1.0), '法线压成 8 位后读出来仍是单位方向')

    def test_hidden_faces_on_floor_are_skipped_only_when_asked(self):
        page = self.page(); page.evaluate("Settings.q(1)")
        counts = page.evaluate("""[null,{floor:0.002},{floor:0.002,ceil:1.0}].map(function(c){
          var K=new Kit({cull:c}); K.box('wood',0,0.5,0,1,1,1,0x808080,1.0);
          return K.build().children[0].geometry.index.count/3; })""")
        self.assertEqual(counts, [12, 10, 8], '贴地的底面、顶到天花板的顶面不画；人物等不开剔除的照旧')

    def test_rooms_and_outdoor_are_reused_and_door_only_rebuilds_its_leaf(self):
        page = self.page(); page.evaluate("Settings.q(1)")
        page.evaluate("Game.start('easy');running=false;clearIntroTimers();S.screen='play'")
        page.evaluate("S.mode='in';S.room='teach1';doEnterRoom('teach1');running=false;window.__g1=GLR.roomMesh")
        page.evaluate("S.mode='out';S.room=null;enterWorldOut();window.__o1=GLR.outMesh")
        page.evaluate("S.mode='in';S.room='teach1';doEnterRoom('teach1');running=false")
        self.assert_js(page, "GLR.roomMesh===__g1&&GLR.roomMesh.parent===GLR.scene", '第二次进同一层楼直接用上次建好的')
        page.evaluate("S.mode='out';S.room=null;enterWorldOut()")
        self.assert_js(page, "GLR.outMesh===__o1", '第二次出门直接用上次建好的室外')
        page.evaluate("S.mode='in';S.room='teach1';doEnterRoom('teach1');running=false")
        r = page.evaluate("""(function(){
          var R=INTERIORS['teach1'], d=R.doorSpecs[0], g=GLR.roomMesh, old=g.getObjectByName('doorleaves');
          var n0=g.children.length;
          OPENDOORS[doorKeyAt(R,d.x,d.y)]=true; roomDoorRefresh(R,d.x,d.y);
          var nw=g.getObjectByName('doorleaves');
          return {same:GLR.roomMesh===g, swapped:!!nw&&nw!==old&&!old.parent, n:g.children.length===n0};
        })()""")
        self.assertEqual(r, {'same': True, 'swapped': True, 'n': True}, '开门只重建门扇这一块，整层楼和同学不动')

    # ---------- 写实化建模：曲面平滑、新图元、流畅档的顶点预算 ----------
    def test_curved_surfaces_are_smooth_and_new_primitives_build(self):
        page = self.page(); page.evaluate("Settings.q(1)")
        r = page.evaluate("""(function(){
          function nrm(K){ return K.build().children[0].geometry.attributes.normal; }
          var a=new Kit({}); a.cyl('metal',0,0,0,0.2,0.2,1,8,0x808080,1,false); var na=nrm(a);
          var b=new Kit({}); b.cyl('metal',0,0,0,0.2,0.2,1,4,0x808080,1,false); var nb=nrm(b);
          var c=new Kit({}); c.lathe('metal',0,0,0,[[0.1,0],[0.2,0.5],[0.05,1]],12,0x808080,1);
          var gc=c.build().children[0].geometry; gc.computeBoundingBox();
          var d=new Kit({}); d.prism('metal',0,0,0,[[-1,0],[1,0],[0.8,0.5],[-0.8,0.6]],0.4,0x808080,1,0.02);
          var gd=d.build().children[0].geometry; gd.computeBoundingBox();
          var e=new Kit({}); e.leafCards('foliage',0,2,0,1,0x406040,1,2,0,0,2,0); var ue=e.build().children[0].geometry.attributes.uv;
          var umin=1e9,umax=-1e9,i; for(i=0;i<ue.count;i++){ umin=Math.min(umin,ue.getX(i),ue.getY(i)); umax=Math.max(umax,ue.getX(i),ue.getY(i)); }
          return {smooth:Math.abs(na.getX(0)-na.getX(3))>0.1, flat:Math.abs(nb.getX(0)-nb.getX(3))<0.01,
                  lathe:[+gc.boundingBox.max.y.toFixed(3),+gc.boundingBox.max.x.toFixed(3)],
                  prism:[+gd.boundingBox.max.x.toFixed(3),+gd.boundingBox.max.y.toFixed(3),+gd.boundingBox.max.z.toFixed(3)],
                  uv:[umin,umax], fol:!!matOf('foliage').map&&matOf('foliage').alphaTest>0};
        })()""")
        self.assertTrue(r['smooth'], '8 段圆柱的侧面法线沿圆周变化（平滑着色）')
        self.assertTrue(r['flat'], '4 段的是故意做的棱柱，保留棱线')
        self.assertEqual(r['lathe'], [1.0, 0.2])
        self.assertEqual(r['prism'], [1.0, 0.6, 0.2])
        self.assertEqual(r['uv'], [0, 1], '叶片卡整张贴图铺满')
        self.assertTrue(r['fol'], '叶片卡用镂空贴图')

    def test_low_quality_keeps_a_vertex_budget(self):
        page = self.page()
        n = page.evaluate("""(function(){
          function cnt(g){ var n=0; g.traverse(function(o){ if(o.geometry&&o.geometry.attributes.position) n+=o.geometry.attributes.position.count; }); g.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); return n; }
          var ins=0; Object.keys(INTERIORS).forEach(function(id){ S.__pianoPlaced=0; ins+=cnt(buildRoomGeometry(INTERIORS[id])); });
          return {indoor:ins, outdoor:cnt(buildOutdoorGeometry())};
        })()""")
        self.assertLess(n['indoor'], 2300000, '流畅档（手机）全校室内的顶点数')
        self.assertLess(n['outdoor'], 270000, '流畅档室外的顶点数')

    # ---------- 氛围：远处的人影 ----------
    def test_far_figure_appears_down_the_corridor_and_vanishes_up_close(self):
        page = self.page(); page.evaluate("Settings.q(1)")
        page.evaluate("Game.start('easy');running=false;clearIntroTimers();S.screen='play'")
        r = page.evaluate("""(function(){
          S.mode='in'; S.room='teach1'; doEnterRoom('teach1'); running=false; AN.active=false;
          var R=INTERIORS['teach1']; S.x=R.ox+50.5*R.tw; S.y=R.oy+18.5*R.th; S.ang=Math.PI; syncCamera(0.016);
          GLR.cam.updateMatrixWorld(); APPAR.next=0; apparTick(0.016);
          var g=APPAR.g, cp=GLR.cam.position, d=Math.hypot(g.position.x-cp.x,g.position.z-cp.z);
          var shown=g.visible, inScene=g.parent===GLR.scene;
          var p=g.position; GLR.cam.position.set(p.x+5,1.6,p.z); apparTick(0.016);
          return {shown:shown, inScene:inScene, d:d, gone:!g.visible};
        })()""")
        self.assertTrue(r['shown'] and r['inScene'], '正前方走廊尽头站着一个人影')
        self.assertTrue(9 < r['d'] < 17, r)
        self.assertTrue(r['gone'], '走近就不见了')
