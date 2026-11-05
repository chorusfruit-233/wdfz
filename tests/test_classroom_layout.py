"""R1 教室重修：教学楼教室的布局（domain/classroom-layout.js，布局版本 4）——每层四间、从门进去宽大于深、座位数、
同桌拼桌、过道宽度、讲台离黑板、老师在自己班、同学坐法、黑板上的粉笔字浮在板面前，以及前墙和门上的字、讲台上的移交单。"""
from browser_case import BrowserCase


class ClassroomLayoutTest(BrowserCase):
    def enter(self, page):
        page.evaluate("doEnterRoom('teach1');running=false;S.screen='play';S.intro=0;")

    def test_classrooms_are_wider_along_the_corridor_than_deep(self):
        page = self.page()
        # 每层四间。每间沿走廊 11 米、进深 8 米：北墙（窗）、东西两面隔墙是实墙，走廊那面墙（长边）开前后两扇门。
        # 从门进去左右宽、往里浅；教室以北和楼两头不用，填实
        self.assert_js(page, """['teach1','teach2','teach3','teach4','teach5'].every(id=>{var R=INTERIORS[id],L=ClassroomLayout,r0=L.rows[0],r1=L.rows[1];
            return L.spans.length===4&&L.spans.every((s,i)=>{var w=s[1]-s[0]+1,d=r1-r0+1,ok=w===11&&d===8&&w>d;
              for(var r=r0;r<=r1;r++)ok=ok&&R.grid[r][s[0]-1]==='#'&&R.grid[r][s[1]+1]==='#';
              for(var c=s[0];c<=s[1];c++)ok=ok&&R.grid[r0-1][c]==='#'&&(R.grid[r1+1][c]==='='||R.grid[r1+1][c]==='#');
              var doors=L.doors(i);
              return ok&&doors.length===2&&doors.every(d=>d[1]===r1+1&&R.grid[d[1]][d[0]]==='='&&R.grid[d[1]-1][d[0]]==='.'&&R.grid[d[1]+1][d[0]]==='.')
                &&doors[1][0]-doors[0][0]===8;})
              &&R.grid.slice(1,r0).every(row=>row.every(ch=>ch==='#'));})""")

    def test_wall_side_desks_are_reached_from_the_aisle(self):
        page = self.page()
        self.enter(page)
        # 靠窗那组同桌的外侧那张贴着北墙：站在第 9 行的过道里、斜着瞄过去就能选中它（隔着同桌的桌子，不隔墙），靠走廊那组同理
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,c0=L.spans[0][0],ok=true;
            [[c0+4,L.deskRows[0],L.deskRows[1]+1.2,-1],[c0+4,L.deskRows[5],L.deskRows[4]-0.2,1]].forEach(t=>{
              S.mode='in';S.room='teach1';S.seated=false;S.x=R.ox+(t[0]+1.3)*R.tw;S.y=R.oy+t[2]*R.th;
              S.ang=Math.atan2((t[1]+.5-t[2]),(t[0]+.5-(t[0]+1.3)));
              var hit=nearWorld(24);ok=ok&&Collision.depth(S.x,S.y,PRAD)<1e-7&&!!hit&&hit.c===t[0]&&hit.r===t[1]&&hit.ch==='d';});
            return ok;})()""")

    def test_every_classroom_has_42_seats_in_three_pair_groups(self):
        page = self.page()
        # 五层每间 42 个座位（三组同桌 × 七排）；能坐的那张（P）每层都在自己班那间的同一处（teachFloor 每层都摆）
        self.assert_js(page, """['teach1','teach2','teach3','teach4','teach5'].every(id=>{var R=INTERIORS[id],L=ClassroomLayout;
            return L.spans.every((s,i)=>{var n=0,p=0;for(var r=L.rows[0];r<=L.rows[1];r++)for(var c=s[0];c<=s[1];c++){var ch=R.grid[r][c];
              if(ch==='d'||ch==='P'){n++;if(!L.isDesk(c,r))return false;}if(ch==='P')p++;}
              return n===42&&p===(i===L.ownSeat.classId?1:0);})&&R.grid[L.ownSeat.row][L.ownSeat.col]==='P';})""")
        # 本人座位：自己班第二排、中间那组靠南的一张
        self.assert_js(page, """(()=>{var L=ClassroomLayout,o=L.ownSeat,s=L.spans[o.classId];
            return o.seatId==='teach1:48:11'&&o.col-s[0]===L.deskCols[1]&&o.row===L.deskRows[3];})()""")
        # 同桌：两张桌子往中间各挪 0.11 米，桌面 0.78 米宽，正好拼成一张双人桌（占地连在一起）
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,c=L.spans[0][0]+3;
            function zr(r){var f=R.foot[c+','+r];return [Math.min(...f.map(b=>b.z0)),Math.max(...f.map(b=>b.z1))];}
            return [[7,8],[10,11],[13,14]].every(p=>Math.abs(zr(p[0])[1]-zr(p[1])[0])<0.01)
              &&Math.abs(L.deskAt(c,8).y-L.deskAt(c,7).y-0.78)<1e-9;})()""")

    def test_aisles_podium_and_teacher_positions(self):
        page = self.page()
        self.enter(page)
        # 组间两条过道（第 9、12 行）都有 1.4 米上下：按课桌占地量
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,c=L.spans[3][0]+3;
            function z0(r){return Math.min(...R.foot[c+','+r].map(b=>b.z0));} function z1(r){return Math.max(...R.foot[c+','+r].map(b=>b.z1));}
            return [[8,10],[11,13]].every(p=>{var w=z0(p[1])-z1(p[0]);return w>1.35&&w<1.5;});})()""")
        # 讲台格在第二列；模型画在教室中线上、中心离黑板 1.5 米；老师站在讲台和黑板之间，就在自己班
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,ok=true;
            L.spans.forEach((s,i)=>{var p=L.podium(i),a=L.podiumAt(i);ok=ok&&R.grid[p[1]][p[0]]==='T'&&p[1]===L.boardRow&&p[0]===s[0]+1
              &&Math.abs(a.x-s[0]-1.5)<1e-9&&Math.abs(a.y-L.mid)<1e-9&&Math.abs(L.mid-(L.rows[0]+L.rows[1]+1)/2)<1e-9;
              var t=L.teacherSpot(i);ok=ok&&t.x>s[0]&&t.x<a.x&&Math.abs(t.y-L.mid)<1e-9;});
            var ts=L.teacherSpot(L.ownSeat.classId),tw=worldToScene(R.ox+ts.x*R.tw,R.oy+ts.y*R.th,R);
            return ok&&!!NC.teacher&&Math.hypot(NC.teacher.position.x-tw.x,NC.teacher.position.z-tw.z)<1e-6;})()""")

    def test_classmates_fill_own_class_and_seat_on_the_chair(self):
        page = self.page()
        self.enter(page)
        # 自己班几乎坐满（同桌那张空着，最多 36 个），别的教室稀，全层不超过 50 个
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,lay=Classmates.layout(R),per=[0,0,0,0];
            lay.seats.forEach(s=>{var i=L.classAt(s.c,s.r);if(i>=0)per[i]++;});
            var own=per[L.ownSeat.classId],others=per.filter((n,i)=>i!==L.ownSeat.classId);
            return lay.seats.length<=50&&own>=28&&own<=36&&others.every(n=>n<own)
              &&!lay.seats.some(s=>s.c===L.ownSeat.col&&s.r===L.ownSeat.row-1)&&!lay.seats.some(s=>s.c===L.ownSeat.col&&s.r===L.ownSeat.row);})()""")
        # 坐下时人在椅子上（和同学一样），不在格子中心
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,o=L.ownSeat,a=L.anchor(R,o),ch=L.chairAt(o.col,o.row);
            return Math.abs(a.x-(R.ox+ch.x*R.tw))<1e-6&&Math.abs(a.y-(R.oy+ch.y*R.th))<1e-6&&Math.abs(a.x-(R.ox+(o.col+.5)*R.tw))>0.2*R.tw;})()""")

    def test_chalk_note_floats_in_front_of_the_west_board(self):
        page = self.page()
        self.enter(page)
        # 「下一次」写在黑板上：字浮在板面前（板面离墙 8 厘米），整行在板面范围内
        page.evaluate("""var R=INTERIORS.teach1,L=ClassroomLayout;S.x=R.ox+(L.spans[L.ownSeat.classId][0]+4.5)*R.tw;S.y=R.oy+L.mid*R.th;S.ang=Math.PI;S.pitch=0;anwSpawn();""")
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,v=new THREE.Vector3(),xs=[],zs=[];
            ANW.grp.updateMatrixWorld(true);ANW.grp.traverse(o=>{if(o.isMesh){o.getWorldPosition(v);xs.push(v.x);zs.push(v.z);}});
            var face=worldToScene(R.ox+L.spans[L.ownSeat.classId][0]*R.tw,R.oy+L.mid*R.th,R);
            return xs.length>4&&Math.min(...xs)>face.x+0.08&&Math.max(...xs)<face.x+0.2
              &&Math.min(...zs)>face.z-2.4&&Math.max(...zs)<face.z+2.4;})()""")

    def test_signs_on_the_front_wall_doors_podium_and_own_desk(self):
        page = self.page()
        self.enter(page)
        # 每间：班训、课程表、值日表各一块；两扇门的门牌写班名；自己课桌上一张对折的名牌（两片都朝外，单面材质）；讲台上一张移交单
        self.assert_js(page, """(()=>{var n={},d={},cards=[];GLR.scene.traverse(o=>{var u=o.userData||{};if(u.wayfinding)n[u.wayfinding]=(n[u.wayfinding]||0)+1;
              if(u.decor)d[u.decor]=(d[u.decor]||0)+1;if(u.decor==='名牌')cards.push(o);});
            var v=new THREE.Vector3(),facing=cards.map(o=>{v.set(0,0,1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));return Math.sign(v.x);}).sort();
            return d['班训']===4&&d['课程表']===4&&d['值日表']===4&&d['名牌']===2&&n['移交单']===1&&n['高二（2）班']===2&&n['高三（1）班']===2&&!n['班训']
              &&cards.every(o=>o.material.side===THREE.FrontSide)&&facing.join()==='-1,1';})()""")
        # 移交单平躺在转过 90° 的讲台台面上（讲台模型在中线上，移交单在它的占地以内）
        self.assert_js(page, """(()=>{var R=INTERIORS.teach1,L=ClassroomLayout,pa=L.podiumAt(L.ownSeat.classId),slip=null;
            GLR.scene.traverse(o=>{if(o.userData&&o.userData.wayfinding==='移交单')slip=o;});
            var c=worldToScene(R.ox+pa.x*R.tw,R.oy+pa.y*R.th,R);
            return !!slip&&Math.abs(slip.position.x-c.x)<0.25&&Math.abs(slip.position.z-c.z)<0.35&&slip.position.y>0.95&&slip.position.y<1.0;})()""")
