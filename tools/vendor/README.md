# 渲染库构建

Three.js 固定为 `0.187.0`，esbuild 固定为 `0.28.2`，完整依赖见 `package-lock.json`。游戏直接使用提交到 `game3d/lib/` 的普通脚本；运行和部署不需要 Node、npm、CDN 或在线编译。

在仓库根目录更新生成文件：

```bash
npm --prefix tools/vendor ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/vendor run build
```

- `three.min.js` 提供 WebGLRenderer 及共享核心，包含 WebGPU 所需的核心工具导出。
- `three-webgpu.min.js` 提供 WebGPURenderer、节点材质和所需 TSL 功能，仅在尝试 WebGPU 时加载。构建插件将核心引用接到同一份 `THREE`，防止同时加载两个不兼容版本。
- `THREE-LICENSE.txt` 是 Three.js 的 MIT 许可。生成包保留许可注释。

WGSL 后期源码位于 `game3d/js/engine/webgpu-post.js`，作为游戏模块维护，不藏在生成库里。WebGL 后期位于 `engine/three.js`。初始化、资源释放和回退见 `engine/device.js`；行为验证见 `tests/test_webgpu.py`。
