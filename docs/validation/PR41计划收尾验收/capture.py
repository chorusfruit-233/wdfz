import hashlib,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[3];sys.path.insert(0,str(root/'tests'));sys.path.insert(0,str(root/'tools'))
from test_broadcast import BroadcastTest
from renderer_audit import runtime_digest
out=root/'pictures/广播站与放学';rows=[]
BroadcastTest.setUpClass();case=BroadcastTest();case.setUp()
try:
 p=case.game();case.set_quality(p,1)
 p.evaluate("prepareRadio();SET.grain=0;Engine.grain(0);S.ang=-Math.PI/2;S.pitch=-.08;Sensory.reset();syncCamera(0);render(0)")
 def snap(name,phase):
  p.screenshot(path=str(out/name),timeout=60000)
  row=p.evaluate("({backend:Engine.status(),quality:QUALITY,scene:S.room,cut:CUT.id,time:CUT.t,camera:GLR.cam.position.toArray(),errors:GameModules.errors(),lifecycle:Lifecycle.snapshot().errors})")
  row.update(image=name,phase=phase);rows.append(row)
 snap('01-广播站.png','受控广播站场景')
 p.evaluate('BroadcastUI.open();BroadcastUI.paint();render(0)');snap('02-话筒与稿纸.png','非暂停读稿界面');p.evaluate('BroadcastUI.close();CUT.enabled=true;playCut("dismissal",()=>{S.screen="play"})')
 for t,name in [(1.8,'03-广播.png'),(5.5,'04-全班起身.png'),(9.8,'05-楼梯人流.png'),(12.5,'08-登记簿.png'),(14.3,'06-校门.png'),(16.2,'09-教学楼熄灯前.png'),(17.1,'10-教学楼熄灯后.png')]:
  p.evaluate('t=>{CUT.t=t;cutTick(0);render(0)}',t);snap(name,'《放学》受控演出取样')
 p.evaluate('cutSkip();deathFX("misread",{preview:true});anfxUpdate(1.5);render(0)');snap('07-念错了.png','死亡预览，不改变玩家状态');p.evaluate('anfxClear()')
 p=case.game(touch=True);p.evaluate('prepareRadio();SET.grain=0;Engine.grain(0);BroadcastUI.open();BroadcastUI.paint();render(0)')
 for w,h,name in [(390,844,'11-手机竖屏.png'),(844,390,'12-手机横屏.png')]:
  p.set_viewport_size({'width':w,'height':h});p.evaluate('render(0)');snap(name,'触屏模拟')
 assert not case.errors,case.errors
 report={'kind':'受控真实 WebGL 帧；软件 GPU 与触屏模拟，不是自然通关、硬件性能或真机验收','chromium':case.browser.version,'sourceSHA256':runtime_digest(),'cssSHA256':{str(q.relative_to(root)):hashlib.sha256(q.read_bytes()).hexdigest() for q in sorted((root/'game3d/css').glob('*.css'))},'captures':rows}
 (root/'docs/validation/PR41计划收尾验收/画面取样.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'images':len(rows),'errors':case.errors,'sourceSHA256':report['sourceSHA256']},ensure_ascii=False),flush=True)
finally:
 case.tearDown();BroadcastTest.tearDownClass()
