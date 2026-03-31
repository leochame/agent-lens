import type {
  RuntimeToolCall,
  RuntimeToolDefinition,
  RuntimeToolExecutor,
  RuntimeToolResult
} from "../runtime/contracts";

// Legacy facade: keep core tool contract names as thin aliases.
// Single source of truth is runtime/contracts.
export type ToolCall = RuntimeToolCall;
export type ToolResult = RuntimeToolResult;
export type ToolDefinition = RuntimeToolDefinition;
export type ToolExecutor = RuntimeToolExecutor;
