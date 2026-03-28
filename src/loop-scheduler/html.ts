export function renderLoopHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentLens Loop Scheduler</title>
  <style>
    :root {
      --bg: #f6f7fb;
      --bg-2: #eef3ff;
      --card: #ffffff;
      --text: #132136;
      --muted: #5f6f88;
      --line: #d6deed;
      --accent: #0a4eb3;
      --accent-2: #1f76ff;
      --ok: #19824a;
      --warn: #b46b00;
      --error: #b62f2f;
      --radius: 14px;
      --shadow: 0 14px 36px rgba(20, 39, 76, 0.1);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans CJK SC", sans-serif;
      background:
        radial-gradient(1000px 540px at 8% -10%, #d5e8ff 0%, transparent 68%),
        radial-gradient(900px 520px at 105% 0%, #dfe8ff 0%, transparent 72%),
        linear-gradient(180deg, var(--bg-2), var(--bg));
      color: var(--text);
      line-height: 1.45;
    }
    .wrap { max-width: 1180px; margin: 24px auto 40px; padding: 0 16px; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      margin-bottom: 14px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(2px);
      animation: fade-up 240ms ease both;
    }
    h1 { margin: 0 0 6px; font-size: 30px; letter-spacing: 0.2px; }
    h2 { font-size: 19px; letter-spacing: 0.1px; }
    .muted { color: var(--muted); font-size: 13px; }
    .hero {
      background:
        linear-gradient(140deg, rgba(18, 77, 170, 0.1), rgba(31, 118, 255, 0.05) 40%, transparent 70%),
        var(--card);
    }
    .notice {
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #f8fbff;
      padding: 8px 10px;
      transition: all 150ms ease;
    }
    .notice.ok { color: #145c39; border-color: #b5e4cb; background: #f2fff8; }
    .notice.error { color: #8f1f1f; border-color: #f1c0c0; background: #fff6f6; }
    .notice.warn { color: #8b5300; border-color: #f0d6b0; background: #fff8ee; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 11px; margin-top: 12px; }
    .field { display: grid; gap: 6px; font-size: 12px; color: var(--muted); }
    .field span { font-weight: 600; color: #4b5f7b; }
    #modePanelHost { display: contents; }
    .conditional-hidden { display: none !important; }
    .hint {
      font-size: 12px;
      color: #6f7f97;
      line-height: 1.45;
    }
    .help-panel {
      border: 1px solid #d2def1;
      background: linear-gradient(180deg, #f8fbff, #f3f8ff);
      border-radius: 12px;
      padding: 10px;
      margin-top: 10px;
    }
    .help-title {
      margin: 0;
      font-size: 14px;
      color: #24436e;
    }
    .help-desc {
      margin: 6px 0 0;
      font-size: 12px;
      color: #5f7394;
      line-height: 1.5;
    }
    .help-example {
      margin: 8px 0 0;
      font-size: 12px;
      color: #38567f;
      background: #edf4ff;
      border: 1px solid #d4e2f8;
      border-radius: 8px;
      padding: 8px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .draft-panel {
      border: 1px solid #d6e1f2;
      background: linear-gradient(180deg, #fbfdff, #f6f9ff);
      border-radius: 12px;
      padding: 10px;
      margin-top: 10px;
    }
    .draft-title {
      margin: 0;
      font-size: 14px;
      color: #25456f;
    }
    .draft-kv {
      margin: 8px 0 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(120px, 1fr));
      gap: 8px;
      font-size: 12px;
      color: #4d6182;
    }
    .draft-item {
      border: 1px solid #deE7f6;
      background: #ffffff;
      border-radius: 8px;
      padding: 7px 8px;
      min-height: 52px;
    }
    .draft-item b {
      display: block;
      font-size: 11px;
      color: #6b7f9d;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .draft-warn {
      margin: 8px 0 0;
      padding-left: 16px;
      color: #8f5b0e;
      font-size: 12px;
    }
    .draft-warn li { margin: 3px 0; }
    .compact-tools {
      border: 1px dashed #c9d7ee;
      background: #f7faff;
      border-radius: 10px;
      padding: 8px 10px;
      margin-top: 8px;
    }
    .compact-tools summary {
      cursor: pointer;
      font-size: 13px;
      color: #35557f;
      font-weight: 600;
      user-select: none;
    }
    .compact-tools[open] summary { margin-bottom: 8px; }
    input:not([type="checkbox"]), textarea, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 9px 10px;
      font-size: 14px;
      color: var(--text);
      background: #fff;
      transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
    }
    input:not([type="checkbox"]):hover, textarea:hover, select:hover { border-color: #b4c4de; }
    input:not([type="checkbox"]):focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--accent-2);
      box-shadow: 0 0 0 3px rgba(31, 118, 255, 0.14);
      background: #fcfdff;
    }
    .toggle-line {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #4e6280;
      font-size: 14px;
      cursor: pointer;
      width: fit-content;
    }
    .toggle-line input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--accent-2);
      cursor: pointer;
    }
    textarea { min-height: 90px; resize: vertical; }
    .span2 { grid-column: span 2; }
    .span4 { grid-column: span 4; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    button {
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
      background: linear-gradient(140deg, var(--accent-2), var(--accent));
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      transition: transform 100ms ease, box-shadow 120ms ease, filter 120ms ease;
    }
    button:hover { filter: brightness(1.03); box-shadow: 0 8px 18px rgba(17, 78, 172, 0.23); }
    button:active { transform: translateY(1px) scale(0.995); }
    button[disabled] {
      opacity: 0.62;
      cursor: not-allowed;
      filter: saturate(0.8);
      box-shadow: none;
    }
    button.is-busy::after {
      content: "";
      display: inline-block;
      width: 11px;
      height: 11px;
      margin-left: 8px;
      border: 2px solid rgba(255, 255, 255, 0.65);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 700ms linear infinite;
      vertical-align: -1px;
    }
    button.ghost.is-busy::after {
      border-color: rgba(36, 66, 120, 0.25);
      border-top-color: #244278;
    }
    button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(31, 118, 255, 0.24);
    }
    button.ghost {
      background: #eef3ff;
      color: #1e406f;
      border-color: #d8e4fb;
    }
    button.danger { background: #ffe8e8; color: var(--error); border-color: #f3c8c8; }
    button.warn { background: #fff1df; color: #9a5b00; border-color: #f0d6b0; }
    .ok-text { color: var(--ok); }
    .warn-text { color: var(--warn); }
    .error-text { color: var(--error); }
    .task-list, .run-list {
      display: grid;
      gap: 10px;
      max-height: 430px;
      overflow: auto;
      padding-right: 2px;
      scrollbar-width: thin;
      scrollbar-color: #b8cae8 transparent;
    }
    .task-item, .run-item {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px;
      background: linear-gradient(180deg, #fcfdff, #f8fbff);
      transition: transform 120ms ease, border-color 120ms ease;
    }
    .task-item:hover, .run-item:hover { transform: translateY(-1px); border-color: #bfd0ea; }
    .live-title {
      margin-top: 6px;
      font-size: 12px;
      color: #4e6280;
      font-weight: 600;
      letter-spacing: 0.1px;
    }
    .queue-list {
      display: grid;
      gap: 8px;
      max-height: 180px;
      overflow: auto;
      margin-top: 8px;
    }
    .queue-item {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
      background: #f8fbff;
    }
    .wf-builder {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px;
      background: linear-gradient(180deg, #f9fbff, #f6f9ff);
      overflow-x: auto;
    }
    .wf-row { display: grid; grid-template-columns: 1.2fr 0.8fr 1.3fr 1.2fr 0.6fr 0.8fr 0.5fr auto; gap: 6px; margin-top: 6px; }
    .wf-row:first-child { margin-top: 0; }
    .wf-actions { display: flex; gap: 4px; }
    .wf-mini { padding: 6px 8px; font-size: 12px; border-radius: 8px; }
    .wf-builder[data-advanced="false"] .wf-row { grid-template-columns: 1.8fr 1fr 0.5fr auto; }
    .wf-builder[data-advanced="false"] .wf-adv { display: none; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .tag { font-size: 12px; border-radius: 999px; padding: 4px 8px; border: 1px solid var(--line); color: var(--muted); }
    .ok { color: var(--ok); border-color: #b5e4cb; background: #f2fff8; }
    .error { color: var(--error); border-color: #f2b9b9; background: #fff6f6; }
    .tag.running { color: #145c39; border-color: #b5e4cb; background: #f2fff8; }
    .tag.queued { color: #8b5300; border-color: #f0d6b0; background: #fff8ee; }
    .tag.warn-risk { color: var(--warn); border-color: #f0d6b0; background: #fff8ec; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      background: #f3f7ff;
      border: 1px solid #dee7f5;
      border-radius: 8px;
      padding: 8px;
    }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      .span4 { grid-column: span 2; }
      .span2 { grid-column: span 2; }
      .wf-row { min-width: 920px; }
      .wf-builder[data-advanced="false"] .wf-row { min-width: 560px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card hero">
      <h1>Loop Scheduler</h1>
      <p class="muted">最小化首页：先填核心字段，按需展开对应高级模式。</p>
      <div id="msg" class="notice muted"></div>
    </div>

    <div class="card">
      <div class="row">
        <h2 style="margin:0;">并发执行设置</h2>
        <div class="row" style="gap:8px;">
          <label class="muted" style="display:flex; align-items:center; gap:6px;">
            最大并发
            <input id="maxConcurrentRuns" type="number" min="1" max="16" value="4" style="width:80px;" />
          </label>
          <button class="ghost" id="saveConcurrencyBtn">保存并发设置</button>
        </div>
      </div>
      <div id="runtimeStats" class="muted" style="margin-top:8px;">运行中: 0 | 排队中: 0</div>
      <div id="queueList" class="queue-list"></div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 10px;">新建任务</h2>
      <div class="grid" id="taskFormGrid">
        <label class="field"><span>任务名称</span><input id="name" data-help-key="name" placeholder="例如：每小时代码巡检" /><small class="hint">用于识别任务；建议包含目标和频率，方便后续筛选。</small></label>
        <label class="field conditional-hidden"><span>Runner</span>
          <select id="runner">
            <option value="custom" selected>custom</option>
          </select>
        </label>
        <label class="field"><span>循环间隔(秒)</span><input id="intervalSec" data-help-key="intervalSec" type="number" min="5" value="300" /><small class="hint">定时触发周期，最小 5 秒；越小执行越频繁。</small></label>
        <div class="field span2">
          <span>执行模式</span>
          <select id="advancedMode" data-help-key="advancedMode">
            <option value="command" selected>自定义命令模式（推荐）</option>
            <option value="workflow">多步骤 Workflow 模式</option>
          </select>
          <small id="advancedModeHint" class="hint">自定义命令模式：单步骤执行，默认预填 codex exec 命令模板（可编辑，含 {prompt}）。</small>
        </div>
        <div id="modePanelHost" class="span4"></div>
        <label class="field span4"><span>Prompt</span><textarea id="prompt" data-help-key="prompt" placeholder="输入循环执行的提示词"></textarea><small class="hint">任务核心指令。建议写清目标、范围、输出格式和约束（如“只改当前仓库、先审后改”）。</small></label>
      </div>
      <details id="assistPanel" class="compact-tools">
        <summary>展开字段说明与配置预览（可选）</summary>
        <div class="help-panel">
          <h3 id="helpTitle" class="help-title">字段说明：任务名称</h3>
          <p id="helpDesc" class="help-desc">用于识别任务；建议包含目标和频率，方便后续筛选与批量管理。</p>
          <pre id="helpExample" class="help-example">示例：每小时代码巡检</pre>
        </div>
        <div class="draft-panel">
          <h3 class="draft-title">配置预览（实时）</h3>
          <div id="draftSummary" class="draft-kv"></div>
          <ul id="draftWarnings" class="draft-warn"></ul>
        </div>
      </details>
      <div id="pathStatus" class="notice muted"></div>
      <div class="actions">
        <button id="createBtn">创建任务</button>
        <button class="ghost" id="testBtn">测试一次（不保存）</button>
      </div>
      <p class="muted" style="margin-top:8px;">提示：若输入文件路径，系统会自动用该文件的父目录作为 cwd，并在 prompt 追加 Focus file 提示。Workflow 仅支持可视化步骤编辑（新增/删除/排序/开关），无需编写字符串命令。新建任务默认预填 Codex CLI 命令模板，你也可以按需覆盖为其他命令。</p>
    </div>

    <div class="card">
      <div class="row">
        <h2 style="margin:0;">任务列表</h2>
        <div class="row" style="gap:8px;">
          <input id="taskSearch" placeholder="按名称搜索" style="width:220px;" />
          <button class="ghost" id="refreshBtn">刷新</button>
        </div>
      </div>
      <div id="taskList" class="task-list"></div>
    </div>

    <div class="card">
      <div class="row">
        <h2 style="margin:0 0 8px;">运行中执行过程</h2>
      </div>
      <div id="liveRunList" class="run-list"></div>
    </div>

    <div class="card">
      <div class="row">
        <h2 style="margin:0 0 8px;">最近运行记录</h2>
      </div>
      <div id="runList" class="run-list"></div>
    </div>
  </div>

  <script>
    const msgEl = document.getElementById("msg");
    const taskListEl = document.getElementById("taskList");
    const liveRunListEl = document.getElementById("liveRunList");
    const runListEl = document.getElementById("runList");
    const pathStatusEl = document.getElementById("pathStatus");
    const advancedModeEl = document.getElementById("advancedMode");
    const advancedModeHintEl = document.getElementById("advancedModeHint");
    const taskSearchEl = document.getElementById("taskSearch");
    const maxConcurrentRunsEl = document.getElementById("maxConcurrentRuns");
    const runtimeStatsEl = document.getElementById("runtimeStats");
    const queueListEl = document.getElementById("queueList");
    const modePanelHostEl = document.getElementById("modePanelHost");
    let cwdInputEl = null;
    let commandInputEl = null;
    let workflowCarryContextEl = null;
    let workflowLoopFromStartEl = null;
    let workflowSharedSessionEl = null;
    let workflowFullAccessEl = null;
    let workflowPanelHostEl = null;
    const taskFormGridEl = document.getElementById("taskFormGrid");
    const helpTitleEl = document.getElementById("helpTitle");
    const helpDescEl = document.getElementById("helpDesc");
    const helpExampleEl = document.getElementById("helpExample");
    const assistPanelEl = document.getElementById("assistPanel");
    const draftSummaryEl = document.getElementById("draftSummary");
    const draftWarningsEl = document.getElementById("draftWarnings");
    const STORAGE_LAST_SUCCESS = "agentlens.loop.lastSuccess.v1";
    let editingTaskId = null;
    let editingTaskEnabled = true;
    let cachedTasks = [];
    let cachedLiveRuns = [];
    let cachedRuns = [];
    let cachedQueue = [];
    let cachedSettings = { maxConcurrentRuns: 4, runningCount: 0, queuedCount: 0 };
    let workflowBuilderRows = [];
    let workflowBuilderEl = null;
    let workflowBuilderWrapEl = null;
    let workflowBindingsReady = false;
    let workflowUiInitialized = false;
    let workflowAdvanced = false;
    let mountedMode = "";
    let taskSearchText = "";
    let stateSource = null;
    let lastStateGeneratedAtMs = 0;
    let lastStateFallbackRefreshAtMs = 0;
    const modeDraft = {
      cwd: "",
      command: 'codex exec "{prompt}"',
      workflowCarryContext: "false",
      workflowLoopFromStart: "false",
      workflowSharedSession: "true",
      workflowFullAccess: "false",
      workflowSteps: []
    };
    const MODE_HINTS = {
      command: "自定义命令模式：单步骤执行，默认预填 codex exec 命令模板（可编辑，含 {prompt}）。",
      workflow: "Workflow 模式：启用多步骤流程与可视化编排；可用任务命令作为默认，或为每个步骤单独写命令。"
    };
    const STEP_TEMPLATES = {
      dev_codex: {
        name: "开发",
        runner: "custom",
        cwd: "",
        command: "",
        promptAppend: "根据需求改动代码，优先保证可运行性和最小变更面。",
        continueOnError: false,
        enabled: true
      },
      review_codex: {
        name: "Code Review",
        runner: "custom",
        cwd: "",
        command: "",
        promptAppend: "重点检查正确性、边界条件、回归风险和缺失测试。",
        continueOnError: false,
        enabled: true
      },
      review_custom: {
        name: "Code Review",
        runner: "custom",
        cwd: "",
        command: "review-cli \\\\\\\"{prompt}\\\\\\\"",
        promptAppend: "输出问题清单和修复建议。",
        continueOnError: false,
        enabled: true
      },
      summary_codex: {
        name: "总结",
        runner: "custom",
        cwd: "",
        command: "",
        promptAppend: "总结改动内容、影响范围和验证建议。",
        continueOnError: true,
        enabled: true
      },
      test_codex: {
        name: "测试",
        runner: "custom",
        cwd: "",
        command: "",
        promptAppend: "执行并整理相关测试结果，指出失败原因。",
        continueOnError: false,
        enabled: true
      }
    };
    const FIELD_HELP = {
      name: {
        title: "字段说明：任务名称",
        desc: "用于识别任务。建议写成“目标 + 频率”，后续搜索和批量处理会更清晰。",
        example: "示例：每小时代码巡检"
      },
      intervalSec: {
        title: "字段说明：循环间隔(秒)",
        desc: "任务多久触发一次。间隔越小执行越频繁，也更占资源。",
        example: "示例：300（每 5 分钟）"
      },
      advancedMode: {
        title: "字段说明：执行模式",
        desc: "自定义命令模式用于单步骤执行；Workflow 模式用于多步骤链路。",
        example: "示例：自定义命令模式（推荐）"
      },
      cwd: {
        title: "字段说明：工作目录 / 文件路径",
        desc: "目录会作为执行 cwd；文件会自动使用父目录执行，并附加 Focus file 提示。",
        example: "示例：/path/project 或 /path/project/src/app.ts"
      },
      command: {
        title: "字段说明：自定义命令",
        desc: "任务的执行命令模板。{prompt} 占位会被当前任务提示词替换。",
        example: "示例：my-cli run \\\\\\\"{prompt}\\\\\\\""
      },
      workflow: {
        title: "字段说明：Workflow 文本",
        desc: "按行定义步骤链路，支持 runner/命令/失败策略，适合复杂自动化。",
        example: "示例：开发|custom|my-cli run \\\\\\\"{prompt}\\\\\\\"||300|stop|on"
      },
      workflowLoopFromStart: {
        title: "字段说明：Workflow 执行方式",
        desc: "单轮执行只跑一遍步骤；从头循环会在同一次运行中反复从第一步开始。",
        example: "示例：从头循环（直到失败或主动关闭）"
      },
      workflowSharedSession: {
        title: "字段说明：Workflow 会话模式",
        desc: "开启后会为当前任务复用同一个 Codex 会话（同任务多步骤/多轮继续上下文）。",
        example: "示例：开启（默认）"
      },
      workflowFullAccess: {
        title: "字段说明：Full Access 模式",
        desc: "仅对 Codex 命令生效。开启后会使用 danger-full-access 运行，权限更高也更危险。",
        example: "示例：关闭（默认）"
      },
      prompt: {
        title: "字段说明：Prompt",
        desc: "任务的核心指令。建议写清目标、边界、输出格式和约束。",
        example: "示例：只修改当前仓库；先修复再给验证建议。"
      }
    };

    function setHelpContent(key) {
      const info = FIELD_HELP[key] || FIELD_HELP.name;
      helpTitleEl.textContent = info.title;
      helpDescEl.textContent = info.desc;
      helpExampleEl.textContent = info.example;
    }

    function setHidden(el, hidden) {
      if (!el) return;
      if (hidden) {
        el.classList.add("conditional-hidden");
      } else {
        el.classList.remove("conditional-hidden");
      }
    }

    function updateModeHint() {
      const mode = String(advancedModeEl.value || "command");
      if (advancedModeHintEl) {
        advancedModeHintEl.textContent = MODE_HINTS[mode] || MODE_HINTS.command;
      }
    }

    function captureModeDraft() {
      if (cwdInputEl && cwdInputEl.isConnected) {
        modeDraft.cwd = String(cwdInputEl.value || "");
      }
      if (commandInputEl && commandInputEl.isConnected) {
        modeDraft.command = String(commandInputEl.value || "");
      }
      modeDraft.workflowCarryContext = "false";
      if (workflowLoopFromStartEl && workflowLoopFromStartEl.isConnected) {
        modeDraft.workflowLoopFromStart = String(workflowLoopFromStartEl.value || "false");
      }
      if (workflowSharedSessionEl && workflowSharedSessionEl.isConnected) {
        modeDraft.workflowSharedSession = String(workflowSharedSessionEl.value || "true");
      }
      if (workflowFullAccessEl && workflowFullAccessEl.isConnected) {
        modeDraft.workflowFullAccess = String(workflowFullAccessEl.value || "false");
      }
      if (mountedMode === "workflow") {
        modeDraft.workflowSteps = workflowBuilderRows.map(normalizeStep);
      }
    }

    function resetWorkflowMountState() {
      cwdInputEl = null;
      commandInputEl = null;
      workflowCarryContextEl = null;
      workflowLoopFromStartEl = null;
      workflowSharedSessionEl = null;
      workflowFullAccessEl = null;
      workflowBuilderEl = null;
      workflowBuilderWrapEl = null;
      workflowPanelHostEl = null;
      workflowBindingsReady = false;
      workflowUiInitialized = false;
    }

    function mountModePanel(mode) {
      if (!modePanelHostEl) return;
      if (mountedMode === mode) return;
      captureModeDraft();
      resetWorkflowMountState();
      if (mode === "workflow") {
        modePanelHostEl.innerHTML = ''
          + '<div id="cwdFieldWrap" class="field span2"><span>工作目录 / 文件路径（可选）</span><input id="cwd" data-help-key="cwd" placeholder="例如：/path/project 或 /path/project/src/app.ts" /><small class="hint">目录：直接作为执行 cwd；文件：自动使用父目录并附加 Focus file 提示。</small></div>'
          + '<label id="commandFieldWrap" class="field span2"><span>任务级命令（可选，含 {prompt} 占位）</span><input id="command" data-help-key="command" placeholder="例如：my-cli run &quot;{prompt}&quot;" /><small class="hint">步骤未填 command 时会回退到这里。</small></label>'
          + '<label id="workflowLoopField" class="field"><span>Workflow 执行方式</span><select id="workflowLoopFromStart" data-help-key="workflowLoopFromStart"><option value="false" selected>单轮执行（一次）</option><option value="true">从头循环（直到失败或主动关闭）</option></select><small class="hint">适合“持续开发 -> 复审 -> 再开发”的闭环场景。</small></label>'
          + '<label id="workflowSessionField" class="field"><span>Workflow 会话模式</span><select id="workflowSharedSession" data-help-key="workflowSharedSession"><option value="true" selected>共享会话（默认）</option><option value="false">每步新会话</option></select><small class="hint">开启后，同任务步骤会复用同一个 Codex 会话。</small></label>'
          + '<label id="workflowAccessField" class="field"><span>Codex 权限模式</span><select id="workflowFullAccess" data-help-key="workflowFullAccess"><option value="false" selected>标准（推荐）</option><option value="true">Full Access（危险）</option></select><small class="hint">仅对 Codex 命令生效。Full Access 会跳过沙箱/审批。</small></label>'
          + '<div id="workflowBuilderField" class="field span4"><span>Workflow 可视化编辑器</span><div id="workflowPanelHost" class="wf-builder"><div class="muted">切换到 Workflow 模式后按需加载编辑器。</div></div><small class="hint">推荐优先在这里维护步骤顺序、开关和错误策略。</small></div>';
        cwdInputEl = document.getElementById("cwd");
        commandInputEl = document.getElementById("command");
        workflowCarryContextEl = null;
        workflowLoopFromStartEl = document.getElementById("workflowLoopFromStart");
        workflowSharedSessionEl = document.getElementById("workflowSharedSession");
        workflowFullAccessEl = document.getElementById("workflowFullAccess");
        workflowPanelHostEl = document.getElementById("workflowPanelHost");
        if (cwdInputEl) cwdInputEl.value = modeDraft.cwd;
        if (commandInputEl) commandInputEl.value = modeDraft.command;
        modeDraft.workflowCarryContext = "false";
        if (workflowLoopFromStartEl) workflowLoopFromStartEl.value = modeDraft.workflowLoopFromStart || "false";
        if (workflowSharedSessionEl) workflowSharedSessionEl.value = modeDraft.workflowSharedSession || "true";
        if (workflowFullAccessEl) workflowFullAccessEl.value = modeDraft.workflowFullAccess || "false";
        workflowBuilderRows = Array.isArray(modeDraft.workflowSteps) ? modeDraft.workflowSteps.map(normalizeStep) : [];
      } else {
        modePanelHostEl.innerHTML = ''
          + '<div id="cwdFieldWrap" class="field span2"><span>工作目录 / 文件路径（可选）</span><input id="cwd" data-help-key="cwd" placeholder="例如：/path/project 或 /path/project/src/app.ts" /><small class="hint">目录：直接作为执行 cwd；文件：自动使用父目录并附加 Focus file 提示。</small></div>'
          + '<label id="commandFieldWrap" class="field span2"><span>自定义命令（含 {prompt} 占位）</span><input id="command" data-help-key="command" placeholder="例如：my-cli run &quot;{prompt}&quot;" /><small class="hint">其中 {prompt} 会被当前任务提示词替换。</small></label>';
        cwdInputEl = document.getElementById("cwd");
        commandInputEl = document.getElementById("command");
        workflowCarryContextEl = null;
        workflowLoopFromStartEl = null;
        workflowSharedSessionEl = null;
        workflowFullAccessEl = null;
        if (cwdInputEl) cwdInputEl.value = modeDraft.cwd;
        if (commandInputEl) commandInputEl.value = modeDraft.command;
      }
      if (cwdInputEl) {
        cwdInputEl.addEventListener("blur", function () {
          applyDynamicVisibility();
          void checkPath(false).catch(() => {});
        });
        cwdInputEl.addEventListener("input", function () {
          applyDynamicVisibility();
        });
      }
      mountedMode = mode;
    }

    function mountWorkflowUi() {
      if (!workflowPanelHostEl || workflowBuilderEl || workflowBuilderWrapEl) return;
      workflowPanelHostEl.innerHTML = ''
        + '<div class="actions" style="margin-top:0;">'
        + '<button class="ghost wf-mini" id="addStepBtn" type="button">新增步骤</button>'
        + '<select id="stepTemplateSelect" class="wf-mini" style="padding-right:24px;">'
        + '<option value="">选择步骤模板</option>'
        + '<option value="dev_codex">开发（Custom）</option>'
        + '<option value="review_codex">Code Review（基础）</option>'
        + '<option value="review_custom">Code Review（含命令模板）</option>'
        + '<option value="summary_codex">总结（Custom）</option>'
        + '<option value="test_codex">测试（Custom）</option>'
        + '</select>'
        + '<button class="ghost wf-mini" id="insertStepTemplateBtn" type="button">插入模板步骤</button>'
        + '<button class="ghost wf-mini" id="toggleWorkflowAdvancedBtn" type="button">高级字段：关</button>'
        + '</div>'
        + '<div id="workflowBuilder"></div>';
      workflowPanelHostEl.id = "workflowBuilderWrap";
      workflowBuilderWrapEl = workflowPanelHostEl;
      workflowBuilderEl = document.getElementById("workflowBuilder");
    }

    function bindWorkflowUiEvents() {
      if (workflowBindingsReady || !workflowBuilderEl) return;
      workflowBindingsReady = true;

      document.getElementById("addStepBtn").addEventListener("click", function () {
        ensureWorkflowUiLoaded();
        workflowBuilderRows.push({
          name: "新步骤",
          runner: "",
          cwd: "",
          command: "",
          promptAppend: "",
          continueOnError: false,
          enabled: true
        });
        syncTextareaFromBuilder();
      });
      document.getElementById("insertStepTemplateBtn").addEventListener("click", function () {
        ensureWorkflowUiLoaded();
        const key = String(document.getElementById("stepTemplateSelect").value || "");
        if (!key) {
          msg("请先选择一个步骤模板", true);
          return;
        }
        const step = cloneTemplateStep(key);
        if (!step) {
          msg("模板不存在，请重试", true);
          return;
        }
        workflowBuilderRows.push(step);
        syncTextareaFromBuilder();
        msg("已插入模板步骤", false);
      });
      document.getElementById("toggleWorkflowAdvancedBtn").addEventListener("click", function () {
        ensureWorkflowUiLoaded();
        workflowAdvanced = !workflowAdvanced;
        document.getElementById("toggleWorkflowAdvancedBtn").textContent = workflowAdvanced ? "高级字段：开" : "高级字段：关";
        renderWorkflowBuilder();
      });
      workflowBuilderEl.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest(".wf-row");
        if (!rowEl) return;
        const idx = Number(rowEl.getAttribute("data-idx"));
        if (!Number.isFinite(idx) || idx < 0 || idx >= workflowBuilderRows.length) return;
        const act = target.getAttribute("data-act");
        if (!act) return;
        if (act === "up" && idx > 0) {
          const prev = workflowBuilderRows[idx - 1];
          workflowBuilderRows[idx - 1] = workflowBuilderRows[idx];
          workflowBuilderRows[idx] = prev;
          syncTextareaFromBuilder();
        } else if (act === "down" && idx < workflowBuilderRows.length - 1) {
          const next = workflowBuilderRows[idx + 1];
          workflowBuilderRows[idx + 1] = workflowBuilderRows[idx];
          workflowBuilderRows[idx] = next;
          syncTextareaFromBuilder();
        } else if (act === "del") {
          workflowBuilderRows.splice(idx, 1);
          syncTextareaFromBuilder();
        }
      });
      function handleWorkflowBuilderFieldChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest(".wf-row");
        if (!rowEl) return;
        const idx = Number(rowEl.getAttribute("data-idx"));
        if (!Number.isFinite(idx) || idx < 0 || idx >= workflowBuilderRows.length) return;
        const key = target.getAttribute("data-k");
        if (!key) return;
        const row = workflowBuilderRows[idx] || {};
        if (target instanceof HTMLInputElement) {
          if (key === "enabled") {
            row.enabled = target.checked;
          } else {
            row[key] = target.value;
          }
        } else if (target instanceof HTMLSelectElement) {
          if (key === "continueOnError") {
            row.continueOnError = target.value === "true";
          } else {
            row[key] = target.value;
          }
        }
        workflowBuilderRows[idx] = row;
        syncTextareaFromBuilder(false, false);
      }
      workflowBuilderEl.addEventListener("input", handleWorkflowBuilderFieldChange);
      workflowBuilderEl.addEventListener("change", handleWorkflowBuilderFieldChange);
    }

    function ensureWorkflowUiLoaded() {
      if (workflowUiInitialized) return;
      mountWorkflowUi();
      bindWorkflowUiEvents();
      workflowUiInitialized = true;
      if (!workflowBuilderRows.length && Array.isArray(modeDraft.workflowSteps) && modeDraft.workflowSteps.length) {
        workflowBuilderRows = modeDraft.workflowSteps.map(normalizeStep);
      }
      renderWorkflowBuilder();
      const btn = document.getElementById("toggleWorkflowAdvancedBtn");
      if (btn) {
        btn.textContent = workflowAdvanced ? "高级字段：开" : "高级字段：关";
      }
    }

    function applyDynamicVisibility() {
      document.getElementById("runner").value = "custom";
      const mode = String(advancedModeEl.value || "command");
      mountModePanel(mode);
      const workflowEnabled = mode === "workflow";

      if (workflowEnabled) {
        ensureWorkflowUiLoaded();
      } else {
        setHidden(pathStatusEl, false);
      }

      updateModeHint();
    }

    function draftWarningsOf(body) {
      const warns = [];
      const duplicate = cachedTasks.find(function (item) {
        if (!item || !item.name) return false;
        if (editingTaskId && item.id === editingTaskId) return false;
        return String(item.name).trim().toLowerCase() === String(body.name || "").trim().toLowerCase();
      });
      if (duplicate) warns.push("任务名称重复：请使用唯一名称。");
      if (!body.name) warns.push("任务名称为空：后续不便于识别和检索。");
      if (!body.prompt) warns.push("Prompt 为空：任务将无法创建或测试。");
      if (!Number.isFinite(body.intervalSec) || body.intervalSec < 5) warns.push("循环间隔需 >= 5 秒。");
      const mode = String(advancedModeEl.value || "command");
      if (mode === "command" && !body.command) warns.push("命令为空：自定义命令模式下必须填写命令。");
      if (mode === "workflow") {
        const steps = Array.isArray(body.workflowSteps) ? body.workflowSteps.filter(function (x) { return x && x.enabled !== false; }) : [];
        if (steps.length === 0) {
          warns.push("Workflow 至少需要 1 个启用步骤。");
        }
        if (!body.command && steps.length > 0 && steps.some(function (x) { return !String(x.command || "").trim(); })) {
          warns.push("Workflow 中存在未填写命令的启用步骤，且任务级命令为空：执行会失败。");
        }
        if (body.workflowFullAccess) {
          warns.push("已开启 Full Access：命令将跳过沙箱/审批，风险较高，请确认运行环境安全。");
        }
      }
      const steps = Array.isArray(body.workflowSteps) ? body.workflowSteps : [];
      if (steps.length > 0 && !steps.some(function (x) { return x && x.enabled !== false; })) {
        warns.push("Workflow 中没有启用步骤。");
      }
      return warns;
    }

    function hasBlockingWarnings(warns) {
      if (!Array.isArray(warns) || warns.length === 0) return false;
      return warns.some(function (w) {
        const text = String(w || "");
        return text.includes(">= 5")
          || text.includes("名称重复")
          || text.includes("命令为空")
          || text.includes("至少需要 1 个启用步骤")
          || text.includes("未填写命令");
      });
    }

    function hasWorkflowDraftData() {
      const rows = mountedMode === "workflow"
        ? workflowBuilderRows
        : (Array.isArray(modeDraft.workflowSteps) ? modeDraft.workflowSteps : []);
      if (rows.some(function (row) { return Boolean(normalizeStep(row).name); })) return true;
      return false;
    }

    function formatNextRun(intervalSec) {
      const sec = Number(intervalSec);
      if (!Number.isFinite(sec) || sec <= 0) return "-";
      const d = new Date(Date.now() + sec * 1000);
      return d.toLocaleString();
    }

    function renderDraftSummary() {
      const body = collectFormBody(false);
      const steps = Array.isArray(body.workflowSteps) ? body.workflowSteps : [];
      const enabledSteps = steps.filter(function (x) { return x && x.enabled !== false; }).length;
      const workflowEnabled = String(advancedModeEl.value || "command") === "workflow";
      if (assistPanelEl && assistPanelEl.open) {
        const summaryHtml = [
          '<div class="draft-item"><b>任务</b>' + esc(body.name || "(未填写)") + "</div>",
          '<div class="draft-item"><b>Runner</b>' + esc(body.runner || "-") + "</div>",
          '<div class="draft-item"><b>下一次预计执行</b>' + esc(formatNextRun(body.intervalSec)) + "</div>",
          '<div class="draft-item"><b>循环间隔</b>' + esc(String(body.intervalSec) + "s") + "</div>",
          '<div class="draft-item"><b>路径</b>' + esc(body.cwd || "(默认服务目录)") + "</div>",
          '<div class="draft-item"><b>流程 / 命令模式</b>' + esc((workflowEnabled ? "多步骤" : "单步骤") + " / 自定义命令") + "</div>",
          '<div class="draft-item"><b>Workflow 启用步骤</b>' + esc(String(enabledSteps)) + "</div>",
          workflowEnabled
            ? ('<div class="draft-item"><b>会话模式</b>' + esc(body.workflowSharedSession ? "共享会话" : "每步新会话") + "</div>")
            : "",
          workflowEnabled
            ? ('<div class="draft-item"><b>Codex 权限</b>' + esc(body.workflowFullAccess ? "Full Access" : "标准") + "</div>")
            : ""
        ].join("");
        draftSummaryEl.innerHTML = summaryHtml;
      }
      const warns = draftWarningsOf(body);
      if (assistPanelEl && assistPanelEl.open) {
        draftWarningsEl.innerHTML = warns.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("");
        draftWarningsEl.style.display = warns.length ? "block" : "none";
      }
      return warns;
    }

    function msg(text, isErr) {
      msgEl.textContent = text;
      msgEl.className = isErr ? "notice error" : "notice ok";
    }

    async function withButtonBusy(button, busyText, run) {
      if (!(button instanceof HTMLButtonElement)) {
        return run();
      }
      if (button.disabled) {
        return;
      }
      const origin = button.textContent || "";
      button.disabled = true;
      button.classList.add("is-busy");
      if (busyText) {
        button.textContent = busyText;
      }
      try {
        return await run();
      } finally {
        if (!busyText || button.textContent === busyText) {
          button.textContent = origin;
        }
        button.classList.remove("is-busy");
        button.disabled = false;
      }
    }

    function resetFormToCreate() {
      editingTaskId = null;
      editingTaskEnabled = true;
      modeDraft.cwd = "";
      modeDraft.command = 'codex exec "{prompt}"';
      modeDraft.workflowCarryContext = "false";
      modeDraft.workflowLoopFromStart = "false";
      modeDraft.workflowSharedSession = "true";
      modeDraft.workflowFullAccess = "false";
      modeDraft.workflowSteps = [];
      workflowBuilderRows = [];
      workflowAdvanced = false;
      mountedMode = "";
      resetWorkflowMountState();
      if (modePanelHostEl) {
        modePanelHostEl.innerHTML = "";
      }
      advancedModeEl.value = "command";
      document.getElementById("createBtn").textContent = "创建任务";
      const btn = document.getElementById("cancelEditBtn");
      if (btn) {
        btn.remove();
      }
      applyDynamicVisibility();
      renderDraftSummary();
    }

    function friendlyError(input) {
      const text = String(input || "");
      const lower = text.toLowerCase();
      if (lower.includes("workflow must have at least one enabled step")) {
        return "Workflow 至少需要 1 个启用步骤。";
      }
      if (lower.includes("no enabled workflow steps")) {
        return "Workflow 中没有启用步骤：请至少启用一个步骤。";
      }
      if (lower.includes("command not found") || lower.includes("exit: 127")) {
        return "命令未找到：请确认命令可执行，并且 PATH 配置正确。";
      }
      let isPathValidationError = lower.includes("path not found");
      if (!isPathValidationError && lower.includes("no such file or directory")) {
        const lines = text.split(/\\r?\\n/);
        isPathValidationError = lines.some(function (line) {
          const lineLower = String(line || "").toLowerCase();
          if (!lineLower.includes("no such file or directory")) {
            return false;
          }
          return lineLower.includes("cwd")
            || lineLower.includes("workdir")
            || lineLower.includes("workflow step")
            || lineLower.includes("path-check")
            || lineLower.includes("stat(")
            || /\bstat\b/.test(lineLower);
        });
      }
      if (isPathValidationError) {
        return "路径不存在：请检查工作目录/文件路径是否正确。";
      }
      if (lower.includes("permission denied")) {
        return "权限不足：当前目录不可访问，请切换路径或调整权限。";
      }
      if (lower.includes("task timeout") || lower.includes("timed out")) {
        return "上游或中转请求超时：请检查网络、上游稳定性或重试。";
      }
      if (lower.includes("task name already exists")) {
        return "任务名称已存在：请改成唯一名称。";
      }
      return text;
    }

    function diagnoseRun(run) {
      const merged = [run.error, run.stderr, run.stdout].filter(Boolean).join("\\n");
      const result = friendlyError(merged);
      if (!result || result === merged) {
        return "";
      }
      return result;
    }

    async function api(path, init) {
      const res = await fetch(path, init);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data && data.error ? friendlyError(data.error) : "HTTP " + res.status);
      }
      return data;
    }

    function formatTime(ts) {
      if (!ts) return "-";
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
    }

    function esc(v) {
      return String(v || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function parseUiBoolean(value, fallback) {
      if (value === undefined || value === null) return fallback;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      const text = String(value).trim().toLowerCase();
      if (!text) return fallback;
      if (text === "true" || text === "1" || text === "yes" || text === "on") return true;
      if (text === "false" || text === "0" || text === "no" || text === "off") return false;
      return fallback;
    }

    function hasWorkflowDefinition(taskLike) {
      if (!taskLike || typeof taskLike !== "object") return false;
      const steps = Array.isArray(taskLike.workflowSteps) ? taskLike.workflowSteps : [];
      if (steps.length > 0) return true;
      if (Array.isArray(taskLike.workflow)) {
        return taskLike.workflow.some(function (name) { return Boolean(String(name || "").trim()); });
      }
      return false;
    }

    function normalizeStep(step) {
      return {
        name: String(step && step.name ? step.name : "").trim(),
        runner: step && step.runner ? String(step.runner).trim() : "",
        cwd: step && step.cwd ? String(step.cwd).trim() : "",
        command: step && step.command ? String(step.command).trim() : "",
        promptAppend: step && step.promptAppend ? String(step.promptAppend).trim() : "",
        continueOnError: parseUiBoolean(step && step.continueOnError, false),
        enabled: parseUiBoolean(step && step.enabled, true)
      };
    }

    function cloneTemplateStep(key) {
      const tpl = STEP_TEMPLATES[key];
      if (!tpl) return null;
      return {
        name: tpl.name,
        runner: tpl.runner,
        cwd: tpl.cwd,
        command: tpl.command,
        promptAppend: tpl.promptAppend,
        continueOnError: tpl.continueOnError,
        enabled: tpl.enabled
      };
    }

    function renderWorkflowBuilder() {
      if (!workflowBuilderEl || !workflowBuilderWrapEl) return;
      workflowBuilderWrapEl.setAttribute("data-advanced", workflowAdvanced ? "true" : "false");
      const taskRunner = String(document.getElementById("runner").value || "custom");
      if (!workflowBuilderRows.length) {
        workflowBuilderEl.innerHTML = '<div class="muted">暂无步骤，点击“新增步骤”添加。</div>';
        return;
      }
      const rowsHtml = workflowBuilderRows.map(function (row, idx) {
        const r = normalizeStep(row);
        return '<div class="wf-row" data-idx="' + idx + '">'
          + '<input data-k="name" value="' + esc(r.name) + '" placeholder="步骤名" />'
          + '<select data-k="runner">'
          + '<option value=""' + (r.runner ? "" : " selected") + '>继承任务（' + esc(taskRunner) + '）</option>'
          + '<option value="custom"' + (r.runner === "custom" ? " selected" : "") + '>custom</option>'
          + '</select>'
          + '<input class="wf-adv" data-k="cwd" value="' + esc(r.cwd || "") + '" placeholder="可选：步骤路径(目录/文件)" />'
          + '<input class="wf-adv" data-k="command" value="' + esc(r.command) + '" placeholder="可选：覆盖命令" />'
          + '<input class="wf-adv" data-k="promptAppend" value="' + esc(r.promptAppend || "") + '" placeholder="可选：附加提示" />'
          + '<select class="wf-adv" data-k="continueOnError">'
          + '<option value="false"' + (r.continueOnError ? "" : " selected") + '>stop</option>'
          + '<option value="true"' + (r.continueOnError ? " selected" : "") + '>continue</option>'
          + '</select>'
          + '<label class="muted" style="display:flex;align-items:center;gap:4px;"><input data-k="enabled" type="checkbox"' + (r.enabled ? " checked" : "") + ' />启用</label>'
          + '<div class="wf-actions">'
          + '<button type="button" class="ghost wf-mini" data-act="up">上移</button>'
          + '<button type="button" class="ghost wf-mini" data-act="down">下移</button>'
          + '<button type="button" class="danger wf-mini" data-act="del">删</button>'
          + '</div>'
          + '</div>';
      }).join("");
      workflowBuilderEl.innerHTML = rowsHtml;
    }

    function syncTextareaFromBuilder(shouldRender, pruneEmptyRows) {
      const normalizedRows = workflowBuilderRows
        .map(normalizeStep)
        .filter(function (row) {
          return pruneEmptyRows === false ? true : row.name;
        });
      workflowBuilderRows = normalizedRows;
      modeDraft.workflowSteps = normalizedRows
        .filter(function (row) { return row.name; })
        .map(function (row) {
          return {
            name: row.name,
            runner: row.runner || undefined,
            cwd: row.cwd || undefined,
            command: row.command || undefined,
            promptAppend: row.promptAppend || undefined,
            continueOnError: row.continueOnError,
            enabled: row.enabled
          };
        });
      if (shouldRender !== false) {
        renderWorkflowBuilder();
      }
    }

    function syncBuilderFromTextarea() {
      workflowBuilderRows = Array.isArray(modeDraft.workflowSteps) ? modeDraft.workflowSteps.map(normalizeStep) : [];
      renderWorkflowBuilder();
    }

    function saveLastSuccess(body) {
      localStorage.setItem(STORAGE_LAST_SUCCESS, JSON.stringify(body));
    }

    function taskRuntimeState(taskId) {
      if (cachedLiveRuns.some(function (x) { return x && x.taskId === taskId; })) {
        return "running";
      }
      if (cachedQueue.some(function (x) { return x && x.taskId === taskId; })) {
        return "queued";
      }
      return "idle";
    }

    function taskRow(item) {
      const enabledTag = item.enabled
        ? '<span class="tag ok">启用</span>'
        : '<span class="tag error">停用</span>';
      const cmd = item.command || "(未配置命令)";
      const editLabel = editingTaskId === item.id ? "编辑中" : "编辑";
      const workflowText = Array.isArray(item.workflow) && item.workflow.length
        ? item.workflow.join(" -> ")
        : "(单阶段)";
      const stepDetail = Array.isArray(item.workflowSteps) && item.workflowSteps.length
        ? item.workflowSteps.map(function (step) {
          const stepName = String(step.name || "");
          const stepRunner = step.runner ? String(step.runner) : item.runner;
          const stepCwd = step.cwd ? ",cwd=" + String(step.cwd) : "";
          const stepAppend = step.promptAppend ? ",append" : "";
          const stepErr = step.continueOnError ? ",onError=continue" : "";
          return stepName + "(" + stepRunner + stepCwd + stepAppend + stepErr + ")";
        }).join(" -> ")
        : workflowText;
      const loopText = item.workflowLoopFromStart ? "从头循环" : "单轮";
      const sessionText = item.workflowSharedSession === false ? "每步新会话" : "共享会话";
      const accessText = item.workflowFullAccess ? "Full Access" : "标准";
      const runtimeState = taskRuntimeState(item.id);
      const isRunning = runtimeState === "running";
      const isQueued = runtimeState === "queued";
      const isActive = isRunning || isQueued;
      const runtimeTag = runtimeState === "running"
        ? '<span class="tag running">运行中</span>'
        : (runtimeState === "queued" ? '<span class="tag queued">排队中</span>' : '<span class="tag">空闲</span>');
      const runLabel = isRunning
        ? "重启执行"
        : (isQueued ? "重新触发" : (item.enabled ? "立即执行" : "手动执行"));
      const runClass = isRunning || isQueued ? "warn" : "";
      const stopButton = isRunning || isQueued
        ? ('<button class="warn" data-act="stop" data-id="' + esc(item.id) + '">' + (isRunning ? "停止本轮" : "取消排队") + '</button>')
        : "";
      const toggleLabel = item.enabled
        ? ((isRunning || isQueued) ? "停用(并停止)" : "停用")
        : "启用";
      const runtimeHint = isRunning
        ? "正在运行：可重启本轮、停止本轮，编辑暂不可用。"
        : (isQueued
          ? "正在排队：可重新触发（合并请求）或取消排队。"
          : (item.enabled ? "空闲且已启用：可立即执行或编辑。" : "空闲且已停用：可手动执行，或先启用定时任务。"));
      const editDisabled = isActive ? ' disabled title="任务运行/排队中，先停止后再编辑"' : "";
      const deleteLabel = isActive ? "删除(并终止)" : "删除";
      const deleteClass = isActive ? "warn" : "danger";
      return '<div class="task-item">'
        + '<div class="row"><div class="row" style="gap:8px;"><strong>' + esc(item.name) + '</strong></div><div class="row" style="gap:6px;">'
        + enabledTag
        + runtimeTag
        + '<span class="tag">' + esc(item.runner) + '</span>'
        + '<span class="tag">' + esc(item.intervalSec) + 's</span>'
        + '<span class="tag">' + esc(sessionText) + '</span>'
        + '<span class="tag' + (item.workflowFullAccess ? ' warn-risk' : '') + '">' + esc(accessText) + '</span>'
        + '</div></div>'
        + '<div class="muted" style="margin-top:6px;">path: ' + esc(item.cwd || "(默认)")
        + ' | 执行方式: ' + esc(loopText) + ' | 会话: ' + esc(sessionText) + ' | 权限: ' + esc(accessText) + ' | 最近执行: ' + esc(formatTime(item.lastRunAt)) + '</div>'
        + '<div class="muted" style="margin-top:4px;">状态提示: ' + esc(runtimeHint) + '</div>'
        + '<pre style="margin-top:8px;">workflow: ' + esc(stepDetail) + '\\nprompt: ' + esc(item.prompt) + '\\ncommand: ' + esc(cmd) + '</pre>'
        + '<div class="actions">'
        + '<button class="' + runClass + '" data-act="run" data-id="' + esc(item.id) + '">' + runLabel + '</button>'
        + stopButton
        + '<button class="ghost" data-act="edit" data-id="' + esc(item.id) + '"' + editDisabled + '>' + editLabel + '</button>'
        + '<button class="warn" data-act="clone" data-id="' + esc(item.id) + '">复制到表单</button>'
        + '<button class="ghost" data-act="toggle" data-id="' + esc(item.id) + '">' + toggleLabel + '</button>'
        + '<button class="' + deleteClass + '" data-act="delete" data-id="' + esc(item.id) + '">' + deleteLabel + '</button>'
        + '</div></div>';
    }

    function fillFormFromTask(item) {
      document.getElementById("name").value = item.name || "";
      document.getElementById("runner").value = "custom";
      document.getElementById("prompt").value = item.prompt || "";
      document.getElementById("intervalSec").value = String(item.intervalSec || 300);
      modeDraft.cwd = item.cwd || "";
      modeDraft.command = item.command || "";
      modeDraft.workflowSteps = Array.isArray(item.workflowSteps) && item.workflowSteps.length
        ? item.workflowSteps.map(normalizeStep)
        : (Array.isArray(item.workflow) ? item.workflow.map(function (name) { return normalizeStep({ name: name }); }) : []);
      modeDraft.workflowCarryContext = "false";
      modeDraft.workflowLoopFromStart = item.workflowLoopFromStart ? "true" : "false";
      modeDraft.workflowSharedSession = item.workflowSharedSession === false ? "false" : "true";
      modeDraft.workflowFullAccess = item.workflowFullAccess ? "true" : "false";
      advancedModeEl.value = hasWorkflowDefinition(item) ? "workflow" : "command";
      applyDynamicVisibility();
      if (String(advancedModeEl.value || "command") === "workflow") {
        syncBuilderFromTextarea();
      }
      void checkPath(false).catch(() => {});
    }

    function renderRuntimeStats() {
      runtimeStatsEl.textContent = "运行中: " + cachedSettings.runningCount
        + " | 排队中: " + cachedSettings.queuedCount
        + " | 最大并发: " + cachedSettings.maxConcurrentRuns;
    }

    function renderQueueList() {
      if (!Array.isArray(cachedQueue) || cachedQueue.length === 0) {
        queueListEl.innerHTML = '<div class="muted">当前没有排队任务</div>';
        return;
      }
      queueListEl.innerHTML = cachedQueue.map(function (item, idx) {
        const waitSec = Math.max(0, Math.floor(Number(item.waitMs || 0) / 1000));
        return '<div class="queue-item">'
          + '<div class="row"><strong>#' + (idx + 1) + " " + esc(item.taskName || item.taskId || "-") + '</strong>'
          + '<span class="tag">' + esc(item.trigger || "-") + '</span></div>'
          + '<div class="muted" style="margin-top:4px;">入队: ' + esc(formatTime(item.enqueuedAt))
          + ' | 等待: ' + esc(String(waitSec)) + 's</div>'
          + '</div>';
      }).join("");
    }

    async function saveConcurrencySettings() {
      const value = Number(maxConcurrentRunsEl.value);
      try {
        const data = await api("/__loop/api/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ maxConcurrentRuns: value })
        });
        cachedSettings = data.item || cachedSettings;
        maxConcurrentRunsEl.value = String(cachedSettings.maxConcurrentRuns || 4);
        renderRuntimeStats();
        msg("并发设置已保存", false);
      } catch (error) {
        msg(error && error.message ? error.message : String(error), true);
      }
    }

    function beginEditTask(item) {
      editingTaskId = item.id;
      editingTaskEnabled = item.enabled !== false;
      fillFormFromTask(item);
      document.getElementById("createBtn").textContent = "保存修改";
      let cancelBtn = document.getElementById("cancelEditBtn");
      if (!cancelBtn) {
        cancelBtn = document.createElement("button");
        cancelBtn.id = "cancelEditBtn";
        cancelBtn.className = "ghost";
        cancelBtn.textContent = "取消编辑";
        cancelBtn.addEventListener("click", function () {
          resetFormToCreate();
          msg("已取消编辑", false);
        });
        document.getElementById("createBtn").insertAdjacentElement("afterend", cancelBtn);
      }
      msg("已进入编辑模式", false);
    }

    function liveRunRow(run) {
      const events = Array.isArray(run.events) ? run.events.slice(-10) : [];
      const eventText = events.map(function (item) {
        const level = item.level === "error" ? "ERR" : "INF";
        return "[" + formatTime(item.at) + "] " + level + " " + String(item.message || "");
      }).join("\\n");
      const outputText = [run.stdoutTail || "", run.stderrTail || ""].filter(Boolean).join("\\n----\\n").slice(-1400);
      const stepText = run.stepName
        ? ("第 " + run.round + " 轮，第 " + run.stepIndex + "/" + run.totalSteps + " 步：" + run.stepName)
        : ("第 " + run.round + " 轮，准备中");
      const heartbeatText = run.heartbeatAt ? formatTime(run.heartbeatAt) : "-";
      const silenceSec = Number.isFinite(Number(run.silenceSec)) ? Number(run.silenceSec) : 0;
      const heartbeatStale = run.heartbeatStale === true;
      const heartbeatTagClass = heartbeatStale ? "warn-risk" : "running";
      const heartbeatTagText = heartbeatStale ? ("疑似卡住(" + silenceSec + "s)") : ("心跳正常(" + silenceSec + "s)");
      let html = '<div class="run-item">'
        + '<div class="row"><strong>' + esc(run.taskName) + '</strong><div class="row" style="gap:6px;">'
        + '<span class="tag ok">running</span>'
        + '<span class="tag">' + esc(run.runner) + '</span>'
        + '<span class="tag">' + esc(run.trigger) + '</span>'
        + '<span class="tag">' + esc(run.phase || "running") + '</span>'
        + '<span class="tag ' + heartbeatTagClass + '">' + esc(heartbeatTagText) + '</span>'
        + '</div></div>'
        + '<div class="muted" style="margin-top:6px;">开始: ' + esc(formatTime(run.startedAt))
        + ' | 心跳: ' + esc(heartbeatText)
        + ' | ' + esc(stepText) + '</div>';
      if (eventText) {
        html += '<div class="live-title">最近事件</div><pre style="margin-top:6px;">' + esc(eventText) + '</pre>';
      }
      if (outputText) {
        html += '<div class="live-title">实时输出尾部</div><pre style="margin-top:6px;">' + esc(outputText) + '</pre>';
      }
      html += '</div>';
      return html;
    }

    function renderLiveRuns() {
      liveRunListEl.innerHTML = cachedLiveRuns.map(liveRunRow).join("") || '<div class="muted">当前没有运行中的任务</div>';
    }

    function applyLoopState(stateItem, generatedAt) {
      if (!stateItem || typeof stateItem !== "object") {
        return;
      }
      if (generatedAt) {
        const nextMs = Date.parse(String(generatedAt));
        if (Number.isFinite(nextMs) && nextMs < lastStateGeneratedAtMs) {
          return;
        }
        if (Number.isFinite(nextMs)) {
          lastStateGeneratedAtMs = nextMs;
        }
      }
      cachedTasks = Array.isArray(stateItem.tasks) ? stateItem.tasks : cachedTasks;
      cachedRuns = Array.isArray(stateItem.runs) ? stateItem.runs : cachedRuns;
      cachedLiveRuns = Array.isArray(stateItem.liveRuns) ? stateItem.liveRuns : cachedLiveRuns;
      cachedQueue = Array.isArray(stateItem.queue) ? stateItem.queue : cachedQueue;
      cachedSettings = stateItem.settings || cachedSettings;
      if (document.activeElement !== maxConcurrentRunsEl) {
        maxConcurrentRunsEl.value = String(cachedSettings.maxConcurrentRuns || 4);
      }
      renderRuntimeStats();
      renderQueueList();
      const filtered = cachedTasks.filter(function (item) {
        if (!taskSearchText) return true;
        const lower = taskSearchText.toLowerCase();
        return String(item.name || "").toLowerCase().includes(lower);
      });
      taskListEl.innerHTML = filtered.map(taskRow).join("") || '<div class="muted">暂无任务</div>';
      renderLiveRuns();
      runListEl.innerHTML = cachedRuns.map(runRow).join("") || '<div class="muted">暂无运行记录</div>';
    }

    async function refreshStateOnce() {
      const data = await api("/__loop/api/state?tasks=200&runs=40&liveRuns=20&queue=30");
      applyLoopState(data && data.item ? data.item : null, data && data.generatedAt ? data.generatedAt : null);
    }

    function connectStateStream() {
      if (!("EventSource" in window)) {
        return;
      }
      if (stateSource) {
        stateSource.close();
      }
      const source = new EventSource("/__loop/api/state/stream?tasks=200&runs=40&liveRuns=20&queue=30");
      stateSource = source;
      source.addEventListener("loop-state", function (event) {
        try {
          const payload = JSON.parse(event.data || "{}");
          applyLoopState(payload && payload.item ? payload.item : null, payload && payload.generatedAt ? payload.generatedAt : null);
        } catch {}
      });
      source.onerror = function () {
        const now = Date.now();
        if (now - lastStateFallbackRefreshAtMs > 2000) {
          lastStateFallbackRefreshAtMs = now;
          void refreshStateOnce().catch(function () {});
        }
        if (source.readyState === 2) {
          stateSource = null;
          setTimeout(function () {
            connectStateStream();
          }, 1200);
        }
      };
    }

    function runRow(run) {
      const cls = run.status === "success" ? "ok" : "error";
      const std = [run.stdout, run.stderr].filter(Boolean).join("\\n----\\n").slice(0, 1200);
      const diagnosis = diagnoseRun(run);
      let html = '<div class="run-item">'
        + '<div class="row"><strong>' + esc(run.taskName) + '</strong><div class="row" style="gap:6px;">'
        + '<span class="tag ' + cls + '">' + esc(run.status) + '</span>'
        + '<span class="tag">' + esc(run.runner) + '</span>'
        + '<span class="tag">' + esc(run.trigger) + '</span>'
        + '<span class="tag">' + esc(run.durationMs) + 'ms</span>'
        + '</div></div>'
        + '<div class="muted" style="margin-top:6px;">开始: ' + esc(formatTime(run.startedAt))
        + ' | 结束: ' + esc(formatTime(run.endedAt))
        + ' | exit: ' + esc(run.exitCode === null ? "-" : run.exitCode) + '</div>';
      if (diagnosis) {
        html += '<div class="muted error-text" style="margin-top:6px;">诊断: ' + esc(diagnosis) + '</div>';
      }
      if (std) {
        html += '<pre style="margin-top:8px;">' + esc(std) + '</pre>';
      }
      if (run.error) {
        html += '<pre style="margin-top:8px; color:#b62f2f;">' + esc(run.error) + '</pre>';
      }
      html += '</div>';
      return html;
    }

    function collectFormBody(syncWorkflow) {
      const mode = String(advancedModeEl.value || "command");
      if (syncWorkflow !== false && mode === "workflow") {
        ensureWorkflowUiLoaded();
        syncTextareaFromBuilder();
      }
      const workflowEnabled = mode === "workflow";
      const rawCommand = commandInputEl ? (commandInputEl.value.trim() || null) : null;
      const workflowSteps = workflowEnabled
        ? workflowBuilderRows.map(normalizeStep).filter(function (row) { return row.name; }).map(function (row) {
            return {
              name: row.name,
              runner: row.runner || undefined,
              cwd: row.cwd || undefined,
              command: row.command || undefined,
              promptAppend: row.promptAppend || undefined,
              continueOnError: row.continueOnError,
              enabled: row.enabled
            };
          })
        : [];
      return {
        name: document.getElementById("name").value.trim(),
        runner: "custom",
        prompt: document.getElementById("prompt").value.trim(),
        intervalSec: Number(document.getElementById("intervalSec").value),
        cwd: cwdInputEl ? (cwdInputEl.value.trim() || null) : null,
        command: rawCommand,
        workflow: "",
        workflowSteps: workflowSteps,
        workflowCarryContext: false,
        workflowLoopFromStart: workflowEnabled ? ((workflowLoopFromStartEl ? workflowLoopFromStartEl.value : "false") === "true") : false,
        workflowSharedSession: workflowEnabled ? ((workflowSharedSessionEl ? workflowSharedSessionEl.value : "true") !== "false") : false,
        workflowFullAccess: workflowEnabled ? ((workflowFullAccessEl ? workflowFullAccessEl.value : "false") === "true") : false,
        enabled: editingTaskId ? editingTaskEnabled : true
      };
    }

    async function checkPath(showOkMessage) {
      if (!cwdInputEl) {
        pathStatusEl.textContent = "";
        pathStatusEl.className = "notice muted";
        return null;
      }
      const value = cwdInputEl.value.trim();
      if (!value) {
        pathStatusEl.textContent = "未设置路径，将使用服务启动目录。";
        pathStatusEl.className = "notice";
        return null;
      }
      try {
        const data = await api("/__loop/api/path-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: value })
        });
        const item = data.item;
        if (item.kind === "file") {
          pathStatusEl.textContent = "路径有效（文件）。执行时 cwd 将使用父目录：" + item.runCwd;
          pathStatusEl.className = "notice warn";
        } else {
          pathStatusEl.textContent = "路径有效（目录）：" + item.runCwd;
          pathStatusEl.className = "notice ok";
        }
        if (showOkMessage) {
          msg("路径检测通过", false);
        }
        return item;
      } catch (error) {
        pathStatusEl.textContent = error && error.message ? error.message : String(error);
        pathStatusEl.className = "notice error";
        throw error;
      }
    }

    async function refresh() {
      try {
        await refreshStateOnce();
      } catch (error) {
        msg(error && error.message ? error.message : String(error), true);
      }
    }

    async function createTask() {
      const body = collectFormBody();
      const warns = renderDraftSummary();
      if (!body.name || !body.prompt || hasBlockingWarnings(warns)) {
        msg("请先修复配置预览中的警告后再创建/保存。", true);
        return;
      }
      try {
        await checkPath(false);
        if (editingTaskId) {
          await api("/__loop/api/tasks/" + encodeURIComponent(editingTaskId), {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
          });
          msg("任务更新成功", false);
          resetFormToCreate();
        } else {
          await api("/__loop/api/tasks", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
          });
          msg("任务创建成功", false);
        }
        await refresh();
      } catch (error) {
        msg(error && error.message ? error.message : String(error), true);
      }
    }

    async function testRun() {
      const body = collectFormBody();
      const warns = renderDraftSummary();
      if (!body.prompt || hasBlockingWarnings(warns)) {
        msg("请先修复配置预览中的关键警告后再测试。", true);
        return;
      }
      try {
        await checkPath(false);
        const data = await api("/__loop/api/test-run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        const run = data.item;
        const extra = run.status === "success" ? "测试成功" : "测试完成但存在错误";
        const diagnosis = diagnoseRun(run);
        if (run.status === "success") {
          saveLastSuccess(body);
        }
        msg(diagnosis ? (extra + "，" + diagnosis) : extra, run.status !== "success");
      } catch (error) {
        msg(error && error.message ? error.message : String(error), true);
      }
    }

    taskListEl.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const buttonEl = target.closest("button");
      if (!(buttonEl instanceof HTMLButtonElement)) return;
      const act = buttonEl.getAttribute("data-act");
      const id = buttonEl.getAttribute("data-id");
      if (!act || !id) return;
      const taskItem = cachedTasks.find(function (x) { return x.id === id; }) || null;
      const runtimeState = taskRuntimeState(id);
      const busyText = act === "delete"
        ? "删除中..."
        : (act === "run"
          ? (runtimeState === "running" ? "重启中..." : (runtimeState === "queued" ? "重排中..." : "执行中..."))
          : (act === "toggle"
            ? "切换中..."
            : (act === "stop" ? "关闭中..." : "")));
      await withButtonBusy(
        buttonEl,
        busyText,
        async function () {
          try {
            if (act === "run") {
              if (runtimeState === "running") {
                const ok = window.confirm("当前任务正在运行。确认停止当前执行并立即重启吗？");
                if (!ok) return;
              } else if (runtimeState === "queued") {
                const ok = window.confirm("当前任务已在队列中。确认重新触发并合并为最新一次请求吗？");
                if (!ok) return;
              }
              const data = await api("/__loop/api/tasks/" + id + "/run", { method: "POST" });
              const run = data && data.item ? data.item : null;
              const actionName = runtimeState === "running"
                ? "重启执行"
                : (runtimeState === "queued" ? "重新触发" : "执行");
              if (run && run.status === "success") {
                msg(actionName + "完成：成功", false);
              } else if (run) {
                const diagnosis = diagnoseRun(run);
                const reason = diagnosis || run.error || "执行失败";
                msg(actionName + "完成：失败，" + reason, true);
              } else {
                msg(actionName + "完成", false);
              }
            } else if (act === "edit") {
              const item = cachedTasks.find(function (x) { return x.id === id; });
              if (!item) {
                msg("任务不存在或已刷新", true);
                return;
              }
              beginEditTask(item);
              await refresh();
              return;
            } else if (act === "clone") {
              const item = cachedTasks.find(function (x) { return x.id === id; });
              if (!item) {
                msg("任务不存在或已刷新", true);
                return;
              }
              resetFormToCreate();
              fillFormFromTask({
                ...item,
                name: item.name + " (copy)"
              });
              msg("已复制到表单，可直接创建新任务", false);
              return;
            } else if (act === "toggle") {
              if (!taskItem) {
                msg("任务不存在或已刷新", true);
                return;
              }
              if (!taskItem.enabled && runtimeState === "running") {
                msg("任务正在运行，请先停止后再启用/停用。", true);
                return;
              }
              if (taskItem.enabled && (runtimeState === "running" || runtimeState === "queued")) {
                const ok = window.confirm("停用任务将先停止当前运行/排队，确认继续吗？");
                if (!ok) return;
                await api("/__loop/api/tasks/" + id + "/stop", { method: "POST" });
              }
              await api("/__loop/api/tasks/" + id + "/toggle", { method: "POST" });
              if (taskItem.enabled) {
                msg(runtimeState === "running" || runtimeState === "queued" ? "任务已停止并停用" : "任务已停用", false);
              } else {
                msg("任务已启用", false);
              }
            } else if (act === "stop") {
              const data = await api("/__loop/api/tasks/" + id + "/stop", { method: "POST" });
              const item = data && data.item ? data.item : null;
              if (item && (item.running || item.queued > 0)) {
                msg(runtimeState === "queued" ? "任务已取消排队" : "任务已停止本轮执行", false);
              } else {
                msg("任务当前未在运行或排队", false);
              }
            } else if (act === "delete") {
              const confirmText = runtimeState === "running" || runtimeState === "queued"
                ? "该任务正在运行/排队。删除将终止执行并清空排队，确认删除吗？"
                : "确认删除这个任务吗？";
              if (!window.confirm(confirmText)) {
                return;
              }
              const data = await api("/__loop/api/tasks/" + id, { method: "DELETE" });
              const item = data && data.item ? data.item : null;
              if (item && (item.running || item.queued > 0)) {
                msg("任务已删除，并终止了正在运行/排队的执行", false);
              } else {
                msg("任务已删除", false);
              }
              if (editingTaskId === id) {
                resetFormToCreate();
              }
            } else {
              msg("未知操作: " + act, true);
              return;
            }
            await refresh();
          } catch (error) {
            msg(error && error.message ? error.message : String(error), true);
          }
        }
      );
    });

    document.getElementById("createBtn").addEventListener("click", function (event) {
      const btn = event.currentTarget;
      void withButtonBusy(btn, editingTaskId ? "保存中..." : "创建中...", createTask);
    });
    document.getElementById("testBtn").addEventListener("click", function (event) {
      const btn = event.currentTarget;
      void withButtonBusy(btn, "测试中...", testRun);
    });
    document.getElementById("saveConcurrencyBtn").addEventListener("click", function (event) {
      const btn = event.currentTarget;
      void withButtonBusy(btn, "保存中...", saveConcurrencySettings);
    });
    document.getElementById("refreshBtn").addEventListener("click", function (event) {
      const btn = event.currentTarget;
      void withButtonBusy(btn, "刷新中...", refresh);
    });
    advancedModeEl.addEventListener("change", function () {
      const nextMode = String(advancedModeEl.value || "command");
      if (mountedMode === "workflow" && nextMode !== "workflow" && hasWorkflowDraftData()) {
        const ok = window.confirm("当前 Workflow 里有未提交的步骤配置，确认切换到自定义命令模式吗？");
        if (!ok) {
          advancedModeEl.value = "workflow";
          return;
        }
      }
      applyDynamicVisibility();
      if (String(advancedModeEl.value || "command") === "workflow" && workflowUiInitialized) {
        renderWorkflowBuilder();
      }
      renderDraftSummary();
    });
    taskSearchEl.addEventListener("input", function () {
      taskSearchText = String(taskSearchEl.value || "").trim();
      void refresh();
    });
    taskFormGridEl.addEventListener("focusin", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const key = target.getAttribute("data-help-key");
      if (!key) return;
      setHelpContent(key);
    });
    taskFormGridEl.addEventListener("input", function () {
      renderDraftSummary();
    });
    taskFormGridEl.addEventListener("change", function () {
      renderDraftSummary();
    });
    if (assistPanelEl) {
      assistPanelEl.addEventListener("toggle", function () {
        if (assistPanelEl.open) {
          renderDraftSummary();
        }
      });
    }

    setInterval(function () {
      void refresh();
    }, 5000);
    connectStateStream();
    if (!("EventSource" in window)) {
      setInterval(function () {
        void refreshStateOnce();
      }, 1500);
    }
    resetFormToCreate();
    applyDynamicVisibility();
    updateModeHint();
    setHelpContent("name");
    renderDraftSummary();
    void refresh();
  </script>
</body>
</html>`;
}
