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
- Creating recurring loop tasks (interval, timeout, working directory or file path)
- Runner presets: `Codex` (default) / `Claude Code` / `Custom`
- Run now, enable/disable, delete
- Test-run before saving
- Path check (directory/file); file path automatically runs from its parent directory
- Codex template library (one-click common task presets)
- Favorite paths (saved in browser local storage)
- Reuse last successful test configuration (saved in browser local storage)
- Task edit mode and clone-to-form for quick creation
- Task list search filter (by name/runner)
- Multi-task parallel execution (configurable global max concurrency with queueing)
- Single-task multi-stage workflow (one line per stage, e.g. "dev -> code review")
- Step-to-step context handoff (toggleable; passes key output from previous stage)
- Workflow shared session (enabled by default; reuses one Codex session across steps/rounds of the same task)
- Codex access mode switch (standard / Full Access)
- Per-step runner/command override (format: `step|runner|command`)
- Per-step cwd/file-path override from frontend visual editor (directory runs directly; file runs from parent directory)
- Per-step timeout and failure policy override (format: `step|runner|command|timeoutSec|continue/stop`)
- Visual workflow step editor (add/remove/reorder/enable, with two-way sync to text)
- Visual editor supports advanced-field toggle (simple/full mode)
- Built-in step template library (dev/review/summary/test) with one-click insert
- Text format with prompt append + enable flag: `step|runner|command|promptAppend|timeoutSec|continue/stop|on/off`
- Viewing recent run logs (stdout/stderr/status)

Notes:
- Tasks execute local shell commands (for example `claude -p "{prompt}"`, `codex exec "{prompt}"`)
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
