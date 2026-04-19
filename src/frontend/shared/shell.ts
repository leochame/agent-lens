import { PRODUCT_AREAS, ProductArea } from "./areas";

type ShellMetric = {
  label: string;
  value: string;
};

type RenderPageDocumentOptions = {
  title: string;
  body: string;
  styles?: string;
};

function isAreaActive(area: ProductArea, activePath: string): boolean {
  if (area.path === "/") {
    return activePath === "/";
  }
  return area.path === activePath || (area.children ?? []).some((child) => child.path === activePath);
}

function renderAreaLink(area: ProductArea, activePath: string): string {
  const active = isAreaActive(area, activePath);
  const className = active ? "workbench-link active" : "workbench-link";
  const children = (area.children ?? []).length
    ? `<div class="workbench-sublinks">${(area.children ?? []).map((child) => {
      const childClassName = child.path === activePath ? "workbench-sublink active" : "workbench-sublink";
      return `<a class="${childClassName}" href="${child.path}">${child.name}</a>`;
    }).join("")}</div>`
    : "";

  return `<div class="workbench-nav-group">
    <a class="${className}" href="${area.path}">
      <span class="workbench-link-mark" aria-hidden="true"><span></span></span>
      <span class="workbench-link-kicker">${area.kicker}</span>
      <strong>${area.name}</strong>
      <span class="workbench-link-summary">${area.title}</span>
      <span class="workbench-link-description">${area.description}</span>
    </a>
    ${children}
  </div>`;
}

export function renderMetricStrip(items: ShellMetric[]): string {
  if (items.length === 0) {
    return "";
  }
  const cards = items
    .map((item) => `<div class="overview-card"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join("");
  return `<section class="overview-strip">${cards}</section>`;
}

export const WORKBENCH_LAYOUT_STYLES = `
  .workbench {
    display: grid;
    grid-template-columns: 308px minmax(0, 1fr);
    gap: 16px;
    min-height: calc(100vh - 40px);
    align-items: start;
  }
  .workbench-sidebar,
  .workbench-main {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(28, 24, 18, 0.1);
    background:
      linear-gradient(180deg, rgba(255, 252, 246, 0.98), rgba(244, 236, 225, 0.96)),
      #f7f1e7;
    box-shadow: 0 28px 60px rgba(76, 59, 36, 0.12);
  }
  .workbench-sidebar::before,
  .workbench-main::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 22%),
      linear-gradient(90deg, rgba(74, 59, 33, 0.08), transparent 18%);
  }
  .workbench-sidebar {
    border-radius: 26px;
    padding: 18px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 16px;
    position: sticky;
    top: 14px;
  }
  .workbench-main {
    border-radius: 26px;
    padding: 14px;
    display: grid;
    gap: 14px;
  }
  .workbench-brand,
  .workbench-sidebar-footer,
  .workbench-nav-label,
  .workbench-nav,
  .workbench-main > * {
    position: relative;
    z-index: 1;
  }
  .workbench-brand {
    border: 1px solid rgba(28, 24, 18, 0.08);
    border-radius: 22px;
    padding: 18px;
    background:
      radial-gradient(circle at 18% 16%, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0) 34%),
      linear-gradient(160deg, rgba(255, 255, 255, 0.68), transparent 30%),
      linear-gradient(180deg, rgba(251, 246, 239, 0.98), rgba(239, 231, 219, 0.96));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.74),
      0 20px 36px rgba(94, 69, 42, 0.1);
  }
  .workbench-brand::after {
    content: "";
    position: absolute;
    right: -28px;
    top: -18px;
    width: 124px;
    height: 124px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(144, 166, 156, 0.22), rgba(144, 166, 156, 0));
    filter: blur(10px);
    pointer-events: none;
  }
  .workbench-brand-orbit {
    position: relative;
    width: 76px;
    height: 76px;
    margin-bottom: 18px;
    border-radius: 999px;
    border: 1px solid rgba(28, 24, 18, 0.08);
    background: rgba(255, 251, 245, 0.7);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
  }
  .workbench-brand-orbit span {
    position: absolute;
    inset: 50%;
    display: block;
    border-radius: 999px;
    transform: translate(-50%, -50%);
  }
  .workbench-brand-orbit span:nth-child(1) {
    width: 74%;
    height: 74%;
    border: 1px solid rgba(28, 24, 18, 0.14);
  }
  .workbench-brand-orbit span:nth-child(2) {
    width: 42%;
    height: 42%;
    border: 1px solid rgba(28, 24, 18, 0.18);
  }
  .workbench-brand-orbit span:nth-child(3) {
    width: 10px;
    height: 10px;
    background: #1f1a14;
  }
  .workbench-brand-code {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    margin-bottom: 12px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid rgba(28, 24, 18, 0.1);
    background: rgba(255, 250, 244, 0.84);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(68, 54, 36, 0.62);
  }
  .workbench-brand strong {
    display: block;
    max-width: 10ch;
    font-family: "Iowan Old Style", "Baskerville", "Times New Roman", "Songti SC", "STSong", serif;
    font-size: 34px;
    line-height: 0.94;
    letter-spacing: -0.07em;
    color: #1f1a14;
  }
  .workbench-brand-copy {
    display: block;
    margin-top: 10px;
    max-width: 20ch;
    font-size: 13px;
    line-height: 1.7;
    color: rgba(80, 67, 50, 0.7);
  }
  .workbench-nav-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 4px 2px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(75, 61, 42, 0.56);
  }
  .workbench-nav-label::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(35, 29, 22, 0.14), transparent);
  }
  .workbench-nav {
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .workbench-nav-group {
    display: grid;
    gap: 8px;
  }
  .workbench-link {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 6px 12px;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(28, 24, 18, 0.08);
    text-decoration: none;
    color: inherit;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 36%),
      linear-gradient(180deg, rgba(255, 252, 247, 0.94), rgba(245, 237, 227, 0.96)),
      #f7f1e8;
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease, box-shadow 180ms ease;
  }
  .workbench-link:hover {
    transform: translateX(3px);
    border-color: rgba(28, 24, 18, 0.16);
    background:
      linear-gradient(140deg, rgba(255, 255, 255, 0.78), transparent 28%),
      linear-gradient(180deg, rgba(252, 248, 242, 0.98), rgba(240, 231, 220, 0.98));
    box-shadow: 0 18px 28px rgba(96, 72, 44, 0.08);
  }
  .workbench-link.active {
    border-color: rgba(32, 26, 18, 0.14);
    background:
      linear-gradient(140deg, rgba(255, 255, 255, 0.86), transparent 34%),
      linear-gradient(180deg, rgba(249, 243, 235, 0.98), rgba(236, 225, 211, 0.98));
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.5),
      0 18px 32px rgba(96, 72, 44, 0.1);
  }
  .workbench-link-mark {
    grid-column: 1;
    grid-row: 1 / span 4;
    align-self: start;
    position: relative;
    display: inline-flex;
    width: 34px;
    height: 34px;
    margin-top: 2px;
    border-radius: 999px;
    border: 1px solid rgba(28, 24, 18, 0.1);
    background: rgba(255, 250, 244, 0.72);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
  }
  .workbench-link-mark span {
    position: absolute;
    inset: 50%;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    transform: translate(-50%, -50%);
    background: rgba(31, 26, 20, 0.78);
  }
  .workbench-link-kicker,
  .workbench-link-summary,
  .workbench-link-description {
    grid-column: 2;
  }
  .workbench-link-kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(82, 67, 49, 0.6);
  }
  .workbench-link strong {
    grid-column: 2;
    font-size: 18px;
    line-height: 1;
    letter-spacing: -0.05em;
    color: #1c1711;
  }
  .workbench-link.active strong {
    color: #1a1510;
  }
  .workbench-link-summary {
    font-size: 12px;
    line-height: 1.45;
    color: rgba(85, 70, 52, 0.66);
  }
  .workbench-link-description {
    font-size: 12px;
    line-height: 1.6;
    color: rgba(85, 70, 52, 0.58);
  }
  .workbench-link.active .workbench-link-kicker,
  .workbench-link.active .workbench-link-summary,
  .workbench-link.active .workbench-link-description {
    color: rgba(72, 59, 42, 0.66);
  }
  .workbench-sublinks {
    display: grid;
    gap: 6px;
    margin-left: 18px;
    padding-left: 18px;
    border-left: 1px solid rgba(28, 24, 18, 0.1);
  }
  .workbench-sublink {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    width: fit-content;
    max-width: 100%;
    padding: 0 12px;
    border-radius: 999px;
    text-decoration: none;
    font-size: 12px;
    color: rgba(78, 64, 46, 0.72);
    border: 1px solid rgba(28, 24, 18, 0.08);
    background: rgba(255, 250, 244, 0.62);
  }
  .workbench-sublink:hover {
    color: #1d1812;
    background: rgba(247, 238, 226, 0.88);
  }
  .workbench-sublink.active {
    color: #211912;
    border: 1px solid rgba(32, 26, 18, 0.1);
    background: linear-gradient(180deg, rgba(249, 243, 235, 0.96), rgba(239, 230, 218, 0.96));
  }
  .workbench-sidebar-footer {
    border-top: 1px solid rgba(28, 24, 18, 0.08);
    padding: 16px 2px 4px;
    font-size: 11px;
    line-height: 1.55;
    color: rgba(78, 65, 48, 0.62);
  }
  .workbench-sidebar-footer strong {
    display: block;
    margin-bottom: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #1e1812;
  }
  .workbench-domain-map {
    display: grid;
    gap: 10px;
  }
  .workbench-domain-map-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }
  .workbench-domain-map-row strong {
    display: inline-flex;
    justify-content: center;
    width: fit-content;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(28, 24, 18, 0.08);
    background: rgba(255, 248, 238, 0.8);
    color: #2b2117;
    font-size: 11px;
    letter-spacing: 0.06em;
  }
  .workbench-domain-map-row span {
    font-size: 11px;
    line-height: 1.5;
    color: rgba(83, 69, 52, 0.66);
  }
  .workbench-rail {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 10px 12px;
    border: 1px solid rgba(28, 24, 18, 0.08);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(255, 251, 246, 0.96), rgba(242, 234, 223, 0.98)),
      #f5ede1;
  }
  .workbench-rail-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(82, 67, 48, 0.54);
  }
  .workbench-rail-value {
    font-size: 12px;
    color: rgba(37, 31, 24, 0.82);
  }
  .gallery-panel,
  .gallery-surface,
  .gallery-reading-surface {
    border: 1px solid rgba(28, 24, 18, 0.08);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 251, 246, 0.96), rgba(245, 238, 228, 0.98)),
      #f7f1e7;
    box-shadow: 0 20px 44px rgba(74, 56, 34, 0.1);
  }
  .gallery-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid rgba(28, 24, 18, 0.08);
    background: rgba(252, 247, 240, 0.92);
    color: rgba(55, 44, 31, 0.72);
  }
  .gallery-input {
    border: 1px solid rgba(28, 24, 18, 0.1);
    background: rgba(255, 252, 248, 0.98);
    color: #1e1913;
  }
  @media (max-width: 1040px) {
    .workbench {
      grid-template-columns: 1fr;
    }
    .workbench-sidebar {
      position: static;
    }
  }
`;

export function renderWorkbenchSidebar(activePath: string): string {
  const items = PRODUCT_AREAS.map((area) => renderAreaLink(area, activePath)).join("");

  return `<aside class="workbench-sidebar">
    <div class="workbench-brand">
      <div class="workbench-brand-orbit" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span class="workbench-brand-code">AgentLens</span>
      <strong>Observe the traffic.</strong>
      <span class="workbench-brand-copy">把路由、归档与流程放进同一块工作台，让视线不用来回切换。</span>
    </div>
    <div>
      <div class="workbench-nav-label">Areas</div>
      <nav class="workbench-nav" aria-label="功能侧边栏">${items}</nav>
    </div>
    <div class="workbench-sidebar-footer">
      <strong>一束视线</strong>
      <div class="workbench-domain-map">
        <div class="workbench-domain-map-row"><strong>Home</strong><span>看整体，决定从哪一处进入。</span></div>
        <div class="workbench-domain-map-row"><strong>Router</strong><span>校准入口、上游与透明转发。</span></div>
        <div class="workbench-domain-map-row"><strong>Log</strong><span>摊开 request 与 response 的原始归档。</span></div>
        <div class="workbench-domain-map-row"><strong>Loop</strong><span>让任务继续、排队、留下运行痕迹。</span></div>
      </div>
    </div>
  </aside>`;
}

export function renderWorkbenchLayout(activePath: string, mainHtml: string): string {
  return `<div class="wrap">
    <div class="workbench">
      ${renderWorkbenchSidebar(activePath)}
      <main class="workbench-main">${mainHtml}</main>
    </div>
  </div>`;
}

export function renderPageDocument(options: RenderPageDocumentOptions): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${options.title}</title>
  <style>
    :root {
      --page-bg: #efe4d3;
      --page-bg-2: #fbf6ef;
      --card: rgba(251, 246, 238, 0.96);
      --card-strong: #f3ebdf;
      --text: #1f1a14;
      --muted: rgba(83, 68, 50, 0.7);
      --line: rgba(32, 26, 18, 0.1);
      --line-strong: rgba(32, 26, 18, 0.2);
      --accent: #362d23;
      --accent-deep: #17120d;
      --accent-soft: rgba(62, 47, 31, 0.08);
      --success: #3a332b;
      --warn: #5c5246;
      --error: #4a4036;
      --shadow: 0 32px 80px rgba(101, 76, 46, 0.14);
      --radius-xl: 22px;
      --radius-lg: 18px;
      --radius-md: 14px;
      --radius-sm: 10px;
    }
    * { box-sizing: border-box; }
    html { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: "Space Grotesk", "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
      background:
        radial-gradient(920px 560px at -12% -10%, rgba(255, 255, 255, 0.72), transparent 70%),
        radial-gradient(840px 520px at 112% -12%, rgba(224, 210, 191, 0.44), transparent 72%),
        radial-gradient(740px 420px at 50% 0%, rgba(255, 255, 255, 0.34), transparent 72%),
        linear-gradient(180deg, var(--page-bg-2), var(--page-bg));
    }
    .wrap {
      width: min(1380px, calc(100vw - 24px));
      margin: 12px auto 28px;
    }
    .page-shell {
      display: grid;
      gap: 14px;
    }
    .glass-card {
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background:
        linear-gradient(180deg, rgba(255, 251, 245, 0.96), rgba(245, 237, 227, 0.98)),
        #f7f0e6;
      box-shadow: var(--shadow);
      backdrop-filter: blur(16px);
    }
    .overview-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .overview-card {
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 15px 16px;
      background:
        linear-gradient(180deg, rgba(255, 251, 246, 0.98), rgba(243, 235, 225, 0.98)),
        #f7efe4;
      box-shadow: 0 16px 34px rgba(101, 76, 46, 0.12);
    }
    .overview-card span {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(91, 73, 53, 0.64);
    }
    .overview-card strong {
      display: block;
      margin-top: 8px;
      font-size: 20px;
      line-height: 1.15;
      color: var(--accent-deep);
    }
    a { color: inherit; }
    ${options.styles ?? ""}
    @media (max-width: 1040px) {
      .wrap {
        width: min(100vw - 16px, 1380px);
      }
      .overview-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 700px) {
      .overview-strip {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  ${options.body}
</body>
</html>`;
}
