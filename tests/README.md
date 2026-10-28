运行操作回归检查：

```bash
python -m pip install playwright
python -m playwright install chromium
python -m unittest discover -s tests -v
```

若已安装系统 Chromium，可通过 `CHROMIUM_EXECUTABLE` 指定路径；测试会自动查找 `chromium`。

测试自动启动本地 HTTP 服务，使用 Chromium 软件 WebGL，覆盖首页与旧链接、Wiki 的桌面和触屏入口及返回游戏、原生全屏、WebKit 兼容分支、拒绝后重试、鼠标锁定、触屏接管、真实双指操作、触摸取消、面板与暂停恢复、移动速度和界面滚动。WebKit 接口及主屏幕模式通过模拟接口验证；未替代实体 Safari/iPhone 测试。
