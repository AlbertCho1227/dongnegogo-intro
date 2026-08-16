import "server-only";

import { unstable_cache } from "next/cache";

import { dedupeImagesByContent, imageContentIdentity } from "@/lib/image-content-identity";

const REQUEST_TIMEOUT_MS = 2_500;
const CACHE_SECONDS = 300;
const MAX_PROGRAM_ID_LENGTH = 180;

export type SharedProgramImage = {
  url: string;
  thumbnailUrl: string | null;
  role: string;
  attribution: string | null;
  license: string | null;
  licenseUrl: string | null;
};

export type SharedProgram = {
  id: string;
  name: string;
  category: string;
  field: string;
  facility: string;
  room: string | null;
  address: string | null;
  area: string;
  latitude: number | null;
  longitude: number | null;
  isFree: boolean;
  feeText: string;
  status: string;
  receiptEnd: string | null;
  scheduleText: string | null;
  periodText: string | null;
  audiences: string[];
  description: string;
  images: SharedProgramImage[];
};

type ProgramRow = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  field?: unknown;
  facility?: unknown;
  room?: unknown;
  address?: unknown;
  area?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  is_free?: unknown;
  fee_text?: unknown;
  status?: unknown;
  receipt_end?: unknown;
  schedule_text?: unknown;
  period_text?: unknown;
  audiences?: unknown;
  summary?: unknown;
  primary_image_url?: unknown;
  primary_image_source?: unknown;
};

type DescriptionRow = { summary?: unknown };
type ProgramMediaRow = {
  image_url?: unknown;
  thumbnail_url?: unknown;
  media_role?: unknown;
  attribution?: unknown;
  license?: unknown;
  license_url?: unknown;
};
type FacilityMediaRow = {
  photo_url?: unknown;
  thumbnail_url?: unknown;
  photo_role?: unknown;
  attribution?: unknown;
  license?: unknown;
  license_url?: unknown;
  image_sha256?: unknown;
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeHttpsURL(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function plainText(value: unknown): string {
  const raw = stringValue(value) ?? "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readableSummary(value: unknown): string {
  const text = plainText(value);
  if (!text) return "프로그램의 자세한 내용과 신청 조건은 동네고고 앱에서 확인할 수 있어요.";
  if (text.length <= 520) return text;
  const shortened = text.slice(0, 520);
  const boundary = Math.max(shortened.lastIndexOf("."), shortened.lastIndexOf(" "));
  return `${shortened.slice(0, boundary > 360 ? boundary + 1 : 520).trim()}…`;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validProgramID(value: string): boolean {
  return value.length > 0 && value.length <= MAX_PROGRAM_ID_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

async function readServerBindings() {
  const processBindings = typeof process !== "undefined"
    ? process.env
    : {} as Record<string, string | undefined>;
  let baseUrl = stringValue(processBindings.DONGNEGOGO_SUPABASE_URL);
  let publishableKey = stringValue(processBindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);

  if (!baseUrl || !publishableKey) {
    try {
      const { env: workerBindings } = await import("cloudflare:workers");
      const bindings = workerBindings as unknown as Record<string, unknown>;
      baseUrl ??= stringValue(bindings.DONGNEGOGO_SUPABASE_URL);
      publishableKey ??= stringValue(bindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);
    } catch {
      // Node build/tests do not expose Cloudflare runtime bindings.
    }
  }

  if (!baseUrl || !publishableKey?.startsWith("sb_publishable_")) {
    throw new Error("Program share server bindings are unavailable.");
  }

  const projectUrl = new URL(baseUrl);
  if (
    projectUrl.protocol !== "https:" ||
    !projectUrl.hostname.endsWith(".supabase.co") ||
    projectUrl.username ||
    projectUrl.password
  ) {
    throw new Error("Program share server URL is invalid.");
  }

  return { projectUrl, publishableKey };
}

async function fetchRows<T>(
  projectUrl: URL,
  publishableKey: string,
  resource: string,
  query: URLSearchParams,
): Promise<T[]> {
  const endpoint = new URL(`/rest/v1/${resource}`, projectUrl);
  endpoint.search = query.toString();
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { accept: "application/json", apikey: publishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Program share ${resource} request failed with ${response.status}.`);
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? payload as T[] : [];
}

function collectImages(
  program: ProgramRow,
  programMedia: ProgramMediaRow[],
  facilityMedia: FacilityMediaRow[],
): SharedProgramImage[] {
  const candidates: Array<SharedProgramImage & { contentIdentity: string }> = [];
  const primary = safeHttpsURL(program.primary_image_url);
  if (primary) {
    candidates.push({
      url: primary,
      thumbnailUrl: null,
      role: "program_poster",
      attribution: stringValue(program.primary_image_source),
      license: null,
      licenseUrl: null,
      contentIdentity: imageContentIdentity(null, primary),
    });
  }

  for (const row of programMedia) {
    const url = safeHttpsURL(row.image_url);
    if (!url) continue;
    const thumbnailUrl = safeHttpsURL(row.thumbnail_url);
    candidates.push({
      url,
      thumbnailUrl,
      role: stringValue(row.media_role) ?? "program_image",
      attribution: stringValue(row.attribution),
      license: stringValue(row.license),
      licenseUrl: safeHttpsURL(row.license_url),
      contentIdentity: imageContentIdentity(null, url, thumbnailUrl),
    });
  }

  for (const row of facilityMedia) {
    const url = safeHttpsURL(row.photo_url);
    if (!url) continue;
    const thumbnailUrl = safeHttpsURL(row.thumbnail_url);
    candidates.push({
      url,
      thumbnailUrl,
      role: stringValue(row.photo_role) ?? "facility_photo",
      attribution: stringValue(row.attribution),
      license: stringValue(row.license),
      licenseUrl: safeHttpsURL(row.license_url),
      contentIdentity: imageContentIdentity(row.image_sha256, url, thumbnailUrl),
    });
  }

  return dedupeImagesByContent(candidates)
    .map<SharedProgramImage>((image) => ({
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      role: image.role,
      attribution: image.attribution,
      license: image.license,
      licenseUrl: image.licenseUrl,
    }))
    .slice(0, 10);
}

async function fetchSharedProgramUncached(programID: string): Promise<SharedProgram | null> {
  const id = programID.trim();
  if (!validProgramID(id)) return null;

  const { projectUrl, publishableKey } = await readServerBindings();
  const programQuery = new URLSearchParams({
    id: `eq.${id}`,
    select: "id,name,category,field,facility,room,address,area,latitude,longitude,is_free,fee_text,status,receipt_end,schedule_text,period_text,audiences,summary,primary_image_url,primary_image_source",
    limit: "1",
  });
  const programs = await fetchRows<ProgramRow>(projectUrl, publishableKey, "programs", programQuery);
  const program = programs[0];
  if (!program) return null;

  const descriptionQuery = new URLSearchParams({
    program_id: `eq.${id}`,
    status: "eq.ready",
    select: "summary",
    limit: "1",
  });
  const mediaQuery = new URLSearchParams({
    program_id: `eq.${id}`,
    select: "image_url,thumbnail_url,media_role,attribution,license,license_url,is_primary,updated_at",
    order: "is_primary.desc,updated_at.desc",
    limit: "10",
  });
  const facilityMediaQuery = new URLSearchParams({
    program_id: `eq.${id}`,
    rights_verified: "eq.true",
    select: "photo_url,thumbnail_url,photo_role,attribution,license,license_url,is_primary,updated_at,image_sha256",
    order: "is_primary.desc,updated_at.desc",
    limit: "10",
  });

  const [descriptions, programMedia, facilityMedia] = await Promise.all([
    fetchRows<DescriptionRow>(projectUrl, publishableKey, "program_descriptions", descriptionQuery).catch(() => []),
    fetchRows<ProgramMediaRow>(projectUrl, publishableKey, "program_media_public", mediaQuery).catch(() => []),
    fetchRows<FacilityMediaRow>(projectUrl, publishableKey, "program_facility_media", facilityMediaQuery).catch(() => []),
  ]);

  const name = stringValue(program.name);
  if (!name) return null;
  const audiences = Array.isArray(program.audiences)
    ? program.audiences.map(stringValue).filter((value): value is string => !!value)
    : [];

  return {
    id: stringValue(program.id) ?? id,
    name,
    category: stringValue(program.category) ?? "프로그램",
    field: stringValue(program.field) ?? "",
    facility: stringValue(program.facility) ?? "장소는 앱에서 확인해 주세요",
    room: stringValue(program.room),
    address: stringValue(program.address),
    area: stringValue(program.area) ?? "",
    latitude: numberValue(program.latitude),
    longitude: numberValue(program.longitude),
    isFree: program.is_free === true,
    feeText: stringValue(program.fee_text) ?? "이용료는 신청 페이지에서 확인",
    status: stringValue(program.status) ?? "일정 확인",
    receiptEnd: stringValue(program.receipt_end),
    scheduleText: stringValue(program.schedule_text),
    periodText: stringValue(program.period_text),
    audiences,
    description: readableSummary(descriptions[0]?.summary ?? program.summary),
    images: collectImages(program, programMedia, facilityMedia),
  };
}

const getCachedSharedProgram = unstable_cache(
  fetchSharedProgramUncached,
  ["dongnegogo", "program-share-v2-content-dedup"],
  { revalidate: CACHE_SECONDS },
);

export async function getSharedProgram(programID: string): Promise<SharedProgram | null> {
  return getCachedSharedProgram(programID);
}
