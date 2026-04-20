import { RouterPageModel } from "../shared/page-models";

export function buildRouterPageContext(): RouterPageModel {
  return {
    kind: "router",
    activePath: "/__router",
    pageTitle: "AgentLens Router",
    pageDescription: "",
    pageEyebrow: "Router",
    pageContext: "Router",
    pageSectionLabel: "Settings / Router",
    primaryActionLabel: "保存配置",
    secondaryActionLabel: "从文件重载",
    statusTitle: "",
    statusDescription: ""
  };
}
