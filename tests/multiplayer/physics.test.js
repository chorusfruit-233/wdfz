'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const physics=require('../../shared/simulation/physics');
const zones=require('../../shared/content/zones');

test('圆形碰撞计算和细分移动可在 Node 中独立运行',()=>{
  assert.equal(physics.hz,240);
  assert.equal(physics.rectDepth(0,0,1,5,-10,6,10),0);
  assert.equal(physics.rectDepth(5.5,0,1,5,-10,6,10),1.5);
  const player={x:0,y:0};let steps=0;
  const depth=(x,y)=>physics.rectDepth(x,y,1,5,-10,6,10);
  physics.moveCircle(player,20,4,.5,1,depth,()=>steps++);
  assert.ok(player.x<=4+1e-7,'高速移动不能穿过墙');
  assert.ok(player.y>3.9,'碰墙后仍能沿墙滑动');
  assert.equal(steps,120);
});

test('角色处于碰撞内时仍可朝更浅的位置脱离',()=>{
  const player={x:4.5,y:0};
  const depth=(x,y)=>physics.rectDepth(x,y,1,5,-10,6,10);
  const before=depth(player.x,player.y);
  physics.moveCircle(player,-2,0,.1,1,depth);
  assert.ok(depth(player.x,player.y)<before);
  assert.ok(player.x<4);
});

test('区域列表拒绝不存在的房间',()=>{
  assert.equal(zones.ids.length,31);
  assert.ok(zones.has('out')&&zones.has('teach1')&&zones.has('bell1'));
  assert.equal(zones.has('teach9'),false);
  assert.equal(zones.has('__proto__'),false);
});
