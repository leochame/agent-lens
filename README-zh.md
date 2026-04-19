# AgentLens

AgentLens 现在更适合被定义为一个本地 AI 网关工作台，而不只是“代理”。

它目前同时承担 3 类核心能力：
- 透明请求路由与转发
- 基于原始归档的请求/响应日志查看
- Loop / Workflow 任务执行与运行态观察

从产品结构上看，现在是 **4 个工作区入口**：
- `Home`：入口与信息架构
- `Router`：上游、Provider、路由与转发配置
- `Log`：归档日志查看
- `Loop`：Workflow 与任务运行工作台

也可以更简洁地说：**3 个核心业务模块 + 1 个首页入口模块**。

## 当前分为几个模块？

### 1. Home 模块
- 路径：`/`
- 作用：只负责解释页面边界，并把用户送到正确工作区
- 不负责：配置编辑、日志查看、任务执行

### 2. Router 模块
- 路径：`/__router`
- 代码位置：`src/router`、`src/frontend/router`
- 作用：负责监听、上游配置、Provider 判断、路径改写、透明转发
- 当前覆盖能力：
  - OpenAI / Anthropic 请求格式识别
  - 基于 Header 或路径的路由
  - Provider 级别的上游 URL 与鉴权配置
  - 转发到第三方中转域名或兼容网关

### 3. Log 模块
- 路径：`/__log`
- 兼容入口：`/__admin` 现在会跳转到 `__log`
- 代码位置：`src/log`、`src/frontend/log`、`src/frontend/admin`
- 作用：给人看归档日志详情，不改变原始归档内容
- 当前产品规则：
  - 请求和响应按 `requestId` 一一对应
  - 请求侧主视图聚焦归档请求里的 `body.text`
  - 当 `body.text` 是 JSON 或 JSON-encoded 文本时，只在前端展示层递归解析
  - SSE 响应可以为了展示聚合，但仅限展示层
  - 展示逻辑不能改写、归一化、重建原始归档内容
  - 只有存在 archived detail 的记录才应该出现在可查看列表中

### 4. Loop 模块
- 路径：`/__loop`
- 代码位置：`src/loop`、`src/frontend/loop`
- 作用：负责 workflow 搭建、任务执行、队列、运行中状态和历史
- 当前覆盖能力：
  - 周期任务管理
  - 立即运行、暂停、恢复、停止
  - 队列与实时运行态查看
  - 以 workflow-first 方式组织任务，同时兼容单命令模式

## 一句话解释当前项目

AgentLens 是一个本地运行的 AI 网关工作台，把 `Router`、`Log`、`Loop` 三个能力放在同一个服务里：
- `Router` 负责把请求透明转发到正确上游
- `Log` 负责按归档原样查看 request/response
- `Loop` 负责搭建和运行 workflow / task

## 快速启动

要求：Node.js >= 20

```bash
npm install
npm run build
npm start
```

默认地址：`http://127.0.0.1:5290`

## 页面入口

- Home：`http://127.0.0.1:5290/`
- Router：`http://127.0.0.1:5290/__router`
- Log：`http://127.0.0.1:5290/__log`
- Loop：`http://127.0.0.1:5290/__loop`

## 代码结构

- 入口：`src/index.ts`
- HTTP 服务与页面/API 挂载：`src/router/proxy/server.ts`
- Router 后端：`src/router`
- 日志归档与日志服务：`src/log`
- Loop 调度与运行时：`src/loop`
- 前端页面：`src/frontend`

## 配置与数据

- 主配置：`config/default.yaml`
- Loop 任务：`config/loop-tasks.json`
- 日志与归档目录：`logs/`

## 注意

- 管理/日志页面默认无鉴权，仅建议本机使用。
