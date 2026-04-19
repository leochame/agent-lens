export type LoopToolCall = {
  name: string;
  input?: unknown;
  cwd: string;
  stepName?: string;
};

export type LoopToolResult = {
  success: boolean;
  output: string;
  error?: string | null;
};

export type LoopToolDefinition = {
  name: string;
  description?: string;
  execute: (call: LoopToolCall) => Promise<LoopToolResult> | LoopToolResult;
};

export class LoopToolRegistry {
  private readonly tools: Map<string, LoopToolDefinition> = new Map();

  register(def: LoopToolDefinition): void {
    const name = String(def?.name ?? "").trim();
    if (!name) {
      throw new Error("tool name is required");
    }
    this.tools.set(name, { ...def, name });
  }

  find(name: string): LoopToolDefinition | undefined {
    return this.tools.get(String(name ?? "").trim());
  }

  async execute(call: LoopToolCall): Promise<LoopToolResult> {
    const name = String(call?.name ?? "").trim();
    if (!name) {
      return {
        success: false,
        output: "",
        error: "tool name is required"
      };
    }
    const tool = this.find(name);
    if (!tool) {
      return {
        success: false,
        output: "",
        error: `tool not found: ${name}`
      };
    }
    try {
      const result = await tool.execute({ ...call, name });
      return {
        success: !!result?.success,
        output: String(result?.output ?? ""),
        error: result?.error ? String(result.error) : null
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
