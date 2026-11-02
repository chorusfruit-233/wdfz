"""布置条件的界面与 3D 分镜截图，不代表正常收集通关或真机测试。"""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests'))
from test_network_lifecycle import NetworkLifecycleTest


def main():
    out = ROOT / 'pictures' / '巡察手机网络'
    out.mkdir(parents=True, exist_ok=True)
    NetworkLifecycleTest.setUpClass()
    case = NetworkLifecycleTest()
    case.setUp()
    records = []
    try:
        def capture(p, name):
            p.evaluate('render(0)')
            p.screenshot(path=str(out / name))
            records.append(dict(file=name, viewport=p.viewport_size))

        p = case.game()
        case.ready(p)
        p.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lab3")
        p.evaluate("TerminalUI.execute('cat /school/README');")
        capture(p, '01-桌面终端.png')
        p.evaluate('TerminalUI.close();PHONE.start();')
        capture(p, '02-手机应用.png')
        p.evaluate("PHONE.stop();CUT.enabled=true;playCut('cyber',function(){S.screen='play';});")
        for t, name in ((1, '03-服务器.png'), (5, '04-走廊.png'), (9, '05-档案.png'), (13, '06-校园.png')):
            p.evaluate('t=>{CUT.t=t;render(0);}', t)
            capture(p, name)
        p.evaluate('cutSkip()')
        if p.evaluate('Lifecycle.snapshot().errors.length'):
            raise AssertionError(p.evaluate('Lifecycle.snapshot().errors'))
        mobile = case.game(touch=True)
        case.ready(mobile)
        mobile.evaluate("TerminalUI.execute('help');")
        capture(mobile, '07-竖屏终端.png')
        mobile.set_viewport_size(dict(width=390, height=340))
        mobile.wait_for_function("document.getElementById('campus-terminal').getBoundingClientRect().bottom<=innerHeight+1")
        capture(mobile, '08-短屏终端.png')
        mobile.evaluate('TerminalUI.close();PHONE.start();')
        mobile.set_viewport_size(dict(width=390, height=844))
        mobile.wait_for_timeout(300)
        capture(mobile, '09-竖屏手机.png')
        mobile.evaluate("PHONE.stop();CUT.enabled=true;playCut('cyber',function(){S.screen='play';});CUT.t=9;")
        capture(mobile, '10-竖屏档案.png')
        mobile.evaluate('cutSkip()')
        (out / '截图记录.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(dict(screenshots=len(records), pageErrors=case.errors), ensure_ascii=False))
    finally:
        try:
            case.tearDown()
        finally:
            NetworkLifecycleTest.tearDownClass()


if __name__ == '__main__':
    main()
