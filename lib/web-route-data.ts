import "server-only";

export type WebRouteMode = "WALKING" | "TRANSIT" | "DRIVING";

export type WebRoutePoint = {
  latitude: number;
  longitude: number;
};

export type WebRouteSegment = {
  type: string;
  lineName: string;
  points: WebRoutePoint[];
};

export type WebRouteResult = {
  mode: WebRouteMode;
  totalDistanceMeters: number;
  totalMinutes: number;
  segments: WebRouteSegment[];
  landingURL: string | null;
  isEstimated: boolean;
};

type JsonRecord = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 12_000;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function validPoint(value: unknown): WebRoutePoint | null {
  const row = record(value);
  const latitude = number(row.latitude);
  const longitude = number(row.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < 32 || latitude > 39.5 || longitude < 123 || longitude > 132) return null;
  return { latitude, longitude };
}

function samePoint(a: WebRoutePoint, b: WebRoutePoint) {
  return Math.abs(a.latitude - b.latitude) < 0.0000001
    && Math.abs(a.longitude - b.longitude) < 0.0000001;
}

function normalizeSegments(value: unknown): WebRouteSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawSegment) => {
    const segment = record(rawSegment);
    const points = (Array.isArray(segment.points) ? segment.points : [])
      .map(validPoint)
      .filter((point): point is WebRoutePoint => Boolean(point))
      .filter((point, index, all) => index === 0 || !samePoint(point, all[index - 1]));
    if (points.length < 2) return [];
    return [{
      type: text(segment.type) ?? "ROUTE",
      lineName: text(segment.lineName) ?? "추천 경로",
      points,
    }];
  });
}

function completeEndpoints(
  segments: WebRouteSegment[],
  origin: WebRoutePoint,
  destination: WebRoutePoint,
) {
  if (!segments.length) return [];
  const completed = segments.map((segment) => ({ ...segment, points: [...segment.points] }));
  if (!samePoint(completed[0].points[0], origin)) {
    completed[0].points.unshift(origin);
  }
  const last = completed[completed.length - 1];
  if (!samePoint(last.points[last.points.length - 1], destination)) {
    last.points.push(destination);
  }
  return completed;
}

async function readBindings() {
  const processBindings = typeof process !== "undefined"
    ? process.env
    : {} as Record<string, string | undefined>;
  let baseUrl = text(processBindings.DONGNEGOGO_SUPABASE_URL);
  let publishableKey = text(processBindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);

  if (!baseUrl || !publishableKey) {
    try {
      const { env } = await import("cloudflare:workers");
      const bindings = env as unknown as Record<string, unknown>;
      baseUrl ??= text(bindings.DONGNEGOGO_SUPABASE_URL);
      publishableKey ??= text(bindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);
    } catch {
      // The Node build does not expose Cloudflare runtime bindings.
    }
  }

  if (!baseUrl || !publishableKey?.startsWith("sb_publishable_")) {
    throw new Error("동네고고 경로 연결 설정을 확인해 주세요.");
  }
  const projectUrl = new URL(baseUrl);
  if (projectUrl.protocol !== "https:" || !projectUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("동네고고 경로 주소가 올바르지 않습니다.");
  }
  return { projectUrl, publishableKey };
}

async function invoke(functionName: string, body: JsonRecord) {
  const { projectUrl, publishableKey } = await readBindings();
  const endpoint = new URL(`/functions/v1/${functionName}`, projectUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      apikey: publishableKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(text(record(payload).error) ?? "실제 경로를 불러오지 못했어요.");
  }
  return record(payload);
}

export async function fetchWebRoute(input: {
  mode: WebRouteMode;
  origin: WebRoutePoint;
  destination: WebRoutePoint;
  destinationName?: string;
}): Promise<WebRouteResult> {
  const origin = validPoint(input.origin);
  const destination = validPoint(input.destination);
  if (!origin || !destination) throw new Error("출발지 또는 목적지 좌표를 확인해 주세요.");

  const payload = input.mode === "TRANSIT"
    ? record((await invoke("facility-transit-info", {
      origin,
      facility: { ...destination, name: input.destinationName?.slice(0, 120) ?? "시설" },
      includeRoute: true,
      includeStationJourneys: false,
      fastRoute: true,
    })).route)
    : await invoke("android-route-directions", {
      mode: input.mode,
      origin,
      destination,
    });

  const totalDistanceMeters = Math.max(0, Math.round(number(payload.totalDistanceMeters) ?? 0));
  const totalMinutes = Math.max(0, Math.round(number(payload.totalMinutes) ?? 0));
  const segments = completeEndpoints(normalizeSegments(payload.segments), origin, destination);
  if (!totalDistanceMeters || !totalMinutes || !segments.length) {
    throw new Error("이 위치 사이의 실제 경로를 찾지 못했어요.");
  }
  return {
    mode: input.mode,
    totalDistanceMeters,
    totalMinutes,
    segments,
    landingURL: text(payload.landingURL),
    isEstimated: false,
  };
}
