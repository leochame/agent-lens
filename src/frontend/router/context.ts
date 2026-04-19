import { RouterPageModel } from "../shared/page-models";

export function buildRouterPageContext(): RouterPageModel {
  return {
    kind: "router",
    activePath: "/__router",
    pageTitle: "AgentLens Router",
    pageDescription: "继续保留透明转发能力，只重构配置界面的信息组织与工作台体验。",
    pageEyebrow: "Router",
    pageContext: "当前查看：路由配置 / 上游配置 / 默认路由 / 透明转发",
    pageSectionLabel: "Settings / Router",
    primaryActionLabel: "保存配置",
    secondaryActionLabel: "从文件重载",
    statusTitle: "配置状态",
    statusDescription: "保存后立即生效，不改变已有路由与转发语义。"
  };
}
