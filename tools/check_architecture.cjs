/* AST checks for hidden dependencies, state ownership and the simulation/presentation boundary. */
'use strict';
const {build,parse,unpack}=require('./link_modules.cjs'),walk=require('./js/walk.cjs'),fs=require('node:fs'),path=require('node:path'),scope=require('./js/scope.cjs');
const ROOT=path.resolve(__dirname,'..');
function check(root=ROOT){
 const result=build(root),errors=result.errors.slice();
 const stats=new Set(['san','viol','tt','stam']),state=new Set(['S','RT','AN','PAT','HIDE','ROAM']);
 const restores=new Set(['game3d/js/app/session.js','game3d/js/save.js']);
 for(const c of result.contracts){
  if(!c.file.startsWith('game3d/js/'))continue;
  const source=unpack(fs.readFileSync(path.join(root,c.file),'utf8')),ast=parse(source),aliases=new Map(),resolved=new Map();
  const manager=scope.analyze(ast,{ecmaVersion:2022,sourceType:'script',optimistic:true,ignoreEval:true,directive:true});
  manager.scopes.forEach(s=>s.variables.forEach(v=>{v.identifiers.forEach(n=>resolved.set(n,v));v.references.forEach(r=>resolved.set(r.identifier,v));}));
  if(c.layer==='domain'||c.layer==='content'||c.file.endsWith('/app/input-context.js')||c.file.endsWith('/adapters/storage.js')){
    const forbidden=new Set(['document','window','globalThis','navigator','localStorage','THREE','GLR','S','RT','AN','PAT','fetch','XMLHttpRequest','AudioContext','Audio','setTimeout','setInterval','requestAnimationFrame','performance']);
    for(const ref of manager.globalScope.through)if(forbidden.has(ref.identifier.name))errors.push(c.file+': pure/content scope depends on platform or live game state '+ref.identifier.name);
  }
  function access(node,seen=new Set()){
   if(!node)return null;
   if(node.type==='Identifier'){
    const key=resolved.get(node)||node.name;
    if(seen.has(key))return null;seen.add(key);
    return aliases.has(key)?access(aliases.get(key),seen):{root:node.name,keys:[]};
   }
   if(node.type==='MemberExpression'){
    const base=access(node.object,seen);if(!base)return null;
    const key=node.computed?(node.property.type==='Literal'?node.property.value:'*'):node.property.name;
    return {root:base.root,keys:base.keys.concat(key)};
   }
   return null;
  }
  walk.simple(ast,{VariableDeclarator(n){if(n.id.type==='Identifier'&&n.init)aliases.set(resolved.get(n.id)||n.id.name,n.init);}});
  function failure(message,node){errors.push(c.file+':'+node.loc.start.line+': '+message);}
  function mutation(node,what){
   const a=access(node);if(!a)return;
   if(c.layer==='presentation'&&state.has(a.root))failure('presentation writes game state ('+what+'): '+a.root+'.'+a.keys.join('.'),node);
   if(c.layer==='presentation'&&(a.root==='OUT_SOLID'||a.keys.some(k=>['foot','stairExtra','propExtra'].includes(k))))failure('presentation writes authoritative collision data',node);
   if(a.root==='S'&&stats.has(a.keys[0])&&!restores.has(c.file))failure('write bypasses PlayerStats: '+a.keys[0],node);
  }
  walk.simple(ast,{
   AssignmentExpression(n){mutation(n.left,'assignment');},UpdateExpression(n){mutation(n.argument,'update');},
   UnaryExpression(n){if(n.operator==='delete')mutation(n.argument,'delete');},
   CallExpression(n){
    const target=n.callee;
    if(target.type==='MemberExpression'&&['push','pop','shift','unshift','splice','sort','reverse','fill','copyWithin'].includes(target.property.name))mutation(target.object,'array mutation');
    if(target.type==='MemberExpression'&&target.object.name==='Object'&&['assign','defineProperty','defineProperties','setPrototypeOf'].includes(target.property.name))mutation(n.arguments[0],'object mutation');
   },
   MemberExpression(n){const a=access(n);if(!a)return;
    if(['window','globalThis'].includes(a.root)&&result.contracts.some(o=>o.provides.includes(a.keys[0])))failure('game dependency bypasses declared ports',n);
    if(a.root==='Math'&&a.keys[0]==='random'&&c.file!=='game3d/js/adapters/random-source.js')failure('random source bypasses GameRandom/PresentationRandom',n);
   }
  });
  if(c.layer==='presentation'&&['GameRandom','rnd','ri','pick'].some(n=>c.imports[n]))errors.push(c.file+': presentation consumes gameplay random');
  if(c.layer==='content')for(const name of Object.keys(c.imports))if(['THREE','GLR','S','RT','AN','PAT','Assets','Investigation'].includes(name))errors.push(c.file+': content depends on runtime implementation '+name);
  for(const name of ['THREE','GLR'])if(c.imports[name]&&['domain','content'].includes(c.layer))errors.push(c.file+': invalid layer dependency '+name);
 }
 return [...new Set(errors)];
}
if(require.main===module){const failures=check(process.argv[2]||ROOT);if(failures.length){failures.forEach(x=>console.error(x));process.exitCode=1;}else console.log('AST dependency, state ownership and presentation boundaries passed.');}
module.exports={check};
