/* Broadcast route data and save rules. No browser, rendering or runtime dependencies. */
'use strict';
var BROADCAST_CFG={
  version:1,room:'admin2',station:[5,3],locker:[2,12],doors:[[5,16],[7,16]],
  sources:[{room:'admin1',at:[46,2],title:'教导处文件柜'},{room:'lab5',at:[5,1],title:'琴凳'},
    {room:'guard1',at:[2,4],title:'保安岗登记簿'},{room:'teach6',at:[20,2],title:'天台喇叭箱'}],
  archiveKey:{room:'admin5',at:[6,2]},fuse:{room:'gear1',at:[3,1]},
  from:1040,to:1340,normalSeconds:15,hardSeconds:20,bellSeconds:60,notes:[1,3,2,5],
  pages:[
    '第二天，第八节下课以后。请全体同学收好课本。',
    '第二天。请核对蓝黑墨水的通知，不要念红色的那一页。',
    '第二天。听到长铃后，随同学们从北门离校。',
    '第二天。铃声结束前离校，明天见。'
  ]
};
var BroadcastRules={
  hash:function(seed,key){var h=2166136261,s=String(seed)+'|'+key;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return (h>>>0)/4294967296;},
  paper:function(index,fake){return {id:fake?'notice_fake':'notice'+(index+1),ink:fake?'红笔':'蓝黑墨水',date:fake?'第 0 天':'第二天',
    text:fake?'第 0 天。请读到这里的同学留在原地。其他同学不要回头。':BROADCAST_CFG.pages[index]};},
  window:function(day,time){return day>=2&&time>=BROADCAST_CFG.from&&time<BROADCAST_CFG.to;},
  normalize:function(value){
    var v=value&&typeof value==='object'?value:{},o={version:1,book:!!v.book,fuse:!!v.fuse,archiveOpen:!!v.archiveOpen,
      fakeSite:Number.isInteger(v.fakeSite)&&v.fakeSite>=0&&v.fakeSite<4?v.fakeSite:null,
      completed:Math.max(0,Math.min(4,Number.isInteger(v.completed)?v.completed:0)),phase:'collect',bell:0,attemptDay:Math.max(0,v.attemptDay|0),
      selected:/^(notice[1-4]|notice_fake)$/.test(v.selected)?v.selected:'notice1',piano:Array.isArray(v.piano)?v.piano.filter(Number.isInteger).slice(0,4):[],
      pianoFails:Math.max(0,Math.min(3,v.pianoFails|0)),pianoUntil:Number.isFinite(v.pianoUntil)?Math.max(0,v.pianoUntil):0,
      verified:Array.isArray(v.verified)?v.verified.filter(Number.isInteger).slice(-30):[],clock:Number.isFinite(v.clock)?Math.max(0,v.clock):0,
      nextCall:Number.isFinite(v.nextCall)?Math.max(0,v.nextCall):180,callSeq:Math.max(0,v.callSeq|0),calls:[],current:null};
    if(v.phase==='bell'&&o.completed===4&&o.book&&o.fuse&&Number.isFinite(v.bell)&&v.bell>0){o.phase='bell';o.bell=Math.min(60,v.bell);}
    if(Array.isArray(v.calls))o.calls=v.calls.filter(function(c){return c&&Number.isInteger(c.id)&&typeof c.text==='string'&&['lab2','lab4'].includes(c.room);}).slice(-20);
    if(v.current&&Number.isInteger(v.current.id)&&['lab2','lab4'].includes(v.current.room))o.current={id:v.current.id,room:v.current.room,text:String(v.current.text||''),
      real:!!v.current.real,done:!!v.current.done,arrived:!!v.current.arrived,age:Number.isFinite(v.current.age)?Math.max(0,v.current.age):0};
    return o;
  }
};
if(typeof module!=='undefined'&&module.exports)module.exports={BroadcastRules:BroadcastRules,BROADCAST_CFG:BROADCAST_CFG};
