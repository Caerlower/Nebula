import { appBaseUrl } from "@/lib/oauth";

export async function GET() {
  const base = appBaseUrl();
  return Response.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
  });
}
