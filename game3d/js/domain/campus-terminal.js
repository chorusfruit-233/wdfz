/* 校园模拟终端。只有游戏内存中的只读档案和 /work；不执行 JavaScript、shell 或网络请求。 */
'use strict';
var CampusTerminal=(function(){
  var LIMIT=8192;
  function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function make(seed,attempt){
    var n=hash(String(seed)+':'+attempt),zone='Z'+(10+n%79),batch='B'+(100+(n>>>8)%899),
      controller='ctl-'+(1000+n%8999),tx='TX-'+(10000+(n>>>3)%89999),word='ack-'+n.toString(36),
      mods=['attendance','doors','observation'];
    if(n%2)mods.reverse();if(n%3===0)mods.push(mods.shift());
    var files={
      '/school/README':'校园维护环境（模拟 Kali Linux 容器）\n只读 /school，可写 /work。help 查看命令；man campusctl 查看提交格式。\n先用区域、批次和资产清单确认当前控制器，再关联日志中的同一事务，最后依据依赖关系提交有序停机清单。\n文件中的校历可能跳时；active 字段是服务运行秒。',
      '/school/site.txt':'试点区域='+zone+'\n当前运行批次='+batch+'\n部署日期=2026-09-01',
      '/school/assets.tsv':'id zone batch role status\nmirror-'+n%100+' '+zone+' '+batch+' mirror online\nctl-old '+zone+' B099 controller retired\n'+controller+' '+zone+' '+batch+' controller online\nctl-decoy Z00 '+batch+' controller online',
      '/school/runtime.log':'calendar=11:40 active=100 tx=TX-noise node=mirror actor=observer event=prepare\n'+
        'calendar=12:50 active=124 tx='+tx+' node='+controller+' actor=control event=commit token='+word+'\n'+
        'calendar=11:32 active=118 tx='+tx+' node='+controller+' actor=control event=authorize\n'+
        'calendar=11:40 active=110 tx='+tx+' node='+controller+' actor=control event=prepare\n'+
        'calendar=12:50 active=125 tx=TX-noise node='+controller+' actor=observer event=commit token=invalid',
      '/school/services.txt':'维护协议：功能服务依次解除依赖，控制层 control 保留到提交之后，由服务器最后关闭。\n依赖关系 A -> B 表示必须先停 A 才能停 B。\n'+mods[0]+' -> '+mods[1]+'\n'+mods[1]+' -> '+mods[2]+'\n'+mods[2]+' -> control\n清单必须包含 controller、transaction、token、clock=active 和恰好三个 stop 行。',
      '/school/company.txt':'AnthroPrank AI（安抄派智能）\n行为一致性与秩序对齐试点。名单、门禁、巡察是我们的可操作控制系统。\n创世报告声称第一次部署之前没有异常，所有巡察均由控制器产生，退出身份全部注销。',
      '/school/archive.txt':'纸质档案扫描：1987 年，走廊里第二次出现不在值班表上的人。\n断链故障记录：控制链已离线，仍收到无法对应签发节点的回执。\n注销字段原始定义：转交上层保管；不是删除。\n这些档案与公司宣传冲突，不改变维护协议或资产清单的有效性。'
    };
    return {files:files,answer:{controller:controller,tx:tx,token:word,order:mods,zone:zone,batch:batch}};
  }
  function fresh(seed,attempt){return {version:1,runSeed:String(seed),attemptId:attempt||1,cwd:'/school',work:{},dirs:['/work'],
    controllerId:null,chainId:null,evidence:[],validated:null,acceptedRequestId:null,helpRead:false,hint:0,buffer:'',history:[]};}
  function path(s,p){p=String(p||s.cwd);var parts=(p[0]==='/'?p:s.cwd+'/'+p).split('/'),out=[];
    parts.forEach(function(x){if(x==='..')out.pop();else if(x&&x!=='.')out.push(x);});return '/'+out.join('/');}
  function read(s,p){p=path(s,p);var files=make(s.runSeed,s.attemptId).files;return Object.prototype.hasOwnProperty.call(files,p)?files[p]:s.work[p];}
  function words(line){
    var out=[],cur='',quote=null,started=false;
    for(var i=0;i<line.length;i++){var c=line[i];if(quote){if(c===quote)quote=null;else cur+=c;started=true;}
      else if(c==='"'||c==="'"){quote=c;started=true;}else if(/\s/.test(c)){if(started){out.push(cur);cur='';started=false;}}
      else if(c==='|'){if(started){out.push(cur);cur='';started=false;}out.push('|');}
      else if(/[;<>`&]/.test(c)||c==='$')throw new Error('不支持 shell 展开、重定向或执行语法。使用 edit 写 /work 文件。');
      else{cur+=c;started=true;}}
    if(quote)throw new Error('引号未闭合。');if(started)out.push(cur);return out;
  }
  function writable(s,p){p=path(s,p);if(p.indexOf('/work/')!==0)throw new Error('只允许写 /work/ 下的文件。');
    if(p.length>160||p.split('/').length>10)throw new Error('路径过长。');return p;}
  function write(s,p,value){p=writable(s,p);if(value.length>LIMIT)throw new Error('文件上限 8192 字符。');
    if(!Object.prototype.hasOwnProperty.call(s.work,p)&&Object.keys(s.work).length>=32)throw new Error('工作区最多 32 个文件。');
    s.work[p]=value;s.validated=null;return p;}
  var HELP='可用命令：help、man campusctl、pwd、ls -a [路径]、cd 路径、cat 文件、grep 字串 [文件]、head/tail [-n 数量] [文件]、sort [文件]、cp 源 /work/目标、mkdir /work/目录、edit /work/文件 "内容"。\n引号内用 \\n 表示换行；支持最多 4 段 cat/grep/head/tail/sort 管道。\ncampusctl hint 1 或 2 提供可选提示；campusctl status 查看阶段。';
  var MAN='T1: campusctl select 控制器 /school/assets.tsv\nT2: campusctl trace 事务 /school/runtime.log\nT3: edit /work/shutdown "controller=代号\\ntransaction=事务\\ntoken=回执\\nclock=active\\nstop 功能模块\\nstop 功能模块\\nstop 功能模块"\nT4: campusctl validate /work/shutdown\n校验成功后 campusctl shutdown --confirm。请求在服务器运行，必须继续存活 600 运行秒（十分钟），手机可以断开。控制层不得提前停止。';
  function validate(s,p){
    var a=make(s.runSeed,s.attemptId).answer,body=read(s,p),errors=[];
    if(s.controllerId!==a.controller||s.evidence.indexOf('/school/assets.tsv')<0)errors.push('T1：尚未确认有效的控制器与资产证据。');
    if(s.chainId!==a.tx||s.evidence.indexOf('/school/runtime.log')<0)errors.push('T2：尚未确认同一控制层事务的完整日志链。');
    if(typeof body!=='string')return {ok:false,errors:errors.concat(['清单文件不存在。'])};
    var lines=body.split('\n').map(function(x){return x.trim();}).filter(Boolean),values={},stops=[];
    lines.forEach(function(l){var m=/^(controller|transaction|token|clock)=(\S+)$/.exec(l),n=/^stop (\S+)$/.exec(l);
      if(m){if(values[m[1]])errors.push('重复字段：'+m[1]);values[m[1]]=m[2];}else if(n)stops.push(n[1]);else errors.push('无法识别的清单行：'+l);});
    [['controller',a.controller],['transaction',a.tx],['token',a.token],['clock','active']].forEach(function(v){if(values[v[0]]!==v[1])errors.push(v[0]+'：缺失或与证据不符。');});
    if(stops.join(',')!==a.order.join(','))errors.push('stop：必须按服务依赖顺序关闭三个功能模块，保留 control。');
    return {ok:!errors.length,errors:errors,body:body};
  }
  function ctl(s,args){
    var a=make(s.runSeed,s.attemptId).answer,verb=args[0],p;
    if(verb==='hint'){var level=Math.min(2,Math.max(1,+args[1]||1));s.hint=Math.max(s.hint,level);
      return level===1?'先读 site.txt、assets.tsv、runtime.log、services.txt；档案叙事在 company.txt 和 archive.txt。':
        '用区域和当前批次排除镜像与旧节点；日志按相同事务、控制器及 control 角色关联，再按 active 数字排列 prepare → authorize → commit，取最后回执。依赖箭头给出三个 stop 的先后。';}
    if(verb==='status')return 'T1 '+(s.controllerId||'未确认')+' · T2 '+(s.chainId||'未关联')+' · T3 '+(s.validated?'清单已校验':'未校验')+' · T4 '+(s.acceptedRequestId||'未提交');
    if(verb==='select'){
      if(args[1]!==a.controller||path(s,args[2]||'')!=='/school/assets.tsv')throw new Error('控制器与证据不匹配；核对区域、运行批次、角色与有效状态。');
      s.controllerId=args[1];if(s.evidence.indexOf('/school/assets.tsv')<0)s.evidence.push('/school/assets.tsv');s.validated=null;return 'T1 控制器已确认。';}
    if(verb==='trace'){
      if(s.controllerId!==a.controller)throw new Error('先确认 T1 控制器。');
      if(args[1]!==a.tx||path(s,args[2]||'')!=='/school/runtime.log')throw new Error('事务没有完整的控制层日志链。注意角色、校历与运行秒。');
      s.chainId=args[1];if(s.evidence.indexOf('/school/runtime.log')<0)s.evidence.push('/school/runtime.log');s.validated=null;return 'T2 日志链已确认。请把回执与时间口径写入清单。';}
    if(verb==='validate'){p=writable(s,args[1]||'/work/shutdown');var v=validate(s,p);s.validated=v.ok?{path:p,digest:hash(v.body)}:null;
      return v.ok?'T3 校验通过。提交后须存活十分钟；可以断开手机。输入 campusctl shutdown --confirm 明确提交。':v.errors.join('\n');}
    if(verb==='shutdown'){
      if(args[1]!=='--confirm'||args.length!==2)throw new Error('提交需要 --confirm；接受后必须存活十分钟。');
      if(!s.validated)throw new Error('先通过 T1—T3 并校验清单。');
      var check=validate(s,s.validated.path);if(!check.ok||hash(check.body)!==s.validated.digest)throw new Error('清单或证据改变，请重新校验。');
      return {text:s.acceptedRequestId?'服务器已接受此请求；不会重新计时。':'服务器接受停机请求，开始 600 运行秒生存阶段。',request:'shutdown'};
    }
    throw new Error('未知 campusctl 子命令。输入 man campusctl。');
  }
  function command(s,argv,input){
    var cmd=argv.shift(),p,data,files=make(s.runSeed,s.attemptId).files;
    if(cmd==='help'){s.helpRead=true;return HELP;}
    if(cmd==='man')return argv[0]==='campusctl'?MAN:HELP;
    if(cmd==='pwd')return s.cwd;
    if(cmd==='ls'){p=path(s,argv.filter(function(x){return x!=='-a';})[0]);return Object.keys(files).concat(Object.keys(s.work),s.dirs,['/school','/work'])
      .filter(function(x){return x.indexOf(p==='/'?'/':p+'/')===0;}).map(function(x){return x.slice(p==='/'?1:p.length+1).split('/')[0];})
      .filter(function(x,i,arr){return x&&arr.indexOf(x)===i;}).sort().join('\n');}
    if(cmd==='cd'){p=path(s,argv[0]);if(p!=='/'&&p!=='/school'&&s.dirs.indexOf(p)<0)throw new Error('目录不存在。');s.cwd=p;return '';}
    if(cmd==='mkdir'){if(argv.length!==1)throw new Error('用法：mkdir /work/目录');p=writable(s,argv[0]);if(s.dirs.length>=32)throw new Error('目录数量已达上限。');if(s.dirs.indexOf(p)<0)s.dirs.push(p);return p;}
    if(cmd==='edit'){if(argv.length!==2)throw new Error('用法：edit /work/文件 "内容"，用 \\n 换行。');return '已保存 '+write(s,argv[0],argv[1].replace(/\\n/g,'\n'));}
    if(cmd==='cp'){if(argv.length!==2)throw new Error('用法：cp 源文件 /work/目标');data=read(s,argv[0]);if(data===undefined)throw new Error('源文件不存在。');return '已复制 '+write(s,argv[1],data);}
    if(cmd==='campusctl')return ctl(s,argv);
    if(['cat','grep','head','tail','sort'].indexOf(cmd)<0)throw new Error('不支持的命令。输入 help 查看本模拟环境的命令。');
    var pattern=null,count=10;if(cmd==='grep')pattern=argv.shift();
    if((cmd==='head'||cmd==='tail')&&argv[0]==='-n'){argv.shift();count=Number(argv.shift());if(!Number.isInteger(count)||count<0||count>200)throw new Error('-n 范围为 0—200。');}
    if(argv.length>1)throw new Error('每段命令只接受一个文件；使用管道连接。');data=argv.length?read(s,argv[0]):input;if(typeof data!=='string')throw new Error('文件不存在或管道没有输入。');
    if(cmd==='cat')return data;
    var lines=data.split('\n');if(cmd==='grep'){if(pattern===undefined)throw new Error('grep 需要字串（按原文匹配）。');lines=lines.filter(function(l){return l.indexOf(pattern)>=0;});}
    if(cmd==='sort')lines.sort();if(cmd==='head')lines=lines.slice(0,count);if(cmd==='tail')lines=count?lines.slice(-count):[];return lines.join('\n');
  }
  function run(s,line){
    try{
      if(typeof line!=='string'||line.length>4096)throw new Error('输入最多 4096 字符。');
      var tokens=words(line),parts=[[]];tokens.forEach(function(t){if(t==='|')parts.push([]);else parts[parts.length-1].push(t);});
      if(parts.length>4||parts.some(function(p){return !p.length;}))throw new Error('管道最多四段，且不能留空。');
      if(parts.length>1&&parts.some(function(p){return ['cat','grep','head','tail','sort'].indexOf(p[0])<0;}))throw new Error('管道仅支持 cat/grep/head/tail/sort。');
      var out='';parts.forEach(function(p){out=command(s,p,out);});
      return typeof out==='object'?out:{text:String(out).slice(0,LIMIT)};
    }catch(e){return {text:'错误：'+e.message,error:true};}
  }
  return {fresh:fresh,generate:make,run:run,validate:validate,read:read,path:path};
})();
