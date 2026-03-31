import type { RuntimeMemoryStore, RuntimeTaskMemoryRecord } from "../runtime/contracts";

// Legacy facade: keep core memory contract names as thin aliases.
// Single source of truth is runtime/contracts.
export type TaskMemoryRecord = RuntimeTaskMemoryRecord;
export type MemoryStore = RuntimeMemoryStore;
