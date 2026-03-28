# AgentLens

AgentLens 是一个本地透明代理，用来观察和排查 AI 请求。

它做三件事：
- 转发请求到你配置的上游模型服务（OpenAI / Anthropic / 兼容网关）
- 记录 request / response（原始归档可在管理页开关）
- 提供本地管理页面查看日志和修改配置

## 快速使用

要求：Node.js >= 20

```bash
npm install
npm run build
npm start
```

默认监听：`http://127.0.0.1:5290`

把你的客户端 Base URL 指向 AgentLens，例如：

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:5290
```

## 前端配置（推荐）

启动后打开：`http://127.0.0.1:5290/__admin`

在页面里完成这些配置即可：
- 新增/编辑 Provider（`baseURL`、`hostHeader`、鉴权模式）
- 设置路由默认 Provider
- 保存后立即生效

你不需要手动改配置文件，前端保存会写入本地配置。

## 定时 Loop（新功能）

启动后可打开：`http://127.0.0.1:5290/__loop`

这个页面是独立功能，不影响原有代理逻辑，支持：
- 新建定时任务（循环间隔、工作目录或文件路径）
- Runner 选择：`Codex`（默认） / `Claude Code` / `Custom`
- 手动立即执行、启停任务、删除任务
- 创建前测试执行（不保存任务）
- 路径检测（目录/文件）；文件路径会自动切换到父目录执行
- Codex 模板库（一键填充常见巡检任务）
- 常用路径收藏（本地浏览器保存）
- 复用最近一次成功测试配置（本地浏览器保存）
- 任务编辑、复制到表单快速新建
- 任务列表搜索过滤（按名称/Runner）
- 多任务并行执行（可配置全局最大并发，超出自动排队）
- 单任务多阶段 Workflow（每行一个步骤，如“开发 -> Code Review”串联执行）
- Workflow 共享会话（默认开启；同任务步骤/轮次复用同一个 Codex 会话）
- Codex 权限模式切换（标准 / Full Access）
- 每步骤可单独覆盖 runner/command（格式：`步骤|runner|command`）
- 可在前端可视化编辑器中为每个步骤单独设置 cwd/文件路径（目录直接执行；文件自动用父目录执行）
- 每步骤可单独覆盖失败策略（格式扩展：`步骤|runner|command|continue/stop`）
- 可视化 Workflow 步骤编辑器（增删、上下移动、启停，并可与文本双向同步）
- 可视化编辑器支持“高级字段”开关（简洁模式/完整模式）
- 内置步骤模板库（开发/Review/总结/测试），可一键插入
- 文本格式支持附加提示与启停位：`步骤|runner|command|promptAppend|continue/stop|on/off`
- 查看最近运行日志（stdout/stderr/状态）

说明：
- 任务会通过本机命令行执行（例如 `claude -p "{prompt}"`、`codex exec "{prompt}"`）
- Loop 任务不内置超时；通常只会在命令报错、手动停止或中转/上游报错时终止
- Full Access 会跳过沙箱与审批，请仅在可信环境开启
- 不同 CLI 版本参数可能不同，可在页面里改成自定义命令
- 任务配置会保存到 `config/loop-tasks.json`

## 鉴权规则（inject 模式）

当 Provider 使用 `inject`：
- 如果本机环境变量（Env Key 对应的变量）有值：使用本机值注入到指定 Header
- 如果本机环境变量没有值：保留下游传入的 Header（透传）

也就是：**本机优先，没有就透传**。

## 日志说明

- 页面可查看请求列表和 JSON 详情
- `request` 展示为 request `body.text` 原文
- `response` 为展示层替换后的合并结果（不改原始数据）
- 仅在开启 `archiveRequests` 时，原始 request/response 才会保存到本地日志目录

## 仅本地使用

管理页面默认无鉴权，请只在本机环境使用。
