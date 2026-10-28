/* 场景表现数据。尺寸/布局稳定，画质配置仅决定细节。 */
'use strict';
var SCENE_SPEC=Object.freeze({trees:170,shrubs:40});
var ROOM_THEMES={
  garage1:{floor:'fconcrete',fcol:0x6a6a66,wall:0x8a8a84,wallMat:'concrete',low:0x4a4a46,ceil:0x2a2e30},
  trash1:{floor:'fconcrete',fcol:0x7a7a72,wall:0xa8aca0,low:0x6a7068},
  bell:{floor:'fstone',fcol:0x8a8478,low:0x6a5a4a,ceil:0x2a2420},
  gear1:{floor:'fwood',fcol:0x9a7a52,wall:0x27502f,low:0x1e3e24},
  teach6:{floor:'fconcrete',fcol:0x8a8680,wall:0xa8a49c,wallMat:'concrete'},
  c1:{floor:'fterrazzo',fcol:0x9a968e},c2:{floor:'fterrazzo',fcol:0x9a968e},
  canteen:{fcol:0x9a968e,low:0x7a8a84}
};
/* [x,y,z,颜色,基础亮度倍数,照射距离,坐标系]；默认是场景米，room 为房间比例，tile 为格坐标。 */
var ROOM_LIGHTS={
  default:[[-0.33,2.75,-0.24,0xf2dcc0,1.7,16,'room'],[0.33,2.75,0.28,0xffe9c8,1.7,16,'room']],
  teach:[[8.5,2.75,7.5,0xffe9c8,1.55,16,'tile'],[24.5,2.75,7.5,0xffe9c8,1.55,16,'tile'],[48.5,2.75,7.5,0xffe9c8,1.55,16,'tile']],
  lab3:[[-16,2.70,-2,0xc8dce8,1.3,18],[-3,2.70,-2,0xc8dce8,1.1,18],[17,2.60,-2.5,0x8a2418,1.6,16],[0,2.6,0.4,0xc07a4a,0.8,14,'room']],
  bell:[[0,2.4,2.5,0xffa860,0.9,12]],trash:[[0,2.6,0,0xb8d0a8,0.7,10]]
};
