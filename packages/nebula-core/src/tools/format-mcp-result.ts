/**
 * Format a Hub ToolResult for MCP clients (stdio + Streamable HTTP).
 * Always surfaces `data` so agents see friendbot URLs, balances, etc.
 */
import type { ToolResult } from "../types/context.js";

export function formatToolResultForMcp(data: ToolResult): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  if (data.status === "confirmation_required") {
    return {
      content: [
        {
          type: "text",
          text: [
            "Confirmation required.",
            data.summary ?? "",
            data.approve_url ? `Approve at: ${data.approve_url}` : "",
            data.confirmation_id ? `ID: ${data.confirmation_id}` : "",
            data.confirmation_id
              ? `Then call await_confirmation with confirmation_id=${data.confirmation_id}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  }

  if (data.status === "rejected") {
    return {
      content: [
        {
          type: "text",
          text: `Rejected: ${data.reason ?? "unknown"}`,
        },
      ],
      isError: true,
    };
  }

  if (data.status === "error") {
    return {
      content: [
        {
          type: "text",
          text: data.reason ?? "error",
        },
      ],
      isError: true,
    };
  }

  const lines = [
    data.message ?? "Success",
    data.tx_hash ? `Transaction: ${data.tx_hash}` : "",
    data.explorer_url ?? "",
  ].filter(Boolean);

  if (data.data != null && Object.keys(data.data).length > 0) {
    try {
      lines.push(JSON.stringify(data.data, null, 2));
    } catch {
      lines.push(String(data.data));
    }
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
