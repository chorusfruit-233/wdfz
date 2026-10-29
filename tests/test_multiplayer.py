"""房主程序与两个真实浏览器的连接原型回归。"""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from browser_case import BrowserCase


class MultiplayerBrowserTest(BrowserCase):
    @classmethod
    def setUpClass(cls):
        node = shutil.which('node')
        if not node:
            raise unittest.SkipTest('联机测试需要 Node.js')
        root = Path(__file__).resolve().parents[1]
        check = subprocess.run([node, '-e', "require('ws')"], cwd=root, capture_output=True)
        if check.returncode:
            raise unittest.SkipTest('联机测试需要先执行 npm install')
        super().setUpClass()
        script = ("const a=require('./server').createHostServer({graceMs:60000});"
                  "a.server.listen(0,'127.0.0.1',()=>console.log(a.server.address().port));"
                  "process.on('SIGTERM',()=>a.close().then(()=>process.exit(0)));")
        cls.host = subprocess.Popen([node, '-e', script], cwd=root, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, text=True)
        line = cls.host.stdout.readline().strip()
        if not line.isdigit():
            error = cls.host.stderr.read()
            super().tearDownClass()
            raise RuntimeError('房主测试服务启动失败：' + error)
        cls.host_url = 'http://127.0.0.1:' + line + '/'

    @classmethod
    def tearDownClass(cls):
        cls.host.terminate()
        try:
            cls.host.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.host.kill()
            cls.host.wait(timeout=5)
        cls.host.stdout.close()
        cls.host.stderr.close()
        super().tearDownClass()

    def client(self, touch=False):
        context = self.browser.new_context(
            viewport={'width': 390, 'height': 844} if touch else {'width': 1000, 'height': 700},
            has_touch=touch, is_mobile=touch, device_scale_factor=1,
        )
        self.contexts.append(context)
        context.add_init_script("""localStorage.setItem('wdfz_pro','1');
            localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));""")
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.host_url, wait_until='load')
        return page

    def test_two_browsers_join_move_reconnect_and_keep_solo_saves(self):
        host, guest = self.client(), self.client()
        for page, marker in ((host, 'host'), (guest, 'guest')):
            page.evaluate("marker => { localStorage.setItem('wdfz3d',JSON.stringify({marker}));"
                          "localStorage.setItem('wdfz3d_ends',JSON.stringify({marker})); }", marker)
        self.assertEqual(set(host.evaluate('SharedZones.ids')),
                         set(host.evaluate("['out'].concat(Object.keys(INTERIORS))")))
        root = Path(__file__).resolve().parents[1]
        source = ("const rooms=require('./server/world').rooms;"
                  "const out=Object.fromEntries(Object.entries(rooms).map(([id,r])=>"
                  "[id,{ox:r.ox,oy:r.oy,w:r.w,h:r.h,grid:r.grid}]));"
                  "process.stdout.write(JSON.stringify(out));")
        server_world = json.loads(subprocess.check_output(['node', '-e', source], cwd=root))
        browser_world = host.evaluate("Object.fromEntries(Object.entries(INTERIORS).map(([id,r])=>"
                                      "[id,{ox:r.ox,oy:r.oy,w:r.w,h:r.h,grid:r.grid.map(row=>row.join(''))}]))")
        self.assertEqual(server_world, browser_world)

        host.locator('#mpOpen').click()
        host.locator('#mpName').fill('房主')
        host.locator('#mpCreate').click()
        host.locator('#mpRoom').wait_for(state='visible')
        code = host.locator('#mpRoomCode').inner_text()
        self.assertEqual(len(code), 6)
        guest.locator('#mpOpen').click()
        guest.locator('#mpName').fill('<b>队友</b>')
        guest.locator('#mpCode').fill(code)
        guest.locator('#mpJoin').click()
        guest.locator('#mpRoom').wait_for(state='visible')
        host.wait_for_function('Multiplayer.room&&Multiplayer.room.players.length===2')
        self.assertIn('<b>队友</b>', host.locator('#mpPlayers').inner_text())
        self.assertEqual(host.locator('#mpPlayers b').count(), 0)
        host.locator('#mpReady').click()
        guest.locator('#mpReady').click()
        host.locator('#mpStart').wait_for(state='visible')
        host.wait_for_function("!document.getElementById('mpStart').disabled")
        host.locator('#mpStart').click()

        for page in (host, guest):
            page.wait_for_function("Multiplayer.playing&&!Multiplayer.waitingForScene&&S.room==='teach1'"
                                   "&&GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'", timeout=20000)
            page.wait_for_function("Object.values(ThreeBackend.remoteActors).some(a=>a.mesh.visible)", timeout=20000)
        self.assert_js(host, "Array.from({length:4},(_,slot)=>{let r=INTERIORS.teach1;"
                       "return Collision.depth(r.ox+(45+slot*2+.5)*r.tw,r.oy+18.5*r.th,PRAD,r)<1e-7;})"
                       ".every(Boolean)")
        host.bring_to_front()
        host.evaluate("if(PAUSE.on)Game.resume();S.ang=0;window._before=[S.x,S.y]")
        host.locator('#cv').focus()
        host.keyboard.down('w')
        try:
            host.wait_for_function("Math.hypot(S.x-_before[0],S.y-_before[1])>2", timeout=20000)
        finally:
            host.keyboard.up('w')
        moved = host.evaluate('({x:S.x,y:S.y})')
        guest.wait_for_function("p=>Object.values(Multiplayer.peerPoses).some(a=>"
                                "Math.hypot(a.x-p.x,a.y-p.y)<3)", arg=moved, timeout=8000)

        guest_id = guest.evaluate('Multiplayer.selfId')
        guest.evaluate("doEnterRoom('lab1')")
        host.wait_for_function("id=>Multiplayer.peerPoses[id]&&Multiplayer.peerPoses[id].zone==='lab1'&&"
                               "ThreeBackend.remoteActors[id]&&!ThreeBackend.remoteActors[id].mesh.visible",
                               arg=guest_id, timeout=12000)
        guest.evaluate("doEnterRoom('teach1')")
        host.wait_for_function("id=>Multiplayer.peerPoses[id]&&Multiplayer.peerPoses[id].zone==='teach1'&&"
                               "ThreeBackend.remoteActors[id]&&ThreeBackend.remoteActors[id].mesh.visible",
                               arg=guest_id, timeout=12000)
        host.evaluate("Settings.q(1);render(.016)")
        self.assert_js(host, "Object.values(ThreeBackend.remoteActors).every(a=>"
                       "a.mesh.geometry===figGeo(a.seated?'sit':'person'))")
        guest.reload(wait_until='load')
        host.wait_for_function("id=>Multiplayer.room.players.some(p=>p.id===id&&!p.connected)", arg=guest_id, timeout=8000)
        guest.locator('#mpOpen').click()
        guest.locator('#mpResume').click()
        guest.wait_for_function("id=>Multiplayer.selfId===id&&Multiplayer.playing&&!Multiplayer.waitingForScene",
                                arg=guest_id, timeout=20000)
        for page, marker in ((host, 'host'), (guest, 'guest')):
            self.assertFalse(page.evaluate('saveGame()'))
            page.evaluate("clearSave();endMark('car')")
            self.assertEqual(page.evaluate("JSON.parse(localStorage.getItem('wdfz3d')).marker"), marker)
            self.assertEqual(page.evaluate("JSON.parse(localStorage.getItem('wdfz3d_ends')).marker"), marker)
        guest.evaluate('Game.quit()')
        host.wait_for_function('Multiplayer.room.players.length===1', timeout=8000)
        self.assert_js(host, "Object.keys(ThreeBackend.remoteActors).length===0")
        host.evaluate('Game.quit()')

    def test_touch_room_panel_can_be_opened_and_closed(self):
        page = self.client(touch=True)
        page.locator('#mpOpen').tap()
        self.assertTrue(page.locator('#mpLobby').is_visible())
        self.assertIn('暂不能合作通关', page.locator('#mpLobby').inner_text())
        page.locator('#mpCreate').tap()
        page.locator('#mpRoom').wait_for(state='visible')
        page.locator('#mpClose').tap()
        self.assertTrue(page.locator('#mpLobby').is_hidden())


if __name__ == '__main__':
    unittest.main(verbosity=2)
