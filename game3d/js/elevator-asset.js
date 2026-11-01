/* 里世界 3D · 电梯网格资产（Blender 烘焙，game3d/assets/elevator_mesh.js）
   只含日常可见：轿厢内装、两扇轿门、层门 + 门套/地坎/外呼/显示屏/到站灯。
   显示屏是独立部件：floor_1F…floor_5F、wrong_set；方向灯 dir_up/dir_dn 左右各一组。 */
'use strict';

var ELEVASSET={ready:false,groups:null,parts:null,mats:{},grp:{},shown:{}};
/* 开关：Blender 网格目前有两处对不上（轿厢内壁把玩家夹住、厅外显示框位置偏），
   先关掉，走程序化预制件（门套/地坎/外呼/显示屏/圆管扶手都是对的）。
   资产文件仍然保留，修好朝向与包围盒后把这个开关改回 true 即可。 */
var ELEV_USE_MESH=false;

function elevAssetMat(name){
  if(ELEVASSET.mats[name]) return ELEVASSET.mats[name];
  var P={steel:{c:0xaeb8b7,metal:0.92,rough:0.34},paint:{c:0xe4e8e6,metal:0.30,rough:0.52},
         paintD:{c:0xc9cecc,metal:0.30,rough:0.60},dark:{c:0x22282a,metal:0.70,rough:0.45},
         rubber:{c:0x14181a,metal:0.0,rough:0.94},led:{c:0xffd9a8,metal:0.0,rough:0.30,emit:0xffc178},
         ledG:{c:0x9ce8bc,metal:0.0,rough:0.30,emit:0x6fe0a0},brass:{c:0xc8a86a,metal:1.0,rough:0.3},
         concrete:{c:0x8a8a86,metal:0.0,rough:0.95}}[name]||{c:0xa9b4b3,metal:0.6,rough:0.5};
  var m;
  /* 有了 env.js 的极简 cube 环境贴图，金属才有反光可看：
     没有 envMap 时 metalness 0.9 会渲染成接近纯黑（之前门套"消失"的根因）。 */
  if(typeof THREE.MeshStandardMaterial==='function'){
    if(typeof envMapInit==='function') envMapInit();
    m=new THREE.MeshStandardMaterial({color:P.c,metalness:P.metal,roughness:P.rough});
    if(m.envMapIntensity!==undefined) m.envMapIntensity=0.9;
    if(P.emit){ m.emissive=new THREE.Color(P.emit); m.emissiveIntensity=0.85; }
  }else{
    m=new THREE.MeshLambertMaterial({color:P.c});
    if(P.emit){ m.emissive=new THREE.Color(P.emit); m.emissiveIntensity=1.0; }
  }
  ELEVASSET.mats[name]=m;
  return m;
}

function elevAssetInit(){
  if(!ELEV_USE_MESH) return false;
  if(ELEVASSET.ready) return true;
  if(typeof THREE==='undefined') return false;
  var D=(typeof window!=='undefined'&&window.ELEVATOR_MESH)||null;
  if(!D||!D.groups) return false;
  ELEVASSET.groups=[];
  for(var i=0;i<D.groups.length;i++){
    var g=D.groups[i];
    var geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(g.pos,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.nrm,3));
    geo.setIndex(g.idx);
    geo.computeBoundingSphere();
    var ranges=(g.ranges||[]).map(function(r){return {a:r[0],b:r[1],part:r[2]};});
    ELEVASSET.groups.push({geo:geo,mat:elevAssetMat(g.mat),ranges:ranges,idx:g.idx,pos:g.pos,nrm:g.nrm});
  }
  ELEVASSET.parts=D.parts||{};
  ELEVASSET.ready=true;
  return true;
}

/* 取某个部件的几何（一个部件可能分布在多个材质组里） */
function elevAssetPart(part){
  var out=[], gi, i;
  for(gi=0;gi<ELEVASSET.groups.length;gi++){
    var g=ELEVASSET.groups[gi], rg=null;
    for(i=0;i<g.ranges.length;i++) if(g.ranges[i].part===part){ rg=g.ranges[i]; break; }
    if(!rg) continue;
    var pos=[],nrm=[],idx=[],map={};
    for(i=0;i<g.idx.length;i+=3){
      var a=g.idx[i],b=g.idx[i+1],c=g.idx[i+2];
      if(a<rg.a||b<rg.a||c<rg.a||a>=rg.b||b>=rg.b||c>=rg.b) continue;
      var tri=[a,b,c];
      for(var k=0;k<3;k++){
        var v=tri[k];
        if(map[v]===undefined){
          map[v]=pos.length/3;
          pos.push(g.pos[v*3],g.pos[v*3+1],g.pos[v*3+2]);
          nrm.push(g.nrm[v*3],g.nrm[v*3+1],g.nrm[v*3+2]);
        }
        idx.push(map[v]);
      }
    }
    if(!idx.length) continue;
    var geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    out.push({geo:geo,mat:g.mat});
  }
  return out;
}

function elevAssetAdd(c,part,cx,cz,face){
  var list=elevAssetPart(part), i;
  if(!ELEVASSET.shown) ELEVASSET.shown={};
  var bag=ELEVASSET.shown[part]||(ELEVASSET.shown[part]=[]);
  for(i=0;i<list.length;i++){
    var m=new THREE.Mesh(list[i].geo,list[i].mat);
    m.position.set(cx,0,cz);
    m.rotation.y=face<0?Math.PI:0;
    m.castShadow=false; m.receiveShadow=true;
    c.meshes.push(m);
    bag.push(m);
  }
  return list.length;
}

/* 当前该显示哪一层：正常显示 floor_<层>，错误电梯显示 wrong_set */
function elevDisplayLabel(){
  if(typeof ELEV==='undefined'||typeof ELEV_DEF==='undefined'||typeof S==='undefined') return '1F';
  var key=(typeof elevForRoom==='function')?elevForRoom(S.room):null;
  if(!key) return '1F';
  if(ELEV.wrong) return 'wrong';
  var idx=ELEV_DEF[key].floors.indexOf(S.room);
  return idx>=0?ELEV_DEF[key].labels[idx]:'1F';
}

/* 只亮当前层那组数字；dir 为 'up'/'down' 时点亮对应箭头 */
function elevDisplay(label,dir){
  var keys=['floor_1F','floor_2F','floor_3F','floor_4F','floor_5F','wrong_set'], i, k, arr;
  var want=(label==='wrong')?'wrong_set':('floor_'+label);
  for(i=0;i<keys.length;i++){
    arr=ELEVASSET.shown[keys[i]]||[];
    for(k=0;k<arr.length;k++) arr[k].visible=(keys[i]===want);
  }
  var pairs=[['dir_up_-1','up'],['dir_up_1','up'],['dir_dn_-1','down'],['dir_dn_1','down']];
  for(i=0;i<pairs.length;i++){
    arr=ELEVASSET.shown[pairs[i][0]]||[];
    for(k=0;k<arr.length;k++) arr[k].visible=(dir===pairs[i][1]);
  }
}

function elevAssetBuild(c,kind,cx,cz,face){
  if(!elevAssetInit()) return false;
  var skip={doorLeft:1,doorRight:1,landingDoorLeft:1,landingDoorRight:1};
  var want=(kind==='car')
    ? ['car_floor','car_floor_top','car_tread0','car_tread1','car_tread2','car_tread3','car_roof',
       'car_light_frame','car_light','car_vent0','car_vent1','car_vent2','car_vent3','car_vent4',
       'car_back','car_back_panel','car_back_seam','car_side_l','car_side_l_panel','car_side_r','car_side_r_panel',
       'car_front_l','car_front_r','car_lintel','panel','panel_face',
       'btn0','btn1','btn2','btn3','btn4','btncap0','btncap1','btncap2','btncap3','btncap4',
       'btnled0','btnled1','btnled2','btnled3','btnled4','btn_open','btn_close','btn_alarm',
       'car_disp_frame','car_disp','car_disp_led','car_dir',
       'rail_back','rail_side_-1','rail_side_1','rail_foot-60','rail_foot0','rail_foot60']
    : ['jamb_-1','jamb_1','jamb_face_-1','jamb_face_1','jamb_top','sill','sill_rub','sill_groove_-1','sill_groove_1',
       'hall_plate','hall_btn_up','hall_btn_down','hall_btn_cap_up','hall_btn_cap_down','hall_led_up','hall_led_down',
       'disp_frame','disp_bezel','disp_panel','dir_up_-1','dir_up_1','dir_dn_-1','dir_dn_1','lantern','lantern_cap',
       'floor_1F','floor_2F','floor_3F','floor_4F','floor_5F','wrong_set',
       'jamb_bolt-1_0','jamb_bolt-1_1','jamb_bolt-1_2','jamb_bolt1_0','jamb_bolt1_1','jamb_bolt1_2'];
  var i, n=0;
  ELEVASSET.shown={};
  for(i=0;i<want.length;i++){ if(skip[want[i]]) continue; n+=elevAssetAdd(c,want[i],cx,cz,face); }
  /* 电梯厅部件缺太多就当作没读到资产，让调用方回退到程序化模型，避免只剩两片门板 */
  if(kind==='landing'&&n<12){ ELEVASSET.shown={}; return false; }
  if(kind==='landing'&&(ELEVASSET.shown.floor_1F||ELEVASSET.shown.wrong_set)) elevDisplay(elevDisplayLabel());
  return n>0;
}

/* 两扇门：父节点按 face 旋转，子节点在本地 x 上平移做开合 */
function elevAssetDoors(which,c,cx,cz,face){
  if(!elevAssetInit()) return false;
  if(typeof THREE==='undefined'||typeof GLR==='undefined'||!GLR.scene) return false;
  var names=(which==='car')?['doorLeft','doorRight']:['landingDoorLeft','landingDoorRight'];
  if(ELEVASSET.grp[which]&&ELEVASSET.grp[which].parent) ELEVASSET.grp[which].parent.remove(ELEVASSET.grp[which]);
  var grp=new THREE.Group();
  grp.position.set(cx,0,cz);
  grp.rotation.y=face<0?Math.PI:0;
  GLR.scene.add(grp);
  ELEVASSET.grp[which]=grp;
  var made=0, i, k;
  for(i=0;i<2;i++){
    var list=elevAssetPart(names[i]);
    if(!list.length) continue;
    var holder=new THREE.Group();
    for(k=0;k<list.length;k++){
      var m=new THREE.Mesh(list[k].geo,list[k].mat);
      m.receiveShadow=true; m.castShadow=false;
      holder.add(m);
    }
    holder.userData.baseX=0;
    holder.userData.slide=(i===0?-1:1)*0.45;
    grp.add(holder);
    if(typeof ELEVDOOR!=='undefined'){
      ELEVDOOR[which]=ELEVDOOR[which]||[];
      ELEVDOOR[which].push(holder);
    }
    made++;
  }
  return made>0;
}
