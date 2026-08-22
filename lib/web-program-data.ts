import "server-only";

const REQUEST_TIMEOUT_MS = 6_000;
const MAX_RESULT_LIMIT = 4_000;

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
  rawCategory: string;
  rawField: string;
  maxClassName: string | null;
  minClassName: string | null;
  isSeniorRecommended: boolean;
};

export type WebMapCluster = {
  id: string;
  scope: "localArea" | "neighborhood" | "district" | "city" | "province";
  regionName: string;
  areaName: string;
  categoryName: string;
  latitude: number;
  longitude: number;
  programCount: number;
  programIds: string[];
};

export type WebMapViewportResult = {
  mode: "individual" | "cluster";
  scope: "individual" | WebMapCluster["scope"];
  programs: WebProgram[];
  clusters: WebMapCluster[];
  programCounts: Record<string, number>;
  uniqueLocationCount: number;
  isComplete: boolean;
  revision: string;
};

export type WebHeatShelter = {
  id: string;
  name: string;
  facilityType: string | null;
  facilitySubtype: string | null;
  address: string | null;
  roadAddress: string | null;
  detailPosition: string | null;
  capacity: number | null;
  fanCount: number | null;
  airconCount: number | null;
  isNightOpen: boolean | null;
  isWeekendHolidayOpen: boolean | null;
  isStayAvailable: boolean | null;
  weekdayOpenTime: string | null;
  weekdayCloseTime: string | null;
  weekendHolidayOpenTime: string | null;
  weekendHolidayCloseTime: string | null;
  notes: string | null;
  longitude: number;
  latitude: number;
  sourceUrl: string | null;
};

export type WebNearbyPlace = {
  id: number;
  name: string;
  branchName: string | null;
  placeType: "restaurant" | "cafe" | "fast_food" | "convenience_store" | "other_food";
  categoryLargeName: string | null;
  categoryMediumName: string | null;
  categorySmallName: string | null;
  phone: string | null;
  address: string | null;
  longitude: number;
  latitude: number;
  distanceMeters: number;
  businessStatusName: string | null;
};

export type WebNearbyPlacesSummary = {
  places: WebNearbyPlace[];
  mapPlaces: WebNearbyPlace[];
  totalCount: number;
  categoryCounts: Record<string, number>;
  isComplete: boolean;
};

type ProgramRow = Record<string, unknown>;

type ProgramQuery = {
  south?: number;
  west?: number;
  north?: number;
  east?: number;
  query?: string;
  subjectTerms?: string[];
  areaTerms?: string[];
  generalTerms?: string[];
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
    rawCategory: textValue(row.category) ?? "",
    rawField: textValue(row.field) ?? "",
    maxClassName: textValue(row.max_class_nm),
    minClassName: textValue(row.min_class_nm),
    isSeniorRecommended: row.is_senior_recommended === true,
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
  let baseUrl = textValue(processBindings.DONGNEGOGO_SUPABASE_URL);
  let publishableKey = textValue(processBindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);

  if (!baseUrl || !publishableKey) {
    try {
      const { env } = await import("cloudflare:workers");
      const bindings = env as unknown as Record<string, unknown>;
      baseUrl ??= textValue(bindings.DONGNEGOGO_SUPABASE_URL);
      publishableKey ??= textValue(bindings.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY);
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

async function rpc(functionName: string, body: Record<string, unknown>): Promise<unknown> {
  const { projectUrl, publishableKey } = await readBindings();
  const endpoint = new URL(`/rest/v1/rpc/${functionName}`, projectUrl);
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
  if (!response.ok) throw new Error(`공개 프로그램을 불러오지 못했습니다. (${response.status})`);
  return response.json();
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeHeatShelter(value: unknown): WebHeatShelter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = textValue(row.id);
  const name = textValue(row.name);
  const latitude = numberValue(row.latitude);
  const longitude = numberValue(row.longitude);
  if (!id || !name || latitude === null || longitude === null) return null;
  return {
    id,
    name,
    facilityType: textValue(row.facility_type),
    facilitySubtype: textValue(row.facility_subtype),
    address: textValue(row.address),
    roadAddress: textValue(row.road_address),
    detailPosition: textValue(row.detail_position),
    capacity: numberValue(row.capacity),
    fanCount: numberValue(row.fan_count),
    airconCount: numberValue(row.aircon_count),
    isNightOpen: nullableBoolean(row.is_night_open),
    isWeekendHolidayOpen: nullableBoolean(row.is_weekend_holiday_open),
    isStayAvailable: nullableBoolean(row.is_stay_available),
    weekdayOpenTime: textValue(row.weekday_open_time),
    weekdayCloseTime: textValue(row.weekday_close_time),
    weekendHolidayOpenTime: textValue(row.weekend_holiday_open_time),
    weekendHolidayCloseTime: textValue(row.weekend_holiday_close_time),
    notes: textValue(row.notes),
    longitude,
    latitude,
    sourceUrl: safePublicUrl(row.source_url),
  };
}

function nearbyPlaceType(value: unknown): WebNearbyPlace["placeType"] | null {
  return value === "restaurant" || value === "cafe" || value === "fast_food"
    || value === "convenience_store" || value === "other_food" ? value : null;
}

function normalizeNearbyPlace(value: unknown): WebNearbyPlace | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = numberValue(row.id);
  const name = textValue(row.name);
  const placeType = nearbyPlaceType(row.place_type);
  const latitude = numberValue(row.latitude);
  const longitude = numberValue(row.longitude);
  if (id === null || !name || !placeType || latitude === null || longitude === null) return null;
  return {
    id: Math.round(id),
    name,
    branchName: textValue(row.branch_name),
    placeType,
    categoryLargeName: textValue(row.category_large_name),
    categoryMediumName: textValue(row.category_medium_name),
    categorySmallName: textValue(row.category_small_name),
    phone: textValue(row.phone),
    address: textValue(row.road_address) ?? textValue(row.lot_address),
    longitude,
    latitude,
    distanceMeters: Math.max(0, Math.round(numberValue(row.distance_m) ?? 0)),
    businessStatusName: textValue(row.business_status_name),
  };
}

export async function fetchWebHeatShelters(input: {
  south: number; west: number; north: number; east: number; centerLatitude: number; centerLongitude: number; limit?: number;
}): Promise<WebHeatShelter[]> {
  const rows = await rpc("get_heat_shelters_in_bounds", {
    p_south: Math.min(input.south, input.north),
    p_west: Math.min(input.west, input.east),
    p_north: Math.max(input.south, input.north),
    p_east: Math.max(input.west, input.east),
    p_center_lat: input.centerLatitude,
    p_center_lon: input.centerLongitude,
    p_limit: Math.max(1, Math.min(1_200, input.limit ?? 600)),
  });
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.map(normalizeHeatShelter).filter((item): item is WebHeatShelter => Boolean(item) && !seen.has(item!.id) && Boolean(seen.add(item!.id)));
}

export async function fetchWebNearbyPlaces(input: {
  latitude: number; longitude: number; radiusMeters: number; limit?: number;
}): Promise<WebNearbyPlacesSummary> {
  const payload = await rpc("nearby_places_summary_v2", {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_radius_m: Math.max(100, Math.min(1_000, Math.round(input.radiusMeters))),
    p_place_types: ["restaurant", "cafe", "fast_food", "convenience_store", "other_food"],
    p_limit: Math.max(1, Math.min(400, input.limit ?? 300)),
  });
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const places = Array.isArray(row.places) ? row.places.map(normalizeNearbyPlace).filter((item): item is WebNearbyPlace => Boolean(item)) : [];
  const mapPlaces = Array.isArray(row.map_places) ? row.map_places.map(normalizeNearbyPlace).filter((item): item is WebNearbyPlace => Boolean(item)) : places;
  const rawCounts = row.category_counts && typeof row.category_counts === "object" ? row.category_counts as Record<string, unknown> : {};
  return {
    places,
    mapPlaces,
    totalCount: Math.max(0, Math.round(numberValue(row.total_count) ?? places.length)),
    categoryCounts: Object.fromEntries(Object.entries(rawCounts).flatMap(([key, value]) => {
      const count = numberValue(value);
      return count === null ? [] : [[key, Math.max(0, Math.round(count))]];
    })),
    isComplete: row.is_complete === true,
  };
}

function compactProgram(value: unknown): WebProgram | null {
  if (!Array.isArray(value)) return null;
  return normalizedProgram({
    id: value[0], source: value[1], name: value[2], category: value[3], field: value[4],
    facility: value[5], room: value[6], address: value[7], area: value[8], region: value[9],
    latitude: value[10], longitude: value[11], is_free: value[12], fee_text: value[13],
    status: value[14], audiences: value[15], schedule_text: value[16], period_text: value[17],
    receipt_start: value[18], receipt_end: value[19], apply_url: value[20], phone: value[21],
    is_senior_recommended: value[22], max_class_nm: value[23], min_class_nm: value[24],
    primary_image_url: value[25], is_active: value[26],
  });
}

function clusterScope(value: string): WebMapCluster["scope"] {
  if (value === "localArea" || value === "neighborhood" || value === "district" || value === "city" || value === "province") return value;
  return "localArea";
}

function normalizeCluster(value: unknown, scope: WebMapCluster["scope"]): WebMapCluster | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const latitude = numberValue(row.latitude);
  const longitude = numberValue(row.longitude);
  const count = numberValue(row.program_count);
  if (latitude === null || longitude === null || count === null) return null;
  const clusterId = textValue(row.cluster_id) ?? `${latitude}:${longitude}`;
  return {
    id: `aggregate:${scope}:${clusterId}`,
    scope,
    regionName: textValue(row.region_name) ?? "",
    areaName: textValue(row.area_name) ?? "주변",
    categoryName: textValue(row.category_name) ?? "프로그램",
    latitude,
    longitude,
    programCount: Math.max(1, Math.round(count)),
    programIds: Array.isArray(row.program_ids) ? row.program_ids.map(textValue).filter((item): item is string => Boolean(item)) : [],
  };
}

export async function fetchWebMapViewport(input: {
  south: number; west: number; north: number; east: number;
  previousMode?: "individual" | "cluster";
  scope?: WebMapCluster["scope"];
}): Promise<WebMapViewportResult> {
  const scope = clusterScope(input.scope ?? "localArea");
  const payload = await rpc("get_program_map_viewport_v4", {
    p_south: Math.min(input.south, input.north),
    p_west: Math.min(input.west, input.east),
    p_north: Math.max(input.south, input.north),
    p_east: Math.max(input.west, input.east),
    p_previous_mode: input.previousMode ?? "individual",
    p_cluster_scope: scope,
    p_limit: 5_000,
    p_cluster_limit: 500,
  }) as Record<string, unknown>;
  const mode = payload.mode === "cluster" ? "cluster" : "individual";
  const programs = Array.isArray(payload.programs)
    ? payload.programs.map(compactProgram).filter((item): item is WebProgram => Boolean(item))
    : [];
  const clusters = Array.isArray(payload.clusters)
    ? payload.clusters.map((item) => normalizeCluster(item, scope)).filter((item): item is WebMapCluster => Boolean(item))
    : [];
  const rawCounts = payload.program_counts && typeof payload.program_counts === "object"
    ? payload.program_counts as Record<string, unknown>
    : {};
  const programCounts = Object.fromEntries(Object.entries(rawCounts).flatMap(([id, value]) => {
    const count = numberValue(value);
    return count === null ? [] : [[id, Math.max(1, Math.round(count))]];
  }));
  return {
    mode,
    scope: mode === "individual" ? "individual" : scope,
    programs,
    clusters,
    programCounts,
    uniqueLocationCount: numberValue(payload.unique_location_count) ?? programs.length,
    isComplete: payload.is_complete === true,
    revision: textValue(payload.revision) ?? "web-map-v4",
  };
}

export async function fetchWebSearchCandidates(input: Pick<ProgramQuery, "subjectTerms" | "areaTerms" | "generalTerms">): Promise<WebProgram[]> {
  const subjectTerms = (input.subjectTerms ?? []).map(safeSearchTerm).filter(Boolean);
  const areaTerms = (input.areaTerms ?? []).map(safeSearchTerm).filter(Boolean);
  const generalTerms = (input.generalTerms ?? []).map(safeSearchTerm).filter(Boolean);
  const fallbackTerms = [...new Set([...subjectTerms, ...areaTerms, ...generalTerms])];
  if (!fallbackTerms.length) return [];
  const rows = await rpc("search_program_candidates_v2", {
    p_subject_terms: subjectTerms,
    p_area_terms: areaTerms,
    p_general_terms: generalTerms,
    p_limit: 4_000,
    p_offset: 0,
  });
  if (!Array.isArray(rows)) return [];
  return rows.map((value) => {
    if (Array.isArray(value)) return compactProgram(value);
    return value && typeof value === "object" ? normalizedProgram(value as ProgramRow) : null;
  }).filter((item): item is WebProgram => Boolean(item));
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
    "max_class_nm", "min_class_nm", "is_senior_recommended",
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
