import { renderWorkbenchLayout } from "../shared/shell";
import { LogPageModel, RouterPageModel } from "../shared/page-models";
import { translations, Locale } from "../shared/i18n";

type ConsolePageContext = RouterPageModel | LogPageModel;

function t(key: string, locale: Locale): string {
  return translations[locale]?.[key as keyof typeof translations["en"]] as string || translations["en"][key as keyof typeof translations["en"]] as string || key;
}

function renderHeader(ctx: ConsolePageContext, locale: Locale): string {
  return `<div class="workbench-rail">
      <span class="workbench-rail-label">${ctx.pageSectionLabel}</span>
      <span class="workbench-rail-value">${ctx.pageContext}</span>
    </div>
    <section class="console-hero card">
      <div class="console-hero-main">
        <span class="eyebrow">${ctx.pageEyebrow}</span>
        <div class="hero-heading">
          <h1>${ctx.pageTitle}</h1>
        </div>
      </div>
      <aside class="console-hero-side">
        <div class="status hero-card">
          <div class="hero-status">
            <span id="runtimeBadge" class="badge dot">${ctx.kind === "router" ? t("loaded", locale) : t("online", locale)}</span>
            <span id="dirtyBadge" class="badge dot">${t("saved", locale)}</span>
          </div>
          <div class="hero-actions">
            <button id="saveBtn" data-default-label="${ctx.primaryActionLabel}">${ctx.primaryActionLabel}</button>
            <button class="ghost" id="reloadBtn">${t("reload", locale)}</button>
          </div>
        </div>
        <div id="msg" class="page-message"></div>
      </aside>
    </section>`;
}

function renderRouterSection(locale: Locale): string {
  return `<section class="router-layout">
    <div class="router-main-column">
      <article class="card workspace-panel">
        <div class="panel-header">
          <div>
            <div class="section-kicker">General</div>
            <h2>${t("routerConfig", locale)}</h2>
          </div>
        </div>
        <div class="grid router-grid-tight">
          <label class="field">${t("listenHost", locale)}<input id="listenHost" placeholder="127.0.0.1" /></label>
          <label class="field">${t("listenPort", locale)}<input id="listenPort" type="number" min="1" max="65535" /></label>
          <label class="field">${t("defaultProvider", locale)}<select id="defaultProvider"></select></label>
          <label class="field">${t("timeout", locale)}<input id="timeoutMs" type="number" min="1" /></label>
        </div>
      </article>

      <article class="card workspace-panel">
        <div class="panel-header">
          <div>
            <div class="section-kicker">Routing</div>
            <h2>${t("routes", locale)}</h2>
          </div>
        </div>
        <div class="grid router-grid-tight">
          <div class="field wide">
            <div class="section-kicker">Path Rules</div>
            <div class="muted">${locale === "zh" ? "按入口路径区分 OpenAI / Claude，请求体与剩余路径保持原样转发。" : "Route by path prefix for OpenAI / Claude, request body and remaining path forwarded as-is."}</div>
          </div>
        </div>
        <div class="panel-header panel-header-split">
          <div>
            <div class="section-kicker">Rules</div>
            <h2>${t("routes", locale)}</h2>
          </div>
          <button class="ghost" id="addRoute">${t("addRoute", locale)}</button>
        </div>
        <div class="provider-list" id="routesList"></div>
      </article>

      <article class="card workspace-panel">
        <div class="panel-header panel-header-split">
          <div>
            <div class="section-kicker">Providers</div>
            <h2>${locale === "zh" ? "上游" : "Upstream"}</h2>
          </div>
          <button class="ghost" id="addProvider">${t("addProvider", locale)}</button>
        </div>
        <div class="provider-list" id="providersList"></div>
        <div id="validationErrors" class="error-box"></div>
      </article>
    </div>
  </section>`;
}

function renderLogSection(modeTitle: string, locale: Locale): string {
  return `<section class="log-scene">
      <div class="log-top-grid">
        <article class="card workspace-panel">
          <div class="panel-header panel-header-split">
            <div>
            <div class="section-kicker">Viewer</div>
            <h2>${modeTitle} ${t("logs", locale)}</h2>
          </div>
          <span id="logState" class="badge warn dot">${t("loading", locale)}</span>
        </div>
        </article>
        <article class="card workspace-panel">
          <div class="panel-header">
            <div>
              <div class="section-kicker">Archive</div>
              <h2>${t("logConfig", locale)}</h2>
            </div>
          </div>
          <label class="field">${t("archiveRequests", locale)}
            <select id="archiveRequests">
              <option value="false">${locale === "zh" ? "关闭" : "OFF"}</option>
              <option value="true">${locale === "zh" ? "开启" : "ON"}</option>
            </select>
          </label>
        </article>
        <article class="card workspace-panel">
          <div class="panel-header">
            <div>
              <div class="section-kicker">Actions</div>
              <h2>${locale === "zh" ? "列表操作" : "List Actions"}</h2>
            </div>
          </div>
          <div class="log-actions-grid">
            <div class="log-actions-row">
              <div class="actions">
                <button class="ghost" id="logAutoBtn">${t("autoRefresh", locale)}：${t("on", locale)}</button>
                <button class="ghost" id="logRefreshBtn">${t("refresh", locale)}</button>
              </div>
              <label class="field log-limit-field">
                ${locale === "zh" ? "展示条数" : "Limit"}
                <select id="logLimit">
                  <option value="30">30</option>
                  <option value="60" selected>60</option>
                  <option value="100">100</option>
                </select>
              </label>
            </div>
            <details class="log-danger-tools">
              <summary>${locale === "zh" ? "危险操作" : "Danger Zone"}</summary>
              <div class="actions">
                <button class="danger" id="logCleanupFailedBtn">${t("cleanFailed", locale)}</button>
                <button class="danger" id="logCleanupAllBtn">${t("cleanAll", locale)}</button>
              </div>
            </details>
          </div>
        </article>
      </div>
      <div class="log-main-grid">
        <div class="log-list-shell">
          <div class="log-list-head">
            <div>
              <div class="log-panel-title">${locale === "zh" ? "已归档日志列表" : "Archived Logs"}</div>
            </div>
          </div>
          <div id="logOverview" class="overview-grid"></div>
          <div id="logArchiveBuckets" class="archive-buckets"></div>
          <div id="logList" class="log-list"></div>
        </div>
      </div>
    </section>`;
}

function renderJsonModal(locale: Locale): string {
  return `<div id="jsonModal" class="modal">
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <strong>${locale === "zh" ? "日志详情" : "Log Detail"}</strong>
        </div>
        <div class="actions modal-actions-primary">
          <button class="ghost" id="toggleJsonBtn">${t("collapse", locale)}</button>
          <button class="ghost" id="copyJsonBtn">${t("copyJson", locale)}</button>
          <button class="ghost" id="closeJsonBtn">${t("close", locale)}</button>
        </div>
      </div>
      <div class="actions modal-actions-secondary">
        <button class="ghost" id="expandAllJsonBtn">${t("expandAll", locale)}</button>
        <button class="ghost" id="collapseAllJsonBtn">${t("collapseAll", locale)}</button>
      </div>
      <div class="muted modal-summary" id="jsonMeta"></div>
      <div class="detail-grid">
        <section class="detail-pane">
          <div class="detail-pane-head">
            <div class="detail-pane-title">
              <strong>${t("request", locale)}</strong>
              <div class="detail-pane-actions">
                <span class="badge">body.text</span>
                <button class="ghost" id="copyRequestJsonBtn">${t("copyRequestJson", locale)}</button>
              </div>
            </div>
            <div class="detail-pane-meta" id="jsonRequestMeta"></div>
          </div>
          <div class="detail-pane-body">
            <div class="json-pre" id="jsonRequestContent"></div>
          </div>
        </section>
        <section class="detail-pane">
          <div class="detail-pane-head">
            <div class="detail-pane-title">
              <strong>${t("response", locale)}</strong>
              <div class="detail-pane-actions">
                <span class="badge" id="responseModeBadge">${t("rawResponse", locale)}</span>
                <button class="ghost" id="copyResponseJsonBtn">${t("copyResponseJson", locale)}</button>
              </div>
            </div>
            <div class="detail-pane-meta" id="jsonResponseMeta"></div>
          </div>
          <div class="detail-pane-body">
            <div class="summary-card" id="responseSummaryCard">
              <div class="summary-card-head">${locale === "zh" ? "响应文本摘要" : "Response Summary"}</div>
              <div class="summary-card-body" id="responseSummaryContent"></div>
            </div>
            <div class="json-pre" id="jsonResponseContent"></div>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

export function renderAdminBody(ctx: ConsolePageContext, locale: Locale): string {
  return renderWorkbenchLayout(ctx.activePath, `<div class="page-shell">
      ${renderHeader(ctx, locale)}
      <div class="section-stack">
        ${ctx.kind === "router" ? renderRouterSection(locale) : ""}
        ${ctx.kind === "log" ? renderLogSection(ctx.modeTitle, locale) : ""}
      </div>
    </div>

  ${ctx.kind === "log" ? renderJsonModal(locale) : ""}`);
}
