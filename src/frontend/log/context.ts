import { LogPageModel } from "../shared/page-models";

export function buildLogPageContext(view: "all" | "openai" | "anthropic"): LogPageModel {
  const modeTitle = view === "openai" ? "OpenAI" : view === "anthropic" ? "Anthropic" : "All";
  const activePath = view === "openai" ? "/__log/openai" : view === "anthropic" ? "/__log/anthropic" : "/__log";

  return {
    kind: "log",
    activePath,
    modeTitle,
    pageTitle: `AgentLens Logs (${modeTitle})`,
    pageDescription: "按请求类型查看已归档的 request / response 配对，主视图坚持原生日志优先。",
    pageEyebrow: "Log",
    pageContext: `当前视图：${modeTitle} / 只显示带完整 archived detail 的记录`,
    pageSectionLabel: `Logs / ${modeTitle}`,
    primaryActionLabel: "保存归档设置",
    secondaryActionLabel: "从文件重载",
    statusTitle: "归档设置",
    statusDescription: "控制后续请求是否保存原始详情；现有归档日志的查看规则不变。"
  };
}
