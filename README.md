# AgentLens

Transparent local proxy for intercepting LLM API traffic while preserving request/response semantics and SSE streaming behavior.

## Quick Start

1. Install deps:

```bash
npm install
```

2. Edit config if needed:

```bash
cp .env.example .env
```

3. Build and run:

```bash
npm run build
npm start
```

Default listener: `http://127.0.0.1:5290`

Admin UI:

- `http://127.0.0.1:5290/__admin`
- API: `GET/PUT /__admin/api/config`
- Logs API: `GET /__admin/api/logs?limit=60`
- Logs Stream (SSE): `GET /__admin/api/logs/stream?limit=60`
- 支持按请求格式自动路由：
  - Anthropic (`anthropic-version` 或 `/v1/messages`)
  - OpenAI (`/v1/responses`、`/v1/chat/completions` 等)

## Config

Default config file: `config/default.yaml`.

Use `AGENTLENS_CONFIG` to point to another config path.

To use an Anthropic-compatible relay, set:

- `ANTHROPIC_BASE_URL`
- `API_TIMEOUT_MS` (optional)

Then call AgentLens with header:

```bash
x-target-provider: anthropic_relay
```

`anthropic_relay` uses `passthrough` auth by default (for clients that already send auth headers).

## Logging

Request and response logs are appended to one JSONL file at `./logs/requests.jsonl`.
Each request uses the same `requestId` for two records (`type=request` and `type=response`).

Includes:

- `sessionId`, `provider`, `apiFormat`, `model`, `stream`
- request side: `systemPromptPreview`, `messages`, `tools`
- response side: `responsePreview`, `usage`, `finishReason`, `statusCode`
- `parseError` when JSON parse fails
- `truncated` only when you explicitly configure a positive response capture limit

日志不会保存完整 HTTP headers（避免泄漏鉴权信息），但会保存请求/响应原文归档（`logs/requests.archive/...`）。
`logging.maxArchiveBodyBytes <= 0` 表示响应原文不截断（默认即全量）。

## Admin UI Notes

- Save in UI writes back to your config YAML and updates runtime config immediately.
- Admin endpoints are currently unauthenticated and intended for local-only usage.
