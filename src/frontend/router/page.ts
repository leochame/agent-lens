import { AppConfig } from "../../router/provider/types";
import { renderAdminHtml } from "../admin/page";

export function renderRouterHtml(initialConfig: AppConfig | null = null): string {
  return renderAdminHtml("all", initialConfig, { section: "router" });
}
