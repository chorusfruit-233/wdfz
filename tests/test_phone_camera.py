"""《校园怪谈创意提案》C11 手机相机：每种异象都有照片内容、不耗电、闪光与巡察者、相册跟存档走、隐藏异象不进 Wiki。"""
import re
from pathlib import Path
from browser_case import BrowserCase


class PhoneCameraTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';addItem('phone');PhoneNetwork.device.battery=60;true;")
        return page

    def test_every_anomaly_has_a_photo_and_secret_ones_are_marked(self):
        page = self.game()
        r = page.evaluate("()=>({ids:AN_ID.slice(),photo:Object.keys(PHOTO),secret:Object.keys(PHOTO).filter(k=>PHOTO[k].secret),internal:ACH_INTERNAL_ANOMALIES.slice()})")
        missing = [i for i in r['ids'] if i not in r['photo']]
        self.assertEqual(missing, [])
        self.assertIn('crowd', r['photo'])                 # 电梯里的那一种也做了
        self.assertEqual(sorted(r['secret']), sorted(r['internal']))

    def test_shooting_costs_no_battery_and_anomaly_shows_up_only_in_the_photo(self):
        page = self.game()
        r = page.evaluate("""()=>{PHONE.start();PHONE.selectApp('camera');const out={};out.app=!!document.querySelector('#phtool [data-action="shoot"]');
          const b0=PhoneNetwork.device.battery,san=S.san,before=JSON.stringify(AN);
          const plain=PhoneCamera.shoot();out.plain=plain.cap;out.img=plain.img.slice(0,15);
          AN.active=true;AN.id='turn';AN.t=1;AN.data={};const ghost=PhoneCamera.shoot();out.ghost=ghost.cap;out.an=ghost.an;
          out.anSame=JSON.stringify(AN)===JSON.stringify(Object.assign(JSON.parse(before),{active:true,id:'turn',t:1,data:{}}));
          out.battery=PhoneNetwork.device.battery-b0;out.san=S.san-san;out.album=document.querySelectorAll('#phtool .phalbum figure').length;
          out.clue=JSON.stringify(Investigation.state?Investigation.state():RT.investigation||{}).indexOf('肩膀后面')>=0;
          AN.active=false;return out;}""")
        self.assertTrue(r['app'])
        self.assertEqual(r['plain'], '照片里什么也没有。')
        self.assertTrue(r['img'].startswith('data:image/'))
        self.assertIn('肩膀后面', r['ghost'])
        self.assertEqual(r['an'], 'turn')
        self.assertTrue(r['anSame'])                       # 拍照不改异象
        self.assertEqual(r['battery'], 0)                  # 不额外耗电
        self.assertEqual(r['san'], 0)
        self.assertEqual(r['album'], 2)

    def test_flash_draws_the_patrol_only_when_on_and_it_can_see_you(self):
        page = self.game()
        r = page.evaluate("""()=>{PHONE.start();PHONE.selectApp('camera');const out={};
          PAT.state='walk';PAT.room='teach1';PAT.x=S.x+40;PAT.y=S.y;PAT.lock=0;PAT.locked=false;
          const los=PatrolNav.los(PatrolWorld.position(),PatrolNav.point('teach1',S.x,S.y,S.floorY));out.los=los;
          RT.cameraFlash=0;PhoneCamera.shoot();out.off=PAT.lock;
          RT.cameraFlash=1;PhoneCamera.shoot();out.on=PAT.lock;out.seen=!!PAT.lastSeen;
          PAT.lock=0;PAT.lastSeen=null;PAT.room='lab2';PhoneCamera.shoot();out.other=PAT.lock;
          document.querySelector('#phtool [data-action="flash"]').click();out.btn=document.querySelector('#phtool [data-action="flash"]').textContent;out.flag=RT.cameraFlash;
          return out;}""")
        if r['los']:
            self.assertEqual(r['off'], 0)
            self.assertGreaterEqual(r['on'], 0.85)
            self.assertTrue(r['seen'])
        self.assertEqual(r['other'], 0)                    # 不在同一个场景：看不见闪光
        self.assertEqual((r['btn'], r['flag']), ('闪光：关', 0))

    def test_album_is_capped_and_saved_and_no_battery_means_no_camera(self):
        page = self.game()
        r = page.evaluate("""()=>{PHONE.start();PHONE.selectApp('camera');for(let i=0;i<9;i++){S.tsec+=1;PhoneCamera.shoot();}const n=RT.photos.length;
          autoSave();const sv=loadGame();freshState('hard');running=false;applySave(sv);const kept=(RT.photos||[]).length;
          PHONE.stop&&PHONE.stop();PhoneNetwork.device.battery=0;let opened=false;try{PHONE.start();opened=PHONE.on;}catch(e){}
          return {n,kept,opened};}""")
        self.assertEqual(r['n'], 6)
        self.assertEqual(r['kept'], 6)
        self.assertFalse(r['opened'])

    def test_secret_photo_text_stays_out_of_the_wiki(self):
        wiki = Path(__file__).resolve().parents[1].joinpath('wiki', 'index.html').read_text(encoding='utf-8')
        page = self.page()
        caps = page.evaluate("()=>Object.keys(PHOTO).filter(k=>PHOTO[k].secret).map(k=>PHOTO[k].cap)")
        for cap in caps:
            self.assertNotIn(cap, wiki)
        self.assertNotIn('电梯里挤满了人', wiki)
