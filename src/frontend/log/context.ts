import { LogPageModel } from "../shared/page-models";

export function buildLogPageContext(view: "all" | "openai" | "anthropic"): LogPageModel {
  const modeTitle = view === "openai" ? "OpenAI" : view === "anthropic" ? "Anthropic" : "All";
  const activePath = view === "openai" ? "/__log/openai" : view === "anthropic" ? "/__log/anthropic" : "/__log";

  return {
    kind: "log",
    activePath,
    modeTitle,
    pageTitle: `AgentLens Logs (${modeTitle})`,
    pageDescription: "",
    pageEyebrow: "Log",
    pageContext: modeTitle,
    pageSectionLabel: `Logs / ${modeTitle}`,
    primaryActionLabel: "保存归档设置",
    secondaryActionLabel: "从文件重载",
    statusTitle: "",
    statusDescription: ""
  };
}
