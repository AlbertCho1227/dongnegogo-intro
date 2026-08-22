import "server-only";

import { unstable_cache } from "next/cache";

import { BLOG_PROGRAM_CATEGORIES } from "@/lib/blog-program";

const REQUEST_TIMEOUT_MS = 6_000;
const MAX_PAGE_SIZE = 1_000;

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

export async function getBlogProgramPage(offset = 0, limit = 120) {
  return cachedPage(offset, limit, "", "");
}

export async function getBlogProgramCategoryPage(category: (typeof BLOG_PROGRAM_CATEGORIES)[number], limit = 48) {
  return cachedPage(0, limit, category, "");
}

export async function getBlogProgramSearchPage(searchTerm: string, limit = 16) {
  return cachedPage(0, limit, "", searchTerm);
}
