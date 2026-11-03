/* 水杯异象的共享物理参数与预警窗口；无画面也能计算判定。 */
'use strict';
var CUP_H=10.6;          /* 四楼窗台离地（米）：教学楼每层 3.2 米 */
var CUP_R=0.95;          /* 砸中半径（米），地上的影子就画这么大 */
function cupFallTime(){ return Math.sqrt(2*CUP_H/9.8); }
/* 窗台上晃多久才掉（真实秒）。预知梦最长、梦魇最短；比原来的 1.3 / 0.9 / 0.6 短三成多，
   影子和约 1.5 秒的真实下坠不变，所以真正能躲的是「看到它掉」之后那一段。 */
var CUP_WOB={easy:0.85,normal:0.60,hard:0.40};


var CupRules=Object.freeze({fallTime:cupFallTime,wobble:function(difficulty){return CUP_WOB[difficulty]||CUP_WOB.normal;}});
if(typeof module!=='undefined'&&module.exports)module.exports=CupRules;
