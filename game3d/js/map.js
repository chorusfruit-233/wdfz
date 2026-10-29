/* 里世界 3D · 地图数据：室内网格、校园物件、校门与边界 */
'use strict';

function blank(w,h,c){
  var g=[],y,x;
  for(y=0;y<h;y++){ var r=[]; for(x=0;x<w;x++) r.push(c||'.'); g.push(r); }
  return g;
}
function border(g,w,h,c){
  var x,y;
  for(x=0;x<w;x++){ g[0][x]=c; g[h-1][x]=c; }
  for(y=0;y<h;y++){ g[y][0]=c; g[y][w-1]=c; }
}
var CLS_SPAN=[[5,11],[13,19],[21,27],[29,35],[37,43],[45,51]];
var CLS_NAME=['高三1班','高三2班','高一3班','高二3班','高二1班','高二2班'];
var CLS_DOOR=[8,16,24,32,40,48];
var MY_ROOM=5, MY_COL=48, MY_ROW=6;

function teachFloor(f){
  var W=TCOLS, H=22, g=blank(W,H,'.'), x, y, i;
  border(g,W,H,'#');
  var sep=[4,12,20,28,36,44,52];
  for(i=0;i<sep.length;i++) for(y=1;y<16;y++) g[y][sep[i]]='#';
  for(x=1;x<W-1;x++) g[15][x]='#';
  for(i=0;i<CLS_DOOR.length;i++){ g[15][CLS_DOOR[i]]='='; g[15][CLS_DOOR[i]+1]='='; }
  g[21][6]='S'; g[21][7]='S';
  g[21][56]='S'; g[21][57]='S';
  if(f===1){ g[21][30]='O'; g[21][31]='O'; }
  for(i=0;i<6;i++){
    var c0=CLS_SPAN[i][0], c1=CLS_SPAN[i][1];
    var mid=Math.floor((c0+c1)/2);
    g[1][mid]='T';
    for(y=2;y<=13;y+=2){
      for(x=c0;x<=c1;x+=2){
        if(y===6&&x===MY_COL&&i===MY_ROOM){ g[y][x]='P'; continue; }
        g[y][x]='d';
      }
    }
  }
  g[MY_ROW][MY_COL]='P';
  for(y=16;y<=20;y++) g[y][57]='#';
  g[19][57]='.';                                   /* 门洞 */
  for(x=58;x<=61;x++) g[20][x]='#';                /* 南墙 */
  g[16][58]='B'; g[16][59]='B'; g[16][60]='B';     /* 隔间 */
  g[18][60]='w'; g[18][61]='w';                    /* 洗手台 */
  g[19][2]='w';
  return g;
}
function rooftop(){
  var W=30,H=18,g=blank(W,H,'.');
  border(g,W,H,'#');
  g[16][12]='S'; g[16][13]='S';                  /* 天台只有楼梯下去，没有出口 */
  g[17][14]='#';
  return g;
}
function genericFloor(W,H,nRoom,roomW,furn,opts){
  opts=opts||{};
  var g=blank(W,H,'.'),x,y,i;
  border(g,W,H,'#');
  var corrH=opts.corr||4;
  var top=1, bot=H-1-corrH-1;      /* 房间区下边界 */
  for(x=1;x<W-1;x++) g[bot][x]='#';
  for(y=1;y<H-1;y++){ g[y][0]='#'; g[y][W-1]='#'; }
  var c0=2;
  for(i=0;i<nRoom;i++){
    var x0=c0, x1=Math.min(W-3,c0+roomW-1);
    if(i>0){ for(y=top;y<bot;y++) g[y][x0-1]='#'; }
    var dx=Math.floor((x0+x1)/2);
    g[bot][dx]='=';
    var xstep=(furn==='l'||furn==='q')?3:2;
    for(y=top+1;y<bot-1;y+=2){
      for(x=x0;x<=x1;x+=xstep){ if(furn) g[y][x]=furn; }
    }
    c0=x1+2;
    if(c0>=W-2) break;
  }
  g[H-2][3]='S'; g[H-2][4]='S';
  /* 出口开在外墙上（以前是走廊正中间一格看不见的"门"，楼上每层也都有） */
  if(opts.exit){ g[H-1][Math.floor(W/2)]='O'; g[H-1][Math.floor(W/2)+1]='O'; }
  if(opts.podiumCh){ g[top][Math.floor(W/2)]=opts.podiumCh; }
  else if(opts.podium){ g[top][Math.floor(W/2)]='T'; }
  return g;
}
function computerFloor(){
  /* 机房：西边是学生机房（普通电脑），东边隔出一间上锁的网络中心，
     服务器、管理终端都在里面。以前白名单终端就摆在学生机中间，锁着的那间只有两格宽、塞满了机柜。 */
  var W=50,H=20,g=blank(W,H,'.'),x,y;
  border(g,W,H,'#');
  for(x=1;x<W-1;x++) g[15][x]='#';
  g[15][16]='='; g[15][17]='=';                    /* 学生机房的门 */
  for(y=1;y<15;y++) g[y][34]='#';                  /* 隔墙 */
  g[15][41]='=';                                   /* 网络中心的门（上锁） */
  g[1][17]='K';                                    /* 教师机 / 讲台 */
  for(y=4;y<=12;y+=2) for(x=3;x<=31;x+=4) g[y][x]='n';
  for(x=37;x<=46;x++){ if(x===41) continue; g[3][x]='f'; g[7][x]='f'; }   /* 两排机柜，中间留通道 */
  g[11][37]='Q'; g[11][38]='Q';                    /* 服务器控制台 */
  g[12][45]='D';                                   /* 门禁管理终端 */
  g[13][47]='R';
  g[18][3]='S'; g[18][4]='S';
  return g;
}
function canteenFloor(){
  var W=62,H=28,g=blank(W,H,'.'),x,y,i;
  border(g,W,H,'#');
  for(x=1;x<W-1;x++) g[20][x]='#';
  for(i=0;i<3;i++) g[20][10+i*12]='=';
  g[6][4]='k'; g[6][5]='k'; g[6][6]='k'; g[7][4]='k'; g[7][5]='k'; g[7][6]='k';
  for(y=2;y<=18;y+=3) for(x=2;x<=W-3;x+=4) g[y][x]='t';
  g[27][30]='O'; g[27][31]='O'; g[26][3]='S'; g[26][4]='S';
  g[9][W-2]='M'; g[12][W-2]='M';                 /* 东墙边两台售货机 */
  return g;
}
function dormFloor(f){
  var W=44,H=16,g=blank(W,H,'.'),x,y,c;
  border(g,W,H,'#');
  for(x=1;x<W-1;x++){ g[6][x]='#'; g[9][x]='#'; }
  for(c=7;c<W-1;c+=7){
    for(y=1;y<H-1;y++){ if(y===6||y===9||y===7||y===8) continue; g[y][c]='#'; }
  }
  for(c=1;c<W-3;c+=7){
    var C=c;
    if(C+5>=W-1) continue;
    g[1][C+1]='b'; g[1][C+2]='b';
    g[5][C+1]='b'; g[5][C+2]='b';
    g[3][C+4]='d';                       /* 书桌靠隔墙 */
    g[10][C+1]='b'; g[10][C+2]='b';
    g[14][C+1]='b'; g[14][C+2]='b';
    g[12][C+4]='d';
    g[6][C+4]='=';
    g[9][C+4]='=';
  }
  g[8][41]='S'; g[8][42]='S';         /* 以前在 40–41 列，正好堵住东南角那间宿舍的门（9 行 40 列），那间进不去 */
  g[9][40]='#'; g[9][39]='=';         /* 那间的门再往西挪一格，门框不贴着楼梯 */
  if(f===1){ g[7][43]='O'; g[8][43]='O'; }
  return g;
}
function garageFloor(){
  var W=60,H=26,g=blank(W,H,'.'),x,y,i;
  border(g,W,H,'#');
  for(i=0;i<5;i++) for(var j=0;j<3;j++){
    g[5+j*7][8+i*10]='#';
  }
  /* 四排车，16 辆。只有一辆能开（story.js useCar），得一辆一辆试 */
  var cars=[], cr, cc, rows=[4,9,16,22], cols=[12,24,36,46];
  for(cr=0;cr<rows.length;cr++) for(cc=0;cc<cols.length;cc++) cars.push([cols[cc],rows[cr]]);
  for(i=0;i<cars.length;i++){ g[cars[i][1]][cars[i][0]]='V'; }   /* V = 车；'c' 在教室代表椅子，不能复用 */
  g[13][55]='S'; g[13][56]='S';
  g[12][59]='O'; g[13][59]='O';
  return g;
}
function trashFloor(){
  var W=7,H=5,g=blank(W,H,'.');
  border(g,W,H,'#');
  g[2][3]='X'; g[3][6]='O';
  return g;
}
function linkFloor(){
  var W=5,H=24,g=blank(W,H,'.');
  border(g,W,H,'#');
  g[1][2]='L';
  g[H-2][2]='L';
  return g;
}
function bellFloor(){
  var W=11,H=13,g=blank(W,H,'.');
  border(g,W,H,'#');
  g[H-1][5]='O';                     /* 南门 */
  g[9][2]='A'; g[9][8]='A';          /* 两张供桌 */
  /* 钟挪到了楼顶：中间是旋转楼梯（spiral.js），原来的四根柱子会挡住楼梯，拿掉了 */
  return g;
}
function guardFloor(){
  var W=6,H=8,g=blank(W,H,'.');
  border(g,W,H,'#');
  g[3][5]='O'; g[4][5]='O'; g[3][2]='k'; g[4][2]='k';   /* 值班柜台；保安岗是平房，没有楼梯 */
  return g;
}
function gearFloor(){
  var W=8,H=6,g=blank(W,H,'.');
  border(g,W,H,'#');
  g[1][2]='R'; g[1][3]='R'; g[2][2]='R'; g[2][3]='R';
  g[5][4]='O';
  return g;
}

var INTERIORS={};
function mkFloor(id,name,host,floor,grid,enter){
  INTERIORS[id]={id:id,name:name,host:host,floor:floor,grid:grid,
    rows:grid.length,cols:grid[0].length,tw:TTILE,th:TTILE,enter:enter===undefined?true:enter};
  return INTERIORS[id];
}
function buildInteriorData(){
  if(Object.keys(INTERIORS).length) return;
  var f;
  for(f=1;f<=5;f++) mkFloor('teach'+f,'教学楼 '+f+'F','teach',f,teachFloor(f));
  mkFloor('teach6','教学楼 天台','teach',6,rooftop());
  for(f=1;f<=5;f++) mkFloor('admin'+f,'行政楼 '+f+'F','admin',f,
      genericFloor(2+6*7+5+4,22,6,7,'d',{corr:4,podiumCh:'K',exit:f===1}));
  var LABKIND=['','物理实验室','化学实验室','机房','地理实验室','音乐教室'];
  var LABFURN=['','q','l','n','x','p'];
  for(f=1;f<=5;f++){
    if(f===3){ mkFloor('lab3','实验楼 3F · 机房','lab',3,computerFloor()); continue; }
    mkFloor('lab'+f,'实验楼 '+f+'F · '+LABKIND[f],'lab',f,
      genericFloor(2+5*8+4+4,20,5,8,LABFURN[f]||'l',{corr:3,podiumCh:'K',exit:f===1}));
  }
  var kk2, kRow;
  for(kk2=1;kk2<=5;kk2++){
    kRow='admin'+kk2;
    if(INTERIORS[kRow]){
      var gk=INTERIORS[kRow].grid, kc2=Math.floor(gk[0].length/2);
      if(gk[1]&&gk[1][kc2]==='K'&&gk[2]&&gk[2][kc2]!=='#') gk[2][kc2]='.';
    }
    kRow='lab'+kk2;
    if(INTERIORS[kRow]){
      var gk2=INTERIORS[kRow].grid, kc3=Math.floor(gk2[0].length/2);
      if(gk2[1]&&gk2[1][kc3]==='K'&&gk2[2]&&gk2[2][kc3]!=='#') gk2[2][kc3]='.';
    }
  }
  var gl1=INTERIORS['lab1'].grid, gl2=INTERIORS['lab2'].grid, gl4=INTERIORS['lab4'].grid;
  gl1[1][7]='Z';  gl1[1][12]='N';    /* 物理：杠杆装置 + 光学显微镜 */
  gl2[1][7]='C';                     /* 化学：离心机 */
  gl4[1][7]='Y';                     /* 地理：地球仪 */
  var gl5=INTERIORS['lab5'].grid, mr, mc;
  for(mr=0;mr<gl5.length;mr++) for(mc=0;mc<gl5[mr].length;mc++) if(gl5[mr][mc]==='p') gl5[mr][mc]='.';
  var mp2=0, mstart=[2,11,20,29,38];
  for(mp2=0;mp2<mstart.length;mp2++){
    var mc2=mstart[mp2]+3;
    if(gl5[1]&&mc2<gl5[1].length&&gl5[0][mc2]==='#') gl5[1][mc2]='p';
  }
  for(mr=4;mr<=10;mr+=2){ for(mc=2;mc<=15;mc+=3){ if(gl5[mr][mc]==='.') gl5[mr][mc]='P'; } }
  var ga3=INTERIORS['admin3'].grid;
  /* 数据终端：以前塞在两排工位中间（a3r 行），前后的工位和椅子把它夹住，椅子还插进机箱里；
     挪到南边走廊靠墙，屏幕朝北对着走廊 */
  var a3c=Math.floor(ga3[0].length*0.5)+1;
  ga3[ga3.length-2][a3c]='D';
  mkFloor('canteen1','食堂 1F','canteen',1,canteenFloor());
  /* 北宿舍 dorm1–3、南宿舍 dorm4–6，各自 1–3 层。以前南宿舍一楼的 floor 是 4，出口提示"窗子封死了"，出不去 */
  for(f=1;f<=6;f++){
    var df=((f-1)%3)+1;
    mkFloor('dorm'+f,(f<=3?'北宿舍 ':'南宿舍 ')+df+'F',f<=3?'dormN':'dormS',df,dormFloor(df));
  }
  mkFloor('garage1','地下车库','garw',-1,garageFloor());
  mkFloor('trash1','垃圾房','trash',-1,trashFloor());
  mkFloor('link1','连廊①','c1',2,linkFloor());
  mkFloor('link2','连廊②','c2',2,linkFloor());
  var gA2=INTERIORS['admin2'].grid, gL2=INTERIORS['lab2'].grid, gT2=INTERIORS['teach2'].grid;
  if(gA2&&gA2[18]) gA2[18][gA2[18].length-3]='L';          /* 行政楼东头 → 连廊① 北 */
  if(gL2&&gL2[16]){ gL2[16][gL2[16].length-3]='L'; gL2[16][2]='L'; }  /* 实验楼东头 → 连廊① 南；西头 → 连廊② 北 */
  if(gT2&&gT2[18]) gT2[18][2]='L';                          /* 教学楼西头 → 连廊② 南 */
  mkFloor('bell1','钟楼','bell',1,bellFloor()).spiral=true;
  mkFloor('guard1','保安岗','guard',1,guardFloor());
  mkFloor('gear1','体育器材室','gear',1,gearFloor());
  if(typeof placeLockers==='function') placeLockers();          /* 储物柜和校长办公室：patrol.js */
}

var OBJ=[
  {id:'garage', n:'地下车库出入口', x:315,y:142,w:150,h:42, k:'roof', door:'e'},
  {id:'guard',  n:'保安岗',         x:552,y:142,w:56, h:40, k:'roof'},
  {id:'field',  n:'大操场',         x:293,y:213,w:102,h:209,k:'field'},   /* 南端让出体育器材室 */
  {id:'courtA', n:'篮球场',         x:306,y:262,w:76, h:46, k:'court'},
  {id:'courtB', n:'篮球场',         x:306,y:328,w:76, h:46, k:'court'},
  {id:'gear',   n:'体育器材室',     x:302,y:430,w:84, h:58, k:'roof'},
  {id:'court2', n:'篮球场',         x:435,y:220,w:130,h:160,k:'court'},
  {id:'shed',   n:'电动车棚',       x:572,y:212,w:36, h:163,k:'roof'},
  {id:'bad3',   n:'三个羽毛球场',   x:425,y:405,w:183,h:95, k:'court'},
  {id:'garw',   n:'地下车库人行口', s:'人行口', x:300,y:527,w:32, h:24, k:'roof'},
  {id:'admin',  n:'行政楼',         x:400,y:515,w:270,h:90, k:'roof', open1f:1},
  {id:'c1',     n:'连廊①',         x:602,y:618,w:60, h:52, k:'link'},    /* 让开行政楼的柱廊 */
  {id:'bad2',   n:'两个羽毛球场',   x:410,y:622,w:170,h:46, k:'court'},
  {id:'lab',    n:'实验楼',         x:400,y:670,w:270,h:100,k:'roof', open1f:1},
  {id:'c2',     n:'连廊②',         x:602,y:783,w:60, h:82, k:'link'},
  {id:'track',  n:'小跑道',         x:400,y:792,w:196,h:66, k:'track'},
  {id:'bell',   n:'钟楼',           x:400,y:878,w:52, h:94, k:'roof'},
  {id:'teach',  n:'教学楼',         x:452,y:865,w:218,h:120,k:'roof', open1f:1},
  {id:'garden', n:'花园',           x:400,y:1000,w:270,h:78,k:'garden'},
  {id:'dormN',  n:'北宿舍',         x:452,y:1090,w:200,h:50,k:'roof', door:'n'},   /* 南面贴着食堂，门只能朝北 */
  {id:'canteen',n:'食堂',           x:548,y:1140,w:104,h:40,k:'roof', door:'w'},
  {id:'dormS',  n:'南宿舍',         x:452,y:1180,w:200,h:50,k:'roof', door:'s'},
  {id:'trash',  n:'垃圾房',         x:740,y:1060,w:56, h:62, k:'roof'}
];
/* 三个校门都落在围墙线上（以前离墙 5–10 米，门是"浮"在校园里的，墙上也没有口子） */
var GATE_N={x:514,y:95}, GATE_W={x:200,y:624}, GATE_S={x:386,y:1290};
var BOUND={x0:200,y0:95,x1:830,y1:1290};
var ELEV_Y=990;

function objById(id){ for(var i=0;i<OBJ.length;i++) if(OBJ[i].id===id) return OBJ[i]; return null; }
function objWorld(o){ return {x:o.x*SC,y:o.y*SC,w:o.w*SC,h:o.h*SC}; }
