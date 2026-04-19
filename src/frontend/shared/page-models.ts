export type ShellContext = {
  activePath: string;
  pageTitle: string;
  pageEyebrow: string;
  pageContext: string;
  pageDescription: string;
  pageSectionLabel: string;
};

export type RouterPageModel = ShellContext & {
  kind: "router";
  primaryActionLabel: string;
  secondaryActionLabel: string;
  statusTitle: string;
  statusDescription: string;
};

export type LogPageModel = ShellContext & {
  kind: "log";
  primaryActionLabel: string;
  secondaryActionLabel: string;
  statusTitle: string;
  statusDescription: string;
  modeTitle: string;
};
