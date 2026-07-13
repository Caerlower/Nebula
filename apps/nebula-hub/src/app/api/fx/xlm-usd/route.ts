import { cachedJsonResponse } from "@/lib/route-cache";

import { quoteXlmUsd } from "@/lib/fx";

export const dynamic = "force-dynamic";

async function uncachedGET() {
  try {
    const quote = await quoteXlmUsd();
    return Response.json({
      status: "ok",
      usd_per_xlm: quote.usdPerXlm,
      source: quote.source,
      unit: "USD per 1 XLM",
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        reason:
          error instanceof Error ? error.message : "xlm_usd_price_unavailable",
      },
      { status: 503 },
    );
  }
}

export async function GET() {
  return cachedJsonResponse("fx:xlm-usd", 60_000, () => uncachedGET());
}
