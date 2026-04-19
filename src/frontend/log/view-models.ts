export type RawTextView = {
  rawText: string;
  parsedJson: unknown | null;
  source: "archive" | "summary-fallback";
};

export type JsonTreeNode = {
  key: string | null;
  path: string;
  kind: "object" | "array" | "string" | "number" | "boolean" | "null";
  preview: string;
  children?: JsonTreeNode[];
};

export type SseAggregatedResponseView = {
  source: "sse" | "non-sse";
  aggregatedForDisplay: boolean;
  summaryText: string;
  eventCount: number;
  doneSeen: boolean;
};
