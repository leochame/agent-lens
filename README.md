# AgentLens

> [中文文档](./README-zh.md)

AgentLens is a local transparent proxy for observing and debugging AI requests.

It does three things:
- Forwards requests to your configured upstream model services (OpenAI / Anthropic / compatible gateways)
- Logs request / response (raw archives can be toggled in Admin)
- Provides a local admin page for viewing logs and editing config

## Quick Start

Requires: Node.js >= 20

```bash
npm install
npm run build
npm start
```

Default listener: `http://127.0.0.1:5290`

Point your client's Base URL to AgentLens, for example:

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:5290
```

## Admin UI (Recommended)

After starting, open: `http://127.0.0.1:5290/__admin`

Configure everything from the page:
- Add/edit Providers (`baseURL`, `hostHeader`, auth mode)
- Set the default routing Provider
- Changes take effect immediately on save

No need to manually edit config files — saving from the UI writes to local config directly.

## Scheduled Loop (New)

After startup, open: `http://127.0.0.1:5290/__loop`

This is a standalone feature and does not change existing proxy behavior. It supports:
- Creating recurring loop tasks (interval, working directory or file path)
- Runner (currently fixed to `Custom` in the frontend; you can still call local `codex` / `claude` CLIs via command)
- Run now, enable/disable, delete
- Test-run before saving
- Path check (directory/file); file path automatically runs from its parent directory
- Codex template library (one-click common task presets)
- Last successful test configuration is written to browser local storage (currently saved only, not auto-restored)
- Task edit mode and clone-to-form for quick creation
- Task list search filter (by name)
- Multi-task parallel execution (configurable global max concurrency with queueing)
- Single-task multi-stage workflow (step-by-step orchestration)
- Workflow shared session (enabled by default; reuses one Codex session across steps/rounds of the same task)
- Codex access mode switch (standard / Full Access)
- Per-step runner/command override (via visual workflow editor)
- Per-step cwd/file-path override from frontend visual editor (directory runs directly; file runs from parent directory)
- Per-step failure policy override (continue/stop, via visual workflow editor)
- Visual workflow step editor (add/remove/reorder/enable)
- Visual editor supports advanced-field toggle (simple/full mode)
- Built-in step template library (dev/review/summary/test) with one-click insert
- Viewing recent run logs (stdout/stderr/status)

Notes:
- Tasks execute local shell commands (for example `claude -p "{prompt}"`, `codex exec "{prompt}"`)
- Loop tasks have no built-in timeout; they end on command failure, manual stop, or upstream/proxy errors
- Because timeout is not enforced, a single long-running/hung step can keep occupying one concurrency slot
- `workflowLoopFromStart=true` is infinite-loop semantics: after each successful round it starts the next round automatically, and will not auto-close by itself
- Full Access bypasses sandbox/approvals; enable only in trusted environments
- CLI arguments vary by local version; adjust with custom command if needed
- Task config is persisted at `config/loop-tasks.json`

## Auth Rules (inject mode)

When a Provider uses `inject`:
- If the local env var (specified by Env Key) has a value: inject it into the designated Header
- If the local env var is empty: pass through the downstream client's Header as-is

In short: **local env takes priority; falls back to passthrough**.

## Logging

- View request list and JSON details from the admin page
- `request` displays the raw `body.text` from the request
- `response` shows the merged result after display-layer substitution (original data unchanged)
- Raw request/response archives are saved to local logs only when `archiveRequests` is enabled

## Local Use Only

The admin page has no authentication by default. Use only in local environments.
