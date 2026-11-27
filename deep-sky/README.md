# Grand Luxury Tree v17.6.5 · 飞书文档代码抓取与运行记录

- 仓库：https://github.com/Hwescon/christmas-tree-v17.6
- 在线直接玩（GitHub Pages，需允许摄像头 + 能访问 jsdelivr）：https://hwescon.github.io/christmas-tree-v17.6/

来源：https://my.feishu.cn/wiki/XJlawBeOOiBFStk7yAfcYYcXngk
文档标题：**12.13号圣诞树代码🎄V17.6版本**
文档 token：`TFkzdvKKxowu8cxJUWBcsEranVf`（wiki 空间 `7551390496917176348`）

## 怎么拿到的

1. 该文档对匿名访客开放（`isPermitted: true`），但正文不在 SSR 首屏里，需要执行页面 JS 才会渲染。
2. 正文实际藏在页面里的 `window.DATA = Object.assign({}, window.DATA, { clientVars: Object({...}) })` 中：
   `clientVars.data.block_map`（59 个块）+ `block_sequence`（块顺序）。
3. 按 `block_sequence` 顺序、用 `data.text.initialAttributedTexts.text` 拼回每个块的纯文本，
   唯一的 `type: "code"` 块（id `J2Ixd8Y0MouQQexUf8Vc8rMLnrd`，47593 字符）就是完整代码。
4. 文档其余部分（源提示词 / 功能介绍 / Win-Mac 运行流程 / 已知问题）见 `full_doc.txt`。

## 修复了 5 处被飞书吞掉的换行

飞书文本导出会把「行注释 `// ...` 结尾的那一行」的下一个换行吃掉，导致注释把下一行代码一起注释掉，
其中 `// Clean Database Name` 后面的 `const DB_NAME` 被打包进注释，直接导致整段 module 脚本语法错误（白屏/一直转圈）。

| 位置 | 修前 | 修后 |
| --- | --- | --- |
| DB 初始化 | `// Clean Database Nameconst DB_NAME = ...` | 拆成两行 |
| setupEvents | `// ==== V17.6.5: UI + Keyboard ====window.setupEvents = function() {` | 拆成两行 |
| 键盘控制 | `// --- Keyboard Controls ---window.addEventListener('keydown', ...)` | 拆成两行 |
| 键盘交互 | `// 键盘交互window.addEventListener('keydown', ...)` | 拆成两行 |
| 旋转逻辑 | `// Updated Rotation Logicif(manualRotateState.x!==0 ...)` | 拆成两行 |

修复后 `node --check` 通过（0 error），页面正常进入渲染。

## 怎么跑

```powershell
# 任意静态服务器都行，必须走 http（MediaPipe 取摄像头需要安全上下文，file:// 不给摄像头）
cd christmas_tree
python -m http.server 8123 --bind 127.0.0.1
# 浏览器打开
start http://127.0.0.1:8123/index.html
```

- 依赖外网：three@0.160（jsdelivr）、@mediapipe/tasks-vision@0.10.3（jsdelivr + googleapis 模型）、Google Fonts。
- 手势需要摄像头权限（距离 20–30cm、手倾斜约 45°、光线充足）。
- 键盘：`空格` 聚合 / `Z` 散开 / `X` 抓照片 / 方向键旋转；鼠标拖标题、滑块调密度与雪花。

## 照片色彩修复（v17.6.5-c）

**症状**：上传的照片人脸发白、白衣服糊成一片、整体发灰发粉（原版把照片和整个画面一起过了 bloom + Reinhard）。

**原因**：照片用 `MeshBasicMaterial` 但 `toneMapped` 默认 true，会吃 `ReinhardToneMapping + exposure 2.2`；
再加上 bloom 阈值只有 0.7，照片里的亮部直接进泛光，双重推爆高光。

**改法**：

1. 解码统一走 sRGB 画布：`<img>` → 2D canvas（`colorSpace:'srgb'`，最长边缩到 1024）→ `CanvasTexture`；
   P3 / 带 ICC / 超大图先规整成 sRGB 像素再进 WebGL，避免不同来源图片偏色。
2. 照片材质 `toneMapped = false`，色调映射不再作用于照片。
3. 照片线性增益 0.85（`pm.color.setRGB(0.85,0.85,0.85)`），峰值压到 bloom 阈值以下。
4. bloom 阈值 0.7 → 0.86、强度 0.45 → 0.55：只有金饰高光继续发光，照片不再被泛光糊掉。
5. 纹理 8x 各向异性 + mipmap，斜视也清晰。

**效果**（同一张 2048×2048 照片、聚焦态）：高光裁切像素 13.9% → 0.9%，
对比图见 `shots/photo_color_before.png` / `shots/photo_color_after.png`，场景内效果 `shots/photo_in_scene_after.png`。

## 手机端改造（v17.6.5-m）

同一个 `index.html`，桌面/手机自适应，**手机上直接开网址就能用**：

- **判定**：`(max-width: 760px)` 或 `(hover: none) and (pointer: coarse)`，外加移动端 UA 兜底 → 手机横屏也算移动端。
- **触控**：单指在画面上拖动 = 旋转（直接推 `STATE.rotation`），双指捏合 = 拉近拉远（`camera.position.z` 26–88）；
  方向键、标题拖动全部改用 Pointer Events，触摸/鼠标同一套代码。
- **布局**：左侧长面板改成底部抽屉（`58dvh`，可滚动，收起时 `translateY` 移出屏幕）；
  底部新增 5 键工具条：`聚合 / 散开 / 抓图 / 镜头 / 设置`；摄像头预览缩到 96×72 放左上角；
  按钮/滑杆提升到 38–44px 触摸目标，输入框 16px 防 iOS 聚焦缩放；适配 `env(safe-area-inset-*)` 刘海与小白条。
- **性能**：粒子 1500→700、星尘 2500→1000、雪花 1500→600；`devicePixelRatio` 封顶 1.6、关掉 MSAA、
  bloom 减弱；`dt` 限幅 0.05（顺带修掉了低帧率下粒子指数飞散的问题）。
- **AI 与摄像头**：`facingMode:'user'` + 640×480 约束；MediaPipe 先试 GPU，失败自动回落 CPU；
  检测帧率在手机上限到约 14fps。
- **iOS**：全屏 API 缺失时降级为“隐藏界面”；首次触摸解锁音频；禁用双击缩放与页面回弹。

手机端操作：`聚合 / 散开 / 抓图` 点底部按钮，`设置` 拉出抽屉（祝福语、字体、粒子、音乐、照片都在里面），
`镜头` 收起/显示摄像头小窗；手势仍可用（张开手掌=散开、握拳=聚合、捏合=抓照片）。

## 已知坑（实测）

- 软件渲染（headless SwiftShader）下帧间隔 dt 会到 0.3s 以上，`position.lerp(target, 4*dt)` 的系数 >1，
  粒子会指数级飞散、树看不见。现已统一 `dt = Math.min(clock.getDelta(), 0.05)`，软件渲染也不会再炸。
- 首次加载依赖 CDN，网络差会一直停在 `SYSTEM INITIALIZING`；手机上建议 Wi-Fi。
- 手机端为性能考虑默认只生成 700 个装饰，想要更密可在“粒子控制”里把「装饰密度」拉到 1600。

## 文件

- `index.html` —— 修好换行 + 手机适配的完整单文件应用（桌面/手机同一份）
- `raw_text_from_feishu.txt` —— 从飞书块里原样拼出的代码文本（未修复换行，留档）
- `full_doc.txt` —— 整篇文档的纯文本（含源提示词与排障说明）
- `shots/tree_mode2.png` / `shots/scatter_mode.png` —— 桌面：聚合态 / 散开态
- `shots/mobile_portrait.png` —— 手机竖屏（iPhone 尺寸模拟）
- `shots/mobile_landscape.png` —— 手机横屏
- `shots/tablet_portrait.png` —— 平板竖屏
- `shots/mobile_sheet.png` —— 手机端设置抽屉展开
- `shots/mobile_focus.png` —— 手机端散开态
- `shots/mobile_live_pages.png` —— 手机直接访问 GitHub Pages 线上版
