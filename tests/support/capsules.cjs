/* Load actual checked-in module capsules with explicit test ports, without a DOM or renderer. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm');
function context(ports={}){
 const target=vm.isContext(ports)?ports:vm.createContext(ports);
 target.GameModules=target.GameModules||{};
 target.GameModules.imports=()=>target;
 target.GameModules.publish=(_file,definitions)=>{
  for(const [name,definition] of Object.entries(definitions))Object.defineProperty(target,name,{configurable:true,enumerable:true,get:definition.get,set:definition.set});
 };
 return target;
}
function load(file,ports){const c=context(ports);vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});return c;}
module.exports={context,load};
