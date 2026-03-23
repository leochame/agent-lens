# AgentLens 核心开发文档 (v1.0)

## 1. 总述：项目定位与核心目标

AgentLens 是一个本地请求链路拦截与观测工具，核心目标是拦截本地开发工具（如 Claude Code、Codex）发往云端 LLM 的请求流量，在不篡改原始请求结构、不破坏 SSE 流式响应的前提下，将深层嵌套的 System Prompt、Tool Use 和代码上下文全量落盘，为 AI 逆向工程与 Agent 开发提供底层数据支持。

v1.0 的关键词：

- 透明代理（Transparent Proxy）
- 字节级透传（Byte-Level Pass-through）
- SSE 完整支持（Streaming Safe）
- 双轨日志（Raw + JSON）
- 上游可配置（官方 API 与中转站均支持）

## 2. 范围定义

### 2.1 v1.0 必做

1. 原生 Node.js HTTP/HTTPS 代理链路跑通。
2. 请求头与请求体按原样转发，禁止链路内 JSON 重序列化。
3. 支持 SSE 响应透传，保证流式体验不退化。
4. 支持用户配置多上游（官方/中转），并可路由选择。
5. 落盘请求日志，支持原始字节与结构化 JSON 双轨记录。
6. 提供基本稳定性保障（超时、断连、错误处理）。

### 2.2 v1.0 非目标

1. 不做请求内容策略改写（如提示词注入、参数重写）。
2. 不做复杂前端可视化页面。
3. 不做分布式部署与多实例高可用。

## 3. 系统架构设计

AgentLens 采用无第三方网络框架依赖的纯原生 Node.js 架构，以获得对底层 Byte 流的控制能力。

### 3.1 模块划分

1. `proxy-engine`（代理引擎模块）
   - 建立原生 HTTP Server。
   - 处理 `req.on("data")` 和 `req.on("end")`，聚合请求体 Buffer。
   - 发起上游请求并将响应状态、响应头、响应流实时回写客户端。

2. `provider-router`（上游路由模块）
   - 根据规则选择目标上游（官方或中转）。
   - 负责 Host 重写、路径改写、鉴权透传/注入策略。

3. `logger-service`（日志服务模块）
   - 异步非阻塞落盘日志。
   - 以副本方式进行 UTF-8 解码与 JSON 解析，不影响主转发链路。
   - 输出 JSONL，记录 `raw` 与 `json` 双轨数据。

4. `config-manager`（配置管理模块）
   - 读取本地配置（`.env` + `yaml/json`）。
   - 管理监听端口、目标上游列表、路由策略、脱敏策略。

### 3.2 架构流转（文本版）

1. 客户端请求进入本地监听端口（如 `127.0.0.1:5290`）。
2. `proxy-engine` 收集请求头和请求体 Buffer。
3. `provider-router` 基于配置决策目标上游和转发参数。
4. `proxy-engine` 使用原始 Buffer 发起上游请求（不做 JSON parse/stringify）。
5. `logger-service` 异步落盘（raw + json）。
6. 上游响应到达后直接 pipe 给客户端，保持 SSE 原样输出。

## 4. 数据流转与透明性规范（强约束）

为保证代理行为对客户端透明，必须遵守以下规则：

1. Header 完整性
   - 全量复制客户端请求头，尤其 `authorization`、`x-api-key` 与厂商自定义头。

2. Host 重写
   - 若上游配置了 `hostHeader`，转发时必须将 `host` 头覆盖为指定域名。
   - 目的：避免云端 WAF / 网关校验失败。

3. 零序列化转发
   - 严禁在转发链路中执行 `JSON.parse()` 再 `JSON.stringify()`。
   - 请求体必须以原始 Buffer 发送，避免签名、转义、特殊字符一致性问题。

4. 响应零改写
   - 不解包响应数据，不重组 SSE 事件，不改写 `data:` 内容。

## 5. SSE 支持规范（v1.0 必须）

SSE 支持是 AgentLens v1.0 的硬性要求。

1. 透传原则
   - 上游返回什么字节，下游就收到什么字节。
   - 采用 `upstreamRes.pipe(clientRes)` 直通。

2. 响应头透传
   - 保留并回传 `statusCode` 与关键响应头，特别是：
   - `content-type: text/event-stream`
   - `cache-control`
   - `connection`
   - `transfer-encoding`

3. 禁止行为
   - 禁止先完整读取响应再写回客户端。
   - 禁止对 SSE 行做拆分重组或解析后再编码。
   - 禁止引入会影响实时流式输出的阻塞处理。

4. 断连处理
   - 客户端断连：及时销毁上游请求，释放资源。
   - 上游断连/异常：及时结束客户端响应并记录错误日志。

## 6. 日志落盘规范（Raw + JSON 双轨）

目标：既保证取证完整性，也便于后续检索分析。

1. `raw` 轨（权威数据）
   - 保存请求体原始字节（建议 `base64`）。
   - 保证即使 JSON 解析失败，也不丢失原始内容。

2. `json` 轨（分析友好）
   - 仅在 `Content-Type` 为 JSON 且解析成功时记录 `jsonBody`。
   - 解析失败时记录 `parseError`，但不影响转发链路。

3. 日志格式
   - 使用 JSONL（一行一条事件）。
   - 字段建议如下：

```json
{
  "ts": "2026-03-21T10:20:30.123Z",
  "requestId": "uuid",
  "method": "POST",
  "path": "/v1/messages",
  "provider": "openai_relay_a",
  "headers": {
    "content-type": "application/json"
  },
  "rawBodyBase64": "eyJtb2RlbCI6Ii4uLiJ9",
  "jsonBody": {
    "model": "..."
  },
  "parseError": null
}
```

4. 安全与脱敏
   - 默认脱敏头字段：`authorization`、`x-api-key`、`cookie`、`set-cookie`。
   - 默认脱敏正文关键字：`token`、`password`、`secret`、`apiKey`。
   - 脱敏仅作用于日志副本，不影响真实转发内容。

## 7. 配置管理规范（支持官方与中转）

### 7.1 设计原则

1. 用户必须可自行配置上游，不假设只连接官方 API。
2. 同时支持官方端点与任意中转站端点。
3. 路由方式可组合：按请求头、按路径、默认兜底。

### 7.2 配置示例（YAML）

```yaml
listen:
  host: 127.0.0.1
  port: 5290

routing:
  defaultProvider: openai_official
  byHeader: x-target-provider

providers:
  openai_official:
    baseURL: https://api.openai.com
    hostHeader: api.openai.com
    authMode: passthrough

  openai_relay_a:
    baseURL: https://relay.example.com
    hostHeader: relay.example.com
    authMode: passthrough

  anthropic_relay_b:
    baseURL: https://anthropic-proxy.example.net
    hostHeader: anthropic-proxy.example.net
    authMode:
      type: inject
      header: x-api-key
      valueFromEnv: RELAY_B_KEY
```

## 8. 错误处理与稳定性要求

1. 上游超时：返回 `504 Gateway Timeout`。
2. 上游连接失败（DNS/TCP/TLS）：返回 `502 Bad Gateway`。
3. 客户端主动取消：中断上游请求，避免连接泄漏。
4. 日志写入失败：仅记录内部错误，不阻断主请求链路。
5. 所有错误应关联 `requestId`，便于排障追踪。

## 9. 目录建议（v1.0）

```txt
agent-lens/
  src/
    proxy-engine/
      server.ts
      forward.ts
    provider-router/
      router.ts
      types.ts
    logger-service/
      logger.ts
      redact.ts
    config-manager/
      config.ts
      schema.ts
    utils/
      request-id.ts
      time.ts
  logs/
    requests.jsonl
  config/
    default.yaml
  .env.example
  README.md
```

## 10. 验收标准（Definition of Done）

1. JSON 请求经代理后结果与直连一致。
2. SSE 请求可持续流式输出，不出现明显额外阻塞。
3. 官方与中转上游可通过配置切换，且无需改代码。
4. 日志同时包含 `raw` 与 `json`（解析失败含 `parseError`）。
5. 敏感字段已按策略脱敏。
6. 异常场景（超时、断网、断连）有可预期返回和可追踪日志。

## 11. Roadmap（后续版本建议）

1. v1.1：响应侧日志（可选采样），增加请求/响应关联指标。
2. v1.2：本地数据库索引（SQLite）与检索 API。
3. v1.3：可视化回放界面，支持按会话聚合分析。
4. v1.4：插件化策略引擎（仅对日志副本处理，不侵入主链路）。

---

本文档作为 AgentLens v1.0 的实现基线。所有实现细节若与本文冲突，以“透明转发 + SSE 完整 + 双轨日志 + 上游可配置”四条核心原则为最高优先级。
