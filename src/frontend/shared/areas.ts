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
    path: "/__home",
    kicker: "Home",
    title: "Entry",
    description: ""
  },
  {
    name: "Router",
    path: "/__router",
    kicker: "Router",
    title: "Routing",
    description: ""
  },
  {
    name: "Log",
    path: "/__log",
    kicker: "Log",
    title: "Archive",
    description: "",
    children: [
      {
        name: "All",
        path: "/__log",
        kicker: "All",
        title: "All",
        description: ""
      },
      {
        name: "OpenAI",
        path: "/__log/openai",
        kicker: "OpenAI",
        title: "OpenAI",
        description: ""
      },
      {
        name: "Anthropic",
        path: "/__log/anthropic",
        kicker: "Anthropic",
        title: "Anthropic",
        description: ""
      }
    ]
  },
  {
    name: "Loop",
    path: "/__loop",
    kicker: "Loop",
    title: "Workflow",
    description: ""
  }
];
