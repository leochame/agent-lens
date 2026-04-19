import { AppConfig } from "../../router/provider/types";
import { renderAdminHtml } from "../admin/page";

export function renderLogHtml(
  view: "all" | "openai" | "anthropic" = "all",
  initialConfig: AppConfig | null = null
): string {
  return renderAdminHtml(view, initialConfig, { section: "log" });
}
