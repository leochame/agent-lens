import { WORKBENCH_LAYOUT_STYLES, renderPageDocument, renderWorkbenchLayout } from "../shared/shell";

function renderPathCard(
  href: string,
  kicker: string,
  title: string,
  statement: string,
  className: string
): string {
  return `<a class="path-card ${className}" href="${href}">
    <div class="path-card-glyph" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div class="path-card-body">
      <span class="path-card-kicker">${kicker}</span>
      <h2>${title}</h2>
      <p>${statement}</p>
    </div>
    <span class="path-card-arrow" aria-hidden="true">↗</span>
  </a>`;
}

function renderHomeCanvas(): string {
  return `<div class="home-canvas">
    <section class="hero-stage" aria-label="Home 主视觉">
      <div class="hero-header">
        <span class="hero-signature">AgentLens</span>
      </div>
      <div class="hero-copy">
        <h1>Control Surface</h1>
      </div>
      <div class="hero-installation" aria-hidden="true">
        <div class="lens-core">
          <span class="lens-ring lens-ring-a"></span>
          <span class="lens-ring lens-ring-b"></span>
          <span class="lens-ring lens-ring-c"></span>
          <span class="lens-pulse lens-pulse-a"></span>
          <span class="lens-pulse lens-pulse-b"></span>
          <span class="lens-label lens-label-router">Router</span>
          <span class="lens-label lens-label-log">Log</span>
          <span class="lens-label lens-label-loop">Loop</span>
        </div>
      </div>
    </section>
    <section class="path-gallery" aria-label="首页路径">
      ${renderPathCard("/__router", "路由", "Router", "", "router-card")}
      ${renderPathCard("/__log", "归档", "Log", "", "log-card")}
      ${renderPathCard("/__loop", "循环", "Loop", "", "loop-card")}
    </section>
  </div>`;
}

export function renderHomeHtml(): string {
  return renderPageDocument({
    title: "AgentLens Home",
    styles: `
      ${WORKBENCH_LAYOUT_STYLES}
      .workbench-main {
        padding: 0;
        background:
          radial-gradient(circle at 14% 18%, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 32%),
          radial-gradient(circle at 88% 12%, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0) 28%),
          linear-gradient(180deg, #121212, #090909 72%, #040404);
      }
      .workbench-main::before {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 22%),
          linear-gradient(90deg, rgba(255, 255, 255, 0.04), transparent 18%),
          radial-gradient(circle at 78% 24%, rgba(255, 255, 255, 0.05), transparent 28%);
      }
      .page-shell.home-shell {
        min-height: 100%;
      }
      .home-canvas {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.95fr);
        gap: 24px;
        min-height: calc(100vh - 74px);
        padding: clamp(24px, 4vw, 42px);
        color: #f2f2f2;
      }
      .hero-stage,
      .path-card {
        position: relative;
        overflow: hidden;
      }
      .hero-stage {
        display: grid;
        grid-template-rows: auto 1fr 1fr;
        gap: clamp(18px, 3vw, 28px);
        min-height: clamp(520px, 72vh, 780px);
        padding: clamp(24px, 3vw, 34px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 34px;
        background:
          linear-gradient(150deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03) 42%, rgba(0, 0, 0, 0.2) 100%),
          linear-gradient(180deg, rgba(24, 24, 24, 0.92), rgba(12, 12, 12, 0.94));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.06),
          0 36px 90px rgba(0, 0, 0, 0.28);
      }
      .hero-stage::before {
        content: "";
        position: absolute;
        inset: 18px;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        pointer-events: none;
      }
      .hero-stage::after {
        content: "";
        position: absolute;
        right: -12%;
        bottom: -18%;
        width: 52%;
        aspect-ratio: 1;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 70%);
        filter: blur(14px);
      }
      .hero-header,
      .hero-copy,
      .hero-installation,
      .hero-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
      }
      .hero-signature,
      .path-card-kicker {
        font-family: "Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans SC", sans-serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }
      .hero-signature { color: rgba(255, 255, 255, 0.72); }
      .hero-copy {
        display: grid;
        align-content: start;
        max-width: 680px;
      }
      .path-card p {
        margin: 0;
        font-family: "Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans SC", sans-serif;
      }
      .hero-copy h1 {
        margin: 0;
        font-family: "Space Grotesk", "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
        font-size: clamp(68px, 10vw, 146px);
        line-height: 0.92;
        letter-spacing: -0.06em;
        color: #f5f5f5;
      }
      .hero-installation {
        display: grid;
        align-items: center;
      }
      .lens-core {
        position: relative;
        width: min(100%, 480px);
        aspect-ratio: 1.12;
        margin-left: auto;
      }
      .lens-ring,
      .lens-pulse {
        position: absolute;
        border-radius: 999px;
      }
      .lens-ring {
        inset: 50%;
        transform: translate(-50%, -50%);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .lens-ring-a {
        width: 84%;
        height: 84%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0) 68%);
      }
      .lens-ring-b {
        width: 56%;
        height: 56%;
        border-color: rgba(255, 255, 255, 0.18);
      }
      .lens-ring-c {
        width: 18%;
        height: 18%;
        border-color: rgba(255, 255, 255, 0.26);
        background: radial-gradient(circle, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.08));
        box-shadow:
          0 0 0 14px rgba(255, 255, 255, 0.08),
          0 24px 48px rgba(0, 0, 0, 0.24);
      }
      .lens-pulse {
        background: radial-gradient(circle, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0));
        filter: blur(10px);
      }
      .lens-pulse-a {
        top: 16%;
        left: 14%;
        width: 120px;
        height: 120px;
        animation: drift 16s ease-in-out infinite;
      }
      .lens-pulse-b {
        right: 10%;
        bottom: 8%;
        width: 142px;
        height: 142px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
        animation: drift 20s ease-in-out infinite reverse;
      }
      .lens-label {
        position: absolute;
        font-family: "Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans SC", sans-serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.58);
      }
      .lens-label::before {
        content: "";
        position: absolute;
        top: 50%;
        width: 54px;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0));
      }
      .lens-label-router {
        top: 14%;
        right: 8%;
      }
      .lens-label-router::before {
        right: calc(100% + 10px);
      }
      .lens-label-log {
        left: 10%;
        bottom: 18%;
      }
      .lens-label-log::before {
        left: calc(100% + 10px);
        transform: rotate(180deg);
      }
      .lens-label-loop {
        right: 22%;
        bottom: 8%;
      }
      .lens-label-loop::before {
        right: calc(100% + 10px);
      }
      .path-gallery {
        display: grid;
        gap: 18px;
        align-content: stretch;
      }
      .path-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 18px;
        align-items: center;
        min-height: 176px;
        padding: 24px 22px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        text-decoration: none;
        color: #f2f2f2;
        background:
          linear-gradient(155deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03) 46%, rgba(0, 0, 0, 0.18)),
          rgba(20, 20, 20, 0.9);
        box-shadow: 0 24px 56px rgba(0, 0, 0, 0.22);
        transition:
          transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
          box-shadow 280ms ease,
          border-color 280ms ease,
          background 280ms ease;
        animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .path-card::before {
        content: "";
        position: absolute;
        inset: 14px;
        border-radius: 22px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        pointer-events: none;
      }
      .path-card::after {
        content: "";
        position: absolute;
        right: -18%;
        bottom: -24%;
        width: 180px;
        height: 180px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0));
      }
      .path-card:hover {
        transform: translateY(-6px) rotate(-0.4deg);
        border-color: rgba(255, 255, 255, 0.16);
        box-shadow: 0 34px 78px rgba(0, 0, 0, 0.28);
      }
      .path-card:nth-child(2) {
        animation-delay: 70ms;
      }
      .path-card:nth-child(3) {
        animation-delay: 140ms;
      }
      .path-card-glyph {
        position: relative;
        width: 58px;
        height: 58px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
      .path-card-glyph span {
        position: absolute;
        inset: 50%;
        display: block;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        transform: translate(-50%, -50%);
      }
      .path-card-glyph span:nth-child(1) {
        width: 70%;
        height: 70%;
      }
      .path-card-glyph span:nth-child(2) {
        width: 42%;
        height: 42%;
      }
      .path-card-glyph span:nth-child(3) {
        width: 10px;
        height: 10px;
        background: rgba(255, 255, 255, 0.84);
        border-color: rgba(255, 255, 255, 0.84);
      }
      .path-card-body {
        display: grid;
        gap: 10px;
      }
      .path-card-kicker {
        color: rgba(255, 255, 255, 0.46);
      }
      .path-card h2 {
        margin: 0;
        font-family: "Space Grotesk", "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
        font-size: clamp(32px, 4vw, 48px);
        line-height: 1;
        letter-spacing: -0.04em;
      }
      .path-card p {
        display: none;
      }
      .path-card-arrow {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        font-size: 20px;
        color: #f5f5f5;
        transition: transform 220ms ease, background 220ms ease;
      }
      .path-card:hover .path-card-arrow {
        transform: translate(2px, -2px);
        background: rgba(255, 255, 255, 0.08);
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(26px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes drift {
        0%, 100% {
          transform: translate3d(0, 0, 0) scale(1);
        }
        50% {
          transform: translate3d(12px, -14px, 0) scale(1.06);
        }
      }
      @media (max-width: 1180px) {
        .home-canvas {
          grid-template-columns: 1fr;
        }
        .path-gallery {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .path-card {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .path-card-arrow {
          justify-self: start;
        }
        .lens-core {
          width: min(100%, 420px);
          margin-left: 0;
        }
      }
      @media (max-width: 780px) {
        .home-canvas {
          min-height: auto;
          padding: 18px;
        }
        .hero-stage {
          min-height: auto;
          padding: 20px;
          border-radius: 26px;
        }
        .hero-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .hero-copy h1 {
          font-size: clamp(54px, 18vw, 88px);
        }
        .hero-installation {
          min-height: 260px;
        }
        .path-gallery {
          grid-template-columns: 1fr;
        }
        .path-card {
          min-height: 0;
          padding: 20px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .path-card,
        .lens-pulse-a,
        .lens-pulse-b {
          animation: none;
        }
        .path-card,
        .path-card-arrow {
          transition: none;
        }
      }
    `,
    body: renderWorkbenchLayout(
      "/",
      `<div class="page-shell home-shell">
        ${renderHomeCanvas()}
      </div>`
    )
  });
}
