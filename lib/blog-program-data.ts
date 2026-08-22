import "server-only";

import { unstable_cache } from "next/cache";

import { BLOG_ARCHIVE_CITIES, blogArchiveRegionValues, type BlogArchiveCity } from "@/lib/blog-archive-regions";
import { BLOG_PROGRAM_CATEGORIES, isParkingProgram } from "@/lib/blog-program";

const REQUEST_TIMEOUT_MS = 6_000;
const MAX_PAGE_SIZE = 1_000;
export const BLOG_ARCHIVE_PAGE_SIZE = 48;
export const BLOG_ARCHIVE_CATEGORIES = ["전체", "교육·강좌", "공연·연극·뮤지컬", "전시·예술", "문화·행사", "체육·수영", "취미·체험"] as const;
export type BlogArchiveCategory = (typeof BLOG_ARCHIVE_CATEGORIES)[number];

const ARCHIVE_FILTERS: Record<BlogArchiveCategory, { categories: readonly string[]; terms?: readonly string[] }> = {
  "전체": { categories: BLOG_PROGRAM_CATEGORIES },
  "교육·강좌": { categories: ["교육"] },
  "공연·연극·뮤지컬": { categories: ["문화", "전시"], terms: ["공연", "연극", "뮤지컬", "콘서트", "오페라", "무용", "발레", "국악", "연주"] },
  "전시·예술": { categories: ["전시", "문화"], terms: ["전시", "미술", "그림", "사진전", "박물관", "미술관", "공예"] },
  "문화·행사": { categories: ["문화행사", "문화"], terms: ["행사", "축제", "페스티벌", "마켓", "박람회"] },
  "체육·수영": { categories: ["체육"] },
  "취미·체험": { categories: ["교육", "문화", "문화행사"], terms: ["취미", "체험", "공방", "만들기", "요리", "원예", "도예", "서예", "바둑", "보드게임", "악기", "뜨개"] },
};

export type BlogProgramSummary = {
  id: string;
  name: string;
  category: string;
  field: string;
  facility: string;
  area: string;
  status: string;
  isFree: boolean;
  imageUrl: string | null;
  source: string | null;
  periodText: string | null;
  receiptEnd: string | null;
  lectureStart: string | null;
  lectureEnd: string | null;
  updatedAt: string | null;
  maxClassName: string | null;
  minClassName: string | null;
};

type Row = Record<string, unknown>;

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeURL(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function normalize(row: Row): BlogProgramSummary | null {
  const id = textValue(row.id);
  const name = textValue(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    category: textValue(row.category) ?? "프로그램",
    field: textValue(row.field) ?? "",
    facility: textValue(row.facility) ?? "장소 정보 확인 중",
    area: textValue(row.area) ?? "",
    status: textValue(row.status) ?? "일정 확인",
    isFree: row.is_free === true,
    imageUrl: safeURL(row.primary_image_url),
    source: textValue(row.source),
    periodText: textValue(row.period_text),
    receiptEnd: textValue(row.receipt_end),
    lectureStart: textValue(row.lecture_start),
    lectureEnd: textValue(row.lecture_end),
    updatedAt: textValue(row.updated_at),
    maxClassName: textValue(row.max_class_nm),
    minClassName: textValue(row.min_class_nm),
  };
}

async function bindings() {
  const processBindings = typeof process !== "undefined" ? process.env : {} as Record<string, string | undefined>;
  let baseUrl = textValue(processBindings.DONGNEGOGO_SUPABASE_URL);
  let publishableKey = textValue(processBindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);
  if (!baseUrl || !publishableKey) {
    try {
      const { env } = await import("cloudflare:workers");
      const worker = env as unknown as Record<string, unknown>;
      baseUrl ??= textValue(worker.DONGNEGOGO_SUPABASE_URL);
      publishableKey ??= textValue(worker.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);
    } catch { /* Node builds do not expose worker bindings. */ }
  }
  if (!baseUrl || !publishableKey?.startsWith("sb_publishable_")) throw new Error("Blog program bindings are unavailable.");
  const projectUrl = new URL(baseUrl);
  if (projectUrl.protocol !== "https:" || !projectUrl.hostname.endsWith(".supabase.co")) throw new Error("Blog program URL is invalid.");
  return { projectUrl, publishableKey };
}

function safeFilterTerm(value: string): string {
  return value.normalize("NFC").replace(/[,*()'"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

const ARCHIVE_SELECT = "id,name,category,field,facility,area,status,is_free,primary_image_url,source,period_text,receipt_end,lecture_start,lecture_end,updated_at,max_class_nm,min_class_nm";

function tsQueryTerms(values: readonly string[]): string {
  return values
    .flatMap((value) => safeFilterTerm(value).replace(/[&|!():*<>]/g, " ").split(/\s+/))
    .filter((value) => value.length >= 2)
    .join(" | ");
}

function indexedArchiveEndpoint(projectUrl: URL, offset: number, limit: number, filter: { categories: readonly string[]; terms?: readonly string[] }, searchTerm: string, city: BlogArchiveCity) {
  const indexEndpoint = new URL("/rest/v1/program_search_documents_v3", projectUrl);
  const indexParams = new URLSearchParams({
    select: "program_id,source_updated_at",
    order: "source_updated_at.desc,program_id.asc",
    offset: String(Math.max(0, offset)),
    limit: String(limit),
  });
  const categoryQuery = tsQueryTerms(filter.categories);
  const kindQuery = tsQueryTerms(filter.terms ?? []);
  if (categoryQuery && kindQuery) indexParams.set("subject_fts", `fts(simple).(${categoryQuery}) & (${kindQuery})`);
  else if (categoryQuery) indexParams.set("subject_fts", `fts(simple).(${categoryQuery})`);
  const searchQuery = tsQueryTerms([searchTerm]);
  if (searchQuery) indexParams.set("general_fts", `fts(simple).(${searchQuery})`);
  if (city !== "전체") indexParams.set("area_document", `ilike.*${city}*`);
  indexEndpoint.search = indexParams.toString();
  return indexEndpoint;
}

function standardArchiveEndpoint(projectUrl: URL, offset: number, limit: number, filter: { categories: readonly string[] }, city: BlogArchiveCity) {
  const endpoint = new URL("/rest/v1/programs", projectUrl);
  const params = new URLSearchParams({
    select: ARCHIVE_SELECT,
    category: `in.(${filter.categories.join(",")})`,
    order: "updated_at.desc.nullslast,id.asc",
    offset: String(Math.max(0, offset)),
    limit: String(limit),
  });
  // 프로그램명이 명시적으로 주차장인 행은 데이터 단계에서 제외합니다.
  // 시설·분야에만 주차 표기가 남은 드문 행은 응답 정규화 뒤 한 번 더 제외합니다.
  params.append("name", "not.ilike.*주차장*");
  params.append("name", "not.ilike.*parking*");
  const regions = blogArchiveRegionValues(city);
  if (regions.length === 1) params.set("region", `eq.${regions[0]}`);
  else if (regions.length > 1) params.set("region", `in.(${regions.join(",")})`);
  endpoint.search = params.toString();
  return endpoint;
}

async function fetchIndexedArchiveRows(projectUrl: URL, publishableKey: string, offset: number, limit: number, filter: { categories: readonly string[]; terms?: readonly string[] }, searchTerm: string, city: BlogArchiveCity) {
  const indexEndpoint = indexedArchiveEndpoint(projectUrl, offset, limit, filter, searchTerm, city);
  const indexResponse = await fetch(indexEndpoint, {
    headers: { accept: "application/json", apikey: publishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!indexResponse.ok) throw new Error(`Blog search index request failed with ${indexResponse.status}.`);
  const indexPayload: unknown = await indexResponse.json();
  const ids = Array.isArray(indexPayload) ? indexPayload.map((row) => textValue((row as Row).program_id)).filter((id): id is string => Boolean(id)) : [];
  if (!ids.length) return [] as BlogProgramSummary[];

  const programsEndpoint = new URL("/rest/v1/programs", projectUrl);
  programsEndpoint.search = new URLSearchParams({ select: ARCHIVE_SELECT, id: `in.(${ids.map((id) => `"${id}"`).join(",")})` }).toString();
  const programsResponse = await fetch(programsEndpoint, {
    headers: { accept: "application/json", apikey: publishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!programsResponse.ok) throw new Error(`Blog indexed programs request failed with ${programsResponse.status}.`);
  const programsPayload: unknown = await programsResponse.json();
  const byId = new Map(Array.isArray(programsPayload)
    ? programsPayload.map((row) => normalize(row as Row)).filter((row): row is BlogProgramSummary => Boolean(row)).map((row) => [row.id, row])
    : []);
  return ids.map((id) => byId.get(id)).filter((row): row is BlogProgramSummary => Boolean(row) && !isParkingProgram(row));
}

async function fetchPageUncached(offset: number, requestedLimit: number, category = "", searchTerm = ""): Promise<{ programs: BlogProgramSummary[]; total: number }> {
  const { projectUrl, publishableKey } = await bindings();
  const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit));
  const endpoint = new URL("/rest/v1/programs", projectUrl);
  const params = new URLSearchParams({
    select: "id,name,category,field,facility,area,status,is_free,primary_image_url,source,period_text,receipt_end,lecture_start,lecture_end,updated_at,max_class_nm,min_class_nm",
    category: BLOG_PROGRAM_CATEGORIES.includes(category as (typeof BLOG_PROGRAM_CATEGORIES)[number]) ? `eq.${category}` : `in.(${BLOG_PROGRAM_CATEGORIES.join(",")})`,
    order: "updated_at.desc.nullslast,id.asc",
    offset: String(Math.max(0, offset)),
    limit: String(limit),
  });
  const term = safeFilterTerm(searchTerm);
  if (term) params.set("or", `(name.ilike.*${term}*,field.ilike.*${term}*,facility.ilike.*${term}*)`);
  endpoint.search = params.toString();
  const response = await fetch(endpoint, {
    headers: { accept: "application/json", apikey: publishableKey, Prefer: "count=exact" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Blog program request failed with ${response.status}.`);
  const payload: unknown = await response.json();
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
  return {
    programs: Array.isArray(payload) ? payload.map((row) => normalize(row as Row)).filter((row): row is BlogProgramSummary => Boolean(row)) : [],
    total: Number.isFinite(total) ? total : 0,
  };
}

const cachedPage = unstable_cache(fetchPageUncached, ["dongnegogo", "blog-program-index-v1"], { revalidate: 900 });

async function fetchArchiveRowsUncached(offset: number, requestedLimit: number, category: BlogArchiveCategory, searchTerm: string, city: BlogArchiveCity): Promise<BlogProgramSummary[]> {
  const { projectUrl, publishableKey } = await bindings();
  const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit));
  const filter = ARCHIVE_FILTERS[category] ?? ARCHIVE_FILTERS["전체"];
  if (filter.terms?.length || searchTerm) return fetchIndexedArchiveRows(projectUrl, publishableKey, offset, limit, filter, searchTerm, city);
  const endpoint = standardArchiveEndpoint(projectUrl, offset, limit, filter, city);
  const response = await fetch(endpoint, {
    headers: { accept: "application/json", apikey: publishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Blog archive request failed with ${response.status}.`);
  const payload: unknown = await response.json();
  return Array.isArray(payload)
    ? payload.map((row) => normalize(row as Row)).filter((row): row is BlogProgramSummary => Boolean(row))
    : [];
}

async function fetchArchiveTotalUncached(category: BlogArchiveCategory, searchTerm: string, city: BlogArchiveCity): Promise<number> {
  const { projectUrl, publishableKey } = await bindings();
  const filter = ARCHIVE_FILTERS[category] ?? ARCHIVE_FILTERS["전체"];
  const endpoint = filter.terms?.length || searchTerm
    ? indexedArchiveEndpoint(projectUrl, 0, 1, filter, searchTerm, city)
    : standardArchiveEndpoint(projectUrl, 0, 1, filter, city);
  endpoint.searchParams.set("select", filter.terms?.length || searchTerm ? "program_id" : "id");
  endpoint.searchParams.delete("order");
  const response = await fetch(endpoint, {
    method: "HEAD",
    headers: { accept: "application/json", apikey: publishableKey, Prefer: "count=exact" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Blog archive count request failed with ${response.status}.`);
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
  return Number.isFinite(total) ? total : 0;
}

const cachedArchiveRows = unstable_cache(fetchArchiveRowsUncached, ["dongnegogo", "blog-program-archive-rows-v4"], { revalidate: 900 });
const cachedArchiveTotal = unstable_cache(fetchArchiveTotalUncached, ["dongnegogo", "blog-program-archive-total-v4"], { revalidate: 900 });

export async function getBlogProgramPage(offset = 0, limit = 120) {
  return cachedPage(offset, limit, "", "");
}

export async function getBlogProgramCategoryPage(category: (typeof BLOG_PROGRAM_CATEGORIES)[number], limit = 48) {
  return cachedPage(0, limit, category, "");
}

export async function getBlogProgramSearchPage(searchTerm: string, limit = 16) {
  return cachedPage(0, limit, "", searchTerm);
}

export async function getLatestBlogPrograms(limit = 3) {
  const safeLimit = Math.max(1, Math.min(3, Math.trunc(limit)));
  return cachedArchiveRows(0, safeLimit, "전체", "", "전체");
}

export async function getBlogProgramArchivePage(input: { page?: number; category?: string; city?: string; searchTerm?: string; pageSize?: number } = {}) {
  const category = BLOG_ARCHIVE_CATEGORIES.includes(input.category as BlogArchiveCategory) ? input.category as BlogArchiveCategory : "전체";
  const city = BLOG_ARCHIVE_CITIES.includes(input.city as BlogArchiveCity) ? input.city as BlogArchiveCity : "전체";
  const page = Number.isInteger(input.page) && Number(input.page) > 0 ? Math.min(Number(input.page), 2_000) : 1;
  const pageSize = Math.max(12, Math.min(96, input.pageSize ?? BLOG_ARCHIVE_PAGE_SIZE));
  const searchTerm = safeFilterTerm(input.searchTerm ?? "");
  // 전체 개수는 페이지 번호와 무관하므로 한 번만 캐시하고, 목록과 병렬로 읽습니다.
  // 이전 방식은 페이지를 넘길 때마다 동일한 exact count를 다시 계산했습니다.
  const [programs, total] = await Promise.all([
    cachedArchiveRows((page - 1) * pageSize, pageSize, category, searchTerm, city),
    cachedArchiveTotal(category, searchTerm, city),
  ]);
  return { programs, total, page, pageSize, category, city, searchTerm };
}
