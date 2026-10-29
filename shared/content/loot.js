/* 同一份抽奖表供单人浏览器和联机房主使用。未翻过的容器不向客户端公开结果。 */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SharedLoot=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var lab={
    1:[[0.22,'battery'],[0.40,'chalk'],[0.52,'pen']],
    2:[[0.20,'goggles'],[0.40,'pill'],[0.58,'battery']],
    3:[[0.20,'usb'],[0.40,'battery'],[0.52,'phone']],
    4:[[0.22,'compass'],[0.36,'map']],
    5:[[0.22,'metronome'],[0.36,'snack']]
  };
  var desk=[[0.16,'coin'],[0.28,'chalk'],[0.36,'snack'],[0.44,'battery'],[0.50,'pill'],[0.56,'pen'],[0.62,'notebook'],
    [0.66,'memo'],[0.70,'brolly'],[0.74,'coat'],[0.78,'torch'],[0.82,'phone'],[0.86,'watch'],[0.90,'compass'],[0.93,'leave']];
  function roll(table,value){
    for(var i=0;i<table.length;i++)if(value<table[i][0])return table[i][1];
    return null;
  }
  function search(room,tile,row,bag,flags,random){
    if(room.host==='admin'){
      var missing=['key','roomkey'].filter(function(k){return bag.indexOf(k)<0;});
      if(missing.length&&random()<(room.principal?0.18:0.01))return missing[Math.floor(random()*missing.length)];
      if(room.principal){
        var pr=random();
        if(pr<0.12&&bag.indexOf('atlas')<0)return 'atlas';
        if(pr<0.18&&bag.indexOf('elixir')<0)return 'elixir';
      }
    }
    if(room.id==='lab3'&&tile==='R'&&bag.indexOf('usb')<0)return 'usb';
    if(room.host==='lab')return lab[room.floor]?roll(lab[room.floor],random()):null;
    var type=roll(desk,random());
    if(room.id==='teach1'&&!flags.hwTaken&&row>1&&row<14){flags.hwTaken=true;type='hw';}
    return type;
  }
  function fixed(room,tile){
    if(tile==='Q')return 'coil';
    if(tile==='N')return 'lens';
    if(tile==='Y')return 'compass';
    if(tile==='T'&&room.id==='teach1')return 'chalk';
    if(tile==='K'&&room.host==='lab'&&room.floor===2)return 'goggles';
    if(tile==='k'&&room.host==='guard')return 'torch';
    if(tile==='A')return 'coin';
    return null;
  }
  return Object.freeze({lab:lab,desk:desk,roll:roll,search:search,fixed:fixed});
});
