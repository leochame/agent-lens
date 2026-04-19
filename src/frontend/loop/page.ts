import { renderHeroSection } from "../shared/components";
import { WORKBENCH_LAYOUT_STYLES, renderWorkbenchLayout } from "../shared/shell";

const LOOP_HERO_HTML = renderHeroSection({
  cardClassName: "card",
  eyebrow: "Loop",
  title: "Workflow Builder",
  description: "以 workflow 为主，单命令模式为兼容入口。先搭步骤流，再观察运行中、队列和历史。",
  pills: ["Workflow / Queue / Runs / History"],
  asideBlocks: [
    {
      title: "工作顺序",
      body: "先搭建 workflow 或兼容命令任务，再查看运行状态、排队情况和历史记录。"
    }
  ],
  asideContent: `<div id="msg" class="notice muted"></div>`
});

export function renderLoopHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentLens Loop Scheduler</title>
  <style>
    ${WORKBENCH_LAYOUT_STYLES}
    :root {
      --bg: #080808;
      --bg-2: #111111;
      --card: #171717;
      --text: #ececec;
      --muted: rgba(194, 194, 194, 0.74);
      --line: rgba(255, 255, 255, 0.11);
      --line-strong: rgba(255, 255, 255, 0.2);
      --accent: #7d7d7d;
      --accent-2: #9a9a9a;
      --ok: #d3d3d3;
      --warn: #bebebe;
      --error: #999999;
      --radius: 14px;
      --shadow: 0 20px 48px rgba(0, 0, 0, 0.28);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", "IBM Plex Sans", "PingFang SC", "Noto Sans CJK SC", sans-serif;
      background:
        radial-gradient(1000px 540px at 8% -10%, rgba(255, 255, 255, 0.08) 0%, transparent 68%),
        radial-gradient(900px 520px at 105% 0%, rgba(255, 255, 255, 0.06) 0%, transparent 72%),
        linear-gradient(180deg, var(--bg-2), var(--bg));
      color: var(--text);
      line-height: 1.45;
    }
    .page-shell { display: grid; gap: 14px; }
    .workbench-main {
      background:
        linear-gradient(180deg, rgba(16, 16, 16, 0.96), rgba(8, 8, 8, 0.98)),
        #0b0b0b;
    }
    .workbench-head {
      border: 1px solid rgba(145, 153, 143, 0.15);
      border-radius: 18px;
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(20, 25, 23, 0.96), rgba(12, 16, 15, 0.98));
      box-shadow: 0 18px 34px rgba(0, 0, 0, 0.22);
    }
    .overview-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .overview-card {
      border-color: #d9e3f4;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(243, 248, 255, 0.92));
      box-shadow: 0 12px 28px rgba(17, 35, 70, 0.06);
    }
    .section-stack { display: grid; gap: 14px; }
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      align-items: start;
    }
    .activity-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      align-items: start;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(2px);
      animation: fade-up 240ms ease both;
    }
    h1 { margin: 0 0 6px; font-size: 34px; letter-spacing: 0.2px; line-height: 1.06; }
    h2 { font-size: 19px; letter-spacing: 0.1px; }
    .muted { color: var(--muted); font-size: 13px; }
    .hero {
      padding: 22px;
      background:
        linear-gradient(140deg, rgba(255, 255, 255, 0.09), rgba(39, 39, 39, 0.12) 38%, rgba(15, 15, 15, 0.95) 78%),
        var(--card);
    }
    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.95fr);
      gap: 18px;
      align-items: start;
    }
    .hero-copy {
      display: grid;
      gap: 12px;
    }
    .eyebrow {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      color: #ececec;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 7px 10px;
      text-transform: uppercase;
    }
    .hero-description {
      max-width: 760px;
      font-size: 15px;
      line-height: 1.65;
      color: #d8d8d8;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .meta-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 6px 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(32, 38, 35, 0.9);
      color: #d9d9d9;
      font-size: 12px;
    }
    .hero-side {
      display: grid;
      gap: 12px;
    }
    .hero-side-card {
      border: 1px solid rgba(145, 153, 143, 0.16);
      border-radius: 14px;
      background: rgba(20, 24, 22, 0.86);
      padding: 14px;
    }
    .hero-side-title {
      margin: 0 0 6px;
      font-size: 14px;
      color: #ececec;
    }
    .hero-side-copy {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.55;
    }
    .notice {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.78);
      padding: 12px 14px;
      transition: all 150ms ease;
      min-height: 48px;
    }
    .notice.ok { color: #f0f0f0; border-color: rgba(255, 255, 255, 0.18); background: rgba(44, 44, 44, 0.94); }
    .notice.error { color: #f0f0f0; border-color: rgba(255, 255, 255, 0.16); background: rgba(40, 40, 40, 0.94); }
    .notice.warn { color: #f0f0f0; border-color: rgba(255, 255, 255, 0.16); background: rgba(46, 46, 46, 0.94); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 11px; margin-top: 12px; }
    .field { display: grid; gap: 6px; font-size: 12px; color: var(--muted); }
    .field span { font-weight: 600; color: #d2d2d2; }
    #modePanelHost { display: contents; }
    .conditional-hidden { display: none !important; }
    .hint {
      font-size: 12px;
      color: #b9b9b9;
      line-height: 1.45;
    }
    .help-panel {
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: linear-gradient(180deg, rgba(34, 34, 34, 0.96), rgba(21, 21, 21, 0.98));
      border-radius: 12px;
      padding: 10px;
      margin-top: 10px;
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
      border: 1px solid rgba(32, 26, 18, 0.08);
      background: rgba(252, 247, 241, 0.94);
      color: #241d16;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      text-decoration: none;
    }
    .entry-link.active {
      background: linear-gradient(180deg, rgba(58, 48, 37, 0.96), rgba(30, 25, 20, 0.96));
      border-color: rgba(38, 30, 21, 0.14);
      color: #f8f0e3;
    }
    .section-copy {
      display: grid;
      gap: 6px;
      margin-bottom: 10px;
    }
    .section-kicker {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6f5a41;
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
    .task-actions {
      border-top: 1px dashed #d6e0f0;
      padding-top: 10px;
      margin-top: 10px;
    }
    .action-groups {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }
    .action-group {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid #dbe5f4;
      border-radius: 10px;
      background: linear-gradient(180deg, #fbfdff, #f7faff);
    }
    .action-group[data-group="primary"] {
      border-color: #cfe0fb;
      background: linear-gradient(180deg, #f7fbff, #eef5ff);
    }
    .action-group[data-group="danger"] {
      border-color: #ead7d7;
      background: linear-gradient(180deg, #fffafa, #fff5f5);
    }
    .action-group-label {
      flex: 0 0 62px;
      padding-top: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #60728e;
      text-transform: uppercase;
    }
    .action-group-buttons {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: 8px;
    }
    .action-note {
      margin-top: 7px;
      font-size: 12px;
      color: #5f7394;
      line-height: 1.5;
    }
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
    button.ghost,
    button.neutral,
    button.info,
    button.success {
      background: rgba(44, 44, 44, 0.96);
      color: #f0f0f0;
      border-color: rgba(255, 255, 255, 0.12);
    }
    button.danger,
    button.warn {
      background: rgba(52, 52, 52, 0.96);
      color: #f0f0f0;
      border-color: rgba(255, 255, 255, 0.14);
    }
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
    .task-list {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      align-items: start;
    }
    .task-item, .run-item {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px;
      background: linear-gradient(180deg, rgba(30, 30, 30, 0.98), rgba(18, 18, 18, 0.98));
      transition: transform 120ms ease, border-color 120ms ease;
    }
    .task-item:hover, .run-item:hover { transform: translateY(-1px); border-color: rgba(255, 255, 255, 0.16); }
    .task-item {
      position: relative;
      display: grid;
      gap: 10px;
      min-height: 216px;
      padding: 14px;
      border-radius: 16px;
      background:
        radial-gradient(140% 120% at 100% 0%, rgba(255, 255, 255, 0.08), transparent 44%),
        linear-gradient(180deg, rgba(34, 34, 34, 0.98), rgba(16, 16, 16, 0.98));
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
      cursor: pointer;
    }
    .task-item::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      border-radius: 16px 0 0 16px;
      background: linear-gradient(180deg, #b5b5b5, #7a7a7a);
      opacity: 0.9;
    }
    .task-item.is-disabled::before {
      background: linear-gradient(180deg, #8e8e8e, #676767);
    }
    .task-item.is-running::before {
      background: linear-gradient(180deg, #d2d2d2, #878787);
    }
    .task-item.is-queued::before {
      background: linear-gradient(180deg, #cfcfcf, #727272);
    }
    .task-card-head {
      display: grid;
      gap: 8px;
      padding-left: 6px;
    }
    .task-card-title {
      margin: 0;
      font-size: 17px;
      line-height: 1.25;
      color: #16325c;
      word-break: break-word;
    }
    .task-card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .task-card-summary {
      display: grid;
      gap: 8px;
      padding-left: 6px;
    }
    .task-card-cwd {
      font-size: 12px;
      color: #5c7090;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .task-card-kv {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .task-card-kv-item {
      border: 1px solid #dce6f5;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.85);
      padding: 8px 9px;
      min-height: 58px;
    }
    .task-card-kv-item b {
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      color: #6a7c98;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .task-card-kv-item span {
      display: block;
      font-size: 12px;
      color: #213a5f;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .task-card-preview {
      border: 1px solid #d8e3f5;
      border-radius: 12px;
      background: linear-gradient(180deg, #f8fbff, #f3f7ff);
      padding: 10px 11px;
      display: grid;
      gap: 6px;
    }
    .task-card-preview b {
      font-size: 11px;
      color: #667b9f;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .task-card-preview span {
      display: block;
      font-size: 13px;
      color: #233a5c;
      line-height: 1.55;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .task-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-left: 6px;
    }
    .task-card-tip {
      font-size: 12px;
      color: #5c7090;
    }
    .task-card-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .task-card-actions button {
      position: relative;
      z-index: 1;
    }
    .task-detail-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 22px;
      background: rgba(12, 26, 52, 0.38);
      backdrop-filter: blur(10px);
      z-index: 50;
    }
    .task-detail-overlay.open {
      display: flex;
      animation: fade-up 180ms ease both;
    }
    .task-detail-dialog {
      width: min(1080px, 100%);
      max-height: calc(100vh - 44px);
      overflow: auto;
      border: 1px solid #d2def1;
      border-radius: 22px;
      background:
        radial-gradient(120% 120% at 100% 0%, rgba(31, 118, 255, 0.08), transparent 38%),
        linear-gradient(180deg, #ffffff, #f7faff);
      box-shadow: 0 28px 70px rgba(15, 35, 72, 0.22);
      padding: 18px;
    }
    .task-detail-head {
      display: grid;
      gap: 10px;
      margin-bottom: 14px;
    }
    .task-detail-titlebar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .task-detail-title {
      margin: 0;
      font-size: 26px;
      color: #17345f;
      line-height: 1.12;
    }
    .task-detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      gap: 14px;
    }
    .task-detail-main,
    .task-detail-side {
      display: grid;
      gap: 12px;
      align-content: start;
    }
    .task-detail-panel {
      border: 1px solid #d9e3f3;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.88);
      padding: 12px;
    }
    .task-detail-panel h3 {
      margin: 0 0 8px;
      font-size: 13px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #5b7095;
    }
    .task-detail-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .task-detail-meta-item {
      border: 1px solid #dce6f5;
      border-radius: 10px;
      background: #f8fbff;
      padding: 9px 10px;
      min-height: 64px;
    }
    .task-detail-meta-item b {
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      color: #6a7c98;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .task-detail-meta-item span {
      display: block;
      font-size: 13px;
      color: #213a5f;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .task-detail-actions {
      display: grid;
      gap: 10px;
    }
    .task-detail-close {
      flex: 0 0 auto;
    }
    .task-edit-form {
      display: grid;
      gap: 12px;
    }
    .task-edit-form .edit-row {
      display: grid;
      gap: 6px;
    }
    .task-edit-form .edit-row label {
      font-size: 12px;
      font-weight: 600;
      color: #4b5f7b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .task-edit-form .edit-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .task-edit-form textarea {
      min-height: 120px;
    }
    .task-edit-actions {
      display: flex;
      gap: 10px;
      margin-top: 6px;
    }
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
    .wf-row { display: grid; grid-template-columns: 1.15fr 0.82fr 1.15fr 1.15fr 1.1fr 0.72fr 0.92fr 0.72fr auto; gap: 6px; margin-top: 6px; align-items: start; }
    .wf-row:first-child { margin-top: 0; }
    .wf-step-name,
    .wf-step-prompt {
      min-height: 64px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .wf-step-prompt {
      min-height: 110px;
    }
    .wf-step-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 42px;
      padding: 0 10px;
      border: 1px solid #d8e4fb;
      border-radius: 10px;
      background: #f7faff;
      color: #48617f;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .wf-step-toggle input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--accent-2);
    }
    .wf-actions { display: flex; gap: 4px; }
    .wf-mini { padding: 6px 8px; font-size: 12px; border-radius: 8px; }
    .wf-builder[data-advanced="false"] .wf-row { grid-template-columns: 1.8fr 1fr 0.72fr auto; }
    .wf-builder[data-advanced="false"] .wf-adv { display: none; }
    .wf-step-list {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }
    .wf-step-card {
      border: 1px solid #d9e3f3;
      border-radius: 10px;
      background: linear-gradient(180deg, #fbfdff, #f7faff);
      padding: 10px;
    }
    .wf-step-card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .wf-step-card-title {
      font-size: 13px;
      font-weight: 700;
      color: #20385d;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .wf-step-card-meta {
      font-size: 12px;
      color: #647892;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .wf-step-card-body {
      display: grid;
      gap: 6px;
      font-size: 12px;
    }
    .wf-step-card-field {
      border: 1px solid #e1e8f5;
      border-radius: 8px;
      background: #fff;
      padding: 7px 8px;
    }
    .wf-step-card-field b {
      display: block;
      margin-bottom: 4px;
      color: #5d7393;
      font-size: 11px;
    }
    .wf-step-card-field span {
      display: block;
      color: #263a57;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .tag { font-size: 12px; border-radius: 999px; padding: 4px 8px; border: 1px solid var(--line); color: var(--muted); }
    .ok { color: var(--ok); border-color: rgba(255, 255, 255, 0.16); background: rgba(48, 48, 48, 0.94); }
    .error { color: var(--error); border-color: rgba(255, 255, 255, 0.16); background: rgba(40, 40, 40, 0.94); }
    .tag.running { color: #f0f0f0; border-color: rgba(255, 255, 255, 0.16); background: rgba(48, 48, 48, 0.94); }
    .tag.queued { color: #f0f0f0; border-color: rgba(255, 255, 255, 0.16); background: rgba(42, 42, 42, 0.94); }
    .tag.warn-risk { color: var(--warn); border-color: rgba(255, 255, 255, 0.16); background: rgba(46, 46, 46, 0.94); }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      background: #f3f7ff;
      border: 1px solid #dee7f5;
      border-radius: 8px;
      padding: 8px;
    }
    .workbench-main,
    .workbench-head,
    .card,
    .hero,
    .hero-side-card,
    .surface-note,
    .notice,
    .help-panel,
    .draft-panel,
    .task-item,
    .run-item,
    .queue-item,
    .task-detail-dialog,
    .wf-step-card,
    .wf-step-card-field,
    pre {
      border-color: var(--line);
      background:
        linear-gradient(180deg, rgba(28, 28, 28, 0.96), rgba(15, 15, 15, 0.98)),
        #151515;
      color: var(--text);
      box-shadow: 0 22px 48px rgba(0, 0, 0, 0.28);
    }
    .workbench-main {
      background:
        linear-gradient(180deg, rgba(17, 17, 17, 0.98), rgba(9, 9, 9, 1)),
        #111111;
    }
    .overview-card,
    .meta-pill,
    .tag,
    .task-card-tag,
    .run-status-badge,
    .wf-pill,
    .workbench-tab {
      border-color: var(--line);
      background: rgba(28, 28, 28, 0.92);
      color: rgba(232, 232, 232, 0.84);
    }
    .hero {
      background:
        linear-gradient(140deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.015) 42%, rgba(15, 15, 15, 0.98) 78%),
        #151515;
    }
    .eyebrow,
    .tag.running,
    .tag.queued,
    .tag.warn-risk,
    .ok,
    .error {
      background: rgba(54, 54, 54, 0.94);
      border-color: rgba(255, 255, 255, 0.16);
      color: #ededed;
    }
    .workbench-tab.active,
    button {
      background: linear-gradient(180deg, #686868, #434343);
      border-color: rgba(255, 255, 255, 0.16);
      color: #f3f3f3;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
    }
    .ghost {
      background: rgba(44, 44, 44, 0.88);
      color: #e4e4e4;
    }
    h1, h2, h3, strong, .help-title, .draft-title, .hero-side-title {
      color: #f2f2f2;
    }
    p, .muted, .hint, .help-desc, .hero-side-copy, .section-kicker, .field, .task-card-copy, .run-copy {
      color: var(--muted);
    }
    input:not([type="checkbox"]), textarea, select {
      border-color: rgba(255, 255, 255, 0.1);
      background: rgba(12, 12, 12, 0.9);
      color: var(--text);
    }
    input:not([type="checkbox"]):hover, textarea:hover, select:hover { border-color: rgba(255, 255, 255, 0.16); }
    input:not([type="checkbox"]):focus, textarea:focus, select:focus {
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
      background: rgba(15, 15, 15, 0.96);
    }
    .help-example {
      background: rgba(18, 18, 18, 0.92);
      border-color: rgba(255, 255, 255, 0.12);
      color: #e2e2e2;
    }
    button:hover {
      filter: brightness(1.02);
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
    }
    button.ghost,
    button.neutral,
    button.info,
    button.success,
    button.warn {
      background: rgba(54, 59, 55, 0.76);
      border-color: rgba(145, 153, 143, 0.16);
      color: #ddd7c9;
      box-shadow: none;
    }
    button.danger {
      background: rgba(95, 58, 56, 0.42);
      border-color: rgba(185, 124, 118, 0.16);
      color: #ddbbb6;
      box-shadow: none;
    }
    /* Final gallery pass: remove the remaining deep tones and align with the shared warm ivory shell. */
    :root {
      --bg: #efe4d3;
      --bg-2: #fbf6ef;
      --card: #fbf6ef;
      --text: #1d1711;
      --muted: rgba(82, 68, 50, 0.72);
      --line: rgba(32, 26, 18, 0.1);
      --line-strong: rgba(32, 26, 18, 0.18);
      --accent: #30271e;
      --accent-2: #19140f;
      --ok: #2e261f;
      --warn: #564c41;
      --error: #463c33;
    }
    body {
      background:
        radial-gradient(1000px 540px at 8% -10%, rgba(255, 255, 255, 0.76) 0%, transparent 68%),
        radial-gradient(900px 520px at 105% 0%, rgba(224, 210, 191, 0.46) 0%, transparent 72%),
        linear-gradient(180deg, var(--bg-2), var(--bg));
    }
    .workbench-main,
    .workbench-head,
    .card,
    .hero,
    .hero-side-card,
    .surface-note,
    .notice,
    .help-panel,
    .draft-panel,
    .task-item,
    .run-item,
    .queue-item,
    .task-detail-dialog,
    .wf-step-card,
    .wf-step-card-field,
    pre {
      background:
        linear-gradient(180deg, rgba(255, 251, 246, 0.97), rgba(244, 236, 226, 0.98)),
        #f8f0e4;
      border-color: rgba(32, 26, 18, 0.1);
      color: var(--text);
      box-shadow: 0 22px 48px rgba(96, 72, 44, 0.12);
    }
    .workbench-main {
      background:
        linear-gradient(180deg, rgba(252, 247, 240, 0.98), rgba(243, 234, 223, 0.98)),
        #f7efe4;
    }
    .hero {
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.84), transparent 34%),
        linear-gradient(135deg, rgba(251, 245, 238, 0.98), rgba(239, 229, 216, 0.98));
    }
    .overview-card,
    .meta-pill,
    .tag,
    .task-card-tag,
    .run-status-badge,
    .wf-pill,
    .workbench-tab,
    .eyebrow,
    .ok,
    .error,
    .tag.running,
    .tag.queued,
    .tag.warn-risk {
      background: rgba(252, 247, 241, 0.92);
      border-color: rgba(32, 26, 18, 0.08);
      color: rgba(46, 37, 26, 0.82);
    }
    .workbench-tab.active,
    button {
      background: linear-gradient(180deg, rgba(252, 247, 241, 0.98), rgba(241, 233, 222, 0.98));
      border-color: rgba(32, 26, 18, 0.1);
      color: #231c15;
      box-shadow: 0 10px 24px rgba(96, 72, 44, 0.08);
    }
    .ghost,
    button.ghost,
    button.neutral,
    button.info,
    button.success,
    button.warn,
    button.danger {
      background: rgba(249, 243, 235, 0.96);
      border-color: rgba(32, 26, 18, 0.08);
      color: rgba(47, 38, 28, 0.84);
      box-shadow: none;
    }
    .workbench-tab.active {
      background: linear-gradient(180deg, rgba(244, 236, 226, 0.98), rgba(233, 223, 210, 0.98));
      color: #1e1812;
    }
    h1, h2, h3, strong, .help-title, .draft-title, .hero-side-title,
    .task-card-title, .task-detail-title {
      color: #1b1510;
    }
    .task-card-kv-item span,
    .task-card-preview span,
    .task-detail-meta-item span,
    .wf-step-card-title,
    .wf-step-card-field span {
      color: rgba(45, 36, 27, 0.96);
    }
    p, .muted, .hint, .help-desc, .hero-side-copy, .section-kicker, .field, .task-card-copy, .run-copy,
    .task-card-tip, .task-card-cwd, .wf-step-card-meta, .action-note {
      color: rgba(82, 68, 50, 0.72);
    }
    .task-card-kv-item b,
    .task-card-preview b,
    .task-detail-panel h3,
    .task-detail-meta-item b,
    .task-edit-form .edit-row label,
    .live-title,
    .wf-step-card-field b,
    .action-group-label {
      color: rgba(96, 77, 55, 0.76);
    }
    input:not([type="checkbox"]), textarea, select,
    .help-example, .draft-item, .action-group, .task-card-kv-item, .task-card-preview,
    .task-detail-panel, .task-detail-meta-item, .wf-step-head, .wf-row, .wf-cell, .queue-item {
      border-color: rgba(32, 26, 18, 0.08);
      background: rgba(255, 252, 248, 0.96);
      color: var(--text);
    }
    input:not([type="checkbox"]):focus, textarea:focus, select:focus {
      border-color: rgba(42, 34, 24, 0.22);
      box-shadow: 0 0 0 3px rgba(62, 47, 31, 0.06);
      background: rgba(255, 255, 255, 0.98);
    }
    .task-item::before,
    .task-item.is-disabled::before,
    .task-item.is-running::before,
    .task-item.is-queued::before {
      background: linear-gradient(180deg, #6a5a47, #2f271f);
    }
    .loop-overview {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.75fr);
      gap: 14px;
      align-items: stretch;
    }
    .composer-layout,
    .runtime-lane {
      display: grid;
      gap: 14px;
    }
    .runtime-lane {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      align-items: start;
    }
    .stack-card {
      display: grid;
      gap: 12px;
    }
    .mini-card {
      border: 1px solid rgba(32, 26, 18, 0.08);
      border-radius: 18px;
      padding: 16px;
      background:
        linear-gradient(180deg, rgba(255, 251, 246, 0.96), rgba(243, 235, 225, 0.98)),
        #f8f0e4;
      box-shadow: 0 20px 40px rgba(96, 72, 44, 0.12);
    }
    .mini-kicker {
      display: inline-flex;
      margin-bottom: 10px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(82, 68, 50, 0.62);
    }
    .mini-card strong {
      display: block;
      font-size: 22px;
      line-height: 1;
      letter-spacing: -0.04em;
    }
    .mini-card p {
      margin: 10px 0 0;
    }
    .inline-control {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .runtime-banner {
      margin-top: 8px;
      padding: 10px 12px;
      border: 1px solid rgba(32, 26, 18, 0.08);
      border-radius: 12px;
      background: rgba(249, 243, 235, 0.88);
    }
    .notice {
      background: rgba(248, 241, 232, 0.94);
      border-color: rgba(32, 26, 18, 0.08);
      color: rgba(70, 57, 42, 0.8);
    }
    .notice.ok,
    .notice.warn,
    .notice.error {
      background: rgba(243, 236, 227, 0.98);
      border-color: rgba(32, 26, 18, 0.1);
      color: #33291f;
    }
    .hero-side-card,
    .mini-card {
      background:
        linear-gradient(180deg, rgba(252, 247, 241, 0.97), rgba(242, 234, 223, 0.98)),
        #f7efe4;
      box-shadow: 0 18px 34px rgba(96, 72, 44, 0.08);
    }
    .composer-card .help-panel,
    .composer-card .compact-tools,
    .composer-card .notice {
      margin-top: 12px;
    }
    .section-headline {
      margin-bottom: 6px;
    }
    .toggle-line input[type="checkbox"] {
      accent-color: #2f271f;
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
      .hero-grid { grid-template-columns: 1fr; }
      .loop-overview,
      .runtime-lane,
      .dashboard-grid,
      .activity-grid { grid-template-columns: 1fr; }
      .grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      .span4 { grid-column: span 2; }
      .span2 { grid-column: span 2; }
      .wf-row { min-width: 920px; }
      .wf-builder[data-advanced="false"] .wf-row { min-width: 560px; }
      .task-detail-grid { grid-template-columns: 1fr; }
      .task-detail-meta,
      .task-card-kv { grid-template-columns: 1fr; }
      .task-detail-overlay { padding: 12px; }
      .task-detail-dialog { max-height: calc(100vh - 24px); padding: 14px; }
    }
    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; }
      .span4,
      .span2 { grid-column: span 1; }
    }
  </style>
</head>
<body>
  ${renderWorkbenchLayout("/__loop", `<div class="page-shell">
      <div class="workbench-rail">
        <span class="workbench-rail-label">Workflow / Loop</span>
        <span class="workbench-rail-value">workflow-first 调度台，保留单命令兼容入口。</span>
      </div>
      ${LOOP_HERO_HTML}

      <div class="section-stack">
        <section class="loop-overview">
          <div class="card">
            <div class="section-copy">
              <div class="section-kicker">运行概览</div>
              <p class="muted">集中确认并发、排队和当前运行态，避免 workflow 调度失控。</p>
            </div>
            <div class="row">
              <h2 style="margin:0;">并发执行与排队</h2>
              <div class="row" style="gap:8px;">
                <label class="muted inline-control">
                  最大并发
                  <input id="maxConcurrentRuns" type="number" min="1" max="16" value="4" style="width:80px;" />
                </label>
                <button class="ghost" id="saveConcurrencyBtn">保存并发设置</button>
              </div>
            </div>
            <div id="runtimeStats" class="muted runtime-banner">运行中: 0 | 排队中: 0</div>
            <div id="queueList" class="queue-list"></div>
          </div>
          <div class="stack-card">
            <div class="mini-card">
              <span class="mini-kicker">Workflow</span>
              <strong>支持工作流的搭建</strong>
              <p>命令模式适合单轮执行，Workflow 模式适合多步骤串联与循环。</p>
            </div>
            <div class="mini-card">
              <span class="mini-kicker">运行原则</span>
              <strong>先建模，再运行</strong>
              <p>任务配置、队列状态和运行历史分层展示，避免在一个长表单里混杂判断。</p>
            </div>
          </div>
        </section>

        <section class="composer-layout">
          <div class="card composer-card">
            <div class="section-copy">
              <div class="section-kicker">Workflow Builder</div>
            </div>
            <div class="row section-headline">
              <h2 style="margin:0 0 10px;">搭建任务与步骤流</h2>
            </div>
            <div class="help-panel">
              <h3 class="help-title">开始前先做什么</h3>
              <p class="help-desc">优先用多步骤 workflow 组织执行过程；若只是单步命令，也可以切换到兼容模式。</p>
            </div>
            <div class="grid" id="taskFormGrid">
              <label class="field"><span>任务名称</span><input id="name" placeholder="例如：每小时代码巡检" /></label>
              <label class="field"><span>Runner</span>
                <select id="runner">
                  <option value="custom" selected>custom</option>
                  <option value="codex">codex</option>
                  <option value="claude_code">claude_code</option>
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                </select>
              </label>
              <label class="field"><span>循环间隔(秒)</span><input id="intervalSec" type="number" min="5" value="300" /><small class="hint">最小 5 秒</small></label>
              <div class="field span2">
                <span>执行模式</span>
                <select id="advancedMode">
                  <option value="workflow" selected>多步骤 Workflow 模式（推荐）</option>
                  <option value="command">单命令兼容模式</option>
                </select>
                <small id="advancedModeHint" class="hint">Workflow-first / Command compatibility</small>
              </div>
              <div id="modePanelHost" class="span4"></div>
              <label class="field span4"><span>Prompt</span><textarea id="prompt" placeholder="输入任务 Prompt"></textarea></label>
            </div>
            <details id="assistPanel" class="compact-tools">
              <summary>展开预览</summary>
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
          </div>
        </section>

        <section class="runtime-lane">
          <div class="card">
            <div class="section-copy">
              <div class="section-kicker">任务列表</div>
              <p class="muted">任务卡片负责浏览与调度入口，细节操作继续在弹层里展开。</p>
            </div>
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
            <div class="section-copy">
              <div class="section-kicker">Live Runs</div>
              <p class="muted">这里单独追踪运行中的任务过程，不和历史记录混在一起。</p>
            </div>
            <div class="row">
              <h2 style="margin:0 0 8px;">运行中执行过程</h2>
            </div>
            <div id="liveRunList" class="run-list"></div>
          </div>
        </section>

        <div class="card">
          <div class="section-copy">
            <div class="section-kicker">Run History</div>
            <p class="muted">最近运行记录保持独立回顾区，方便回看 workflow 的实际执行结果。</p>
          </div>
          <div class="row">
            <h2 style="margin:0 0 8px;">最近运行记录</h2>
          </div>
          <div id="runList" class="run-list"></div>
        </div>

        <div id="taskDetailOverlay" class="task-detail-overlay" aria-hidden="true">
          <div class="task-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="taskDetailTitle">
          <div id="taskDetailBody"></div>
          </div>
        </div>
      </div>
    </div>`)}

  <script>
    const msgEl = document.getElementById("msg");
    const taskListEl = document.getElementById("taskList");
    const taskDetailOverlayEl = document.getElementById("taskDetailOverlay");
    const taskDetailBodyEl = document.getElementById("taskDetailBody");
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
    const assistPanelEl = document.getElementById("assistPanel");
    const draftSummaryEl = document.getElementById("draftSummary");
    const draftWarningsEl = document.getElementById("draftWarnings");
    const STORAGE_LAST_SUCCESS = "agentlens.loop.lastSuccess.v1";
    let editingTaskId = null;
    let editingTaskEnabled = true;
    let editingInModal = false;
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
    let selectedTaskId = null;
    let renderedTaskDetailTaskId = null;
    let renderedTaskDetailSignature = "";
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
      command: "单命令兼容模式：单步骤执行，默认预填 codex exec 命令模板（可编辑，含 {prompt}）。",
      workflow: "Workflow-first 模式：启用多步骤流程与可视化编排。每一步会按“任务总 Prompt + 当前步骤 Prompt”拼接执行，可用任务命令作为默认，或为每个步骤单独写命令。"
    };
    const STEP_TEMPLATES = {
      dev_codex: {
        name: "开发",
        stepType: "command",
        runner: "custom",
        cwd: "",
        command: "",
        toolName: "",
        toolInput: "",
        promptAppend: "根据需求改动代码，优先保证可运行性和最小变更面。",
        retryCount: 1,
        retryBackoffMs: 1200,
        continueOnError: false,
        enabled: true
      },
      review_codex: {
        name: "Code Review",
        stepType: "command",
        runner: "custom",
        cwd: "",
        command: "",
        toolName: "",
        toolInput: "",
        promptAppend: "重点检查正确性、边界条件、回归风险和缺失测试。",
        retryCount: 1,
        retryBackoffMs: 1200,
        continueOnError: false,
        enabled: true
      },
      review_custom: {
        name: "Code Review",
        stepType: "command",
        runner: "custom",
        cwd: "",
        command: "review-cli \\\\\\\"{prompt}\\\\\\\"",
        toolName: "",
        toolInput: "",
        promptAppend: "输出问题清单和修复建议。",
        retryCount: 1,
        retryBackoffMs: 1200,
        continueOnError: false,
        enabled: true
      },
      summary_codex: {
        name: "总结",
        stepType: "command",
        runner: "custom",
        cwd: "",
        command: "",
        toolName: "",
        toolInput: "",
        promptAppend: "总结改动内容、影响范围和验证建议。",
        retryCount: 1,
        retryBackoffMs: 1200,
        continueOnError: true,
        enabled: true
      },
      test_codex: {
        name: "测试",
        stepType: "command",
        runner: "custom",
        cwd: "",
        command: "",
        toolName: "",
        toolInput: "",
        promptAppend: "执行并整理相关测试结果，指出失败原因。",
        retryCount: 1,
        retryBackoffMs: 1200,
        continueOnError: false,
        enabled: true
      }
    };
    function reportUiError(error) {
      const text = error && error.message ? error.message : String(error || "未知错误");
      msg("页面脚本异常: " + text, true);
      if (window && window.console && typeof window.console.error === "function") {
        window.console.error("[loop-ui]", error);
      }
    }

    if (window && typeof window.addEventListener === "function") {
      window.addEventListener("error", function (event) {
        if (event && event.error) {
          reportUiError(event.error);
          return;
        }
        const text = event && event.message ? event.message : "未知脚本错误";
        reportUiError(new Error(text));
      });
      window.addEventListener("unhandledrejection", function (event) {
        reportUiError(event && event.reason ? event.reason : new Error("未处理的 Promise 异常"));
      });
    }

    function setHidden(el, hidden) {
      if (!el) return;
      if (hidden) {
        el.classList.add("conditional-hidden");
      } else {
        el.classList.remove("conditional-hidden");
      }
    }

    function replaceText(value, search, replacement) {
      return String(value || "").split(search).join(replacement);
    }

    function normalizeNewlines(value) {
      return replaceText(replaceText(String(value || ""), "\\r\\n", "\\n"), "\\r", "\\n");
    }

    function splitLines(value) {
      return normalizeNewlines(value).split("\\n");
    }

    function removeElement(el) {
      if (!el) return;
      if (el.parentNode && typeof el.parentNode.removeChild === "function") {
        el.parentNode.removeChild(el);
        return;
      }
      if (typeof el.remove === "function") {
        el.remove();
      }
    }

    function insertElementAfter(anchor, el) {
      if (!anchor || !el) return;
      const parent = anchor.parentNode;
      if (parent && typeof parent.insertBefore === "function") {
        if (anchor.nextSibling) {
          parent.insertBefore(el, anchor.nextSibling);
        } else if (typeof parent.appendChild === "function") {
          parent.appendChild(el);
        } else if (typeof anchor.insertAdjacentElement === "function") {
          anchor.insertAdjacentElement("afterend", el);
        }
        return;
      }
      if (typeof anchor.insertAdjacentElement === "function") {
        anchor.insertAdjacentElement("afterend", el);
      }
    }

    function hasClassName(el, className) {
      const text = " " + String(el && el.className ? el.className : "") + " ";
      return text.indexOf(" " + className + " ") >= 0;
    }

    function matchesSimpleSelector(el, selector) {
      if (!el || el.nodeType !== 1) return false;
      const tagName = String(el.tagName || "").toLowerCase();
      if (selector === "button") {
        return tagName === "button";
      }
      if (selector === "[data-task-card]") {
        return !!(typeof el.getAttribute === "function" && el.getAttribute("data-task-card"));
      }
      if (selector === ".wf-row") {
        return hasClassName(el, "wf-row");
      }
      return false;
    }

    function closestSimple(el, selector) {
      let current = el;
      while (current && current !== document) {
        if (typeof current.closest === "function") {
          const found = current.closest(selector);
          if (found) return found;
        }
        if (matchesSimpleSelector(current, selector)) {
          return current;
        }
        current = current.parentElement || current.parentNode || null;
      }
      return null;
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
          + '<div id="cwdFieldWrap" class="field span2"><span>工作目录 / 文件路径（必填）</span><input id="cwd" placeholder="例如：/path/project 或 /path/project/src/app.ts" /><small class="hint">目录或文件路径</small></div>'
          + '<label id="commandFieldWrap" class="field span2"><span>任务级命令（可选，含 {prompt} 占位）</span><input id="command" placeholder="例如：my-cli run &quot;{prompt}&quot;" /><small class="hint">步骤未设置时使用</small></label>'
          + '<label id="workflowLoopField" class="field"><span>Workflow 执行方式</span><select id="workflowLoopFromStart"><option value="false" selected>单轮执行（一次）</option><option value="true">从头循环</option></select><small class="hint">单轮 / 循环</small></label>'
          + '<label id="workflowSessionField" class="field"><span>Codex 上下文复用</span><select id="workflowSharedSession"><option value="true" selected>复用同一条 Codex 对话</option><option value="false">每步新开 Codex 对话</option></select><small class="hint">仅对 Codex 生效</small></label>'
          + '<label id="workflowAccessField" class="field"><span>Codex 权限模式</span><select id="workflowFullAccess"><option value="false" selected>标准</option><option value="true">Full Access</option></select><small class="hint">仅对 Codex 生效</small></label>'
          + '<div id="workflowBuilderField" class="field span4"><span>Workflow 编辑器</span><div id="workflowPanelHost" class="wf-builder"><div class="muted">点击后开始添加步骤</div></div></div>';
        cwdInputEl = document.getElementById("cwd");
        commandInputEl = document.getElementById("command");
        workflowCarryContextEl = null;
        workflowLoopFromStartEl = document.getElementById("workflowLoopFromStart");
        workflowSharedSessionEl = document.getElementById("workflowSharedSession");
        workflowFullAccessEl = document.getElementById("workflowFullAccess");
        workflowPanelHostEl = document.getElementById("workflowPanelHost");
        if (cwdInputEl) cwdInputEl.value = modeDraft.cwd;
        if (commandInputEl) commandInputEl.value = modeDraft.command;
        if (workflowLoopFromStartEl) workflowLoopFromStartEl.value = modeDraft.workflowLoopFromStart || "false";
        if (workflowSharedSessionEl) workflowSharedSessionEl.value = modeDraft.workflowSharedSession || "true";
        if (workflowFullAccessEl) workflowFullAccessEl.value = modeDraft.workflowFullAccess || "false";
        workflowBuilderRows = Array.isArray(modeDraft.workflowSteps) ? modeDraft.workflowSteps.map(normalizeStep) : [];
      } else {
        modePanelHostEl.innerHTML = ''
          + '<div id="cwdFieldWrap" class="field span2"><span>工作目录 / 文件路径（必填）</span><input id="cwd" placeholder="例如：/path/project 或 /path/project/src/app.ts" /><small class="hint">目录或文件路径</small></div>'
          + '<label id="commandFieldWrap" class="field span2"><span>自定义命令（含 {prompt} 占位）</span><input id="command" placeholder="例如：my-cli run &quot;{prompt}&quot;" /><small class="hint">{prompt} 会被替换</small></label>';
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
          stepType: "command",
          runner: "",
          cwd: "",
          command: "",
          toolName: "",
          toolInput: "",
          promptAppend: "",
          retryCount: 0,
          retryBackoffMs: 1200,
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
        const rowEl = closestSimple(target, ".wf-row");
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
        if (target instanceof HTMLTextAreaElement) {
          autoResizeWorkflowTextareas(closestSimple(target, ".wf-row"));
        }
        const rowEl = closestSimple(target, ".wf-row");
        if (!rowEl) return;
        const idx = Number(rowEl.getAttribute("data-idx"));
        if (!Number.isFinite(idx) || idx < 0 || idx >= workflowBuilderRows.length) return;
        const key = target.getAttribute("data-k");
        if (!key) return;
        const row = workflowBuilderRows[idx] || {};
        if (target instanceof HTMLInputElement) {
          if (key === "enabled") {
            row.enabled = target.checked;
          } else if (key === "retryCount") {
            const n = Number(target.value);
            row.retryCount = Number.isFinite(n) ? Math.max(0, Math.min(8, Math.floor(n))) : 0;
          } else if (key === "retryBackoffMs") {
            const n = Number(target.value);
            row.retryBackoffMs = Number.isFinite(n) ? Math.max(200, Math.min(30000, Math.floor(n))) : 1200;
          } else {
            row[key] = target.value;
          }
        } else if (target instanceof HTMLTextAreaElement) {
          row[key] = target.value;
        } else if (target instanceof HTMLSelectElement) {
          if (key === "continueOnError") {
            row.continueOnError = target.value === "true";
          } else {
            row[key] = target.value;
          }
        }
        workflowBuilderRows[idx] = row;
        syncTextareaFromBuilder(false, false);
        if (key === "runner" || key === "enabled") {
          applyDynamicVisibility();
        }
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
      const mode = String(advancedModeEl.value || "command");
      mountModePanel(mode);
      const workflowEnabled = mode === "workflow";
      const runnerEl = document.getElementById("runner");
      const taskRunner = String(runnerEl ? (runnerEl.value || "custom") : "custom");
      const workflowUsesCodex = workflowEnabled && hasCodexWorkflowConfig(taskRunner, workflowBuilderRows);

      if (workflowEnabled) {
        ensureWorkflowUiLoaded();
      } else {
        setHidden(pathStatusEl, false);
      }

      setHidden(document.getElementById("workflowSessionField"), !workflowUsesCodex);
      setHidden(document.getElementById("workflowAccessField"), !workflowUsesCodex);

      updateModeHint();
    }

    function hasCodexWorkflowConfig(taskRunner, steps) {
      if (String(taskRunner || "") === "codex") {
        return true;
      }
      if (!Array.isArray(steps)) {
        return false;
      }
      return steps.some(function (step) {
        if (!step || step.enabled === false) {
          return false;
        }
        const stepRunner = String((step && step.runner) || taskRunner || "custom");
        return stepRunner === "codex";
      });
    }

    function draftWarningsOf(body) {
      function isModelRunner(runner) {
        return runner === "openai" || runner === "anthropic";
      }
      const warns = [];
      const duplicate = cachedTasks.find(function (item) {
        if (!item || !item.name) return false;
        if (editingTaskId && item.id === editingTaskId) return false;
        return String(item.name).trim().toLowerCase() === String(body.name || "").trim().toLowerCase();
      });
      if (duplicate) warns.push("任务名称重复：请使用唯一名称。");
      if (!body.name) warns.push("任务名称为空：后续不便于识别和检索。");
      if (!body.prompt) warns.push("Prompt 为空：任务将无法创建或测试。");
      if (!body.cwd) warns.push("工作目录 / 文件路径未填写：现在为必填项。");
      if (!Number.isFinite(body.intervalSec) || body.intervalSec < 5) warns.push("循环间隔需 >= 5 秒。");
      const mode = String(advancedModeEl.value || "command");
      const taskRunner = String(body.runner || "custom");
      if (mode === "command" && taskRunner === "custom" && !body.command) {
        warns.push("命令为空：runner=custom 时必须填写命令。");
      }
      if (mode === "workflow") {
        const steps = Array.isArray(body.workflowSteps) ? body.workflowSteps.filter(function (x) { return x && x.enabled !== false; }) : [];
        if (steps.length === 0) {
          warns.push("Workflow 至少需要 1 个启用步骤。");
        }
        if (steps.length > 0) {
          const hasMissingCustomCommand = steps.some(function (x) {
            if (x && x.tool && String(x.tool.name || "").trim()) {
              return false;
            }
            const stepRunner = String((x && x.runner) || taskRunner || "custom");
            if (isModelRunner(stepRunner) || stepRunner === "codex" || stepRunner === "claude_code") {
              return false;
            }
            const stepCommand = String((x && x.command) || "").trim();
            const taskCommand = String(body.command || "").trim();
            return !stepCommand && !taskCommand;
          });
          if (hasMissingCustomCommand) {
            warns.push("Workflow 中存在 runner=custom 且未提供命令（步骤与任务级都为空）的启用步骤：执行会失败。");
          }
          const hasMissingToolName = steps.some(function (x) {
            if (!x || !x.tool) return false;
            return !String(x.tool.name || "").trim();
          });
          if (hasMissingToolName) {
            warns.push("Workflow 中存在 tool 步骤但工具名为空：执行会失败。");
          }
        }
        if (body.workflowFullAccess && hasCodexWorkflowConfig(taskRunner, steps)) {
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
          || text.includes("工作目录 / 文件路径未填写")
          || text.includes("命令为空")
          || text.includes("至少需要 1 个启用步骤")
          || text.includes("未填写命令")
          || text.includes("未提供命令")
          || text.includes("工具名为空");
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
      const showCodexWorkflowSettings = workflowEnabled && hasCodexWorkflowConfig(body.runner, steps);
      if (assistPanelEl && assistPanelEl.open) {
        const summaryHtml = [
          '<div class="draft-item"><b>任务</b>' + esc(body.name || "(未填写)") + "</div>",
          '<div class="draft-item"><b>Runner</b>' + esc(body.runner || "-") + "</div>",
          '<div class="draft-item"><b>下一次预计执行</b>' + esc(formatNextRun(body.intervalSec)) + "</div>",
          '<div class="draft-item"><b>循环间隔</b>' + esc(String(body.intervalSec) + "s") + "</div>",
          '<div class="draft-item"><b>路径</b>' + esc(body.cwd || "(未填写)") + "</div>",
          '<div class="draft-item"><b>流程 / 命令模式</b>' + esc((workflowEnabled ? "多步骤" : "单步骤") + " / 自定义命令") + "</div>",
          '<div class="draft-item"><b>Workflow 启用步骤</b>' + esc(String(enabledSteps)) + "</div>",
          showCodexWorkflowSettings
            ? ('<div class="draft-item"><b>Codex 上下文</b>' + esc(body.workflowSharedSession ? "复用同一条对话" : "每步新开对话") + "</div>")
            : "",
          showCodexWorkflowSettings
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
        removeElement(btn);
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
      if (lower.includes("workflow requires at least one step")) {
        return "Workflow 至少需要 1 个步骤。";
      }
      if (lower.includes("no enabled workflow steps")) {
        return "Workflow 中没有启用步骤：请至少启用一个步骤。";
      }
      if (lower.includes("command not found") || lower.includes("exit: 127")) {
        return "命令未找到：请确认命令可执行，并且 PATH 配置正确。";
      }
      let isPathValidationError = lower.includes("path not found");
      if (!isPathValidationError && lower.includes("no such file or directory")) {
        const lines = splitLines(text);
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
            || lineLower.includes(" stat ")
            || lineLower.startsWith("stat ")
            || lineLower.endsWith(" stat")
            || lineLower === "stat";
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
      if (typeof fetch !== "function") {
        throw new Error("当前浏览器不支持 fetch，请升级浏览器或切换到较新的 WebView。");
      }
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
        .split("&").join("&amp;")
        .split("<").join("&lt;")
        .split(">").join("&gt;")
        .split('"').join("&quot;")
        .split("'").join("&#39;");
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

    function parseToolInputText(raw) {
      const text = String(raw || "").trim();
      if (!text) {
        return undefined;
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        return text;
      }
    }

    function normalizeStep(step) {
      const retryCountRaw = Number(step && step.retryCount);
      const retryBackoffRaw = Number(step && step.retryBackoffMs);
      const toolName = step && step.tool && step.tool.name ? String(step.tool.name).trim() : "";
      const toolInputText = step && step.tool && Object.prototype.hasOwnProperty.call(step.tool, "input")
        ? (() => {
          if (typeof step.tool.input === "string") {
            return step.tool.input;
          }
          try {
            return JSON.stringify(step.tool.input);
          } catch (error) {
            return String(step.tool.input || "");
          }
        })()
        : "";
      const stepType = step && step.stepType
        ? String(step.stepType).trim()
        : (toolName ? "tool" : "command");
      return {
        name: String(step && step.name ? step.name : "").trim(),
        stepType: stepType === "tool" ? "tool" : "command",
        runner: step && step.runner ? String(step.runner).trim() : "",
        cwd: step && step.cwd ? String(step.cwd).trim() : "",
        command: step && step.command ? String(step.command).trim() : "",
        toolName: step && step.toolName ? String(step.toolName).trim() : toolName,
        toolInput: step && step.toolInput != null ? String(step.toolInput) : toolInputText,
        promptAppend: step && step.promptAppend != null ? normalizeNewlines(step.promptAppend).trim() : "",
        retryCount: Number.isFinite(retryCountRaw) ? Math.max(0, Math.min(8, Math.floor(retryCountRaw))) : 0,
        retryBackoffMs: Number.isFinite(retryBackoffRaw) ? Math.max(200, Math.min(30000, Math.floor(retryBackoffRaw))) : 1200,
        continueOnError: parseUiBoolean(step && step.continueOnError, false),
        enabled: parseUiBoolean(step && step.enabled, true)
      };
    }

    function buildWorkflowStepPromptPreview(taskPrompt, step) {
      const basePrompt = normalizeNewlines(taskPrompt || "").trim();
      const stepPrompt = String(step && step.promptAppend ? step.promptAppend : "").trim();
      if (!stepPrompt) {
        return basePrompt;
      }
      return basePrompt ? (basePrompt + "\\n\\n" + stepPrompt) : stepPrompt;
    }

    function cloneTemplateStep(key) {
      const tpl = STEP_TEMPLATES[key];
      if (!tpl) return null;
      return {
        name: tpl.name,
        stepType: tpl.stepType || "command",
        runner: tpl.runner,
        cwd: tpl.cwd,
        command: tpl.command,
        toolName: tpl.toolName || "",
        toolInput: tpl.toolInput || "",
        promptAppend: tpl.promptAppend,
        retryCount: tpl.retryCount,
        retryBackoffMs: tpl.retryBackoffMs,
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
        const isToolStep = r.stepType === "tool";
        return '<div class="wf-row" data-idx="' + idx + '">'
          + '<textarea class="wf-step-name" data-k="name" rows="2" placeholder="步骤名，可换行">' + esc(r.name) + '</textarea>'
          + '<select data-k="stepType" class="wf-adv">'
          + '<option value="command"' + (isToolStep ? "" : " selected") + '>命令步骤</option>'
          + '<option value="tool"' + (isToolStep ? " selected" : "") + '>工具步骤</option>'
          + '</select>'
          + '<select data-k="runner">'
          + '<option value=""' + (r.runner ? "" : " selected") + '>继承任务（' + esc(taskRunner) + '）</option>'
          + '<option value="custom"' + (r.runner === "custom" ? " selected" : "") + '>custom</option>'
          + '<option value="codex"' + (r.runner === "codex" ? " selected" : "") + '>codex</option>'
          + '<option value="claude_code"' + (r.runner === "claude_code" ? " selected" : "") + '>claude_code</option>'
          + '<option value="openai"' + (r.runner === "openai" ? " selected" : "") + '>openai</option>'
          + '<option value="anthropic"' + (r.runner === "anthropic" ? " selected" : "") + '>anthropic</option>'
          + '</select>'
          + '<input class="wf-adv" data-k="cwd" value="' + esc(r.cwd || "") + '" placeholder="可选：步骤路径(目录/文件)" />'
          + '<input class="wf-adv" data-k="command" value="' + esc(r.command) + '" placeholder="' + (isToolStep ? "工具步骤可留空" : "可选：覆盖命令") + '" />'
          + '<input class="wf-adv" data-k="toolName" value="' + esc(r.toolName || "") + '" placeholder="' + (isToolStep ? "必填：工具名" : "可选：工具名") + '" />'
          + '<textarea class="wf-adv" data-k="toolInput" placeholder="' + (isToolStep ? "可选：JSON 或纯文本" : "可选：工具输入(JSON/文本)") + '">' + esc(r.toolInput || "") + '</textarea>'
          + '<textarea class="wf-adv wf-step-prompt" data-k="promptAppend" placeholder="' + (isToolStep ? "可选：给这个工具步骤补充一段多行 Prompt" : "可选：填写这个步骤自己的 Prompt，可多行换行") + '">' + esc(r.promptAppend || "") + '</textarea>'
          + '<input class="wf-adv" data-k="retryCount" type="number" min="0" max="8" value="' + esc(r.retryCount) + '" placeholder="重试次数(0-8)" />'
          + '<input class="wf-adv" data-k="retryBackoffMs" type="number" min="200" max="30000" step="100" value="' + esc(r.retryBackoffMs) + '" placeholder="退避基数ms(200-30000)" />'
          + '<select class="wf-adv" data-k="continueOnError">'
          + '<option value="false"' + (r.continueOnError ? "" : " selected") + '>stop</option>'
          + '<option value="true"' + (r.continueOnError ? " selected" : "") + '>continue</option>'
          + '</select>'
          + '<label class="wf-step-toggle" title="关闭后保留配置，但本次 workflow 会跳过这一步"><input data-k="enabled" type="checkbox"' + (r.enabled ? " checked" : "") + ' />执行此步骤</label>'
          + '<div class="wf-actions">'
          + '<button type="button" class="ghost wf-mini" data-act="up">上移</button>'
          + '<button type="button" class="ghost wf-mini" data-act="down">下移</button>'
          + '<button type="button" class="danger wf-mini" data-act="del">删</button>'
          + '</div>'
          + '</div>';
      }).join("");
      workflowBuilderEl.innerHTML = rowsHtml;
      autoResizeWorkflowTextareas();
    }

    function autoResizeWorkflowTextareas(root) {
      const host = root || workflowBuilderEl;
      if (!host || typeof host.querySelectorAll !== "function") return;
      const textareas = host.querySelectorAll("textarea.wf-step-name, textarea.wf-step-prompt");
      for (let i = 0; i < textareas.length; i += 1) {
        const textarea = textareas[i];
        if (!(textarea instanceof HTMLTextAreaElement)) continue;
        textarea.style.height = "auto";
        textarea.style.height = Math.max(textarea.scrollHeight, textarea.offsetHeight) + "px";
      }
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
          const stepType = row.stepType === "tool" ? "tool" : "command";
          const toolName = String(row.toolName || "").trim();
          return {
            name: row.name,
            runner: row.runner || undefined,
            cwd: row.cwd || undefined,
            command: stepType === "command" ? (row.command || undefined) : undefined,
            tool: stepType === "tool" && toolName
              ? {
                name: toolName,
                input: parseToolInputText(row.toolInput)
              }
              : undefined,
            promptAppend: row.promptAppend || undefined,
            retryCount: row.retryCount,
            retryBackoffMs: row.retryBackoffMs,
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
      try {
        if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.setItem === "function") {
          localStorage.setItem(STORAGE_LAST_SUCCESS, JSON.stringify(body));
        }
      } catch (error) {
        if (window && window.console && typeof window.console.warn === "function") {
          window.console.warn("[loop-ui] unable to cache last success", error);
        }
      }
    }

    function taskRuntimeState(taskId) {
      return {
        isRunning: cachedLiveRuns.some(function (x) { return x && x.taskId === taskId; }),
        isQueued: cachedQueue.some(function (x) { return x && x.taskId === taskId; })
      };
    }

    function normalizeTaskRuntimeState(runtimeState) {
      if (runtimeState === "running") {
        return { isRunning: true, isQueued: false, key: "running" };
      }
      if (runtimeState === "queued") {
        return { isRunning: false, isQueued: true, key: "queued" };
      }
      if (runtimeState && typeof runtimeState === "object") {
        const isRunning = runtimeState.isRunning === true;
        const isQueued = runtimeState.isQueued === true;
        const key = isRunning
          ? (isQueued ? "running-queued" : "running")
          : (isQueued ? "queued" : "idle");
        return { isRunning: isRunning, isQueued: isQueued, key: key };
      }
      return { isRunning: false, isQueued: false, key: "idle" };
    }

    function taskRuntimeUi(item, runtimeState) {
      const runtime = normalizeTaskRuntimeState(runtimeState);
      const isRunning = runtime.isRunning;
      const isQueued = runtime.isQueued;
      const isActive = isRunning || isQueued;
      const runtimeTag = isRunning
        ? ('<span class="tag running">运行中</span>' + (isQueued ? '<span class="tag queued">已排重启</span>' : ""))
        : (isQueued ? '<span class="tag queued">排队中</span>' : '<span class="tag">空闲</span>');
      const runLabel = isRunning
        ? (isQueued ? "↻ 保留最新重启" : "↻ 重启执行")
        : (isQueued ? "↻ 重新触发" : (item.enabled ? "▶ 立即执行" : "▶ 手动执行"));
      const runClass = isActive ? "warn" : "";
      const runTitle = isRunning
        ? (isQueued
          ? "当前轮结束后会按最新请求重启；再次点击只保留最新一次请求"
          : "停止当前执行并立即重启一轮")
        : (isQueued
          ? "将队列中的同任务请求合并为最新一次触发"
          : "立即触发一次执行，不等待定时器");
      const stopLabel = isRunning
        ? (isQueued ? "停止并清空排队" : "停止本轮")
        : "取消排队";
      const stopTitle = isRunning
        ? (isQueued
          ? "停止当前轮次，并移除已排队的重启请求"
          : "仅停止当前轮次，不影响任务配置")
        : "从等待队列中移除此任务请求";
      const showStopButton = isActive;
      const showGracefulStopButton = isRunning && item.workflowLoopFromStart;
      const gracefulStopTitle = "仅在从头循环模式可用：当前轮全部步骤结束后停止";
      const toggleLabel = item.enabled
        ? (isActive ? "⏹ 停用(并停止)" : "⏸ 停用")
        : (isActive ? "♻ 重新启用调度" : "✅ 启用");
      const toggleClass = item.enabled ? "warn" : "success";
      const toggleTitle = item.enabled
        ? (isActive
          ? "停用并尝试终止当前运行/排队，后续不再自动调度"
          : "停用后仅保留手动触发，不再自动调度")
        : "重新开启自动调度；不会中断当前已在运行/排队的请求";
      const runtimeHint = isRunning
        ? (item.enabled
          ? (isQueued
            ? "正在运行：已收到最新一次重启请求。可继续合并为最新请求，或停止当前轮并清空排队；编辑暂不可用。"
            : "正在运行：可重启本轮、停止本轮，编辑暂不可用。")
          : "正在运行（已停用）：当前轮次会继续，后续自动调度已关闭；可随时重新启用。")
        : (isQueued
          ? (item.enabled
            ? "正在排队：可重新触发（合并请求）或取消排队。"
            : "正在排队（已停用）：本次请求仍在队列，后续自动调度已关闭；可取消排队或重新启用调度。")
          : (item.enabled ? "空闲且已启用：可立即执行或编辑。" : "空闲且已停用：可手动执行，或先启用定时任务。"));
      const actionNote = isRunning
        ? (isQueued
          ? "按钮说明：保留最新重启=继续把后续触发合并为最新一次；停止并清空排队=终止当前轮并移除待执行重启；停用(并停止)=关闭后续自动调度。"
          : "按钮说明：重启执行=中断并立刻重跑；停止本轮=终止当前轮；停用(并停止)=关闭后续自动调度。")
        : (isQueued
          ? "按钮说明：重新触发=合并为最新请求；取消排队=从队列移除；重新启用调度=恢复后续自动触发。"
          : (item.enabled
            ? "按钮说明：立即执行=马上跑一轮；停用=仅关闭后续自动调度；编辑=修改任务配置。"
            : "按钮说明：手动执行=只执行当前一次；启用=恢复自动调度；编辑=修改任务配置。"));
      return {
        isRunning,
        isQueued,
        isActive,
        runtimeTag,
        runLabel,
        runClass,
        runTitle,
        stopLabel,
        stopTitle,
        showStopButton,
        showGracefulStopButton,
        gracefulStopTitle,
        toggleLabel,
        toggleClass,
        toggleTitle,
        actionNote,
        runtimeHint
      };
    }

    function toggleResultMessage(taskEnabledBefore, runtimeState) {
      const runtime = normalizeTaskRuntimeState(runtimeState);
      if (taskEnabledBefore) {
        return runtime.isRunning || runtime.isQueued
          ? "任务已停止并停用"
          : "任务已停用";
      }
      if (runtime.isRunning) {
        if (runtime.isQueued) {
          return "任务已重新启用：当前轮次继续，已排队的下一轮会保留，后续也将恢复自动调度";
        }
        return "任务已重新启用：当前轮次继续，后续将恢复自动调度";
      }
      if (runtime.isQueued) {
        return "任务已重新启用：当前请求仍在队列，后续将恢复自动调度";
      }
      return "任务已启用";
    }

    function taskDetailStaticSignature(item) {
      return JSON.stringify({
        name: item.name || "",
        runner: item.runner || "",
        intervalSec: item.intervalSec || 0,
        prompt: item.prompt || "",
        cwd: item.cwd || "",
        command: item.command || "",
        workflow: Array.isArray(item.workflow) ? item.workflow : [],
        workflowSteps: Array.isArray(item.workflowSteps) ? item.workflowSteps : [],
        workflowLoopFromStart: item.workflowLoopFromStart === true,
        workflowSharedSession: item.workflowSharedSession !== false,
        workflowFullAccess: item.workflowFullAccess === true
      });
    }

    function taskDetailTagsHtml(item, detail) {
      return detail.enabledTag
        + detail.runtimeUiItem.runtimeTag
        + '<span class="tag">' + esc(item.runner) + '</span>'
        + '<span class="tag">' + esc(item.intervalSec) + 's</span>'
        + (detail.usesCodexWorkflow ? ('<span class="tag">' + esc(detail.sessionText) + '</span>') : '')
        + (detail.usesCodexWorkflow ? ('<span class="tag' + (item.workflowFullAccess ? ' warn-risk' : '') + '">' + esc(detail.accessText) + '</span>') : '');
    }

    function taskDetailStatusHtml(detail) {
      return '<div class="action-note">' + esc(detail.runtimeUiItem.runtimeHint) + '</div>'
        + '<div class="muted" style="margin-top:8px;">' + esc(detail.checkpointText) + '</div>';
    }

    function taskDetailOverviewMetaHtml(item, detail, hasCheckpoint) {
      return '<div class="task-detail-meta-item"><b>工作目录</b><span>' + esc(item.cwd || "(默认)") + '</span></div>'
        + '<div class="task-detail-meta-item"><b>执行方式</b><span>' + esc(detail.loopText) + '</span></div>'
        + '<div class="task-detail-meta-item"><b>最近执行</b><span>' + esc(formatTime(item.lastRunAt)) + '</span></div>'
        + '<div class="task-detail-meta-item"><b>断点恢复</b><span>' + esc(hasCheckpoint ? "可恢复" : "无断点") + '</span></div>';
    }

    function taskDetailActionsHtml(detail) {
      return '<div class="action-group" data-group="primary"><div class="action-group-label">主操作</div><div class="action-group-buttons">' + detail.primaryButtons + '</div></div>'
        + '<div class="action-group" data-group="config"><div class="action-group-label">配置</div><div class="action-group-buttons">' + detail.configButtons + '</div></div>'
        + '<div class="action-group" data-group="danger"><div class="action-group-label">风险操作</div><div class="action-group-buttons">' + detail.dangerButtons + '</div></div>';
    }

    function buildTaskDetailBits(item) {
      const enabledTag = item.enabled
        ? '<span class="tag ok">启用</span>'
        : '<span class="tag error">停用</span>';
      const cmd = item.command || "(未配置命令)";
      const editLabel = editingTaskId === item.id ? "编辑中" : "编辑";
      const workflowText = Array.isArray(item.workflow) && item.workflow.length
        ? item.workflow.join(" -> ")
        : "(单阶段)";
      const stepDetail = Array.isArray(item.workflowSteps) && item.workflowSteps.length
        ? item.workflowSteps.map(function (step, index) {
          const stepName = String(step.name || "").trim() || ("步骤 " + String(index + 1));
          const stepRunner = step.runner ? String(step.runner) : item.runner;
          const toolName = step && step.tool && step.tool.name ? String(step.tool.name) : "";
          const stepCwd = step.cwd ? String(step.cwd) : "";
          const stepPrompt = step.promptAppend ? String(step.promptAppend) : "";
          const stepCommand = step.command ? String(step.command) : "";
          const retryCount = Number(step.retryCount);
          const retryText = retryCount > 0
            ? String(retryCount) + " 次 / " + String(step.retryBackoffMs || 1200) + "ms"
            : "不重试";
          const errorText = step.continueOnError ? "失败后继续" : "失败即停止";
          const metaParts = [
            "runner: " + stepRunner,
            step.enabled === false ? "已禁用" : "已启用",
            "重试: " + retryText,
            "错误策略: " + errorText
          ];
          if (toolName) metaParts.push("tool: " + toolName);
          if (stepCwd) metaParts.push("cwd: " + stepCwd);
          const bodyParts = [];
          if (stepPrompt) {
            bodyParts.push('<div class="wf-step-card-field"><b>步骤 Prompt</b><span>' + esc(stepPrompt) + '</span></div>');
          }
          if (stepName || stepPrompt) {
            bodyParts.push('<div class="wf-step-card-field"><b>实际拼接 Prompt</b><span>' + esc(buildWorkflowStepPromptPreview(item.prompt || "", step)) + '</span></div>');
          }
          if (stepCommand) {
            bodyParts.push('<div class="wf-step-card-field"><b>覆盖命令</b><span>' + esc(stepCommand) + '</span></div>');
          }
          if (toolName && step.tool && Object.prototype.hasOwnProperty.call(step.tool, "input")) {
            let toolInputText = "";
            if (typeof step.tool.input === "string") {
              toolInputText = step.tool.input;
            } else {
              try {
                toolInputText = JSON.stringify(step.tool.input, null, 2);
              } catch (error) {
                toolInputText = String(step.tool.input || "");
              }
            }
            if (toolInputText) {
              bodyParts.push('<div class="wf-step-card-field"><b>工具输入</b><span>' + esc(toolInputText) + '</span></div>');
            }
          }
          return '<div class="wf-step-card">'
            + '<div class="wf-step-card-head">'
            + '<div class="wf-step-card-title">步骤 ' + String(index + 1) + ' · ' + esc(stepName) + '</div>'
            + '</div>'
            + '<div class="wf-step-card-meta">' + esc(metaParts.join(" | ")) + '</div>'
            + (bodyParts.length ? '<div class="wf-step-card-body">' + bodyParts.join("") + '</div>' : "")
            + '</div>';
        }).join("")
        : "";
      const loopText = item.workflowLoopFromStart ? "从头循环" : "单轮";
      const usesCodexWorkflow = hasCodexWorkflowConfig(item.runner, item.workflowSteps);
      const sessionText = item.workflowSharedSession === false ? "Codex 每步新对话" : "Codex 复用对话";
      const accessText = item.workflowFullAccess ? "Full Access" : "标准";
      const runtimeState = taskRuntimeState(item.id);
      const runtimeUiItem = taskRuntimeUi(item, runtimeState);
      const checkpointStepIndex = Number(item.workflowResumeStepIndex);
      const hasCheckpoint = Number.isFinite(checkpointStepIndex) && checkpointStepIndex >= 1;
      const checkpointText = hasCheckpoint
        ? ("断点: 第 " + checkpointStepIndex + " 步 | 更新时间: " + formatTime(item.workflowResumeUpdatedAt) + (item.workflowResumeReason ? (" | 原因: " + item.workflowResumeReason) : ""))
        : "断点: 无";
      const editDisabled = runtimeUiItem.isActive ? ' disabled title="任务运行/排队中，先停止后再编辑"' : "";
      const deleteLabel = runtimeUiItem.isActive ? "删除(并终止)" : "删除";
      const deleteClass = runtimeUiItem.isActive ? "warn" : "danger";
      const editTitle = runtimeUiItem.isActive
        ? "任务运行/排队中，编辑已禁用"
        : "复制到上方完整表单并进入编辑模式";
      const cloneTitle = "将当前任务配置复制到上方表单，便于快速新建";
      const resumeTitle = "从保存的失败断点步骤继续执行";
      const deleteTitle = runtimeUiItem.isActive
        ? "删除任务并终止当前运行/排队"
        : "永久删除任务配置";
      const runButton = '<button class="' + runtimeUiItem.runClass + '" data-act="run" data-id="' + esc(item.id) + '" title="' + esc(runtimeUiItem.runTitle) + '">' + runtimeUiItem.runLabel + '</button>';
      const resumeButtonHtml = (!runtimeUiItem.isActive && hasCheckpoint)
        ? ('<button class="info" data-act="resume" data-id="' + esc(item.id) + '" title="' + esc(resumeTitle) + '">↺ 断点恢复</button>')
        : "";
      const stopButtonHtml = runtimeUiItem.showStopButton
        ? ('<button class="warn" data-act="stop" data-id="' + esc(item.id) + '" title="' + esc(runtimeUiItem.stopTitle) + '">' + esc(runtimeUiItem.isRunning ? ("⏹ " + runtimeUiItem.stopLabel) : ("✖ " + runtimeUiItem.stopLabel)) + '</button>')
        : "";
      const gracefulStopButtonHtml = runtimeUiItem.showGracefulStopButton
        ? ('<button class="neutral" data-act="stopAfterRound" data-id="' + esc(item.id) + '" title="' + esc(runtimeUiItem.gracefulStopTitle) + '">⏭ 本轮完成后停止</button>')
        : "";
      const primaryButtons = [
        runButton,
        resumeButtonHtml,
        stopButtonHtml,
        gracefulStopButtonHtml
      ].filter(Boolean).join("");
      const configButtons = [
        '<button class="ghost" data-act="edit" data-id="' + esc(item.id) + '" title="' + esc(editTitle) + '"' + editDisabled + '>✎ ' + editLabel + '</button>',
        '<button class="neutral" data-act="clone" data-id="' + esc(item.id) + '" title="' + esc(cloneTitle) + '">⎘ 复制到表单</button>'
      ].join("");
      const dangerButtons = [
        '<button class="' + runtimeUiItem.toggleClass + '" data-act="toggle" data-id="' + esc(item.id) + '" title="' + esc(runtimeUiItem.toggleTitle) + '">' + runtimeUiItem.toggleLabel + '</button>',
        '<button class="' + deleteClass + '" data-act="delete" data-id="' + esc(item.id) + '" title="' + esc(deleteTitle) + '">🗑 ' + deleteLabel + '</button>'
      ].join("");
      return {
        enabledTag: enabledTag,
        cmd: cmd,
        workflowText: workflowText,
        stepDetail: stepDetail,
        usesCodexWorkflow: usesCodexWorkflow,
        loopText: loopText,
        sessionText: sessionText,
        accessText: accessText,
        runtimeUiItem: runtimeUiItem,
        checkpointText: checkpointText,
        primaryButtons: primaryButtons,
        configButtons: configButtons,
        dangerButtons: dangerButtons
      };
    }

    function taskRow(item) {
      const detail = buildTaskDetailBits(item);
      const runtimeClass = detail.runtimeUiItem.isRunning
        ? " is-running"
        : (detail.runtimeUiItem.isQueued ? " is-queued" : (item.enabled ? "" : " is-disabled"));
      return '<div class="task-item' + runtimeClass + '" data-task-card="true" data-id="' + esc(item.id) + '" tabindex="0" role="button" aria-label="查看任务详情：' + esc(item.name) + '">'
        + '<div class="task-card-head">'
        + '<h3 class="task-card-title">' + esc(item.name) + '</h3>'
        + '<div class="task-card-tags">'
        + detail.enabledTag
        + detail.runtimeUiItem.runtimeTag
        + '</div>'
        + '</div>'
        + '<div class="task-card-summary">'
        + '<div class="task-card-cwd muted">' + esc(item.cwd || "(默认)") + '</div>'
        + '</div>'
        + '</div>';
    }

    function taskDetailContent(item) {
      const detail = buildTaskDetailBits(item);
      const hasCheckpoint = detail.checkpointText !== "断点: 无";
      return '<div class="task-detail-head">'
        + '<div class="task-detail-titlebar">'
        + '<div>'
        + '<div class="section-kicker">Task Detail</div>'
        + '<h2 id="taskDetailTitle" class="task-detail-title">' + esc(item.name) + '</h2>'
        + '</div>'
        + '<button class="ghost task-detail-close" data-act="closeDetail">关闭</button>'
        + '</div>'
        + '<div id="taskDetailTags" class="task-card-tags">' + taskDetailTagsHtml(item, detail) + '</div>'
        + '</div>'
        + '<div class="task-detail-grid">'
        + '<div class="task-detail-main">'
        + '<div class="task-detail-panel"><h3>Prompt / Command</h3><pre>prompt: ' + esc(item.prompt || "") + '\\ncommand: ' + esc(detail.cmd) + '</pre></div>'
        + '<div class="task-detail-panel"><h3>流程</h3>'
        + (detail.stepDetail ? '<div class="wf-step-list">' + detail.stepDetail + '</div>' : '<pre>workflow: ' + esc(detail.workflowText) + '</pre>')
        + '</div>'
        + '<div id="taskDetailStatusPanel" class="task-detail-panel"><h3>状态</h3>' + taskDetailStatusHtml(detail) + '</div>'
        + '</div>'
        + '<div class="task-detail-side">'
        + '<div class="task-detail-panel"><h3>概览</h3>'
        + '<div id="taskDetailOverviewMeta" class="task-detail-meta">' + taskDetailOverviewMetaHtml(item, detail, hasCheckpoint) + '</div></div>'
        + '<div id="taskDetailActions" class="task-detail-actions">' + taskDetailActionsHtml(detail) + '</div>'
        + '</div>'
        + '</div>';
    }

    function updateOpenTaskDetail(item) {
      if (!item || !taskDetailOverlayEl || !taskDetailBodyEl) {
        return;
      }
      const nextSignature = taskDetailStaticSignature(item);
      if (renderedTaskDetailTaskId !== item.id || renderedTaskDetailSignature !== nextSignature) {
        openTaskDetail(item.id, true);
        return;
      }
      const detail = buildTaskDetailBits(item);
      const hasCheckpoint = detail.checkpointText !== "断点: 无";
      const titleEl = document.getElementById("taskDetailTitle");
      const tagsEl = document.getElementById("taskDetailTags");
      const statusEl = document.getElementById("taskDetailStatusPanel");
      const overviewEl = document.getElementById("taskDetailOverviewMeta");
      const actionsEl = document.getElementById("taskDetailActions");
      if (titleEl) {
        titleEl.textContent = item.name || "";
      }
      if (tagsEl) {
        tagsEl.innerHTML = taskDetailTagsHtml(item, detail);
      }
      if (statusEl) {
        statusEl.innerHTML = '<h3>状态</h3>' + taskDetailStatusHtml(detail);
      }
      if (overviewEl) {
        overviewEl.innerHTML = taskDetailOverviewMetaHtml(item, detail, hasCheckpoint);
      }
      if (actionsEl) {
        actionsEl.innerHTML = taskDetailActionsHtml(detail);
      }
    }

    function openTaskDetail(taskId) {
      const item = cachedTasks.find(function (task) { return task.id === taskId; });
      if (!item || !taskDetailOverlayEl || !taskDetailBodyEl) {
        return;
      }
      selectedTaskId = taskId;
      const forceFullRender = arguments.length > 1 && arguments[1] === true;
      const nextSignature = taskDetailStaticSignature(item);
      if (!forceFullRender
        && taskDetailOverlayEl.classList.contains("open")
        && !editingInModal
        && renderedTaskDetailTaskId === taskId
        && renderedTaskDetailSignature === nextSignature) {
        updateOpenTaskDetail(item);
        return;
      }
      taskDetailBodyEl.innerHTML = taskDetailContent(item);
      renderedTaskDetailTaskId = taskId;
      renderedTaskDetailSignature = nextSignature;
      taskDetailOverlayEl.classList.add("open");
      taskDetailOverlayEl.setAttribute("aria-hidden", "false");
    }

    function closeTaskDetail() {
      if (!taskDetailOverlayEl || !taskDetailBodyEl) {
        return;
      }
      selectedTaskId = null;
      editingInModal = false;
      renderedTaskDetailTaskId = null;
      renderedTaskDetailSignature = "";
      taskDetailOverlayEl.classList.remove("open");
      taskDetailOverlayEl.setAttribute("aria-hidden", "true");
      taskDetailBodyEl.innerHTML = "";
    }

    function focusTaskComposer() {
      const nameInput = document.getElementById("name");
      if (taskFormGridEl && typeof taskFormGridEl.scrollIntoView === "function") {
        taskFormGridEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (nameInput && typeof nameInput.focus === "function") {
        nameInput.focus();
      }
    }

    function taskDetailEditContent(item) {
      const isWorkflow = hasWorkflowDefinition(item);
      const modeValue = isWorkflow ? "workflow" : "command";
      const cmd = item.command || "";
      const loopValue = item.workflowLoopFromStart ? "true" : "false";
      const sessionValue = item.workflowSharedSession === false ? "false" : "true";
      const accessValue = item.workflowFullAccess ? "true" : "false";
      let workflowFieldsHtml = "";
      if (isWorkflow) {
        workflowFieldsHtml = ''
          + '<div class="edit-row"><label>Workflow 执行方式</label>'
          + '<select id="modalWorkflowLoop">'
          + '<option value="false"' + (loopValue === "false" ? ' selected' : '') + '>单轮执行（一次）</option>'
          + '<option value="true"' + (loopValue === "true" ? ' selected' : '') + '>从头循环</option>'
          + '</select></div>'
          + '<div class="edit-row"><label>Codex 上下文复用</label>'
          + '<select id="modalWorkflowSession">'
          + '<option value="true"' + (sessionValue === "true" ? ' selected' : '') + '>复用同一条 Codex 对话</option>'
          + '<option value="false"' + (sessionValue === "false" ? ' selected' : '') + '>每步新开 Codex 对话</option>'
          + '</select></div>'
          + '<div class="edit-row"><label>Codex 权限模式</label>'
          + '<select id="modalWorkflowAccess">'
          + '<option value="false"' + (accessValue === "false" ? ' selected' : '') + '>标准（推荐）</option>'
          + '<option value="true"' + (accessValue === "true" ? ' selected' : '') + '>Full Access（危险）</option>'
          + '</select></div>';
      }
      const detail = buildTaskDetailBits(item);
      const workflowStepsJson = Array.isArray(item.workflowSteps) && item.workflowSteps.length
        ? JSON.stringify(item.workflowSteps, null, 2)
        : "[]";
      const stepEditHtml = isWorkflow
        ? '<div class="edit-row"><label>Workflow 步骤配置（JSON 格式）</label><textarea id="modalWorkflowSteps" rows="10" style="font-family: monospace; font-size: 12px;">' + esc(workflowStepsJson) + '</textarea><div class="muted" style="margin-top:4px;">编辑 JSON 数组来修改步骤配置。留空 [] 表示无步骤。</div></div>'
        : "";
      return '<div class="task-detail-head">'
        + '<div class="task-detail-titlebar">'
        + '<div>'
        + '<div class="section-kicker">Edit Task</div>'
        + '<h2 class="task-detail-title">编辑：' + esc(item.name) + '</h2>'
        + '</div>'
        + '<button class="ghost task-detail-close" data-act="closeDetail">关闭</button>'
        + '</div></div>'
        + '<div class="task-edit-form">'
        + '<div class="edit-grid">'
        + '<div class="edit-row"><label>任务名称</label><input id="modalName" value="' + esc(item.name) + '" /></div>'
        + '<div class="edit-row"><label>Runner</label>'
        + '<select id="modalRunner">'
        + '<option value="custom"' + (item.runner === "custom" ? ' selected' : '') + '>custom</option>'
        + '<option value="codex"' + (item.runner === "codex" ? ' selected' : '') + '>codex</option>'
        + '<option value="claude_code"' + (item.runner === "claude_code" ? ' selected' : '') + '>claude_code</option>'
        + '<option value="openai"' + (item.runner === "openai" ? ' selected' : '') + '>openai</option>'
        + '<option value="anthropic"' + (item.runner === "anthropic" ? ' selected' : '') + '>anthropic</option>'
        + '</select></div>'
        + '<div class="edit-row"><label>循环间隔(秒)</label><input id="modalInterval" type="number" min="5" value="' + esc(String(item.intervalSec || 300)) + '" /></div>'
        + '<div class="edit-row"><label>执行模式</label>'
        + '<select id="modalMode">'
        + '<option value="command"' + (modeValue === "command" ? ' selected' : '') + '>自定义命令模式</option>'
        + '<option value="workflow"' + (modeValue === "workflow" ? ' selected' : '') + '>多步骤 Workflow 模式</option>'
        + '</select></div>'
        + '</div>'
        + '<div class="edit-row"><label>工作目录 / 文件路径</label><input id="modalCwd" value="' + esc(item.cwd || "") + '" placeholder="例如：/path/project" /></div>'
        + '<div class="edit-row"><label>命令（含 {prompt} 占位）</label><input id="modalCommand" value="' + esc(cmd) + '" placeholder="例如：my-cli run &quot;{prompt}&quot;" /></div>'
        + workflowFieldsHtml
        + '<div class="edit-row"><label>Prompt</label><textarea id="modalPrompt">' + esc(item.prompt || "") + '</textarea></div>'
        + stepEditHtml
        + '<div class="task-edit-actions">'
        + '<button id="modalSaveBtn" data-act="modalSave">保存修改</button>'
        + '<button class="ghost" data-act="closeDetail">取消</button>'
        + '</div>'
        + '</div>';
    }

    function openTaskEdit(taskId) {
      const item = cachedTasks.find(function (task) { return task.id === taskId; });
      if (!item || !taskDetailOverlayEl || !taskDetailBodyEl) {
        return;
      }
      selectedTaskId = taskId;
      editingInModal = true;
      renderedTaskDetailTaskId = taskId;
      renderedTaskDetailSignature = "";
      taskDetailBodyEl.innerHTML = taskDetailEditContent(item);
      taskDetailOverlayEl.classList.add("open");
      taskDetailOverlayEl.setAttribute("aria-hidden", "false");
      var nameInput = document.getElementById("modalName");
      if (nameInput) nameInput.focus();

      // Add mode change listener to show/hide workflow fields
      var modeEl = document.getElementById("modalMode");
      if (modeEl) {
        modeEl.addEventListener("change", function() {
          // Re-render the edit form with updated mode
          var currentItem = cachedTasks.find(function (task) { return task.id === taskId; });
          if (currentItem) {
            // Preserve current form values
            var formData = {
              name: document.getElementById("modalName") ? document.getElementById("modalName").value : currentItem.name,
              runner: document.getElementById("modalRunner") ? document.getElementById("modalRunner").value : currentItem.runner,
              intervalSec: document.getElementById("modalInterval") ? document.getElementById("modalInterval").value : currentItem.intervalSec,
              cwd: document.getElementById("modalCwd") ? document.getElementById("modalCwd").value : currentItem.cwd,
              command: document.getElementById("modalCommand") ? document.getElementById("modalCommand").value : currentItem.command,
              prompt: document.getElementById("modalPrompt") ? document.getElementById("modalPrompt").value : currentItem.prompt
            };
            // Create temporary item with form values
            var tempItem = Object.assign({}, currentItem, formData);
            // Override workflow detection based on selected mode
            if (modeEl.value === "workflow") {
              if (!tempItem.workflowSteps || tempItem.workflowSteps.length === 0) {
                tempItem.workflowSteps = [{ name: "步骤 1", enabled: true }];
              }
            }
            taskDetailBodyEl.innerHTML = taskDetailEditContent(tempItem);
            // Re-attach the change listener
            var newModeEl = document.getElementById("modalMode");
            if (newModeEl) {
              newModeEl.addEventListener("change", arguments.callee);
            }
          }
        });
      }
    }

    async function saveTaskFromModal() {
      if (!selectedTaskId) return;
      var nameEl = document.getElementById("modalName");
      var runnerEl = document.getElementById("modalRunner");
      var intervalEl = document.getElementById("modalInterval");
      var cwdEl = document.getElementById("modalCwd");
      var commandEl = document.getElementById("modalCommand");
      var promptEl = document.getElementById("modalPrompt");
      var modeEl = document.getElementById("modalMode");
      var loopEl = document.getElementById("modalWorkflowLoop");
      var sessionEl = document.getElementById("modalWorkflowSession");
      var accessEl = document.getElementById("modalWorkflowAccess");
      var name = nameEl ? nameEl.value.trim() : "";
      var prompt = promptEl ? promptEl.value.trim() : "";
      if (!name || !prompt) {
        msg("任务名称和 Prompt 不能为空。", true);
        return;
      }
      var intervalSec = intervalEl ? Number(intervalEl.value) : 300;
      if (!Number.isFinite(intervalSec) || intervalSec < 5) {
        msg("循环间隔需 >= 5 秒。", true);
        return;
      }
      var isWorkflow = modeEl ? modeEl.value === "workflow" : false;
      var originalItem = cachedTasks.find(function (t) { return t.id === selectedTaskId; });
      var workflowSteps = [];
      if (isWorkflow) {
        var stepsEl = document.getElementById("modalWorkflowSteps");
        if (stepsEl) {
          var stepsText = stepsEl.value.trim();
          if (stepsText) {
            try {
              workflowSteps = JSON.parse(stepsText);
              if (!Array.isArray(workflowSteps)) {
                msg("Workflow 步骤必须是 JSON 数组格式。", true);
                return;
              }
            } catch (parseError) {
              msg("Workflow 步骤 JSON 格式错误：" + (parseError && parseError.message ? parseError.message : String(parseError)), true);
              return;
            }
          }
        } else {
          workflowSteps = originalItem && Array.isArray(originalItem.workflowSteps) ? originalItem.workflowSteps : [];
        }
      }
      var body = {
        name: name,
        runner: runnerEl ? String(runnerEl.value || "custom") : "custom",
        prompt: prompt,
        intervalSec: intervalSec,
        cwd: cwdEl ? (cwdEl.value.trim() || null) : null,
        command: commandEl ? (commandEl.value.trim() || null) : null,
        enabled: originalItem ? originalItem.enabled !== false : true,
        workflow: "",
        workflowSteps: workflowSteps,
        workflowCarryContext: originalItem ? !!originalItem.workflowCarryContext : false,
        workflowLoopFromStart: loopEl ? loopEl.value === "true" : (originalItem ? !!originalItem.workflowLoopFromStart : false),
        workflowSharedSession: sessionEl ? sessionEl.value !== "false" : (originalItem ? originalItem.workflowSharedSession !== false : true),
        workflowFullAccess: accessEl ? accessEl.value === "true" : (originalItem ? !!originalItem.workflowFullAccess : false)
      };
      try {
        await api("/__loop/api/tasks/" + encodeURIComponent(selectedTaskId), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        msg("任务更新成功", false);
        closeTaskDetail();
        await refresh();
      } catch (error) {
        msg(error && error.message ? error.message : String(error), true);
      }
    }

    function fillFormFromTask(item) {
      document.getElementById("name").value = item.name || "";
      document.getElementById("runner").value = item && item.runner ? String(item.runner) : "custom";
      document.getElementById("prompt").value = item.prompt || "";
      document.getElementById("intervalSec").value = String(item.intervalSec || 300);
      modeDraft.cwd = item.cwd || "";
      modeDraft.command = item.command || "";
      modeDraft.workflowSteps = Array.isArray(item.workflowSteps) && item.workflowSteps.length
        ? item.workflowSteps.map(normalizeStep)
        : (Array.isArray(item.workflow) ? item.workflow.map(function (name) { return normalizeStep({ name: name }); }) : []);
      modeDraft.workflowCarryContext = item.workflowCarryContext ? "true" : "false";
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
        queueListEl.innerHTML = '<div class="muted">当前没有排队任务。下一步：触发任务后，等待中的请求会显示在这里。</div>';
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
        insertElementAfter(document.getElementById("createBtn"), cancelBtn);
      }
      focusTaskComposer();
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
      liveRunListEl.innerHTML = cachedLiveRuns.map(liveRunRow).join("") || '<div class="muted">当前没有运行中的任务。下一步：可从任务列表手动运行已有任务。</div>';
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
      taskListEl.innerHTML = filtered.map(taskRow).join("") || '<div class="muted">当前还没有任务。下一步：先在上方填写表单并创建第一个任务。</div>';
      if (selectedTaskId && !editingInModal) {
        const selectedTask = cachedTasks.find(function (item) { return item.id === selectedTaskId; }) || null;
        if (selectedTask) {
          updateOpenTaskDetail(selectedTask);
        } else {
          closeTaskDetail();
        }
      }
      renderLiveRuns();
      runListEl.innerHTML = cachedRuns.map(runRow).join("") || '<div class="muted">当前还没有运行记录。下一步：先执行一次任务，这里才会出现历史。</div>';
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
        } catch (error) {
          reportUiError(error);
        }
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
      const workflowCarryContext = workflowEnabled
        ? parseUiBoolean(modeDraft.workflowCarryContext, false)
        : false;
      const workflowLoopFromStart = workflowEnabled
        ? ((workflowLoopFromStartEl ? workflowLoopFromStartEl.value : "false") === "true")
        : false;
      const workflowSharedSession = workflowEnabled
        ? ((workflowSharedSessionEl ? workflowSharedSessionEl.value : "true") !== "false")
        : true;
      const workflowFullAccess = workflowEnabled
        ? ((workflowFullAccessEl ? workflowFullAccessEl.value : "false") === "true")
        : false;
      const workflowSteps = workflowEnabled
        ? workflowBuilderRows.map(normalizeStep).filter(function (row) { return row.name; }).map(function (row) {
            const stepType = row.stepType === "tool" ? "tool" : "command";
            const toolName = String(row.toolName || "").trim();
            return {
              name: row.name,
              runner: row.runner || undefined,
              cwd: row.cwd || undefined,
              command: stepType === "command" ? (row.command || undefined) : undefined,
              tool: stepType === "tool" && toolName
                ? {
                  name: toolName,
                  input: parseToolInputText(row.toolInput)
                }
                : undefined,
              promptAppend: row.promptAppend || undefined,
              retryCount: row.retryCount,
              retryBackoffMs: row.retryBackoffMs,
              continueOnError: row.continueOnError,
              enabled: row.enabled
            };
          })
        : [];
      return {
        name: document.getElementById("name").value.trim(),
        runner: String(document.getElementById("runner").value || "custom"),
        prompt: document.getElementById("prompt").value.trim(),
        intervalSec: Number(document.getElementById("intervalSec").value),
        cwd: cwdInputEl ? (cwdInputEl.value.trim() || null) : null,
        command: rawCommand,
        workflow: workflowEnabled ? "" : "",
        workflowSteps: workflowSteps,
        workflowCarryContext: workflowCarryContext,
        workflowLoopFromStart: workflowLoopFromStart,
        workflowSharedSession: workflowSharedSession,
        workflowFullAccess: workflowFullAccess,
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
        pathStatusEl.textContent = "请填写工作目录或文件路径。";
        pathStatusEl.className = "notice error";
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

    async function handleTaskAction(buttonEl) {
      const act = buttonEl.getAttribute("data-act");
      const id = buttonEl.getAttribute("data-id");
      if (!act || !id) return;
      const taskItem = cachedTasks.find(function (x) { return x.id === id; }) || null;
      const runtimeState = taskRuntimeState(id);
      const runtimeInfo = normalizeTaskRuntimeState(runtimeState);
      const busyText = act === "delete"
        ? "删除中..."
        : (act === "run"
          ? (runtimeInfo.isRunning ? "重启中..." : (runtimeInfo.isQueued ? "重排中..." : "执行中..."))
          : (act === "resume"
            ? "恢复中..."
          : (act === "toggle"
            ? "切换中..."
            : ((act === "stop" || act === "stopAfterRound") ? "关闭中..." : ""))));
      return withButtonBusy(
        buttonEl,
        busyText,
        async function () {
          try {
            if (act === "run") {
              if (runtimeInfo.isRunning) {
                const ok = window.confirm(runtimeInfo.isQueued
                  ? "当前任务正在运行，且已排了下一次重启。确认继续并只保留最新一次请求吗？"
                  : "当前任务正在运行。确认停止当前执行并立即重启吗？");
                if (!ok) return;
              } else if (runtimeInfo.isQueued) {
                const ok = window.confirm("当前任务已在队列中。确认重新触发并合并为最新一次请求吗？");
                if (!ok) return;
              }
              const data = await api("/__loop/api/tasks/" + id + "/run", { method: "POST" });
              const run = data && data.item ? data.item : null;
              const actionName = runtimeInfo.isRunning
                ? (runtimeInfo.isQueued ? "保留最新重启请求" : "重启执行")
                : (runtimeInfo.isQueued ? "重新触发" : "执行");
              if (run && run.status === "success") {
                msg(actionName + "完成：成功", false);
              } else if (run) {
                const diagnosis = diagnoseRun(run);
                const reason = diagnosis || run.error || "执行失败";
                msg(actionName + "完成：失败，" + reason, true);
              } else {
                msg(actionName + "已触发，正在后台执行", false);
              }
            } else if (act === "resume") {
              if (!taskItem) {
                msg("任务不存在或已刷新", true);
                return;
              }
              if (runtimeInfo.isRunning || runtimeInfo.isQueued) {
                msg("任务正在运行/排队，请先停止后再恢复。", true);
                return;
              }
              const hasCheckpoint = Number.isFinite(Number(taskItem.workflowResumeStepIndex))
                && Number(taskItem.workflowResumeStepIndex) >= 1;
              if (!hasCheckpoint) {
                msg("当前任务没有可恢复的断点。", true);
                return;
              }
              const suggestStep = Number(taskItem.workflowResumeStepIndex);
              const raw = window.prompt("输入恢复阶段序号（留空表示使用断点阶段）", String(suggestStep));
              if (raw === null) {
                return;
              }
              const value = String(raw || "").trim();
              let payload = null;
              if (value) {
                const n = Number(value);
                if (!Number.isFinite(n) || n < 1 || Math.floor(n) !== n) {
                  msg("阶段序号必须是 >= 1 的整数。", true);
                  return;
                }
                payload = { stepIndex: n };
              }
              const data = await api("/__loop/api/tasks/" + id + "/resume", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload || {})
              });
              const run = data && data.item ? data.item : null;
              if (run && run.status === "success") {
                msg("断点恢复完成：成功", false);
              } else if (run) {
                const diagnosis = diagnoseRun(run);
                const reason = diagnosis || run.error || "恢复失败";
                msg("断点恢复完成：失败，" + reason, true);
              } else {
                msg("断点恢复已触发，正在后台执行", false);
              }
            } else if (act === "edit") {
              const item = cachedTasks.find(function (x) { return x.id === id; });
              if (!item) {
                msg("任务不存在或已刷新", true);
                return;
              }
              if (selectedTaskId === item.id) {
                closeTaskDetail();
              }
              beginEditTask(item);
              return;
            } else if (act === "clone") {
              const item = cachedTasks.find(function (x) { return x.id === id; });
              if (!item) {
                msg("任务不存在或已刷新", true);
                return;
              }
              resetFormToCreate();
              const cloned = {};
              Object.keys(item).forEach(function (key) {
                cloned[key] = item[key];
              });
              cloned.name = item.name + " (copy)";
              fillFormFromTask(cloned);
              msg("已复制到表单，可直接创建新任务", false);
              return;
            } else if (act === "toggle") {
              if (!taskItem) {
                msg("任务不存在或已刷新", true);
                return;
              }
              if (taskItem.enabled && (runtimeInfo.isRunning || runtimeInfo.isQueued)) {
                const ok = window.confirm("停用任务将先停止当前运行/排队，确认继续吗？");
                if (!ok) return;
                await api("/__loop/api/tasks/" + id + "/stop", { method: "POST" });
              }
              await api("/__loop/api/tasks/" + id + "/toggle", { method: "POST" });
              msg(toggleResultMessage(taskItem.enabled, runtimeState), false);
            } else if (act === "stop") {
              const data = await api("/__loop/api/tasks/" + id + "/stop", { method: "POST" });
              const item = data && data.item ? data.item : null;
              if (item && (item.running || item.queued > 0)) {
                if (runtimeInfo.isRunning && runtimeInfo.isQueued) {
                  msg("任务已停止本轮执行，并清空排队中的重启请求", false);
                } else {
                  msg(runtimeInfo.isQueued ? "任务已取消排队" : "任务已停止本轮执行", false);
                }
              } else {
                msg("任务当前未在运行或排队", false);
              }
            } else if (act === "stopAfterRound") {
              if (!taskItem || !taskItem.workflowLoopFromStart) {
                msg("当前任务不是从头循环模式。", true);
                return;
              }
              const data = await api("/__loop/api/tasks/" + id + "/stop-after-round", { method: "POST" });
              const item = data && data.item ? data.item : null;
              if (item && item.deferred) {
                msg("已设置：当前轮次全部完成后自动停止。", false);
              } else if (item && item.running) {
                msg("任务正在运行，但无法延迟停止，已忽略请求。", true);
              } else {
                msg("任务当前未在运行", false);
              }
            } else if (act === "delete") {
              const confirmText = runtimeInfo.isRunning || runtimeInfo.isQueued
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
              if (editingInModal && selectedTaskId === id) {
                closeTaskDetail();
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
    }

    taskListEl.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const buttonEl = closestSimple(target, "button");
      const cardEl = closestSimple(target, "[data-task-card]");
      if (cardEl instanceof HTMLElement && !(buttonEl instanceof HTMLButtonElement)) {
        const taskId = cardEl.getAttribute("data-id");
        if (taskId) {
          openTaskDetail(taskId);
        }
        return;
      }
      if (!(buttonEl instanceof HTMLButtonElement)) return;
      await handleTaskAction(buttonEl);
    });

    taskListEl.addEventListener("keydown", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const cardEl = closestSimple(target, "[data-task-card]");
      if (!(cardEl instanceof HTMLElement)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const taskId = cardEl.getAttribute("data-id");
        if (taskId) {
          openTaskDetail(taskId);
        }
      }
    });

    if (taskDetailOverlayEl) {
      taskDetailOverlayEl.addEventListener("click", function (event) {
        if (event.target === taskDetailOverlayEl) {
          closeTaskDetail();
        }
      });
    }

    if (taskDetailBodyEl) {
      taskDetailBodyEl.addEventListener("click", async function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const buttonEl = closestSimple(target, "button");
        if (!(buttonEl instanceof HTMLButtonElement)) return;
        const act = buttonEl.getAttribute("data-act");
        if (act === "closeDetail") {
          closeTaskDetail();
          return;
        }
        if (act === "modalSave") {
          void withButtonBusy(buttonEl, "保存中...", saveTaskFromModal);
          return;
        }
        await handleTaskAction(buttonEl);
      });
    }

    if (document && typeof document.addEventListener === "function") {
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && taskDetailOverlayEl && taskDetailOverlayEl.classList.contains("open")) {
          closeTaskDetail();
        }
      });
    }

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
    taskFormGridEl.addEventListener("input", function () {
      renderDraftSummary();
    });
    taskFormGridEl.addEventListener("change", function () {
      renderDraftSummary();
    });
    document.getElementById("runner").addEventListener("change", function () {
      applyDynamicVisibility();
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
    renderDraftSummary();
    void refresh();
  </script>
</body>
</html>`;
}
