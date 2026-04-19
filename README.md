# AgentLens

> [中文文档](./README-zh.md)

AgentLens is a local AI gateway workbench for:
- transparent request routing and forwarding
- raw archive-backed request/response log inspection
- loop/workflow task execution and monitoring

It is no longer just a proxy. The current product is best understood as one local service with 4 workbench areas:
- Home: information architecture and entry page only
- Router: upstream/provider/routing configuration
- Log: archived request/response viewer
- Loop: workflow/task runtime workspace

In other words: 3 core business modules (`Router`, `Log`, `Loop`) plus 1 entry module (`Home`).

## Current Module Split

### 1. Home
- Path: `/`
- Role: explain page boundaries and send the user to the correct workspace
- Rule: no config editing, no log inspection, no task execution here

### 2. Router
- Path: `/__router`
- Code: `src/router`, `src/frontend/router`
- Role: manage listening, upstreams, provider detection, path rewrite, transparent forwarding
- Scope:
  - OpenAI / Anthropic format detection
  - header-based and path-based routing
  - provider-specific upstream URL and credentials
  - third-party relay / compatible gateway forwarding

### 3. Log
- Path: `/__log`
- Compatibility entry: `/__admin` redirects to `/__log`
- Code: `src/log`, `src/frontend/log`, part of `src/frontend/admin`
- Role: inspect archived request/response pairs for humans
- Product rules:
  - request and response stay paired one-to-one by `requestId`
  - request-side primary view focuses on archived `body.text`
  - if `body.text` is JSON or JSON-encoded text, parse recursively for display only
  - SSE responses may be aggregated for display only
  - display logic must not rewrite archived raw payloads
  - only records with archived detail should appear as viewable items

### 4. Loop
- Path: `/__loop`
- Code: `src/loop`, `src/frontend/loop`
- Role: build workflows, run tasks, manage queue, inspect live state and history
- Scope:
  - recurring tasks
  - run now / pause / resume / stop
  - queue and live-run state
  - workflow-first task organization with single-command compatibility

## Quick Start

Requires: Node.js >= 20

```bash
npm install
npm run build
npm start
```

Default address: `http://127.0.0.1:5290`

## Main Pages

- Home: `http://127.0.0.1:5290/`
- Router: `http://127.0.0.1:5290/__router`
- Log: `http://127.0.0.1:5290/__log`
- Loop: `http://127.0.0.1:5290/__loop`

## Runtime / Code Layout

- Entry: `src/index.ts`
- HTTP server and route mounting: `src/router/proxy/server.ts`
- Router backend: `src/router`
- Log archive and logger: `src/log`
- Loop scheduler/runtime: `src/loop`
- Frontend pages: `src/frontend`

## Config and Data

- Main config: `config/default.yaml`
- Loop tasks: `config/loop-tasks.json`
- Logs and archives: `logs/`

## Local Use Only

Admin/log pages are unauthenticated by default. Use in local environments only.
