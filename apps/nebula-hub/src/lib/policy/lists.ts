import type { AuthPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Resolve which agent a whitelist/denylist mutation or read applies to.
 * MCP tokens are locked to their bound agent; dashboard must pass agentId.
 */
export async function resolveListAgentId(
  principal: AuthPrincipal,
  requestedAgentId: string | null | undefined,
): Promise<string | null> {
  if (principal.source === "nebula_token") {
    return principal.agentId;
  }
  const agentId = requestedAgentId?.trim() || null;
  if (!agentId) return null;
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId: principal.userId },
    select: { id: true },
  });
  return agent?.id ?? null;
}

export function agentIdFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("agentId")?.trim() || null;
}
