"""《传送门建模、死亡CG档案室与速通模式》P0：传送门实体模型、实验室常驻装置与结局演出共用。"""
from browser_case import BrowserCase


class PortalModelTest(BrowserCase):
    def lab(self):
        page = self.page()
        page.evaluate("Game.start('easy',{talent:'none'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("""clearIntroTimers();running=false;S.intro=0;AN.next=1e6;PAT.next=1e6;
          RT.portalSketch=0;RT.portalOpen=0;doEnterRoom('lab1');running=false""")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lab1")
        page.evaluate("PortalDevice.tick(0.016)")
        return page

    def test_device_follows_the_story_state(self):
        page = self.lab()
        got = page.evaluate("""(()=>{let r={},P=()=>PortalDevice.P;
          function look(){return {st:P().state,coil:P().parts.coil.visible,lens:P().parts.lens.visible,vial:P().parts.vial.visible,bat:P().parts.battery.visible,
            sock:P().sockets.coil.visible,inner:P().inner.visible,led:P().sockets.lens.userData.led.material.color.getHex()};}
          r.base=look(); RT.portalSketch=1; PortalDevice.tick(0.016); r.ready=look(); RT.portalOpen=1; PortalDevice.tick(0.016); r.open=look();
          return r;})()""")
        self.assertEqual(got['base']['st'], 'base')
        self.assertFalse(got['base']['coil'] or got['base']['inner'])
        self.assertTrue(got['base']['sock'])
        self.assertEqual(got['ready']['st'], 'ready')
        self.assertNotEqual(got['ready']['led'], got['base']['led'])          # 图纸齐了：卡槽亮灯
        self.assertEqual(got['open']['st'], 'open')
        self.assertTrue(all(got['open'][k] for k in ('coil', 'lens', 'vial', 'bat', 'inner')))
        self.assertFalse(got['open']['sock'])

    def test_device_stays_on_the_bench_and_adds_no_collision(self):
        page = self.lab()
        got = page.evaluate("""(()=>{RT.portalOpen=1;PortalDevice.tick(0.016);
          let P=PortalDevice.P, b=new THREE.Box3().setFromObject(P.group), w=PortalDevice.where();
          let R=INTERIORS.lab1, probes=[];
          for(let dx=-1.2;dx<=1.2;dx+=0.3) for(let dz=0.6;dz<=1.5;dz+=0.3){ probes.push(Collision.depth(R.ox+(25.5+dx)*R.tw,R.oy+(1.5+dz)*R.th,PRAD,R)); }
          return {minx:b.min.x-w.x,maxx:b.max.x-w.x,minz:b.min.z-w.z,maxz:b.max.z-w.z,miny:b.min.y,maxy:b.max.y,free:probes.filter(v=>v<1e-7).length,n:probes.length};})()""")
        self.assertGreater(got['minx'], -0.82)
        self.assertLess(got['maxx'], 0.82)
        self.assertGreater(got['minz'], -0.45)
        self.assertLess(got['maxz'], 0.45)
        self.assertGreater(got['miny'], 0.4)          # 线缆垂到台边，但不落地
        self.assertLess(got['maxy'], 2.6)
        # 演示台前面的通道仍能走：不额外登记碰撞
        before = page.evaluate("""(()=>{RT.portalOpen=0;PortalDevice.clear();let R=INTERIORS.lab1,out=[];
          for(let dx=-1.2;dx<=1.2;dx+=0.3) for(let dz=0.6;dz<=1.5;dz+=0.3) out.push(Collision.depth(R.ox+(25.5+dx)*R.tw,R.oy+(1.5+dz)*R.th,PRAD,R)<1e-7);
          return out.filter(Boolean).length;})()""")
        self.assertEqual(got['free'], before)

    def test_leaving_quality_switch_and_cutscene_reuse(self):
        page = self.lab()
        page.evaluate("RT.portalOpen=1;PortalDevice.tick(0.016);window.g1=PortalDevice.P.group")
        self.assert_js(page, "GLR.scene.children.indexOf(g1)>=0")
        self.set_quality(page, 0)
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lab1")
        page.evaluate("PortalDevice.tick(0.016)")
        self.assert_js(page, "PortalDevice.P&&PortalDevice.P.group!==g1&&GLR.scene.children.indexOf(g1)<0&&PortalDevice.P.layers.length===1")
        self.set_quality(page, 2)
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lab1")
        page.evaluate("PortalDevice.tick(0.016)")
        self.assert_js(page, "PortalDevice.P.layers.length===3")
        # 结局演出：新建同一个模型的实例，常驻那台先藏起来，演完放回
        page.evaluate("CUT.enabled=true;playCut('portal',function(){window.cutDone=1});CUT.t=CUT.dur*0.3;render(0.016)")
        self.assert_js(page, "CUT.on&&CUT.data.P&&CUT.data.P.group!==PortalDevice.P.group&&!PortalDevice.P.group.visible&&CUT.data.P.state==='charge'")
        page.evaluate("CUT.t=CUT.dur*0.8;render(0.016)")
        self.assert_js(page, "CUT.data.P.state==='enter'&&CUT.data.P.inner.visible")
        page.evaluate("cutSkip()")
        self.assert_js(page, "!CUT.on&&window.cutDone===1&&PortalDevice.P.group.visible")
        page.evaluate("doEnterRoom('lab2');running=false;PortalDevice.tick(0.016)")
        self.assert_js(page, "!PortalDevice.P")
