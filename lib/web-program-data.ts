import "server-only";

const REQUEST_TIMEOUT_MS = 6_000;
const MAX_RESULT_LIMIT = 500;

export type WebProgram = {
  id: string;
  name: string;
  category: string;
  field: string;
  facility: string;
  room: string | null;
  address: string | null;
  area: string;
  latitude: number;
  longitude: number;
  isFree: boolean;
  feeText: string;
  status: string;
  audiences: string[];
  scheduleText: string | null;
  periodText: string | null;
  receiptStart: string | null;
  receiptEnd: string | null;
  applyUrl: string | null;
  phone: string | null;
  summary: string;
  requirement: string | null;
  preparation: string | null;
  imageUrl: string | null;
  source: string | null;
};

type ProgramRow = Record<string, unknown>;

type ProgramQuery = {
  south?: number;
  west?: number;
  north?: number;
  east?: number;
  query?: string;
  id?: string;
  limit?: number;
};

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function plainText(value: unknown, maxLength = 1_200): string {
  const raw = textValue(value) ?? "";
  const result = raw
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<!--[\s\S]*/g, " ")
    .replace(/\[data-hwpjson\][\s\S]*/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&rarr;/gi, "→")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return result.length > maxLength ? `${result.slice(0, maxLength).trim()}…` : result;
}

function safePublicUrl(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function normalizedProgram(row: ProgramRow): WebProgram | null {
  const id = textValue(row.id);
  const name = textValue(row.name);
  const latitude = numberValue(row.latitude);
  const longitude = numberValue(row.longitude);
  if (!id || !name || latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return {
    id,
    name,
    category: textValue(row.category) ?? "프로그램",
    field: textValue(row.field) ?? "",
    facility: textValue(row.facility) ?? "장소 정보 확인 중",
    room: textValue(row.room),
    address: textValue(row.address),
    area: textValue(row.area) ?? "",
    latitude,
    longitude,
    isFree: row.is_free === true,
    feeText: textValue(row.fee_text) ?? "신청 페이지에서 확인",
    status: textValue(row.status) ?? "일정 확인",
    audiences: Array.isArray(row.audiences)
      ? row.audiences.map(textValue).filter((value): value is string => Boolean(value))
      : [],
    scheduleText: textValue(row.schedule_text),
    periodText: textValue(row.period_text),
    receiptStart: textValue(row.receipt_start),
    receiptEnd: textValue(row.receipt_end),
    applyUrl: safePublicUrl(row.apply_url),
    phone: textValue(row.phone),
    summary: plainText(row.summary) || "자세한 내용은 신청 페이지에서 확인해 주세요.",
    requirement: textValue(row.requirement),
    preparation: textValue(row.preparation),
    imageUrl: safePublicUrl(row.primary_image_url),
    source: textValue(row.source),
  };
}

function safeSearchTerm(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[,*()'"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function readBindings() {
  const processBindings = typeof process !== "undefined"
    ? process.env
    : {} as Record<string, string | undefined>;
  let baseUrl = textValue(processBindings.DONGNEGOGO_SUPABASE_URL)
    ?? textValue(processBindings.NEXT_PUBLIC_SUPABASE_URL);
  let publishableKey = textValue(processBindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY)
    ?? textValue(processBindings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!baseUrl || !publishableKey) {
    try {
      const { env } = await import("cloudflare:workers");
      const bindings = env as unknown as Record<string, unknown>;
      baseUrl ??= textValue(bindings.DONGNEGOGO_SUPABASE_URL)
        ?? textValue(bindings.NEXT_PUBLIC_SUPABASE_URL);
      publishableKey ??= textValue(bindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY)
        ?? textValue(bindings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    } catch {
      // The Node build does not expose Cloudflare runtime bindings.
    }
  }

  if (!baseUrl || !publishableKey?.startsWith("sb_publishable_")) {
    throw new Error("동네고고 공개 데이터 연결 설정을 확인해 주세요.");
  }
  const projectUrl = new URL(baseUrl);
  if (projectUrl.protocol !== "https:" || !projectUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("동네고고 공개 데이터 주소가 올바르지 않습니다.");
  }
  return { projectUrl, publishableKey };
}

export async function fetchWebPrograms(input: ProgramQuery): Promise<WebProgram[]> {
  const { projectUrl, publishableKey } = await readBindings();
  const endpoint = new URL("/rest/v1/programs", projectUrl);
  const params = endpoint.searchParams;
  params.set("select", [
    "id", "name", "category", "field", "facility", "room", "address", "area",
    "latitude", "longitude", "is_free", "fee_text", "status", "audiences",
    "schedule_text", "period_text", "receipt_start", "receipt_end", "apply_url",
    "phone", "summary", "requirement", "preparation", "primary_image_url", "source",
  ].join(","));

  if (input.id) {
    params.set("id", `eq.${input.id.slice(0, 180)}`);
    params.set("limit", "1");
  } else {
    if ([input.south, input.west, input.north, input.east].every(Number.isFinite)) {
      const south = Math.max(-90, Math.min(90, Math.min(input.south!, input.north!)));
      const north = Math.max(-90, Math.min(90, Math.max(input.south!, input.north!)));
      const west = Math.max(-180, Math.min(180, Math.min(input.west!, input.east!)));
      const east = Math.max(-180, Math.min(180, Math.max(input.west!, input.east!)));
      params.set("latitude", `gte.${south}`);
      params.append("latitude", `lte.${north}`);
      params.set("longitude", `gte.${west}`);
      params.append("longitude", `lte.${east}`);
    }
    const query = safeSearchTerm(input.query ?? "");
    if (query) {
      const pattern = `*${query.replace(/\s+/g, "*")}*`;
      params.set("or", `(name.ilike.${pattern},facility.ilike.${pattern},category.ilike.${pattern},field.ilike.${pattern},area.ilike.${pattern})`);
    }
    params.set("limit", String(Math.max(1, Math.min(MAX_RESULT_LIMIT, input.limit ?? 350))));
    params.set("order", "receipt_end.asc.nullslast,name.asc");
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { accept: "application/json", apikey: publishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`공개 프로그램을 불러오지 못했습니다. (${response.status})`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload.map((row) => normalizedProgram(row as ProgramRow)).filter((row): row is WebProgram => Boolean(row));
}
