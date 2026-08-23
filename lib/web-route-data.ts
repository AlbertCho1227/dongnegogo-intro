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

export type WebTransitWalkLeg = {
  distanceMeters: number;
  minutes: number;
};

export type WebTransitStep = {
  type: string;
  lineName: string;
  minutes: number;
  boardingStation: string | null;
  alightingStation: string | null;
  stopCount: number | null;
  intermediateStations: string[];
  exitGuidance: string | null;
};

export type WebTransitBusRoute = {
  name: string;
  type: string | null;
};

export type WebIntercityTrainStation = {
  name: string;
  nodeID: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
};

export type WebIntercityTrainTrip = {
  trainType: string;
  trainNumber: string;
  departureStation: string;
  arrivalStation: string;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
};

export type WebIntercityRailWaypoint = WebRoutePoint & { name: string };

export type WebIntercityConnectorLeg = {
  totalDistanceMeters: number;
  totalMinutes: number;
  segments: WebRouteSegment[];
  steps: WebTransitStep[];
  accessWalk: WebTransitWalkLeg | null;
  egressWalk: WebTransitWalkLeg | null;
  transitDistanceMeters: number | null;
  transfers: number;
  isEstimated: boolean;
};

export type WebIntercityTrainJourney = {
  available: boolean;
  routeAvailable: boolean;
  reason: string | null;
  directDistanceMeters: number;
  originRegion: string | null;
  destinationRegion: string | null;
  originStation: WebIntercityTrainStation;
  destinationStation: WebIntercityTrainStation;
  railWaypoints: WebIntercityRailWaypoint[];
  trips: WebIntercityTrainTrip[];
  sourceNames: string[];
  updatedAt: string | null;
  access: WebIntercityConnectorLeg;
  egress: WebIntercityConnectorLeg;
  railDistanceMeters: number;
  railMinutes: number;
  railIsEstimated: boolean;
};

export type WebRouteResult = {
  mode: WebRouteMode;
  totalDistanceMeters: number;
  totalMinutes: number;
  segments: WebRouteSegment[];
  transitDistanceMeters: number | null;
  transfers: number;
  steps: WebTransitStep[];
  accessWalk: WebTransitWalkLeg | null;
  egressWalk: WebTransitWalkLeg | null;
  busRoutes: WebTransitBusRoute[];
  landingURL: string | null;
  isEstimated: boolean;
  intercityTrain: WebIntercityTrainJourney | null;
};

type JsonRecord = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 12_000;
const INTERCITY_REQUEST_TIMEOUT_MS = 20_000;
const LONG_DISTANCE_METERS = 70_000;

function kstTravelDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}

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

function distanceMeters(a: WebRoutePoint, b: WebRoutePoint) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function pathDistance(points: WebRoutePoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distanceMeters(points[index], point), 0);
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

function normalizeWalkLeg(value: unknown): WebTransitWalkLeg | null {
  const row = record(value);
  const distanceMeters = Math.max(0, Math.round(number(row.distanceMeters) ?? 0));
  const minutes = Math.max(0, Math.round(number(row.minutes) ?? 0));
  return distanceMeters > 0 || minutes > 0 ? { distanceMeters, minutes: Math.max(1, minutes) } : null;
}

function normalizeTransitSteps(value: unknown): WebTransitStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawStep) => {
    const step = record(rawStep);
    const lineName = text(step.lineName);
    if (!lineName) return [];
    const stopCount = number(step.stopCount);
    return [{
      type: text(step.type)?.toUpperCase() ?? "OTHER",
      lineName,
      minutes: Math.max(1, Math.round(number(step.minutes) ?? 1)),
      boardingStation: text(step.boardingStation),
      alightingStation: text(step.alightingStation),
      stopCount: stopCount === null ? null : Math.max(0, Math.round(stopCount)),
      intermediateStations: Array.isArray(step.intermediateStations)
        ? step.intermediateStations.flatMap((station) => text(station) ?? [])
        : [],
      exitGuidance: text(step.exitGuidance),
    }];
  });
}

function normalizeBusRoutes(value: unknown): WebTransitBusRoute[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((rawRoute) => {
    const route = record(rawRoute);
    const name = text(route.name);
    if (!name || seen.has(name)) return [];
    seen.add(name);
    return [{ name, type: text(route.type) }];
  }).slice(0, 10);
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

async function invoke(functionName: string, body: JsonRecord, timeoutMs = REQUEST_TIMEOUT_MS) {
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
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(text(record(payload).error) ?? "실제 경로를 불러오지 못했어요.");
  }
  return record(payload);
}

function transitPayloadResult(
  payload: JsonRecord,
  origin: WebRoutePoint,
  destination: WebRoutePoint,
): WebIntercityConnectorLeg | null {
  const totalDistanceMeters = Math.max(0, Math.round(number(payload.totalDistanceMeters) ?? 0));
  const totalMinutes = Math.max(0, Math.round(number(payload.totalMinutes) ?? 0));
  const segments = completeEndpoints(normalizeSegments(payload.segments), origin, destination);
  if (!totalDistanceMeters || !totalMinutes || !segments.length) return null;
  return {
    totalDistanceMeters,
    totalMinutes,
    segments,
    steps: normalizeTransitSteps(payload.steps),
    accessWalk: normalizeWalkLeg(payload.accessWalk),
    egressWalk: normalizeWalkLeg(payload.egressWalk),
    transitDistanceMeters: Math.max(0, Math.round(number(payload.transitDistanceMeters) ?? 0)) || null,
    transfers: Math.max(0, Math.round(number(payload.transfers) ?? 0)),
    isEstimated: false,
  };
}

async function fetchLocalTransitPayload(
  origin: WebRoutePoint,
  destination: WebRoutePoint,
  destinationName: string,
) {
  let fallbackPayload: JsonRecord = {};
  for (const fastRoute of [true, false]) {
    try {
      const payload = record((await invoke("facility-transit-info", {
        origin,
        facility: { ...destination, name: destinationName.slice(0, 120) },
        includeRoute: true,
        includeStationJourneys: false,
        fastRoute,
      })).route);
      fallbackPayload = payload;
      if (transitPayloadResult(payload, origin, destination)) return payload;
    } catch {
      // The full lookup below is the same retry policy used by the iOS client.
    }
  }
  return fallbackPayload;
}

async function buildIntercityConnector(
  origin: WebRoutePoint,
  destination: WebRoutePoint,
  destinationName: string,
  fallbackDistanceMeters: number,
): Promise<WebIntercityConnectorLeg> {
  const transitPayload = await fetchLocalTransitPayload(origin, destination, destinationName);
  const transit = transitPayloadResult(transitPayload, origin, destination);
  if (transit) return transit;

  try {
    const walkingPayload = await invoke("android-route-directions", {
      mode: "WALKING",
      origin,
      destination,
    });
    const walkingDistance = Math.max(0, Math.round(number(walkingPayload.totalDistanceMeters) ?? 0));
    const walkingMinutes = Math.max(0, Math.round(number(walkingPayload.totalMinutes) ?? 0));
    const walkingSegments = completeEndpoints(normalizeSegments(walkingPayload.segments), origin, destination);
    if (walkingDistance && walkingMinutes && walkingSegments.length) {
      return {
        totalDistanceMeters: walkingDistance,
        totalMinutes: walkingMinutes,
        segments: walkingSegments,
        steps: [],
        accessWalk: { distanceMeters: walkingDistance, minutes: walkingMinutes },
        egressWalk: null,
        transitDistanceMeters: null,
        transfers: 0,
        isEstimated: false,
      };
    }
  } catch {
    // A straight connector remains available when a regional route provider has no result.
  }

  const directDistance = Math.max(10, Math.round(distanceMeters(origin, destination)), fallbackDistanceMeters);
  return {
    totalDistanceMeters: directDistance,
    totalMinutes: Math.max(1, Math.ceil(directDistance / 75)),
    segments: [{ type: "WALKING", lineName: "도보", points: [origin, destination] }],
    steps: [],
    accessWalk: { distanceMeters: directDistance, minutes: Math.max(1, Math.ceil(directDistance / 75)) },
    egressWalk: null,
    transitDistanceMeters: null,
    transfers: 0,
    isEstimated: true,
  };
}

function normalizeIntercityStation(value: unknown): WebIntercityTrainStation | null {
  const station = record(value);
  const coordinate = validPoint(station);
  const name = text(station.name);
  if (!coordinate || !name) return null;
  return {
    name,
    nodeID: text(station.nodeID) ?? "",
    distanceMeters: Math.max(0, Math.round(number(station.distanceMeters) ?? 0)),
    ...coordinate,
  };
}

function normalizeIntercityTrips(value: unknown): WebIntercityTrainTrip[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawTrip) => {
    const trip = record(rawTrip);
    const trainType = text(trip.trainType);
    const departureAt = text(trip.departureAt);
    const arrivalAt = text(trip.arrivalAt);
    if (!trainType || !departureAt || !arrivalAt || Number.isNaN(Date.parse(departureAt)) || Number.isNaN(Date.parse(arrivalAt))) return [];
    return [{
      trainType,
      trainNumber: text(trip.trainNumber) ?? "",
      departureStation: text(trip.departureStation) ?? "출발역",
      arrivalStation: text(trip.arrivalStation) ?? "도착역",
      departureAt,
      arrivalAt,
      durationMinutes: Math.max(1, Math.round(number(trip.durationMinutes) ?? 1)),
    }];
  }).slice(0, 3);
}

function normalizeRailWaypoints(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((rawWaypoint) => {
    const waypoint = record(rawWaypoint);
    const coordinate = validPoint(waypoint);
    const name = text(waypoint.name);
    if (!coordinate || !name) return [];
    const key = `${coordinate.latitude.toFixed(6)}:${coordinate.longitude.toFixed(6)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name, ...coordinate }];
  });
}

async function fetchIntercityRoute(
  origin: WebRoutePoint,
  destination: WebRoutePoint,
  destinationName: string,
): Promise<WebRouteResult | null> {
  if (distanceMeters(origin, destination) < LONG_DISTANCE_METERS) return null;
  let payload: JsonRecord;
  try {
    const referenceTime = new Date();
    payload = await invoke("intercity-train-info", {
      origin,
      destination: { ...destination, name: destinationName.slice(0, 120) },
      travelDate: kstTravelDate(referenceTime),
      referenceTime: referenceTime.toISOString(),
    }, INTERCITY_REQUEST_TIMEOUT_MS);
  } catch {
    return null;
  }
  if (payload.applicable !== true || payload.routeAvailable === false) return null;
  const originStation = normalizeIntercityStation(payload.originStation);
  const destinationStation = normalizeIntercityStation(payload.destinationStation);
  if (!originStation || !destinationStation) return null;

  const stationOrigin = { latitude: originStation.latitude, longitude: originStation.longitude };
  const stationDestination = { latitude: destinationStation.latitude, longitude: destinationStation.longitude };
  const [access, egress] = await Promise.all([
    buildIntercityConnector(origin, stationOrigin, `${originStation.name}역`, originStation.distanceMeters),
    buildIntercityConnector(stationDestination, destination, destinationName, destinationStation.distanceMeters),
  ]);
  const verifiedWaypoints = normalizeRailWaypoints(payload.railWaypoints);
  const completedRailPoints = completeEndpoints([
    { type: "TRAIN", lineName: "고속열차", points: verifiedWaypoints },
  ], stationOrigin, stationDestination)[0]?.points ?? [stationOrigin, stationDestination];
  const railWaypoints = completedRailPoints.map((point, index) => ({
    ...point,
    name: verifiedWaypoints.find((waypoint) => samePoint(waypoint, point))?.name
      ?? (index === 0 ? originStation.name : index === completedRailPoints.length - 1 ? destinationStation.name : "철도 경유역"),
  }));
  const trips = normalizeIntercityTrips(payload.trips);
  const railDistanceMeters = Math.max(1, Math.round(pathDistance(completedRailPoints)));
  const railMinutes = trips[0]?.durationMinutes
    ?? Math.max(20, Math.ceil((railDistanceMeters / 1_000) / 160 * 60));
  const trainLineName = trips[0]?.trainType ?? "고속열차";
  const trainStep: WebTransitStep = {
    type: "TRAIN",
    lineName: trainLineName,
    minutes: railMinutes,
    boardingStation: `${originStation.name}역`,
    alightingStation: `${destinationStation.name}역`,
    stopCount: Math.max(1, railWaypoints.length - 1),
    intermediateStations: railWaypoints.slice(1, -1).map((waypoint) => waypoint.name),
    exitGuidance: null,
  };
  const intercityTrain: WebIntercityTrainJourney = {
    available: payload.available === true,
    routeAvailable: true,
    reason: text(payload.reason),
    directDistanceMeters: Math.max(0, Math.round(number(payload.directDistanceMeters) ?? distanceMeters(origin, destination))),
    originRegion: text(payload.originRegion),
    destinationRegion: text(payload.destinationRegion),
    originStation,
    destinationStation,
    railWaypoints,
    trips,
    sourceNames: Array.isArray(payload.sourceNames) ? payload.sourceNames.flatMap((name) => text(name) ?? []) : [],
    updatedAt: text(payload.updatedAt),
    access,
    egress,
    railDistanceMeters,
    railMinutes,
    railIsEstimated: true,
  };
  return {
    mode: "TRANSIT",
    totalDistanceMeters: access.totalDistanceMeters + railDistanceMeters + egress.totalDistanceMeters,
    totalMinutes: access.totalMinutes + railMinutes + egress.totalMinutes,
    segments: [
      ...access.segments,
      { type: "TRAIN", lineName: trainLineName, points: completedRailPoints },
      ...egress.segments,
    ],
    transitDistanceMeters: (access.transitDistanceMeters ?? 0) + railDistanceMeters + (egress.transitDistanceMeters ?? 0),
    transfers: access.transfers + egress.transfers,
    steps: [...access.steps, trainStep, ...egress.steps],
    accessWalk: access.accessWalk,
    egressWalk: egress.egressWalk,
    busRoutes: [],
    landingURL: `https://m.map.kakao.com/scheme/route?sp=${origin.latitude.toFixed(6)}%2C${origin.longitude.toFixed(6)}&ep=${destination.latitude.toFixed(6)}%2C${destination.longitude.toFixed(6)}&by=publictransit`,
    isEstimated: access.isEstimated || intercityTrain.railIsEstimated || egress.isEstimated,
    intercityTrain,
  };
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

  if (input.mode === "TRANSIT") {
    const intercityRoute = await fetchIntercityRoute(
      origin,
      destination,
      input.destinationName?.slice(0, 120) ?? "시설",
    );
    if (intercityRoute) return intercityRoute;
  }

  const payload = input.mode === "TRANSIT"
    ? await fetchLocalTransitPayload(origin, destination, input.destinationName?.slice(0, 120) ?? "시설")
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
    transitDistanceMeters: input.mode === "TRANSIT"
      ? Math.max(0, Math.round(number(payload.transitDistanceMeters) ?? 0)) || null
      : null,
    transfers: input.mode === "TRANSIT"
      ? Math.max(0, Math.round(number(payload.transfers) ?? 0))
      : 0,
    steps: input.mode === "TRANSIT" ? normalizeTransitSteps(payload.steps) : [],
    accessWalk: input.mode === "TRANSIT" ? normalizeWalkLeg(payload.accessWalk) : null,
    egressWalk: input.mode === "TRANSIT" ? normalizeWalkLeg(payload.egressWalk) : null,
    busRoutes: input.mode === "TRANSIT" ? normalizeBusRoutes(payload.busRoutes) : [],
    landingURL: text(payload.landingURL),
    isEstimated: false,
    intercityTrain: null,
  };
}
