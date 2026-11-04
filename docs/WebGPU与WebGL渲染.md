# WebGPU 与 WebGL 渲染

本次接入使用同一套 Three.js 场景、模型、碰撞、玩法和存档；图形模式只决定渲染后端。适配基线为 `main@1b227c1`，Three.js 从 r160 更新到固定的 r187。

## 选择与兼容

设置中的「图形模式」默认自动：在安全上下文中尝试 WebGPU；没有 API、无法取得适配器/设备、本地扩展包加载失败、初始化超时或后期管线失败时，自动使用 `WebGLRenderer`。兼容路径需要 WebGL 2；Three.js r187 已不支持 WebGL 1。

可以在设置里选择「WebGL 兼容模式」，下次打开游戏时生效。不会在游玩中自动刷新页面。开发时可用 `?renderer=webgl` 固定兼容路径，`?renderer=webgpu` 请求 WebGPU；后者仍保留失败回退。该参数不启用调试或修改成绩资格。

建议使用 HTTPS 或 `http://localhost`；普通 HTTP 的远程地址可能没有 WebGPU。脚本、模型和贴图仍随仓库提供，离线时无须访问 CDN。两个图形 API 都无法启动时，页面提供可读的错误说明和兼容模式重试按钮。

## 资源与恢复

`engine/device.js` 管理设备选择、按需加载、启动期限和设备丢失。GPU 设备初始化上限 12 秒，首个后期管线准备上限 15 秒；迟到的初始化结果会释放，不会把已启动的兼容渲染器换回去。

`.render-surface` 是设备拥有的实际渲染画布，`#cv` 持续作为输入画布。WebGPU 丢失或报出无法继续渲染的错误时，暂停模拟和玩家输入，换建 WebGL 画布、渲染目标与阴影资源，再使用原场景和相机继续。正式位置、背包、剧情、巡察进度、开场/结局舞台及暂停状态不通过重开游戏恢复。原输入元素与事件绑定保留。

Three.js 的 WebGPU 扩展共用基础包的核心类型；两个版本的 Three.js 不会混在一个场景里。设备切换后不再尝试自动切回 WebGPU。设置值存入原设置项，与普通存档和速通存档分开。

## 后期与画质

WebGL 使用原有 GLSL 后期；WebGPU 使用本地 WGSL 节点材质，支持视野边缘扭曲、暗角、色差、统一亮度/曝光、伤害与闪光、巡察红光、目光、死亡覆盖、辉光、颗粒、反色、手持物合成及深度环境遮蔽。舒适设置和界面层继续独立生效。

五档画质共用配置与物理数据。原生 WebGPU 的 MSAA 按设备能力使用 4 倍或退为后期边缘平滑；不会要求不支持的 8 倍采样。高画质的深度读取按单采样/多采样分别编译，多采样深度取样本平均值供接触遮蔽使用；手持物使用独立目标，不清空世界深度。两条路径不承诺逐像素相同。

## 开发与验证

游戏仍由模块清单加载普通脚本。渲染库的锁定依赖、生成命令和许可证见[构建说明](../tools/vendor/README.md)。改动 WGSL 不需要重新打包第三方库；增加导出或更新 Three.js 需要重新生成本地包。运行 `node tools/link_modules.cjs --write` 更新文件依赖契约。

```bash
python tools/check_modules.py
PYTHONPATH=tests python -m unittest -v test_webgpu
PYTHONPATH=tests python -m unittest -v test_engine test_sensory
```

`test_webgpu` 的原生用例使用实际 GPUAdapter/GPUDevice、WGSL 管线、纹理读回和设备销毁事件；自动环境通过 Chromium + SwiftShader/Vulkan 执行。失败用例还会控制适配器、资源加载和设备申请，核对兼容分支。工作流「WebGPU and WebGL fallback」复核生成包并运行两类浏览器检查。渲染和架构工作流均在 PR 更新或 `main` 推送时运行；功能分支的推送由 PR 事件覆盖，避免同一提交重复触发并取消检查。

软件设备验证功能和资源生命周期，不能据此判断实体 GPU 的速度、耗电、移动设备温升或所有浏览器的驱动兼容性。实机性能和听感验收应独立记录。

本轮选定回归的逐项结果、截图、源码摘要与原始日志见[WebGPU 接入验证](validation/WebGPU接入/README.md)。
