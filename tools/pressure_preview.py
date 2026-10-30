"""草稿 PR #14 界面和条件布置验证：PYTHONPATH=tests python tools/pressure_preview.py。
在本机浏览器与临时存档中操作；截图不是自然收集通关或真实设备测试证据。
"""
import json
from pathlib import Path
from browser_case import BrowserCase
root=Path(__file__).resolve().parents[1];out=root/'pictures'/'校园压力';out.mkdir(parents=True,exist_ok=True)
c=BrowserCase('runTest');c.setUpClass();c.setUp();report={}
try:
    p=c.page();p.evaluate("Game.start('hard');clearIntroTimers();S.intro=0;AN.next=1000;PAT.next=1000;running=true;lastT=performance.now();")
    p.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&LESSON.available()")
    before=p.evaluate('S.tsec');p.keyboard.press('r');p.locator('#lesson').wait_for(state='visible')
    p.screenshot(path=str(out/'桌面课堂.png'))
    index=p.evaluate('LESSON_TASKS[LESSON.record().task].answer');p.locator('.lesson-options button').nth(index).click()
    p.keyboard.down('w');p.wait_for_timeout(400);p.keyboard.up('w')
    report['desktop_input']=p.evaluate('({clock:S.tsec,seated:S.seated,x:S.x,y:S.y,taskDone:Object.values(RT.lessons).some(r=>r.done)})')
    report['desktop_input']['clock_advanced']=report['desktop_input']['clock']>before
    p.evaluate("running=false;S.san=8;capStamina();for(let i=0;i<20;i++)render(.2)")
    p.screenshot(path=str(out/'低SAN身体反应.png'))
    report['low_san']=p.evaluate("({label:document.getElementById('sanfeel').textContent,stamina:S.stam,cap:staminaMax(),numericBar:!!document.getElementById('sanbar')})")
    p.evaluate("""S.san=100;GLR.sanSense=1;S.tsec=700;S.seated=false;S.eyeH=EYE;S.run=false;S.moving=true;let r=INTERIORS.teach1;
      S.x=r.ox+30.5*r.tw;S.y=r.oy+18.5*r.th;S.ang=0;S.pitch=0;Settings.bright(150);
      patReset();PAT.room='teach1';PAT.state='walk';PAT.locked=true;PAT.lock=1;
      PAT.x=S.x+70;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;PAT.blinkCD=.8;patAddFig();
      window.startPose=[PAT.x,PAT.y];patTick(.5);window.stillPose=[PAT.x,PAT.y];patTick(.31);
      syncCamera(0);render(.1);""")
    report['patrol']=p.evaluate('({start:startPose,waiting:stillPose,jumped:[PAT.x,PAT.y],red:VisualState.patrolRed,eyes:!!GLR.patFig.userData.eye,playerClear:canStand(S.x,S.y),brightness:SET.bright})')
    p.screenshot(path=str(out/'巡察者锁定.png'))
    q=c.page(touch=True);q.evaluate("Game.start('hard');clearIntroTimers();S.intro=0;AN.next=1000;PAT.next=1000;running=false;updateHUD()")
    q.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&LESSON.available()")
    q.wait_for_timeout(900);q.evaluate('syncCamera(0);render(.2)')
    q.locator('#lessonOpen').tap();q.screenshot(path=str(out/'触屏课堂.png'))
    q.locator('#lesson button').last.tap();report['touch_input']=q.evaluate('({closed:!LESSON.on,controls:playerInputAllowed(),done:LESSON.record().done})')
    p.evaluate("""patReset();S.dead=false;S.death=null;S.san=100;S.tt=0;S.day=2;S.seated=false;
      doEnterRoom('lab1');running=false;S.bag=['coil','lens','vial','battery'];RT.portalSketch=1;portalBench()""")
    p.locator('#choices button').first.click()
    p.wait_for_function("UI.chooseOpen&&document.getElementById('choices').textContent.includes('走进去')",timeout=10000)
    p.locator('#choices button').first.click()
    p.wait_for_function("S.screen==='end'&&RT.end==='portal'",timeout=10000)
    p.screenshot(path=str(out/'条件布置的传送门结局.png'))
    report['controlled_route']=p.evaluate("({ending:RT.end,screen:S.screen,materialsConsumed:!hasItem('coil')&&!hasItem('lens')&&!hasItem('vial')})")
    report['limitations']='课堂和移动使用真实键鼠/触屏输入；低 SAN 和巡察者画面由场景布置产生；传送门在准备材料、位置和状态后通过真实选项完成，不能视为自然收集通关。未自然游玩完整约44分钟的一天，未进行真机或音乐听感评估。'
    (out/'浏览器验证.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
finally:c.tearDown();c.tearDownClass()
