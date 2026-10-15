# Forma · Intelligent UI

中文流式对话 Demo：文字与可交互界面直接出现在同一条助手回复中，卡片、图表与控件随模型输出逐步展开。保留每轮回答，可以点选控件后继续对话。

使用 [OpenUI](https://www.openui.com/docs/getting-started) 官方 `@openuidev/react-lang` 1.0.1。模型生成文字与 OpenUI Lang 围栏，程序按顺序分段交给官方 `Renderer`；每段界面各有一个根节点。没有执行模型生成的 HTML 或 JavaScript。

线上体验：[GitHub Pages Demo](https://omoyx.github.io/forma-intelligent-ui/)，需要访问密码。模型代理运行在独立云端，详见 [部署说明](deploy/README.md)。

## 对比试验台

[直接进入对比](https://omoyx.github.io/forma-intelligent-ui/#compare)，也可点击顶部“对比试验台”。输入一次问题，会同时向同一个模型发起两个独立流式请求：A 使用完整 OpenUI 提示词和交互组件，B 使用简短中文助手提示词，仅普通 Markdown 回答。两侧模型、问题和生成参数相同，每次不带历史，避免两侧回答互相影响。支持统一停止、切换模型后再次对比和清空；原对话记录独立保留。

两侧显示服务端首字/总生成耗时与原始输出字符数（含 A 侧界面描述，不是 token 数，也不是最终界面字数）。OpenUI 组件另可检索真实图片、地点等，B 无查询工具，因此这是完整体验对比；提示词长度、内容规则及数据能力均有差异，不能单独据此判断模型质量或 OpenUI 的纯解析开销。点击界面中的继续按钮会将问题及选择放入共同输入框，确认后两侧再发送；不自动执行外部操作。结果只保留在当前页面内，刷新后重置。

服务端 `/api/generate` 新增可选 `mode: "openui" | "plain"`，默认 openui。plain 不做界面解析和结构修复，鉴权、限额、超时及取消规则与原模式一致。

## 启动

Node.js 20+，在 `work/` 执行：

```bash
npm --prefix intelligent-ui ci
npm --prefix intelligent-ui start
```

打开 **http://127.0.0.1:8780**，端口占用时自动顺延。启动时自动构建。网页脚本、字体和地图运行库不依赖外部 CDN；真实图片与地图瓦片按需从对应来源加载。

依赖固定在独立的锁文件，`.npmrc` 使用 npmmirror 并禁用安装脚本。镜像实际重定向与完整性记录在 `task/014-intelligent-ui/mirror-verification.json`。安装失败时暂停检查镜像，不自动回退原站。

## 模型

服务端优先使用环境变量，再读取仓库根目录 `.env`，其次读取 `work/.env`：

```dotenv
HUOSHAN_BASE_URL=https://your-provider.example/v1
HUOSHAN_API_KEY=your-key
# 可选，默认沿用项目已验证的模型
INTELLIGENT_UI_MODEL=deepseek-v4.1-flash
```

使用现有火山接口的 `/chat/completions` 流式协议，无需 OpenUI Gateway 密钥。页面可切换默认模型、deepseek-v4-pro、doubao-seed-2.1-pro、qwen3.8-flash。

密钥仅在服务端读取，浏览器拿不到密钥和接口地址。服务仅监听本机回环地址。输入、对话上下文与所选偏好会发送给 `.env` 对应的模型服务。

## 体验

- 试试 **「我想了解下欧标插头」**：四张插头卡片按模型生成顺序独立出现，每张说明也实时增长。默认只用一句开场、简短卡片和一个追问，可选择类型后继续了解。示意图由受控的本地 SVG 组件绘制，明确标注非尺寸图。
- 试试 **「给我 C 型和 F 型欧标插头的真实照片，简单说区别」** 或 **「水豚长什么样，给我一张真实照片」**：模型按需选择通用 `PhotoCard` / `PhotoGallery`，独立检索与加载，支持换图和重试，并保留来源、作者、许可。图片会经独立视觉模型筛选主体相关性，仍只作外观参考。
- 试试 **「推荐三道成都特色美食，简单说说」**：模型主动选择 `VisualList` + `VisualCard`，真实图片、名称、简短理由在同一项里逐张出现；说“用图文列表”可切换成左图右文。餐厅、景点和实物推荐也按需使用，纯文字做法不强制配图。图片是 Commons 检索参考，不保证是商家实拍或准确型号。
- 也可选择旅行、方案比较、数据看板，或自由输入。普通问题可以只回复文字。
- 每轮界面在原消息中保留，偏好按消息独立存储。更改选项后点击界面内继续按钮，或发送追问，会带上这轮的选择。
- 滑杆和选项本地改变偏好；通过继续对话由模型应用。表格可排序、选项卡可切换、清单可勾选。
- 停止生成立即结束请求、保留已显示的部分回答并恢复输入。结构错误自动校正一次，失败后可重试。
- 阅读历史消息时不强制滚动到底部。桌面和手机使用同一条对话流。
- 标签页 sessionStorage 保留最近 10 轮，模型使用最近 9 轮完整回答；刷新会保留记录，新对话清除记录。服务端不落盘保存对话。

这是体验 Demo，支持真实图片、地点、天气、参考汇率、延迟行情与部分联赛赛程/比分查询；具体交互与数据边界见 [场景覆盖](SCENARIOS.md)。未连接支付或预订等外部执行工具。模型生成的知识内容仍可能有误。插头示意用于区分接地结构，不能代替产品说明、设备铭牌或当地规范；转换头不变压。

插头组件参考：[Type C](https://www.worldstandards.eu/electricity/plugs-and-sockets/c/)、[Type E](https://www.worldstandards.eu/electricity/plugs-and-sockets/e/)、[Type F](https://www.worldstandards.eu/electricity/plugs-and-sockets/f/)。

## 验证

在 `work/` 执行：

```bash
npm --prefix intelligent-ui run build
npm --prefix intelligent-ui test
node intelligent-ui/test-images.mjs
node intelligent-ui/test-auth.mjs
node intelligent-ui/test-scenes.mjs
node intelligent-ui/test-compare.mjs
node intelligent-ui/test-visuals.mjs
node intelligent-ui/test-image-verifier.mjs
node intelligent-ui/smoke-visuals.mjs # 图文推荐真实模型检查，默认本机8781
node intelligent-ui/smoke-scenes.mjs # 需先启动；调用真实模型与数据源
node intelligent-ui/smoke-images.mjs # 需先启动本地 Demo
npm --prefix intelligent-ui run smoke
npm --prefix intelligent-ui run smoke -- --europlug
```

`test` 使用本地模拟上游验证部分流渲染、混合分段、纯文字、修复、异常与取消，不消耗模型额度。`smoke` 使用真实模型验证旅行、多轮预算、比较和看板；`--europlug` 专测欧标插头。这些真实调用消耗模型额度。结果与浏览器截图保存在 `task/014-intelligent-ui/`。

## 文件

- `src/library.jsx`：组件库、共享模型提示词；`example` 仅是自动测试夹具。
- `src/reply.mjs`：按生成顺序拆分文字和独立 OpenUI 围栏，支持不完整流。
- `src/app.jsx`：对话、流式消费、每轮偏好、停止与历史记录。
- `src/compare.jsx`：同题双路对比页；`src/stream.mjs`：共享 SSE 读取。
- `src/styles.css`：响应式聊天页面和组件。
- `server.mjs`：`.env` 模型代理、SSE 转发、解析校验、单次修复与取消。
- `build.mjs`：本地静态资源及服务端共享库构建。

## 更多交互

新增地图多标记、折线/面积/散点/占比、流程图、实时重算计算器、参数模拟、先答后揭晓测验、输入表单和来源卡片。天气、汇率、行情与体育卡片展示实际来源、日期和错误状态。组件会按需求选用，避免堆叠。详见 [场景与示例](SCENARIOS.md)。

## 真实图片链路

模型只给英文检索词和中文说明 → 已鉴权 `/api/images?query=...` → 固定 Wikimedia Commons API → 独立视觉模型检查候选图片实际内容 → 只返回匹配图片 → 受信图片域名直载。组件不会执行模型提供的 URL，不代理任意网址。检索在服务端超时 12 秒，同词并发合并，匹配结果缓存一小时、空结果缓存5分钟，最多 100 词，最多 4 个并发检索及校验任务。图片校验另有35秒超时；失败不展示未校验图片。浏览器对尚在流式生成的关键词做短暂合并，卡片和文字仍立即渲染。

图文推荐使用标题匹配搜索，减少只因正文提及同名词而误配的结果；未找到就显示空态，不回退成泛主题照片。

对话模型不会看到搜索结果。独立筛选使用同一服务端模型接口和密钥，默认 `doubao-seed-2.1-pro`，可用 `INTELLIGENT_UI_VISION_MODEL` 指定兼容的视觉模型。筛选只接收检索词及最多三张候选图片内容，不发送聊天记录、密码、作者或文件名；不依赖模型服务自行下载国外图片网址。图片下载限可信域名、禁止跳转、限制JPEG/PNG/WebP且每张最多2MB。视觉判断仍可能出错，不鉴定商家真实性、精确型号或安全适配。使用“换一张”查看其他结果，可点来源核对。检索词会发送给 Commons，图片加载会连接 Wikimedia 图片域名；只发送检索词，不发送对话历史。图库许可和署名保留在每张卡片下方。
