/* @module-capsule */
(function($imports){
/* 里世界 3D · 连续校园：连廊两头互相看得见（表现，只读）
   进入一个有连廊端口的场景时，把相邻的场景（以及连廊另一头那栋楼）按端口表的刚性变换摆进来：
   站在教学楼二楼西头看得见整条连廊和实验楼二楼，站在连廊里看得见两头。预览挂在房间模型下面，随场景缓存一起留着，
   不建碰撞、不加灯、不推进任何状态。 */
'use strict';
var CampusLinkView=(function(){
  var own={owner:'campus-link'};
  function place(mesh,view,here,there){
    var T=view.T, c=Math.cos(T.phi), s=Math.sin(T.phi);
    /* there 的场景坐标 v → here 的场景坐标：Rot(phi)·v + (Rot(phi)·c_there + t − c_here)·U2M */
    var px=c*there.cx-s*there.cy+T.tx-here.cx, py=s*there.cx+c*there.cy+T.ty-here.cy;
    mesh.rotation.y=-T.phi;
    mesh.position.set(px*$imports.U2M,0,py*$imports.U2M);
  }
  function attach(id){
    if(!id||!$imports.GLR.roomMesh) return;
    var here=$imports.INTERIORS[id]; if(!here) return;
    var parent=$imports.GLR.roomMesh; if(parent.userData.campusLinkPreviews) return;
    var list=$imports.CampusLink.views(id); if(!list.length) return;
    parent.userData.campusLinkPreviews=true;
    list.forEach(function(v){
      var R=$imports.INTERIORS[v.room]; if(!R) return;
      var mesh=(0,$imports.buildRoomGeometry)(R);
      mesh.name='campus-link-preview:'+v.room; mesh.userData.campusLinkPreview=v.room; mesh.userData.hop=v.hop;
      place(mesh,v,here,R);
      if(v.hop===1){
        /* 预览没有自己的灯：在对面门洞里面 3 米处补一盏走廊灯，远处那头不至于一片黑 */
        $imports.CampusLink.ports(v.room).forEach(function(w){
          if(!w.peer||w.peer.room!==id) return;
          var lx=w.self.x-w.self.n[0]*3/$imports.U2M, ly=w.self.y-w.self.n[1]*3/$imports.U2M;
          var light=new $imports.THREE.PointLight(0xf2dcc0,$imports.LCFG.ptI*0.9,14,2);
          light.position.set((lx-R.cx)*$imports.U2M,2.7,(ly-R.cy)*$imports.U2M); light.name='campus-link-lamp';
          mesh.add(light);
        });
      }
      parent.add(mesh);
    });
  }
  GameModules.on('sceneBuilt',attach,own);
  return {attach:attach, place:place};
})();
/* @module-exports */
GameModules.publish("game3d/js/modules/campus-link/link-view.js",{
"CampusLinkView":{get:function(){return CampusLinkView;},set:function($value){CampusLinkView=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-link/link-view.js"));
