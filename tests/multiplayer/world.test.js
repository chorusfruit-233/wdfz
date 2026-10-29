'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const world=require('../../server/world');
const zones=require('../../shared/content/zones');

test('房主无需 DOM 或 WebGL 即可读取校园网格和区域边界',()=>{
  assert.equal(Object.keys(world.rooms).length,30);
  assert.deepEqual(Object.keys(world.rooms).sort(),zones.ids.filter(x=>x!=='out').slice().sort());
  for(const [id,r] of Object.entries(world.rooms)){
    assert.equal(r.grid.length,r.rows,id);
    assert.ok(r.grid.every(row=>row.length===r.cols),id);
    assert.ok(world.contains(id,r.cx,r.cy),id);
    assert.equal(world.contains(id,r.ox-1,r.oy-1),false,id);
  }
  assert.ok(world.contains('out',world.outdoor.x0,world.outdoor.y0));
  assert.equal(world.contains('out',world.outdoor.x0-1,world.outdoor.y0),false);
});
