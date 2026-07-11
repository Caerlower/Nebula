import { MppBudgetExceededError } from "./client.js";
import { requireActiveMppSession } from "./session.js";

export type MppFetchResult =
  | {
      ok: true;
      status: number;
      body: string;
      cumulativeStroops: bigint;
    }
  | { ok: false; error: string };

export async function mppFetch(url: string): Promise<MppFetchResult> {
  const sessionState = requireActiveMppSession();
  if (!sessionState.ok) {
    return sessionState;
  }

  const { session } = sessionState;

  try {
    const response = await session.mppx.fetch(url);
    const body = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        error: `MPP fetch failed with HTTP ${response.status}: ${body.slice(0, 500)}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      body,
      cumulativeStroops: session.cumulativeStroops,
    };
  } catch (error) {
    if (error instanceof MppBudgetExceededError) {
      return { ok: false, error: error.message };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatMppFetchResult(result: Extract<MppFetchResult, { ok: true }>): string {
  const spent = Number(result.cumulativeStroops) / 10_000_000;
  return [
    `HTTP ${result.status}`,
    `Session cumulative committed: ${spent.toFixed(7).replace(/\.?0+$/, "")} USDC`,
    "",
    result.body,
  ].join("\n");
}
