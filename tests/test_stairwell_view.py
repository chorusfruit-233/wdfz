"""楼梯间的模型与楼梯间里的异象（2026-11-06，按用户安卓截图修）：
梯段是实心的（底下有斜底板），一楼楼梯底下有地面；楼梯口的平台不伸进走廊叠在走廊地面上；
「黑板上的字」「被划掉的名字」要挂在墙上，不在楼梯间出现。"""
from browser_case import BrowserCase


class StairwellViewTest(BrowserCase):
    def shaft(self, page, sid='stair_teach_w'):
        return page.evaluate("""sid=>{
          const R=INTERIORS[sid],g=StairView.build(R);g.updateMatrixWorld(true);
          const rc=new THREE.Raycaster(),hit=(o,d)=>{rc.set(new THREE.Vector3(...o),new THREE.Vector3(...d).normalize());rc.far=20;
            const h=rc.intersectObject(g,true)[0];return h?{y:+h.point.y.toFixed(3),mat:h.object.userData.matKey||''}:null;};
          let zmin=Infinity;g.traverse(o=>{if(o.isMesh&&o.userData.matKey==='fterrazzo'){const b=new THREE.Box3().setFromObject(o);zmin=Math.min(zmin,b.min.z);}});
          const s=StairWorld.config(sid);
          const out={
            underFlight2:hit([1.25,1.0,3.0],[0,-1,0]),        // 一楼第二段梯段底下：往下是地面，不是空洞
            underFlight1:hit([-1.25,0.05,3.0],[0,1,0]),       // 第一段梯段下面往上看：先碰到底板（比踏面低）
            besideFlight1:hit([-0.1,0.6,3.0],[-1,0,0]),        // 从楼梯井往旁边看梯段侧面：碰到的是侧梁或梯身，不是空
            zmin:+zmin.toFixed(3),door:StairGeometry.config.door,levels:s.rooms.length,rise:s.rise};
          ThreeBackend.disposeGroup(g);return out;}""", sid)

    def test_flights_are_solid_and_the_ground_floor_is_closed(self):
        page = self.page()
        for sid in ('stair_teach_w', 'stair_dormN', 'stair_garage'):
            with self.subTest(stair=sid):
                r = self.shaft(page, sid)
                self.assertIsNotNone(r['underFlight2'])
                self.assertAlmostEqual(r['underFlight2']['y'], 0, places=2)
                self.assertIsNotNone(r['underFlight1'])
                # 第一段梯段在 z=3 处的踏面高度约 0.47×层高/3.2；底板在踏面以下 0.22 米
                tread = r['rise'] * 0.5 * (3.0 - 0.8) / 4.8
                self.assertLess(r['underFlight1']['y'], tread - 0.15)
                self.assertIsNotNone(r['besideFlight1'])
                self.assertGreaterEqual(r['zmin'], r['door'] - 0.5 - 1e-3)   # 平台只铺到楼梯口那一格

    def test_wall_anomalies_do_not_appear_in_stairwells(self):
        page = self.page()
        r = page.evaluate("""()=>{
          const p=StairWorld.point('stair_teach_w',{x:0,z:-0.5,h:0});doEnterRoom(p.scene,{x:p.x,y:p.y,stairHeight:0});
          const st={chalk:AN_DEFS.chalk.when(),roster:AN_DEFS.roster.when()};
          doEnterRoom('teach1');const cl={chalk:AN_DEFS.chalk.when(),roster:AN_DEFS.roster.when()};
          return {st,cl};}""")
        self.assertEqual(r['st'], {'chalk': False, 'roster': False})
        self.assertEqual(r['cl'], {'chalk': True, 'roster': True})
