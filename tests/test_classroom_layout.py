"""R1 教室重修：教学楼教室的布局（domain/classroom-layout.js）——座位数、同桌拼桌、过道宽度、讲台离黑板、
老师在自己班、同学坐法、黑板上的粉笔字浮在板面前，以及前墙和门上的字、讲台上的移交单。"""
from browser_case import BrowserCase


class ClassroomLayoutTest(BrowserCase):
    def enter(self, page):
        page.evaluate("doEnterRoom('teach1');running=false;S.screen='play';S.intro=0;")

    def test_every_classroom_has_32_seats_in_four_pair_groups(self):
        page = self.page()
        # 五层每间 32 个座位（4 排 × 8 张）；能坐的那张（P）每层都在自己班那间的同一处（teachFloor 每层都摆）
        self.assert_js(page, """['teach1','teach2','teach3','teach4','teach5'].every(id=>{var R=INTERIORS[id],L=ClassroomLayout;
            return L.spans.every((s,i)=>{var n=0,p=0;for(var r=1;r<15;r++)for(var c=s[0];c<=s[1];c++){var ch=R.grid[r][c];
              if(ch==='d'||ch==='P'){n++;if(!L.isDesk(c,r))return false;}if(ch==='P')p++;}
              return n===32&&p===(i===L.ownSeat.classId?1:0);})&&R.grid[L.ownSeat.row][L.ownSeat.col]==='P';})""")
        # 同桌：两张桌子往中间各挪 0.11 米，桌面 0.78 米宽，正好拼成一张双人桌（占地连在一起）
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,c=L.spans[0][0]+3;
            function zr(r){var f=R.foot[c+','+r];return [Math.min(...f.map(b=>b.z0)),Math.max(...f.map(b=>b.z1))];}
            return [[2,3],[5,6],[8,9],[11,12]].every(p=>Math.abs(zr(p[0])[1]-zr(p[1])[0])<0.01)
              &&Math.abs(L.deskAt(c,3).y-L.deskAt(c,2).y-0.78)<1e-9;})()""")

    def test_aisles_podium_and_teacher_positions(self):
        page = self.page()
        self.enter(page)
        # 组间三条过道（第 4、7、10 行）都有 1.4 米上下：按课桌占地量
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,c=L.spans[5][0]+3;
            function z0(r){return Math.min(...R.foot[c+','+r].map(b=>b.z0));} function z1(r){return Math.max(...R.foot[c+','+r].map(b=>b.z1));}
            return [[3,5],[6,8],[9,11]].every(p=>{var w=z0(p[1])-z1(p[0]);return w>1.35&&w<1.5;});})()""")
        # 讲台在第二列、正对黑板中线，中心离黑板 1.5 米；老师站在讲台和黑板之间，就在自己班
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,ok=true;
            L.spans.forEach((s,i)=>{var p=L.podium(i);ok=ok&&R.grid[p[1]][p[0]]==='T'&&p[1]===L.boardRow&&Math.abs((p[0]+.5)-s[0]-1.5)<1e-9;
              var t=L.teacherSpot(i);ok=ok&&t.x>s[0]&&t.x<p[0];});
            var ts=L.teacherSpot(L.ownSeat.classId),tw=worldToScene(R.ox+ts.x*R.tw,R.oy+ts.y*R.th,R);
            return ok&&!!NC.teacher&&Math.hypot(NC.teacher.position.x-tw.x,NC.teacher.position.z-tw.z)<1e-6;})()""")

    def test_classmates_fill_own_class_and_seat_on_the_chair(self):
        page = self.page()
        self.enter(page)
        # 自己班几乎坐满（同桌那张空着），别的教室稀，全层不超过 50 个
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,lay=Classmates.layout(R),per=[0,0,0,0,0,0];
            lay.seats.forEach(s=>{var i=L.classAt(s.c,s.r);if(i>=0)per[i]++;});
            var own=per[L.ownSeat.classId],others=per.filter((n,i)=>i!==L.ownSeat.classId);
            return lay.seats.length<=50&&own>=20&&own<=26&&others.every(n=>n<own)
              &&!lay.seats.some(s=>s.c===L.ownSeat.col&&s.r===L.ownSeat.row-1)&&!lay.seats.some(s=>s.c===L.ownSeat.col&&s.r===L.ownSeat.row);})()""")
        # 坐下时人在椅子上（和同学一样），不在格子中心
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,o=L.ownSeat,a=L.anchor(R,o),ch=L.chairAt(o.col,o.row);
            return Math.abs(a.x-(R.ox+ch.x*R.tw))<1e-6&&Math.abs(a.y-(R.oy+ch.y*R.th))<1e-6&&Math.abs(a.x-(R.ox+(o.col+.5)*R.tw))>0.2*R.tw;})()""")

    def test_chalk_note_floats_in_front_of_the_west_board(self):
        page = self.page()
        self.enter(page)
        # 「下一次」写在黑板上：字浮在板面前（板面离墙 8 厘米），整行在板面范围内
        page.evaluate("""var R=INTERIORS.teach1;S.x=R.ox+49.5*R.tw;S.y=R.oy+7.5*R.th;S.ang=Math.PI;S.pitch=0;anwSpawn();""")
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,v=new THREE.Vector3(),xs=[],zs=[];
            ANW.grp.updateMatrixWorld(true);ANW.grp.traverse(o=>{if(o.isMesh){o.getWorldPosition(v);xs.push(v.x);zs.push(v.z);}});
            var face=worldToScene(R.ox+L.spans[L.ownSeat.classId][0]*R.tw,R.oy+(L.boardRow+.5)*R.th,R);
            return xs.length>4&&Math.min(...xs)>face.x+0.08&&Math.max(...xs)<face.x+0.2
              &&Math.min(...zs)>face.z-2.4&&Math.max(...zs)<face.z+2.4;})()""")

    def test_signs_on_the_front_wall_doors_podium_and_own_desk(self):
        page = self.page()
        self.enter(page)
        # 每间：班训、课程表、值日表各一块；两扇门的门牌写班名；自己课桌上一张对折的名牌；讲台上一张移交单
        self.assert_js(page, """(()=>{var n={},d={};GLR.scene.traverse(o=>{var u=o.userData||{};if(u.wayfinding)n[u.wayfinding]=(n[u.wayfinding]||0)+1;if(u.decor)d[u.decor]=(d[u.decor]||0)+1;});
            return d['班训']===6&&d['课程表']===6&&d['值日表']===6&&d['名牌']===2&&n['移交单']===1&&n['高二（2）班']===2&&n['高三（1）班']===2&&!n['班训'];})()""")
        # 移交单平躺在转过 90° 的讲台台面上（在讲台占地以内）
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,pd=Investigation.podium(),slip=null;
            GLR.scene.traverse(o=>{if(o.userData&&o.userData.wayfinding==='移交单')slip=o;});
            var c=worldToScene(R.ox+(pd[0]+.5)*R.tw,R.oy+(pd[1]+.5)*R.th,R);
            return !!slip&&Math.abs(slip.position.x-c.x)<0.25&&Math.abs(slip.position.z-c.z)<0.35&&slip.position.y>0.95&&slip.position.y<1.0;})()""")
