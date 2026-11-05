/* @module-capsule */
(function($imports){
/* 里世界 3D · 国际交流的表现（只读状态）：带队老师和三位访客、全校搜查的搜查员、行政楼北门外的双语告示牌。 */
'use strict';

(function(){
  var own={owner:'exchange'}, F={grp:null,people:[],search:[],key:''};
  var COAT=[0x3a4a6a,0x7a5a3a,0x5a6a4a,0x8a6a6a];
  function clear(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.people=[]; F.search=[]; F.key=''; }
  function sign(){
    var cv=document.createElement('canvas'); cv.width=256; cv.height=160; var g=cv.getContext('2d');
    g.fillStyle='#eef0ea'; g.fillRect(0,0,256,160); g.fillStyle='#22324a'; g.textAlign='center';
    g.font='700 24px '+(typeof $imports.SIGN_FONT!=='undefined'?$imports.SIGN_FONT:'sans-serif'); g.fillText('国际交流 · 接待登记',128,40);
    g.font='500 17px sans-serif'; g.fillText('Austausch · Anmeldung',128,82); g.fillText('Échange · Inscription',128,112);
    var t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace;
    return new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(1.2,0.75),new $imports.THREE.MeshLambertMaterial({map:t,emissive:0x555555,emissiveMap:t,side:$imports.THREE.DoubleSide}));
  }
  GameModules.on('frame',function(){
    var s=$imports.RT.exchange, live=s&&(s.phase==='waiting'||s.phase==='qualified'||s.phase==='escort')&&$imports.S.mode==='out'&&$imports.GLR.scene&&$imports.GLR.outMesh&&$imports.S.screen!=='menu';
    var key=live?'x':''; if(key!==F.key){ clear(); if(!key) return;
      var T=$imports.THREE, g=new T.Group(); g.name='exchange';
      for(var i=0;i<4;i++){ var f=(0,$imports.figMesh)('person',new T.MeshLambertMaterial({color:COAT[i],emissive:0x101010}),i?0.97:1.03); g.add(f); F.people.push(f); }
      for(var j=0;j<$imports.EXCHANGE_CFG.searchers;j++){ var h=(0,$imports.figMesh)('tall',new T.MeshLambertMaterial({color:0x22262a,emissive:0x0a0a0a}),1); h.visible=false; g.add(h); F.search.push(h); }
      var gp=$imports.Exchange.members()[0], sp=(0,$imports.worldToScene)(gp.x+30,gp.y+4,null), b=sign(); b.position.set(sp.x,1.2,sp.z); g.add(b);
      var leg=new T.Mesh(new T.BoxGeometry(0.06,1.2,0.06),new T.MeshLambertMaterial({color:0x555b5e})); leg.position.set(sp.x,0.6,sp.z+0.02); g.add(leg);
      $imports.GLR.scene.add(g); F.grp=g; F.key=key;
    }
    $imports.Exchange.members().forEach(function(m,i){ var p=(0,$imports.worldToScene)(m.x,m.y,null), f=F.people[i]; if(!f) return; f.position.set(p.x,0,p.z); f.rotation.y=Math.PI/2-m.yaw; });
    var ss=s.search||[]; F.search.forEach(function(h,i){ var q=ss[i]; h.visible=!!q&&s.phase==='escort'; if(!q) return; var p=(0,$imports.worldToScene)(q.x,q.y,null); h.position.set(p.x,0,p.z); h.rotation.y=Math.atan2(($imports.S.x-q.x),($imports.S.y-q.y)); });
  },own);
  GameModules.on('clearWorld',clear,own);
  GameModules.on('boundary',clear,own);
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/exchange/exchange-fx.js",{

});
})(GameModules.imports("game3d/js/modules/exchange/exchange-fx.js"));
