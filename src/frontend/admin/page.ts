import { AppConfig } from "../../router/provider/types";
import { buildLogPageContext } from "../log/context";
import { buildRouterPageContext } from "../router/context";
import { renderAdminBody } from "./fragments";
import { LogPageModel, RouterPageModel } from "../shared/page-models";
import { WORKBENCH_LAYOUT_STYLES } from "../shared/shell";

type RenderAdminHtmlOptions = {
  section?: "combined" | "router" | "log";
};

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

export function renderAdminHtml(
  view: "all" | "openai" | "anthropic" = "all",
  initialConfig: AppConfig | null = null,
  options?: RenderAdminHtmlOptions
): string {
  const section = options?.section ?? "combined";
  const page: RouterPageModel | LogPageModel = section === "router"
    ? buildRouterPageContext()
    : buildLogPageContext(view);
  const initialConfigJson = serializeForInlineScript(initialConfig);
  // language=HTML
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.pageTitle}</title>
  <style>
    ${WORKBENCH_LAYOUT_STYLES}
    :root {
      --bg: #080808;
      --card: #171717;
      --text: #ececec;
      --muted: rgba(190, 190, 190, 0.74);
      --line: rgba(255, 255, 255, 0.09);
      --line-strong: rgba(255, 255, 255, 0.18);
      --accent: #d4d4d4;
      --accent-soft: rgba(255, 255, 255, 0.08);
      --ok: #d8d8d8;
      --warn: #bdbdbd;
      --error: #989898;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font-family: "Space Grotesk", "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
      background:
        radial-gradient(1200px 700px at -10% -10%, rgba(255, 255, 255, 0.06) 10%, transparent 70%),
        radial-gradient(900px 500px at 110% -20%, rgba(255, 255, 255, 0.04) 10%, transparent 70%),
        var(--bg);
    }
    .wrap {
      width: min(75vw, 1560px);
      margin: 14px auto 30px;
    }
    .page-shell {
      display: grid;
      gap: 18px;
      min-width: 0;
    }
    .workbench-main {
      background:
        linear-gradient(180deg, rgba(14, 14, 14, 0.98), rgba(8, 8, 8, 1)),
        #0b0b0b;
    }
    .status {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(19, 25, 22, 0.96), rgba(13, 18, 16, 0.98));
      border-radius: 18px;
      padding: 14px;
      box-shadow: 0 20px 36px rgba(0, 0, 0, 0.22);
      backdrop-filter: blur(10px);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      font-size: 12px;
      padding: 6px 10px;
      border: 1px solid var(--line);
      color: #e0e0e0;
      background: rgba(36, 36, 36, 0.92);
    }
    .badge.dot::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #9f9f9f;
    }
    .badge.ok { color: var(--ok); border-color: rgba(255, 255, 255, 0.12); background: rgba(48, 48, 48, 0.92); }
    .badge.ok.dot::before { background: var(--ok); }
    .badge.warn { color: var(--warn); border-color: rgba(255, 255, 255, 0.12); background: rgba(48, 48, 48, 0.92); }
    .badge.warn.dot::before { background: var(--warn); }
    .card {
      border: 1px solid var(--line);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(14, 14, 14, 0.98));
      padding: 20px;
      box-shadow: 0 20px 36px rgba(0, 0, 0, 0.28);
      min-width: 0;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 34px;
      letter-spacing: 0.2px;
      line-height: 1.08;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 19px;
    }
    p, .muted { margin: 0; color: var(--muted); font-size: 13px; }
    .workbench-head {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 26px;
      padding: 16px;
      background: linear-gradient(180deg, rgba(20, 20, 20, 0.96), rgba(10, 10, 10, 0.98));
      box-shadow: 0 18px 34px rgba(0, 0, 0, 0.22);
    }
    .hero-slab {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.95fr);
      gap: 20px;
      align-items: start;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 22px;
      padding: 24px;
      background:
        linear-gradient(140deg, rgba(255, 255, 255, 0.08), rgba(18, 18, 18, 0.98) 44%, rgba(10, 10, 10, 1) 82%),
        var(--card);
      box-shadow: 0 22px 46px rgba(0, 0, 0, 0.3);
    }
    .hero-copy {
      display: grid;
      gap: 14px;
    }
    .hero-kicker {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(188, 188, 188, 0.72);
    }
    .eyebrow {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.06);
      color: #ededed;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 7px 10px;
      text-transform: uppercase;
    }
    .hero-side {
      display: grid;
      gap: 14px;
      align-content: start;
    }
    .hero-status {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .hero-actions {
      display: grid;
      gap: 10px;
    }
    .hero-actions button {
      width: 100%;
      justify-content: center;
    }
    .page-message {
      min-height: 0;
      border: 1px dashed rgba(145, 153, 143, 0.22);
      border-radius: 14px;
      background: rgba(24, 29, 27, 0.76);
      padding: 12px 14px;
      color: rgba(225, 231, 221, 0.86);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .field {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: #d0d0d0;
      font-weight: 600;
    }
    input, select, textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 11px;
      padding: 9px 11px;
      font-size: 14px;
      color: var(--text);
      background: rgba(14, 14, 14, 0.9);
    }
    textarea {
      min-height: 92px;
      resize: vertical;
      font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
    }
    input:focus, select:focus, textarea:focus {
      outline: 2px solid rgba(255, 255, 255, 0.1);
      border-color: var(--accent);
    }
    .section-title {
      display: grid;
      gap: 10px;
    }
    .section-title-split {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
    .section-note {
      color: var(--muted);
      line-height: 1.65;
    }
    .wide-card {
      padding-bottom: 20px;
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
      background: rgba(20, 20, 20, 0.96);
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
      grid-template-columns: repeat(2, minmax(160px, 1fr));
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
      border: 1px solid transparent;
      border-radius: 11px;
      padding: 9px 14px;
      font-size: 14px;
      cursor: pointer;
      background: linear-gradient(180deg, #585858, #383838);
      color: #f4f4f4;
      font-weight: 700;
      transition: transform 0.08s ease, opacity 0.2s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    }
    button:hover { box-shadow: 0 10px 22px rgba(0, 0, 0, 0.32); }
    button:active { transform: translateY(1px); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .ghost {
      background: rgba(44, 44, 44, 0.92);
      border-color: rgba(255, 255, 255, 0.12);
      color: #eeeeee;
    }
    .danger {
      background: rgba(52, 52, 52, 0.92);
      border-color: rgba(255, 255, 255, 0.12);
      color: #d6d6d6;
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
    .view-switch-wrap {
      display: grid;
      gap: 6px;
      margin-top: 6px;
    }
    .view-switch-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(176, 176, 176, 0.68);
    }
    .view-switch {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
      width: fit-content;
      padding: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      background: rgba(20, 20, 20, 0.88);
    }
    .view-segment {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 88px;
      padding: 9px 12px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: rgba(198, 198, 198, 0.82);
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      text-decoration: none;
    }
    .view-segment.active {
      background: rgba(76, 76, 76, 0.7);
      border-color: rgba(255, 255, 255, 0.14);
      color: #f1f1f1;
    }
    .section-stack {
      display: grid;
      gap: 14px;
    }
    .console-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 0.62fr);
      gap: 14px;
      align-items: start;
      padding: 20px;
    }
    .console-hero-main,
    .console-hero-side {
      display: grid;
      gap: 14px;
    }
    .router-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }
    .router-main-column {
      display: grid;
      gap: 14px;
      min-width: 0;
    }
    .router-grid-tight {
      display: grid;
      grid-template-columns: repeat(2, minmax(160px, 1fr));
      gap: 10px;
      align-items: start;
    }
    .router-aside {
      display: grid;
      gap: 12px;
      align-content: start;
      min-width: 0;
    }
    .workspace-panel {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .panel-header {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .panel-header-split {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
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
      color: #9d9d9d;
    }
    .error-box {
      margin-top: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(32, 32, 32, 0.92);
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
    .log-scene,
    .log-layout {
      display: grid;
      gap: 16px;
    }
    .log-top-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) repeat(2, minmax(260px, 0.82fr));
      gap: 16px;
      align-items: stretch;
    }
    .log-top-grid > .workspace-panel {
      height: 100%;
      padding: 22px;
      border-radius: 22px;
      background:
        linear-gradient(160deg, rgba(255, 255, 255, 0.04), transparent 34%),
        linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(14, 14, 14, 0.98));
    }
    .log-top-grid > .workspace-panel .panel-header {
      min-height: 88px;
      align-content: start;
    }
    .log-main-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .log-panel {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(14, 14, 14, 0.98));
      padding: 14px;
      min-width: 0;
    }
    .log-panel-head {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }
    .log-panel-title {
      font-size: 14px;
      font-weight: 700;
      color: #f0f0f0;
    }
    .log-panel-copy {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.55;
    }
    .log-actions-grid {
      display: grid;
      gap: 14px;
      align-content: start;
      height: 100%;
    }
    .log-danger-tools {
      border: 1px dashed rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 10px 12px;
      background: rgba(20, 20, 20, 0.72);
    }
    .log-danger-tools summary {
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      user-select: none;
    }
    .log-danger-tools[open] summary {
      margin-bottom: 10px;
    }
    .log-actions-row {
      display: grid;
      gap: 14px;
      align-items: start;
    }
    .log-actions-row .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .log-actions-row .actions button {
      width: 100%;
      justify-content: center;
    }
    .log-limit-field {
      max-width: none;
    }
    .log-list-shell {
      border: 1px solid var(--line);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(14, 14, 14, 0.98));
      padding: 18px;
    }
    .log-list-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(140px, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .archive-buckets {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .archive-bucket {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px 12px;
      background: rgba(22, 22, 22, 0.92);
    }
    .archive-bucket-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }
    .archive-bucket strong {
      font-size: 13px;
      color: #f2f2f2;
    }
    .archive-bucket span {
      font-size: 11px;
      color: var(--muted);
    }
    .archive-bucket-copy {
      font-size: 12px;
      line-height: 1.6;
      color: var(--muted);
    }
    .metric-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(28, 28, 28, 0.98), rgba(18, 18, 18, 0.98));
      padding: 8px;
    }
    .metric-label {
      font-size: 11px;
      color: var(--muted);
    }
    .metric-value {
      margin-top: 4px;
      font-size: 17px;
      font-weight: 700;
      color: #f2f2f2;
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
      border-radius: 16px;
      padding: 14px;
      background: linear-gradient(180deg, rgba(25, 25, 25, 0.98), rgba(16, 16, 16, 0.98));
      cursor: pointer;
    }
    .log-item-topline {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 0;
    }
    .log-chip {
      display: inline-flex;
      align-items: center;
      padding: 5px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(40, 40, 40, 0.9);
      color: rgba(220, 220, 220, 0.82);
      font-size: 11px;
      line-height: 1;
    }
    .log-side-column {
      display: grid;
      gap: 12px;
    }
    .principle-list {
      display: grid;
      gap: 10px;
    }
    .principle-item {
      display: grid;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      background: rgba(22, 22, 22, 0.92);
    }
    .principle-item strong {
      font-size: 13px;
      color: #f1f1f1;
    }
    .principle-item span,
    .principle-item code {
      font-size: 12px;
      line-height: 1.6;
      color: var(--muted);
    }
    .log-summary {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 12px;
      line-height: 1.6;
      color: #d6d6d6;
    }
    .log-summary strong {
      display: inline-block;
      margin-right: 6px;
      color: #f0f0f0;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .pair-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
    .timeline {
      margin-top: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(20, 20, 20, 0.98), rgba(12, 12, 12, 0.98));
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
      color: #e7e7e7;
    }
    .chain-list {
      display: grid;
      gap: 6px;
      margin-bottom: 8px;
    }
    .chain-item {
      border: 1px dashed rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(16, 16, 16, 0.94);
      padding: 6px 8px;
      font-size: 12px;
      color: #dfdfdf;
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
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      background: rgba(16, 16, 16, 0.94);
      padding: 8px;
      min-width: 0;
    }
    .timeline-lane.request-lane { background: linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(10, 10, 10, 0.98)); }
    .timeline-lane.response-lane { background: linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(10, 10, 10, 0.98)); }
    .lane-title {
      font-size: 12px;
      font-weight: 700;
      color: #d8d8d8;
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
      border-left: 3px solid rgba(180, 180, 180, 0.5);
      padding: 6px 8px;
      background: rgba(16, 16, 16, 0.94);
      border-radius: 8px;
      font-size: 12px;
      margin-top: 6px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .bubble.req { border-left-color: rgba(210, 210, 210, 0.7); }
    .bubble.res { border-left-color: rgba(190, 190, 190, 0.7); }
    .bubble.system {
      border-left-color: rgba(170, 170, 170, 0.7);
      background: rgba(18, 18, 18, 0.94);
    }
    .bubble.tool {
      border-left-color: rgba(200, 200, 200, 0.7);
      background: rgba(18, 18, 18, 0.94);
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
      background: rgba(28, 28, 28, 0.94);
      color: #dddddd;
      text-transform: lowercase;
    }
    .role-tag.role-system { background: rgba(36, 36, 36, 0.94); border-color: rgba(255, 255, 255, 0.1); color: #dcdcdc; }
    .role-tag.role-assistant { background: rgba(36, 36, 36, 0.94); border-color: rgba(255, 255, 255, 0.1); color: #e2e2e2; }
    .role-tag.role-user { background: rgba(36, 36, 36, 0.94); border-color: rgba(255, 255, 255, 0.1); color: #f0f0f0; }
    .role-tag.role-tool { background: rgba(36, 36, 36, 0.94); border-color: rgba(255, 255, 255, 0.1); color: #d8d8d8; }
    .toolcall-list {
      margin-top: 8px;
      display: grid;
      gap: 6px;
    }
    .toolcall-item {
      border: 1px dashed rgba(255, 255, 255, 0.1);
      background: linear-gradient(180deg, rgba(20, 20, 20, 0.96), rgba(12, 12, 12, 0.98));
      border-radius: 9px;
      padding: 8px;
      font-size: 12px;
      color: #dddddd;
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
      border: 1px solid rgba(32, 26, 18, 0.08);
      border-radius: 8px;
      background: rgba(252, 247, 241, 0.96);
      color: #251d15;
      padding: 8px;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .log-empty {
      color: rgba(82, 68, 50, 0.72);
      font-size: 13px;
      line-height: 1.7;
      padding: 10px 2px;
    }
    .pill-ok, .pill-err, .pill-pending {
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      border: 1px solid transparent;
    }
    .pill-ok,
    .pill-err,
    .pill-pending { color: #eeeeee; background: rgba(48, 48, 48, 0.92); border-color: rgba(255, 255, 255, 0.12); }
    .link-btn {
      border: 1px solid var(--line);
      background: rgba(42, 42, 42, 0.92);
      color: #ececec;
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 12px;
    }
    .modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.66);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 18px;
    }
    .modal.open { display: flex; }
    .modal-card {
      width: min(1440px, calc(100vw - 36px));
      height: min(920px, calc(100vh - 36px));
      border-radius: 14px;
      border: 1px solid var(--line);
      background: #fff;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.2);
      padding: 14px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .modal-subtitle {
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    .modal-summary {
      margin-bottom: 10px;
      flex: 0 0 auto;
    }
    .detail-grid {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
    }
    .detail-pane {
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(26, 26, 26, 0.98), rgba(14, 14, 14, 0.98));
      overflow: hidden;
    }
    .detail-pane-head {
      padding: 12px 12px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(28, 28, 28, 0.9);
      flex: 0 0 auto;
    }
    .detail-pane-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }
    .detail-pane-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .detail-pane-title strong {
      font-size: 14px;
      color: #f1f1f1;
    }
    .detail-pane-meta {
      font-size: 12px;
      color: var(--muted);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .detail-pane-body {
      flex: 1 1 auto;
      min-height: 0;
      padding: 12px;
      overflow: auto;
      background: rgba(14, 14, 14, 0.96);
    }
    .summary-card {
      margin-bottom: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(26, 26, 26, 0.98), rgba(18, 18, 18, 0.98));
      padding: 10px 12px;
    }
    .summary-card-head {
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #f0f0f0;
    }
    .summary-card-body {
      font-size: 14px;
      color: #d8d8d8;
      line-height: 1.75;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      max-height: 180px;
      overflow: auto;
    }
    .json-pre {
      margin: 0;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(252, 247, 241, 0.98);
      color: #251d15;
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
      color: #d2d2d2;
      padding: 0 4px 0 0;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      border-radius: 4px;
    }
    .json-toggle:hover { background: rgba(255, 255, 255, 0.1); }
    .json-key { color: #d6d6d6; }
    .json-str { color: #efefef; }
    .json-num { color: #cfcfcf; }
    .json-bool { color: #bcbcbc; }
    .json-null { color: #9f9f9f; }
    .json-muted { color: #8c8c8c; }
    .json-pre.collapsed {
      max-height: 220px;
    }
    .json-empty {
      border: 1px dashed rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: rgba(20, 20, 20, 0.98);
      padding: 14px;
      font-size: 13px;
      color: #a9a9a9;
    }
    /* Final gallery pass so router/log align with the warm ivory shell used site-wide. */
    .console-split {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.75fr);
      gap: 12px;
      align-items: stretch;
    }
    .stack-card {
      display: grid;
      gap: 12px;
    }
    .mini-card {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 16px;
      background: linear-gradient(180deg, rgba(23, 23, 23, 0.96), rgba(13, 13, 13, 0.97));
      box-shadow: 0 20px 38px rgba(0, 0, 0, 0.22);
      min-width: 0;
    }
    .mini-card-accent {
      border-color: rgba(255, 255, 255, 0.14);
      background:
        linear-gradient(180deg, rgba(36, 36, 36, 0.98), rgba(18, 18, 18, 0.97)),
        rgba(23, 23, 23, 0.96);
    }
    .mini-kicker {
      display: inline-flex;
      margin-bottom: 10px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(180, 180, 180, 0.68);
    }
    .mini-card strong {
      display: block;
      font-size: 22px;
      line-height: 1;
      letter-spacing: -0.04em;
      color: #f1f1f1;
    }
    .mini-card p {
      margin-top: 10px;
    }
    .hero-heading {
      display: grid;
      gap: 10px;
    }
    .hero-principles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .hero-principle {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 12px 14px;
      background: rgba(18, 18, 18, 0.84);
    }
    .hero-principle strong {
      display: block;
      font-size: 13px;
      color: #f0f0f0;
    }
    .hero-principle span {
      display: block;
      margin-top: 6px;
      font-size: 12px;
      line-height: 1.6;
      color: rgba(205, 205, 205, 0.72);
    }
    .hero-card {
      display: grid;
      gap: 12px;
      align-content: start;
    }
    .side-panel {
      position: sticky;
      top: 18px;
    }
    .principle-list.compact {
      gap: 8px;
    }
    @media (max-width: 980px) {
      .wrap {
        width: calc(100vw - 16px);
      }
      .console-hero,
      .router-layout,
      .console-split,
      .hero-principles,
      .hero-slab,
      .log-top-grid,
      .log-main-grid {
        grid-template-columns: 1fr;
      }
      .router-grid-tight {
        grid-template-columns: repeat(2, minmax(130px, 1fr));
      }
      .router-aside {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .grid, .provider-grid {
        grid-template-columns: repeat(2, minmax(130px, 1fr));
      }
      .provider-grid .wide { grid-column: span 2; }
      .overview-grid { grid-template-columns: repeat(3, minmax(120px, 1fr)); }
      .archive-buckets { grid-template-columns: 1fr; }
      .detail-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .grid, .provider-grid { grid-template-columns: 1fr; }
      .provider-grid .wide { grid-column: span 1; }
      .router-grid-tight,
      .router-aside {
        grid-template-columns: 1fr;
      }
      h1 { font-size: 24px; }
      .pair-grid { grid-template-columns: 1fr; }
      .archive-grid { grid-template-columns: 1fr; }
      .overview-grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      .timeline-grid { grid-template-columns: 1fr; }
      .log-actions-row .actions {
        grid-template-columns: 1fr;
      }
      .modal {
        padding: 8px;
      }
      .modal-card {
        width: calc(100vw - 16px);
        height: calc(100vh - 16px);
        padding: 10px;
      }
      .modal-head {
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>
  ${renderAdminBody(page)}

  <script>
    const PAGE_SECTION = ${JSON.stringify(section)};
    const SHOW_ROUTER = ${page.kind === "router" ? "true" : "false"};
    const SHOW_LOGS = ${page.kind === "log" ? "true" : "false"};
    const API_FORMAT_FILTER = "${view}";
    const INITIAL_CONFIG = ${initialConfigJson};

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
    let savedConfigSignature = "";
    const jsonNodeExpanded = new Set();
    const jsonNodeCollapsed = new Set();
    const SAVE_BUTTON_TEXT = SHOW_ROUTER ? "保存配置" : "保存归档设置";
    const SAVE_BUTTON_BUSY_TEXT = SHOW_ROUTER ? "保存中..." : "保存归档中...";
    const RUNTIME_READY_TEXT = SHOW_ROUTER ? "已加载" : "在线";

    const byId = (id) => document.getElementById(id);

    function setDirty(next) {
      dirty = next;
      const badge = byId("dirtyBadge");
      if (!badge) {
        return;
      }
      if (dirty) {
        badge.textContent = "待保存";
        badge.className = "badge warn dot";
      } else {
        badge.textContent = "已同步";
        badge.className = "badge ok dot";
      }
    }

    function setMessage(text, type) {
      const msg = byId("msg");
      msg.textContent = text || "";
      msg.style.color = type === "error" ? "#b5b5b5" : type === "ok" ? "#f0f0f0" : "#d5d5d5";
    }

    function setSaving(next) {
      saving = next;
      const saveBtn = byId("saveBtn");
      if (!saveBtn) {
        return;
      }
      saveBtn.disabled = next;
      saveBtn.textContent = next ? SAVE_BUTTON_BUSY_TEXT : SAVE_BUTTON_TEXT;
    }

    function configSignature(value) {
      return JSON.stringify(value || null);
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
        ? (p.authMode.value || "")
        : "";
      const authModeKind = p.authMode === "passthrough" ? "passthrough" : "inject";
      return '<div class="provider-item" data-origin-name="' + esc(name) + '">' +
        '<div class="provider-head">' +
        '<label class="field"><span class="sr-only">Provider 名称</span><input data-k="providerName" value="' + esc(name) + '" placeholder="例如：中转站" /></label>' +
        '<button class="danger" data-action="remove">删除上游</button>' +
        '</div>' +
        '<div class="provider-grid">' +
        '<label class="field wide">Base URL<input data-k="baseURL" value="' + esc(p.baseURL || "") + '" placeholder="https://api.example.com" /></label>' +
        '<label class="field">鉴权<select data-k="authModeKind">' +
          '<option value="inject"' + (authModeKind === "inject" ? " selected" : "") + '>注入密钥</option>' +
          '<option value="passthrough"' + (authModeKind === "passthrough" ? " selected" : "") + '>透传</option>' +
        '</select></label>' +
        '<label class="field">密钥<input data-k="apiKey" type="password" autocomplete="new-password" value="' + esc(keyValue) + '" placeholder="sk-..." /></label>' +
        '</div></div>';
    }

    function getProviderNamesFromDom() {
      const cards = Array.from(document.querySelectorAll(".provider-item"));
      return cards
        .map((card) => {
          const input = card.querySelector('[data-k="providerName"]');
          return input ? input.value.trim() : "";
        })
        .filter(Boolean);
    }

    function routeCard(route) {
      const apiFormat = route && route.apiFormat === "anthropic" ? "anthropic" : "openai";
      const stripPrefix = Boolean(route && route.stripPrefix);
      return '<div class="provider-item route-item">' +
        '<div class="provider-head">' +
        '<label class="field"><span class="sr-only">入口前缀</span><input data-k="pathPrefix" value="' + esc(route?.pathPrefix || "") + '" placeholder="/v1 或 /claude" /></label>' +
        '<button class="danger" data-action="remove-route">删除规则</button>' +
        '</div>' +
        '<div class="provider-grid">' +
        '<label class="field"><span>格式</span><select data-k="apiFormat">' +
          '<option value="openai"' + (apiFormat === "openai" ? " selected" : "") + '>OpenAI</option>' +
          '<option value="anthropic"' + (apiFormat === "anthropic" ? " selected" : "") + '>Claude</option>' +
        '</select></label>' +
        '<label class="field"><span>上游</span><select data-k="routeProvider"></select></label>' +
        '<label class="field"><span>转发</span><select data-k="stripPrefix">' +
          '<option value="false"' + (!stripPrefix ? " selected" : "") + '>保留前缀</option>' +
          '<option value="true"' + (stripPrefix ? " selected" : "") + '>移除前缀</option>' +
        '</select></label>' +
        '</div></div>';
    }

    function rebuildProviderSelectors() {
      const names = Array.from(new Set(getProviderNamesFromDom()));
      const currentDefault = byId("defaultProvider").value || state.routing.defaultProvider || "";

      byId("defaultProvider").innerHTML = names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join("");
      const nextDefault = names.includes(currentDefault) ? currentDefault : (names[0] || "");
      byId("defaultProvider").value = nextDefault;
      document.querySelectorAll('.route-item').forEach((item) => {
        const select = item.querySelector('[data-k="routeProvider"]');
        if (!select) {
          return;
        }
        const current = select.getAttribute("data-current") || select.value || "";
        select.innerHTML = names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join("");
        const next = names.includes(current) ? current : (names[0] || "");
        select.value = next;
        select.setAttribute("data-current", next);
      });
    }

    function wireProviderItem(item) {
      const removeBtn = item.querySelector('button[data-action="remove"]');
      const nameInput = item.querySelector('[data-k="providerName"]');
      const authModeInput = item.querySelector('[data-k="authModeKind"]');
      const apiKeyInput = item.querySelector('[data-k="apiKey"]');
      const syncAuthMode = () => {
        if (!authModeInput || !apiKeyInput) {
          return;
        }
        const passthrough = authModeInput.value === "passthrough";
        apiKeyInput.disabled = passthrough;
        apiKeyInput.placeholder = passthrough ? "透传下游 Header" : "sk-...";
      };
      if (nameInput) {
        const syncName = () => {
          rebuildProviderSelectors();
          syncDirtyState();
        };
        nameInput.addEventListener("input", syncName);
        nameInput.addEventListener("change", syncName);
      }
      if (authModeInput) {
        authModeInput.addEventListener("change", () => {
          syncAuthMode();
          syncDirtyState();
        });
        authModeInput.addEventListener("input", () => {
          syncAuthMode();
          syncDirtyState();
        });
      }
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          const name = (nameInput && nameInput.value.trim()) || item.getAttribute("data-origin-name");
          if (!confirm('确认删除上游 "' + name + '" ?')) return;
          item.remove();
          rebuildProviderSelectors();
          syncDirtyState();
          setMessage("已删除一条上游配置，记得保存。", "muted");
        });
      }
      syncAuthMode();
    }

    function renderProviders() {
      const list = byId("providersList");
      const rows = Object.entries(state.providers || {});
      list.innerHTML = rows.map(([n, p]) => providerCard(n, p)).join("");
      list.querySelectorAll(".provider-item").forEach((item) => wireProviderItem(item));
    }

    function normalizeRoutes() {
      const routes = Array.isArray(state.routing?.routes) ? state.routing.routes.filter(Boolean) : [];
      if (routes.length > 0) {
        return routes;
      }
      const fallback = [];
      const openaiProvider = state.routing?.formatProviders?.openai || state.routing?.defaultProvider || "";
      const anthropicProvider = state.routing?.formatProviders?.anthropic || "";
      if (openaiProvider) {
        fallback.push({ pathPrefix: "/v1", provider: openaiProvider, apiFormat: "openai", stripPrefix: true });
      }
      if (anthropicProvider) {
        fallback.push({ pathPrefix: "/claude", provider: anthropicProvider, apiFormat: "anthropic", stripPrefix: true });
      }
      return fallback;
    }

    function wireRouteItem(item) {
      const removeBtn = item.querySelector('button[data-action="remove-route"]');
      const providerSelect = item.querySelector('[data-k="routeProvider"]');
      if (providerSelect) {
        providerSelect.addEventListener("change", () => {
          providerSelect.setAttribute("data-current", providerSelect.value || "");
          syncDirtyState();
        });
      }
      item.querySelectorAll("input, select").forEach((el) => {
        el.addEventListener("input", () => syncDirtyState());
        el.addEventListener("change", () => syncDirtyState());
      });
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          item.remove();
          syncDirtyState();
          setMessage("已删除一条路径规则，记得保存。", "muted");
        });
      }
    }

    function renderRoutes() {
      const list = byId("routesList");
      const routes = normalizeRoutes();
      list.innerHTML = routes.map((route) => routeCard(route)).join("");
      list.querySelectorAll(".route-item").forEach((item, index) => {
        const route = routes[index] || {};
        const select = item.querySelector('[data-k="routeProvider"]');
        if (select) {
          select.setAttribute("data-current", route.provider || "");
        }
        wireRouteItem(item);
      });
      rebuildProviderSelectors();
    }

    function bindDirtyTracking() {
      document.querySelectorAll("input, select").forEach((el) => {
        if (el.dataset.dirtyBound === "true") {
          return;
        }
        el.dataset.dirtyBound = "true";
        el.addEventListener("input", () => syncDirtyState());
        el.addEventListener("change", () => syncDirtyState());
      });
    }

    function syncDirtyState() {
      if (!state) {
        setDirty(false);
        return;
      }
      setDirty(configSignature(collect()) !== savedConfigSignature);
    }

    function validateConfig(next) {
      const errors = [];
      const rawProviderNames = SHOW_ROUTER ? getProviderNamesFromDom() : Object.keys(next.providers || {});
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
      const routes = Array.isArray(next.routing.routes) ? next.routing.routes : [];
      if (routes.length === 0) errors.push("至少需要一条路径规则。");
      routes.forEach((route, index) => {
        if (!route.pathPrefix || !route.pathPrefix.startsWith("/")) {
          errors.push('规则 #' + (index + 1) + ' 的入口前缀必须以 / 开头。');
        }
        if (!next.providers[route.provider]) {
          errors.push('规则 #' + (index + 1) + ' 的上游不存在。');
        }
        if (route.apiFormat !== "openai" && route.apiFormat !== "anthropic") {
          errors.push('规则 #' + (index + 1) + ' 的格式必须是 OpenAI 或 Claude。');
        }
      });

      names.forEach((n) => {
        const p = next.providers[n];
        if (!n.trim()) errors.push("Provider 名称不能为空。");
        if (!/^https?:\\/\\//i.test(p.baseURL || "")) errors.push('Provider "' + n + '" 的 Base URL 必须以 http:// 或 https:// 开头。');
      });
      if (new Set(rawProviderNames).size !== rawProviderNames.length) {
        errors.push("Provider 名称不能重复。");
      }

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
      const archiveEl = byId("archiveRequests");
      next.logging.archiveRequests = archiveEl ? archiveEl.value === "true" : Boolean(state.logging?.archiveRequests);
      if (!SHOW_ROUTER) {
        return next;
      }
      next.listen.host = byId("listenHost").value.trim();
      next.listen.port = Number(byId("listenPort").value);
      next.requestTimeoutMs = Number(byId("timeoutMs").value);
      next.routing.defaultProvider = byId("defaultProvider").value;
      next.routing.routes = Array.from(document.querySelectorAll(".route-item")).map((card) => {
        const get = (k) => {
          const input = card.querySelector('[data-k="' + k + '"]');
          return input ? input.value.trim() : "";
        };
        return {
          pathPrefix: get("pathPrefix"),
          provider: get("routeProvider"),
          apiFormat: get("apiFormat") === "anthropic" ? "anthropic" : "openai",
          stripPrefix: get("stripPrefix") === "true"
        };
      });

      function resolveInjectPreset(prev) {
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
        if (card.classList.contains("route-item")) {
          continue;
        }
        const get = (k) => card.querySelector('[data-k="' + k + '"]').value.trim();
        const name = get("providerName");
        const apiKey = get("apiKey");
        const authModeKind = get("authModeKind") || "inject";
        const prevName = (card.getAttribute("data-origin-name") || "").trim();
        const prev = (state.providers && (state.providers[name] || state.providers[prevName])) || {};
        const injectPreset = resolveInjectPreset(prev);
        const prevInject = prev?.authMode && typeof prev.authMode === "object" && prev.authMode.type === "inject"
          ? prev.authMode
          : null;
        const preservePrevInject = authModeKind === "inject"
          && prevInject
          && (
            apiKey === String(prevInject.value || "")
            || (apiKey === "" && (prevInject.valueFromEnv || prevInject.valueTemplate))
          );
        providers[name] = {
          ...(prev && typeof prev === "object" ? prev : {}),
          baseURL: get("baseURL"),
          authMode: authModeKind === "passthrough"
            ? "passthrough"
            : preservePrevInject
              ? { ...prevInject }
              : {
                type: "inject",
                header: injectPreset.header,
                value: apiKey,
                valuePrefix: injectPreset.prefix || undefined
              },
          pathRewrite: Array.isArray(prev?.pathRewrite) ? prev.pathRewrite : []
        };
      }
      next.providers = providers;
      return next;
    }

    function render() {
      savedConfigSignature = configSignature(state);
      if (byId("archiveRequests")) {
        byId("archiveRequests").value = String(Boolean(state.logging?.archiveRequests));
      }
      if (!SHOW_ROUTER) {
        setDirty(false);
        applyRuntimeReadyMessage();
        return;
      }
      byId("listenHost").value = state.listen.host || "127.0.0.1";
      byId("listenPort").value = state.listen.port || 5290;
      byId("timeoutMs").value = state.requestTimeoutMs || 120000;
      renderProviders();
      renderRoutes();
      bindDirtyTracking();
      setDirty(false);
      applyRuntimeReadyMessage();
    }

    function applyRuntimeReadyMessage() {
      if (state.logging?.archiveRequests) {
        setMessage(SHOW_ROUTER
          ? "已加载"
          : "归档开启", "muted");
      } else {
        setMessage(SHOW_ROUTER
          ? "已加载"
          : "归档关闭", "muted");
      }
      byId("runtimeBadge").className = "badge ok dot";
      byId("runtimeBadge").textContent = RUNTIME_READY_TEXT;
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
      const parseErr = arr.filter((x) => x.request?.parseError || x.response?.parseError).length;
      const wrap = byId("logOverview");
      wrap.innerHTML = [
        ["总日志", total],
        ["成功", ok],
        ["失败", err],
        ["处理中", pending],
        ["平均耗时(ms)", avgMs],
        ["解析错误", parseErr]
      ].map((m) =>
        '<div class="metric-card"><div class="metric-label">' + escHtml(String(m[0])) + '</div><div class="metric-value">' + escHtml(String(m[1])) + "</div></div>"
      ).join("");
      renderArchiveBuckets(arr);
    }

    function renderArchiveBuckets(items) {
      const wrap = byId("logArchiveBuckets");
      if (!wrap) {
        return;
      }
      const arr = Array.isArray(items) ? items : [];
      const groups = [
        {
          title: "OpenAI",
          key: "openai",
          count: arr.filter((item) => String(item?.apiFormat || "").toLowerCase() === "openai").length
        },
        {
          title: "Anthropic",
          key: "anthropic",
          count: arr.filter((item) => String(item?.apiFormat || "").toLowerCase() === "anthropic").length
        },
        {
          title: "其他类型",
          key: "other",
          count: arr.filter((item) => {
            const type = String(item?.apiFormat || "").toLowerCase();
            return type !== "openai" && type !== "anthropic";
          }).length
        },
        {
          title: "归档状态",
          key: "archive",
          count: arr.length
        }
      ];
      const archiveState = state?.logging?.archiveRequests ? "当前开启" : "当前关闭";
      wrap.innerHTML = groups.map((group) => {
        const copy = group.key === "archive"
          ? "当前可查看列表中的记录都带有详情，未归档详情的记录不会展示。"
          : group.title + " " + String(group.count);
        const meta = group.key === "archive" ? archiveState : "已归档详情";
        return '<div class="archive-bucket">' +
          '<div class="archive-bucket-head"><strong>' + escHtml(group.title) + '</strong><span>' + escHtml(meta) + '</span></div>' +
          '<div class="metric-value">' + escHtml(String(group.count)) + '</div>' +
          '<div class="archive-bucket-copy">' + escHtml(copy) + '</div>' +
        "</div>";
      }).join("");
    }

    function renderLogs(items) {
      const list = byId("logList");
      latestAllLogs = Array.isArray(items) ? items : [];
      const visible = applyLogFilters(latestAllLogs);
      latestVisibleLogs = visible;
      renderOverview(visible);
      if (visible.length === 0) {
        const archiveDisabled = !Boolean(state?.logging?.archiveRequests);
        const hint = archiveDisabled
          ? "暂无详情"
          : "无结果";
        list.innerHTML = '<div class="log-empty">' + escHtml(hint) + "</div>";
        return;
      }

      list.innerHTML = visible.map((it) => {
        const lid = itemLogId(it);
        const duration = typeof it.durationMs === "number" ? (it.durationMs + "ms") : "-";
        const requestLead = firstPreview(it?.request?.messages) || it?.request?.systemPromptPreview || "";
        const responseLead = it?.response?.responsePreview || firstPreview(it?.response?.messages) || "";
        const apiFormat = it?.apiFormat || "unknown";
        const summary = requestLead ? ('<div class="log-summary"><strong>Req</strong>' + escHtml(trimPreview(requestLead, 160)) + "</div>") : "";
        const response = responseLead ? ('<div class="log-summary"><strong>Res</strong>' + escHtml(trimPreview(responseLead, 180)) + "</div>") : "";
        return '<div class="log-item">' +
          '<div class="log-head">' +
          '<div class="mono">' + escHtml(it.requestId || "-") + "</div>" +
          '<div class="actions">' +
            '<span class="' + statusClass(it.statusCode) + '">' + (it.statusCode ?? "pending") + "</span>" +
            '<button class="link-btn" data-action="view-json" data-log-id="' + escHtml(lid) + '">查看 JSON</button>' +
          '</div>' +
          "</div>" +
          '<div class="kv">' +
          '<span>时间: ' + escHtml(fmtTime(it.startedAt || it.endedAt)) + "</span>" +
          '<span>上游: ' + escHtml(it.provider || "-") + "</span>" +
          '<span>模型: ' + escHtml(it.model || "-") + "</span>" +
          '<span>路径: ' + escHtml(it.path || "-") + "</span>" +
          '<span>耗时: ' + escHtml(duration) + "</span>" +
          "</div>" +
          '<div class="log-item-topline">' +
            '<span class="log-chip">类型: ' + escHtml(String(apiFormat)) + "</span>" +
            '<span class="log-chip">归档详情: 可查看</span>' +
            '<span class="log-chip">配对: requestId 一一对应</span>' +
          "</div>" +
          summary +
          response +
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
      const requestView = req ? cloneJsonValue(req) : null;
      const responseView = res ? cloneJsonValue(res) : null;

      return {
        requestId: req?.requestId || res?.requestId || fallbackRequestId || null,
        statusCode: typeof res?.statusCode === "number" ? res.statusCode : null,
        request: requestView,
        response: responseView
      };
    }

    function toDetailFocusJson(detail, listItem, fallbackRequestId) {
      const req = detail?.request || null;
      const res = detail?.response || null;
      const requestBodyViewRaw = req ? toNativeBodyView(req) : null;
      const requestBodyView = deepParseJsonValue(cloneJsonValue(requestBodyViewRaw), 6);
      const nativeResponseBody = res ? toNativeBodyView(res) : null;
      const mergedSseResponse = res ? toMergedSseJson(res, requestBodyView, nativeResponseBody) : null;
      const responseBodyViewRaw = mergedSseResponse !== null ? mergedSseResponse : nativeResponseBody;
      const responseBodyView = deepParseJsonValue(cloneJsonValue(responseBodyViewRaw), 6);
      const requestFallback = req && req.source === "jsonl";
      const responseFallback = res && res.source === "jsonl";

      return {
        requestId: req?.requestId || res?.requestId || fallbackRequestId || null,
        statusCode: typeof res?.statusCode === "number" ? res.statusCode : (listItem?.statusCode ?? null),
        apiFormat: req?.apiFormat || res?.apiFormat || listItem?.apiFormat || null,
        method: req?.method || res?.method || listItem?.method || null,
        path: req?.path || res?.path || listItem?.path || null,
        provider: req?.provider || res?.provider || listItem?.provider || null,
        request: req ? {
          capturedAt: req.capturedAt || null,
          contentType: req.contentType || null,
          archived: !requestFallback,
          body: requestBodyView
        } : null,
        response: res ? {
          capturedAt: res.capturedAt || null,
          contentType: res.contentType || null,
          archived: !responseFallback,
          isSse: Boolean(res.isSse),
          aggregatedForDisplay: Boolean(res.isSse),
          body: responseBodyView
        } : null,
        diagnostics: {
          requestFallbackSummaryOnly: Boolean(requestFallback),
          responseFallbackSummaryOnly: Boolean(responseFallback)
        }
      };
    }

    function formatDetailMeta(parts) {
      return parts.filter((part) => part !== null && part !== undefined && part !== "").join("  |  ");
    }

    function safeStringify(value) {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value ?? "");
      }
    }

    function collectTextSnippets(value, out, limit) {
      if (out.length >= limit || value === null || value === undefined) {
        return;
      }
      if (typeof value === "string") {
        const text = value.trim();
        if (text) {
          out.push(text);
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (out.length >= limit) {
            return;
          }
          collectTextSnippets(item, out, limit);
        }
        return;
      }
      if (typeof value === "object") {
        const preferredKeys = [
          "text",
          "content",
          "output_text",
          "input_text",
          "summary_text",
          "reasoning_text",
          "completion",
          "responsePreview"
        ];
        for (const key of preferredKeys) {
          if (out.length >= limit) {
            return;
          }
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            collectTextSnippets(value[key], out, limit);
          }
        }
        for (const entry of Object.values(value)) {
          if (out.length >= limit) {
            return;
          }
          collectTextSnippets(entry, out, limit);
        }
      }
    }

    function summarizeResponseText(value) {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "string") {
        return value.trim();
      }
      const parts = [];
      collectTextSnippets(value, parts, 24);
      const unique = [];
      const seen = new Set();
      for (const part of parts) {
        const key = part.trim();
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        unique.push(key);
      }
      return unique.join("\\n\\n").trim();
    }

    function renderResponseSummary(value) {
      const card = byId("responseSummaryCard");
      const content = byId("responseSummaryContent");
      const text = summarizeResponseText(value);
      if (!text) {
        card.style.display = "none";
        content.textContent = "";
        return;
      }
      card.style.display = "block";
      content.textContent = text;
    }

    function firstPreview(messages) {
      if (!Array.isArray(messages)) {
        return "";
      }
      for (const item of messages) {
        const preview = item && typeof item.preview === "string" ? item.preview.trim() : "";
        if (preview) {
          return preview;
        }
      }
      return "";
    }

    function trimPreview(value, max) {
      const text = typeof value === "string" ? value.replace(/\\s+/g, " ").trim() : "";
      if (!text || text.length <= max) {
        return text;
      }
      return text.slice(0, max - 1) + "…";
    }

    function renderJsonPane(targetId, value, rootPath, emptyText) {
      const target = byId(targetId);
      if (value === null || value === undefined || value === "") {
        target.classList.remove("collapsed");
        target.innerHTML = '<div class="json-empty">' + escHtml(emptyText) + "</div>";
        return;
      }
      target.innerHTML = renderJsonTree(value, rootPath);
      if (jsonCollapsed) {
        target.classList.add("collapsed");
      } else {
        target.classList.remove("collapsed");
      }
    }

    function renderJsonModalPayload(payload) {
      currentJsonValue = payload;
      currentJsonRawText = JSON.stringify(payload, null, 2);
      currentJsonText = currentJsonRawText;
      renderJsonPane("jsonRequestContent", payload?.request?.body ?? null, "$.request.body", "没有请求内容");
      renderJsonPane("jsonResponseContent", payload?.response?.body ?? null, "$.response.body", "没有响应内容");
      renderResponseSummary(payload?.response?.body ?? null);
      bindJsonTreeEvents();
      byId("jsonMeta").textContent = formatDetailMeta([
        payload.requestId || "-",
        payload.statusCode ? ("HTTP " + payload.statusCode) : "pending",
        payload.apiFormat || null,
        payload.method || null,
        payload.path || null
      ]);
      byId("jsonRequestMeta").textContent = formatDetailMeta([
        payload?.request?.capturedAt || null,
        payload?.request?.contentType || null,
        payload?.request?.archived === false ? "jsonl fallback" : "archive"
      ]);
      const responseModeBadge = byId("responseModeBadge");
      if (responseModeBadge) {
        responseModeBadge.textContent = payload?.response?.isSse ? "SSE 聚合" : "原始响应";
      }
      byId("jsonResponseMeta").textContent = formatDetailMeta([
        payload?.response?.capturedAt || null,
        payload?.response?.contentType || null,
        payload?.response?.isSse ? "SSE" : "non-SSE",
        payload?.response?.aggregatedForDisplay ? "展示: 已聚合" : "展示: 原样",
        payload?.response?.archived === false ? "来源: jsonl 摘要回退" : "来源: archive"
      ]);
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

    function renderJsonTree(value, rootPath) {
      return renderJsonNode(null, value, rootPath || "$", 0, true, false);
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
        renderJsonPane("jsonRequestContent", value?.request?.body ?? null, "$.request.body", "没有请求内容");
        renderJsonPane("jsonResponseContent", value?.response?.body ?? null, "$.response.body", "没有响应内容");
        renderResponseSummary(value?.response?.body ?? null);
        bindJsonTreeEvents();
      } catch {
        byId("jsonRequestContent").textContent = currentJsonText;
        byId("jsonResponseContent").textContent = currentJsonText;
        renderResponseSummary(null);
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
        byId("jsonRequestContent").textContent = currentJsonText;
        byId("jsonResponseContent").textContent = currentJsonText;
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
        byId("jsonRequestContent").textContent = currentJsonText;
        byId("jsonResponseContent").textContent = currentJsonText;
      }
    }

    function bindJsonTreeEvents() {
      document.querySelectorAll('#jsonRequestContent button[data-action="toggle-json-node"], #jsonResponseContent button[data-action="toggle-json-node"]').forEach((btn) => {
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
          renderJsonModalPayload(toDetailFocusJson(detail, item, requestId));
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
      const btn = byId("toggleJsonBtn");
      const panes = [byId("jsonRequestContent"), byId("jsonResponseContent")];
      if (jsonCollapsed) {
        panes.forEach((pane) => pane.classList.add("collapsed"));
        btn.textContent = "展开";
      } else {
        panes.forEach((pane) => pane.classList.remove("collapsed"));
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
      setLogState("在线", true);
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
        setLogState("手动", true);
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
          setLogState("实时", true);
        } catch {
          setLogState("错误", false);
        }
      });
      logEventSource.onerror = () => {
        setLogState("重连", false);
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
      const errors = SHOW_ROUTER ? validateConfig(payload) : [];
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
        setMessage("已保存", "ok");
      } catch (e) {
        setMessage("保存失败: " + e.message, "error");
      } finally {
        setSaving(false);
      }
    }

    if (SHOW_ROUTER) {
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
      byId("addRoute").addEventListener("click", () => {
        const list = byId("routesList");
        const defaults = normalizeRoutes();
        const fallbackProvider = byId("defaultProvider").value || defaults[0]?.provider || "";
        list.insertAdjacentHTML("beforeend", routeCard({
          pathPrefix: "/route-" + (list.querySelectorAll(".route-item").length + 1),
          provider: fallbackProvider,
          apiFormat: "openai",
          stripPrefix: true
        }));
        const newItem = list.lastElementChild;
        if (newItem) {
          const select = newItem.querySelector('[data-k="routeProvider"]');
          if (select) {
            select.setAttribute("data-current", fallbackProvider);
          }
          wireRouteItem(newItem);
        }
        rebuildProviderSelectors();
        setDirty(true);
        setMessage("已添加新路径规则，记得保存。", "muted");
      });
    }

    if (SHOW_LOGS) {
      const archiveSelect = byId("archiveRequests");
      if (archiveSelect) {
        archiveSelect.addEventListener("change", () => setDirty(true));
        archiveSelect.addEventListener("input", () => setDirty(true));
      }
    }

    if (SHOW_ROUTER || SHOW_LOGS) {
      byId("saveBtn").addEventListener("click", save);
      byId("reloadBtn").addEventListener("click", async () => {
        if (dirty && !confirm("当前有未保存改动，确认放弃并重载吗？")) return;
        await load();
        setMessage("已重载", "ok");
      });

      window.addEventListener("beforeunload", (e) => {
        if (!dirty) return;
        e.preventDefault();
        e.returnValue = "";
      });
    }

    if (SHOW_LOGS) {
      byId("logAutoBtn").addEventListener("click", () => {
        autoRefresh = !autoRefresh;
        byId("logAutoBtn").textContent = autoRefresh ? "自动刷新: 开" : "自动刷新: 关";
        if (autoRefresh) {
          void fetchLogsOnce();
        }
        connectLogStream();
      });
      byId("logRefreshBtn").addEventListener("click", () => {
        void fetchLogsOnce();
        void fetchUsageMetricsOnce();
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
      byId("copyRequestJsonBtn").addEventListener("click", async () => {
        const text = safeStringify(currentJsonValue?.request?.body ?? null);
        try {
          await navigator.clipboard.writeText(text);
          setMessage("请求 JSON 已复制到剪贴板。", "ok");
        } catch {
          setMessage("复制请求 JSON 失败，请手动复制。", "error");
        }
      });
      byId("copyResponseJsonBtn").addEventListener("click", async () => {
        const text = safeStringify(currentJsonValue?.response?.body ?? null);
        try {
          await navigator.clipboard.writeText(text);
          setMessage("响应 JSON 已复制到剪贴板。", "ok");
        } catch {
          setMessage("复制响应 JSON 失败，请手动复制。", "error");
        }
      });
    }

    if (INITIAL_CONFIG && typeof INITIAL_CONFIG === "object") {
      state = INITIAL_CONFIG;
      render();
      setMessage("页面已使用当前运行中配置完成初始渲染。", "muted");
    }

    load().catch((e) => {
      if (state) {
        setMessage("已显示内嵌配置，但从接口刷新失败: " + e.message, "error");
        return;
      }
      byId("runtimeBadge").className = "badge warn dot";
      byId("runtimeBadge").textContent = "加载失败";
      setMessage("加载失败: " + e.message, "error");
    });
    if (SHOW_LOGS) {
      void fetchLogsOnce();
      connectLogStream();
      void fetchUsageMetricsOnce();
      setInterval(() => {
        void fetchUsageMetricsOnce();
      }, 1000);
    }
  </script>
</body>
</html>`;
}
