"""给穿模点拍照：python tools/clip_view.py out_dir room:x:y:z[:dist[:yaw]] ...（房间 out 表示室外；坐标是场景米）"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os, shutil, sys, threading, time
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a): pass
def main():
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        b = pw.chromium.launch(executable_path=exe, headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        p = b.new_page(viewport={'width': 640, 'height': 400})
        p.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:%s,amb:0,vol:0}))" % os.environ.get('Q', '2'))
        p.goto(f'http://127.0.0.1:{srv.server_port}/index.html'); p.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
        p.evaluate("Game.start('easy');")
        time.sleep(1.5)
        p.evaluate("clearIntroTimers();running=false;S.screen='cut';document.getElementById('hud').style.display='none';var st=document.createElement('style');st.textContent='#sub,#banner,.screen-control,#toast,#lookhint{display:none!important}';document.head.appendChild(st);AN.next=1e9;PAT.next=1e9;S.tsec=760;")
        for i, spec in enumerate(sys.argv[2:]):
            f = spec.split(':'); room = f[0]; x, y, z = map(float, f[1:4])
            dist = float(f[4]) if len(f) > 4 else 2.2; yaw = float(f[5]) if len(f) > 5 else 0.7
            p.evaluate("""([room,x,y,z,dist,yaw])=>{
              if(room==='out'){ if(S.mode!=='out'||!GLR.outMesh){ S.mode='out';S.room=null;enterWorldOut(); } }
              else if(S.room!==room||S.mode!=='in'){ S.mode='in';S.room=room;doEnterRoom(room);running=false;S.screen='cut'; }
              /* 八个方向里挑一个：机位不在墙里、到目标的视线不被墙挡、离开得最远 */
              var R=room==='out'?null:INTERIORS[room];
              function solidS(px,pz){ if(!R) return solidAtOutdoor(px/U2M,pz/U2M); return solidAtInterior(R,(px+R.cols*R.tw*U2M/2)/U2M+R.ox,(pz+R.rows*R.th*U2M/2)/U2M+R.oy)&&tileAt(R,(px+R.cols*R.tw*U2M/2)/U2M+R.ox,(pz+R.rows*R.th*U2M/2)/U2M+R.oy)==='#'; }
              var best=null;
              for(var k=0;k<16;k++){
                var a=yaw+k*Math.PI/8, ok=0;
                for(var d=0.3;d<=dist;d+=0.1){ if(solidS(x+Math.cos(a)*d,z+Math.sin(a)*d)) break; ok=d; }
                if(!best||ok>best[1]+0.05) best=[a,ok];
              }
              var dd=Math.max(0.6,best[1]-0.1), cy=R?Math.min(2.7,Math.max(0.5,y+dd*0.5)):Math.max(0.5,y+dd*0.3);
              GLR.cam.position.set(x+Math.cos(best[0])*dd,cy,z+Math.sin(best[0])*dd); GLR.cam.lookAt(x,y,z);
              S.tsec=760; for(var k=0;k<2;k++) render(0.016);
            }""", [room, x, y, z, dist, yaw])
            time.sleep(0.3)
            p.screenshot(path=str(out / f'{i:02d}_{room}.png'))
        b.close()
    srv.shutdown()
if __name__ == '__main__':
    main()
