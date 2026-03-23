export type AuthMode =
  | "passthrough"
  | {
      type: "inject";
      header: string;
      valueFromEnv: string;
      valuePrefix?: string;
    };

export type PathRewriteRule = {
  from: string;
  to: string;
};

export type ProviderConfig = {
  baseURL: string;
  hostHeader?: string;
  authMode?: AuthMode;
  pathRewrite?: PathRewriteRule[];
};

export type RoutingConfig = {
  defaultProvider: string;
  byHeader?: string;
  byPathPrefix?: Record<string, string>;
  autoDetectProviderByFormat?: boolean;
  formatProviders?: {
    anthropic?: string;
    openai?: string;
  };
};

export type ListenConfig = {
  host: string;
  port: number;
};

export type LoggingConfig = {
  filePath: string;
  redactHeaders?: string[];
  redactBodyKeys?: string[];
  maxBodyBytes?: number;
  maxArchiveBodyBytes?: number;
};

export type AppConfig = {
  listen: ListenConfig;
  routing: RoutingConfig;
  providers: Record<string, ProviderConfig>;
  logging: LoggingConfig;
  requestTimeoutMs?: number;
};

export type RoutingDecision = {
  providerName: string;
  provider: ProviderConfig;
  targetPathWithQuery: string;
};
