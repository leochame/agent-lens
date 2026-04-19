export type ProductArea = {
  name: string;
  path: string;
  kicker: string;
  title: string;
  description: string;
  children?: ProductArea[];
};

export const PRODUCT_AREAS: ProductArea[] = [
  {
    name: "Home",
    path: "/",
    kicker: "Home",
    title: "入口与分流",
    description: "只做判断与跳转，不承载业务操作。"
  },
  {
    name: "Router",
    path: "/__router",
    kicker: "Router",
    title: "上游与转发",
    description: "配置上游、provider 与转发规则。"
  },
  {
    name: "Log",
    path: "/__log",
    kicker: "Log",
    title: "归档与详情",
    description: "查看已归档日志，保持 requestId 一一对应。",
    children: [
      {
        name: "All",
        path: "/__log",
        kicker: "All",
        title: "全部归档",
        description: "查看全部带归档详情的记录。"
      },
      {
        name: "OpenAI",
        path: "/__log/openai",
        kicker: "OpenAI",
        title: "OpenAI 归档",
        description: "只看 OpenAI 相关的归档详情。"
      },
      {
        name: "Anthropic",
        path: "/__log/anthropic",
        kicker: "Anthropic",
        title: "Anthropic 归档",
        description: "只看 Anthropic 相关的归档详情。"
      }
    ]
  },
  {
    name: "Loop",
    path: "/__loop",
    kicker: "Loop",
    title: "Workflow 与运行",
    description: "搭建 workflow，查看队列与历史。"
  }
];
