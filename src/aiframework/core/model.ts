import type {
  RuntimeModelChatRequest,
  RuntimeModelChatResponse,
  RuntimeModelClient,
  RuntimeModelProvider
} from "../runtime/contracts";

// Legacy facade: keep core model contract names as thin aliases.
// Single source of truth is runtime/contracts.
export type ModelProvider = RuntimeModelProvider;
export type ModelChatRequest = RuntimeModelChatRequest;
export type ModelChatResponse = RuntimeModelChatResponse;
export type ModelClient = RuntimeModelClient;
