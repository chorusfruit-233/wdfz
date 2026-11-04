/* Offline linker and AST boundary check. The checked-in game still runs as local scripts. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const acorn=require('./js/acorn.cjs'),walk=require('./js/walk.cjs'),scope=require('./js/scope.cjs');
const ROOT=path.resolve(__dirname,'..');
const GENERATED='game3d/module-contracts.js';
const START='/* @module-capsule */\n(function($imports){\n',END='\n/* @module-exports */\n';
const HOST=new Set(('GameModules module console window document globalThis navigator location localStorage performance setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame fetch XMLHttpRequest URL URLSearchParams Blob FileReader Event CustomEvent KeyboardEvent MouseEvent PointerEvent TouchEvent Audio AudioContext webkitAudioContext OfflineAudioContext Image ResizeObserver getComputedStyle alert confirm prompt matchMedia atob btoa structuredClone TextDecoder TextEncoder Buffer Float32Array Uint8Array Uint8ClampedArray Uint16Array Uint32Array Float64Array Int8Array Int16Array Int32Array DataView ArrayBuffer Map Set WeakMap WeakSet Math Object Array Number String Boolean Date JSON RegExp Error TypeError RangeError Promise Symbol Reflect Proxy Function NaN Infinity undefined parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI Intl BigInt innerHeight innerWidth devicePixelRatio visualViewport').split(' '));
function parse(s){return acorn.parse(s,{ecmaVersion:'latest',sourceType:'script',ranges:true,locations:true});}
function edits(source,list){
  const unique=new Map(list.map(e=>[e.start+':'+e.end,e]));
  const sorted=[...unique.values()].sort((a,b)=>a.start-b.start||b.end-a.end),keep=[];
  for(const e of sorted){const prior=keep.at(-1);if(prior&&e.start<prior.end){if(e.end<=prior.end)continue;throw Error('overlapping source edits');}keep.push(e);}
  for(const e of keep.reverse())source=source.slice(0,e.start)+e.text+source.slice(e.end);
  return source;
}
function unpack(source){
  if(!source.startsWith(START))return source;
  const at=source.lastIndexOf(END);if(at<0)throw Error('incomplete module capsule');
  const body=source.slice(START.length,at),replacements=[];
  walk.ancestor(parse(body),{MemberExpression(n,ancestors){
    if(n.object.type!=='Identifier'||n.object.name!=='$imports'||n.computed)return;
    let target=n,p=ancestors.at(-2),grand=ancestors.at(-3);
    if(p&&p.type==='SequenceExpression'&&p.expressions.length===2&&p.expressions[0].value===0&&p.expressions[1]===n&&grand&&grand.type==='CallExpression'&&grand.callee===p)target=p;
    let start=target.start,end=target.end;
    if(target!==n)while(body[start-1]==='('&&body[end]===')'){start--;end++;}
    replacements.push({start,end,text:n.property.name});
  }});
  return edits(body,replacements);
}
function manifest(root){const out=[];vm.runInNewContext(fs.readFileSync(path.join(root,'game3d/manifest.js'),'utf8'),{GameModules:{define:m=>out.push(m)}});return out;}
function standalone(file){return file.startsWith('game3d/js/domain/')||['game3d/js/app/lifecycle.js','game3d/js/app/input-context.js','game3d/js/adapters/storage.js'].includes(file);}
function layer(file){
  if(/\/broadcast-(view|ui|cinematics)\.js$/.test(file))return 'presentation';
  if(file.startsWith('game3d/js/domain/'))return 'domain';
  if(file.startsWith('game3d/js/content/'))return 'content';
  if(/\/(?:marks-fx|maze-model|maze-sound|maze-death|eggs-fx)\.js$/.test(file)||file==='game3d/js/modules/cyber-route/ending.js')return 'presentation';
  if(/game3d\/js\/(?:engine\/|model\/|fx\/|audio\.js|lighting\.js|shade\.js|hands\.js|render\.js)/.test(file))return 'presentation';
  if(file.includes('/adapters/')||['input.js','mobile.js'].some(f=>file.endsWith('/'+f)))return 'adapter';
  if(file.includes('/dev.js')||file.includes('/playtest.js'))return 'tools';
  return 'application';
}
function build(root=ROOT){
  const mods=manifest(root),entries=[],owners=new Map(),errors=[];
  owners.set('THREE','game3d/lib/three.min.js');
  for(const m of mods)for(const file of m.files){
    if(!file.startsWith('game3d/js/')||file==='game3d/js/modules.js')continue;
    const original=fs.readFileSync(path.join(root,file),'utf8'),source=unpack(original),ast=parse(source);
    const manager=scope.analyze(ast,{ecmaVersion:2022,sourceType:'script',optimistic:true,ignoreEval:true,directive:true});
    const vars=manager.globalScope.variables;
    for(const v of vars){if(owners.has(v.name))errors.push(file+': duplicate owner '+v.name);else owners.set(v.name,file);}
    entries.push({file,module:m.id,original,source,ast,manager,vars});
  }
  const contracts=[{file:'game3d/lib/three.min.js',module:'lib',standalone:true,provides:['THREE'],imports:{},writes:[]}];
  const output=new Map();
  for(const e of entries){
    const locals=new Set(e.vars.map(v=>v.name)),imports={},writes=new Set(),refs=[];
    for(const r of e.manager.globalScope.through){
      const id=r.identifier,name=id.name;if(locals.has(name))continue;
      if(owners.has(name)){imports[name]=owners.get(name);refs.push(r);if(r.isWrite())writes.add(name);}
      else if(!HOST.has(name))errors.push(e.file+': undeclared identifier '+name+' at '+id.loc.start.line);
    }
    const plain=standalone(e.file);
    if(plain&&Object.keys(imports).length)errors.push(e.file+': standalone rules import game implementation: '+Object.keys(imports).join(', '));
    const c={file:e.file,module:e.module,layer:layer(e.file),standalone:plain,provides:e.vars.map(v=>v.name),imports:Object.fromEntries(Object.entries(imports).sort()),writes:[...writes].sort()};
    c.readonly=c.layer==='presentation'?Object.keys(imports).filter(n=>['S','RT','AN','PAT','HIDE','ROAM'].includes(n)):[];
    contracts.push(c);
    if(plain){output.set(e.file,e.source);continue;}
    const parents=new Map();walk.fullAncestor(e.ast,(n,a)=>{if(n.type==='Identifier')parents.set(n,a.at(-2));});
    const replacements=refs.map(r=>{const id=r.identifier,p=parents.get(id),value='$imports.'+id.name;
      return {start:id.start,end:id.end,text:p&&p.type==='Property'&&p.shorthand&&p.value===id?id.name+':'+value:
        p&&p.type==='CallExpression'&&p.callee===id?'(0,'+value+')':value};});
    const descriptors=e.vars.map(v=>{
      const writable=!v.defs.some(d=>d.parent&&d.parent.kind==='const');
      return JSON.stringify(v.name)+':{get:function(){return '+v.name+';}'+(writable?',set:function($value){'+v.name+'=$value;}':'')+'}';
    });
    const wrapped=START+edits(e.source,replacements)+END+'GameModules.publish('+JSON.stringify(e.file)+',{\n'+descriptors.join(',\n')+'\n});\n})(GameModules.imports('+JSON.stringify(e.file)+'));\n';
    output.set(e.file,wrapped);
  }
  const generated='/* Generated by node tools/link_modules.cjs --write; explicit owners and imports, no runtime build. */\nGameModules.configureContracts([\n'+contracts.map(c=>JSON.stringify(c)).join(',\n')+'\n]);\n';
  output.set(GENERATED,generated);
  return {errors,output,contracts};
}
function run(args=process.argv.slice(2)){
  const result=build();
  if(result.errors.length){result.errors.forEach(e=>console.error(e));return 1;}
  const write=args.includes('--write'),stale=[];
  for(const [file,text] of result.output){const absolute=path.join(ROOT,file);if(!fs.existsSync(absolute)||fs.readFileSync(absolute,'utf8')!==text){stale.push(file);if(write)fs.writeFileSync(absolute,text);}}
  if(stale.length&&!write){stale.forEach(f=>console.error('Module contract/capsule requires linking: '+f));return 1;}
  console.log(JSON.stringify({files:result.contracts.length,privateFiles:result.contracts.filter(c=>!c.standalone).length,symbols:result.contracts.reduce((n,c)=>n+c.provides.length,0),changed:stale.length,mode:write?'write':'check'}));
  return 0;
}
if(require.main===module)process.exitCode=run();
module.exports={build,unpack,parse,layer};
