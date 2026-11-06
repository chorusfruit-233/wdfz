#!/usr/bin/env node
/* 把 3D 版打包成一个单文件 HTML（离线可用；APK 里也装的是它）。
   用法：node tools/build_single_html.cjs [输出路径，默认 dist/wdfz-3d.html]

   做法：
   · index.html 里的两份 CSS 内联成 <style>；modules.js、manifest.js 这两个直接引用的脚本内联执行。
   · 其余脚本（清单里的全部模块、Three.js 与 WebGPU 库、DLC、四档模型包、两档贴图包）都以
     <script type="text/x-wdfz" data-path="…"> 文本块嵌进页面（浏览器不执行这种类型），
     运行时 WDFZ_BUNDLE.url(path) 把它变成 blob 地址，GameModules.src() 用这个地址按原顺序加载。
     这样加载顺序、document.write、按画质挑包、运行中换画质都和网页版一样，源码不用为单文件版分叉。
   · 文本块里的 "</script" 与 "<!--" 换成 "<\/script"、"<\!--"（JS 里等价），免得提前结束文本块。
   · Wiki 和效率对比页是另外的页面，单文件里换成线上地址（BASE_URL）。 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'wdfz-3d.html'));
const BASE_URL = process.env.WDFZ_BASE_URL || 'https://wd-fz.github.io/';

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function guard(code) { return code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'); }

/* 要嵌进去的脚本：game3d/ 下除了直接内联的 modules.js、manifest.js 以外的全部 .js */
function walk(dir, out) {
  for (const name of fs.readdirSync(path.join(ROOT, dir)).sort()) {
    const rel = dir + '/' + name, st = fs.statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.js$/.test(name)) out.push(rel);
  }
  return out;
}
const INLINE = new Set(['game3d/js/modules.js', 'game3d/manifest.js']);
const files = walk('game3d', []).filter((f) => !INLINE.has(f));

/* 清单里登记的文件必须都在：缺一个单文件版就会在加载时卡住 */
const manifest = read('game3d/manifest.js');
const listed = [...manifest.matchAll(/'(game3d\/[^']+\.js)'/g)].map((m) => m[1]);
const missing = listed.filter((f) => !INLINE.has(f) && !files.includes(f));
if (missing.length) { console.error('清单里的文件不存在：' + missing.join('、')); process.exit(1); }

let html = read('index.html');
const PRELUDE = `<script>
/* 单文件版（tools/build_single_html.cjs 生成，不要手改）：脚本在下面的文本块里，按路径换成 blob 地址 */
var WDFZ_BUNDLE=(function(){
  var cache={};
  function block(p){ var list=document.getElementsByTagName('script'); for(var i=0;i<list.length;i++){ if(list[i].type==='text/x-wdfz'&&list[i].getAttribute('data-path')===p) return list[i]; } return null; }
  function url(p){
    p=String(p||'').replace(/^\\.\\//,'');
    if(cache[p]) return cache[p];
    var b=block(p); if(!b) return null;
    cache[p]=URL.createObjectURL(new Blob([b.textContent+'\\n//# sourceURL='+p],{type:'text/javascript'}));
    return cache[p];
  }
  /* 另外的页面（Wiki、效率对比）在单文件里没有：换成线上地址，新窗口打开 */
  var BASE=${JSON.stringify(BASE_URL)};
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null; if(!a) return;
    var h=a.getAttribute('href');
    if(/^(wiki\\/|benchmark\\/)/.test(h)){ a.setAttribute('href',BASE+h); a.setAttribute('target','_blank'); a.setAttribute('rel','noopener'); }
  },true);
  return {url:url,single:true,base:BASE};
})();
</script>`;

/* CSS 内联 */
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => '<style data-path="' + href + '">\n' + read(href).replace(/<\/style/gi, '<\\/style') + '\n</style>');
/* 脚本文本块放在 modules.js 前面：GameModules.boot() 写脚本标签时它们都已经在页面里 */
const blocks = files.map((f) => '<script type="text/x-wdfz" data-path="' + f + '">' + guard(read(f)) + '</script>').join('\n');
let n = 0;
html = html.replace(/<script src="(game3d\/js\/modules\.js|game3d\/manifest\.js)"><\/script>/g, (m, src) => {
  n++;
  const code = '<script data-path="' + src + '">\n' + guard(read(src)) + '\n</script>';
  return src === 'game3d/js/modules.js' ? PRELUDE + '\n' + blocks + '\n' + code : code;
});
if (n !== 2) { console.error('index.html 里没找到 modules.js / manifest.js 的引用'); process.exit(1); }
/* 静态链接也指向线上（点击时还会再处理一次，这里让悬停提示也对） */
html = html.replace(/href="(wiki\/[^"]*|benchmark\/)"/g, (m, h) => 'href="' + BASE_URL + h + '" target="_blank" rel="noopener"');
html = html.replace('<head>', '<head>\n<meta name="generator" content="wdfz build_single_html">');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
console.log('单文件版：' + path.relative(ROOT, OUT) + '（' + mb + ' MB，嵌入 ' + files.length + ' 个脚本）');
