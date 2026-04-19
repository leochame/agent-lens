import { renderWorkbenchLayout } from "../shared/shell";
import { LogPageModel, RouterPageModel } from "../shared/page-models";

type ConsolePageContext = RouterPageModel | LogPageModel;

function renderHeader(ctx: ConsolePageContext): string {
  const isRouter = ctx.kind === "router";
  return `<div class="workbench-rail">
      <span class="workbench-rail-label">${ctx.pageSectionLabel}</span>
      <span class="workbench-rail-value">${ctx.pageContext}</span>
    </div>
    <section class="console-hero card">
      <div class="console-hero-main">
        <span class="eyebrow">${ctx.pageEyebrow}</span>
        <div class="hero-heading">
          <h1>${ctx.pageTitle}</h1>
          <p class="hero-description">${ctx.pageDescription}</p>
        </div>
        <div class="hero-principles">
          <div class="hero-principle">
            <strong>${isRouter ? "透明代理" : "原生归档"}</strong>
            <span>${isRouter ? "只重构配置工作台结构，不改变转发语义。" : "请求与响应展示必须忠于原始内容。"}</span>
          </div>
          <div class="hero-principle">
            <strong>${isRouter ? "Settings Layout" : "Viewer Layout"}</strong>
            <span>${isRouter ? "General、Routing、Providers 拆成独立面板，便于逐项校对。" : "日志范围通过侧栏切换，详情仍只做展示层增强。"}</span>
          </div>
        </div>
      </div>
      <aside class="console-hero-side">
        <div class="status hero-card">
          <div class="status-copy">
            <div class="status-title">${ctx.statusTitle}</div>
            <div class="status-desc">${ctx.statusDescription}</div>
          </div>
          <div class="hero-status">
            <span id="runtimeBadge" class="badge dot">${isRouter ? "配置已加载" : "日志服务正常"}</span>
            <span id="dirtyBadge" class="badge dot">已同步</span>
          </div>
          <div class="hero-actions">
            <button id="saveBtn" data-default-label="${ctx.primaryActionLabel}">${ctx.primaryActionLabel}</button>
            <button class="ghost" id="reloadBtn">${ctx.secondaryActionLabel}</button>
          </div>
        </div>
        <div id="msg" class="page-message"></div>
      </aside>
    </section>`;
}

function renderRouterSection(): string {
  return `<section class="router-layout">
    <div class="router-main-column">
      <article class="card workspace-panel">
        <div class="panel-header">
          <div>
            <div class="section-kicker">General</div>
            <h2>全局设置</h2>
          </div>
          <p class="section-note">监听、默认上游与超时策略集中维护，避免把基础项散落到多个区块。</p>
        </div>
        <div class="grid router-grid-tight">
          <label class="field">监听地址<input id="listenHost" placeholder="127.0.0.1" /></label>
          <label class="field">监听端口<input id="listenPort" type="number" min="1" max="65535" /></label>
          <label class="field">默认上游<select id="defaultProvider"></select></label>
          <label class="field">请求超时 (ms)<input id="timeoutMs" type="number" min="1" /></label>
        </div>
      </article>

      <article class="card workspace-panel">
        <div class="panel-header">
          <div>
            <div class="section-kicker">Routing</div>
            <h2>路由与分流</h2>
          </div>
          <p class="section-note">Router 继续保留透明转发能力，只整理配置界面的信息结构。</p>
        </div>
        <div class="grid router-grid-tight">
          <label class="field">路由请求头<input id="routeHeader" placeholder="x-target-provider" /></label>
          <label class="field">自动识别格式
            <select id="autoDetect">
              <option value="true">开启</option>
              <option value="false">关闭</option>
            </select>
          </label>
          <label class="field">Anthropic 默认上游<select id="anthropicProvider"></select></label>
          <label class="field">OpenAI 默认上游<select id="openaiProvider"></select></label>
        </div>
      </article>

      <article class="card workspace-panel">
        <div class="panel-header panel-header-split">
          <div>
            <div class="section-kicker">Providers</div>
            <h2>上游列表</h2>
          </div>
          <button class="ghost" id="addProvider">添加上游</button>
        </div>
        <p class="section-note">所有 provider 都仍然按当前配置格式保存与转发。</p>
        <div class="provider-list" id="providersList"></div>
        <div id="validationErrors" class="error-box"></div>
      </article>
    </div>

    <aside class="router-aside">
      <article class="mini-card">
        <span class="mini-kicker">治理原则</span>
        <strong>保留转发</strong>
        <p>配置只决定请求去向，不改变请求内容与转发透明度。</p>
      </article>
      <article class="mini-card">
        <span class="mini-kicker">配置检查</span>
        <strong>减少误配</strong>
        <p>监听、默认上游与 provider 选择拆到明确分区里，更接近 IDE 设置页。</p>
      </article>
      <article class="mini-card mini-card-accent">
        <span class="mini-kicker">工作流提示</span>
        <strong>先默认，后分流</strong>
        <p>先把默认上游和监听地址校准，再补路径前缀和格式识别，排错更快。</p>
      </article>
    </aside>
  </section>`;
}

function renderLogSection(modeTitle: string): string {
  return `<section class="log-scene">
      <div class="log-top-grid">
        <article class="card workspace-panel">
          <div class="panel-header panel-header-split">
            <div>
              <div class="section-kicker">Viewer</div>
              <h2>${modeTitle} 请求 / 响应日志</h2>
            </div>
            <span id="logState" class="badge warn dot">连接中</span>
          </div>
          <p class="section-note">按请求类型归档、按归档状态查看，详情页始终以原生日志内容为主，SSE 仅做展示聚合。</p>
        </article>
        <article class="card workspace-panel">
          <div class="panel-header">
            <div>
              <div class="section-kicker">Archive</div>
              <h2>归档设置</h2>
            </div>
          </div>
          <label class="field">原始请求/响应归档
            <select id="archiveRequests">
              <option value="false">关闭</option>
              <option value="true">开启</option>
            </select>
          </label>
          <div class="log-panel-copy">关闭后，新请求只保留摘要，不新增详情。只显示带归档详情的记录。</div>
        </article>
        <article class="card workspace-panel">
          <div class="panel-header">
            <div>
              <div class="section-kicker">Actions</div>
              <h2>列表操作</h2>
            </div>
          </div>
          <div class="log-actions-grid">
            <div class="log-actions-row">
              <div class="actions">
                <button class="ghost" id="logAutoBtn">自动刷新：开</button>
                <button class="ghost" id="logRefreshBtn">立即刷新</button>
              </div>
              <label class="field log-limit-field">
                展示条数
                <select id="logLimit">
                  <option value="30">30</option>
                  <option value="60" selected>60</option>
                  <option value="100">100</option>
                </select>
              </label>
            </div>
            <details class="log-danger-tools">
              <summary>危险操作</summary>
              <div class="actions">
                <button class="danger" id="logCleanupFailedBtn">清理请求失败文档</button>
                <button class="danger" id="logCleanupAllBtn">清理所有文档</button>
              </div>
            </details>
          </div>
        </article>
      </div>
      <div class="log-main-grid">
        <div class="log-list-shell">
          <div class="log-list-head">
            <div>
              <div class="log-panel-title">已归档日志列表</div>
              <div class="log-panel-copy">只显示带归档详情的记录；请求保持原生聚焦，响应仅在展示层做 JSON/SSE 阅读增强。</div>
            </div>
          </div>
          <div id="logOverview" class="overview-grid"></div>
          <div id="logArchiveBuckets" class="archive-buckets"></div>
          <div id="logList" class="log-list"></div>
        </div>
      </div>
    </section>`;
}

function renderJsonModal(): string {
  return `<div id="jsonModal" class="modal">
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <strong>日志详情</strong>
          <div class="modal-subtitle">请求保持原生聚焦，响应支持 SSE 聚合展示与 JSON 树查看。</div>
        </div>
        <div class="actions modal-actions-primary">
          <button class="ghost" id="toggleJsonBtn">收起</button>
          <button class="ghost" id="copyJsonBtn">复制 JSON</button>
          <button class="ghost" id="closeJsonBtn">关闭</button>
        </div>
      </div>
      <div class="actions modal-actions-secondary">
        <button class="ghost" id="expandAllJsonBtn">全部展开</button>
        <button class="ghost" id="collapseAllJsonBtn">全部收起</button>
      </div>
      <div class="muted modal-summary" id="jsonMeta"></div>
      <div class="detail-grid">
        <section class="detail-pane">
          <div class="detail-pane-head">
            <div class="detail-pane-title">
              <strong>请求</strong>
              <div class="detail-pane-actions">
                <span class="badge">body.text</span>
                <button class="ghost" id="copyRequestJsonBtn">复制请求</button>
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
              <strong>响应</strong>
              <div class="detail-pane-actions">
                <span class="badge" id="responseModeBadge">原始响应</span>
                <button class="ghost" id="copyResponseJsonBtn">复制响应</button>
              </div>
            </div>
            <div class="detail-pane-meta" id="jsonResponseMeta"></div>
          </div>
          <div class="detail-pane-body">
            <div class="summary-card" id="responseSummaryCard">
              <div class="summary-card-head">响应文本摘要</div>
              <div class="summary-card-body" id="responseSummaryContent"></div>
            </div>
            <div class="json-pre" id="jsonResponseContent"></div>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

export function renderAdminBody(ctx: ConsolePageContext): string {
  return renderWorkbenchLayout(ctx.activePath, `<div class="page-shell">
      ${renderHeader(ctx)}
      <div class="section-stack">
        ${ctx.kind === "router" ? renderRouterSection() : ""}
        ${ctx.kind === "log" ? renderLogSection(ctx.modeTitle) : ""}
      </div>
    </div>

  ${ctx.kind === "log" ? renderJsonModal() : ""}`);
}
