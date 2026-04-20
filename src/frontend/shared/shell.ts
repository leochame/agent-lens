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
  if (area.path === "/__home") {
    return activePath === "/" || activePath === "/__home";
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
    gap: 18px;
    min-height: calc(100vh - 40px);
    align-items: start;
  }
  .workbench-sidebar,
  .workbench-main {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(8, 8, 8, 0.98)),
      #0b0b0b;
    box-shadow: 0 28px 60px rgba(0, 0, 0, 0.34);
  }
  .workbench-sidebar::before,
  .workbench-main::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 22%),
      linear-gradient(90deg, rgba(255, 255, 255, 0.04), transparent 18%);
  }
  .workbench-sidebar {
    border-radius: 26px;
    padding: 18px;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 16px;
    position: sticky;
    top: 14px;
  }
  .workbench-main {
    border-radius: 26px;
    padding: 18px;
    display: grid;
    gap: 18px;
  }
  .workbench-brand,
  .workbench-nav-label,
  .workbench-nav,
  .workbench-main > * {
    position: relative;
    z-index: 1;
    min-width: 0;
  }
  .workbench-brand {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 22px;
    padding: 18px;
    background:
      radial-gradient(circle at 18% 16%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 34%),
      linear-gradient(160deg, rgba(255, 255, 255, 0.05), transparent 30%),
      linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(12, 12, 12, 0.98));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 20px 36px rgba(0, 0, 0, 0.28);
  }
  .workbench-brand::after {
    content: "";
    position: absolute;
    right: -28px;
    top: -18px;
    width: 124px;
    height: 124px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0));
    filter: blur(10px);
    pointer-events: none;
  }
  .workbench-brand-orbit {
    position: relative;
    width: 76px;
    height: 76px;
    margin-bottom: 18px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
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
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .workbench-brand-orbit span:nth-child(2) {
    width: 42%;
    height: 42%;
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
  .workbench-brand-orbit span:nth-child(3) {
    width: 10px;
    height: 10px;
    background: #f4f4f4;
  }
  .workbench-brand-code {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    margin-bottom: 12px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.56);
  }
  .workbench-brand strong {
    display: block;
    font-size: 34px;
    line-height: 1;
    letter-spacing: -0.05em;
    color: #f4f4f4;
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
    color: rgba(255, 255, 255, 0.4);
  }
  .workbench-nav-label::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.14), transparent);
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
    border: 1px solid rgba(255, 255, 255, 0.08);
    text-decoration: none;
    color: inherit;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 36%),
      linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(14, 14, 14, 0.98)),
      #101010;
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease, box-shadow 180ms ease;
  }
  .workbench-link:hover {
    transform: translateX(3px);
    border-color: rgba(255, 255, 255, 0.16);
    background:
      linear-gradient(140deg, rgba(255, 255, 255, 0.08), transparent 28%),
      linear-gradient(180deg, rgba(28, 28, 28, 0.98), rgba(16, 16, 16, 0.98));
    box-shadow: 0 18px 28px rgba(0, 0, 0, 0.3);
  }
  .workbench-link.active {
    border-color: rgba(255, 255, 255, 0.18);
    background:
      linear-gradient(140deg, rgba(255, 255, 255, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(32, 32, 32, 0.98), rgba(18, 18, 18, 0.98));
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.05),
      0 18px 32px rgba(0, 0, 0, 0.3);
  }
  .workbench-link-mark {
    grid-column: 1;
    grid-row: 1 / span 3;
    align-self: start;
    position: relative;
    display: inline-flex;
    width: 34px;
    height: 34px;
    margin-top: 2px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .workbench-link-mark span {
    position: absolute;
    inset: 50%;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.84);
  }
  .workbench-link-kicker,
  .workbench-link-summary {
    grid-column: 2;
  }
  .workbench-link-kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.46);
  }
  .workbench-link strong {
    grid-column: 2;
    font-size: 18px;
    line-height: 1;
    letter-spacing: -0.05em;
    color: #f4f4f4;
  }
  .workbench-link-summary {
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.64);
  }
  .workbench-link.active .workbench-link-kicker,
  .workbench-link.active .workbench-link-summary {
    color: rgba(255, 255, 255, 0.76);
  }
  .workbench-sublinks {
    display: grid;
    gap: 6px;
    margin-left: 18px;
    padding-left: 18px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
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
    color: rgba(255, 255, 255, 0.66);
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }
  .workbench-sublink:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }
  .workbench-sublink.active {
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.08);
  }
  .workbench-rail {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(20, 20, 20, 0.98), rgba(10, 10, 10, 0.98)),
      #111;
  }
  .workbench-rail-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .workbench-rail-value {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
  }
  .gallery-panel,
  .gallery-surface,
  .gallery-reading-surface {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(22, 22, 22, 0.96), rgba(12, 12, 12, 0.98)),
      #111;
    box-shadow: 0 20px 44px rgba(0, 0, 0, 0.28);
  }
  .gallery-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.72);
  }
  .gallery-input {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: #f1f1f1;
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
      <strong>AgentLens</strong>
    </div>
    <div>
      <div class="workbench-nav-label">Areas</div>
      <nav class="workbench-nav" aria-label="功能侧边栏">${items}</nav>
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
      --page-bg: #050505;
      --page-bg-2: #0d0d0d;
      --card: rgba(18, 18, 18, 0.96);
      --card-strong: #151515;
      --text: #f3f3f3;
      --muted: rgba(255, 255, 255, 0.62);
      --line: rgba(255, 255, 255, 0.08);
      --line-strong: rgba(255, 255, 255, 0.18);
      --accent: #f0f0f0;
      --accent-deep: #ffffff;
      --accent-soft: rgba(255, 255, 255, 0.06);
      --success: #d2d2d2;
      --warn: #bdbdbd;
      --error: #9c9c9c;
      --shadow: 0 32px 80px rgba(0, 0, 0, 0.34);
      --radius-xl: 22px;
      --radius-lg: 18px;
      --radius-md: 14px;
      --radius-sm: 10px;
    }
    * { box-sizing: border-box; }
    html { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: "Space Grotesk", "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
      background:
        radial-gradient(920px 560px at -12% -10%, rgba(255, 255, 255, 0.06), transparent 70%),
        radial-gradient(840px 520px at 112% -12%, rgba(255, 255, 255, 0.04), transparent 72%),
        radial-gradient(740px 420px at 50% 0%, rgba(255, 255, 255, 0.03), transparent 72%),
        linear-gradient(180deg, var(--page-bg-2), var(--page-bg));
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
    .glass-card {
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background:
        linear-gradient(180deg, rgba(22, 22, 22, 0.98), rgba(12, 12, 12, 0.98)),
        #111;
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
        linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(14, 14, 14, 0.98)),
        #121212;
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.26);
    }
    .overview-card span {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.46);
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
        width: calc(100vw - 16px);
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
