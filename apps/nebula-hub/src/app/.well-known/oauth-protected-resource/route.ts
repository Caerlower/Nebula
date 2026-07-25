import { appBaseUrl } from "@/lib/app-url";

export async function GET() {
  const base = appBaseUrl();
  return Response.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
  });
}
