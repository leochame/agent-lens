export function renderAdminHtml(): string {
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
      <h1>AgentLens Admin</h1>
      <p>这里配置的是“下游客户端 -> AgentLens -> 上游模型服务”的路由。点击保存后会写入本地配置文件并立即生效。</p>
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
    </div>

    <div class="card">
      <div class="section-title">
        <h2>上游列表</h2>
        <button class="ghost" id="addProvider">添加上游</button>
      </div>
      <div class="provider-list" id="providersList"></div>
      <div class="hint">passthrough 会透传下游鉴权头；inject 由 AgentLens 从环境变量注入鉴权。</div>
      <div id="validationErrors" class="error-box"></div>
    </div>

    <div class="card">
      <div id="msg"></div>
    </div>

    <div class="card">
      <div class="section-title">
        <h2>Request / Response Raw Logs</h2>
        <span id="logState" class="badge warn dot">连接中</span>
      </div>
      <div class="log-toolbar">
        <div class="actions">
          <button class="ghost" id="logAutoBtn">自动刷新：开</button>
          <button class="ghost" id="logRefreshBtn">立即刷新</button>
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
    let state = null;
    let dirty = false;
    let saving = false;
    let autoRefresh = true;
    let logEventSource = null;
    let latestAllLogs = [];
    let latestVisibleLogs = [];
    let currentJsonText = "";
    let currentJsonRawText = "";
    let currentJsonValue = null;
    let currentJsonLogId = "";
    let jsonCollapsed = false;
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
      const mode = typeof p.authMode === "string" ? p.authMode : (p.authMode?.type || "passthrough");
      const injectHeader = typeof p.authMode === "object" ? (p.authMode.header || "") : "";
      const injectEnv = typeof p.authMode === "object" ? (p.authMode.valueFromEnv || "") : "";
      const injectPrefix = typeof p.authMode === "object" ? (p.authMode.valuePrefix || "") : "";
      const disabled = mode !== "inject" ? "disabled" : "";
      return '<div class="provider-item" data-name="' + esc(name) + '">' +
        '<div class="provider-head">' +
        '<strong>' + esc(name) + '</strong>' +
        '<button class="danger" data-action="remove">删除</button>' +
        '</div>' +
        '<div class="provider-grid">' +
        '<label class="field">Name<input data-k="name" value="' + esc(name) + '" /></label>' +
        '<label class="field wide">Base URL<input data-k="baseURL" value="' + esc(p.baseURL || "") + '" placeholder="https://api.example.com" /></label>' +
        '<label class="field">Host Header<input data-k="hostHeader" value="' + esc(p.hostHeader || "") + '" placeholder="api.example.com" /></label>' +
        '<label class="field">Auth<select data-k="authType">' +
          '<option value="passthrough"' + (mode === "passthrough" ? " selected" : "") + '>passthrough</option>' +
          '<option value="inject"' + (mode === "inject" ? " selected" : "") + '>inject</option>' +
        '</select></label>' +
        '<label class="field">Inject Header<input data-k="injectHeader" value="' + esc(injectHeader) + '" ' + disabled + ' placeholder="authorization" /></label>' +
        '<label class="field">Env Key<input data-k="injectEnv" value="' + esc(injectEnv) + '" ' + disabled + ' placeholder="OPENAI_API_KEY" /></label>' +
        '<label class="field">Prefix<input data-k="injectPrefix" value="' + esc(injectPrefix) + '" ' + disabled + ' placeholder="Bearer " /></label>' +
        '</div></div>';
    }

    function getProviderNamesFromDom() {
      const cards = Array.from(document.querySelectorAll(".provider-item"));
      const names = cards
        .map((card) => {
          const input = card.querySelector('[data-k="name"]');
          return input ? input.value.trim() : "";
        })
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
      const authSel = item.querySelector('[data-k="authType"]');
      if (authSel) {
        authSel.addEventListener("change", (e) => {
          const inject = item.querySelectorAll('[data-k="injectHeader"], [data-k="injectEnv"], [data-k="injectPrefix"]');
          const on = e.target.value === "inject";
          inject.forEach((node) => node.disabled = !on);
          setDirty(true);
        });
      }

      const removeBtn = item.querySelector('button[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          const nameInput = item.querySelector('[data-k="name"]');
          const name = (nameInput && nameInput.value) || item.getAttribute("data-name");
          if (!confirm('确认删除上游 "' + name + '" ?')) return;
          item.remove();
          rebuildProviderSelectors();
          setDirty(true);
          setMessage("已删除一条上游配置，记得保存。", "muted");
        });
      }

      const nameInput = item.querySelector('[data-k="name"]');
      if (nameInput) {
        nameInput.addEventListener("input", () => {
          rebuildProviderSelectors();
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

      names.forEach((n) => {
        const p = next.providers[n];
        if (!n.trim()) errors.push("Provider 名称不能为空。");
        if (!/^https?:\\/\\//i.test(p.baseURL || "")) errors.push('Provider "' + n + '" 的 Base URL 必须以 http:// 或 https:// 开头。');
        if (p.authMode && typeof p.authMode === "object" && p.authMode.type === "inject") {
          if (!p.authMode.header) errors.push('Provider "' + n + '" inject 模式需要 Inject Header。');
          if (!p.authMode.valueFromEnv) errors.push('Provider "' + n + '" inject 模式需要 Env Key。');
        }
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
      next.routing.defaultProvider = byId("defaultProvider").value;
      next.routing.byHeader = byId("routeHeader").value.trim() || undefined;
      next.routing.autoDetectProviderByFormat = byId("autoDetect").value === "true";
      next.routing.formatProviders = {
        anthropic: byId("anthropicProvider").value || undefined,
        openai: byId("openaiProvider").value || undefined
      };

      const cards = Array.from(document.querySelectorAll(".provider-item"));
      const providers = {};
      for (const card of cards) {
        const get = (k) => card.querySelector('[data-k="' + k + '"]').value.trim();
        const oldName = card.getAttribute("data-name");
        const name = get("name") || oldName || "";
        const authType = get("authType");
        const prev = (oldName && state.providers && state.providers[oldName]) || (state.providers && state.providers[name]) || {};
        providers[name] = {
          ...(prev && typeof prev === "object" ? prev : {}),
          baseURL: get("baseURL"),
          hostHeader: get("hostHeader") || undefined,
          authMode: authType === "inject"
            ? {
                type: "inject",
                header: get("injectHeader"),
                valueFromEnv: get("injectEnv"),
                valuePrefix: get("injectPrefix") || undefined
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
      const wrap = byId("logOverview");
      wrap.innerHTML = [
        ["总日志", total],
        ["成功", ok],
        ["失败", err],
        ["处理中", pending],
        ["平均耗时(ms)", avgMs],
        ["响应截断", truncated],
        ["解析错误", parseErr]
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
        list.innerHTML = '<div class="log-empty">暂无日志。触发一次 Claude/OpenAI 请求后会显示在这里。</div>';
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

    function recordBodyText(record) {
      const body = record?.body;
      if (!body || typeof body !== "object") {
        return null;
      }
      if (body.encoding === "utf8") {
        return String(body.text || "");
      }
      if (body.encoding === "base64") {
        return "[binary body: base64 length=" + String((body.base64 || "").length) + ", bytes=" + String(body.byteLength || 0) + "]";
      }
      return null;
    }

    function combineJsonResponseText(rawText) {
      if (typeof rawText !== "string" || !rawText.trim()) {
        return rawText;
      }
      let body = null;
      try {
        body = JSON.parse(rawText);
      } catch {
        return rawText;
      }
      if (!body || typeof body !== "object") {
        return rawText;
      }

      const textParts = [];
      const toolCalls = [];

      // OpenAI chat.completions
      if (Array.isArray(body.choices)) {
        body.choices.forEach((choice) => {
          const msg = choice?.message;
          if (!msg || typeof msg !== "object") return;
          if (typeof msg.content === "string" && msg.content) {
            textParts.push(msg.content);
          }
          if (Array.isArray(msg.tool_calls)) {
            msg.tool_calls.forEach((tc) => {
              const fn = tc?.function && typeof tc.function === "object" ? tc.function : null;
              toolCalls.push({
                id: tc?.id || tc?.call_id || null,
                name: fn?.name || tc?.name || "unknown_tool",
                arguments: String(fn?.arguments || tc?.arguments || "")
              });
            });
          }
        });
      }

      // OpenAI responses API
      if (Array.isArray(body.output)) {
        body.output.forEach((item) => {
          if (!item || typeof item !== "object") return;
          if (typeof item.output_text === "string" && item.output_text) {
            textParts.push(item.output_text);
          }
          if (item.type === "message" && Array.isArray(item.content)) {
            item.content.forEach((part) => {
              if (part && typeof part === "object" && typeof part.text === "string" && part.text) {
                textParts.push(part.text);
              }
            });
          }
          if (item.type === "function_call" || item.type === "tool_call") {
            toolCalls.push({
              id: item.call_id || item.id || null,
              name: item.name || "unknown_tool",
              arguments: String(item.arguments || item.input || "")
            });
          }
        });
      }

      // Anthropic
      if (Array.isArray(body.content)) {
        body.content.forEach((block) => {
          if (!block || typeof block !== "object") return;
          if (block.type === "text" && typeof block.text === "string" && block.text) {
            textParts.push(block.text);
          }
          if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id || null,
              name: block.name || "unknown_tool",
              arguments: typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {})
            });
          }
        });
      }

      if (textParts.length === 0 && toolCalls.length === 0) {
        return rawText;
      }
      return JSON.stringify({
        text: textParts.join(""),
        tool_calls: toolCalls
      });
    }

    function combineSseResponseText(record) {
      const events = Array.isArray(record?.sse?.events) ? record.sse.events : [];
      const textParts = [];
      const toolCallsByKey = new Map();
      let fallbackToolSeq = 0;

      function getToolCall(key, seed) {
        const curr = toolCallsByKey.get(key) || {
          id: null,
          name: "unknown_tool",
          arguments: ""
        };
        const next = {
          id: seed?.id ?? curr.id ?? null,
          name: seed?.name || curr.name || "unknown_tool",
          arguments: curr.arguments || ""
        };
        toolCallsByKey.set(key, next);
        return next;
      }

      function stableToolKey(base) {
        if (base && typeof base === "string" && base.trim()) {
          return base;
        }
        fallbackToolSeq += 1;
        return "unknown_" + fallbackToolSeq;
      }

      for (const e of events) {
        const data = String(e?.data || "");
        if (!data || data === "[DONE]") {
          continue;
        }
        let obj = null;
        try {
          obj = JSON.parse(data);
        } catch {
          continue;
        }
        if (!obj || typeof obj !== "object") {
          continue;
        }

        // Anthropic text deltas
        if (typeof obj.delta === "string" && obj.delta) {
          textParts.push(obj.delta);
        }
        if (obj.delta && typeof obj.delta === "object" && typeof obj.delta.text === "string") {
          textParts.push(obj.delta.text);
        }
        if (obj.content_block && typeof obj.content_block === "object" && typeof obj.content_block.text === "string") {
          textParts.push(obj.content_block.text);
        }
        if (
          obj.type === "content_block_delta" &&
          obj.delta &&
          typeof obj.delta === "object" &&
          typeof obj.delta.text === "string"
        ) {
          textParts.push(obj.delta.text);
        }

        // OpenAI text + tool_calls
        if (Array.isArray(obj.choices)) {
          for (const choice of obj.choices) {
            if (!choice || typeof choice !== "object") continue;
            const delta = choice.delta && typeof choice.delta === "object" ? choice.delta : null;
            if (delta && typeof delta.content === "string") {
              textParts.push(delta.content);
            }
            const tcs = delta && Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
            for (const tc of tcs) {
              if (!tc || typeof tc !== "object") continue;
              const index = Number.isInteger(tc.index) ? tc.index : -1;
              const key = stableToolKey(index >= 0 ? ("index_" + index) : (tc.id || tc.call_id || ""));
              const fn = tc.function && typeof tc.function === "object" ? tc.function : null;
              const item = getToolCall(key, {
                id: tc.id || tc.call_id || null,
                name: fn?.name || tc.name || "unknown_tool"
              });
              const argChunk = String(fn?.arguments || tc.arguments || "");
              if (argChunk) {
                item.arguments += argChunk;
              }
              toolCallsByKey.set(key, item);
            }
          }
        }

        // Anthropic tool_use + input_json_delta
        if (obj.type === "content_block_start" && obj.content_block && typeof obj.content_block === "object") {
          const cb = obj.content_block;
          if (cb.type === "tool_use") {
            const key = stableToolKey(
              cb.id ? String(cb.id) : (Number.isInteger(obj.index) ? ("index_" + String(obj.index)) : (cb.name ? String(cb.name) : ""))
            );
            const item = getToolCall(key, { id: cb.id || null, name: cb.name || "unknown_tool" });
            if (cb.input && typeof cb.input === "object") {
              item.arguments += JSON.stringify(cb.input);
            }
            toolCallsByKey.set(key, item);
          }
        }
        if (obj.type === "content_block_delta" && obj.delta && typeof obj.delta === "object" && obj.delta.type === "input_json_delta") {
          const key = stableToolKey(Number.isInteger(obj.index) ? ("index_" + String(obj.index)) : "");
          const item = getToolCall(key, {});
          const partial = String(obj.delta.partial_json || "");
          if (partial) {
            item.arguments += partial;
          }
          toolCallsByKey.set(key, item);
        }
      }

      const toolCallParts = Array.from(toolCallsByKey.values()).map((tc) => {
        return {
          id: tc.id || null,
          name: tc.name || "unknown_tool",
          arguments: String(tc.arguments || "")
        };
      });

      return JSON.stringify({
        text: textParts.join(""),
        tool_calls: toolCallParts
      });
    }

    function toRawArchiveJson(detail, fallbackRequestId) {
      const req = detail?.request || null;
      const res = detail?.response || null;
      const responseText = (res?.isSse && res?.sse && typeof res.sse === "object")
        ? combineSseResponseText(res)
        : combineJsonResponseText(recordBodyText(res));
      return {
        requestId: req?.requestId || res?.requestId || fallbackRequestId || null,
        statusCode: typeof res?.statusCode === "number" ? res.statusCode : null,
        request: recordBodyText(req),
        response: responseText
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
      return depth <= 1;
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

    function tryParseEmbeddedJsonString(value) {
      if (typeof value !== "string") return null;
      let s = value.trim();
      if (!s) return null;

      // Support quoted JSON strings, e.g. "\"{\\\"a\\\":1}\"".
      for (let i = 0; i < 4; i += 1) {
        const looksLikeJson =
          (s.startsWith("{") && s.endsWith("}")) ||
          (s.startsWith("[") && s.endsWith("]"));
        if (looksLikeJson) {
          try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === "object") {
              return parsed;
            }
          } catch {
            return null;
          }
          return null;
        }

        const quoted = s.length >= 2 && s.startsWith('"') && s.endsWith('"');
        if (!quoted) {
          return null;
        }
        try {
          const unwrapped = JSON.parse(s);
          if (typeof unwrapped !== "string") {
            return null;
          }
          s = unwrapped.trim();
          if (!s) {
            return null;
          }
        } catch {
          return null;
        }
      }
      return null;
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
        const embedded = tryParseEmbeddedJsonString(value);
        if (embedded) {
          // Friendly display: parseable JSON string is rendered in-place.
          return renderJsonNode(key, embedded, path + ".__parsed", depth, isLast, fromArray);
        }
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
          try {
            const value = currentJsonValue === null ? JSON.parse(currentJsonRawText || "{}") : currentJsonValue;
            byId("jsonContent").innerHTML = renderJsonTree(value);
            bindJsonTreeEvents();
          } catch {
            byId("jsonContent").textContent = currentJsonText;
          }
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
        const r = await fetch("/__admin/api/logs/detail?requestId=" + encodeURIComponent(requestId) + sessionParam);
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
      const r = await fetch("/__admin/api/logs?limit=" + limit);
      if (!r.ok) {
        throw new Error("load logs failed");
      }
      const data = await r.json();
      renderLogs(data.items || []);
      setLogState("已连接", true);
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
      logEventSource = new EventSource("/__admin/api/logs/stream?limit=" + limit);
      logEventSource.addEventListener("logs", (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          renderLogs(payload.items || []);
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
        hostHeader: "",
        authMode: "passthrough"
      }));
      const newItem = list.lastElementChild;
      if (newItem) {
        wireProviderItem(newItem);
      }
      rebuildProviderSelectors();
      const newNameInput = list.lastElementChild?.querySelector('[data-k="name"]');
      if (newNameInput) {
        newNameInput.focus();
        newNameInput.select();
      }
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
  </script>
</body>
</html>`;
}
