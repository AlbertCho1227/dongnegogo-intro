import "server-only";

import { unstable_cache } from "next/cache";

const STATS_RPC = "get_public_program_stats_v1";
const CACHE_SECONDS = 86_400;
const REQUEST_TIMEOUT_MS = 2_000;
const FALLBACK_RETRY_SECONDS = 300;

export type PublicProgramStats = {
  snapshotDate: string;
  totalCount: number;
  cultureCount: number;
  performanceCount: number;
  educationCount: number;
  sportsCount: number;
  source: "rpc" | "fallback";
};

// Verified against the Seoul production RPC on 2026-08-11. This is used only
// when runtime bindings, the network, or the response contract are unavailable.
const LAST_KNOWN_PROGRAM_STATS: PublicProgramStats = Object.freeze({
  snapshotDate: "2026-08-11",
  totalCount: 39_844,
  cultureCount: 16_929,
  performanceCount: 2_390,
  educationCount: 12_960,
  sportsCount: 9_315,
  source: "fallback",
});

type StatsRpcRow = {
  snapshot_date?: unknown;
  total_count?: unknown;
  culture_count?: unknown;
  performance_count?: unknown;
  education_count?: unknown;
  sports_count?: unknown;
};

function normalizedBinding(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function readServerBindings() {
  const processBindings = typeof process !== "undefined"
    ? process.env
    : {} as Record<string, string | undefined>;
  let baseUrl = normalizedBinding(processBindings.DONGNEGOGO_SUPABASE_URL);
  let publishableKey = normalizedBinding(processBindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);

  if (!baseUrl || !publishableKey) {
    try {
      const { env: workerBindings } = await import("cloudflare:workers");
      const bindings = workerBindings as unknown as Record<string, unknown>;
      baseUrl ??= normalizedBinding(bindings.DONGNEGOGO_SUPABASE_URL);
      publishableKey ??= normalizedBinding(bindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);
    } catch {
      // Node-based build and render tests do not expose the Cloudflare module.
    }
  }

  return { baseUrl, publishableKey };
}

function parseCount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseStatsResponse(payload: unknown): PublicProgramStats | null {
  if (!Array.isArray(payload) || payload.length !== 1) return null;

  const row = payload[0] as StatsRpcRow | null;
  if (!row || typeof row !== "object") return null;

  const snapshotDate = row.snapshot_date;
  const totalCount = parseCount(row.total_count);
  const cultureCount = parseCount(row.culture_count);
  const performanceCount = parseCount(row.performance_count);
  const educationCount = parseCount(row.education_count);
  const sportsCount = parseCount(row.sports_count);

  if (
    typeof snapshotDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate) ||
    totalCount === null ||
    cultureCount === null ||
    performanceCount === null ||
    educationCount === null ||
    sportsCount === null ||
    cultureCount > totalCount ||
    performanceCount > totalCount ||
    educationCount > totalCount ||
    sportsCount > totalCount
  ) {
    return null;
  }

  return {
    snapshotDate,
    totalCount,
    cultureCount,
    performanceCount,
    educationCount,
    sportsCount,
    source: "rpc",
  };
}

async function fetchProgramStats(): Promise<PublicProgramStats> {
  const { baseUrl, publishableKey } = await readServerBindings();

  if (!baseUrl || !publishableKey) {
    throw new Error("Program stats server bindings are unavailable.");
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Program stats requires a modern publishable key.");
  }

  const projectUrl = new URL(baseUrl);
  if (
    projectUrl.protocol !== "https:" ||
    !projectUrl.hostname.endsWith(".supabase.co") ||
    projectUrl.username ||
    projectUrl.password
  ) {
    throw new Error("Program stats server URL is invalid.");
  }

  const endpoint = new URL(`/rest/v1/rpc/${STATS_RPC}`, projectUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      apikey: publishableKey,
      "content-type": "application/json",
    },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Program stats request failed with ${response.status}.`);
  }

  const stats = parseStatsResponse(await response.json());
  if (!stats) {
    throw new Error("Program stats response did not match the expected contract.");
  }

  return stats;
}

const getDailyProgramStats = unstable_cache(
  fetchProgramStats,
  ["dongnegogo", STATS_RPC],
  { revalidate: CACHE_SECONDS },
);

const getResilientProgramStats = unstable_cache(async () => {
  try {
    return await getDailyProgramStats();
  } catch (error) {
    console.error("[program-stats] refresh failed; serving the last verified snapshot.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return LAST_KNOWN_PROGRAM_STATS;
  }
}, ["dongnegogo", STATS_RPC, "resilient"], {
  revalidate: FALLBACK_RETRY_SECONDS,
});

export async function getPublicProgramStats(): Promise<PublicProgramStats> {
  return getResilientProgramStats();
}
