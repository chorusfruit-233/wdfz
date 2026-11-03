/* 稳定的空间/网格工具；不依赖建模器、引擎或可变状态。 */
'use strict';
function hash2(a,b){ var h=(a*374761393+b*668265263)^0x5bf03635; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967295; }
function shadeHex(col,s){
  var r=Math.min(255,Math.max(0,((col>>16)&255)*s))|0;
  var g=Math.min(255,Math.max(0,((col>>8)&255)*s))|0;
  var b=Math.min(255,Math.max(0,(col&255)*s))|0;
  return (r<<16)|(g<<8)|b;
}
function furnH(ch,wallH){
  if(wallH===undefined)wallH=3;
  switch(ch){
    case '#': case '=': return wallH;
    case 'T': return 1.05; case 'd': return 0.74; case 'P': return 0.46; case 'b': return 0.55;
    case 't': return 0.75; case 'k': return 0.95; case 'f': return 2.1; case 'R': return 1.85;
    case 'l': return 0.92; case 'w': return 0.85; case 'v': return 1.7; case 'c': return 1.35;
    case 'D': return 1.25; case 'X': return 1.2; case 'B': case 'G': return 1.9; case 'S': return 0.16;
    case 'O': return 2.2; case 'K': return 1.05; case 'C': return 0.72; case 'N': return 1.20;
    case 'Z': return 1.00; case 'Y': return 1.20; case 'V': return 1.6; case 'q': return 0.92;
    case 'n': return 1.25; case 'x': return 1.85; case 'p': return 1.25; case 'Q': return 1.85;
    case 'U': return 1.4; case 'A': return 0.9; case 'L': return 2.2; case 'H': return 2.0; case 'M': return 1.9;
    default: return 0;
  }
}
function stairInfo(R,x,y){
  var gw=1,gd=1,gx2,gy2;
  for(gx2=x+1; gx2<R.cols && R.grid[y][gx2]==='S'; gx2++) gw++;
  for(gy2=y+1; gy2<R.rows && R.grid[gy2][x]==='S'; gy2++) gd++;
  var longX=(gw>=gd);
  function tf(cc,rr){
    if(cc<0||rr<0||cc>=R.cols||rr>=R.rows) return -2;      /* 越界 = 楼外 */
    var t=R.grid[rr][cc];
    return (t==='#'||t==='='||t==='O')?-1:1;
  }
  var dirs=longX?[[0,1],[0,-1]]:[[1,0],[-1,0]];
  var best=dirs[0], bestScore=1e9, bestBlock=-2, di;
  for(di=0;di<2;di++){
    var dd=dirs[di], sc=0, blk=-2;
    for(var k2=1;k2<=3;k2++){
      var fr=tf(x+dd[0]*k2, y+dd[1]*k2);
      if(fr<0){ blk=fr; break; }
      sc++;
    }
    if(sc<bestScore){ bestScore=sc; best=dd; bestBlock=blk; }
  }
  return {gw:gw,gd:gd,longX:longX,dx:best[0],dy:best[1],free:bestScore,block:bestBlock};
}
