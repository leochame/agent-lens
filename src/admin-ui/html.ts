export function renderAdminHtml(view: "all" | "openai" | "anthropic" = "all"): string {
  const modeTitle = view === "openai" ? "OpenAI" : view === "anthropic" ? "Anthropic" : "All";
  const navAllClass = view === "all" ? "entry-link active" : "entry-link";
  const navOpenaiClass = view === "openai" ? "entry-link active" : "entry-link";
  const navAnthropicClass = view === "anthropic" ? "entry-link active" : "entry-link";
  // language=HTML
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentLens Admin</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #1a2538;
      --muted: #60708a;
      --line: #d7deea;
      --accent: #0f67ff;
      --accent-soft: #e8f0ff;
      --ok: #19764b;
      --warn: #b15d00;
      --error: #b1283a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font-family: "Avenir Next", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif;
      background:
        radial-gradient(1200px 700px at -10% -10%, #dbe8ff 10%, transparent 70%),
        radial-gradient(900px 500px at 110% -20%, #e8f5ff 10%, transparent 70%),
        var(--bg);
    }
    .wrap {
      max-width: 1120px;
      margin: 22px auto 40px;
      padding: 0 16px;
    }
    .status {
      position: sticky;
      top: 10px;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: 14px;
      padding: 10px 14px;
      margin-bottom: 14px;
      box-shadow: 0 10px 24px rgba(24, 40, 72, 0.08);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      font-size: 12px;
      padding: 6px 10px;
      border: 1px solid var(--line);
      color: var(--muted);
      background: #fff;
    }
    .badge.dot::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #aab7c9;
    }
    .badge.ok { color: var(--ok); border-color: #b8e5d1; background: #f3fff9; }
    .badge.ok.dot::before { background: var(--ok); }
    .badge.warn { color: var(--warn); border-color: #f1ddb7; background: #fffaf0; }
    .badge.warn.dot::before { background: var(--warn); }
    .card {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--card);
      padding: 16px;
      margin-bottom: 14px;
      box-shadow: 0 8px 28px rgba(14, 36, 74, 0.06);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      letter-spacing: 0.2px;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 19px;
    }
    p, .muted { margin: 0; color: var(--muted); font-size: 13px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .field {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    input, select {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 11px;
      padding: 9px 11px;
      font-size: 14px;
      color: var(--text);
      background: #fff;
    }
    input:focus, select:focus {
      outline: 2px solid #cfe1ff;
      border-color: var(--accent);
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .provider-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .provider-item {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: #fbfdff;
    }
    .provider-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .provider-head strong {
      font-size: 14px;
    }
    .provider-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(120px, 1fr));
      gap: 10px;
    }
    .provider-grid .wide {
      grid-column: span 2;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    button {
      border: 0;
      border-radius: 11px;
      padding: 9px 14px;
      font-size: 14px;
      cursor: pointer;
      background: var(--accent);
      color: white;
      transition: transform 0.08s ease, opacity 0.2s ease;
    }
    button:active { transform: translateY(1px); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .ghost {
      background: var(--accent-soft);
      color: #20488f;
    }
    .danger {
      background: #ffe9ee;
      color: var(--error);
    }
    #msg {
      margin-top: 8px;
      font-size: 13px;
      min-height: 18px;
    }
    .hint {
      margin-top: 8px;
      font-size: 12px;
      color: var(--muted);
    }
    .entry-nav {
      margin-top: 12px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .entry-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 96px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #c8d8f7;
      background: #f1f6ff;
      color: #20488f;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      text-decoration: none;
    }
    .entry-link.active {
      background: #0f67ff;
      border-color: #0f67ff;
      color: #fff;
    }
    .error-box {
      margin-top: 10px;
      border: 1px solid #f1c4cb;
      background: #fff5f7;
      color: var(--error);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      display: none;
      white-space: pre-wrap;
    }
    .log-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(120px, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .metric-card {
      border: 1px solid #d8e3f3;
      border-radius: 10px;
      background: linear-gradient(180deg, #ffffff, #f5f9ff);
      padding: 8px;
    }
    .metric-label {
      font-size: 11px;
      color: #5b6f8d;
    }
    .metric-value {
      margin-top: 4px;
      font-size: 17px;
      font-weight: 700;
      color: #1a355d;
      line-height: 1.2;
    }
    .log-list {
      display: grid;
      gap: 10px;
      max-height: 560px;
      overflow: auto;
      padding-right: 4px;
    }
    .log-item {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      background: #fcfdff;
      cursor: pointer;
    }
    .pair-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
    .timeline {
      margin-top: 8px;
      border: 1px solid #d6e1f1;
      border-radius: 10px;
      background: linear-gradient(180deg, #ffffff, #f6f9ff);
      padding: 8px;
    }
    .timeline-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .timeline-title {
      font-size: 12px;
      font-weight: 700;
      color: #34527a;
    }
    .chain-list {
      display: grid;
      gap: 6px;
      margin-bottom: 8px;
    }
    .chain-item {
      border: 1px dashed #c5d8ef;
      border-radius: 8px;
      background: #f8fbff;
      padding: 6px 8px;
      font-size: 12px;
      color: #23415f;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .event-list {
      display: grid;
      gap: 6px;
    }
    .timeline-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
      gap: 10px;
    }
    .timeline-lane {
      border: 1px solid #d7e2f3;
      border-radius: 8px;
      background: #fff;
      padding: 8px;
      min-width: 0;
    }
    .timeline-lane.request-lane { background: linear-gradient(180deg, #ffffff, #f5f9ff); }
    .timeline-lane.response-lane { background: linear-gradient(180deg, #ffffff, #f8fcfa); }
    .lane-title {
      font-size: 12px;
      font-weight: 700;
      color: #456286;
      margin-bottom: 6px;
    }
    .event-item {
      border-left: 3px solid #c6d5ea;
      border-radius: 8px;
      background: #fff;
      padding: 6px 8px;
    }
    .event-item.phase-req { border-left-color: #7aa8ff; }
    .event-item.phase-res { border-left-color: #67c18f; }
    .event-item.kind-system { background: #f4f1ff; border-left-color: #8b7aff; }
    .event-item.kind-tool_call { background: #eefcfb; border-left-color: #3aa7a3; }
    .event-item.kind-tool_result { background: #eefcfb; border-left-color: #3aa7a3; }
    .event-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 12px;
      color: #5f7392;
    }
    .pane {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px;
      background: #fff;
      min-width: 0;
    }
    .pane-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .log-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .mono {
      font-family: "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .kv {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .kv span {
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .bubble {
      border-left: 3px solid #cfd9eb;
      padding: 6px 8px;
      background: #f7faff;
      border-radius: 8px;
      font-size: 12px;
      margin-top: 6px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .bubble.req { border-left-color: #7aa8ff; }
    .bubble.res { border-left-color: #67c18f; }
    .bubble.system {
      border-left-color: #8b7aff;
      background: #f4f1ff;
    }
    .bubble.tool {
      border-left-color: #3aa7a3;
      background: #eefcfb;
    }
    .chat-item {
      margin-top: 6px;
    }
    .chat-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .chat-text.collapsed {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      overflow: hidden;
    }
    .role-tag {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      background: #fff;
      color: #435a78;
      text-transform: lowercase;
    }
    .role-tag.role-system { background: #f2eeff; border-color: #d6ccff; color: #4f3f92; }
    .role-tag.role-assistant { background: #eef5ff; border-color: #c7dbff; color: #234f91; }
    .role-tag.role-user { background: #edfdf2; border-color: #bdeacb; color: #1f6a45; }
    .role-tag.role-tool { background: #edfdfd; border-color: #bbe9e7; color: #146864; }
    .toolcall-list {
      margin-top: 8px;
      display: grid;
      gap: 6px;
    }
    .toolcall-item {
      border: 1px dashed #c6d8ef;
      background: linear-gradient(180deg, #f8fbff, #f2f8ff);
      border-radius: 9px;
      padding: 8px;
      font-size: 12px;
      color: #274161;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .toolcall-item strong { color: #19365b; }
    .archive-panel {
      margin-top: 10px;
      border: 1px solid #d8e3f2;
      border-radius: 10px;
      background: linear-gradient(180deg, #f9fbff, #f4f8ff);
      padding: 10px;
    }
    .archive-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
    .archive-col {
      min-width: 0;
      border: 1px solid #d2deef;
      border-radius: 8px;
      background: #fff;
      padding: 8px;
    }
    .archive-title {
      font-size: 12px;
      font-weight: 700;
      color: #425d83;
      margin-bottom: 6px;
    }
    .diag-list {
      margin-top: 6px;
      border: 1px dashed #d6c7a5;
      border-radius: 8px;
      background: #fffaf0;
      padding: 6px 8px;
      font-size: 12px;
      color: #744f00;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .archive-pre {
      margin: 0;
      max-height: 260px;
      overflow: auto;
      border: 1px solid #d9e4f3;
      border-radius: 8px;
      background: #0f172a;
      color: #dbeafe;
      padding: 8px;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .log-empty {
      color: var(--muted);
      font-size: 13px;
      padding: 10px 2px;
    }
    .pill-ok, .pill-err, .pill-pending {
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      border: 1px solid transparent;
    }
    .pill-ok { color: #145a39; background: #e9fbf2; border-color: #b6e9cf; }
    .pill-err { color: #8f2236; background: #ffedf1; border-color: #f2bcc8; }
    .pill-pending { color: #7c5d00; background: #fff8e7; border-color: #f0dfb0; }
    .link-btn {
      border: 1px solid var(--line);
      background: #fff;
      color: #2b4f96;
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 12px;
    }
    .modal {
      position: fixed;
      inset: 0;
      background: rgba(14, 24, 42, 0.45);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 18px;
    }
    .modal.open { display: flex; }
    .modal-card {
      width: min(980px, 100%);
      max-height: 82vh;
      overflow: auto;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: #fff;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.2);
      padding: 14px;
    }
    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .json-pre {
      margin: 0;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #0f172a;
      color: #dbeafe;
      font-size: 12px;
      line-height: 1.45;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .json-line {
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .json-toggle {
      border: 0;
      background: transparent;
      color: #93c5fd;
      padding: 0 4px 0 0;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      border-radius: 4px;
    }
    .json-toggle:hover { background: rgba(147, 197, 253, 0.15); }
    .json-key { color: #93c5fd; }
    .json-str { color: #86efac; }
    .json-num { color: #fca5a5; }
    .json-bool { color: #fcd34d; }
    .json-null { color: #c4b5fd; }
    .json-muted { color: #94a3b8; }
    .json-pre.collapsed {
      max-height: 220px;
    }
    @media (max-width: 980px) {
      .grid, .provider-grid {
        grid-template-columns: repeat(2, minmax(130px, 1fr));
      }
      .provider-grid .wide { grid-column: span 2; }
      .overview-grid { grid-template-columns: repeat(3, minmax(120px, 1fr)); }
    }
    @media (max-width: 640px) {
      .grid, .provider-grid { grid-template-columns: 1fr; }
      .provider-grid .wide { grid-column: span 1; }
      h1 { font-size: 24px; }
      .pair-grid { grid-template-columns: 1fr; }
      .archive-grid { grid-template-columns: 1fr; }
      .overview-grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      .timeline-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="status">
      <div class="actions">
        <span id="runtimeBadge" class="badge dot">运行中</span>
        <span id="dirtyBadge" class="badge dot">无改动</span>
      </div>
      <div class="actions">
        <button id="saveBtn">保存配置</button>
        <button class="ghost" id="reloadBtn">从文件重载</button>
      </div>
    </div>

    <div class="card">
      <h1>AgentLens Admin (${modeTitle})</h1>
      <p>这里配置的是“下游客户端 -> AgentLens -> 上游模型服务”的路由。点击保存后会写入本地配置文件并立即生效。</p>
      <div class="entry-nav" aria-label="页面入口">
        <a class="${navAllClass}" href="/__admin">All</a>
        <a class="${navOpenaiClass}" href="/__admin/openai">OpenAI</a>
        <a class="${navAnthropicClass}" href="/__admin/anthropic">Anthropic</a>
      </div>
    </div>

    <div class="card">
      <div class="section-title">
        <h2>全局设置</h2>
        <span class="badge">建议先设置 Default Provider</span>
      </div>
      <div class="grid">
        <label class="field">Listen Host<input id="listenHost" placeholder="127.0.0.1" /></label>
        <label class="field">Listen Port<input id="listenPort" type="number" min="1" max="65535" /></label>
        <label class="field">Default Provider<select id="defaultProvider"></select></label>
        <label class="field">Timeout (ms)<input id="timeoutMs" type="number" min="1" /></label>
        <label class="field">请求归档
          <select id="archiveRequests">
            <option value="false">关闭</option>
            <option value="true">开启</option>
          </select>
        </label>
      </div>
      <div class="grid">
        <label class="field">Route Header Key<input id="routeHeader" placeholder="x-target-provider" /></label>
        <label class="field">Auto Detect Format
          <select id="autoDetect">
            <option value="true">开启</option>
            <option value="false">关闭</option>
          </select>
        </label>
        <label class="field">Anthropic Provider<select id="anthropicProvider"></select></label>
        <label class="field">OpenAI Provider<select id="openaiProvider"></select></label>
      </div>
      <div class="hint">开启自动识别后，会根据请求路径/头自动分流到 Anthropic 或 OpenAI 对应上游。</div>
      <div class="hint">使用不同配置时：先在“上游列表”添加两个上游（各自 URL/密钥），再分别在这里选择 Anthropic Provider 与 OpenAI Provider。</div>
      <div class="hint">OpenAI Provider 会自动使用 Authorization: Bearer；Anthropic Provider 会自动使用 x-api-key。</div>
    </div>

    <div class="card">
      <div class="section-title">
        <h2>上游列表</h2>
        <button class="ghost" id="addProvider">添加上游</button>
      </div>
      <div class="provider-list" id="providersList"></div>
      <div class="hint">每个上游仅支持修改 Base URL 与密钥；密钥为空时透传下游请求头。</div>
      <div id="validationErrors" class="error-box"></div>
    </div>

    <div class="card">
      <div id="msg"></div>
    </div>

    <div class="card">
      <div class="section-title">
        <h2>${modeTitle} Request / Response Raw Logs</h2>
        <span id="logState" class="badge warn dot">连接中</span>
      </div>
      <div class="log-toolbar">
        <div class="actions">
          <button class="ghost" id="logAutoBtn">自动刷新：开</button>
          <button class="ghost" id="logRefreshBtn">立即刷新</button>
          <button class="danger" id="logCleanupFailedBtn">清理请求失败文档</button>
          <button class="danger" id="logCleanupAllBtn">清理所有文档</button>
        </div>
        <label class="field" style="min-width:140px;">
          展示条数
          <select id="logLimit">
            <option value="30">30</option>
            <option value="60" selected>60</option>
            <option value="100">100</option>
          </select>
        </label>
      </div>
      <div id="logOverview" class="overview-grid"></div>
      <div id="logList" class="log-list"></div>
    </div>
  </div>

  <div id="jsonModal" class="modal">
    <div class="modal-card">
      <div class="modal-head">
        <strong>配对日志 JSON（Agent 相关）</strong>
        <div class="actions">
          <button class="ghost" id="expandAllJsonBtn">全部展开</button>
          <button class="ghost" id="collapseAllJsonBtn">全部收起</button>
          <button class="ghost" id="toggleJsonBtn">收起</button>
          <button class="ghost" id="copyJsonBtn">复制 JSON</button>
          <button class="ghost" id="closeJsonBtn">关闭</button>
        </div>
      </div>
      <div class="muted" id="jsonMeta"></div>
      <div class="json-pre" id="jsonContent"></div>
    </div>
  </div>

  <script>
    const API_FORMAT_FILTER = "${view}";

    function withApiFormat(url) {
      if (!API_FORMAT_FILTER || API_FORMAT_FILTER === "all") return url;
      const sep = url.includes("?") ? "&" : "?";
      return url + sep + "apiFormat=" + encodeURIComponent(API_FORMAT_FILTER);
    }

    let state = null;
    let dirty = false;
    let saving = false;
    let autoRefresh = true;
    let logEventSource = null;
    let latestAllLogs = [];
    let latestVisibleLogs = [];
    let usageMetrics = null;
    let metricsFetching = false;
    let currentJsonText = "";
    let currentJsonRawText = "";
    let currentJsonValue = null;
    let currentJsonLogId = "";
    let jsonCollapsed = false;
    let cleaningLogs = false;
    const jsonNodeExpanded = new Set();
    const jsonNodeCollapsed = new Set();

    const byId = (id) => document.getElementById(id);

    function setDirty(next) {
      dirty = next;
      const badge = byId("dirtyBadge");
      if (dirty) {
        badge.textContent = "有未保存改动";
        badge.className = "badge warn dot";
      } else {
        badge.textContent = "无改动";
        badge.className = "badge ok dot";
      }
    }

    function setMessage(text, type) {
      const msg = byId("msg");
      msg.textContent = text || "";
      msg.style.color = type === "error" ? "#b1283a" : type === "ok" ? "#19764b" : "#60708a";
    }

    function setSaving(next) {
      saving = next;
      byId("saveBtn").disabled = next;
      byId("saveBtn").textContent = next ? "保存中..." : "保存配置";
    }

    function fmtTime(ts) {
      if (!ts) return "-";
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return ts;
      return d.toLocaleTimeString();
    }

    function itemLogId(it) {
      return String(it?.logId || (it?.requestId || "") + "|" + (it?.startedAt || "") + "|" + (it?.endedAt || "") + "|" + String(it?.statusCode ?? ""));
    }

    function applyLogFilters(items) {
      return Array.isArray(items) ? items : [];
    }

    function escHtml(text) {
      return esc(text);
    }

    function esc(v) {
      return String(v || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function providerCard(name, p) {
      const keyValue = typeof p.authMode === "object"
        ? (p.authMode.value || p.authMode.valueFromEnv || "")
        : "";
      return '<div class="provider-item" data-name="' + esc(name) + '">' +
        '<div class="provider-head">' +
        '<strong>' + esc(name) + '</strong>' +
        '<button class="danger" data-action="remove">删除</button>' +
        '</div>' +
        '<div class="provider-grid">' +
        '<label class="field wide">Base URL<input data-k="baseURL" value="' + esc(p.baseURL || "") + '" placeholder="https://api.example.com" /></label>' +
        '<label class="field">密钥<input data-k="apiKey" value="' + esc(keyValue) + '" placeholder="sk-..." /></label>' +
        '</div></div>';
    }

    function getProviderNamesFromDom() {
      const cards = Array.from(document.querySelectorAll(".provider-item"));
      const names = cards
        .map((card) => (card.getAttribute("data-name") || "").trim())
        .filter(Boolean);
      return Array.from(new Set(names));
    }

    function rebuildProviderSelectors() {
      const names = getProviderNamesFromDom();
      const currentDefault = byId("defaultProvider").value || state.routing.defaultProvider || "";
      const currentAnth = byId("anthropicProvider").value || state.routing.formatProviders?.anthropic || "";
      const currentOpenai = byId("openaiProvider").value || state.routing.formatProviders?.openai || "";

      byId("defaultProvider").innerHTML = names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join("");
      const options = ['<option value="">(none)</option>'].concat(
        names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>')
      ).join("");
      byId("anthropicProvider").innerHTML = options;
      byId("openaiProvider").innerHTML = options;

      const nextDefault = names.includes(currentDefault) ? currentDefault : (names[0] || "");
      byId("defaultProvider").value = nextDefault;
      byId("anthropicProvider").value = names.includes(currentAnth) ? currentAnth : "";
      byId("openaiProvider").value = names.includes(currentOpenai) ? currentOpenai : "";
    }

    function wireProviderItem(item) {
      const removeBtn = item.querySelector('button[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          const name = item.getAttribute("data-name");
          if (!confirm('确认删除上游 "' + name + '" ?')) return;
          item.remove();
          rebuildProviderSelectors();
          setDirty(true);
          setMessage("已删除一条上游配置，记得保存。", "muted");
        });
      }
    }

    function renderProviders() {
      const list = byId("providersList");
      const rows = Object.entries(state.providers || {});
      list.innerHTML = rows.map(([n, p]) => providerCard(n, p)).join("");
      list.querySelectorAll(".provider-item").forEach((item) => wireProviderItem(item));
    }

    function bindDirtyTracking() {
      document.querySelectorAll("input, select").forEach((el) => {
        el.addEventListener("input", () => setDirty(true));
        el.addEventListener("change", () => setDirty(true));
      });
    }

    function validateConfig(next) {
      const errors = [];
      if (!next.listen.host) errors.push("Listen Host 不能为空。");
      if (!Number.isInteger(next.listen.port) || next.listen.port < 1 || next.listen.port > 65535) {
        errors.push("Listen Port 必须在 1~65535。");
      }
      if (!Number.isFinite(next.requestTimeoutMs) || next.requestTimeoutMs <= 0) {
        errors.push("Timeout (ms) 必须是正整数。");
      }
      const names = Object.keys(next.providers || {});
      if (names.length === 0) errors.push("至少需要一个 Provider。");
      if (!next.providers[next.routing.defaultProvider]) errors.push("Default Provider 必须存在于 Provider 列表。");
      if (next.routing.autoDetectProviderByFormat) {
        if (!next.routing.formatProviders?.anthropic) {
          errors.push("已开启自动识别时，必须选择 Anthropic Provider。");
        }
        if (!next.routing.formatProviders?.openai) {
          errors.push("已开启自动识别时，必须选择 OpenAI Provider。");
        }
        if (next.routing.formatProviders?.anthropic && !next.providers[next.routing.formatProviders.anthropic]) {
          errors.push("Anthropic Provider 必须存在于 Provider 列表。");
        }
        if (next.routing.formatProviders?.openai && !next.providers[next.routing.formatProviders.openai]) {
          errors.push("OpenAI Provider 必须存在于 Provider 列表。");
        }
      }

      names.forEach((n) => {
        const p = next.providers[n];
        if (!n.trim()) errors.push("Provider 名称不能为空。");
        if (!/^https?:\\/\\//i.test(p.baseURL || "")) errors.push('Provider "' + n + '" 的 Base URL 必须以 http:// 或 https:// 开头。');
      });

      const box = byId("validationErrors");
      if (errors.length > 0) {
        box.style.display = "block";
        box.textContent = errors.join("\\n");
      } else {
        box.style.display = "none";
        box.textContent = "";
      }
      return errors;
    }

    function collect() {
      const next = structuredClone(state);
      next.listen.host = byId("listenHost").value.trim();
      next.listen.port = Number(byId("listenPort").value);
      next.requestTimeoutMs = Number(byId("timeoutMs").value);
      next.logging.archiveRequests = byId("archiveRequests").value === "true";
      next.routing.defaultProvider = byId("defaultProvider").value;
      next.routing.byHeader = byId("routeHeader").value.trim() || undefined;
      next.routing.autoDetectProviderByFormat = byId("autoDetect").value === "true";
      next.routing.formatProviders = {
        anthropic: byId("anthropicProvider").value || undefined,
        openai: byId("openaiProvider").value || undefined
      };

      function resolveInjectPreset(name, prev) {
        const anth = next.routing.formatProviders?.anthropic;
        const openai = next.routing.formatProviders?.openai;
        if (anth && name === anth && name !== openai) {
          return { header: "x-api-key", prefix: "" };
        }
        if (openai && name === openai && name !== anth) {
          return { header: "authorization", prefix: "Bearer " };
        }
        if (prev?.authMode && typeof prev.authMode === "object" && prev.authMode.type === "inject") {
          return {
            header: prev.authMode.header || "authorization",
            prefix: prev.authMode.valuePrefix ?? ""
          };
        }
        return { header: "authorization", prefix: "Bearer " };
      }

      const cards = Array.from(document.querySelectorAll(".provider-item"));
      const providers = {};
      for (const card of cards) {
        const get = (k) => card.querySelector('[data-k="' + k + '"]').value.trim();
        const name = (card.getAttribute("data-name") || "").trim();
        const apiKey = get("apiKey");
        const prev = (state.providers && state.providers[name]) || {};
        const injectPreset = resolveInjectPreset(name, prev);
        providers[name] = {
          ...(prev && typeof prev === "object" ? prev : {}),
          baseURL: get("baseURL"),
          authMode: apiKey
            ? {
                type: "inject",
                header: injectPreset.header,
                value: apiKey,
                valuePrefix: injectPreset.prefix || undefined
              }
            : "passthrough",
          pathRewrite: Array.isArray(prev?.pathRewrite) ? prev.pathRewrite : []
        };
      }
      next.providers = providers;
      return next;
    }

    function render() {
      byId("listenHost").value = state.listen.host || "127.0.0.1";
      byId("listenPort").value = state.listen.port || 5290;
      byId("timeoutMs").value = state.requestTimeoutMs || 120000;
      byId("archiveRequests").value = String(Boolean(state.logging?.archiveRequests));
      byId("routeHeader").value = state.routing.byHeader || "";
      byId("autoDetect").value = String(Boolean(state.routing.autoDetectProviderByFormat));
      renderProviders();
      rebuildProviderSelectors();
      bindDirtyTracking();
      setDirty(false);
      setMessage("配置已加载。", "muted");
      byId("runtimeBadge").className = "badge ok dot";
      byId("runtimeBadge").textContent = "运行中";
    }

    function statusClass(code) {
      if (typeof code !== "number") return "pill-pending";
      if (code >= 200 && code < 300) return "pill-ok";
      return "pill-err";
    }

    function renderOverview(items) {
      const arr = Array.isArray(items) ? items : [];
      const total = arr.length;
      const ok = arr.filter((x) => typeof x.statusCode === "number" && x.statusCode >= 200 && x.statusCode < 300).length;
      const err = arr.filter((x) => typeof x.statusCode === "number" && x.statusCode >= 400).length;
      const pending = arr.filter((x) => typeof x.statusCode !== "number").length;
      const durations = arr.map((x) => x.durationMs).filter((x) => typeof x === "number");
      const avgMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      const truncated = arr.filter((x) => Boolean(x.response?.truncated)).length;
      const parseErr = arr.filter((x) => x.request?.parseError || x.response?.parseError).length;
      const nowMs = Date.now();
      const oneMinuteAgo = nowMs - 60 * 1000;
      const twoMinuteAgo = nowMs - 2 * 60 * 1000;
      const classifyKind = (item) => {
        const apiFormat = String(item?.apiFormat || "").toLowerCase();
        if (apiFormat === "openai") {
          return "openai";
        }
        if (apiFormat === "anthropic") {
          return "claudecode";
        }
        const path = String(item?.path || "").toLowerCase();
        const model = String(item?.model || "").toLowerCase();
        if (path.includes("/responses") || path.includes("/chat/completions")) {
          return "openai";
        }
        if (path.includes("/messages") || model.includes("claude")) {
          return "claudecode";
        }
        return "";
      };
      const inWindow = (item, sinceMs) => {
        const ts = Date.parse(String(item?.startedAt || ""));
        return Number.isFinite(ts) && ts >= sinceMs;
      };
      const fallbackOpenai1m = arr.filter((x) => classifyKind(x) === "openai" && inWindow(x, oneMinuteAgo)).length;
      const fallbackOpenai2m = arr.filter((x) => classifyKind(x) === "openai" && inWindow(x, twoMinuteAgo)).length;
      const fallbackClaude1m = arr.filter((x) => classifyKind(x) === "claudecode" && inWindow(x, oneMinuteAgo)).length;
      const fallbackClaude2m = arr.filter((x) => classifyKind(x) === "claudecode" && inWindow(x, twoMinuteAgo)).length;
      const openai1m = typeof usageMetrics?.openai1m === "number" ? usageMetrics.openai1m : fallbackOpenai1m;
      const openai2m = typeof usageMetrics?.openai2m === "number" ? usageMetrics.openai2m : fallbackOpenai2m;
      const claude1m = typeof usageMetrics?.claudeCode1m === "number" ? usageMetrics.claudeCode1m : fallbackClaude1m;
      const claude2m = typeof usageMetrics?.claudeCode2m === "number" ? usageMetrics.claudeCode2m : fallbackClaude2m;
      const wrap = byId("logOverview");
      wrap.innerHTML = [
        ["总日志", total],
        ["成功", ok],
        ["失败", err],
        ["处理中", pending],
        ["平均耗时(ms)", avgMs],
        ["响应截断", truncated],
        ["解析错误", parseErr],
        ["OpenAI / 1分钟", openai1m],
        ["OpenAI / 2分钟", openai2m],
        ["ClaudeCode / 1分钟", claude1m],
        ["ClaudeCode / 2分钟", claude2m]
      ].map((m) =>
        '<div class="metric-card"><div class="metric-label">' + escHtml(String(m[0])) + '</div><div class="metric-value">' + escHtml(String(m[1])) + "</div></div>"
      ).join("");
    }

    function renderLogs(items) {
      const list = byId("logList");
      latestAllLogs = Array.isArray(items) ? items : [];
      const visible = applyLogFilters(latestAllLogs);
      latestVisibleLogs = visible;
      renderOverview(visible);
      if (visible.length === 0) {
        const hint = API_FORMAT_FILTER === "openai"
          ? "暂无 OpenAI 日志。触发一次 OpenAI 请求后会显示在这里。"
          : API_FORMAT_FILTER === "anthropic"
            ? "暂无 Anthropic 日志。触发一次 Anthropic 请求后会显示在这里。"
            : "暂无日志。触发一次 Claude/OpenAI 请求后会显示在这里。";
        list.innerHTML = '<div class="log-empty">' + escHtml(hint) + "</div>";
        return;
      }

      list.innerHTML = visible.map((it) => {
        const lid = itemLogId(it);
        const duration = typeof it.durationMs === "number" ? (it.durationMs + "ms") : "-";
        return '<div class="log-item">' +
          '<div class="log-head">' +
          '<div class="mono">' + escHtml(it.requestId || "-") + "</div>" +
          '<div class="actions">' +
            '<span class="' + statusClass(it.statusCode) + '">' + (it.statusCode ?? "pending") + "</span>" +
            '<button class="link-btn" data-action="view-json" data-log-id="' + escHtml(lid) + '">查看 JSON</button>' +
          '</div>' +
          "</div>" +
          '<div class="kv">' +
          '<span>time: ' + escHtml(fmtTime(it.startedAt || it.endedAt)) + "</span>" +
          '<span>provider: ' + escHtml(it.provider || "-") + "</span>" +
          '<span>model: ' + escHtml(it.model || "-") + "</span>" +
          '<span>path: ' + escHtml(it.path || "-") + "</span>" +
          '<span>duration: ' + escHtml(duration) + "</span>" +
          "</div>" +
          "</div>";
      }).join("");

      list.querySelectorAll('button[data-action="view-json"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const lid = btn.getAttribute("data-log-id");
          if (!lid) return;
          void openJsonModalByLogId(lid);
        });
      });
      list.querySelectorAll(".log-item").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target && e.target.closest && e.target.closest('[data-no-open-json="1"]')) {
            return;
          }
          const btn = card.querySelector('button[data-action="view-json"]');
          const lid = btn?.getAttribute("data-log-id");
          if (lid) {
            void openJsonModalByLogId(lid);
          }
        });
      });
    }

    function unwrapJsonString(value, maxDepth) {
      if (typeof value !== "string") return null;
      let text = value.trim();
      if (!text) return null;
      const depthLimit = Number.isFinite(maxDepth) ? Math.max(1, Number(maxDepth)) : 12;

      for (let i = 0; i < depthLimit; i += 1) {
        const looksLikeJson =
          (text.startsWith("{") && text.endsWith("}")) ||
          (text.startsWith("[") && text.endsWith("]"));
        if (looksLikeJson) {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        }

        const quoted = text.length >= 2 && text.startsWith('"') && text.endsWith('"');
        if (!quoted) {
          return null;
        }
        try {
          const unwrapped = JSON.parse(text);
          if (typeof unwrapped !== "string") {
            return null;
          }
          text = unwrapped.trim();
          if (!text) {
            return null;
          }
        } catch {
          return null;
        }
      }
      return null;
    }

    function tryParseJsonText(rawText) {
      return unwrapJsonString(rawText, 12);
    }

    function cloneJsonValue(value) {
      if (Array.isArray(value)) {
        return value.map((item) => cloneJsonValue(item));
      }
      if (value && typeof value === "object") {
        const out = {};
        Object.entries(value).forEach(([k, v]) => {
          out[k] = cloneJsonValue(v);
        });
        return out;
      }
      return value;
    }

    function deepParseJsonValue(value, maxDepth) {
      const depth = Number.isFinite(maxDepth) ? Math.max(0, Number(maxDepth)) : 6;
      if (depth <= 0) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = tryParseJsonText(value);
        if (parsed === null) {
          return value;
        }
        return deepParseJsonValue(parsed, depth - 1);
      }
      if (Array.isArray(value)) {
        return value.map((item) => deepParseJsonValue(item, depth - 1));
      }
      if (value && typeof value === "object") {
        const out = {};
        Object.entries(value).forEach(([k, v]) => {
          out[k] = deepParseJsonValue(v, depth - 1);
        });
        return out;
      }
      return value;
    }

    function parseSseTextPayload(rawText) {
      if (typeof rawText !== "string" || rawText.indexOf("data:") < 0) {
        return null;
      }
      const blocks = rawText.split(/\\r?\\n\\r?\\n/);
      const items = [];
      let eventCount = 0;
      for (const block of blocks) {
        if (!block || !block.trim()) continue;
        const lines = block.split(/\\r?\\n/);
        const dataLines = [];
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          dataLines.push(line.slice(5).trimStart());
        }
        if (!dataLines.length) continue;
        eventCount += 1;
        const payload = dataLines.join("\\n").trim();
        if (!payload) continue;
        if (payload === "[DONE]") {
          continue;
        }
        const parsed = tryParseJsonText(payload);
        items.push(parsed === null ? payload : parsed);
      }
      if (!eventCount) {
        return null;
      }
      const parsedItems = deepParseJsonValue(items, 6);
      return mergeSseItems(parsedItems);
    }

    function mergeChatCompletionsFromSse(items) {
      let text = "";
      let finishReason = null;
      const toolCallsByIndex = new Map();
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const choices = Array.isArray(item.choices) ? item.choices : [];
        if (!choices.length) continue;
        const c0 = choices[0];
        if (!c0 || typeof c0 !== "object") continue;
        if (typeof c0.finish_reason === "string" && c0.finish_reason) {
          finishReason = c0.finish_reason;
        }
        const delta = c0.delta && typeof c0.delta === "object" ? c0.delta : null;
        if (!delta) continue;
        if (typeof delta.content === "string") {
          text += delta.content;
        }
        const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
        for (const tc of toolCalls) {
          if (!tc || typeof tc !== "object") continue;
          const idx = Number(tc.index);
          const fn = tc.function && typeof tc.function === "object" ? tc.function : null;
          const curr = Number.isFinite(idx)
            ? (toolCallsByIndex.get(idx) || { index: idx, id: null, type: "function", function: { name: "", arguments: "" } })
            : { index: toolCallsByIndex.size, id: null, type: "function", function: { name: "", arguments: "" } };
          if (typeof tc.id === "string" && tc.id) curr.id = tc.id;
          if (fn && typeof fn.name === "string" && fn.name) curr.function.name = fn.name;
          if (fn && typeof fn.arguments === "string" && fn.arguments) curr.function.arguments += fn.arguments;
          if (Number.isFinite(idx)) {
            toolCallsByIndex.set(idx, curr);
          } else {
            toolCallsByIndex.set(curr.index, curr);
          }
        }
      }
      const toolCalls = Array.from(toolCallsByIndex.values()).sort((a, b) => a.index - b.index);
      if (!text && !toolCalls.length && !finishReason) {
        return null;
      }
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: text || "",
              ...(toolCalls.length ? { tool_calls: toolCalls } : {})
            },
            finish_reason: finishReason
          }
        ]
      };
    }

    function mergeAnthropicFromSse(items) {
      const blocks = [];
      const toolByIndex = new Map();
      let stopReason = null;

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = typeof item.type === "string" ? item.type : "";
        if ((type === "message_stop" || type === "message_delta") && typeof item.stop_reason === "string" && item.stop_reason) {
          stopReason = item.stop_reason;
        }
        if (type === "content_block_start" && item.content_block && typeof item.content_block === "object") {
          const idx = Number(item.index);
          const cb = item.content_block;
          if (!Number.isFinite(idx)) continue;
          if (cb.type === "text") {
            blocks[idx] = { type: "text", text: typeof cb.text === "string" ? cb.text : "" };
          } else if (cb.type === "tool_use") {
            const inputInitial = cb.input && typeof cb.input === "object" ? cb.input : {};
            blocks[idx] = {
              type: "tool_use",
              id: typeof cb.id === "string" ? cb.id : null,
              name: typeof cb.name === "string" ? cb.name : "unknown_tool",
              input: inputInitial
            };
            toolByIndex.set(idx, { partialJson: "", inputInitial });
          }
        } else if (type === "content_block_delta") {
          const idx = Number(item.index);
          if (!Number.isFinite(idx) || !item.delta || typeof item.delta !== "object") continue;
          const delta = item.delta;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            const curr = blocks[idx];
            if (curr && curr.type === "text") {
              curr.text += delta.text;
            } else {
              blocks[idx] = { type: "text", text: delta.text };
            }
          } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
            const curr = toolByIndex.get(idx) || { partialJson: "", inputInitial: {} };
            curr.partialJson += delta.partial_json;
            toolByIndex.set(idx, curr);
          }
        } else if (type === "content_block_stop") {
          const idx = Number(item.index);
          if (!Number.isFinite(idx)) continue;
          const curr = blocks[idx];
          const tool = toolByIndex.get(idx);
          if (curr && curr.type === "tool_use" && tool) {
            if (tool.partialJson) {
              try {
                curr.input = JSON.parse(tool.partialJson);
              } catch {
                curr.input = tool.partialJson;
              }
            }
          }
        }
      }

      const content = blocks.filter(Boolean);
      if (!content.length && !stopReason) {
        return null;
      }
      return {
        type: "message",
        role: "assistant",
        content,
        stop_reason: stopReason
      };
    }

    function mergeSseItems(items) {
      if (!Array.isArray(items) || !items.length) {
        return null;
      }
      if (items.length === 1) {
        return items[0] ?? null;
      }

      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        if (!item || typeof item !== "object") continue;
        if (item.response && typeof item.response === "object") {
          return item.response;
        }
      }

      const chat = mergeChatCompletionsFromSse(items);
      if (chat) return chat;

      const anthropic = mergeAnthropicFromSse(items);
      if (anthropic) return anthropic;

      return items[items.length - 1] ?? null;
    }

    function toNativeBodyView(record) {
      const body = record?.body;
      if (!body || typeof body !== "object") {
        return null;
      }
      if (body.encoding === "utf8") {
        const rawText = String(body.text || "");
        const parsedJson = tryParseJsonText(rawText);
        return parsedJson === null ? rawText : parsedJson;
      }
      if (body.encoding === "base64") {
        return String(body.base64 || "");
      }
      return null;
    }

    function toMergedSseJson(record, requestBodyView, nativeResponseBody) {
      const reqHasSseFlag =
        requestBodyView &&
        typeof requestBodyView === "object" &&
        (requestBodyView.sse === true || requestBodyView.stream === true);

      if (record && record.isSse) {
        const sse = record.sse;
        if (sse && typeof sse === "object") {
          const events = Array.isArray(sse.events) ? sse.events : [];
          const items = [];
          for (const ev of events) {
            const data = typeof ev?.data === "string" ? ev.data.trim() : "";
            if (!data) continue;
            if (data === "[DONE]") {
              continue;
            }
            const parsed = tryParseJsonText(data);
            items.push(parsed === null ? data : parsed);
          }
          const parsedItems = deepParseJsonValue(items, 6);
          return mergeSseItems(parsedItems);
        }
      }

      if (reqHasSseFlag && typeof nativeResponseBody === "string") {
        return parseSseTextPayload(nativeResponseBody);
      }
      return null;
    }

    function toRawArchiveJson(detail, fallbackRequestId) {
      const req = detail?.request || null;
      const res = detail?.response || null;
      const requestBodyView = req ? toNativeBodyView(req) : null;
      const responseBodyView = res ? toNativeBodyView(res) : null;
      const mergedSse = toMergedSseJson(res, requestBodyView, responseBodyView);
      const requestView = req ? cloneJsonValue(req) : null;
      const responseView = res ? cloneJsonValue(res) : null;

      if (requestView && requestView.body && typeof requestView.body === "object" && requestBodyView !== null) {
        if (Object.prototype.hasOwnProperty.call(requestView.body, "text")) {
          requestView.body.text = requestBodyView;
        } else {
          requestView.body = requestBodyView;
        }
      }

      if (responseView && responseView.body && typeof responseView.body === "object") {
        if (mergedSse !== null) {
          if (Object.prototype.hasOwnProperty.call(responseView.body, "text")) {
            responseView.body.text = mergedSse;
          } else {
            responseView.body = mergedSse;
          }
        } else if (responseBodyView !== null) {
          if (Object.prototype.hasOwnProperty.call(responseView.body, "text")) {
            responseView.body.text = responseBodyView;
          } else {
            responseView.body = responseBodyView;
          }
        }
      }
      if (responseView && responseView.isSse === true && Object.prototype.hasOwnProperty.call(responseView, "sse")) {
        delete responseView.sse;
      }

      return {
        requestId: req?.requestId || res?.requestId || fallbackRequestId || null,
        statusCode: typeof res?.statusCode === "number" ? res.statusCode : null,
        request: requestView,
        response: responseView
      };
    }

    function renderJsonModalPayload(payload) {
      currentJsonValue = payload;
      currentJsonRawText = JSON.stringify(payload, null, 2);
      currentJsonText = currentJsonRawText;
      byId("jsonContent").innerHTML = renderJsonTree(payload);
      bindJsonTreeEvents();
      byId("jsonMeta").textContent = "requestId: " + (payload.requestId || "-") + "  |  status: " + (payload.statusCode ?? "pending");
    }

    function isJsonNodeExpanded(path, depth) {
      if (jsonNodeExpanded.has(path)) return true;
      if (jsonNodeCollapsed.has(path)) return false;
      return depth <= 3;
    }

    function jsonIndent(depth) {
      return "padding-left:" + (depth * 16) + "px;";
    }

    function formatJsonPrimitive(value) {
      if (value === null) return '<span class="json-null">null</span>';
      const t = typeof value;
      if (t === "string") {
        return '<span class="json-str">"' + escHtml(value) + '"</span>';
      }
      if (t === "number") {
        return '<span class="json-num">' + escHtml(String(value)) + "</span>";
      }
      if (t === "boolean") {
        return '<span class="json-bool">' + escHtml(String(value)) + "</span>";
      }
      return '<span class="json-muted">' + escHtml(String(value)) + "</span>";
    }

    function renderJsonNode(key, value, path, depth, isLast, fromArray) {
      const comma = isLast ? "" : ",";
      const keyPrefix = key === null
        ? ""
        : fromArray
          ? ""
          : '<span class="json-key">"' + escHtml(String(key)) + '"</span>: ';
      const isComposite = value && typeof value === "object";
      if (!isComposite) {
        return '<div class="json-line" style="' + jsonIndent(depth) + '">' +
          keyPrefix + formatJsonPrimitive(value) + comma +
        "</div>";
      }

      const isArrayValue = Array.isArray(value);
      const open = isArrayValue ? "[" : "{";
      const close = isArrayValue ? "]" : "}";
      const entries = isArrayValue ? value.map((v, i) => [String(i), v]) : Object.entries(value);
      const expanded = isJsonNodeExpanded(path, depth);
      const toggle = '<button class="json-toggle" data-action="toggle-json-node" data-json-path="' + escHtml(path) + '" data-expanded="' + (expanded ? "1" : "0") + '">' + (expanded ? "▾" : "▸") + "</button>";

      if (!expanded) {
        const summary = isArrayValue
          ? '<span class="json-muted">/* ' + entries.length + " items */</span>"
          : '<span class="json-muted">/* ' + entries.length + " keys */</span>";
        return '<div class="json-line" style="' + jsonIndent(depth) + '">' +
          toggle + keyPrefix + open + summary + close + comma +
        "</div>";
      }

      const head = '<div class="json-line" style="' + jsonIndent(depth) + '">' + toggle + keyPrefix + open + "</div>";
      const body = entries.map((entry, idx) => {
        const childKey = entry[0];
        const childValue = entry[1];
        const childPath = isArrayValue ? (path + "[" + childKey + "]") : (path + "." + childKey);
        return renderJsonNode(isArrayValue ? null : childKey, childValue, childPath, depth + 1, idx === entries.length - 1, isArrayValue);
      }).join("");
      const tail = '<div class="json-line" style="' + jsonIndent(depth) + '">' + close + comma + "</div>";
      return head + body + tail;
    }

    function renderJsonTree(value) {
      return renderJsonNode(null, value, "$", 0, true, false);
    }

    function collectJsonCompositePaths(value, path, target, depthLimit) {
      if (!value || typeof value !== "object") {
        return;
      }
      if (target.size > 20000) {
        return;
      }
      target.add(path);
      if (depthLimit <= 0) {
        return;
      }
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          collectJsonCompositePaths(value[i], path + "[" + String(i) + "]", target, depthLimit - 1);
        }
        return;
      }
      for (const [k, v] of Object.entries(value)) {
        collectJsonCompositePaths(v, path + "." + k, target, depthLimit - 1);
      }
    }

    function rerenderJsonTree() {
      try {
        const value = currentJsonValue === null ? JSON.parse(currentJsonRawText || "{}") : currentJsonValue;
        byId("jsonContent").innerHTML = renderJsonTree(value);
        bindJsonTreeEvents();
      } catch {
        byId("jsonContent").textContent = currentJsonText;
      }
    }

    function expandAllJsonNodes() {
      try {
        const value = currentJsonValue === null ? JSON.parse(currentJsonRawText || "{}") : currentJsonValue;
        const allPaths = new Set();
        collectJsonCompositePaths(value, "$", allPaths, 80);
        jsonNodeCollapsed.clear();
        for (const p of allPaths.values()) {
          jsonNodeExpanded.add(p);
        }
        rerenderJsonTree();
      } catch {
        byId("jsonContent").textContent = currentJsonText;
      }
    }

    function collapseAllJsonNodes() {
      try {
        const value = currentJsonValue === null ? JSON.parse(currentJsonRawText || "{}") : currentJsonValue;
        const allPaths = new Set();
        collectJsonCompositePaths(value, "$", allPaths, 80);
        jsonNodeExpanded.clear();
        jsonNodeCollapsed.clear();
        for (const p of allPaths.values()) {
          if (p !== "$") {
            jsonNodeCollapsed.add(p);
          }
        }
        rerenderJsonTree();
      } catch {
        byId("jsonContent").textContent = currentJsonText;
      }
    }

    function bindJsonTreeEvents() {
      const root = byId("jsonContent");
      root.querySelectorAll('button[data-action="toggle-json-node"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const path = btn.getAttribute("data-json-path");
          const expanded = btn.getAttribute("data-expanded") === "1";
          if (!path) return;
          if (expanded) {
            jsonNodeCollapsed.add(path);
            jsonNodeExpanded.delete(path);
          } else {
            jsonNodeExpanded.add(path);
            jsonNodeCollapsed.delete(path);
          }
          rerenderJsonTree();
        });
      });
    }

    async function openJsonModalByLogId(logId) {
      const item = latestVisibleLogs.find((x) => itemLogId(x) === logId);
      if (!item) return;
      const requestId = item.requestId || "";
      if (!requestId) return;
      currentJsonLogId = logId;
      jsonNodeExpanded.clear();
      jsonNodeCollapsed.clear();
      renderJsonModalPayload({
        requestId,
        statusCode: null,
        loading: "loading archived request/response..."
      });
      setJsonCollapsed(false);
      byId("jsonModal").classList.add("open");

      try {
        const sessionParam = item.sessionId ? "&sessionId=" + encodeURIComponent(item.sessionId) : "";
        const r = await fetch(withApiFormat("/__admin/api/logs/detail?requestId=" + encodeURIComponent(requestId) + sessionParam));
        if (!r.ok) {
          renderJsonModalPayload({
            requestId,
            statusCode: null,
            error: "failed to load archived detail"
          });
          return;
        }
        const body = await r.json();
        if (currentJsonLogId !== logId) {
          return;
        }
        const detail = body.detail || null;
        if (detail && (detail.request || detail.response)) {
          renderJsonModalPayload(toRawArchiveJson(detail, requestId));
          return;
        }
        renderJsonModalPayload({
          requestId,
          statusCode: null,
          error: "archived detail not found"
        });
      } catch {
        renderJsonModalPayload({
          requestId,
          statusCode: null,
          error: "failed to load archived detail"
        });
      }
    }

    function setJsonCollapsed(next) {
      jsonCollapsed = Boolean(next);
      const content = byId("jsonContent");
      const btn = byId("toggleJsonBtn");
      if (jsonCollapsed) {
        content.classList.add("collapsed");
        btn.textContent = "展开";
      } else {
        content.classList.remove("collapsed");
        btn.textContent = "收起";
      }
    }

    function closeJsonModal() {
      currentJsonLogId = "";
      currentJsonValue = null;
      byId("jsonModal").classList.remove("open");
    }

    function setLogState(text, ok) {
      const badge = byId("logState");
      badge.textContent = text;
      badge.className = ok ? "badge ok dot" : "badge warn dot";
    }

    async function fetchLogsOnce() {
      const limit = Number(byId("logLimit").value || "60");
      const r = await fetch(withApiFormat("/__admin/api/logs?limit=" + limit));
      if (!r.ok) {
        throw new Error("load logs failed");
      }
      const data = await r.json();
      renderLogs(data.items || []);
      setLogState("已连接", true);
    }

    async function fetchUsageMetricsOnce() {
      if (metricsFetching) {
        return;
      }
      metricsFetching = true;
      try {
        const r = await fetch(withApiFormat("/__admin/api/logs/metrics"));
        if (!r.ok) {
          throw new Error("load metrics failed");
        }
        const data = await r.json();
        usageMetrics = data && data.item ? data.item : null;
      } catch {
        // keep previous metrics; overview has local fallback
      } finally {
        metricsFetching = false;
        renderOverview(latestVisibleLogs);
      }
    }

    function setCleanupButtonsDisabled(next) {
      byId("logCleanupFailedBtn").disabled = next;
      byId("logCleanupAllBtn").disabled = next;
    }

    async function cleanupLogs(scope) {
      if (cleaningLogs) return;
      const isAll = scope === "all";
      const ok = isAll
        ? confirm("确认清理全部文档吗？该操作不可恢复。")
        : confirm("确认清理请求失败的文档吗？该操作不可恢复。");
      if (!ok) return;

      cleaningLogs = true;
      setCleanupButtonsDisabled(true);
      try {
        const r = await fetch(withApiFormat("/__admin/api/logs/cleanup"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope })
        });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || "cleanup failed");
        }
        const data = await r.json();
        const label = scope === "all" ? "所有文档" : "请求失败文档";
        setMessage(
          "已清理" + label + "，删除请求 " + String(data.removedRequests || 0) + " 条，日志记录 " + String(data.removedRecords || 0) + " 条。",
          "ok"
        );
        await fetchLogsOnce();
      } catch (e) {
        setMessage("清理失败: " + e.message, "error");
      } finally {
        cleaningLogs = false;
        setCleanupButtonsDisabled(false);
      }
    }

    function connectLogStream() {
      if (!autoRefresh) {
        if (logEventSource) {
          logEventSource.close();
          logEventSource = null;
        }
        setLogState("手动刷新模式", true);
        return;
      }
      if (logEventSource) {
        logEventSource.close();
      }
      const limit = Number(byId("logLimit").value || "60");
      logEventSource = new EventSource(withApiFormat("/__admin/api/logs/stream?limit=" + limit));
      logEventSource.addEventListener("logs", (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          renderLogs(payload.items || []);
          void fetchUsageMetricsOnce();
          setLogState("实时更新中", true);
        } catch {
          setLogState("解析失败", false);
        }
      });
      logEventSource.onerror = () => {
        setLogState("重连中", false);
      };
    }

    async function load() {
      const r = await fetch("/__admin/api/config");
      if (!r.ok) throw new Error("load failed");
      state = await r.json();
      render();
    }

    async function save() {
      if (saving) return;
      const payload = collect();
      const errors = validateConfig(payload);
      if (errors.length > 0) {
        setMessage("保存失败，请先修正红框中的配置项。", "error");
        return;
      }
      setSaving(true);
      try {
        const r = await fetch("/__admin/api/config", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || "save failed");
        }
        state = await r.json();
        render();
        setMessage("保存成功，运行时配置已更新。", "ok");
      } catch (e) {
        setMessage("保存失败: " + e.message, "error");
      } finally {
        setSaving(false);
      }
    }

    byId("addProvider").addEventListener("click", () => {
      const list = byId("providersList");
      const existing = new Set(getProviderNamesFromDom());
      let idx = list.querySelectorAll(".provider-item").length + 1;
      while (existing.has("provider_" + idx)) {
        idx += 1;
      }
      list.insertAdjacentHTML("beforeend", providerCard("provider_" + idx, {
        baseURL: "https://api.example.com",
        authMode: "passthrough"
      }));
      const newItem = list.lastElementChild;
      if (newItem) {
        wireProviderItem(newItem);
      }
      rebuildProviderSelectors();
      setDirty(true);
      setMessage("已添加新上游，记得保存。", "muted");
    });

    byId("saveBtn").addEventListener("click", save);
    byId("reloadBtn").addEventListener("click", async () => {
      if (dirty && !confirm("当前有未保存改动，确认放弃并重载吗？")) return;
      await load();
    });

    byId("logAutoBtn").addEventListener("click", () => {
      autoRefresh = !autoRefresh;
      byId("logAutoBtn").textContent = autoRefresh ? "自动刷新：开" : "自动刷新：关";
      if (autoRefresh) {
        void fetchLogsOnce();
      }
      connectLogStream();
    });
    byId("logRefreshBtn").addEventListener("click", () => {
      void fetchLogsOnce();
    });
    byId("logCleanupFailedBtn").addEventListener("click", () => {
      void cleanupLogs("failed");
    });
    byId("logCleanupAllBtn").addEventListener("click", () => {
      void cleanupLogs("all");
    });
    byId("logLimit").addEventListener("change", () => {
      void fetchLogsOnce();
      if (autoRefresh) {
        connectLogStream();
      }
    });
    byId("closeJsonBtn").addEventListener("click", closeJsonModal);
    byId("jsonModal").addEventListener("click", (e) => {
      if (e.target === byId("jsonModal")) {
        closeJsonModal();
      }
    });
    byId("copyJsonBtn").addEventListener("click", async () => {
      if (!currentJsonRawText) return;
      try {
        await navigator.clipboard.writeText(currentJsonRawText);
        setMessage("JSON 已复制到剪贴板。", "ok");
      } catch {
        setMessage("复制失败，请手动复制。", "error");
      }
    });
    byId("toggleJsonBtn").addEventListener("click", () => {
      setJsonCollapsed(!jsonCollapsed);
    });
    byId("expandAllJsonBtn").addEventListener("click", () => {
      expandAllJsonNodes();
    });
    byId("collapseAllJsonBtn").addEventListener("click", () => {
      collapseAllJsonNodes();
    });

    window.addEventListener("beforeunload", (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });

    load().catch((e) => {
      byId("runtimeBadge").className = "badge warn dot";
      byId("runtimeBadge").textContent = "加载失败";
      setMessage("加载失败: " + e.message, "error");
    });
    void fetchLogsOnce();
    connectLogStream();
    void fetchUsageMetricsOnce();
    setInterval(() => {
      void fetchUsageMetricsOnce();
    }, 1000);
  </script>
</body>
</html>`;
}
