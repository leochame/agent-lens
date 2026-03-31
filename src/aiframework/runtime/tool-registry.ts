import { ToolCall, ToolDefinition, ToolExecutor, ToolResult } from "./contracts";

export class ToolRegistry implements ToolExecutor {
  private readonly tools: Map<string, ToolDefinition> = new Map();

  register(def: ToolDefinition): void {
    const name = String(def?.name ?? "").trim();
    if (!name) {
      throw new Error("tool name is required");
    }
    this.tools.set(name, { ...def, name });
  }

  find(name: string): ToolDefinition | undefined {
    const cleanName = String(name ?? "").trim();
    return this.tools.get(cleanName);
  }

  async execute(call: ToolCall): Promise<ToolResult> {
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
