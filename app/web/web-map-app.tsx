"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import Link from "next/link";
import { Archive, ArrowLeftRight, Bell, Building2, BusFront, CakeSlice, CalendarDays, CarFront, ChevronRight, ChevronUp, CircleAlert, Clock, Coffee, Crosshair, CupSoda, Heart, Info, Map as MapIcon, MapPin, MessageCircle, Navigation, ParkingCircle, PersonStanding, Reply, Route, Search, Share, SlidersHorizontal, Sparkles, Store, Trash2, TrainFront, TramFront, Undo2, User, UserRound, UsersRound, Utensils, X } from "lucide-react";
import type { WebHeatShelter, WebMapCluster, WebMapViewportResult, WebNearbyPlace, WebNearbyPlacesSummary, WebParkingLot, WebPlaceSuggestion, WebProgram } from "@/lib/web-program-data";
import { clusterDisplayAreaName, resolvedClusterAreaName, WEB_MAP_CLUSTER_DISPLAY_LIMIT, webMapScopeForRadius, type WebMapAggregationScope } from "@/lib/web-map-cluster";
import { officialProgramAccess } from "@/lib/official-program-access";
import { dominantProgram, programIconName } from "@/lib/web-icon-mapper";
import { WEB_DETAIL_FILTER_GROUPS, WEB_DETAIL_FILTERS, WEB_PROGRAM_PERSONA_GROUPS, toggleSingleWebDetailFilter, webProgramMatchesFilters } from "@/lib/web-program-filters";
import { nearbyKakaoMapURL, nearbyNaverMapURL, nearbyPlaceDisplayName as nearbyDisplayName } from "@/lib/web-map-links";
import {
  hasAmbiguousAdministrativeSuggestions,
  haversineMeters,
  fuzzyAdministrativeTitlePrograms,
  isAdministrativeTitleQuery,
  parseSearchIntent,
  preferredPlaceSuggestion,
  programMatchesAreaTerms,
  relaxedSuggestions,
  resolveSearchCityScope,
  strongOutOfAreaTitleSuggestion,
  searchAroundPlacePrograms,
  searchPrograms,
  searchResultCategories,
  searchResultCategoryIDs,
  searchSuggestionQuery,
  shouldRequestPlaceSuggestions,
  type SearchCityScope,
  type SearchIntent,
  type SearchResultCategory,
} from "@/lib/web-search-engine";
import type { WebRouteMode, WebRouteResult } from "@/lib/web-route-data";
import {
  configureWebUserClient,
  currentWebSession,
  createWebReview,
  createWebReviewComment,
  deleteWebAlert,
  deleteWebFamilyMember,
  deleteWebReview,
  deleteWebReviewComment,
  fetchWebReviews,
  fetchWebUserSnapshot,
  observeWebSession,
  recordWebProgramHistory,
  recordWebLegalConsents,
  saveWebFamilyMember,
  signInToWeb,
  signOutFromWeb,
  upsertWebAlert,
  upsertWebFavorite,
  upsertWebProgramHistoryBatch,
  WEB_AUTH_CONSENT_STORAGE_KEY,
  WEB_AUTH_CONSENT_VERSION,
  webAuthConfigured,
  type Session,
  type WebFamilyMember,
  type WebReview,
  type WebUserAlert,
} from "@/lib/web-user-data";

type KakaoLatLng = { getLat: () => number; getLng: () => number };
type KakaoBounds = { getSouthWest: () => KakaoLatLng; getNorthEast: () => KakaoLatLng; extend: (position: KakaoLatLng) => void };
type KakaoMap = {
  getBounds: () => KakaoBounds; getCenter: () => KakaoLatLng; getLevel: () => number;
  setBounds: (bounds: KakaoBounds, ...padding: number[]) => void; setCenter: (position: KakaoLatLng) => void;
  setLevel: (level: number) => void; panTo: (position: KakaoLatLng) => void;
  setDraggable?: (enabled: boolean) => void; setZoomable?: (enabled: boolean) => void; relayout?: () => void;
};
type KakaoMapItem = { setMap: (map: KakaoMap | null) => void };
type KakaoOverlay = KakaoMapItem;
type KakaoRoadview = { setPanoId: (panoId: number, position: KakaoLatLng) => void };
type KakaoMaps = {
  load: (callback: () => void) => void;
  Map: new (element: HTMLDivElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  CustomOverlay: new (options: { map: KakaoMap; position: KakaoLatLng; content: HTMLElement; yAnchor: number; zIndex: number }) => KakaoOverlay;
  Polyline: new (options: { map: KakaoMap; path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle?: string }) => KakaoMapItem;
  Circle: new (options: { map: KakaoMap; center: KakaoLatLng; radius: number; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle?: string; fillColor: string; fillOpacity: number }) => KakaoMapItem;
  Roadview: new (element: HTMLDivElement) => KakaoRoadview;
  RoadviewClient: new () => { getNearestPanoId: (position: KakaoLatLng, radius: number, callback: (panoId: number | null) => void) => void };
  event: { addListener: (map: KakaoMap, event: string, callback: () => void) => void };
  services?: {
    Status: { OK: string };
    Geocoder: new () => { coord2RegionCode: (longitude: number, latitude: number, callback: (result: Array<{ region_type: string; address_name: string; region_1depth_name: string; region_2depth_name: string; region_3depth_name: string }>, status: string) => void) => void };
  };
};

declare global {
  interface Window { kakao?: { maps: KakaoMaps } }
}

type Tab = "map" | "search" | "openrun" | "saved" | "me";
type Sort = "distance" | "available" | "free";
type StatusFilter = "전체" | "접수중" | "접수예정" | "마감임박";
type Transport = "walk" | "transit" | "car";
type Coordinate = { latitude: number; longitude: number };
type MapFilterRequest = {
  details: string[]; personas: string[]; fields: string[]; audiences: string[];
  fee: string | null; statuses: string[]; todayOnly: boolean;
  originLatitude: number | null; originLongitude: number | null; radiusMeters: number | null;
  south?: number; west?: number; north?: number; east?: number;
  clusterScope?: WebMapAggregationScope;
};
type MapFilterResponse = {
  mode: "individual" | "cluster"; scope: WebMapAggregationScope;
  programs: WebProgram[]; clusters: WebMapCluster[];
  matchCount: number; isComplete: boolean; revision: string;
  south: number | null; west: number | null; north: number | null; east: number | null;
  message?: string;
};
type MapFilterViewportCache = {
  signature: string;
  south: number; west: number; north: number; east: number;
  programs: WebProgram[];
  clusters: WebMapCluster[];
  scope: WebMapAggregationScope;
  storedAt: number;
};

function paddedMapFilterBounds(
  bounds: { south: number; west: number; north: number; east: number },
  padding = .5,
) {
  const latitudePadding = Math.max(.0015, (bounds.north - bounds.south) * padding);
  const longitudePadding = Math.max(.0015, (bounds.east - bounds.west) * padding);
  return {
    south: bounds.south - latitudePadding,
    west: bounds.west - longitudePadding,
    north: bounds.north + latitudePadding,
    east: bounds.east + longitudePadding,
  };
}

function mapFilterBoundsContain(
  outer: { south: number; west: number; north: number; east: number },
  inner: { south: number; west: number; north: number; east: number },
) {
  return inner.south >= outer.south && inner.west >= outer.west
    && inner.north <= outer.north && inner.east <= outer.east;
}

function programsInsideMapFilterBounds(programs: readonly WebProgram[], bounds: { south: number; west: number; north: number; east: number }) {
  return programs.filter((program) => program.latitude >= bounds.south && program.latitude <= bounds.north
    && program.longitude >= bounds.west && program.longitude <= bounds.east);
}

function clustersInsideMapFilterBounds(clusters: readonly WebMapCluster[], bounds: { south: number; west: number; north: number; east: number }) {
  return clusters.filter((cluster) => cluster.latitude >= bounds.south && cluster.latitude <= bounds.north
    && cluster.longitude >= bounds.west && cluster.longitude <= bounds.east);
}

function mapFilterClusterKeyword(request: MapFilterRequest) {
  return request.details[0]
    ?? request.fields[0]
    ?? request.personas[0]
    ?? request.audiences[0]
    ?? request.fee
    ?? request.statuses[0]
    ?? (request.todayOnly ? "오늘 진행" : null)
    ?? (request.radiusMeters ? `${request.radiusMeters < 1_000 ? `${request.radiusMeters}m` : `${request.radiusMeters / 1_000}km`} 이내` : null)
    ?? "선택 조건";
}

function filteredClusterCountLabel(count: number) {
  const value = Math.max(0, Math.round(count));
  return value >= 9 ? "9+" : value.toLocaleString("ko-KR");
}

function visibleClusterInsightLabel(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  const key = trimmed.replace(/\s+/g, "");
  return !trimmed || key === "전체" || ["이용가능", "이용가능프로그램", "신청가능한강좌", "신청가능한프로그램"].includes(key)
    ? null
    : trimmed;
}
type AuxiliaryPanel = "calendar" | "family" | "history" | "nearby" | "programs" | null;
type PlaceSheetState = { programs: WebProgram[]; index: number; expectedCount: number; loading: boolean };
type NearbyCategory = "all" | WebNearbyPlace["placeType"];
type AlertDialogState = { program: WebProgram; scheduledAt: string };

function useSmoothSearchProgress(target: number, active: boolean) {
  const normalizedTarget = Math.max(0, Math.min(100, target));
  const [displayed, setDisplayed] = useState(0);
  const displayedRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    if (!active) {
      frame = window.requestAnimationFrame(() => {
        displayedRef.current = normalizedTarget;
        setDisplayed(normalizedTarget);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    let previousTime = performance.now();
    const advance = (time: number) => {
      if (normalizedTarget < displayedRef.current) {
        displayedRef.current = 0;
        setDisplayed(0);
        previousTime = time;
        frame = window.requestAnimationFrame(advance);
        return;
      }
      const elapsedSeconds = Math.min(.05, Math.max(.001, (time - previousTime) / 1_000));
      previousTime = time;
      const remaining = normalizedTarget - displayedRef.current;
      if (remaining <= .05) {
        displayedRef.current = normalizedTarget;
        setDisplayed(normalizedTarget);
        return;
      }
      displayedRef.current = Math.min(normalizedTarget, displayedRef.current + Math.max(12, remaining * 4.2) * elapsedSeconds);
      setDisplayed(displayedRef.current);
      frame = window.requestAnimationFrame(advance);
    };
    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [active, normalizedTarget]);

  return Math.round(displayed);
}

type MobileSheetSnap = "hidden" | "collapsed" | "medium" | "expanded";
type PlaceSheetSnap = "hidden" | "collapsed" | "expanded";
type RoutePanelMode = "route" | "nearby";
type RoutePanelSnap = "hidden" | "collapsed" | "expanded";
type LocationRequestState = "idle" | "checking" | "granted" | "denied" | "unavailable" | "timeout";
type SearchSort = "relevance" | "distance" | "available" | "free";
type SearchAssistantState =
  | { kind: "idle" }
  | { kind: "placeOffer"; place: WebPlaceSuggestion; radiusKm: number }
  | { kind: "placeSearching"; place: WebPlaceSuggestion; radiusKm: number }
  | { kind: "placeFound"; place: WebPlaceSuggestion; radiusKm: number; count: number }
  | { kind: "placeExpand"; place: WebPlaceSuggestion; currentRadiusKm: number; nextRadiusKm: number; remoteSucceeded: boolean }
  | { kind: "alternativeFound"; message: string; count: number }
  | { kind: "titleSuggestion"; regionName: string; programName: string; suggestedQuery: string; programID: string };

const ROUTE_MODE: Record<Transport, WebRouteMode> = {
  walk: "WALKING",
  transit: "TRANSIT",
  car: "DRIVING",
};

const FALLBACK: Coordinate = { latitude: 37.6027, longitude: 127.0128 };
// Keep account-only screens behind one boundary so authentication and the
// related saved, alert, family, and profile experiences stay synchronized.
const WEB_ACCOUNT_FEATURES_VISIBLE = true;
const ACCOUNT_TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "openrun", icon: "🔔", label: "오픈런" },
  { id: "saved", icon: "♡", label: "찜" },
  { id: "me", icon: "⚙", label: "설정" },
];
const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "map", icon: "⌂", label: "홈" },
  { id: "search", icon: "⌕", label: "찾기" },
  ...(WEB_ACCOUNT_FEATURES_VISIBLE ? ACCOUNT_TABS : []),
];

const SEARCH_EXAMPLES = [
  "이번 주말 아이랑 갈 무료 행사",
  "오픈런 접수 시작하는 강좌",
  "우리 동네 시니어 컴퓨터 교실",
  "가까운 무료 수영 강좌",
  "어르신 미술 공예 프로그램",
  "오전에 들을 수 있는 음악 강좌",
];
const SEARCH_EXAMPLE_ICONS = ["🌅", "⏰", "👴", "🏊", "🎨", "🎵"];
const SEARCH_PLACE_RADIUS_OPTIONS = [0.3, 0.5, 1, 3, 5, 10, 20];

function distanceMeters(a: Coordinate, b: Coordinate) {
  return haversineMeters(a, b);
}

function distanceLabel(meters: number) {
  if (!Number.isFinite(meters)) return "거리 확인 중";
  return meters < 1_000 ? `${Math.max(10, Math.round(meters / 10) * 10)}m` : `${(meters / 1_000).toFixed(1)}km`;
}

function searchRadiusLabel(radiusKm: number) {
  return radiusKm < 1 ? `${Math.round(radiusKm * 1_000)}m` : `${radiusKm.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}km`;
}

const PROGRAM_DISTANCE_RADII_KM: ReadonlyArray<number | null> = [
  null, 0.1, 0.3, 0.5, 1, 3, 5, 10, 20,
];

function programDistanceRadiusLabel(radiusKm: number | null) {
  if (radiusKm === null) return "전체";
  return radiusKm < 1 ? `${Math.round(radiusKm * 1_000)}m` : `${radiusKm}km`;
}

export function webMapFilterSelectionSignature({
  fieldFilter,
  personaFilters,
  subjectFilters,
  statusFilter,
  todayOnly,
  freeOnly,
  paidOnly,
  seniorOnly,
  radiusKm,
}: {
  fieldFilter: string; personaFilters: string[]; subjectFilters: string[]; statusFilter: StatusFilter;
  todayOnly: boolean; freeOnly: boolean; paidOnly: boolean; seniorOnly: boolean; radiusKm: number | null;
}) {
  return [
    fieldFilter,
    [...personaFilters].sort().join(","),
    [...subjectFilters].sort().join(","),
    statusFilter,
    todayOnly ? "today" : "",
    freeOnly ? "free" : "",
    paidOnly ? "paid" : "",
    seniorOnly ? "senior" : "",
    radiusKm?.toString() ?? "",
  ].join("|");
}

function uniquePrograms(programs: WebProgram[]) {
  const seen = new Set<string>();
  return programs.filter((program) => !seen.has(program.id) && Boolean(seen.add(program.id)));
}

function travelDuration(minutes: number, approximate = false) {
  const value = Math.max(0, Math.round(minutes));
  const duration = value < 60
    ? `${value}분`
    : value % 60 === 0 ? `${Math.floor(value / 60)}시간` : `${Math.floor(value / 60)}시간 ${value % 60}분`;
  return approximate ? `약 ${duration}` : duration;
}

function TravelModeIcon({ transport, size = 18 }: { transport: Transport; size?: number }) {
  if (transport === "walk") return <PersonStanding aria-hidden="true" size={size} strokeWidth={2.5} />;
  if (transport === "car") return <CarFront aria-hidden="true" size={size} strokeWidth={2.5} />;
  return <TramFront aria-hidden="true" size={size} strokeWidth={2.5} />;
}

function isAvailable(program: WebProgram) {
  const unavailable = /마감|종료|취소|완료/.test(program.status);
  if (unavailable) return false;
  if (!program.receiptEnd) return true;
  const end = new Date(program.receiptEnd).getTime();
  return !Number.isFinite(end) || end >= Date.now() - 86_400_000;
}

function statusRank(program: WebProgram) {
  if (/접수중|상시|진행중|가능|안내중/.test(program.status)) return 0;
  if (/예정|곧/.test(program.status)) return 1;
  if (/마감임박/.test(program.status)) return 2;
  return 3;
}

function mobileSheetHeights(viewportHeight: number) {
  const available = Math.max(320, viewportHeight - 74);
  return {
    hidden: 0,
    collapsed: 116,
    medium: Math.min(520, Math.max(330, Math.round(available * 0.56))),
    expanded: Math.max(320, available - 8),
  } satisfies Record<MobileSheetSnap, number>;
}

function placeSheetHeights(viewportHeight: number) {
  const available = Math.max(380, viewportHeight - 82);
  return {
    hidden: 0,
    collapsed: Math.min(500, Math.max(330, Math.round(available * 0.5))),
    expanded: available,
  } satisfies Record<PlaceSheetSnap, number>;
}

function routePanelHeights(viewportHeight: number, mode: RoutePanelMode = "route", hasNearbySelection = false) {
  const available = Math.max(500, viewportHeight - 82);
  return {
    hidden: 0,
    collapsed: mode === "route" ? 230 : hasNearbySelection ? 368 : 350,
    expanded: Math.min(840, available, Math.max(500, Math.round(viewportHeight * 0.91))),
  } satisfies Record<RoutePanelSnap, number>;
}

function markerPlaceKey(program: WebProgram) {
  return `${program.latitude.toFixed(5)}:${program.longitude.toFixed(5)}`;
}

async function resolveMapClusterAreas(clusters: WebMapCluster[]): Promise<WebMapCluster[]> {
  const services = window.kakao?.maps.services;
  if (!services || clusters.length === 0) return clusters;
  const geocoder = new services.Geocoder();
  const resolved = await Promise.all(clusters.map((cluster) => new Promise<WebMapCluster>((resolve) => {
    let complete = false;
    const finish = (areaName: string) => {
      if (complete) return;
      complete = true;
      window.clearTimeout(timeout);
      resolve({ ...cluster, areaName });
    };
    const timeout = window.setTimeout(() => finish(clusterDisplayAreaName(cluster.areaName)), 900);
    geocoder.coord2RegionCode(cluster.longitude, cluster.latitude, (result, status) => {
      if (status !== services.Status.OK || !result.length) return finish(clusterDisplayAreaName(cluster.areaName));
      const region = result.find((item) => item.region_type === "H") ?? result[0];
      finish(resolvedClusterAreaName(
        cluster.scope,
        cluster.areaName,
        region.region_1depth_name,
        region.region_2depth_name,
        region.region_3depth_name,
      ));
    });
  })));

  const merged = new Map<string, WebMapCluster>();
  resolved.forEach((cluster) => {
    const key = `${cluster.scope}:${cluster.areaName}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, { ...cluster, id: `resolved:${key}` });
      return;
    }
    const total = previous.programCount + cluster.programCount;
    merged.set(key, {
      ...previous,
      latitude: (previous.latitude * previous.programCount + cluster.latitude * cluster.programCount) / total,
      longitude: (previous.longitude * previous.programCount + cluster.longitude * cluster.programCount) / total,
      programCount: total,
      programIds: [...new Set([...previous.programIds, ...cluster.programIds])],
    });
  });
  return [...merged.values()];
}

function estimatedRoute(distance: number, transport: Transport) {
  const factor = transport === "walk" ? 1.22 : transport === "car" ? 1.35 : 1.28;
  const routeDistance = Math.max(10, distance * factor);
  const minutes = transport === "walk"
    ? routeDistance / 80
    : transport === "car" ? routeDistance / 500 : routeDistance / 260 + 7;
  return { distance: routeDistance, minutes: Math.max(1, Math.round(minutes)) };
}

function statusClass(program: WebProgram) {
  if (/마감임박/.test(program.status)) return "urgent";
  if (!isAvailable(program)) return "closed";
  return "open";
}

function fieldMatches(program: WebProgram, filter: string) {
  if (filter === "전체") return true;
  const text = `${program.category} ${program.field} ${program.rawCategory} ${program.rawField} ${program.name}`;
  if (filter === "교육") return /교육|강좌|인문|외국어|영어|독서|글쓰기|요리|공예/.test(text);
  if (filter === "문화예술") return /문화|예술|미술|음악|국악|무용|공예/.test(text);
  if (filter === "건강운동") return /체육|운동|건강|수영|요가|필라테스|헬스|축구|농구|테니스|탁구|배드민턴/.test(text);
  if (filter === "공연전시") return /공연|전시|연극|뮤지컬|콘서트|축제|행사|영화/.test(text);
  if (filter === "복지") return /복지|상담|시니어|어르신|치매|장애/.test(text);
  if (filter === "디지털") return /디지털|컴퓨터|스마트폰|코딩|AI|인공지능|키오스크/.test(text);
  return text.includes(filter);
}

function cleanMapText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function programFacilitySearchText(program: WebProgram) {
  return cleanMapText(program.facility.split(">")[0]) || cleanMapText(program.address);
}

function mapLink(program: WebProgram) {
  const destination = programFacilitySearchText(program).replace(/,/g, " ");
  return `https://map.kakao.com/link/map/${encodeURIComponent(destination)},${program.latitude},${program.longitude}`;
}

function naverMapLink(program: WebProgram) {
  const query = programFacilitySearchText(program);
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}?c=${program.longitude},${program.latitude},17,0,0,0,dh`;
}

function googleMapLink(program: WebProgram) {
  const query = `${program.latitude},${program.longitude} (${program.facility})`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function routeLink(program: WebProgram, current: Coordinate, transport: Transport) {
  const route = transport === "walk" ? "foot" : transport === "car" ? "car" : "publictransit";
  const params = new URLSearchParams({
    sp: `${current.latitude.toFixed(6)},${current.longitude.toFixed(6)}`,
    ep: `${program.latitude.toFixed(6)},${program.longitude.toFixed(6)}`,
    by: route,
  });
  return `https://m.map.kakao.com/scheme/route?${params}`;
}

function nearbyCategoryDisplayName(place: WebNearbyPlace) {
  return cleanMapText(place.categorySmallName)
    || cleanMapText(place.categoryMediumName)
    || cleanMapText(place.categoryLargeName)
    || ({ restaurant: "음식점", cafe: "카페", fast_food: "패스트푸드", convenience_store: "편의점", other_food: "간식·분식" } as const)[place.placeType];
}

function nearbyMarkerElement(placeType: WebNearbyPlace["placeType"]) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("dg-nearby-marker-glyph");
  const paths: Record<WebNearbyPlace["placeType"], string[]> = {
    restaurant: ["M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"],
    cafe: ["M10 2v2", "M14 2v2", "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1", "M6 2v2"],
    fast_food: ["m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8", "M5 8h14", "M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0", "m12 8 1-6h2"],
    convenience_store: ["M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5", "M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244", "M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"],
    other_food: ["M16 13H3", "M16 17H3", "m7.2 7.9-3.388 2.5A2 2 0 0 0 3 12.01V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-8.654c0-2-2.44-6.026-6.44-8.026a1 1 0 0 0-1.082.057L10.4 5.6"],
  };
  paths[placeType].forEach((value) => {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", value);
    svg.appendChild(path);
  });
  if (placeType === "other_food") {
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", "9");
    circle.setAttribute("cy", "7");
    circle.setAttribute("r", "2");
    svg.appendChild(circle);
  }
  return svg;
}

function routeEndpointElement(kind: "origin" | "destination") {
  const root = document.createElement("span");
  root.className = `dg-route-marker-visual ${kind}`;
  root.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    const ripple = document.createElement("i");
    ripple.style.setProperty("--dg-route-ripple-delay", `${index * -0.74}s`);
    root.appendChild(ripple);
  }
  const core = document.createElement("span");
  core.className = "dg-route-marker-core";
  if (kind === "origin") {
    core.append(document.createElement("b"), document.createElement("em"));
  } else {
    core.textContent = "🏢";
  }
  root.appendChild(core);
  return root;
}

function nearbyParkingLabel(place: WebNearbyPlace) {
  if (!place.parkingLotID) return "주차 정보 없음";
  const distance = place.parkingDistanceMeters === null ? "거리 확인" : distanceLabel(place.parkingDistanceMeters);
  if ((place.parkingAvailableSpaces ?? 0) > 0) return `주변 주차 가능 · ${place.parkingAvailableSpaces}면 · ${distance}`;
  if (place.parkingAvailabilityStatus === "이용가능") return `주변 주차 가능 · ${distance}`;
  if (place.parkingAvailabilityStatus === "만차") return `주변 주차장 만차 · ${distance}`;
  if (place.parkingAvailabilityStatus === "이용불가") return `주변 주차장 이용 불가 · ${distance}`;
  return `주변 주차장 · ${distance}`;
}

function NearbyPlaceIcon({ placeType }: { placeType: WebNearbyPlace["placeType"] }) {
  if (placeType === "cafe") return <Coffee aria-hidden="true" />;
  if (placeType === "fast_food") return <CupSoda aria-hidden="true" />;
  if (placeType === "convenience_store") return <Store aria-hidden="true" />;
  if (placeType === "other_food") return <CakeSlice aria-hidden="true" />;
  return <Utensils aria-hidden="true" />;
}

async function fetchPrograms(params: URLSearchParams, signal?: AbortSignal): Promise<WebProgram[]> {
  const response = await fetch(`/api/web-programs?${params}`, { signal, cache: "no-store" });
  const payload = await response.json() as { programs?: WebProgram[]; message?: string };
  if (!response.ok) throw new Error(payload.message ?? "프로그램을 불러오지 못했습니다.");
  return payload.programs ?? [];
}

async function fetchMapFilterCatalog(body: MapFilterRequest, signal?: AbortSignal): Promise<MapFilterResponse> {
  const response = await fetch("/api/web-map-filter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  const payload = await response.json() as MapFilterResponse;
  if (!response.ok) throw new Error(payload.message ?? "조건 프로그램을 불러오지 못했습니다.");
  return payload;
}

async function fetchSearchSuggestions(query: string): Promise<WebPlaceSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/web-search-assistant?${params}`, { cache: "no-store" });
  const payload = await response.json() as { suggestions?: WebPlaceSuggestion[]; message?: string };
  if (!response.ok) throw new Error(payload.message ?? "지역·장소 이름을 확인하지 못했습니다.");
  return payload.suggestions ?? [];
}

async function fetchProgramsAroundPlace(place: WebPlaceSuggestion, radiusKm: number): Promise<WebProgram[]> {
  if (place.latitude === null || place.longitude === null) return [];
  const params = new URLSearchParams({
    mode: "nearby",
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    radiusKm: String(radiusKm),
  });
  const response = await fetch(`/api/web-search-assistant?${params}`, { cache: "no-store" });
  const payload = await response.json() as { programs?: WebProgram[]; message?: string };
  if (!response.ok) throw new Error(payload.message ?? "장소 주변 프로그램을 불러오지 못했습니다.");
  return payload.programs ?? [];
}

export default function WebMapApp({ kakaoMapKey, supabaseUrl, supabasePublishableKey }: { kakaoMapKey: string; supabaseUrl: string; supabasePublishableKey: string }) {
  configureWebUserClient({ url: supabaseUrl, publishableKey: supabasePublishableKey });
  const mapElementRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef("");
  const mapRef = useRef<KakaoMap | null>(null);
  const sharedProgramIDRef = useRef<string | null>(null);
  const sharedProgramCenteredRef = useRef<string | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const routeOverlaysRef = useRef<KakaoOverlay[]>([]);
  const mapItemsRef = useRef<KakaoMapItem[]>([]);
  const mapRequestIDRef = useRef(0);
  const mapBoundsAbortRef = useRef<AbortController | null>(null);
  const initialLocationRequestStartedRef = useRef(false);
  const searchRequestIDRef = useRef(0);
  const searchSuggestionRequestIDRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const sheetDragRef = useRef({ pointerID: -1, startY: 0, startHeight: 0, moved: false });
  const sheetGrabberRef = useRef<HTMLButtonElement>(null);
  const routeSheetDragRef = useRef({ pointerID: -1, startY: 0, moved: false });
  const routeSheetGrabberRef = useRef<HTMLButtonElement>(null);
  const mainRoutePanelRef = useRef<HTMLElement>(null);
  const mainRoutePanelDragRef = useRef({ pointerID: -1, startY: 0, startHeight: 230, moved: false });
  const mapModeRef = useRef<"individual" | "cluster">("individual");
  const mapScopeRef = useRef<WebMapAggregationScope>("individual");
  const searchActiveRef = useRef(false);
  const heatShelterModeRef = useRef(false);
  const programFilterActiveRef = useRef(false);
  const mapFilterRequestRef = useRef<MapFilterRequest>({
    details: [], personas: [], fields: [], audiences: [], fee: null, statuses: [], todayOnly: false,
    originLatitude: null, originLongitude: null, radiusMeters: null,
  });
  const filterCatalogPendingRef = useRef(false);
  const mapFilterSignatureRef = useRef("");
  const completeFilterCatalogRef = useRef<{ signature: string; programs: WebProgram[] } | null>(null);
  const filterViewportCacheRef = useRef<MapFilterViewportCache | null>(null);
  const filterClusterViewportCacheRef = useRef<MapFilterViewportCache[]>([]);
  const mapFilterRequestKeyRef = useRef<string | null>(null);
  const [filterCatalogReadyRequestId, setFilterCatalogReadyRequestId] = useState(0);
  const [programs, setPrograms] = useState<WebProgram[]>([]);
  const [mapClusters, setMapClusters] = useState<WebMapCluster[]>([]);
  const [programCounts, setProgramCounts] = useState<Record<string, number>>({});
  const [mapMode, setMapMode] = useState<"individual" | "cluster">("individual");
  const [mapScope, setMapScope] = useState<WebMapAggregationScope>("individual");
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<WebProgram | null>(null);
  const [placeSheet, setPlaceSheet] = useState<PlaceSheetState | null>(null);
  const filteredClusterCarouselAnchorRef = useRef<Coordinate | null>(null);
  const filteredClusterCarouselSignatureRef = useRef<string | null>(null);
  const filteredClusterCarouselProgramsRef = useRef<WebProgram[]>([]);
  const [filteredClusterCarouselSignature, setFilteredClusterCarouselSignature] = useState<string | null>(null);
  const [filteredClusterCarouselPrograms, setFilteredClusterCarouselPrograms] = useState<WebProgram[]>([]);
  const [filteredClusterFocusedProgramID, setFilteredClusterFocusedProgramID] = useState<string | null>(null);
  const [mapProgramCarouselSource, setMapProgramCarouselSource] = useState<"condition" | "nearby" | null>(null);
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>("hidden");
  const [mobileSheetDragHeight, setMobileSheetDragHeight] = useState<number | null>(null);
  const [routeSheetCollapsed, setRouteSheetCollapsed] = useState(false);
  const [routeSheetDragOffset, setRouteSheetDragOffset] = useState<number | null>(null);
  const [routePanelActive, setRoutePanelActive] = useState(false);
  const [routePanelMode, setRoutePanelMode] = useState<RoutePanelMode>("route");
  const [routePanelSnap, setRoutePanelSnap] = useState<RoutePanelSnap>("collapsed");
  const [routePanelDragHeight, setRoutePanelDragHeight] = useState<number | null>(null);
  const [auxiliaryPanel, setAuxiliaryPanel] = useState<AuxiliaryPanel>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filterFitRequestId, setFilterFitRequestId] = useState(0);
  const [filterFitAppliedSignature, setFilterFitAppliedSignature] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  const [searchCandidates, setSearchCandidates] = useState<WebProgram[]>([]);
  const [searchResults, setSearchResults] = useState<WebProgram[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchCityScope, setSearchCityScope] = useState<SearchCityScope>({ displayName: "서울", regionPath: "서울", candidateAreaTerms: ["서울"] });
  const [searchSuggestions, setSearchSuggestions] = useState<WebPlaceSuggestion[]>([]);
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false);
  const [searchSuggestionError, setSearchSuggestionError] = useState("");
  const [searchWarning, setSearchWarning] = useState("");
  const [searchAlternativeNotice, setSearchAlternativeNotice] = useState("");
  const [searchAssistant, setSearchAssistant] = useState<SearchAssistantState>({ kind: "idle" });
  const [searchResultCategory, setSearchResultCategory] = useState<string | null>(null);
  const [searchSort, setSearchSort] = useState<SearchSort>("relevance");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("distance");
  const [fieldFilter, setFieldFilter] = useState("전체");
  const [personaFilters, setPersonaFilters] = useState<string[]>([]);
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [todayOnly, setTodayOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [paidOnly, setPaidOnly] = useState(false);
  const [seniorOnly, setSeniorOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [location, setLocation] = useState<Coordinate>(FALLBACK);
  const [usesFallbackLocation, setUsesFallbackLocation] = useState(true);
  const programRadiusFilterRef = useRef({ radiusKm: null as number | null, usesFallbackLocation: true });
  const [locationRequestState, setLocationRequestState] = useState<LocationRequestState>("idle");
  const [locationRequestMessage, setLocationRequestMessage] = useState("");
  const [center, setCenter] = useState<Coordinate>(FALLBACK);
  const [centeredArea, setCenteredArea] = useState("서울특별시 종로구 세종로");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [viewHistory, setViewHistory] = useState<Array<{ program: WebProgram; viewedAt: string }>>([]);
  const [loading, setLoading] = useState(Boolean(kakaoMapKey));
  const [mapReady, setMapReady] = useState(false);
  const [mapLevel, setMapLevel] = useState(5);
  const [error, setError] = useState(kakaoMapKey ? "" : "Kakao 지도 연결 설정을 확인해 주세요.");
  const [transport, setTransport] = useState<Transport>("transit");
  const [bigText, setBigText] = useState(false);
  const [easyFirst, setEasyFirst] = useState(true);
  const [phoneFirst, setPhoneFirst] = useState(false);
  const [bigAlerts, setBigAlerts] = useState(true);
  const [heatShelterMode, setHeatShelterMode] = useState(false);
  const [heatShelters, setHeatShelters] = useState<WebHeatShelter[]>([]);
  const [selectedHeatShelter, setSelectedHeatShelter] = useState<WebHeatShelter | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState(100);
  const [nearbyCategory, setNearbyCategory] = useState<NearbyCategory>("all");
  const [nearbySummary, setNearbySummary] = useState<WebNearbyPlacesSummary | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyDestination, setNearbyDestination] = useState<WebProgram | null>(null);
  const [selectedNearbyPlace, setSelectedNearbyPlace] = useState<WebNearbyPlace | null>(null);
  const [nearbyWalkingRoute, setNearbyWalkingRoute] = useState<WebRouteResult | null>(null);
  const [activeRoute, setActiveRoute] = useState<WebRouteResult | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => WEB_ACCOUNT_FEATURES_VISIBLE && webAuthConfigured());
  const [accountError, setAccountError] = useState("");
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authConsentAccepted, setAuthConsentAccepted] = useState(false);
  const [favoriteTargets, setFavoriteTargets] = useState<Record<string, string[]>>({});
  const [userAlerts, setUserAlerts] = useState<WebUserAlert[]>([]);
  const [familyMembers, setFamilyMembers] = useState<WebFamilyMember[]>([]);
  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null);

  const openRunBadge = useMemo(
    () => Math.min(9, programs.filter((program) => program.receiptStart && isAvailable(program)).length),
    [programs],
  );
  const activeConditionCount = useMemo(() => {
    let count = subjectFilters.length + personaFilters.length;
    if (fieldFilter !== "전체") count += 1;
    if (freeOnly) count += 1;
    if (paidOnly) count += 1;
    if (statusFilter !== "전체") count += 1;
    if (todayOnly) count += 1;
    if (radiusKm !== null) count += 1;
    if (seniorOnly && !personaFilters.includes("시니어")) count += 1;
    return count;
  }, [fieldFilter, freeOnly, paidOnly, personaFilters, radiusKm, seniorOnly, statusFilter, subjectFilters, todayOnly]);
  const currentFilterSelectionSignature = webMapFilterSelectionSignature({
    fieldFilter, personaFilters, subjectFilters, statusFilter, todayOnly,
    freeOnly, paidOnly, seniorOnly, radiusKm,
  });
  const mapFilterRequest = useMemo<MapFilterRequest>(() => ({
    details: subjectFilters,
    personas: seniorOnly && !personaFilters.includes("시니어") ? [...personaFilters, "시니어"] : personaFilters,
    fields: fieldFilter === "전체" ? [] : [fieldFilter],
    audiences: [],
    fee: freeOnly ? "무료" : paidOnly ? "유료" : null,
    statuses: statusFilter === "전체" ? [] : [statusFilter],
    todayOnly,
    originLatitude: radiusKm !== null && !usesFallbackLocation ? location.latitude : null,
    originLongitude: radiusKm !== null && !usesFallbackLocation ? location.longitude : null,
    radiusMeters: radiusKm === null ? null : radiusKm * 1_000,
  }), [fieldFilter, freeOnly, location.latitude, location.longitude, paidOnly, personaFilters, radiusKm, seniorOnly, statusFilter, subjectFilters, todayOnly, usesFallbackLocation]);

  useEffect(() => {
    programRadiusFilterRef.current = { radiusKm, usesFallbackLocation };
    programFilterActiveRef.current = activeConditionCount > 0;
    mapFilterRequestRef.current = mapFilterRequest;
    mapFilterSignatureRef.current = currentFilterSelectionSignature;
    if (activeConditionCount === 0 || completeFilterCatalogRef.current?.signature !== currentFilterSelectionSignature) {
      completeFilterCatalogRef.current = null;
    }
  }, [activeConditionCount, currentFilterSelectionSignature, mapFilterRequest, radiusKm, usesFallbackLocation]);

  const focusFilteredClusterProgram = useCallback((program: WebProgram) => {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) return;
    const coordinate = new maps.LatLng(program.latitude, program.longitude);
    setFilteredClusterFocusedProgramID(program.id);
    setCenter({ latitude: program.latitude, longitude: program.longitude });
    map.panTo(coordinate);
    if (map.getLevel() > 4) map.setLevel(4);
  }, []);

  useEffect(() => {
    // This state snapshots the exact condition signature associated with a user-triggered fit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (filterFitRequestId > 0) setFilterFitAppliedSignature(currentFilterSelectionSignature);
    // request id changes only for a quick keyword or the explicit Apply button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFitRequestId]);

  useEffect(() => {
    const read = (key: string) => {
      try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; }
    };
    const hydratePreferences = () => {
      if (WEB_ACCOUNT_FEATURES_VISIBLE) {
        setFavorites(read("dongnegogo.web.favorites"));
        setReminders(read("dongnegogo.web.reminders"));
        try {
          const alerts = JSON.parse(localStorage.getItem("dongnegogo.web.alerts") ?? "[]") as WebUserAlert[];
          setUserAlerts(alerts.filter((alert) => alert?.program_id).map((alert) => ({
            ...alert,
            scheduled_times: Array.isArray(alert.scheduled_times)
              ? alert.scheduled_times.filter((value): value is string => typeof value === "string").slice(0, 3)
              : alert.scheduled_at ? [alert.scheduled_at] : [],
          })));
        } catch { setUserAlerts([]); }
        try {
          const family = JSON.parse(localStorage.getItem("dongnegogo.web.family") ?? "[]") as WebFamilyMember[];
          setFamilyMembers(family.filter((member) => member?.role && member.age_group && member.region));
        } catch { setFamilyMembers([]); }
      }
      setBigText(localStorage.getItem("dongnegogo.web.bigText") === "true");
      setEasyFirst(localStorage.getItem("dongnegogo.web.easyFirst") !== "false");
      setPhoneFirst(localStorage.getItem("dongnegogo.web.phoneFirst") === "true");
      setBigAlerts(localStorage.getItem("dongnegogo.web.bigAlerts") !== "false");
      setRecentSearches(read("dongnegogo.web.recentSearches").slice(0, 8));
      try {
        const history = JSON.parse(localStorage.getItem("dongnegogo.web.viewHistory") ?? "[]") as Array<{ program: WebProgram; viewedAt: string }>;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oldest = today.getTime() - 3 * 86_400_000;
        setViewHistory(history.filter((item) => item?.program?.id && item.viewedAt && new Date(item.viewedAt).getTime() >= oldest).slice(0, 1_600));
      } catch { setViewHistory([]); }
    };
    const frame = window.requestAnimationFrame(hydratePreferences);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (tab !== "search") return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

  useEffect(() => {
    if (tab !== "search") return;
    const term = query.trim();
    if (!term || term === submittedQuery) return;
    const intent = parseSearchIntent(term);
    if (!shouldRequestPlaceSuggestions(term, intent)) return;
    const candidate = searchSuggestionQuery(term, intent);
    const requestID = ++searchSuggestionRequestIDRef.current;
    const timer = window.setTimeout(() => {
      void fetchSearchSuggestions(candidate).then((suggestions) => {
        if (requestID !== searchSuggestionRequestIDRef.current || queryRef.current.trim() !== term) return;
        setSearchSuggestions(suggestions);
      }).catch(() => {
        if (requestID !== searchSuggestionRequestIDRef.current || queryRef.current.trim() !== term) return;
        setSearchSuggestions([]);
        setSearchSuggestionError("추가 지역·장소 이름을 확인하지 못했어요. 검색은 그대로 진행할 수 있어요.");
      }).finally(() => {
        if (requestID === searchSuggestionRequestIDRef.current) setSearchSuggestionsLoading(false);
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [query, submittedQuery, tab]);

  const synchronizeAccount = useCallback(async (activeSession: Session) => {
    setAccountError("");
    try {
      const snapshot = await fetchWebUserSnapshot(activeSession);
      const localFavoriteIDs = (() => {
        try { return JSON.parse(localStorage.getItem("dongnegogo.web.favorites") ?? "[]") as string[]; }
        catch { return []; }
      })();
      const localReminderIDs = (() => {
        try { return JSON.parse(localStorage.getItem("dongnegogo.web.reminders") ?? "[]") as string[]; }
        catch { return []; }
      })();
      const localHistory = (() => {
        try { return JSON.parse(localStorage.getItem("dongnegogo.web.viewHistory") ?? "[]") as Array<{ program: WebProgram; viewedAt: string }>; }
        catch { return []; }
      })().filter((item) => item?.program?.id && item.viewedAt && Number.isFinite(new Date(item.viewedAt).getTime())).slice(0, 200);
      const mergedTargets = { ...snapshot.favoriteTargets };
      for (const programID of localFavoriteIDs) {
        if (!mergedTargets[programID]) {
          mergedTargets[programID] = ["personal"];
          await upsertWebFavorite(activeSession, programID, ["personal"]);
        }
      }
      const remoteAlertIDs = new Set(snapshot.alerts.map((alert) => alert.program_id));
      for (const programID of localReminderIDs) {
        if (!remoteAlertIDs.has(programID)) {
          await upsertWebAlert(activeSession, programID, null);
          snapshot.alerts.push({
            program_id: programID,
            minutes_before: 60,
            enabled_at: new Date().toISOString(),
            scheduled_at: null,
          });
        }
      }
      await upsertWebProgramHistoryBatch(activeSession, localHistory.map((item) => ({
        program_id: item.program.id,
        viewed_at: item.viewedAt,
      })));
      const mergedHistory = new Map(snapshot.history.map((item) => [item.program_id, item.viewed_at]));
      for (const item of localHistory) {
        const remoteViewedAt = mergedHistory.get(item.program.id);
        if (!remoteViewedAt || new Date(item.viewedAt) > new Date(remoteViewedAt)) mergedHistory.set(item.program.id, item.viewedAt);
      }
      const programByID = new Map(localHistory.map((item) => [item.program.id, item.program]));
      const missingProgramIDs = [...mergedHistory.keys()].filter((programID) => !programByID.has(programID));
      for (let start = 0; start < missingProgramIDs.length; start += 80) {
        const parameters = new URLSearchParams();
        for (const programID of missingProgramIDs.slice(start, start + 80)) parameters.append("id", programID);
        try {
          const hydrated = await fetchPrograms(parameters);
          for (const program of hydrated) programByID.set(program.id, program);
        } catch {
          // Keep the rest of the account snapshot usable when an old program was retired.
        }
      }
      const accountHistory = [...mergedHistory.entries()].flatMap(([programID, viewedAt]) => {
        const program = programByID.get(programID);
        return program ? [{ program, viewedAt }] : [];
      }).sort((left, right) => new Date(right.viewedAt).getTime() - new Date(left.viewedAt).getTime()).slice(0, 200);
      setFavoriteTargets(mergedTargets);
      setFavorites(Object.keys(mergedTargets));
      setUserAlerts(snapshot.alerts);
      setReminders(snapshot.alerts.map((alert) => alert.program_id));
      setFamilyMembers(snapshot.family);
      setViewHistory(accountHistory);
      localStorage.setItem("dongnegogo.web.viewHistory", JSON.stringify(accountHistory));
    } catch (syncError) {
      setAccountError(syncError instanceof Error ? syncError.message : "계정 데이터를 불러오지 못했어요.");
    }
  }, []);

  const synchronizeAuthenticatedAccount = useCallback(async (activeSession: Session) => {
    await synchronizeAccount(activeSession);
    if (localStorage.getItem(WEB_AUTH_CONSENT_STORAGE_KEY) !== WEB_AUTH_CONSENT_VERSION) return;
    try {
      await recordWebLegalConsents(activeSession);
    } catch (consentError) {
      setAccountError(consentError instanceof Error ? consentError.message : "로그인 동의 기록을 저장하지 못했어요.");
    }
  }, [synchronizeAccount]);

  useEffect(() => {
    if (!WEB_ACCOUNT_FEATURES_VISIBLE || !webAuthConfigured()) return;
    let disposed = false;
    void currentWebSession().then((currentSession) => {
      if (disposed) return;
      setSession(currentSession);
      setAuthLoading(false);
      if (currentSession) void synchronizeAuthenticatedAccount(currentSession);
    }).catch((authError) => {
      if (!disposed) {
        setAccountError(authError instanceof Error ? authError.message : "로그인 상태를 확인하지 못했어요.");
        setAuthLoading(false);
      }
    });
    const stop = observeWebSession((_event, currentSession) => {
      if (disposed) return;
      setSession(currentSession);
      setAuthLoading(false);
      if (currentSession) {
        setShowAuthDialog(false);
        void synchronizeAuthenticatedAccount(currentSession);
      }
      else {
        setFavoriteTargets({});
        setUserAlerts([]);
        setFamilyMembers([]);
      }
    });
    return () => { disposed = true; stop(); };
  }, [synchronizeAuthenticatedAccount]);

  useEffect(() => {
    if (!WEB_ACCOUNT_FEATURES_VISIBLE) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const timers: number[] = [];
    const maximumDelay = 2_147_000_000;
    for (const alert of userAlerts) {
      if (!alert.scheduled_at) continue;
      const delay = new Date(alert.scheduled_at).getTime() - Date.now();
      if (delay <= 0 || delay > maximumDelay) continue;
      const program = programs.find((item) => item.id === alert.program_id);
      timers.push(window.setTimeout(() => {
        new Notification("동네고고 오픈런 알림", {
          body: program ? `${program.name} · ${program.facility}` : "저장한 프로그램 일정을 확인해 주세요.",
          icon: "/brand/app-icon.png",
          tag: `dongnegogo-${alert.program_id}`,
        });
      }, delay));
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [programs, userAlerts]);

  const persistList = useCallback((key: string, value: string[]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, []);

  const setFavoriteForTargets = useCallback((id: string, targets: string[]) => {
    const normalized = [...new Set(targets)].slice(0, 8);
    setFavoriteTargets((previous) => {
      const next = { ...previous };
      if (normalized.length) next[id] = normalized;
      else delete next[id];
      return next;
    });
    setFavorites((previous) => {
      const next = normalized.length
        ? previous.includes(id) ? previous : [...previous, id]
        : previous.filter((item) => item !== id);
      if (!session) persistList("dongnegogo.web.favorites", next);
      return next;
    });
    if (session) {
      void upsertWebFavorite(session, id, normalized).catch((syncError) => {
        setAccountError(syncError instanceof Error ? syncError.message : "찜을 동기화하지 못했어요.");
      });
    }
  }, [persistList, session]);

  const toggleFavorite = useCallback((id: string) => {
    const currentTargets = favoriteTargets[id] ?? (favorites.includes(id) ? ["personal"] : []);
    setFavoriteForTargets(id, currentTargets.length ? [] : ["personal"]);
  }, [favoriteTargets, favorites, setFavoriteForTargets]);

  const toggleFavoriteTarget = useCallback((id: string, target: string) => {
    const currentTargets = favoriteTargets[id] ?? (favorites.includes(id) ? ["personal"] : []);
    const next = currentTargets.includes(target)
      ? currentTargets.filter((item) => item !== target)
      : [...currentTargets, target];
    setFavoriteForTargets(id, next);
  }, [favoriteTargets, favorites, setFavoriteForTargets]);

  const toggleReminder = useCallback((id: string) => {
    const program = selected?.id === id ? selected : programs.find((item) => item.id === id);
    if (!program) return;
    const alert = userAlerts.find((item) => item.program_id === id);
    const suggested = alert?.scheduled_at
      ? new Date(alert.scheduled_at)
      : program.receiptStart ? new Date(program.receiptStart) : new Date(Date.now() + 86_400_000);
    if (!alert?.scheduled_at) suggested.setHours(9, 0, 0, 0);
    const localValue = Number.isFinite(suggested.getTime())
      ? new Date(suggested.getTime() - suggested.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
      : "";
    setAlertDialog({ program, scheduledAt: localValue });
  }, [programs, selected, userAlerts]);

  const recordHistory = useCallback((program: WebProgram) => {
    const viewedAt = new Date().toISOString();
    if (session) {
      void recordWebProgramHistory(session, program.id, viewedAt).catch((syncError) => {
        setAccountError(syncError instanceof Error ? syncError.message : "보관함을 동기화하지 못했어요.");
      });
    }
    setViewHistory((previous) => {
      const now = new Date(viewedAt);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const oldest = today.getTime() - 3 * 86_400_000;
      const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
      const next = [{ program, viewedAt }, ...previous.filter((item) => {
        if (new Date(item.viewedAt).getTime() < oldest) return false;
        const itemKey = new Date(item.viewedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        return item.program.id !== program.id || itemKey !== todayKey;
      })].slice(0, 1_600);
      localStorage.setItem("dongnegogo.web.viewHistory", JSON.stringify(next));
      return next;
    });
  }, [session]);

  const resolveCenteredArea = useCallback((coordinate: Coordinate) => {
    const services = window.kakao?.maps.services;
    if (!services) return;
    const geocoder = new services.Geocoder();
    geocoder.coord2RegionCode(coordinate.longitude, coordinate.latitude, (result, status) => {
      if (status !== services.Status.OK || !result.length) return;
      const region = result.find((item) => item.region_type === "H") ?? result[0];
      setCenteredArea(region.address_name || [region.region_2depth_name, region.region_3depth_name].filter(Boolean).join(" "));
    });
  }, []);

  const loadBounds = useCallback(async (map: KakaoMap) => {
    if (!map) return;
    if (searchActiveRef.current) return;
    if (programRadiusFilterRef.current.radiusKm !== null && !programRadiusFilterRef.current.usesFallbackLocation) return;
    if (filterCatalogPendingRef.current && programFilterActiveRef.current) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
      const mapCenter = map.getCenter();
      const nextCenter = { latitude: mapCenter.getLat(), longitude: mapCenter.getLng() };
      setCenter(nextCenter);
      setMapLevel(map.getLevel());
      resolveCenteredArea(nextCenter);
    const radiusKm = distanceMeters(nextCenter, { latitude: ne.getLat(), longitude: ne.getLng() }) / 1_000;
    const requestedScope = webMapScopeForRadius(radiusKm, mapScopeRef.current);
    const hasActiveProgramFilter = programFilterActiveRef.current;
    const filterRequestKey = hasActiveProgramFilter
      ? [mapFilterSignatureRef.current, requestedScope, sw.getLat(), sw.getLng(), ne.getLat(), ne.getLng()]
        .map((value) => typeof value === "number" ? value.toFixed(5) : value).join(":")
      : null;
    if (filterRequestKey && mapFilterRequestKeyRef.current === filterRequestKey) return;
    mapFilterRequestKeyRef.current = filterRequestKey;
    const params = new URLSearchParams({
      south: String(sw.getLat()), west: String(sw.getLng()),
      north: String(ne.getLat()), east: String(ne.getLng()),
      previousMode: mapModeRef.current,
      scope: requestedScope === "individual" ? "localArea" : requestedScope,
      forceCluster: String(requestedScope !== "individual" && !hasActiveProgramFilter),
    });
    const requestID = ++mapRequestIDRef.current;
    mapBoundsAbortRef.current?.abort();
    const requestController = new AbortController();
    mapBoundsAbortRef.current = requestController;
    setLoading(true);
    try {
      if (heatShelterModeRef.current) {
        const heatParams = new URLSearchParams({
          south: String(sw.getLat()), west: String(sw.getLng()), north: String(ne.getLat()), east: String(ne.getLng()),
          centerLatitude: String(nextCenter.latitude), centerLongitude: String(nextCenter.longitude),
        });
        const heatResponse = await fetch(`/api/web-heat-shelters?${heatParams}`, { cache: "no-store" });
        const heatPayload = await heatResponse.json() as { shelters?: WebHeatShelter[]; message?: string };
        if (!heatResponse.ok) throw new Error(heatPayload.message ?? "무더위쉼터를 불러오지 못했습니다.");
        if (mapRequestIDRef.current !== requestID) return;
        setHeatShelters(heatPayload.shelters ?? []);
        setPrograms([]);
        setMapClusters([]);
        setMapMode("individual");
        setMapScope("individual");
        mapScopeRef.current = "individual";
        setError("");
        return;
      }
      if (hasActiveProgramFilter) {
        // 필터·행정구역 집계를 DB에서 먼저 끝내고, 확대 화면에서만 실제
        // 프로그램 행을 전송한다. 넓은 화면에서 최대 5천 행을 내려받아
        // 브라우저에서 다시 묶던 지연을 제거한다.
        setProgramCounts({});
        const exactBounds = { south: sw.getLat(), west: sw.getLng(), north: ne.getLat(), east: ne.getLng() };
        const completeCatalog = requestedScope === "individual" ? completeFilterCatalogRef.current : null;
        const cached = filterViewportCacheRef.current;
        const cachedCluster = requestedScope === "individual" ? null : filterClusterViewportCacheRef.current.find((entry) => (
          entry.signature === mapFilterSignatureRef.current
          && entry.scope === requestedScope
          && Date.now() - entry.storedAt < 120_000
          && mapFilterBoundsContain(entry, exactBounds)
        ));
        let payload: MapFilterResponse;
        if (completeCatalog?.signature === mapFilterSignatureRef.current) {
          const nextPrograms = programsInsideMapFilterBounds(completeCatalog.programs, exactBounds);
          payload = { mode: "individual", scope: "individual", programs: nextPrograms, clusters: [], matchCount: nextPrograms.length, isComplete: true, revision: "complete-filter-catalog", south: exactBounds.south, west: exactBounds.west, north: exactBounds.north, east: exactBounds.east };
        } else if (requestedScope === "individual"
            && cached?.signature === mapFilterSignatureRef.current
            && cached.scope === "individual"
            && Date.now() - cached.storedAt < 120_000
            && mapFilterBoundsContain(cached, exactBounds)) {
          payload = { mode: "individual", scope: "individual", programs: programsInsideMapFilterBounds(cached.programs, exactBounds), clusters: [], matchCount: cached.programs.length, isComplete: true, revision: "filter-viewport-cache", south: exactBounds.south, west: exactBounds.west, north: exactBounds.north, east: exactBounds.east };
        } else if (cachedCluster) {
          const nextClusters = clustersInsideMapFilterBounds(cachedCluster.clusters, exactBounds);
          payload = { mode: "cluster", scope: requestedScope, programs: [], clusters: nextClusters, matchCount: nextClusters.reduce((sum, cluster) => sum + cluster.programCount, 0), isComplete: true, revision: "filter-cluster-viewport-cache", south: exactBounds.south, west: exactBounds.west, north: exactBounds.north, east: exactBounds.east };
        } else {
          const queryBounds = paddedMapFilterBounds(exactBounds, requestedScope === "individual" ? .5 : .35);
          payload = await fetchMapFilterCatalog({
            ...mapFilterRequestRef.current,
            ...queryBounds,
            clusterScope: requestedScope,
          }, requestController.signal);
          if (mapRequestIDRef.current !== requestID) return;
          if (payload.mode === "individual") {
            filterViewportCacheRef.current = {
              signature: mapFilterSignatureRef.current,
              ...queryBounds,
              programs: payload.programs,
              clusters: [],
              scope: "individual",
              storedAt: Date.now(),
            };
            payload = { ...payload, programs: programsInsideMapFilterBounds(payload.programs, exactBounds) };
          } else {
            const nextCache: MapFilterViewportCache = {
              signature: mapFilterSignatureRef.current,
              ...queryBounds,
              programs: [],
              clusters: payload.clusters,
              scope: payload.scope,
              storedAt: Date.now(),
            };
            filterClusterViewportCacheRef.current = [
              nextCache,
              ...filterClusterViewportCacheRef.current.filter((entry) => !(
                entry.signature === nextCache.signature
                && entry.scope === nextCache.scope
                && mapFilterBoundsContain(entry, queryBounds)
              )),
            ].slice(0, 8);
            payload = { ...payload, clusters: clustersInsideMapFilterBounds(payload.clusters, exactBounds) };
          }
        }
        const carouselAnchor = filteredClusterCarouselAnchorRef.current;
        if (payload.mode === "individual" && carouselAnchor
          && filteredClusterCarouselSignatureRef.current === mapFilterSignatureRef.current
          && filteredClusterCarouselProgramsRef.current.length === 0) {
          const carouselPrograms = [...new Map(payload.programs.map((program) => [program.id, program])).values()]
            .sort((left, right) => distanceMeters(carouselAnchor, left) - distanceMeters(carouselAnchor, right))
            .slice(0, 120);
          const first = carouselPrograms[0];
          if (first) {
            filteredClusterCarouselProgramsRef.current = carouselPrograms;
            setFilteredClusterCarouselPrograms(carouselPrograms);
            setFilteredClusterFocusedProgramID(first.id);
          }
        }
        setPrograms(payload.mode === "individual" ? payload.programs : []);
        if (payload.mode === "individual") {
          setMapClusters([]);
          setMapMode("individual");
          mapModeRef.current = "individual";
          setMapScope("individual");
          mapScopeRef.current = "individual";
        } else {
          if (mapRequestIDRef.current !== requestID) return;
          setMapClusters(payload.clusters);
          setMapMode("cluster");
          mapModeRef.current = "cluster";
          setMapScope(payload.scope);
          mapScopeRef.current = payload.scope;
        }
        setError("");
        return;
      }
      const response = await fetch(`/api/web-map?${params}`, { cache: "no-store", signal: requestController.signal });
      const payload = await response.json() as WebMapViewportResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "지도 프로그램을 불러오지 못했습니다.");
      if (mapRequestIDRef.current !== requestID) return;
      if (payload.mode === "cluster") payload.clusters = await resolveMapClusterAreas(payload.clusters);
      if (mapRequestIDRef.current !== requestID) return;
      let nextPrograms = payload.programs;
      if (payload.mode === "cluster") {
        setMapClusters(hasActiveProgramFilter ? [] : payload.clusters);
        setProgramCounts(payload.programCounts ?? {});
        setMapMode(hasActiveProgramFilter ? "individual" : "cluster");
        mapModeRef.current = hasActiveProgramFilter ? "individual" : "cluster";
        setMapScope(hasActiveProgramFilter ? "individual" : payload.scope);
        mapScopeRef.current = hasActiveProgramFilter ? "individual" : payload.scope;
        const listParams = new URLSearchParams({
          south: String(sw.getLat()), west: String(sw.getLng()), north: String(ne.getLat()), east: String(ne.getLng()), limit: "4000",
        });
        nextPrograms = await fetchPrograms(listParams);
      } else if (!nextPrograms.length) {
        // A very tight mobile viewport can contain no point even though nearby
        // programs exist. Keep the map/list useful with a bounded nearby fallback.
        const latitudeSpan = Math.max(ne.getLat() - sw.getLat(), 0.045);
        const longitudeSpan = Math.max(ne.getLng() - sw.getLng(), 0.055);
        const nearbyParams = new URLSearchParams({
          south: String(nextCenter.latitude - latitudeSpan),
          west: String(nextCenter.longitude - longitudeSpan),
          north: String(nextCenter.latitude + latitudeSpan),
          east: String(nextCenter.longitude + longitudeSpan),
          limit: "320",
        });
        nextPrograms = await fetchPrograms(nearbyParams);
      }
      if (mapRequestIDRef.current !== requestID) return;
      setPrograms(nextPrograms);
      setMapClusters(hasActiveProgramFilter ? [] : payload.clusters);
      setProgramCounts(payload.programCounts ?? {});
      setMapMode(hasActiveProgramFilter ? "individual" : payload.mode);
      mapModeRef.current = hasActiveProgramFilter ? "individual" : payload.mode;
      setMapScope(hasActiveProgramFilter ? "individual" : payload.scope);
      mapScopeRef.current = hasActiveProgramFilter ? "individual" : payload.scope;
      setError("");
    } catch (fetchError) {
      if (!requestController.signal.aborted && mapRequestIDRef.current === requestID) setError((fetchError as Error).message);
    } finally {
      if (mapFilterRequestKeyRef.current === filterRequestKey) mapFilterRequestKeyRef.current = null;
      if (mapRequestIDRef.current === requestID) setLoading(false);
    }
  }, [resolveCenteredArea]);

  const openFilteredMapCluster = useCallback((cluster: WebMapCluster, map: KakaoMap) => {
    const maps = window.kakao?.maps;
    if (!maps) return;
    const carouselAnchor = { latitude: cluster.latitude, longitude: cluster.longitude };
    const filterSignature = mapFilterSignatureRef.current;
    const representativeID = cluster.programIds[0];

    map.panTo(new maps.LatLng(cluster.latitude, cluster.longitude));
    setMapProgramCarouselSource(cluster.programCount > 1 ? "nearby" : "condition");
    filteredClusterCarouselAnchorRef.current = carouselAnchor;
    filteredClusterCarouselSignatureRef.current = filterSignature;
    filteredClusterCarouselProgramsRef.current = [];
    setFilteredClusterCarouselSignature(filterSignature);
    setFilteredClusterCarouselPrograms([]);
    setFilteredClusterFocusedProgramID(null);
    map.setLevel(4);

    if (!representativeID) return;
    const params = new URLSearchParams({ id: representativeID });
    void fetchPrograms(params).then((matches) => {
      const representative = matches[0];
      if (!representative
        || mapFilterSignatureRef.current !== filterSignature
        || filteredClusterCarouselAnchorRef.current !== carouselAnchor
        || filteredClusterCarouselProgramsRef.current.length > 0) return;

      // 전체 조건 viewport가 도착하기 전에도 DB 군집이 지정한 대표 프로그램을
      // 먼저 그려 군집 선택에 즉시 반응한다. ref는 비워 두어 뒤이어 도착한
      // viewport 결과가 주변 카드 전체를 원자적으로 채우도록 한다.
      setPrograms([representative]);
      setMapClusters([]);
      setMapMode("individual");
      mapModeRef.current = "individual";
      setMapScope("individual");
      mapScopeRef.current = "individual";
      setFilteredClusterCarouselPrograms([representative]);
      setFilteredClusterFocusedProgramID(representative.id);
    }).catch(() => {
      // 개별 대표 조회가 실패해도 idle에서 실행되는 조건 viewport 조회가
      // 동일한 이동·카드 흐름을 완성하므로 사용자에게 중복 오류를 노출하지 않는다.
    });
  }, []);

  useEffect(() => {
    if (radiusKm === null || usesFallbackLocation) return;
    const controller = new AbortController();
    const latitudeDelta = Math.max(radiusKm / 111, .001);
    const longitudeDelta = Math.max(radiusKm / (111 * Math.max(.25, Math.cos(location.latitude * Math.PI / 180))), .001);
    const boundsRequest = {
      south: location.latitude - latitudeDelta,
      west: location.longitude - longitudeDelta,
      north: location.latitude + latitudeDelta,
      east: location.longitude + longitudeDelta,
    };
    const params = new URLSearchParams({
      south: String(boundsRequest.south),
      west: String(boundsRequest.west),
      north: String(boundsRequest.north),
      east: String(boundsRequest.east),
      limit: "4000",
    });
    const requestID = ++mapRequestIDRef.current;
    // The location-radius effect owns this asynchronous request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const request = programFilterActiveRef.current
      ? fetchMapFilterCatalog({ ...mapFilterRequestRef.current, ...boundsRequest, clusterScope: "individual" }, controller.signal)
          .then((payload) => payload.programs)
      : fetchPrograms(params, controller.signal);
    request.then((nextPrograms) => {
      if (controller.signal.aborted || mapRequestIDRef.current !== requestID) return;
      setPrograms(nextPrograms);
      setMapClusters([]);
      setProgramCounts({});
      setMapMode("individual");
      mapModeRef.current = "individual";
      setMapScope("individual");
      mapScopeRef.current = "individual";
      setError("");

      const map = mapRef.current;
      const maps = window.kakao?.maps;
      if (map && maps) {
        const bounds = new maps.LatLngBounds();
        bounds.extend(new maps.LatLng(location.latitude - latitudeDelta, location.longitude - longitudeDelta));
        bounds.extend(new maps.LatLng(location.latitude + latitudeDelta, location.longitude + longitudeDelta));
        map.setBounds(bounds, 48, 48, 90, 48);
      }
    }).catch((fetchError) => {
      if (!controller.signal.aborted && mapRequestIDRef.current === requestID) setError((fetchError as Error).message);
    }).finally(() => {
      if (!controller.signal.aborted && mapRequestIDRef.current === requestID) setLoading(false);
    });
    return () => controller.abort();
  }, [location.latitude, location.longitude, radiusKm, usesFallbackLocation]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current || !kakaoMapKey) return;
    let disposed = false;
    const start = () => window.kakao?.maps.load(() => {
      if (disposed || !mapElementRef.current || mapRef.current) return;
      const maps = window.kakao?.maps;
      if (!maps) return;
      const map = new maps.Map(mapElementRef.current, {
        center: new maps.LatLng(FALLBACK.latitude, FALLBACK.longitude), level: 5,
      });
      mapRef.current = map;
      setMapReady(true);
      maps.event.addListener(map, "dragstart", () => {
        // 최초 조건 결과 자동 맞춤은 한 번만 수행한다. 사용자가 다른 지역으로
        // 지도를 옮기면 이후 응답은 새 viewport의 조건 마커로 교체한다.
        setFilterFitAppliedSignature(null);
        if (programFilterActiveRef.current) {
          // 이동 중에는 직전 완성 장면을 지도에 붙여 둔다. Kakao overlay는
          // 타일과 함께 자연스럽게 이동하고 idle의 새 서버 응답이 한 번에
          // 교체하므로 빈 지도 깜박임과 개별·군집 혼합을 모두 피한다.
          mapRequestIDRef.current += 1;
          mapFilterRequestKeyRef.current = null;
          mapBoundsAbortRef.current?.abort();
        }
      });
      maps.event.addListener(map, "idle", () => {
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = window.setTimeout(
          () => loadBounds(map),
          programFilterActiveRef.current ? 0 : 420,
        );
      });
      loadBounds(map);
    });
    if (window.kakao?.maps) start();
    else {
      const prior = document.querySelector<HTMLScriptElement>('script[data-dongnegogo-kakao="true"]');
      if (prior) prior.addEventListener("load", start, { once: true });
      else {
        const script = document.createElement("script");
        script.dataset.dongnegogoKakao = "true";
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoMapKey)}&autoload=false&libraries=services`;
        script.async = true;
        script.addEventListener("load", start, { once: true });
        script.addEventListener("error", () => { setError("Kakao 지도를 불러오지 못했습니다."); setLoading(false); }, { once: true });
        document.head.appendChild(script);
      }
    }
    return () => { disposed = true; mapBoundsAbortRef.current?.abort(); };
  }, [kakaoMapKey, loadBounds]);

  useEffect(() => {
    if (filterFitRequestId === 0 || !programFilterActiveRef.current || !mapRef.current) {
      filterCatalogPendingRef.current = false;
      setFilterCatalogReadyRequestId(0);
      if (filterFitRequestId > 0 && mapRef.current) void loadBounds(mapRef.current);
      return;
    }
    // 조건 적용 시 전국 결과를 먼저 내려받아 전체 범위로 축소하지 않는다.
    // 선택 상태를 먼저 그리고 현재 위치(미허용 시 현재 지도)의 viewport만 조회한다.
    completeFilterCatalogRef.current = null;
    filterCatalogPendingRef.current = false;
    setFilterCatalogReadyRequestId(0);
    const frame = window.requestAnimationFrame(() => {
      setFilterCatalogReadyRequestId(filterFitRequestId);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [filterFitRequestId, loadBounds]);

  const toggleHeatShelterMode = () => {
    const next = !heatShelterMode;
    heatShelterModeRef.current = next;
    setHeatShelterMode(next);
    setSelected(null);
    setRoutePanelActive(false);
    setSelectedHeatShelter(null);
    setPlaceSheet(null);
    if (!next) setHeatShelters([]);
    if (mapRef.current) window.setTimeout(() => mapRef.current && void loadBounds(mapRef.current), 0);
  };

  const visiblePrograms = useMemo(() => {
    if (tab === "search" && searchIntent) {
      const categorized = searchResultCategory
        ? searchResults.filter((program) => searchResultCategoryIDs(program).includes(searchResultCategory))
        : searchResults;
      if (searchSort === "relevance") return categorized;
      const searchOrigin = (searchAssistant.kind === "placeFound" || searchAssistant.kind === "placeOffer" || searchAssistant.kind === "placeSearching")
        && searchAssistant.place.latitude !== null && searchAssistant.place.longitude !== null
        ? { latitude: searchAssistant.place.latitude, longitude: searchAssistant.place.longitude }
        : location;
      return [...categorized].sort((a, b) => {
        if (searchSort === "free" && a.isFree !== b.isFree) return a.isFree ? -1 : 1;
        if (searchSort === "available" && isAvailable(a) !== isAvailable(b)) return isAvailable(a) ? -1 : 1;
        return distanceMeters(searchOrigin, a) - distanceMeters(searchOrigin, b);
      });
    }
    // `programs` is already replaced with the current viewport's filtered rows.
    // Merging a previously saved unfiltered viewport here could keep markers from
    // the old region (most visibly Seoul) after the user moved the map.
    const items = programs.filter((program) => {
      if (!fieldMatches(program, fieldFilter)) return false;
      if (freeOnly && !program.isFree) return false;
      if (paidOnly && program.isFree) return false;
      if (seniorOnly && !program.isSeniorRecommended && !program.audiences.some((audience) => /시니어|어르신|노인|65세/.test(audience))) return false;
      if (!webProgramMatchesFilters(program, subjectFilters, personaFilters)) return false;
      if (statusFilter !== "전체" && (statusFilter === "접수중" ? !/접수중|상시|진행중|가능|안내중/.test(program.status) : statusFilter === "접수예정" ? !/예정|곧/.test(program.status) : !/마감임박/.test(program.status))) return false;
      if (todayOnly && !/접수중|상시|진행중|가능|안내중|마감임박/.test(program.status)) return false;
      if (radiusKm !== null && !usesFallbackLocation && distanceMeters(location, program) > radiusKm * 1_000) return false;
      if (tab === "saved" && !favorites.includes(program.id)) return false;
      if (tab === "openrun" && (!program.receiptStart || !isAvailable(program))) return false;
      return true;
    });
    return items.sort((a, b) => {
      if (sort === "free" && a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      if (sort === "available" && isAvailable(a) !== isAvailable(b)) return isAvailable(a) ? -1 : 1;
      return distanceMeters(center, a) - distanceMeters(center, b);
    });
  }, [activeConditionCount, programs, searchResults, searchIntent, searchResultCategory, searchSort, searchAssistant, fieldFilter, freeOnly, paidOnly, seniorOnly, personaFilters, subjectFilters, statusFilter, todayOnly, radiusKm, location, usesFallbackLocation, tab, favorites, sort, center]);

  useEffect(() => {
    if (filterFitRequestId === 0 || activeConditionCount === 0
      || filterCatalogReadyRequestId !== filterFitRequestId
      || filterFitAppliedSignature !== currentFilterSelectionSignature
      || tab !== "map" || heatShelterMode || routePanelActive) return;
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) return;
    setFilterCatalogReadyRequestId(0);
    if (!usesFallbackLocation) {
      map.setCenter(new maps.LatLng(location.latitude, location.longitude));
      map.setLevel(4);
    }
    window.setTimeout(() => void loadBounds(map), 0);
  }, [activeConditionCount, currentFilterSelectionSignature, filterCatalogReadyRequestId, filterFitAppliedSignature, filterFitRequestId, heatShelterMode, loadBounds, location.latitude, location.longitude, routePanelActive, tab, usesFallbackLocation]);

  const searchCategoryCounts = useMemo(() => searchResultCategories(searchResults), [searchResults]);

  const visibleClusters = useMemo(() => {
    const limit = WEB_MAP_CLUSTER_DISPLAY_LIMIT[mapClusters[0]?.scope ?? "localArea"];
    if (mapClusters.length <= limit) return mapClusters;
    const nearCount = Math.ceil(limit / 2);
    const nearest = [...mapClusters].sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b)).slice(0, nearCount);
    const popular = [...mapClusters].sort((a, b) => b.programCount - a.programCount || a.id.localeCompare(b.id));
    const result = [...nearest];
    for (const cluster of popular) if (!result.some((item) => item.id === cluster.id) && result.length < limit) result.push(cluster);
    return result;
  }, [mapClusters, center]);

  const selectProgram = useCallback(async (program: WebProgram) => {
    setSelected(program);
    setRoutePanelActive(false);
    setRoutePanelMode("route");
    setRoutePanelSnap("collapsed");
    setRoutePanelDragHeight(null);
    setRouteSheetCollapsed(false);
    setRouteSheetDragOffset(null);
    setActiveRoute(null);
    setSelectedNearbyPlace(null);
    setNearbyWalkingRoute(null);
    setPlaceSheet(null);
    setAuxiliaryPanel(null);
    recordHistory(program);
    if (mapRef.current && window.kakao?.maps) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(program.latitude, program.longitude));
    }
    try {
      const hydrated = await fetchPrograms(new URLSearchParams({ id: program.id }));
      if (hydrated[0]) setSelected((currentProgram) => currentProgram?.id === program.id ? hydrated[0] : currentProgram);
    } catch {
      // The compact map row is still sufficient when optional detail hydration fails.
    }
  }, [recordHistory]);

  useEffect(() => {
    const programID = new URLSearchParams(window.location.search).get("program")?.trim();
    if (!programID) return;
    sharedProgramIDRef.current = programID;
    const controller = new AbortController();
    void fetchPrograms(new URLSearchParams({ id: programID }), controller.signal)
      .then((matches) => {
        const program = matches.find((candidate) => candidate.id === programID) ?? matches[0];
        if (!program) {
          setError("공유한 프로그램을 찾을 수 없어요.");
          return;
        }
        // 지도 경계 데이터가 도착하기 전에도 대상 마커와 상세 패널을 즉시 연다.
        setPrograms((previous) => previous.some((candidate) => candidate.id === program.id)
          ? previous
          : [...previous, program]);
        void selectProgram(program);
      })
      .catch((fetchError) => {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : "공유한 프로그램을 불러오지 못했어요.");
        }
      });
    return () => controller.abort();
  }, [selectProgram]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!mapReady || !map || !maps || !selected || selected.id !== sharedProgramIDRef.current) return;
    if (sharedProgramCenteredRef.current === selected.id) return;
    sharedProgramCenteredRef.current = selected.id;
    const coordinate = new maps.LatLng(selected.latitude, selected.longitude);
    map.setCenter(coordinate);
    if (map.getLevel() > 4) map.setLevel(4);
    setCenter({ latitude: selected.latitude, longitude: selected.longitude });
    void loadBounds(map);
  }, [loadBounds, mapReady, selected]);

  const openProgramSheet = useCallback(async (group: WebProgram[], expectedCount: number) => {
    const initial = [...group].sort((a, b) => statusRank(a) - statusRank(b) || a.id.localeCompare(b.id));
    setSelected(null);
    setRoutePanelActive(false);
    setSelectedHeatShelter(null);
    setAuxiliaryPanel(null);
    setPlaceSheet({ programs: initial, index: 0, expectedCount: Math.max(initial.length, expectedCount), loading: initial.length < expectedCount });
    const representative = initial[0];
    if (!representative || initial.length >= expectedCount) return;
    try {
      const epsilon = 0.00006;
      const params = new URLSearchParams({
        south: String(representative.latitude - epsilon), west: String(representative.longitude - epsilon),
        north: String(representative.latitude + epsilon), east: String(representative.longitude + epsilon), limit: "300",
      });
      const hydrated = (await fetchPrograms(params)).filter((program) => markerPlaceKey(program) === markerPlaceKey(representative));
      const byId = new Map([...initial, ...hydrated].map((program) => [program.id, program]));
      const programsAtPlace = [...byId.values()].sort((a, b) => statusRank(a) - statusRank(b) || a.id.localeCompare(b.id));
      setPlaceSheet((current) => current && markerPlaceKey(current.programs[0]) === markerPlaceKey(representative)
        ? { ...current, programs: programsAtPlace, expectedCount: Math.max(expectedCount, programsAtPlace.length), loading: false }
        : current);
    } catch {
      setPlaceSheet((current) => current ? { ...current, loading: false } : current);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    if (heatShelterMode) {
      heatShelters.slice(0, 1_200).forEach((shelter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `dg-map-marker dg-heat-marker${selectedHeatShelter?.id === shelter.id ? " is-selected" : ""}`;
        button.setAttribute("aria-label", `무더위쉼터 ${shelter.name}`);
        const image = document.createElement("img");
        image.src = "/markers/icon_heat_shelter.png";
        image.alt = "";
        const label = document.createElement("small");
        label.textContent = shelter.name.length > 16 ? `${shelter.name.slice(0, 16)}…` : shelter.name;
        button.append(image, label);
        button.addEventListener("click", () => { setSelectedHeatShelter(shelter); setPlaceSheet(null); setSelected(null); });
        overlaysRef.current.push(new window.kakao!.maps.CustomOverlay({
          map, position: new window.kakao!.maps.LatLng(shelter.latitude, shelter.longitude), content: button, yAnchor: 1.15, zIndex: selectedHeatShelter?.id === shelter.id ? 10 : 2,
        }));
      });
      return () => { overlaysRef.current.forEach((overlay) => overlay.setMap(null)); overlaysRef.current = []; };
    }
    if ((selected && routePanelActive) || (auxiliaryPanel === "nearby" && nearbyDestination && nearbySummary)) {
      return () => { overlaysRef.current.forEach((overlay) => overlay.setMap(null)); overlaysRef.current = []; };
    }
    const focusedCarouselProgram = filteredClusterFocusedProgramID
      ? filteredClusterCarouselPrograms.find((program) => program.id === filteredClusterFocusedProgramID)
      : null;
    if (focusedCarouselProgram && tab === "map") {
      // 카드 선택은 직전 viewport의 군집 장면보다 우선한다. 선택 프로그램 한 건을
      // 즉시 개별 마커로 고정하고 패널이 닫히면 기존 adaptive 장면으로 복귀한다.
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dg-map-marker is-selected";
      button.setAttribute("aria-label", `${focusedCarouselProgram.name} 선택됨`);
      const image = document.createElement("img");
      image.src = `/markers/${programIconName(focusedCarouselProgram)}.png`;
      image.alt = "";
      button.appendChild(image);
      button.addEventListener("click", () => {
        void openProgramSheet([focusedCarouselProgram], programCounts[focusedCarouselProgram.id] ?? 1);
      });
      overlaysRef.current.push(new window.kakao!.maps.CustomOverlay({
        map,
        position: new window.kakao!.maps.LatLng(focusedCarouselProgram.latitude, focusedCarouselProgram.longitude),
        content: button,
        yAnchor: 1.15,
        zIndex: 12,
      }));
      return () => { overlaysRef.current.forEach((overlay) => overlay.setMap(null)); overlaysRef.current = []; };
    }
    if (mapMode === "cluster" && tab === "map") {
      const clusterKeyword = activeConditionCount > 0 ? mapFilterClusterKeyword(mapFilterRequestRef.current) : "";
      visibleClusters.forEach((cluster) => {
        const insightText = activeConditionCount > 0 ? null : visibleClusterInsightLabel(cluster.categoryName);
        const compactAdministrativeRow = activeConditionCount === 0
          && ["localArea", "neighborhood", "district"].includes(cluster.scope)
          && !insightText;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `dg-cluster-marker dg-cluster-${cluster.scope}${activeConditionCount > 0 ? " is-filtered" : ""}${compactAdministrativeRow ? " is-compact-admin" : ""}`;
        button.setAttribute("aria-label", `${cluster.areaName} ${cluster.programCount}개 프로그램`);
        const area = document.createElement("strong");
        area.textContent = clusterDisplayAreaName(cluster.areaName);
        const count = document.createElement("span");
        count.textContent = activeConditionCount > 0
          ? `${clusterKeyword} ${filteredClusterCountLabel(cluster.programCount)}`
          : cluster.scope === "localArea" ? String(cluster.programCount) : `활동 ${cluster.programCount}`;
        if (activeConditionCount > 0) {
          button.append(area, count);
        } else {
          button.append(area, count);
          if (insightText && cluster.scope === "localArea") {
            const insight = document.createElement("small");
            insight.textContent = insightText;
            button.append(insight);
          }
        }
        button.addEventListener("click", () => {
          if (activeConditionCount > 0) {
            openFilteredMapCluster(cluster, map);
          } else {
            const coordinate = new window.kakao!.maps.LatLng(cluster.latitude, cluster.longitude);
            map.panTo(coordinate);
            map.setLevel(Math.max(1, map.getLevel() - 2));
          }
        });
        overlaysRef.current.push(new window.kakao!.maps.CustomOverlay({
          map, position: new window.kakao!.maps.LatLng(cluster.latitude, cluster.longitude), content: button, yAnchor: 0.5, zIndex: 3,
        }));
      });
      return () => { overlaysRef.current.forEach((overlay) => overlay.setMap(null)); overlaysRef.current = []; };
    }
    const grouped = new Map<string, WebProgram[]>();
    visiblePrograms.forEach((program) => grouped.set(markerPlaceKey(program), [...(grouped.get(markerPlaceKey(program)) ?? []), program]));
    Array.from(grouped.values()).slice(0, 1_200).forEach((group) => {
      const representative = dominantProgram(group, statusRank);
      const count = Math.max(group.length, programCounts[representative.id] ?? 1);
      const isFocused = selected?.id === representative.id
        || group.some((program) => program.id === filteredClusterFocusedProgramID);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dg-map-marker${isFocused ? " is-selected" : ""}`;
      button.setAttribute("aria-label", count > 1 ? `같은 장소 ${count}개 프로그램` : representative.name);
      const image = document.createElement("img");
      image.src = `/markers/${programIconName(representative)}.png`;
      image.alt = "";
      button.appendChild(image);
      if (count > 1) {
        const badge = document.createElement("span");
        badge.textContent = count > 9 ? "9+" : String(count);
        button.appendChild(badge);
      }
      const label = document.createElement("small");
      label.textContent = representative.name.length > 16 ? `${representative.name.slice(0, 16)}…` : representative.name;
      button.appendChild(label);
      button.addEventListener("click", () => { void openProgramSheet(group, count); });
      const overlay = new maps.CustomOverlay({
        map, position: new maps.LatLng(representative.latitude, representative.longitude),
        content: button, yAnchor: 1.15, zIndex: isFocused ? 10 : 2,
      });
      overlaysRef.current.push(overlay);
    });
    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, [visiblePrograms, visibleClusters, selected, selectedHeatShelter, heatShelterMode, heatShelters, mapLevel, mapMode, programCounts, tab, fieldFilter, freeOnly, paidOnly, seniorOnly, personaFilters, subjectFilters, statusFilter, todayOnly, radiusKm, openProgramSheet, routePanelActive, auxiliaryPanel, nearbyDestination, nearbySummary, activeConditionCount, filteredClusterFocusedProgramID, filteredClusterCarouselPrograms, loadBounds, openFilteredMapCluster]);

  const selectNearbyPlace = useCallback(async (place: WebNearbyPlace) => {
    if (!nearbyDestination) return;
    setSelectedNearbyPlace(place);
    setNearbyWalkingRoute(null);
    document.getElementById(`nearby-place-${place.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const response = await fetch("/api/web-route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "WALKING",
          origin: { latitude: nearbyDestination.latitude, longitude: nearbyDestination.longitude },
          destination: { latitude: place.latitude, longitude: place.longitude },
          destinationName: place.name,
        }),
      });
      const payload = await response.json() as WebRouteResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "도보 경로를 불러오지 못했어요.");
      setNearbyWalkingRoute(payload);
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "도보 경로를 불러오지 못했어요.");
    }
  }, [nearbyDestination]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    routeOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    routeOverlaysRef.current = [];
    mapItemsRef.current.forEach((item) => item.setMap(null));
    mapItemsRef.current = [];
    if (!map || !maps) return;

    const marker = (coordinate: Coordinate, className: string, label: string, content: string | HTMLElement, onClick?: () => void) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.setAttribute("aria-label", label);
      if (typeof content === "string") button.textContent = content;
      else button.appendChild(content);
      if (onClick) button.addEventListener("click", onClick);
      const overlay = new maps.CustomOverlay({
        map,
        position: new maps.LatLng(coordinate.latitude, coordinate.longitude),
        content: button,
        yAnchor: 0.5,
        zIndex: className.includes("selected") ? 30 : className.includes("dg-route-endpoint") ? 28 : 20,
      });
      routeOverlaysRef.current.push(overlay);
    };

    const polyline = (points: Coordinate[], color: string, width: number, style = "solid") => {
      if (points.length < 2) return;
      mapItemsRef.current.push(new maps.Polyline({
        map,
        path: points.map((point) => new maps.LatLng(point.latitude, point.longitude)),
        strokeWeight: width,
        strokeColor: color,
        strokeOpacity: 0.92,
        strokeStyle: style,
      }));
    };

    const nearbyMapProgram = routePanelActive && routePanelMode === "nearby"
      ? selected
      : auxiliaryPanel === "nearby" ? nearbyDestination : null;
    if (nearbyMapProgram && nearbySummary) {
      const radarStrokeWidths = [6, 5, 4, 3];
      const radarStrokeOpacities = [0.94, 0.76, 0.60, 0.46];
      const radarFillOpacities = [0.07, 0.045, 0.025, 0.012];
      [1000, 500, 300, 100].filter((value) => value <= nearbyRadius).forEach((value, index) => {
        mapItemsRef.current.push(new maps.Circle({
          map,
          center: new maps.LatLng(nearbyMapProgram.latitude, nearbyMapProgram.longitude),
          radius: value,
          strokeWeight: radarStrokeWidths[index] ?? 3,
          strokeColor: "#22b14c",
          strokeOpacity: radarStrokeOpacities[index] ?? 0.46,
          strokeStyle: "dash",
          fillColor: "#83d43f",
          fillOpacity: radarFillOpacities[index] ?? 0.012,
        }));
      });
      const mapPlaces = nearbySummary.mapPlaces.filter((place) => nearbyCategory === "all" || place.placeType === nearbyCategory);
      marker(location, `dg-route-endpoint dg-route-origin${usesFallbackLocation ? " fallback" : ""}`, usesFallbackLocation ? "기본 출발 위치" : "현재 위치", routeEndpointElement("origin"));
      marker(nearbyMapProgram, "dg-route-endpoint dg-route-destination", `${nearbyMapProgram.facility} 목적지`, routeEndpointElement("destination"));
      mapPlaces.slice(0, 400).forEach((place) => {
        const selectedPlace = selectedNearbyPlace?.id === place.id;
        const icon = nearbyMarkerElement(place.placeType);
        marker(
          place,
          `dg-nearby-map-marker dg-nearby-${place.placeType}${selectedPlace ? " selected" : ""}`,
          `${nearbyDisplayName(place)}, ${distanceLabel(place.distanceMeters)}`,
          icon,
          () => { void selectNearbyPlace(place); },
        );
      });
      if (nearbyWalkingRoute) {
        const points = nearbyWalkingRoute.segments.flatMap((segment) => segment.points);
        polyline(points, "#f4b61a", 7);
      }
      const bounds = new maps.LatLngBounds();
      const latitudeDelta = nearbyRadius / 111_000;
      const longitudeDelta = nearbyRadius / (111_000 * Math.max(0.3, Math.cos(nearbyMapProgram.latitude * Math.PI / 180)));
      [
        { latitude: nearbyMapProgram.latitude + latitudeDelta, longitude: nearbyMapProgram.longitude },
        { latitude: nearbyMapProgram.latitude - latitudeDelta, longitude: nearbyMapProgram.longitude },
        { latitude: nearbyMapProgram.latitude, longitude: nearbyMapProgram.longitude + longitudeDelta },
        { latitude: nearbyMapProgram.latitude, longitude: nearbyMapProgram.longitude - longitudeDelta },
      ].forEach((point) => bounds.extend(new maps.LatLng(point.latitude, point.longitude)));
      if (selectedNearbyPlace) bounds.extend(new maps.LatLng(selectedNearbyPlace.latitude, selectedNearbyPlace.longitude));
      const compactMap = window.innerWidth < 900;
      map.setBounds(bounds, 70, compactMap ? 40 : 80, compactMap ? 110 : 70, compactMap ? 40 : 500);
    } else if (selected && routePanelActive && routePanelMode === "route") {
      const routeColors: Record<WebRouteMode, string> = {
        WALKING: "#2daa50",
        TRANSIT: "#1f73eb",
        DRIVING: "#f47a24",
      };
      activeRoute?.segments.forEach((segment) => {
        polyline(segment.points, routeColors[activeRoute.mode], 7, activeRoute.isEstimated ? "dash" : "solid");
      });
      marker(location, `dg-route-endpoint dg-route-origin${usesFallbackLocation ? " fallback" : ""}`, usesFallbackLocation ? "기본 출발 위치" : "현재 위치", routeEndpointElement("origin"));
      marker(selected, "dg-route-endpoint dg-route-destination", `${selected.facility} 목적지`, routeEndpointElement("destination"));
      const bounds = new maps.LatLngBounds();
      bounds.extend(new maps.LatLng(location.latitude, location.longitude));
      bounds.extend(new maps.LatLng(selected.latitude, selected.longitude));
      activeRoute?.segments.flatMap((segment) => segment.points).forEach((point) => bounds.extend(new maps.LatLng(point.latitude, point.longitude)));
      const compactMap = window.innerWidth < 900;
      map.setBounds(bounds, 70, compactMap ? 40 : 80, compactMap ? 110 : 70, compactMap ? 40 : 500);
    }

    return () => {
      routeOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      routeOverlaysRef.current = [];
      mapItemsRef.current.forEach((item) => item.setMap(null));
      mapItemsRef.current = [];
    };
  }, [activeRoute, auxiliaryPanel, location, nearbyCategory, nearbyDestination, nearbyRadius, nearbySummary, nearbyWalkingRoute, routePanelActive, routePanelMode, selected, selectedNearbyPlace, selectNearbyPlace, usesFallbackLocation]);

  const rememberSearch = (term: string) => {
    const nextRecent = [term, ...recentSearches.filter((item) => item !== term)].slice(0, 8);
    setRecentSearches(nextRecent);
    localStorage.setItem("dongnegogo.web.recentSearches", JSON.stringify(nextRecent));
  };

  const runPlaceSearch = async (
    expectedQuery: string,
    place: WebPlaceSuggestion,
    radius: number,
    requestID = ++searchRequestIDRef.current,
  ) => {
    setSearchAssistant({ kind: "placeSearching", place, radiusKm: radius });
    setSearchWarning("");
    setLoading(true);
    setSearchProgress(82);
    try {
      const candidates = await fetchProgramsAroundPlace(place, radius);
      if (requestID !== searchRequestIDRef.current) return;
      const assisted = searchAroundPlacePrograms(candidates, expectedQuery, place, radius);
      const matches = assisted.results.map((item) => item.program);
      setSearchCandidates(candidates);
      setSearchIntent(assisted.intent);
      setSearchResults(matches);
      setSearchResultCategory(null);
      setSearchSort("relevance");
      setSearchProgress(100);
      if (place.latitude !== null && place.longitude !== null) {
        setCenter({ latitude: place.latitude, longitude: place.longitude });
        setCenteredArea(place.displayName);
        const maps = window.kakao?.maps;
        if (mapRef.current && maps) {
          if (matches.length) {
            const bounds = new maps.LatLngBounds();
            matches.slice(0, 120).forEach((program) => bounds.extend(new maps.LatLng(program.latitude, program.longitude)));
            mapRef.current.setBounds(bounds, 60, 60, 60, 60);
          } else {
            mapRef.current.setCenter(new maps.LatLng(place.latitude, place.longitude));
            mapRef.current.setLevel(4);
          }
        }
      }
      if (matches.length) {
        setSearchAssistant({ kind: "placeFound", place, radiusKm: radius, count: matches.length });
      } else {
        const nextRadius = SEARCH_PLACE_RADIUS_OPTIONS.find((value) => value > radius + 0.01);
        setSearchAssistant(nextRadius
          ? { kind: "placeExpand", place, currentRadiusKm: radius, nextRadiusKm: nextRadius, remoteSucceeded: true }
          : { kind: "idle" });
      }
    } catch {
      if (requestID !== searchRequestIDRef.current) return;
      const nextRadius = SEARCH_PLACE_RADIUS_OPTIONS.find((value) => value > radius + 0.01);
      setSearchResults([]);
      setSearchProgress(100);
      setSearchAssistant(nextRadius
        ? { kind: "placeExpand", place, currentRadiusKm: radius, nextRadiusKm: nextRadius, remoteSucceeded: false }
        : { kind: "idle" });
    } finally {
      if (requestID === searchRequestIDRef.current) setLoading(false);
    }
  };

  const runSearch = async (rawTerm: string, preferredProgramID?: string) => {
    const term = rawTerm.trim();
    if (!term) return;
    queryRef.current = term;
    const requestID = ++searchRequestIDRef.current;
    const intent = parseSearchIntent(term);
    let hadLocalResults = false;
    searchActiveRef.current = true;
    setTab("search");
    setSelected(null);
    setRoutePanelActive(false);
    setSubmittedQuery(term);
    setSearchIntent(intent);
    setSearchResults([]);
    setSearchResultCategory(null);
    setSearchSort("relevance");
    setSearchAlternativeNotice("");
    setSearchWarning("");
    setSearchSuggestionError("");
    setSearchAssistant({ kind: "idle" });
    setLoading(true);
    setSearchProgress(15);

    try {
      let suggestions = searchSuggestions;
      if (shouldRequestPlaceSuggestions(term, intent)) {
        try {
          suggestions = await fetchSearchSuggestions(searchSuggestionQuery(term, intent));
          if (requestID !== searchRequestIDRef.current) return;
          setSearchSuggestions(suggestions);
        } catch {
          suggestions = [];
          setSearchSuggestions([]);
          setSearchWarning("지역·장소 자동완성 연결이 잠시 불안정하지만 프로그램 검색은 계속 진행해요.");
        }
      }
      if (!isAdministrativeTitleQuery(term, intent) && hasAmbiguousAdministrativeSuggestions(term, suggestions)) {
        setSubmittedQuery(term);
        setSearchIntent(null);
        setSearchResults([]);
        setSearchSuggestionError("같은 이름의 지역이 여러 곳이에요. 정확한 전체 행정지역을 선택해 주세요.");
        window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
        return;
      }

      const cityScope = resolveSearchCityScope(intent, centeredArea);
      setSearchCityScope(cityScope);
      const localPool = uniquePrograms([...programs, ...searchCandidates])
        .filter((program) => programMatchesAreaTerms(program, cityScope.candidateAreaTerms));
      const localMatches = isAdministrativeTitleQuery(term, intent)
        ? fuzzyAdministrativeTitlePrograms(term, intent, localPool)
        : searchPrograms(localPool, intent, location).map((item) => item.program);
      hadLocalResults = localMatches.length > 0;
      setSearchResults(localMatches);
      setSearchProgress(35);

      const params = new URLSearchParams();
      intent.subjectTerms.forEach((value) => params.append("subject", value));
      [...new Set([...intent.areaTerms, ...cityScope.candidateAreaTerms])].forEach((value) => params.append("area", value));
      intent.generalTerms.forEach((value) => params.append("general", value));
      const [fetchedCandidates, preferredPrograms] = await Promise.all([
        fetchPrograms(params),
        preferredProgramID
          ? fetchPrograms(new URLSearchParams({ id: preferredProgramID })).catch(() => [] as WebProgram[])
          : Promise.resolve([] as WebProgram[]),
      ]);
      if (requestID !== searchRequestIDRef.current) return;
      setSearchProgress(82);
      const candidates = uniquePrograms([...fetchedCandidates, ...preferredPrograms])
        .filter((program) => programMatchesAreaTerms(program, cityScope.candidateAreaTerms));
      setSearchCandidates(candidates);
      const administrativeTitleQuery = isAdministrativeTitleQuery(term, intent);
      let matches = administrativeTitleQuery
        ? fuzzyAdministrativeTitlePrograms(term, intent, candidates)
        : searchPrograms(candidates, intent, location).map((item) => item.program);
      if (!administrativeTitleQuery && !matches.length) {
        matches = fuzzyAdministrativeTitlePrograms(term, intent, candidates);
      }
      setSearchResults(matches);
      setSearchProgress(100);
      setError("");
      rememberSearch(term);

      let titleSuggestion: ReturnType<typeof strongOutOfAreaTitleSuggestion> = null;
      const canCheckNationwideTitle = intent.areaTerms.length === 0
        && intent.subjectTerms.length === 0
        && intent.generalTerms.length > 0
        && !intent.audiences.length
        && intent.free === null && intent.day === null && intent.time === null
        && intent.status === null && intent.dateTarget === null && intent.radiusKm === null
        && term.replace(/[^0-9A-Za-z가-힣]/g, "").length >= 4;
      if (canCheckNationwideTitle) {
        const nationwideParams = new URLSearchParams();
        intent.generalTerms.forEach((value) => nationwideParams.append("general", value));
        const nationwideCandidates = await fetchPrograms(nationwideParams);
        if (requestID !== searchRequestIDRef.current) return;
        titleSuggestion = strongOutOfAreaTitleSuggestion(term, cityScope, nationwideCandidates);
      }

      const place = isAdministrativeTitleQuery(term, intent)
        ? null
        : preferredPlaceSuggestion(term, intent, suggestions);
      if (titleSuggestion) {
        setSearchAssistant({ kind: "titleSuggestion", ...titleSuggestion });
      } else if (place && place.placeKind !== "administrative") {
        const shouldAutomaticallySearch = place.confidence >= 90 || matches.length <= 10;
        if (shouldAutomaticallySearch) {
          await runPlaceSearch(term, place, 1, requestID);
          return;
        }
        setSearchAssistant({ kind: "placeOffer", place, radiusKm: 1 });
      }

      const maps = window.kakao?.maps;
      if (mapRef.current && matches.length && maps) {
        const bounds = new maps.LatLngBounds();
        matches.slice(0, 120).forEach((program) => bounds.extend(new maps.LatLng(program.latitude, program.longitude)));
        mapRef.current.setBounds(bounds, 70, 70, 70, 70);
      }
    } catch {
      if (requestID !== searchRequestIDRef.current) return;
      setSearchProgress(100);
      setSearchWarning(hadLocalResults
        ? "새 프로그램 연결이 잠시 불안정해 저장된 검색 결과를 먼저 보여드려요."
        : "검색 연결이 잠시 불안정해요. 잠시 후 다시 검색해 주세요.");
    } finally {
      if (requestID === searchRequestIDRef.current) setLoading(false);
    }
  };

  const updateSearchQuery = (value: string) => {
    queryRef.current = value;
    setQuery(value);
    searchSuggestionRequestIDRef.current += 1;
    setSearchSuggestions([]);
    const valueIntent = parseSearchIntent(value.trim());
    setSearchSuggestionsLoading(shouldRequestPlaceSuggestions(value.trim(), valueIntent));
    setSearchSuggestionError("");
    if (value.trim() === submittedQuery) return;
    searchRequestIDRef.current += 1;
    setSubmittedQuery("");
    setSearchIntent(null);
    setSearchResults([]);
    setSearchProgress(0);
    setSearchWarning("");
    setSearchAlternativeNotice("");
    setSearchAssistant({ kind: "idle" });
    setSearchResultCategory(null);
    setLoading(false);
    setError("");
  };

  const clearSearch = () => {
    queryRef.current = "";
    searchRequestIDRef.current += 1;
    searchSuggestionRequestIDRef.current += 1;
    setQuery("");
    setSubmittedQuery("");
    setSearchIntent(null);
    setSearchCandidates([]);
    setSearchResults([]);
    setSearchSuggestions([]);
    setSearchSuggestionsLoading(false);
    setSearchSuggestionError("");
    setSearchWarning("");
    setSearchAlternativeNotice("");
    setSearchAssistant({ kind: "idle" });
    setSearchResultCategory(null);
    setSearchProgress(0);
    setLoading(false);
    window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
  };

  const selectSearchSuggestion = (suggestion: WebPlaceSuggestion) => {
    if (suggestion.latitude === null || suggestion.longitude === null) {
      setSearchSuggestionError("입력한 지역과 일치하는 위치를 확인하지 못했어요. 시·도나 시·군·구 이름을 함께 입력해 주세요.");
      return;
    }
    queryRef.current = suggestion.displayName;
    setQuery(suggestion.displayName);
    setSubmittedQuery(suggestion.displayName);
    rememberSearch(suggestion.displayName);
    setSearchSuggestionError("");
    setSearchSuggestions([]);
    searchActiveRef.current = false;
    setTab("map");
    setSelected(null);
    setRoutePanelActive(false);
    setAuxiliaryPanel(null);
    setMobileSheetSnap("medium");
    setCenter({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setCenteredArea(suggestion.displayName);
    const maps = window.kakao?.maps;
    if (mapRef.current && maps) {
      mapRef.current.setCenter(new maps.LatLng(suggestion.latitude, suggestion.longitude));
      mapRef.current.setLevel(suggestion.placeKind === "administrative" ? 6 : 4);
      window.setTimeout(() => mapRef.current && void loadBounds(mapRef.current), 0);
    }
  };

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    void runSearch(query);
  };

  const submitSearchFromKeyboard = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void runSearch(query);
  };

  const chooseSearch = (term: string, preferredProgramID?: string) => {
    queryRef.current = term;
    setQuery(term);
    void runSearch(term, preferredProgramID);
  };

  const applyRelaxedIntent = (intent: SearchIntent, notice: string) => {
    setSearchIntent(intent);
    const origin = searchAssistant.kind === "placeFound" && searchAssistant.place.latitude !== null && searchAssistant.place.longitude !== null
      ? { latitude: searchAssistant.place.latitude, longitude: searchAssistant.place.longitude }
      : location;
    const matches = searchPrograms(searchCandidates, intent, origin).map((item) => item.program);
    setSearchResults(matches);
    setSearchAlternativeNotice(notice);
    setSearchAssistant({ kind: "alternativeFound", message: notice, count: matches.length });
  };

  const removeIntentChip = (chip: string) => {
    if (!searchIntent) return;
    const next: SearchIntent = {
      ...searchIntent,
      subjectTerms: searchIntent.subjectTerms.includes(chip) ? [] : searchIntent.subjectTerms,
      areaTerms: searchIntent.areaTerms.filter((term) => term !== chip),
      audiences: ["어르신", "아이", "가족", "직장인"].includes(chip) ? [] : searchIntent.audiences,
      free: ["무료", "유료"].includes(chip) ? null : searchIntent.free,
      day: ["주말", "평일"].includes(chip) ? null : searchIntent.day,
      time: ["오전", "오후", "저녁"].includes(chip) ? null : searchIntent.time,
      status: ["접수중", "접수예정", "마감임박"].includes(chip) ? null : searchIntent.status,
      dateTarget: ["오늘", "내일"].includes(chip) ? null : searchIntent.dateTarget,
      radiusKm: chip === "근처" || /(?:km|m) 이내$/.test(chip) ? null : searchIntent.radiusKm,
      chips: searchIntent.chips.filter((item) => item !== chip),
    };
    setSearchIntent(next);
    const origin = searchAssistant.kind === "placeFound" && searchAssistant.place.latitude !== null && searchAssistant.place.longitude !== null
      ? { latitude: searchAssistant.place.latitude, longitude: searchAssistant.place.longitude }
      : location;
    setSearchResults(searchPrograms(searchCandidates, next, origin).map((item) => item.program));
    setSearchAlternativeNotice("");
  };

  const moveToCurrentLocation = useCallback(() => {
    setLocationRequestState("checking");
    setLocationRequestMessage("휴대폰의 현재 위치를 확인하고 있어요.");
    if (!window.isSecureContext) {
      const message = "현재 위치는 안전한 HTTPS 연결에서만 사용할 수 있어요.";
      setLocationRequestState("unavailable");
      setLocationRequestMessage(message);
      if (!selected) setError(message);
      return;
    }
    if (!navigator.geolocation) {
      const message = "이 브라우저에서는 현재 위치 기능을 지원하지 않아요.";
      setLocationRequestState("unavailable");
      setLocationRequestMessage(message);
      if (!selected) setError(message);
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) {
        const message = "현재 위치 좌표를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
        setLocationRequestState("unavailable");
        setLocationRequestMessage(message);
        if (!selected) setError(message);
        return;
      }
      setLocation(next);
      setUsesFallbackLocation(false);
      setLocationRequestState("granted");
      setLocationRequestMessage("현재 위치를 확인했어요. 실제 경로를 불러옵니다.");
      setError("");
      resolveCenteredArea(next);
      if (mapRef.current && window.kakao?.maps) {
        mapRef.current.setCenter(new window.kakao.maps.LatLng(next.latitude, next.longitude));
        mapRef.current.setLevel(4);
      }
    }, (locationError) => {
      const state: LocationRequestState = locationError.code === 1 ? "denied" : locationError.code === 3 ? "timeout" : "unavailable";
      const message = locationError.code === 1
        ? "위치 권한이 차단되어 있어요. 브라우저의 사이트 설정에서 위치를 허용한 뒤 다시 눌러주세요."
        : locationError.code === 3
          ? "현재 위치 확인 시간이 초과됐어요. GPS·Wi-Fi를 켜고 다시 시도해 주세요."
          : "휴대폰에서 현재 위치를 확인하지 못했어요. 위치 서비스를 켠 뒤 다시 시도해 주세요.";
      setLocationRequestState(state);
      setLocationRequestMessage(message);
      if (!selected) setError(message);
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 });
  }, [resolveCenteredArea, selected]);

  useEffect(() => {
    if (initialLocationRequestStartedRef.current) return;
    initialLocationRequestStartedRef.current = true;
    moveToCurrentLocation();
  }, [moveToCurrentLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!mapReady || usesFallbackLocation || locationRequestState !== "granted" || !map || !maps) return;
    map.setCenter(new maps.LatLng(location.latitude, location.longitude));
    map.setLevel(4);
    window.setTimeout(() => void loadBounds(map), 0);
  }, [loadBounds, location.latitude, location.longitude, locationRequestState, mapReady, usesFallbackLocation]);

  const share = async (program: WebProgram) => {
    const url = `${window.location.origin}/program/${encodeURIComponent(program.id)}`;
    const data = { title: program.name, text: `${program.name} · ${program.facility}`, url };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard?.writeText(url);
  };

  const startAccountSignIn = async (provider: "apple" | "google" | "kakao") => {
    setAccountError("");
    setAuthLoading(true);
    try {
      await signInToWeb(provider);
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "로그인을 시작하지 못했어요.";
      setAccountError(provider === "apple" && /missing OAuth secret|unsupported provider/i.test(message)
        ? "Apple 웹 로그인을 위한 운영 인증 설정이 아직 완료되지 않았어요."
        : message);
      setAuthLoading(false);
    }
  };

  const openAccountSignIn = () => {
    setAccountError("");
    setAuthConsentAccepted(localStorage.getItem(WEB_AUTH_CONSENT_STORAGE_KEY) === WEB_AUTH_CONSENT_VERSION);
    setShowAuthDialog(true);
  };

  const acceptAccountConsent = () => {
    localStorage.setItem(WEB_AUTH_CONSENT_STORAGE_KEY, WEB_AUTH_CONSENT_VERSION);
    setAuthConsentAccepted(true);
  };

  const finishAccountSignOut = async () => {
    setAccountError("");
    setAuthLoading(true);
    try {
      await signOutFromWeb();
      setSession(null);
      setFavorites([]);
      setReminders([]);
      setFavoriteTargets({});
      setUserAlerts([]);
      setFamilyMembers([]);
      setViewHistory([]);
      localStorage.removeItem("dongnegogo.web.viewHistory");
      localStorage.removeItem("dongnegogo.web.favorites");
      localStorage.removeItem("dongnegogo.web.reminders");
      localStorage.removeItem("dongnegogo.web.alerts");
    } catch (authError) {
      setAccountError(authError instanceof Error ? authError.message : "로그아웃하지 못했어요.");
    } finally {
      setAuthLoading(false);
    }
  };

  const saveAlert = async () => {
    if (!alertDialog) return;
    const parsed = new Date(alertDialog.scheduledAt);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      setAccountError("알림 시간은 현재보다 뒤로 선택해 주세요.");
      return;
    }
    const saved: WebUserAlert = {
      program_id: alertDialog.program.id,
      minutes_before: 60,
      enabled_at: new Date().toISOString(),
      scheduled_at: parsed.toISOString(),
      scheduled_times: [parsed.toISOString()],
    };
    const nextAlerts = [saved, ...userAlerts.filter((item) => item.program_id !== saved.program_id)];
    setUserAlerts(nextAlerts);
    setReminders((previous) => previous.includes(saved.program_id) ? previous : [...previous, saved.program_id]);
    if (session) {
      try { await upsertWebAlert(session, saved.program_id, saved.scheduled_at); }
      catch (syncError) {
        setAccountError(syncError instanceof Error ? syncError.message : "알림 시간을 동기화하지 못했어요.");
      }
    } else {
      localStorage.setItem("dongnegogo.web.alerts", JSON.stringify(nextAlerts));
      persistList("dongnegogo.web.reminders", nextAlerts.map((item) => item.program_id));
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => "denied");
    }
    setAlertDialog(null);
  };

  const removeAlertForProgram = async (id: string) => {
    const nextAlerts = userAlerts.filter((item) => item.program_id !== id);
    setUserAlerts(nextAlerts);
    setReminders((previous) => previous.filter((item) => item !== id));
    if (session) {
      try { await deleteWebAlert(session, id); }
      catch (syncError) {
        setAccountError(syncError instanceof Error ? syncError.message : "알림을 해제하지 못했어요.");
      }
    } else {
      localStorage.setItem("dongnegogo.web.alerts", JSON.stringify(nextAlerts));
      persistList("dongnegogo.web.reminders", nextAlerts.map((item) => item.program_id));
    }
  };

  const removeAlert = async () => {
    if (!alertDialog) return;
    await removeAlertForProgram(alertDialog.program.id);
    setAlertDialog(null);
  };

  const saveFamily = async (member: WebFamilyMember) => {
    const identity = `${member.role}:${member.name ?? ""}`;
    const next = [member, ...familyMembers.filter((item) => `${item.role}:${item.name ?? ""}` !== identity)];
    setFamilyMembers(next);
    if (!session) {
      localStorage.setItem("dongnegogo.web.family", JSON.stringify(next));
      return;
    }
    try { await saveWebFamilyMember(session, member); await synchronizeAccount(session); }
    catch (syncError) {
      setAccountError(syncError instanceof Error ? syncError.message : "가족 정보를 저장하지 못했어요.");
    }
  };

  const removeFamily = async (member: WebFamilyMember) => {
    const identity = `${member.role}:${member.name ?? ""}`;
    const next = familyMembers.filter((item) => `${item.role}:${item.name ?? ""}` !== identity);
    setFamilyMembers(next);
    if (!session) {
      localStorage.setItem("dongnegogo.web.family", JSON.stringify(next));
      return;
    }
    try { await deleteWebFamilyMember(session, member); }
    catch (syncError) {
      setAccountError(syncError instanceof Error ? syncError.message : "가족 정보를 삭제하지 못했어요.");
    }
  };

  const setPreference = (key: string, value: boolean, setter: (value: boolean) => void) => {
    setter(value);
    localStorage.setItem(`dongnegogo.web.${key}`, String(value));
  };

  const resetFilters = () => {
    setFieldFilter("전체");
    setPersonaFilters([]);
    setSubjectFilters([]);
    setStatusFilter("전체");
    setTodayOnly(false);
    setFreeOnly(false);
    setPaidOnly(false);
    setSeniorOnly(false);
    setRadiusKm(null);
  };

  const loadNearbyPlaces = useCallback(async (program: WebProgram, radius = nearbyRadius) => {
    setNearbyDestination(program);
    setNearbyRadius(radius);
    setSelectedNearbyPlace(null);
    setNearbyWalkingRoute(null);
    setNearbyLoading(true);
    setAuxiliaryPanel("nearby");
    setSelected(null);
    setRoutePanelActive(false);
    try {
      const params = new URLSearchParams({ latitude: String(program.latitude), longitude: String(program.longitude), radiusMeters: String(radius) });
      const response = await fetch(`/api/web-nearby-places?${params}`);
      const payload = await response.json() as WebNearbyPlacesSummary & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "주변 가게를 불러오지 못했습니다.");
      setNearbySummary(payload);
      setError("");
    } catch (nearbyError) {
      setNearbySummary(null);
      setError((nearbyError as Error).message);
    } finally {
      setNearbyLoading(false);
    }
  }, [nearbyRadius]);

  const loadRouteNearbyPlaces = useCallback(async (program: WebProgram, radius = 100) => {
    setNearbyDestination(program);
    setNearbyRadius(radius);
    setSelectedNearbyPlace(null);
    setNearbyWalkingRoute(null);
    setNearbyLoading(true);
    try {
      const params = new URLSearchParams({ latitude: String(program.latitude), longitude: String(program.longitude), radiusMeters: String(radius) });
      const response = await fetch(`/api/web-nearby-places?${params}`);
      const payload = await response.json() as WebNearbyPlacesSummary & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "주변 가게를 불러오지 못했습니다.");
      setNearbySummary(payload);
      setError("");
    } catch (nearbyError) {
      setNearbySummary(null);
      setError(nearbyError instanceof Error ? nearbyError.message : "주변 가게를 불러오지 못했습니다.");
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const changeTab = (nextTab: Tab) => {
    if (!WEB_ACCOUNT_FEATURES_VISIBLE && (nextTab === "openrun" || nextTab === "saved" || nextTab === "me")) return;
    if (nextTab === "saved" && !session && window.matchMedia("(max-width: 820px)").matches) {
      openAccountSignIn();
      return;
    }
    searchActiveRef.current = nextTab === "search";
    if (nextTab === "map") setMobileSheetSnap("hidden");
    setTab(nextTab);
    setSelected(null);
    setRoutePanelActive(false);
    setActiveRoute(null);
    setSelectedNearbyPlace(null);
    setNearbyWalkingRoute(null);
    setPlaceSheet(null);
    setAuxiliaryPanel(null);
    if (nextTab !== "search" && mapRef.current) window.setTimeout(() => mapRef.current && loadBounds(mapRef.current), 0);
  };

  const openMapTool = (panel: Exclude<AuxiliaryPanel, "nearby" | null>) => {
    if (!WEB_ACCOUNT_FEATURES_VISIBLE && panel === "family") return;
    if ((panel === "family" || panel === "history") && !session && window.matchMedia("(max-width: 820px)").matches) {
      openAccountSignIn();
      return;
    }
    setSelected(null);
    setRoutePanelActive(false);
    setPlaceSheet(null);
    setAuxiliaryPanel(panel);
  };

  const openNearbyProgramCarousel = () => {
    const source = [...new Map(visiblePrograms.map((program) => [program.id, program])).values()]
      .sort((left, right) => distanceMeters(center, left) - distanceMeters(center, right))
      .slice(0, 120);
    filteredClusterCarouselAnchorRef.current = center;
    filteredClusterCarouselSignatureRef.current = null;
    filteredClusterCarouselProgramsRef.current = source;
    setFilteredClusterCarouselSignature(null);
    setFilteredClusterCarouselPrograms(source);
    setMapProgramCarouselSource("nearby");
    setSelected(null);
    setPlaceSheet(null);
    setAuxiliaryPanel(null);
    const first = source[0];
    if (first) focusFilteredClusterProgram(first);
  };

  const toggleMapDetail = (label: string) => {
    if (heatShelterMode) {
      heatShelterModeRef.current = false;
      setHeatShelterMode(false);
      setHeatShelters([]);
    }
    setLoading(true);
    setFieldFilter("전체");
    setSubjectFilters((current) => toggleSingleWebDetailFilter(current, label));
    setFilterFitRequestId((current) => current + 1);
  };

  const toggleMapPersona = (label: string) => {
    setLoading(true);
    setPersonaFilters(personaFilters.includes(label) ? personaFilters.filter((item) => item !== label) : [...personaFilters, label]);
    setFilterFitRequestId((current) => current + 1);
  };

  const toggleQuickFree = () => {
    setLoading(true);
    setFreeOnly(!freeOnly);
    if (!freeOnly) setPaidOnly(false);
    setFilterFitRequestId((current) => current + 1);
  };

  const toggleQuickToday = () => {
    setLoading(true);
    setTodayOnly(!todayOnly);
    setFilterFitRequestId((current) => current + 1);
  };

  const toggleQuickOpenStatus = () => {
    setLoading(true);
    setStatusFilter(statusFilter === "접수중" ? "전체" : "접수중");
    setFilterFitRequestId((current) => current + 1);
  };

  const sidePanelOverlay = Boolean(selectedHeatShelter || selected || auxiliaryPanel);
  const mobileMapPanel = tab === "map" && !sidePanelOverlay;
  const sidePanelStyle = ({
    ...(mobileSheetDragHeight === null ? {} : { "--dg-mobile-sheet-height": `${mobileSheetDragHeight}px` }),
    ...(routeSheetDragOffset === null ? {} : { "--dg-route-sheet-offset": `${routeSheetDragOffset}px` }),
    ...(routePanelDragHeight === null ? {} : { "--dg-main-route-panel-height": `${routePanelDragHeight}px` }),
  }) as CSSProperties;

  useEffect(() => {
    if (!mobileMapPanel || placeSheet) return;
    const grabber = sheetGrabberRef.current;
    if (!grabber) return;

    const begin = (pointerID: number, clientY: number) => {
      const heights = mobileSheetHeights(window.innerHeight);
      const panelHeight = grabber.closest<HTMLElement>(".dg-mobile-map-sheet")?.getBoundingClientRect().height
        ?? heights.medium;
      sheetDragRef.current = { pointerID, startY: clientY, startHeight: panelHeight, moved: false };
      setMobileSheetDragHeight(panelHeight);
    };
    const move = (pointerID: number, clientY: number) => {
      const drag = sheetDragRef.current;
      if (drag.pointerID !== pointerID) return;
      const heights = mobileSheetHeights(window.innerHeight);
      const delta = drag.startY - clientY;
      if (Math.abs(delta) > 6) drag.moved = true;
      setMobileSheetDragHeight(Math.max(heights.hidden, Math.min(heights.expanded, drag.startHeight + delta)));
    };
    const finish = (pointerID: number, clientY: number) => {
      const drag = sheetDragRef.current;
      if (drag.pointerID !== pointerID) return;
      const heights = mobileSheetHeights(window.innerHeight);
      const finalHeight = Math.max(heights.hidden, Math.min(heights.expanded, drag.startHeight + drag.startY - clientY));
      const next = (Object.entries(heights) as Array<[MobileSheetSnap, number]>).reduce((best, candidate) =>
        Math.abs(candidate[1] - finalHeight) < Math.abs(best[1] - finalHeight) ? candidate : best,
      )[0];
      sheetDragRef.current.pointerID = -1;
      setMobileSheetSnap(next);
      setMobileSheetDragHeight(null);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      begin(event.pointerId, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (sheetDragRef.current.pointerID !== event.pointerId) return;
      event.preventDefault();
      move(event.pointerId, event.clientY);
    };
    const onPointerEnd = (event: PointerEvent) => finish(event.pointerId, event.clientY);

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      event.preventDefault();
      begin(touch.identifier, touch.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === sheetDragRef.current.pointerID);
      if (!touch) return;
      event.preventDefault();
      move(touch.identifier, touch.clientY);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === sheetDragRef.current.pointerID);
      if (touch) finish(touch.identifier, touch.clientY);
    };

    if ("PointerEvent" in window) {
      grabber.addEventListener("pointerdown", onPointerDown, { passive: false });
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
      return () => {
        grabber.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
      };
    }

    grabber.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      grabber.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [mobileMapPanel, placeSheet]);

  useEffect(() => {
    if (!selected || routeSheetCollapsed) return;
    const grabber = routeSheetGrabberRef.current;
    if (!grabber) return;

    const begin = (pointerID: number, clientY: number) => {
      routeSheetDragRef.current = { pointerID, startY: clientY, moved: false };
      setRouteSheetDragOffset(0);
    };
    const move = (pointerID: number, clientY: number) => {
      const drag = routeSheetDragRef.current;
      if (drag.pointerID !== pointerID) return;
      const offset = Math.max(0, clientY - drag.startY);
      if (offset > 6) drag.moved = true;
      setRouteSheetDragOffset(offset);
    };
    const finish = (pointerID: number, clientY: number) => {
      const drag = routeSheetDragRef.current;
      if (drag.pointerID !== pointerID) return;
      const offset = Math.max(0, clientY - drag.startY);
      routeSheetDragRef.current.pointerID = -1;
      setRouteSheetDragOffset(null);
      if (offset >= Math.max(96, window.innerHeight * 0.12)) setRouteSheetCollapsed(true);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      begin(event.pointerId, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (routeSheetDragRef.current.pointerID !== event.pointerId) return;
      event.preventDefault();
      move(event.pointerId, event.clientY);
    };
    const onPointerEnd = (event: PointerEvent) => finish(event.pointerId, event.clientY);
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      event.preventDefault();
      begin(touch.identifier, touch.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === routeSheetDragRef.current.pointerID);
      if (!touch) return;
      event.preventDefault();
      move(touch.identifier, touch.clientY);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === routeSheetDragRef.current.pointerID);
      if (touch) finish(touch.identifier, touch.clientY);
    };

    if ("PointerEvent" in window) {
      grabber.addEventListener("pointerdown", onPointerDown, { passive: false });
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
      return () => {
        grabber.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
      };
    }

    grabber.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      grabber.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [routeSheetCollapsed, selected]);

  useEffect(() => {
    if (!routePanelActive || routePanelSnap === "hidden") return;
    const panel = mainRoutePanelRef.current;
    if (!panel) return;

    const begin = (pointerID: number, clientY: number) => {
      const height = panel.getBoundingClientRect().height || routePanelHeights(window.innerHeight, routePanelMode, Boolean(selectedNearbyPlace))[routePanelSnap];
      mainRoutePanelDragRef.current = { pointerID, startY: clientY, startHeight: height, moved: false };
      setRoutePanelDragHeight(height);
    };
    const move = (pointerID: number, clientY: number) => {
      const drag = mainRoutePanelDragRef.current;
      if (drag.pointerID !== pointerID) return;
      const heights = routePanelHeights(window.innerHeight, routePanelMode, Boolean(selectedNearbyPlace));
      const delta = drag.startY - clientY;
      if (Math.abs(delta) > 6) drag.moved = true;
      setRoutePanelDragHeight(Math.max(heights.hidden, Math.min(heights.expanded, drag.startHeight + delta)));
    };
    const finish = (pointerID: number, clientY: number) => {
      const drag = mainRoutePanelDragRef.current;
      if (drag.pointerID !== pointerID) return;
      const delta = clientY - drag.startY;
      let next = routePanelSnap;
      if (routePanelSnap === "expanded" && delta > 45) next = "collapsed";
      if (routePanelSnap === "collapsed" && delta < -45) next = "expanded";
      if (routePanelSnap === "collapsed" && delta > 55) next = "hidden";
      mainRoutePanelDragRef.current.pointerID = -1;
      setRoutePanelDragHeight(null);
      setRoutePanelSnap(next);
    };
    const canBegin = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      if (!element) return false;
      if (element.closest(".dg-main-route-grabber, .dg-main-route-title")) return true;
      return !element.closest("button, a, input, select, textarea");
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !canBegin(event.target)) return;
      begin(event.pointerId, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (mainRoutePanelDragRef.current.pointerID !== event.pointerId) return;
      if (mainRoutePanelDragRef.current.moved) event.preventDefault();
      move(event.pointerId, event.clientY);
    };
    const onPointerEnd = (event: PointerEvent) => finish(event.pointerId, event.clientY);
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch || !canBegin(event.target)) return;
      begin(touch.identifier, touch.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === mainRoutePanelDragRef.current.pointerID);
      if (!touch) return;
      if (mainRoutePanelDragRef.current.moved) event.preventDefault();
      move(touch.identifier, touch.clientY);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === mainRoutePanelDragRef.current.pointerID);
      if (touch) finish(touch.identifier, touch.clientY);
    };

    if ("PointerEvent" in window) {
      panel.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
      return () => {
        panel.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
      };
    }

    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      panel.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [routePanelActive, routePanelMode, routePanelSnap, selectedNearbyPlace]);

  const cycleMobileSheet = () => {
    if (sheetDragRef.current.moved) {
      sheetDragRef.current.moved = false;
      return;
    }
    setMobileSheetSnap((current) => current === "hidden" || current === "collapsed" ? "medium" : current === "medium" ? "expanded" : "hidden");
  };

  const collapseRouteSheet = () => {
    if (routeSheetDragRef.current.moved) {
      routeSheetDragRef.current.moved = false;
      return;
    }
    setRouteSheetCollapsed(true);
    setRouteSheetDragOffset(null);
  };

  const toggleRoutePanelSnap = () => {
    if (mainRoutePanelDragRef.current.moved) {
      mainRoutePanelDragRef.current.moved = false;
      return;
    }
    setRoutePanelSnap((current) => current === "expanded" ? "collapsed" : "expanded");
    setRoutePanelDragHeight(null);
  };

  return (
    <main className={`dg-web-app dg-tab-${tab}${bigText ? " dg-big-text" : ""}`}>
      <aside className="dg-nav-rail" aria-label="웹 버전 메뉴">
        <Link className="dg-brand-mark" href="/" aria-label="동네고고 소개 페이지로 돌아가기">
          <img src="/brand/app-icon.png" alt="" /><strong>동네<br />고고</strong>
        </Link>
        <nav className={!WEB_ACCOUNT_FEATURES_VISIBLE ? "dg-public-nav" : undefined}>
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id && !selected ? "active" : ""} onClick={() => changeTab(item.id)}>
              <span aria-hidden="true">{item.icon}{item.id === "openrun" && openRunBadge > 0 && <em className="dg-tab-badge">{openRunBadge}</em>}</span>{item.label}
            </button>
          ))}
        </nav>
        <Link className="dg-home-link" href="/">소개 페이지</Link>
      </aside>

      <section
        ref={routePanelActive ? mainRoutePanelRef : undefined}
        className={`dg-side-panel dg-side-panel-${tab}${sidePanelOverlay ? " dg-side-panel-overlay" : ""}${routePanelActive ? ` dg-main-route-panel-shell dg-main-route-panel-${routePanelSnap} dg-main-route-panel-mode-${routePanelMode}${selectedNearbyPlace ? " dg-main-route-panel-nearby-selected" : ""}${routePanelDragHeight !== null ? " dg-main-route-panel-dragging" : ""}` : selected ? ` dg-route-detail-sheet${routeSheetCollapsed ? " dg-route-detail-sheet-collapsed" : ""}${routeSheetDragOffset !== null ? " dg-route-detail-sheet-dragging" : ""}` : ""}${tab === "search" && searchIntent ? " dg-search-active" : ""}${mobileMapPanel ? ` dg-mobile-map-sheet dg-mobile-sheet-${mobileSheetSnap}${mobileSheetDragHeight !== null ? " dg-mobile-sheet-dragging" : ""}${placeSheet ? " dg-mobile-sheet-suppressed" : ""}` : ""}`}
        style={sidePanelStyle}
        aria-label="프로그램 탐색 패널"
      >
        {mobileMapPanel && !placeSheet && !sidePanelOverlay && <button
          type="button"
          ref={sheetGrabberRef}
          className="dg-mobile-sheet-grabber"
          aria-label={`지도 프로그램 패널 ${mobileSheetSnap === "hidden" || mobileSheetSnap === "collapsed" ? "중간으로 열기" : mobileSheetSnap === "medium" ? "전체로 펼치기" : "숨기기"}`}
          onClick={cycleMobileSheet}
        ><span aria-hidden="true" /><em>{mobileSheetSnap === "hidden" || mobileSheetSnap === "collapsed" ? "올려서 프로그램 보기" : mobileSheetSnap === "expanded" ? "내리면 패널 숨기기" : "위아래로 움직여 조절"}</em></button>}
        {selected && !routePanelActive && <button
          type="button"
          ref={routeSheetGrabberRef}
          className="dg-route-sheet-grabber"
          aria-label="목적지 길찾기 패널 접기"
          onClick={collapseRouteSheet}
        ><span aria-hidden="true" /><em>내리면 패널 숨기기</em></button>}
        {selectedHeatShelter ? (
          <HeatShelterDetail shelter={selectedHeatShelter} current={location} onBack={() => setSelectedHeatShelter(null)} />
        ) : selected && routePanelActive ? (
          <RouteInfoPanel
            program={selected}
            current={location}
            usesFallbackLocation={usesFallbackLocation}
            locationRequestState={locationRequestState}
            locationRequestMessage={locationRequestMessage}
            transport={transport}
            route={activeRoute}
            mode={routePanelMode}
            snap={routePanelSnap}
            nearbySummary={nearbySummary}
            nearbyLoading={nearbyLoading}
            nearbyRadius={nearbyRadius}
            nearbyCategory={nearbyCategory}
            selectedNearbyPlace={selectedNearbyPlace}
            nearbyWalkingRoute={nearbyWalkingRoute}
            onToggleSnap={toggleRoutePanelSnap}
            onBack={() => {
              setRoutePanelActive(false);
              setRoutePanelMode("route");
              setRoutePanelSnap("collapsed");
              setRoutePanelDragHeight(null);
              setRouteSheetCollapsed(false);
              setActiveRoute(null);
              setSelectedNearbyPlace(null);
              setNearbyWalkingRoute(null);
            }}
            onClose={() => {
              setSelected(null);
              setRoutePanelActive(false);
              setRoutePanelMode("route");
              setRoutePanelSnap("collapsed");
              setRoutePanelDragHeight(null);
              setActiveRoute(null);
              setSelectedNearbyPlace(null);
              setNearbyWalkingRoute(null);
            }}
            onMode={(mode) => {
              setRoutePanelMode(mode);
              setSelectedNearbyPlace(null);
              setNearbyWalkingRoute(null);
              if (mode === "nearby" && (nearbyDestination?.id !== selected.id || !nearbySummary)) {
                void loadRouteNearbyPlaces(selected, 100);
              }
            }}
            onTransport={(value) => { setTransport(value); setActiveRoute(null); }}
            onRouteChange={setActiveRoute}
            onRequestLocation={moveToCurrentLocation}
            onRadius={(value) => { void loadRouteNearbyPlaces(selected, value); }}
            onCategory={(value) => { setNearbyCategory(value); setSelectedNearbyPlace(null); setNearbyWalkingRoute(null); }}
            onSelectNearby={(place) => { void selectNearbyPlace(place); }}
            onShowNearbyOnMap={(place) => {
              void selectNearbyPlace(place);
              setRoutePanelSnap("collapsed");
              setRoutePanelDragHeight(null);
            }}
          />
        ) : selected ? (
          <ProgramDetail
            program={selected} current={location} favorite={favorites.includes(selected.id)}
            accountFeaturesVisible={WEB_ACCOUNT_FEATURES_VISIBLE}
            usesFallbackLocation={usesFallbackLocation}
            reminder={reminders.includes(selected.id)} transport={transport} easyFirst={easyFirst}
            favoriteTargets={favoriteTargets[selected.id] ?? (favorites.includes(selected.id) ? ["personal"] : [])}
            familyMembers={familyMembers}
            session={session}
            mapReady={mapReady}
            onRequireAuth={openAccountSignIn}
            onBack={() => { setSelected(null); setActiveRoute(null); }} onFavorite={() => toggleFavorite(selected.id)}
            onFavoriteTarget={(target) => toggleFavoriteTarget(selected.id, target)}
            onReminder={() => toggleReminder(selected.id)} onTransport={(value) => { setTransport(value); setActiveRoute(null); }}
            onRouteChange={setActiveRoute}
            onRequestLocation={moveToCurrentLocation}
            locationRequestState={locationRequestState}
            locationRequestMessage={locationRequestMessage}
            onShowRouteOnMap={() => {
              setRoutePanelActive(true);
              setRoutePanelMode("route");
              setRoutePanelSnap("collapsed");
              setRoutePanelDragHeight(null);
              setRouteSheetCollapsed(false);
              setRouteSheetDragOffset(null);
            }}
            onShare={() => share(selected)}
            onNearby={() => { setNearbyCategory("all"); void loadNearbyPlaces(selected, 100); }}
          />
        ) : auxiliaryPanel === "nearby" && nearbyDestination ? (
          <NearbyPlacesPanel
            program={nearbyDestination} summary={nearbySummary} loading={nearbyLoading} radius={nearbyRadius} category={nearbyCategory}
            selected={selectedNearbyPlace} walkingRoute={nearbyWalkingRoute}
            onBack={() => {
              setAuxiliaryPanel(null);
              setSelected(nearbyDestination);
              setRouteSheetCollapsed(false);
              setRouteSheetDragOffset(null);
              routeSheetDragRef.current = { pointerID: -1, startY: 0, moved: false };
              setSelectedNearbyPlace(null);
              setNearbyWalkingRoute(null);
            }}
            onRadius={(value) => { void loadNearbyPlaces(nearbyDestination, value); }}
            onCategory={(value) => { setNearbyCategory(value); setSelectedNearbyPlace(null); setNearbyWalkingRoute(null); }}
            onSelect={(place) => { void selectNearbyPlace(place); }}
            onShowOnMap={(place) => {
              setAuxiliaryPanel(null);
              setSelected(nearbyDestination);
              setRoutePanelActive(true);
              setRoutePanelMode("nearby");
              setRoutePanelSnap("collapsed");
              setRoutePanelDragHeight(null);
              void selectNearbyPlace(place);
            }}
          />
        ) : auxiliaryPanel === "calendar" ? (
          <CalendarPanel
            programs={programs}
            alerts={userAlerts}
            onBack={() => setAuxiliaryPanel(null)}
            onOpen={(program) => { void selectProgram(program); }}
            onDelete={(programID) => removeAlertForProgram(programID)}
          />
        ) : WEB_ACCOUNT_FEATURES_VISIBLE && auxiliaryPanel === "family" ? (
          <FamilyPanel programs={programs} members={familyMembers} signedIn={Boolean(session)}
            onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }}
            onSave={saveFamily} onRemove={removeFamily} />
        ) : auxiliaryPanel === "history" ? (
          <HistoryPanel history={viewHistory} onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }} />
        ) : WEB_ACCOUNT_FEATURES_VISIBLE && tab === "me" ? (
          <section className="dg-profile-panel">
            <div className="dg-panel-title"><button type="button" className="dg-mobile-panel-back" onClick={() => changeTab("map")}>‹ 지도</button><Link className="dg-desktop-panel-back" href="/">‹ 지도</Link><h1>내정보</h1></div>
            <div className="dg-profile-card dg-account-card">
              <small>계정</small>
              {authLoading ? <strong>로그인 상태 확인 중…</strong> : session ? <>
                <strong>{session.user.email ?? "로그인된 계정"}</strong>
                <span>{String(session.user.app_metadata?.provider ?? "Supabase")} 로그인 · 찜·알림·후기·보관함·가족 정보 동기화 중</span>
                <button type="button" onClick={() => { void finishAccountSignOut(); }}>로그아웃</button>
              </> : <>
                <span>로그인하면 찜, 알림, 후기, 보관함, 가족 정보를 계정에 안전하게 저장할 수 있어요.</span>
                <button type="button" className="dg-login-cta" onClick={openAccountSignIn}>로그인하고 안전하게 저장</button>
              </>}
              {accountError && <p className="dg-account-error" role="alert">{accountError}</p>}
            </div>
            <div className="dg-profile-card">
              <small>우리 동네</small><button type="button" className="dg-region-row" onClick={moveToCurrentLocation}><span>●</span><strong>{centeredArea}</strong><em>변경</em></button>
            </div>
            <div className="dg-profile-card dg-profile-menu-card">
              <small>나의 프로그램</small>
              <button type="button" className="dg-profile-row" onClick={() => { setSeniorOnly(false); setPersonaFilters([]); changeTab("search"); }}><span>◎</span><strong>나를 위한 프로그램 찾기</strong><em>›</em></button>
              <button type="button" className="dg-profile-row" onClick={() => openMapTool("calendar")}><span>▦</span><strong>내 일정 달력</strong><em>›</em></button>
            </div>
            <div className="dg-profile-card dg-profile-menu-card">
              <small>가족을 위한 프로그램</small>
              <button type="button" className="dg-profile-row" onClick={() => {
                if (!session && window.matchMedia("(max-width: 820px)").matches) { openAccountSignIn(); return; }
                setSeniorOnly(true); setPersonaFilters(["시니어"]); changeTab("search");
              }}><span>♧</span><strong>부모님을 위한 프로그램 찾기</strong><em>›</em></button>
              <button type="button" className="dg-profile-row" onClick={() => {
                if (!session && window.matchMedia("(max-width: 820px)").matches) { openAccountSignIn(); return; }
                setSeniorOnly(false); setPersonaFilters(["어린이"]); changeTab("search");
              }}><span>♧</span><strong>아이를 위한 프로그램 찾기</strong><em>›</em></button>
            </div>
            <div className="dg-profile-card">
              <small>보기 편하게 설정하기</small>
              <Preference label="글씨 크게 보기" value={bigText} onChange={(value) => setPreference("bigText", value, setBigText)} />
              <Preference label="쉬운 설명 우선" value={easyFirst} onChange={(value) => setPreference("easyFirst", value, setEasyFirst)} />
              <Preference label="전화 문의 버튼 먼저 보기" value={phoneFirst} onChange={(value) => setPreference("phoneFirst", value, setPhoneFirst)} />
              <Preference label="알림 크게 받기" value={bigAlerts} onChange={(value) => setPreference("bigAlerts", value, setBigAlerts)} />
            </div>
            <div className="dg-profile-card dg-profile-menu-card">
              <small>서비스 정보</small>
              <Link className="dg-profile-row" href="/terms"><span>§</span><strong>이용약관</strong><em>›</em></Link>
              <Link className="dg-profile-row" href="/privacy"><span>§</span><strong>개인정보처리방침</strong><em>›</em></Link>
              <Link className="dg-profile-row" href="/location-terms"><span>⌖</span><strong>위치기반서비스 이용약관</strong><em>›</em></Link>
              <Link className="dg-profile-row" href="/public-data"><span>✓</span><strong>공공데이터 출처 및 이용정책</strong><em>›</em></Link>
            </div>
            <div className="dg-profile-card">
              <small>데이터 동기화</small>
              <strong>{programs.length.toLocaleString("ko-KR")}개 프로그램 · 최신 지도 기준</strong>
              <button type="button" onClick={() => mapRef.current && loadBounds(mapRef.current)}>지금 새로고침</button>
            </div>
            <p className="dg-readonly-note">로그인 전에는 이 브라우저에만 저장되고, 로그인 후에는 본인에게만 보이는 Supabase 행으로 동기화됩니다.</p>
          </section>
        ) : WEB_ACCOUNT_FEATURES_VISIBLE && tab === "openrun" ? (
          <OpenRunPanel programs={programs} reminders={reminders} onBack={() => changeTab("map")} onToggleReminder={(program) => toggleReminder(program.id)} onOpen={(program) => { void selectProgram(program); }} />
        ) : (
          <>
            <header className="dg-panel-header">
              <div className="dg-panel-title">{tab === "search" || auxiliaryPanel === "programs" ? <button type="button" onClick={() => auxiliaryPanel === "programs" ? setAuxiliaryPanel(null) : changeTab("map")}>‹ 지도</button> : <><button type="button" className="dg-mobile-panel-back" onClick={() => changeTab("map")}>‹ 지도</button><Link className="dg-desktop-panel-back" href="/">‹ 소개</Link></>}<h1>{tab === "saved" ? "찜한 프로그램" : tab === "search" ? "찾기" : "지도 주변"}</h1></div>
              <form className="dg-search" onSubmit={submitSearch}>
                <span aria-hidden="true">⌕</span><input ref={searchInputRef} value={query} onChange={(event) => updateSearchQuery(event.target.value)} onKeyDown={submitSearchFromKeyboard} placeholder="시설명·강좌명 또는 자연어로 검색" aria-label="프로그램 검색" />
                {query && <button type="button" className="dg-clear" onClick={clearSearch} aria-label="검색어 지우기">×</button>}
                <button type="submit" className="dg-search-button">검색</button>
              </form>
              {tab !== "search" && <><div className="dg-location-row"><button type="button" onClick={moveToCurrentLocation}>● {centeredArea.split(" ").slice(-2).join(" ")}</button><span>{heatShelterMode ? `${heatShelters.length}곳` : `${visiblePrograms.length}곳`}</span></div>
              <div className="dg-filter-row">
                <ConditionFilterButton count={activeConditionCount} onClick={() => setShowFilter(true)} />
                <button type="button" className={heatShelterMode ? "active heat" : ""} onClick={toggleHeatShelterMode}>❄ 무더위쉼터</button>
                {WEB_DETAIL_FILTERS.filter((item) => item.featured || subjectFilters.includes(item.label)).map((item) => <button key={item.label} type="button" className={!heatShelterMode && subjectFilters.includes(item.label) ? "active" : ""} onClick={() => toggleMapDetail(item.label)}><img src={`/markers/${item.iconName}.png`} alt="" />{item.label}</button>)}
                <button type="button" className={freeOnly ? "active" : ""} onClick={toggleQuickFree}>무료</button>
                <button type="button" className={personaFilters.includes("시니어") ? "active" : ""} onClick={() => toggleMapPersona("시니어")}>👴 시니어</button>
                <button type="button" className={todayOnly ? "active" : ""} onClick={toggleQuickToday}>오늘 신청</button>
                <button type="button" className={statusFilter === "접수중" ? "active" : ""} onClick={toggleQuickOpenStatus}>접수중</button>
              </div>
              <div className="dg-sort-row">
                <button type="button" className={sort === "distance" ? "active" : ""} onClick={() => setSort("distance")}>가까운 순</button>
                <button type="button" className={sort === "available" ? "active" : ""} onClick={() => setSort("available")}>신청 가능 순</button>
                <button type="button" className={sort === "free" ? "active" : ""} onClick={() => setSort("free")}>무료 먼저</button>
              </div></>}
            </header>
            {tab === "search" ? <SearchExperience
              key={submittedQuery || "search-idle"}
              query={query}
              submittedQuery={submittedQuery}
              intent={searchIntent}
              suggestions={searchSuggestions}
              suggestionsLoading={searchSuggestionsLoading}
              suggestionError={searchSuggestionError}
              recentSearches={recentSearches}
              loading={loading}
              progress={searchProgress}
              cityScope={searchCityScope}
              warning={searchWarning}
              alternativeNotice={searchAlternativeNotice}
              assistant={searchAssistant}
              allResults={searchResults}
              visibleResults={visiblePrograms}
              categories={searchCategoryCounts}
              selectedCategory={searchResultCategory}
              sort={searchSort}
              origin={searchAssistant.kind === "placeFound" && searchAssistant.place.latitude !== null && searchAssistant.place.longitude !== null
                ? { latitude: searchAssistant.place.latitude, longitude: searchAssistant.place.longitude }
                : location}
              onChoose={chooseSearch}
              onClearRecent={() => { setRecentSearches([]); localStorage.removeItem("dongnegogo.web.recentSearches"); }}
              onSelectSuggestion={selectSearchSuggestion}
              onRetry={() => { void runSearch(query); }}
              onRemoveChip={removeIntentChip}
              onRelax={applyRelaxedIntent}
              onCategory={setSearchResultCategory}
              onSort={setSearchSort}
              onPlaceRadius={(place, radius) => { void runPlaceSearch(submittedQuery, place, radius); }}
              onDismissPlace={() => setSearchAssistant({ kind: "idle" })}
              onOpen={(program) => { void selectProgram(program); }}
            /> : <div className="dg-result-list">
              {loading && <div className="dg-loading"><img src="/web-assets/beodeuli-search-assistant.png" alt="" /><strong>{heatShelterMode ? "무더위쉼터를 불러오고 있어요" : "우리 동네 프로그램을 찾고 있어요"}</strong></div>}
              {!loading && error && <div className="dg-empty"><strong>{error}</strong><button type="button" onClick={() => mapRef.current && loadBounds(mapRef.current)}>다시 불러오기</button></div>}
              {!loading && !error && !heatShelterMode && visiblePrograms.length === 0 && <div className="dg-empty"><img src="/web-assets/beodeuli-search-success.png" alt="" /><strong>조건에 맞는 프로그램을 못 찾았어요.</strong><p>조건 하나만 넓혀 다시 찾아볼 수 있어요.</p></div>}
              {!loading && !heatShelterMode && visiblePrograms.slice(0, 160).map((program) => (
                <button className="dg-program-card" type="button" key={program.id} onClick={() => { void selectProgram(program); }}>
                  <img src={`/markers/${programIconName(program)}.png`} alt="" />
                  <span className="dg-card-copy"><span className={`dg-status ${statusClass(program)}`}>{program.status}</span><strong>{program.name}</strong><small>{distanceLabel(distanceMeters(center, program))} · {program.facility}</small><em>{program.isFree ? "무료" : program.feeText}</em></span>
                  <span className="dg-card-arrow" aria-hidden="true">›</span>
                </button>
              ))}
              {!loading && heatShelterMode && heatShelters.map((shelter) => <button className="dg-program-card" type="button" key={shelter.id} onClick={() => setSelectedHeatShelter(shelter)}><img src="/markers/icon_heat_shelter.png" alt="" /><span className="dg-card-copy"><span className="dg-status">운영 정보 확인</span><strong>{shelter.name}</strong><small>{distanceLabel(distanceMeters(center, shelter))} · {shelter.roadAddress ?? shelter.address ?? "주소 정보 없음"}</small><em>{shelter.airconCount ? `에어컨 ${shelter.airconCount}대` : "냉방 시설"}</em></span><span className="dg-card-arrow">›</span></button>)}
            </div>}
          </>
        )}
      </section>

      <section className="dg-map-area" aria-label="Kakao 지도" data-map-level={mapLevel} data-map-mode={mapMode} data-map-scope={mapScope}>
        <div ref={mapElementRef} className="dg-map-canvas" />
        {!mapReady && <div className="dg-map-skeleton"><img src="/brand/app-icon.png" alt="" /><strong>지도를 준비하고 있어요</strong></div>}
        <div className="dg-mobile-map-chrome">
          <div className="dg-mobile-map-header">
            <button type="button" className="dg-mobile-search-pill" onClick={() => changeTab("search")}><span>⌕</span><strong>{centeredArea.split(" ").at(-1) ?? "우리 동네"} 프로그램 찾기</strong><em><MapIcon aria-hidden="true" /></em></button>
            {WEB_ACCOUNT_FEATURES_VISIBLE && <button type="button" className={`dg-mobile-profile${session ? " signed-in" : ""}`} onClick={() => { setSeniorOnly(false); setPersonaFilters([]); changeTab("search"); }} aria-label={session ? "나를 위한 프로그램 찾기" : "로그인 전 나를 위한 프로그램 찾기"}><User aria-hidden="true" /></button>}
          </div>
          <div className="dg-mobile-map-filters" aria-label="지도 빠른 조건">
            <ConditionFilterButton count={activeConditionCount} onClick={() => setShowFilter(true)} />
            <button type="button" className={heatShelterMode ? "active heat" : ""} onClick={toggleHeatShelterMode}>❄ 무더위쉼터</button>
            {WEB_DETAIL_FILTERS.filter((item) => item.featured || subjectFilters.includes(item.label)).map((item) => <button key={item.label} type="button" className={!heatShelterMode && subjectFilters.includes(item.label) ? "active" : ""} onClick={() => toggleMapDetail(item.label)}><img src={`/markers/${item.iconName}.png`} alt="" />{item.label}</button>)}
            <button type="button" className={personaFilters.includes("시니어") ? "active" : ""} onClick={() => toggleMapPersona("시니어")}>👴 시니어</button>
            <button type="button" className={personaFilters.includes("어린이") ? "active" : ""} onClick={() => toggleMapPersona("어린이")}>🧒 어린이</button>
            <button type="button" className={freeOnly ? "active" : ""} onClick={toggleQuickFree}>🆓 무료</button>
          </div>
        </div>
        <div className="dg-map-tools" aria-label="지도 도구">
          <button type="button" onClick={moveToCurrentLocation}><span className="dg-map-tool-current"><UserRound aria-hidden="true" /></span>내 위치</button>
          <button type="button" onClick={openNearbyProgramCarousel}><span><MapIcon aria-hidden="true" /></span>주변</button>
          <button type="button" onClick={() => openMapTool("calendar")}><span><CalendarDays aria-hidden="true" /></span>일정</button>
          {WEB_ACCOUNT_FEATURES_VISIBLE && <button type="button" onClick={() => openMapTool("family")}><span><UsersRound aria-hidden="true" /></span>가족</button>}
          <button type="button" onClick={() => openMapTool("history")}><span><Archive aria-hidden="true" /></span>보관함</button>
          {WEB_ACCOUNT_FEATURES_VISIBLE && <>
            <button type="button" className="dg-mobile-map-account-tool" onClick={() => changeTab("openrun")}><span className="dg-map-tool-account-icon"><Bell aria-hidden="true" />{openRunBadge > 0 && <em className="dg-map-tool-badge">{openRunBadge > 9 ? "9+" : openRunBadge}</em>}</span>오픈런</button>
            <button type="button" className="dg-mobile-map-account-tool" onClick={() => changeTab("saved")}><span className="dg-map-tool-account-icon"><Heart aria-hidden="true" /></span>찜</button>
            <button type="button" className="dg-mobile-map-account-tool" onClick={() => changeTab("me")}><span className="dg-map-tool-account-icon"><User aria-hidden="true" /></span>내정보</button>
          </>}
        </div>
        <div className="dg-zoom-tools"><button type="button" aria-label="지도 확대" onClick={() => mapRef.current?.setLevel(Math.max(1, mapRef.current.getLevel() - 1))}>＋</button><button type="button" aria-label="지도 축소" onClick={() => mapRef.current?.setLevel(Math.min(14, mapRef.current.getLevel() + 1))}>−</button></div>
        <div className="dg-map-caption"><strong>{centeredArea} 주변</strong><span>지도를 움직이면 자동으로 다시 찾아요</span></div>
        {!selected && !placeSheet && (mapProgramCarouselSource === "nearby"
          || (activeConditionCount > 0 && filteredClusterCarouselSignature === currentFilterSelectionSignature))
          && filteredClusterCarouselPrograms.length > 0 && <FilteredClusterProgramCarousel
          key={mapProgramCarouselSource === "nearby" ? "nearby-single" : "condition-list"}
          title={mapProgramCarouselSource === "nearby" ? "주변 프로그램" : "조건 프로그램"}
          singleCardMode={mapProgramCarouselSource === "nearby"}
          programs={filteredClusterCarouselPrograms}
          origin={location}
          focusedProgramID={filteredClusterFocusedProgramID}
          onFocus={focusFilteredClusterProgram}
          onOpen={(program) => { void selectProgram(program); }}
          onClose={() => {
            filteredClusterCarouselAnchorRef.current = null;
            filteredClusterCarouselSignatureRef.current = null;
            filteredClusterCarouselProgramsRef.current = [];
            setFilteredClusterCarouselSignature(null);
            setFilteredClusterCarouselPrograms([]);
            setFilteredClusterFocusedProgramID(null);
            setMapProgramCarouselSource(null);
          }}
        />}
        {placeSheet && <ProgramPlaceSheet
          state={placeSheet}
          current={location}
          accountFeaturesVisible={WEB_ACCOUNT_FEATURES_VISIBLE}
          onClose={() => setPlaceSheet(null)}
          onIndex={(index) => setPlaceSheet((current) => current ? { ...current, index } : current)}
          onDetail={(program) => { void selectProgram(program); }}
          onReminder={(program) => toggleReminder(program.id)}
          reminderIDs={reminders}
        />}
      </section>
      {selected && !routePanelActive && routeSheetCollapsed && <button
        type="button"
        className="dg-route-restore-bar"
        onClick={() => setRouteSheetCollapsed(false)}
        aria-label={`${selected.facility} 목적지까지 가는 길 다시 열기`}
      ><span aria-hidden="true" /><strong>목적지까지 가는 길</strong><em aria-hidden="true">⌃</em></button>}
      {selected && routePanelActive && routePanelSnap === "hidden" && <button
        type="button"
        className="dg-route-restore-bar"
        onClick={() => setRoutePanelSnap("collapsed")}
        aria-label={`${selected.facility} 목적지까지 가는 길 패널 다시 열기`}
      ><span aria-hidden="true" /><strong>{routePanelMode === "nearby" ? "도착지 주변 가게" : "목적지까지 가는 길"}</strong><ChevronUp aria-hidden="true" size={17} /></button>}
      {showFilter && <FullFilterDialog
        personas={personaFilters} subjects={subjectFilters} status={statusFilter}
        freeOnly={freeOnly} paidOnly={paidOnly} radiusKm={radiusKm} count={visiblePrograms.length}
        onPersonas={setPersonaFilters} onSubjects={setSubjectFilters}
        onStatus={setStatusFilter} onFree={(value) => { setFreeOnly(value); if (value) setPaidOnly(false); }}
        onPaid={(value) => { setPaidOnly(value); if (value) setFreeOnly(false); }} onRadius={(value) => { setRadiusKm(value); if (value !== null && usesFallbackLocation) moveToCurrentLocation(); }}
        onReset={resetFilters} onApply={() => { setLoading(true); setShowFilter(false); setFilterFitRequestId((current) => current + 1); }} onClose={() => setShowFilter(false)}
      />}
      {WEB_ACCOUNT_FEATURES_VISIBLE && alertDialog && <AlertScheduleDialog
        state={alertDialog}
        saved={reminders.includes(alertDialog.program.id)}
        onChange={(scheduledAt) => setAlertDialog((current) => current ? { ...current, scheduledAt } : current)}
        onSave={() => { void saveAlert(); }}
        onRemove={() => { void removeAlert(); }}
        onClose={() => setAlertDialog(null)}
      />}
      {WEB_ACCOUNT_FEATURES_VISIBLE && showAuthDialog && !session && <WebAuthDialog
        consentAccepted={authConsentAccepted}
        loading={authLoading}
        onAccept={acceptAccountConsent}
        onBrowse={() => setShowAuthDialog(false)}
        onProvider={(provider) => { void startAccountSignIn(provider); }}
        onClose={() => setShowAuthDialog(false)}
      />}
      {WEB_ACCOUNT_FEATURES_VISIBLE && accountError && tab !== "me" && <button type="button" className="dg-sync-toast" onClick={() => setAccountError("")} aria-label="동기화 안내 닫기">{accountError} ×</button>}
    </main>
  );
}

function SearchExperience({
  query, submittedQuery, intent, suggestions, suggestionsLoading, suggestionError, recentSearches,
  loading, progress, cityScope, warning, alternativeNotice, assistant, allResults, visibleResults,
  categories, selectedCategory, sort, origin, onChoose, onClearRecent, onSelectSuggestion, onRetry,
  onRemoveChip, onRelax, onCategory, onSort, onPlaceRadius, onDismissPlace, onOpen,
}: {
  query: string;
  submittedQuery: string;
  intent: SearchIntent | null;
  suggestions: WebPlaceSuggestion[];
  suggestionsLoading: boolean;
  suggestionError: string;
  recentSearches: string[];
  loading: boolean;
  progress: number;
  cityScope: SearchCityScope;
  warning: string;
  alternativeNotice: string;
  assistant: SearchAssistantState;
  allResults: WebProgram[];
  visibleResults: WebProgram[];
  categories: SearchResultCategory[];
  selectedCategory: string | null;
  sort: SearchSort;
  origin: Coordinate;
  onChoose: (term: string, preferredProgramID?: string) => void;
  onClearRecent: () => void;
  onSelectSuggestion: (suggestion: WebPlaceSuggestion) => void;
  onRetry: () => void;
  onRemoveChip: (chip: string) => void;
  onRelax: (intent: SearchIntent, notice: string) => void;
  onCategory: (category: string | null) => void;
  onSort: (sort: SearchSort) => void;
  onPlaceRadius: (place: WebPlaceSuggestion, radius: number) => void;
  onDismissPlace: () => void;
  onOpen: (program: WebProgram) => void;
}) {
  const trimmed = query.trim();
  const active = Boolean(intent && submittedQuery);
  const relaxations = intent ? relaxedSuggestions(intent) : [];
  const managedRadius = assistant.kind === "placeOffer" || assistant.kind === "placeSearching"
    || assistant.kind === "placeFound" || assistant.kind === "placeExpand";
  const displayedProgress = useSmoothSearchProgress(progress, loading);

  if (!active) {
    return <div className="dg-search-idle-panel">
      {trimmed ? <>
        {suggestions.length > 0 && <section className="dg-search-place-suggestions">
          <header><span>▥</span><strong>지역으로 지도 이동</strong></header>
          <p>시·군·구 또는 통합된 읍·면·동 단위로 프로그램 수를 모아 보여드려요.</p>
          <div>{suggestions.map((suggestion) => <button type="button" key={`${suggestion.placeKind}:${suggestion.displayName}`} onClick={() => onSelectSuggestion(suggestion)}>
            <span aria-hidden="true">⌖</span><span><strong>{suggestion.displayName}</strong><small>{suggestion.placeKind === "administrative" ? "행정구역 군집" : suggestion.placeKind === "facility" ? "시설 중심" : "장소 중심"} · 프로그램 {suggestion.programCount.toLocaleString("ko-KR")}개</small></span><em>›</em>
          </button>)}</div>
        </section>}
        {suggestionsLoading && <p className="dg-search-inline-progress"><span /><strong>{suggestions.length ? "추가 지역·장소 이름을 확인하고 있어요" : "입력한 지역·장소의 정확한 행정명을 확인하고 있어요"}</strong></p>}
        {suggestionError && <p className="dg-search-error" role="alert"><span>!</span>{suggestionError}</p>}
        {!suggestionsLoading && !suggestions.length && !suggestionError && <p className="dg-search-submit-hint">검색 키를 누르면 프로그램명·시설명·자연어 조건으로 찾아요.</p>}
      </> : <>
        {recentSearches.length > 0 && <section className="dg-search-idle-section"><header><strong>최근 검색</strong><button type="button" onClick={onClearRecent}>전체 삭제</button></header><div>{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => onChoose(recent)}>◷ {recent}</button>)}</div></section>}
        <section className="dg-search-idle-section"><header><strong>이렇게 검색해보세요</strong></header><div>{SEARCH_EXAMPLES.map((example, index) => <button key={example} type="button" onClick={() => onChoose(example)}>{SEARCH_EXAMPLE_ICONS[index]} {example}</button>)}</div></section>
      </>}
    </div>;
  }

  const assistantCard = (() => {
    if (assistant.kind === "idle") return null;
    if (assistant.kind === "alternativeFound") return <section className="dg-search-assistant-card">
      <img src="/web-assets/beodeuli-search-success.png" alt="" /><small>원하시는 결과를 찾았어요</small><strong>{assistant.message} 관련 프로그램 {assistant.count.toLocaleString("ko-KR")}곳을 아래에 정리했어요.</strong>
    </section>;
    if (assistant.kind === "titleSuggestion") return <section className="dg-search-assistant-stack"><div className="dg-search-assistant-card">
      <img src="/web-assets/beodeuli-search-assistant.png" alt="" /><small>다른 지역의 정확한 제목을 찾았어요</small><strong>혹시 {assistant.regionName}에 위치한 ‘{assistant.programName}’ 프로그램을 찾고 계실까요?</strong>
    </div><button type="button" className="dg-search-primary-action" onClick={() => onChoose(assistant.suggestedQuery, assistant.programID)}>▥ 네, {assistant.regionName} 전역에서 찾아볼게요</button></section>;
    if (assistant.kind === "placeOffer") return <section className="dg-search-assistant-stack"><div className="dg-search-assistant-card">
      <img src="/web-assets/beodeuli-search-assistant.png" alt="" /><small>원하시는 장소를 이해했어요</small><strong>‘{submittedQuery}’는 {assistant.place.displayName} 주변을 찾으시는 뜻으로 이해했어요. 제목에 장소명이 없어도 실제 위치를 기준으로 찾아드릴게요.</strong>
    </div><button type="button" className="dg-search-primary-action" onClick={() => onPlaceRadius(assistant.place, assistant.radiusKm)}>⌖ {searchRadiusLabel(assistant.radiusKm)} 주변 프로그램 찾아보기</button><button type="button" className="dg-search-secondary-action" onClick={onDismissPlace}>일반 검색 결과만 볼게요</button></section>;
    if (assistant.kind === "placeSearching") return <section className="dg-search-assistant-stack"><div className="dg-search-assistant-card">
      <img src="/web-assets/beodeuli-search-delivering.png" alt="" /><small>버들이가 꼼꼼히 살펴보는 중</small><strong>{assistant.place.displayName} {searchRadiusLabel(assistant.radiusKm)} 안에서 진행되는 프로그램을 찾아서 곧 전달해 드릴게요.</strong>
    </div><p className="dg-search-inline-progress"><span /><strong>프로그램 위치와 조건을 함께 확인하고 있어요</strong></p></section>;
    if (assistant.kind === "placeExpand") return <section className="dg-search-assistant-stack"><div className="dg-search-assistant-card">
      <img src="/web-assets/beodeuli-search-assistant.png" alt="" /><small>{assistant.remoteSucceeded ? "조금 더 넓게 찾아볼까요?" : "연결이 잠시 불안정해요"}</small><strong>{assistant.remoteSucceeded
        ? `${assistant.place.displayName} ${searchRadiusLabel(assistant.currentRadiusKm)} 안에서는 맞는 프로그램을 찾지 못했어요. ${searchRadiusLabel(assistant.nextRadiusKm)}까지 반경을 넓혀드릴까요?`
        : `새 프로그램을 불러오지 못했어요. 다시 연결해서 ${searchRadiusLabel(assistant.nextRadiusKm)}까지 찾아볼 수 있어요.`}</strong>
    </div><button type="button" className="dg-search-primary-action" onClick={() => onPlaceRadius(assistant.place, assistant.nextRadiusKm)}>⌖ 네, {searchRadiusLabel(assistant.nextRadiusKm)}까지 찾아주세요</button><button type="button" className="dg-search-secondary-action" onClick={onDismissPlace}>여기서 그만 찾을게요</button></section>;
    return <section className="dg-search-assistant-stack"><div className="dg-search-assistant-card">
      <img src="/web-assets/beodeuli-search-success.png" alt="" /><small>원하시는 결과를 찾았어요</small><strong>{assistant.place.displayName} <em>{searchRadiusLabel(assistant.radiusKm)}</em> 안에서 <em>{Math.min(assistant.count, 300).toLocaleString("ko-KR")}곳</em>{assistant.count >= 300 ? "을 먼저 찾았어요. 거리순으로 차례로 보여드릴게요." : "을 찾았어요. 가까운 프로그램부터 차례로 보여드릴게요."}</strong>
    </div><section className="dg-search-radius-card"><header><span>⌖</span><span><strong>검색 반경 조절</strong><small>원하는 거리를 누르면 같은 장소에서 바로 다시 찾아요</small></span><em>{searchRadiusLabel(assistant.radiusKm)} 이내</em></header><div>{SEARCH_PLACE_RADIUS_OPTIONS.map((radius) => <button type="button" key={radius} className={radius === assistant.radiusKm ? "active" : ""} onClick={() => radius !== assistant.radiusKm && onPlaceRadius(assistant.place, radius)}>{radius === assistant.radiusKm && "✓ "}{searchRadiusLabel(radius)}</button>)}</div></section></section>;
  })();

  return <div className="dg-search-results-panel">
    {assistantCard}
    {warning && <p className="dg-search-warning" role="status"><span>!</span><strong>{warning}</strong><button type="button" onClick={onRetry}>다시 검색</button></p>}
    {alternativeNotice && assistant.kind !== "alternativeFound" && <p className="dg-search-alternative-notice">✓ {alternativeNotice}</p>}
    <section className="dg-search-result-header">
      <div><strong><em>{cityScope.displayName}</em> 지역 기준으로 {loading ? "먼저 찾고 있어요." : <><b>{visibleResults.length.toLocaleString("ko-KR")}곳</b>을 찾았어요.</>}</strong>{loading && <span>{displayedProgress}%</span>}</div>
      {loading && <progress max="100" value={displayedProgress} aria-label="검색 진행률" aria-valuetext={`${displayedProgress}퍼센트`} />}
      {!loading && <p>다른 지역 검색을 원하시면,<br />검색창에 찾고자 하시는 지역명을 함께 입력해주세요.</p>}
    </section>
    {(intent!.chips.length > 0 || (!loading && !allResults.length && relaxations.length > 0)) && <section className="dg-search-intent-card">
      {!loading && !allResults.length && relaxations.length > 0 && <header><img src="/web-assets/beodeuli-search-assistant.png" alt="" /><strong>버들이의 다른 제안</strong></header>}
      <p>찾으시는 결과가 없으시면, 아래 키워드를 삭제하셔서 검색 조건을 조정해 주세요.</p>
      {intent!.chips.length > 0 && <div className="dg-intent-chips" aria-label="검색 조건">{intent!.chips.map((chip) => managedRadius && (chip === "근처" || /(?:km|m) 이내$/.test(chip))
        ? <span key={chip}>✓ {chip}</span>
        : <button key={chip} type="button" onClick={() => onRemoveChip(chip)} aria-label={`${chip} 조건 삭제`}>{chip}<i>×</i></button>)}</div>}
      {!loading && !allResults.length && relaxations.length > 0 && <div className="dg-search-alternatives">{relaxations.map((item) => <article key={item.label}><p>{item.message}</p><button type="button" onClick={() => onRelax(item.intent, item.appliedNotice)}>⊕ {item.label}<span>→</span></button></article>)}</div>}
    </section>}
    {allResults.length > 0 && <section className="dg-search-filter-card"><div><small>프로그램 분류</small><div><button type="button" className={selectedCategory === null ? "active" : ""} onClick={() => onCategory(null)}>✨ 전체 <b>{allResults.length}</b></button>{categories.map((category) => <button type="button" key={category.id} className={selectedCategory === category.id ? "active" : ""} onClick={() => onCategory(category.id)}>{category.emoji} {category.label} <b>{category.count}</b></button>)}</div></div><hr /><div className="dg-search-sort-row">{([[
      "relevance", "관련도 순"], ["distance", "가까운 순"], ["available", "신청 가능한 순"], ["free", "무료 먼저"]] as Array<[SearchSort, string]>).map(([value, label]) => <button type="button" key={value} className={sort === value ? "active" : ""} onClick={() => onSort(value)}>{label}</button>)}</div></section>}
    {!loading && !allResults.length && assistant.kind === "idle" && !relaxations.length && <div className="dg-search-empty-state"><div className="dg-search-assistant-card"><img src="/web-assets/beodeuli-search-assistant.png" alt="" /><small>버들이가 함께 찾아볼게요</small><strong>‘{submittedQuery}’에 꼭 맞는 결과가 아직 없어요. 표현이나 조건을 한 가지만 바꾸면 더 잘 찾을 수 있어요.</strong></div><section><strong>이렇게 바꿔보세요</strong><p>💡 더 짧게: ‘{parseSearchIntent(submittedQuery).generalTerms[0] ?? submittedQuery}’</p><p>💡 시설명으로: ‘정릉복지관’, ‘성북구민수영장’</p><p>💡 분야로: ‘수영’, ‘요가’, ‘스마트폰’</p></section></div>}
    <div className="dg-search-program-list">{visibleResults.slice(0, 300).map((program) => <button className="dg-program-card" type="button" key={program.id} onClick={() => onOpen(program)}><img src={`/markers/${programIconName(program)}.png`} alt="" /><span className="dg-card-copy"><span className={`dg-status ${statusClass(program)}`}>{program.isFree ? "무료" : program.status}</span><strong>{program.name}</strong><small>{distanceLabel(distanceMeters(origin, program))} · {program.facility}</small><em>{program.scheduleText ?? program.periodText ?? (program.isFree ? "무료" : program.feeText)}</em></span><span className="dg-card-arrow" aria-hidden="true">›</span></button>)}</div>
  </div>;
}

function Preference({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="dg-preference"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function WebAuthDialog({ consentAccepted, loading, onAccept, onBrowse, onProvider, onClose }: {
  consentAccepted: boolean;
  loading: boolean;
  onAccept: () => void;
  onBrowse: () => void;
  onProvider: (provider: "apple" | "google" | "kakao") => void;
  onClose: () => void;
}) {
  return <div className="dg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dg-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="dg-auth-title">
      <header><div><small>동네고고 계정</small><h2 id="dg-auth-title">{consentAccepted ? "로그인" : "로그인 이용 확인"}</h2></div><button type="button" onClick={onClose} aria-label="로그인 창 닫기">×</button></header>
      {consentAccepted ? <>
        <p>앱과 같은 계정으로 로그인하면 찜, 알림, 후기, 보관함, 가족 정보를 안전하게 이어서 볼 수 있어요.</p>
        <div className="dg-login-buttons" aria-label="로그인 방식 선택">
          <button type="button" disabled={loading} onClick={() => onProvider("kakao")}><i aria-hidden="true">K</i>카카오로 로그인</button>
          <button type="button" disabled={loading} onClick={() => onProvider("apple")}><i aria-hidden="true">●</i>Apple로 로그인</button>
          <button type="button" disabled={loading} onClick={() => onProvider("google")}><i aria-hidden="true">G</i>Google로 로그인</button>
        </div>
        <span className="dg-auth-policy">보안을 위해 가장 최근에 로그인한 기기·브라우저의 세션이 유지될 수 있습니다.</span>
      </> : <>
        <p>만 14세 이상이며, 이용약관과 개인정보처리방침을 확인하고 동의한 경우에만 로그인해 주세요.</p>
        <nav className="dg-auth-legal" aria-label="로그인 관련 정책"><Link href="/terms" target="_blank">이용약관</Link><Link href="/privacy" target="_blank">개인정보처리방침</Link></nav>
        <div className="dg-auth-consent-actions"><button type="button" onClick={onBrowse}>로그인 없이 둘러보기</button><button type="button" className="primary" onClick={onAccept}>동의하고 계속</button></div>
      </>}
    </section>
  </div>;
}

function RouteInfoPanel({ program, current, usesFallbackLocation, locationRequestState, locationRequestMessage, transport, route, mode, snap, nearbySummary, nearbyLoading, nearbyRadius, nearbyCategory, selectedNearbyPlace, nearbyWalkingRoute, onToggleSnap, onBack, onClose, onMode, onTransport, onRouteChange, onRequestLocation, onRadius, onCategory, onSelectNearby, onShowNearbyOnMap }: {
  program: WebProgram;
  current: Coordinate;
  usesFallbackLocation: boolean;
  locationRequestState: LocationRequestState;
  locationRequestMessage: string;
  transport: Transport;
  route: WebRouteResult | null;
  mode: RoutePanelMode;
  snap: RoutePanelSnap;
  nearbySummary: WebNearbyPlacesSummary | null;
  nearbyLoading: boolean;
  nearbyRadius: number;
  nearbyCategory: NearbyCategory;
  selectedNearbyPlace: WebNearbyPlace | null;
  nearbyWalkingRoute: WebRouteResult | null;
  onToggleSnap: () => void;
  onBack: () => void;
  onClose: () => void;
  onMode: (mode: RoutePanelMode) => void;
  onTransport: (transport: Transport) => void;
  onRouteChange: (route: WebRouteResult | null) => void;
  onRequestLocation: () => void;
  onRadius: (radius: number) => void;
  onCategory: (category: NearbyCategory) => void;
  onSelectNearby: (place: WebNearbyPlace) => void;
  onShowNearbyOnMap: (place: WebNearbyPlace) => void;
}) {
  const routeEstimate = estimatedRoute(distanceMeters(current, program), transport);
  const [routeState, setRouteState] = useState<"waiting" | "loading" | "loaded" | "unavailable">(
    usesFallbackLocation ? "waiting" : route?.mode === ROUTE_MODE[transport] ? "loaded" : "loading",
  );
  const [routeError, setRouteError] = useState("");
  const [nearbyPreviewCount, setNearbyPreviewCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const expectedMode = ROUTE_MODE[transport];
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      if (usesFallbackLocation) {
        setRouteState("waiting");
        return;
      }
      if (route?.mode === expectedMode) {
        setRouteState("loaded");
        setRouteError("");
        return;
      }
      setRouteState("loading");
      setRouteError("");
      onRouteChange(null);
      const response = await fetch("/api/web-route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: expectedMode,
          origin: current,
          destination: { latitude: program.latitude, longitude: program.longitude },
          destinationName: program.facility,
        }),
        signal: controller.signal,
      });
      const payload = await response.json() as WebRouteResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "실제 경로를 불러오지 못했어요.");
      setRouteState("loaded");
      onRouteChange(payload);
    }).catch((loadError) => {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setRouteState("unavailable");
      setRouteError(loadError instanceof Error ? loadError.message : "실제 경로를 불러오지 못했어요.");
    });
    return () => controller.abort();
  }, [current, onRouteChange, program.facility, program.latitude, program.longitude, route?.mode, transport, usesFallbackLocation]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ latitude: String(program.latitude), longitude: String(program.longitude), radiusMeters: "1000" });
    void fetch(`/api/web-nearby-places?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as WebNearbyPlacesSummary;
        if (response.ok) setNearbyPreviewCount(payload.totalCount);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [program.id, program.latitude, program.longitude]);

  const nearbyCount = mode === "nearby" ? nearbySummary?.totalCount ?? 0 : nearbyPreviewCount;
  return <article className="dg-main-route-panel">
    <button type="button" className="dg-main-route-grabber" onClick={onToggleSnap} aria-label={snap === "expanded" ? "경로 패널 접기" : "경로 패널 펼치기"}><span aria-hidden="true" /></button>
    <header className="dg-main-route-header">
      <button type="button" className="dg-main-route-title" onClick={onToggleSnap}>
        <strong>{mode === "nearby" ? "도착지 주변 둘러보기" : "목적지까지 가는 길"}</strong>
        <span>{program.facility}</span>
      </button>
      <div>
        <button type="button" onClick={onBack} aria-label="프로그램 자세히 보기로 돌아가기"><Undo2 aria-hidden="true" /></button>
        <button type="button" onClick={onClose} aria-label="경로 안내 닫기"><X aria-hidden="true" /></button>
      </div>
    </header>
    <div className="dg-main-route-mode" aria-label="목적지 정보 선택">
      <button type="button" className={mode === "route" ? "active" : ""} onClick={() => onMode("route")} aria-pressed={mode === "route"}><PersonStanding aria-hidden="true" />가는 길</button>
      <button type="button" className={mode === "nearby" ? "active" : ""} onClick={() => onMode("nearby")} aria-pressed={mode === "nearby"}><Coffee aria-hidden="true" />주변 가게 {nearbyCount === null ? "…" : nearbyCount}</button>
    </div>
    <div className="dg-main-route-scroll">
      {mode === "route" ? <div className="dg-main-route-content">
        <div className="dg-transport-tabs" aria-label="이동 수단 선택">
          <button type="button" className={transport === "walk" ? "active" : ""} onClick={() => onTransport("walk")} aria-pressed={transport === "walk"}><PersonStanding aria-hidden="true" />도보</button>
          <button type="button" className={transport === "transit" ? "active" : ""} onClick={() => onTransport("transit")} aria-pressed={transport === "transit"}><TramFront aria-hidden="true" />대중교통</button>
          <button type="button" className={transport === "car" ? "active" : ""} onClick={() => onTransport("car")} aria-pressed={transport === "car"}><CarFront aria-hidden="true" />자동차</button>
        </div>
        {usesFallbackLocation && <div className="dg-location-guide" data-state={locationRequestState} role="status" aria-live="polite"><strong>현재 위치를 확인하면 실제 경로를 보여드려요</strong><p>{locationRequestMessage || "위치 권한을 허용하면 현재 위치 마커와 도보·대중교통·자동차 경로가 자동으로 표시됩니다."}</p><button type="button" onClick={onRequestLocation} disabled={locationRequestState === "checking"}>{locationRequestState === "checking" ? "현재 위치 확인 중…" : "현재 위치 사용하기"}</button></div>}
        <RouteJourneyDetails program={program} transport={transport} route={route} routeState={routeState} routeError={routeError} estimate={routeEstimate} usesFallbackLocation={usesFallbackLocation} />
        <div className="dg-route-card-divider" />
        <div className="dg-map-link-group"><strong>지도에서 더 자세히 보기</strong>
          <a className="dg-map-link-card" href={route?.landingURL || routeLink(program, current, transport)} target="_blank" rel="noreferrer"><span className="dg-map-brand-icon kakao" aria-hidden="true" /><span><b>카카오 지도</b><small>카카오맵에서 시설 위치를 확인해요</small></span><em aria-hidden="true">↗</em></a>
          <a className="dg-map-link-card" href={naverMapLink(program)} target="_blank" rel="noreferrer"><span className="dg-map-brand-icon naver" aria-hidden="true" /><span><b>네이버 지도</b><small>시설명과 실제 좌표가 일치하는 위치를 열어요</small></span><em aria-hidden="true">↗</em></a>
          <a className="dg-map-link-card" href={googleMapLink(program)} target="_blank" rel="noreferrer"><span className="dg-map-brand-icon google" aria-hidden="true" /><span><b>Google 지도</b><small>Google 지도에서 시설 위치를 확인해요</small></span><em aria-hidden="true">↗</em></a>
        </div>
      </div> : <NearbyPlacesPanel
        embedded
        program={program}
        summary={nearbySummary}
        loading={nearbyLoading}
        radius={nearbyRadius}
        category={nearbyCategory}
        selected={selectedNearbyPlace}
        walkingRoute={nearbyWalkingRoute}
        onBack={() => onMode("route")}
        onRadius={onRadius}
        onCategory={onCategory}
        onSelect={onSelectNearby}
        onShowOnMap={onShowNearbyOnMap}
      />}
    </div>
  </article>;
}

function ProgramDetail({ program, current, usesFallbackLocation, locationRequestState, locationRequestMessage, accountFeaturesVisible, favorite, favoriteTargets, familyMembers, reminder, transport, easyFirst, session, mapReady, onBack, onFavorite, onFavoriteTarget, onReminder, onTransport, onRouteChange, onRequestLocation, onShowRouteOnMap, onShare, onNearby, onRequireAuth }: {
  program: WebProgram; current: Coordinate; usesFallbackLocation: boolean; accountFeaturesVisible: boolean; favorite: boolean; favoriteTargets: string[]; familyMembers: WebFamilyMember[]; reminder: boolean; transport: Transport; easyFirst: boolean;
  session: Session | null;
  mapReady: boolean;
  locationRequestState: LocationRequestState; locationRequestMessage: string;
  onBack: () => void; onFavorite: () => void; onFavoriteTarget: (target: string) => void; onReminder: () => void; onTransport: (value: Transport) => void; onRouteChange: (route: WebRouteResult | null) => void; onRequestLocation: () => void; onShowRouteOnMap: () => void; onShare: () => void; onNearby: () => void; onRequireAuth: () => void;
}) {
  const distance = distanceMeters(current, program);
  const routeEstimate = estimatedRoute(distance, transport);
  const officialAccess = officialProgramAccess(program.applyUrl);
  const [route, setRoute] = useState<WebRouteResult | null>(null);
  const [routeState, setRouteState] = useState<"waiting" | "loading" | "loaded" | "unavailable">(usesFallbackLocation ? "waiting" : "loading");
  const [routeError, setRouteError] = useState("");
  const [showRoadview, setShowRoadview] = useState(false);
  const targetOptions = [
    { id: "personal", label: "나" },
    ...familyMembers.map((member) => ({
      id: member.role === "어머니" ? "parent:mother" : member.role === "아버지" ? "parent:father" : member.role === "아이" ? `child:${member.name ?? "아이"}` : "personal",
      label: member.name || member.role,
    })),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setRoute(null);
      setRouteError("");
      onRouteChange(null);
      if (usesFallbackLocation) {
        setRouteState("waiting");
        return;
      }
      setRouteState("loading");
      const response = await fetch("/api/web-route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: ROUTE_MODE[transport],
          origin: current,
          destination: { latitude: program.latitude, longitude: program.longitude },
          destinationName: program.facility,
        }),
        signal: controller.signal,
      });
      const payload = await response.json() as WebRouteResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "실제 경로를 불러오지 못했어요.");
      setRoute(payload);
      setRouteState("loaded");
      onRouteChange(payload);
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setRouteState("unavailable");
      setRouteError(error instanceof Error ? error.message : "실제 경로를 불러오지 못했어요.");
    });
    return () => controller.abort();
  }, [current, onRouteChange, program.facility, program.id, program.latitude, program.longitude, transport, usesFallbackLocation]);

  const timeMetric = usesFallbackLocation ? "—" : route ? travelDuration(route.totalMinutes) : routeState === "loading" ? "계산 중" : travelDuration(routeEstimate.minutes);
  const distanceMetric = usesFallbackLocation ? "—" : route ? distanceLabel(route.totalDistanceMeters) : distanceLabel(routeEstimate.distance);
  const distanceMetricLabel = route ? "이동 거리" : "예상 이동 거리";
  return (
    <article className="dg-detail">
      <header className="dg-detail-hero">
        <div className="dg-detail-actions">
          <button type="button" onClick={onBack} aria-label="목록으로 돌아가기"><span className="dg-ios-back-icon" aria-hidden="true">‹</span></button>
          <span />
          {accountFeaturesVisible && <button type="button" className={`dg-ios-action-button favorite${favorite ? " active" : ""}`} onClick={onFavorite} aria-label={favorite ? "찜 해제" : "찜하기"}><span className="dg-ios-heart-icon" aria-hidden="true">{favorite ? "♥" : "♡"}</span></button>}
          <button type="button" className="dg-ios-action-button share" onClick={onShare} aria-label="공유하기"><Share className="dg-ios-share-icon" aria-hidden="true" strokeWidth={2.4} /></button>
          <a className="dg-ios-action-button map" href={mapLink(program)} target="_blank" rel="noreferrer" aria-label="Kakao 지도에서 보기"><span className="dg-ios-map-icon" aria-hidden="true"><i /><i /><i /></span></a>
        </div>
        <div className="dg-detail-badges"><span>{program.status}</span>{program.applyUrl && <span>✓ 신청 링크 확인됨</span>}</div>
        <h1>{program.name}</h1><p>▥ {program.facility}</p>
      </header>
      <div className="dg-detail-scroll">
        <ProgramPoster program={program} />
        {easyFirst && <ProgramSummary program={program} />}
        <section><h2>프로그램 정보</h2><dl className="dg-info-list"><div><dt>♙</dt><dd><small>누가 신청할 수 있나요?</small><strong>{program.requirement ?? (program.audiences.join(" · ") || "신청 페이지에서 확인")}</strong></dd></div><div><dt>◷</dt><dd><small>언제 하나요?</small><strong>{program.periodText ?? program.scheduleText ?? "일정은 신청 페이지에서 확인"}</strong>{program.scheduleText && <span>{program.scheduleText}</span>}</dd></div><div><dt>⌖</dt><dd><small>어디서 하나요?</small><strong>{program.facility}{program.room ? ` · ${program.room}` : ""}</strong><span>{program.address ?? program.area}</span></dd></div><div><dt>₩</dt><dd><small>비용과 준비물</small><strong>{program.isFree ? "무료" : program.feeText}</strong>{program.preparation && <span>{program.preparation}</span>}</dd></div></dl></section>
        {!easyFirst && <ProgramSummary program={program} />}
        <ProgramParkingSection key={program.id} program={program} />
        {accountFeaturesVisible && favorite && <section className="dg-favorite-targets"><h2>누구의 찜으로 저장할까요?</h2><div>{targetOptions.map((target) => <button type="button" key={target.id} className={favoriteTargets.includes(target.id) ? "active" : ""} onClick={() => onFavoriteTarget(target.id)}>{target.label}{favoriteTargets.includes(target.id) ? " ✓" : ""}</button>)}</div></section>}
        <section>
          <h2>거리정보</h2>
          <div className="dg-distance-card">
            <div className="dg-route-summary-title"><TravelModeIcon transport={transport} size={16} /><strong>추천 경로</strong></div>
            <div className="dg-route-metrics">
              <div><strong>{timeMetric}</strong><span>예상 시간</span></div>
              <div><strong>{distanceMetric}</strong><span>{distanceMetricLabel}</span></div>
            </div>
            <div className="dg-route-card-divider" />
            {usesFallbackLocation && <div className="dg-location-guide" data-state={locationRequestState} role="status" aria-live="polite"><strong>현재 위치를 확인하면 실제 경로를 보여드려요</strong><p>{locationRequestMessage || "위치 권한을 허용하면 현재 위치 마커와 도보·대중교통·자동차 경로가 자동으로 표시됩니다."}</p><button type="button" onClick={onRequestLocation} disabled={locationRequestState === "checking"}>{locationRequestState === "checking" ? "현재 위치 확인 중…" : locationRequestState === "denied" || locationRequestState === "timeout" || locationRequestState === "unavailable" ? "현재 위치 다시 시도" : "현재 위치 사용하기"}</button></div>}
            <p className="dg-route-map-guide"><span aria-hidden="true">☝</span> 아래 지도 영역을 선택하면 메인 지도에서 <strong>경로</strong>+<strong>장소 사진</strong>을 볼 수 있어요</p>
            <KakaoRoutePreview
              origin={current}
              destination={program}
              route={route}
              routeState={routeState}
              transport={transport}
              usesFallbackLocation={usesFallbackLocation}
              mapReady={mapReady}
              onOpen={onShowRouteOnMap}
            />
            <div className="dg-transport-tabs" aria-label="이동 수단 선택"><button type="button" className={transport === "walk" ? "active" : ""} onClick={() => onTransport("walk")} aria-pressed={transport === "walk"}><PersonStanding aria-hidden="true" />도보</button><button type="button" className={transport === "transit" ? "active" : ""} onClick={() => onTransport("transit")} aria-pressed={transport === "transit"}><TramFront aria-hidden="true" />대중교통</button><button type="button" className={transport === "car" ? "active" : ""} onClick={() => onTransport("car")} aria-pressed={transport === "car"}><CarFront aria-hidden="true" />자동차</button></div>
            <RouteJourneyDetails
              program={program}
              transport={transport}
              route={route}
              routeState={routeState}
              routeError={routeError}
              estimate={routeEstimate}
              usesFallbackLocation={usesFallbackLocation}
            />
            <div className="dg-route-card-divider" />
            <div className="dg-map-link-group"><strong>지도에서 더 자세히 보기</strong>
              <button className="dg-map-link-card" type="button" onClick={() => setShowRoadview((value) => !value)}><span className="dg-map-link-icon dg-roadview-icon" aria-hidden="true">◉</span><span><b>{showRoadview ? "시설 거리뷰 닫기" : "시설 거리뷰 보기"}</b><small>카카오 거리뷰에서 시설 주변을 직접 확인해요</small></span><em aria-hidden="true">↗</em></button>
              <a className="dg-map-link-card" href={route?.landingURL || routeLink(program, current, transport)} target="_blank" rel="noreferrer"><span className="dg-map-brand-icon kakao" aria-hidden="true" /><span><b>카카오 지도</b><small>선택한 이동수단의 최신 경로를 확인해요</small></span><em aria-hidden="true">↗</em></a>
              <a className="dg-map-link-card" href={naverMapLink(program)} target="_blank" rel="noreferrer"><span className="dg-map-brand-icon naver" aria-hidden="true" /><span><b>네이버 지도</b><small>시설명과 실제 좌표가 일치하는 위치를 열어요</small></span><em aria-hidden="true">↗</em></a>
              <a className="dg-map-link-card" href={googleMapLink(program)} target="_blank" rel="noreferrer"><span className="dg-map-brand-icon google" aria-hidden="true" /><span><b>Google 지도</b><small>Google 지도에서 시설 위치를 확인해요</small></span><em aria-hidden="true">↗</em></a>
            </div>
            {showRoadview && <KakaoRoadviewPreview coordinate={program} facilityName={program.facility} />}
            <button className="dg-nearby-button" type="button" onClick={onNearby}>☕ 목적지 주변 가게 보기</button>
          </div>
        </section>
        {accountFeaturesVisible && <ProgramReviews program={program} session={session} onRequireAuth={onRequireAuth} />}
        <p className="dg-source">공공데이터 출처: {program.source ?? "제공기관 공개 데이터"}</p>
      </div>
      <footer className="dg-detail-footer">
        {officialAccess ? <a className="dg-apply" href={officialAccess.href} target="_blank" rel="external nofollow noopener noreferrer" referrerPolicy="no-referrer">{officialAccess.requiresHomepageSearch ? `${officialAccess.providerName} 홈에서 검색` : "신청하러 가기"}</a> : <button className="dg-apply" type="button" disabled>신청 링크 확인 중</button>}
        <div>{accountFeaturesVisible && <button type="button" className={reminder ? "active" : ""} onClick={onReminder}>♧ {reminder ? "알림 저장됨" : "알림 받기"}</button>}<button type="button" onClick={onShare}>↗ 공유</button>{program.phone ? <a href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}>☎ 전화 문의</a> : <span>전화번호 없음</span>}</div>
      </footer>
    </article>
  );
}

function ProgramPoster({ program }: { program: WebProgram }) {
  const [failedImageURL, setFailedImageURL] = useState<string | null>(null);
  const imageURL = program.imageUrl?.trim() ?? "";
  if (!imageURL || failedImageURL === imageURL) return null;
  return <section><h2>프로그램 포스터</h2><div className="dg-poster"><img src={imageURL} alt={`${program.name} 포스터`} onError={() => setFailedImageURL(imageURL)} /></div></section>;
}

function ProgramSummary({ program }: { program: WebProgram }) {
  return <section className="dg-easy-summary"><h2>이 프로그램은요</h2><div className="dg-program-summary-card"><span aria-hidden="true"><Sparkles /></span><div><strong>공식 내용을 쉽게 정리했어요</strong><p>{program.summary || "우리 동네에서 만날 수 있는 프로그램이에요."}</p></div></div></section>;
}

function ProgramParkingSection({ program }: { program: WebProgram }) {
  const [parkingLots, setParkingLots] = useState<WebParkingLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/web-program-parking?id=${encodeURIComponent(program.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { parkingLots?: WebParkingLot[] };
        if (!response.ok) throw new Error("주차 정보를 불러오지 못했어요.");
        setParkingLots(Array.isArray(payload.parkingLots) ? payload.parkingLots : []);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setParkingLots([]);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [program.id]);

  return <section className="dg-program-parking-section"><h2>시설정보</h2><div className="dg-program-parking-card">
    <div className="dg-facility-info-rows"><div><span aria-hidden="true">📍</span><small>시설</small><strong>{program.facility}</strong></div>{(program.address || program.area) && <div><span aria-hidden="true">🗺️</span><small>주소</small><strong>{program.address || program.area}</strong></div>}{program.phone && <div><span aria-hidden="true">📞</span><small>전화</small><strong><a href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}>{program.phone}</a></strong></div>}</div>
    {(loading || parkingLots.length > 0) && <div className="dg-parking-information"><header><span className="dg-parking-title-icon"><ParkingCircle aria-hidden="true" /></span><strong>주차정보</strong><em>{loading ? "확인 중" : `근처 발견된 주차장 ${parkingLots.length}곳`}</em>{!loading && <button type="button" className={expanded ? "active" : ""} onClick={() => setExpanded((value) => !value)} aria-label="주차장 상세정보" aria-expanded={expanded}><i />{expanded ? "ON" : "OFF"}</button>}</header>
    {loading ? <div className="dg-parking-loading" role="status">시설 주변 공식 주차장을 확인하고 있어요.</div> : expanded ? <div className="dg-parking-lot-list">{parkingLots.map((lot) => <article key={lot.id}>
      <div className="dg-parking-lot-heading"><strong>{lot.name}</strong>{lot.distanceMeters !== null && <span>{distanceLabel(lot.distanceMeters)}</span>}</div>
      <dl>
        {lot.address && <div><dt>주소</dt><dd>{lot.address}</dd></div>}
        {lot.parkingType && <div><dt>구분</dt><dd>{lot.parkingType}</dd></div>}
        {lot.isPaid !== null && <div><dt>요금</dt><dd>{lot.isPaid ? lot.feeSummary || "유료" : "무료"}</dd></div>}
        {lot.totalSpaces !== null && <div><dt>주차 공간</dt><dd>{lot.totalSpaces.toLocaleString("ko-KR")}면{lot.availableSpaces !== null ? ` · 현재 ${lot.availableSpaces.toLocaleString("ko-KR")}면 가능` : ""}</dd></div>}
        {lot.availabilityStatus && <div><dt>현재 상태</dt><dd>{lot.availabilityStatus}</dd></div>}
        {lot.phone && <div><dt>문의</dt><dd><a href={`tel:${lot.phone.replace(/[^\d+]/g, "")}`}>{lot.phone}</a></dd></div>}
        {lot.notes && <div><dt>안내</dt><dd>{lot.notes}</dd></div>}
      </dl>
      {lot.sourceUrl && <a className="dg-parking-source" href={lot.sourceUrl} target="_blank" rel="external nofollow noopener noreferrer">공식 주차 정보 확인 ↗</a>}
    </article>)}</div> : <p className="dg-parking-collapsed-note">스위치를 켜면 주차장별 거리·요금·이용 조건을 확인할 수 있어요.</p>}
    {!loading && expanded && <p className="dg-parking-notice"><Info aria-hidden="true" />실시간 잔여면과 운영 정보는 현장 사정에 따라 달라질 수 있어요.</p>}
    </div>}
  </div></section>;
}

function ProgramReviews({ program, session, onRequireAuth }: { program: WebProgram; session: Session | null; onRequireAuth: () => void }) {
  const [reviews, setReviews] = useState<WebReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [satisfaction, setSatisfaction] = useState<"만족해요" | "보통이에요" | "아쉬워요">("만족해요");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setReviews(await fetchWebReviews(program.id)); }
    catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : "후기를 불러오지 못했어요."); }
    finally { setLoading(false); }
  }, [program.id]);

  useEffect(() => {
    let cancelled = false;
    void fetchWebReviews(program.id).then((items) => {
      if (!cancelled) setReviews(items);
    }).catch((reviewError) => {
      if (!cancelled) setError(reviewError instanceof Error ? reviewError.message : "후기를 불러오지 못했어요.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [program.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) { onRequireAuth(); return; }
    setSaving(true);
    setError("");
    try {
      await createWebReview(session, { programID: program.id, body, satisfaction });
      setBody("");
      await reload();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "후기를 저장하지 못했어요.");
    } finally { setSaving(false); }
  };

  const removeReview = async (reviewID: string) => {
    if (!session || !window.confirm("이 후기를 삭제할까요?")) return;
    setSaving(true);
    try { await deleteWebReview(session, reviewID); await reload(); }
    catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : "후기를 삭제하지 못했어요."); }
    finally { setSaving(false); }
  };

  return <section className="dg-program-reviews"><h2>후기와 이야기</h2><div className="dg-review-card">
    <header><span><MessageCircle aria-hidden="true" /></span><div><strong>이 프로그램을 경험하셨나요?</strong><p>계정에 연결된 후기는 모든 동네고고 환경에서 함께 보여요.</p></div></header>
    <form className="dg-review-form" onSubmit={submit}>
      <div className="dg-review-satisfaction">{(["만족해요", "보통이에요", "아쉬워요"] as const).map((value) => <button type="button" key={value} className={satisfaction === value ? "active" : ""} onClick={() => setSatisfaction(value)}>{value}</button>)}</div>
      <textarea value={body} maxLength={600} onChange={(event) => setBody(event.target.value)} placeholder="프로그램에 도움이 될 경험을 남겨주세요." aria-label="후기 내용" />
      <div><span>{body.length}/600</span><button type="submit" disabled={saving || !body.trim()}>{session ? "후기 등록" : "로그인하고 후기 등록"}</button></div>
    </form>
    {error && <p className="dg-review-error" role="alert">{error}</p>}
    {loading ? <p className="dg-review-empty">후기를 불러오고 있어요.</p> : reviews.length ? <div className="dg-review-list">{reviews.map((review) => <article key={review.id}>
      <header><span>{review.author_initial || "익"}</span><div><strong>{review.author_name}</strong><small>{new Date(review.created_at).toLocaleDateString("ko-KR")} · {review.satisfaction}</small></div>{session?.user.id === review.author_id && <button type="button" onClick={() => { void removeReview(review.id); }} aria-label="후기 삭제"><Trash2 aria-hidden="true" /></button>}</header>
      <p>{review.body}</p>
      <ReviewComments review={review} session={session} saving={saving} onRequireAuth={onRequireAuth} onChanged={reload} onError={setError} />
    </article>)}</div> : <p className="dg-review-empty">첫 번째 후기를 기다리고 있어요.</p>}
  </div></section>;
}

function ReviewComments({ review, session, saving, onRequireAuth, onChanged, onError }: { review: WebReview; session: Session | null; saving: boolean; onRequireAuth: () => void; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const roots = review.comments.filter((comment) => !comment.parent_id);
  const saveComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) { onRequireAuth(); return; }
    try {
      await createWebReviewComment(session, { reviewID: review.id, parentID: replyTo, body });
      setBody("");
      setReplyTo(null);
      await onChanged();
    } catch (commentError) { onError(commentError instanceof Error ? commentError.message : "댓글을 저장하지 못했어요."); }
  };
  const removeComment = async (commentID: string) => {
    if (!session || !window.confirm("이 댓글을 삭제할까요?")) return;
    try { await deleteWebReviewComment(session, commentID); await onChanged(); }
    catch (commentError) { onError(commentError instanceof Error ? commentError.message : "댓글을 삭제하지 못했어요."); }
  };
  return <div className="dg-review-comments">
    {roots.map((comment) => <div className="dg-review-comment-thread" key={comment.id}><div className="dg-review-comment"><span>{comment.author_name}</span><p>{comment.body}</p><div><small>{new Date(comment.created_at).toLocaleDateString("ko-KR")}</small><button type="button" onClick={() => { setReplyTo(comment.id); setBody(""); }}><Reply aria-hidden="true" /> 답글</button>{session?.user.id === comment.author_id && <button type="button" onClick={() => { void removeComment(comment.id); }}><Trash2 aria-hidden="true" /> 삭제</button>}</div></div>
      {review.comments.filter((reply) => reply.parent_id === comment.id).map((reply) => <div className="dg-review-comment reply" key={reply.id}><span>{reply.author_name}</span><p>{reply.body}</p><div><small>{new Date(reply.created_at).toLocaleDateString("ko-KR")}</small>{session?.user.id === reply.author_id && <button type="button" onClick={() => { void removeComment(reply.id); }}><Trash2 aria-hidden="true" /> 삭제</button>}</div></div>)}
    </div>)}
    <form onSubmit={saveComment}>{replyTo && <button type="button" className="dg-reply-cancel" onClick={() => { setReplyTo(null); setBody(""); }}>답글 취소 ×</button>}<div><input value={body} maxLength={400} onChange={(event) => setBody(event.target.value)} placeholder={replyTo ? "답글을 입력해 주세요" : "댓글을 입력해 주세요"} aria-label={replyTo ? "답글 내용" : "댓글 내용"} /><button type="submit" disabled={saving || !body.trim()}>{session ? "등록" : "로그인"}</button></div></form>
  </div>;
}

function KakaoRoutePreview({ origin, destination, route, routeState, transport, usesFallbackLocation, mapReady, onOpen }: {
  origin: Coordinate;
  destination: WebProgram;
  route: WebRouteResult | null;
  routeState: "waiting" | "loading" | "loaded" | "unavailable";
  transport: Transport;
  usesFallbackLocation: boolean;
  mapReady: boolean;
  onOpen: () => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const maps = window.kakao?.maps;
    const element = elementRef.current;
    const frames: number[] = [];
    frames.push(window.requestAnimationFrame(() => setMapStatus("loading")));
    if (!mapReady || !maps || typeof maps.LatLng !== "function" || !element) {
      frames.push(window.requestAnimationFrame(() => setMapStatus("unavailable")));
      return () => frames.forEach((frame) => window.cancelAnimationFrame(frame));
    }

    const map = new maps.Map(element, {
      center: new maps.LatLng((origin.latitude + destination.latitude) / 2, (origin.longitude + destination.longitude) / 2),
      level: 5,
    });
    map.setDraggable?.(false);
    map.setZoomable?.(false);
    const overlays: KakaoOverlay[] = [];
    const lines: KakaoMapItem[] = [];

    const marker = (coordinate: Coordinate, kind: "origin" | "destination", label: string) => {
      const markerElement = document.createElement("div");
      markerElement.className = `dg-route-preview-pin ${kind}${kind === "origin" && usesFallbackLocation ? " fallback" : ""}`;
      markerElement.setAttribute("aria-hidden", "true");
      const icon = routeEndpointElement(kind);
      const copy = document.createElement("em");
      copy.textContent = label;
      markerElement.append(icon, copy);
      overlays.push(new maps.CustomOverlay({
        map,
        position: new maps.LatLng(coordinate.latitude, coordinate.longitude),
        content: markerElement,
        yAnchor: 0.78,
        zIndex: 20,
      }));
    };

    const modeColor = transport === "walk" ? "#ef7b2d" : transport === "car" ? "#296edc" : "#2daa50";
    const segments = route?.segments.length
      ? route.segments
      : !usesFallbackLocation && transport !== "transit" && routeState !== "waiting"
        ? [{ type: "ESTIMATED", lineName: "예상 경로", points: [origin, destination] }]
        : [];
    segments.forEach((segment) => {
      if (segment.points.length < 2) return;
      lines.push(new maps.Polyline({
        map,
        path: segment.points.map((point) => new maps.LatLng(point.latitude, point.longitude)),
        strokeWeight: route ? 7 : 5,
        strokeColor: route ? modeColor : "#7f8981",
        strokeOpacity: route ? 0.94 : 0.72,
        strokeStyle: route ? "solid" : "dash",
      }));
    });
    marker(origin, "origin", usesFallbackLocation ? "기본 위치" : "현재 위치");
    marker(destination, "destination", destination.facility);

    const fitMap = () => {
      map.relayout?.();
      const bounds = new maps.LatLngBounds();
      bounds.extend(new maps.LatLng(origin.latitude, origin.longitude));
      bounds.extend(new maps.LatLng(destination.latitude, destination.longitude));
      segments.flatMap((segment) => segment.points).forEach((point) => bounds.extend(new maps.LatLng(point.latitude, point.longitude)));
      map.setBounds(bounds, 54, 42, 54, 42);
      setMapStatus("ready");
    };
    frames.push(window.requestAnimationFrame(fitMap));
    const resizeTimer = window.setTimeout(fitMap, 120);

    return () => {
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      window.clearTimeout(resizeTimer);
      overlays.forEach((overlay) => overlay.setMap(null));
      lines.forEach((line) => line.setMap(null));
    };
  }, [destination, mapReady, origin, route, routeState, transport, usesFallbackLocation]);

  const statusText = usesFallbackLocation
    ? "현재 위치를 확인하면 실제 경로선으로 바뀝니다"
    : routeState === "loading" ? "선택한 이동수단의 실제 경로를 계산하고 있어요"
      : routeState === "unavailable" ? "두 위치를 기준으로 예상 경로를 표시해요" : null;

  return <div className="dg-route-preview">
    <div ref={elementRef} className="dg-route-preview-canvas" />
    {mapStatus !== "ready" && <div className="dg-route-preview-loading">{mapStatus === "loading" ? "지도를 준비하고 있어요" : "지도 배경을 불러오지 못했어요"}</div>}
    {statusText && <span className="dg-route-preview-status">{statusText}</span>}
    <button type="button" className="dg-route-preview-open" onClick={onOpen} aria-label="메인 지도에서 시설까지 경로와 장소 사진 보기" />
  </div>;
}

function transitLineColor(type: string, lineName: string) {
  const normalized = lineName.replace(/\s+/g, "").toLowerCase();
  if (type.includes("TRAIN") || type.includes("RAIL")) return "#2c71d6";
  if (type.includes("BUS")) return "#2f6fd4";
  if (/1호선/.test(normalized)) return "#263c96";
  if (/2호선/.test(normalized)) return "#2f9b47";
  if (/3호선/.test(normalized)) return "#f07a2d";
  if (/4호선/.test(normalized)) return "#21a9d6";
  if (/5호선/.test(normalized)) return "#8958b5";
  if (/6호선/.test(normalized)) return "#9b6f45";
  if (/7호선/.test(normalized)) return "#69773c";
  if (/8호선/.test(normalized)) return "#dc486b";
  if (/9호선/.test(normalized)) return "#b59a4b";
  return "#2f6fd4";
}

function TransitModeGlyph({ type, size = 16 }: { type: string; size?: number }) {
  if (type.includes("BUS")) return <BusFront aria-hidden="true" size={size} strokeWidth={2.5} />;
  if (type.includes("TRAIN") || type.includes("RAIL")) return <TrainFront aria-hidden="true" size={size} strokeWidth={2.5} />;
  return <TramFront aria-hidden="true" size={size} strokeWidth={2.5} />;
}

function JourneyEndpoint({ icon, tint, role, title, subtitle, badge }: {
  icon: ReactNode;
  tint: string;
  role: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return <div className="dg-journey-endpoint">
    <span className="dg-journey-endpoint-icon" style={{ "--dg-journey-tint": tint } as CSSProperties}>{icon}</span>
    <div><p><em style={{ color: tint }}>{role}</em><strong>{title}</strong></p>{badge ?? (subtitle ? <small>{subtitle}</small> : null)}</div>
  </div>;
}

function JourneyConnector({ icon, title, detail, tint = "#cfd5cf" }: {
  icon: ReactNode;
  title: string;
  detail: string;
  tint?: string;
}) {
  return <div className="dg-journey-connector" style={{ "--dg-journey-line": tint } as CSSProperties}>
    <i aria-hidden="true" />
    <span>{icon}<b>{title}</b><em>{detail}</em></span>
  </div>;
}

function TransitLineBadge({ type, name }: { type: string; name: string }) {
  const color = transitLineColor(type, name);
  return <span className="dg-transit-line-badge" style={{ "--dg-transit-line": color } as CSSProperties}>{name}{type.includes("BUS") && !/버스$/.test(name) ? " 버스" : type.includes("SUBWAY") && !/지하철$/.test(name) ? " 지하철" : ""}</span>;
}

function walkLegDescription(leg: WebRouteResult["accessWalk"]) {
  return leg ? `${travelDuration(leg.minutes, true)} · ${distanceLabel(leg.distanceMeters)}` : "거리·시간 확인 중";
}

const trainTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const trainDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function trainTimeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시간 확인" : trainTimeFormatter.format(date);
}

function trainDateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "운행일 확인" : trainDateFormatter.format(date);
}

function IntercityConnectorJourney({ leg, fallbackDestination }: {
  leg: NonNullable<WebRouteResult["intercityTrain"]>["access"];
  fallbackDestination: string;
}) {
  const firstStep = leg.steps[0];
  const lastStep = leg.steps[leg.steps.length - 1];
  if (!firstStep || !lastStep) {
    return <JourneyConnector icon={<PersonStanding size={15} />} title="도보" detail={`${fallbackDestination}까지 ${travelDuration(leg.totalMinutes, true)} · ${distanceLabel(leg.totalDistanceMeters)}`} />;
  }
  const rideMinutes = Math.max(1, Math.min(leg.totalMinutes, leg.steps.reduce((sum, step) => sum + step.minutes, 0)));
  return <>
    <JourneyConnector icon={<PersonStanding size={15} />} title="도보" detail={walkLegDescription(leg.accessWalk)} />
    <JourneyEndpoint icon={<TransitModeGlyph type={firstStep.type} size={17} />} tint={transitLineColor(firstStep.type, firstStep.lineName)} role="승차" title={firstStep.boardingStation || "대중교통 승차 지점"} badge={<TransitLineBadge type={firstStep.type} name={firstStep.lineName} />} />
    <div className="dg-transit-ride dg-intercity-local-ride" style={{ "--dg-journey-line": transitLineColor(firstStep.type, firstStep.lineName) } as CSSProperties}>
      <i aria-hidden="true" />
      <div><p><ArrowLeftRight aria-hidden="true" size={15} /><strong>지역 대중교통 {travelDuration(rideMinutes, true)}</strong>{leg.transitDistanceMeters ? <span>· {distanceLabel(leg.transitDistanceMeters)}</span> : null}</p><div className="dg-transit-lines">{leg.steps.map((step, index) => <span className="dg-transit-line" key={`${step.type}-${step.lineName}-${index}`}>{index > 0 && <ChevronRight aria-hidden="true" size={12} />}<TransitLineBadge type={step.type} name={step.lineName} /></span>)}</div><small>{leg.transfers === 0 ? "환승 없음" : `환승 ${leg.transfers}회`}</small></div>
    </div>
    <JourneyEndpoint icon={<TransitModeGlyph type={lastStep.type} size={17} />} tint={transitLineColor(lastStep.type, lastStep.lineName)} role="하차" title={lastStep.alightingStation || "대중교통 하차 지점"} badge={<TransitLineBadge type={lastStep.type} name={lastStep.lineName} />} />
    <JourneyConnector icon={<PersonStanding size={15} />} title="도보" detail={walkLegDescription(leg.egressWalk)} />
  </>;
}

function IntercityTrainJourneyDetails({ program, route }: { program: WebProgram; route: WebRouteResult }) {
  const plan = route.intercityTrain;
  if (!plan) return null;
  const firstTrip = plan.trips[0];
  const middleWaypoints = plan.railWaypoints.slice(1, -1).map((waypoint) => waypoint.name);
  return <div className="dg-journey-card transit dg-intercity-journey">
    <header><strong><TrainFront aria-hidden="true" />고속열차로 가는 길</strong><span>{travelDuration(route.totalMinutes, true)}</span></header>
    <div className="dg-journey-divider" />
    <JourneyEndpoint icon={<Navigation size={17} />} tint="#2c71d6" role="출발" title="현재 위치" subtitle={`${plan.originStation.name}역까지 실제 연결 경로를 안내해요`} />
    <IntercityConnectorJourney leg={plan.access} fallbackDestination={`${plan.originStation.name}역`} />
    <JourneyEndpoint icon={<TrainFront size={17} />} tint="#2c71d6" role="고속열차 승차" title={`${plan.originStation.name}역`} subtitle="열차 출발역" />
    <div className="dg-intercity-rail">
      <i aria-hidden="true" />
      <div>
        <p><TrainFront aria-hidden="true" size={16} /><strong>{plan.originStation.name}역 → {plan.destinationStation.name}역</strong><em>{travelDuration(plan.railMinutes, true)}</em></p>
        {firstTrip ? <span><TransitLineBadge type="TRAIN" name={firstTrip.trainType} />{firstTrip.trainNumber && <small>제 {firstTrip.trainNumber}열차</small>}</span> : <small>카카오맵으로 확인한 주요 철도역 경유 경로</small>}
        {middleWaypoints.length > 0 && <section><b>주요 경유 철도역</b><span>{middleWaypoints.join("  →  ")}</span></section>}
      </div>
    </div>
    <JourneyEndpoint icon={<TrainFront size={17} />} tint="#22b14c" role="고속열차 하차" title={`${plan.destinationStation.name}역`} subtitle="열차 도착역" />
    <IntercityConnectorJourney leg={plan.egress} fallbackDestination={program.facility} />
    <JourneyEndpoint icon={<MapPin size={17} />} tint="#22b14c" role="도착" title={program.facility} subtitle="프로그램이 진행되는 시설" />
    <div className="dg-journey-divider" />
    {plan.trips.length > 0 ? <section className="dg-train-schedule"><header><strong>가까운 출발 시간</strong><span>{trainDateLabel(plan.trips[0].departureAt)}</span></header>{plan.trips.map((trip) => <article key={`${trip.trainType}-${trip.trainNumber}-${trip.departureAt}`}><div><TransitLineBadge type="TRAIN" name={trip.trainType} />{trip.trainNumber && <small>제 {trip.trainNumber}열차</small>}</div><p><strong>{trainTimeLabel(trip.departureAt)}</strong><ChevronRight aria-hidden="true" size={14} /><strong>{trainTimeLabel(trip.arrivalAt)}</strong><span>{travelDuration(trip.durationMinutes, true)}</span></p><small>{trip.departureStation} 출발 · {trip.arrivalStation} 도착</small></article>)}</section> : <div className="dg-train-unavailable"><CircleAlert aria-hidden="true" size={18} /><span><strong>철도 경로는 확인했어요</strong><small>현재 확인 가능한 직통 시간표가 없어 출발 전 운영사 시간표를 확인해 주세요.</small></span></div>}
    <div className="dg-journey-divider" />
    <p className="dg-journey-source"><Info aria-hidden="true" />{plan.trips.length ? "열차 운행 시간 · 국토교통부 TAGO 제공" : "철도 경유 경로 · 카카오맵 역 좌표 기준"}<br />운행 시간은 변경될 수 있으니 출발 전에 운영사에서 다시 확인해 주세요.</p>
  </div>;
}

function RouteJourneyDetails({ program, transport, route, routeState, routeError, estimate, usesFallbackLocation }: {
  program: WebProgram;
  transport: Transport;
  route: WebRouteResult | null;
  routeState: "waiting" | "loading" | "loaded" | "unavailable";
  routeError: string;
  estimate: { distance: number; minutes: number };
  usesFallbackLocation: boolean;
}) {
  const [expandedSubwayStep, setExpandedSubwayStep] = useState<number | null>(null);
  const modeTitle = transport === "walk" ? "도보로 가는 길" : transport === "car" ? "자동차로 가는 길" : "대중교통으로 가는 길";

  if (usesFallbackLocation || routeState === "waiting") {
    return <div className="dg-route-state-card"><span aria-hidden="true"><Navigation size={16} /></span><div><strong>현재 위치를 확인하면 {transport === "transit" ? "대중교통" : transport === "car" ? "자동차" : "도보"} 경로를 보여드려요</strong><p>위치 권한을 허용하면 출발·이동·도착 구간이 자동으로 표시됩니다.</p></div></div>;
  }
  if (routeState === "loading") {
    return <div className="dg-route-state-card loading"><i aria-hidden="true" /><div><strong>{transport === "transit" ? "대중교통" : transport === "car" ? "자동차" : "도보"} 경로를 확인하고 있어요</strong><p>{transport === "transit" ? "승차 지점과 시설까지의 도보 시간을 함께 계산합니다." : "도로를 따라 예상 거리와 시간을 계산합니다."}</p></div></div>;
  }

  if (!route) {
    if (transport === "walk") {
      return <div className="dg-journey-card walk">
        <header><strong><PersonStanding aria-hidden="true" />{modeTitle}</strong><span>{travelDuration(estimate.minutes, true)}</span></header>
        <div className="dg-journey-divider" />
        <JourneyEndpoint icon={<Navigation size={17} />} tint="#2c71d6" role="출발" title="현재 위치" subtitle="시설까지 걸어서 이동해요" />
        <JourneyConnector icon={<PersonStanding size={15} />} title="도보" detail={`${travelDuration(estimate.minutes, true)} · ${distanceLabel(estimate.distance)}`} />
        <JourneyEndpoint icon={<MapPin size={17} />} tint="#22b14c" role="도착" title={program.facility} subtitle="프로그램이 진행되는 시설" />
        <div className="dg-journey-divider" />
        <p className="dg-journey-source"><Info aria-hidden="true" />직선거리와 평균 보행 속도를 이용한 예상 정보입니다.</p>
      </div>;
    }
    return <div className="dg-route-state-card unavailable"><span aria-hidden="true"><CircleAlert size={16} /></span><div><strong>{modeTitle}을 찾지 못했어요</strong><p>{routeError || "지도 앱에서 최신 경로를 확인해 주세요."}</p></div></div>;
  }

  if (transport !== "transit") {
    const isWalk = transport === "walk";
    return <div className={`dg-journey-card ${isWalk ? "walk" : "car"}`}>
      <header><strong><TravelModeIcon transport={transport} />{modeTitle}</strong><span>{travelDuration(route.totalMinutes, true)}</span></header>
      <div className="dg-journey-divider" />
      <JourneyEndpoint icon={<Navigation size={17} />} tint="#2c71d6" role="출발" title="현재 위치" subtitle={isWalk ? "시설까지 걸어서 이동해요" : "추천 자동차 경로로 이동해요"} />
      <JourneyConnector icon={isWalk ? <PersonStanding size={15} /> : <CarFront size={15} />} title={isWalk ? "도보" : "자동차"} detail={`${travelDuration(route.totalMinutes, true)} · ${distanceLabel(route.totalDistanceMeters)}`} />
      <JourneyEndpoint icon={<MapPin size={17} />} tint="#22b14c" role="도착" title={program.facility} subtitle="프로그램이 진행되는 시설" />
      <div className="dg-journey-divider" />
      <p className="dg-journey-source"><Info aria-hidden="true" />{isWalk ? "카카오맵 도보 경로를 기준으로 계산했습니다." : "카카오맵 자동차 경로 기준이며 교통 상황에 따라 달라질 수 있습니다."}</p>
    </div>;
  }

  if (route.intercityTrain) return <IntercityTrainJourneyDetails program={program} route={route} />;

  const fallbackSteps = route.segments.filter((segment) => !segment.type.includes("WALK")).map((segment) => ({
    type: segment.type,
    lineName: segment.lineName,
    minutes: Math.max(1, Math.round(route.totalMinutes / Math.max(1, route.segments.length))),
    boardingStation: null,
    alightingStation: null,
    stopCount: null,
    intermediateStations: [] as string[],
    exitGuidance: null,
  }));
  const steps = route.steps.length ? route.steps : fallbackSteps;
  if (!steps.length) {
    return <div className="dg-route-state-card unavailable"><span aria-hidden="true"><CircleAlert size={16} /></span><div><strong>대중교통으로 가는 길을 찾지 못했어요</strong><p>{routeError || "카카오맵에서 최신 대중교통 경로를 확인해 주세요."}</p></div></div>;
  }
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  const remainingWalkDistance = Math.max(0, route.totalDistanceMeters - (route.transitDistanceMeters ?? route.totalDistanceMeters));
  const defaultWalkLeg = remainingWalkDistance > 0 ? {
    distanceMeters: Math.max(10, Math.round(remainingWalkDistance / 2)),
    minutes: Math.max(1, Math.ceil(remainingWalkDistance / 2 / 75)),
  } : null;
  const accessWalk = route.accessWalk ?? defaultWalkLeg;
  const egressWalk = route.egressWalk ?? defaultWalkLeg;
  const rideMinutes = Math.max(1, Math.min(route.totalMinutes, steps.reduce((sum, step) => sum + step.minutes, 0)));
  const currentLines = new Set(steps.filter((step) => step.type.includes("BUS")).map((step) => step.lineName.replace(/(?:번|버스|\s)/g, "")));
  const otherBuses = route.busRoutes.filter((bus) => !currentLines.has(bus.name.replace(/(?:번|버스|\s)/g, "")));

  return <div className="dg-journey-card transit">
    <header><strong><Route aria-hidden="true" />대중교통으로 가는 길</strong><span>{travelDuration(route.totalMinutes, true)}</span></header>
    <div className="dg-journey-divider" />
    <JourneyEndpoint icon={<Navigation size={17} />} tint="#2c71d6" role="출발" title="현재 위치" subtitle="가까운 승차 지점까지 걸어가요" />
    <JourneyConnector icon={<PersonStanding size={15} />} title="도보" detail={walkLegDescription(accessWalk)} />
    <JourneyEndpoint icon={<TransitModeGlyph type={firstStep.type} size={17} />} tint={transitLineColor(firstStep.type, firstStep.lineName)} role="승차" title={firstStep.boardingStation || (firstStep.type.includes("BUS") ? "버스 승차 정류장" : "대중교통 승차 지점")} badge={<TransitLineBadge type={firstStep.type} name={firstStep.lineName} />} />
    <div className="dg-transit-ride" style={{ "--dg-journey-line": transitLineColor(firstStep.type, firstStep.lineName) } as CSSProperties}>
      <i aria-hidden="true" />
      <div>
        <p><ArrowLeftRight aria-hidden="true" size={15} /><strong>대중교통 {travelDuration(rideMinutes, true)}</strong>{route.transitDistanceMeters ? <span>· {distanceLabel(route.transitDistanceMeters)}</span> : null}</p>
        <div className="dg-transit-lines">{steps.map((step, index) => <span className="dg-transit-line" key={`${step.type}-${step.lineName}-${index}`}>
          {index > 0 && <ChevronRight aria-hidden="true" size={12} />}
          <TransitLineBadge type={step.type} name={step.lineName} />
          {step.type.includes("SUBWAY") && <button type="button" onClick={() => setExpandedSubwayStep((value) => value === index ? null : index)} aria-label={`${step.lineName} 지하철 상세 경로 ${expandedSubwayStep === index ? "닫기" : "보기"}`}><Search aria-hidden="true" size={13} /></button>}
        </span>)}</div>
        {expandedSubwayStep !== null && steps[expandedSubwayStep]?.type.includes("SUBWAY") && <div className="dg-subway-detail">
          <header><TramFront aria-hidden="true" size={17} /><strong>{steps[expandedSubwayStep].lineName} 상세 경로</strong>{steps[expandedSubwayStep].stopCount !== null && <span>{steps[expandedSubwayStep].stopCount}개 정거장</span>}<em>{travelDuration(steps[expandedSubwayStep].minutes, true)}</em></header>
          <div className="dg-subway-endpoints"><p><b>출발</b><strong>{steps[expandedSubwayStep].boardingStation || "승차역 확인"}</strong></p><i /><p><b>도착</b><strong>{steps[expandedSubwayStep].alightingStation || "하차역 확인"}</strong></p></div>
          {steps[expandedSubwayStep].intermediateStations.length > 0 ? <p><b>경유역</b>{steps[expandedSubwayStep].intermediateStations.join("  ·  ")}</p> : steps[expandedSubwayStep].stopCount && steps[expandedSubwayStep].stopCount > 1 ? <p>중간 {steps[expandedSubwayStep].stopCount - 1}개 역을 지나갑니다.</p> : null}
          <small><Info aria-hidden="true" size={13} />{steps[expandedSubwayStep].exitGuidance || "출구 번호는 실시간 경로에서 제공될 때만 표시하며, 출발 전 카카오맵에서 확인해 주세요."}</small>
        </div>}
        <small>{route.transfers === 0 ? "환승 없음" : `환승 ${route.transfers}회`}</small>
      </div>
    </div>
    <JourneyEndpoint icon={<TransitModeGlyph type={lastStep.type} size={17} />} tint={transitLineColor(lastStep.type, lastStep.lineName)} role="하차" title={lastStep.alightingStation || (lastStep.type.includes("BUS") ? "버스 하차 정류장" : "대중교통 하차 지점")} badge={<TransitLineBadge type={lastStep.type} name={lastStep.lineName} />} />
    <JourneyConnector icon={<PersonStanding size={15} />} title="도보" detail={walkLegDescription(egressWalk)} />
    <JourneyEndpoint icon={<MapPin size={17} />} tint="#22b14c" role="도착" title={program.facility} subtitle="프로그램이 진행되는 시설" />
    {otherBuses.length > 0 && <><div className="dg-journey-divider" /><div className="dg-other-buses"><strong><BusFront aria-hidden="true" size={17} />그 밖에 이용 가능한 버스 정보</strong><div>{otherBuses.map((bus) => <TransitLineBadge key={`${bus.name}-${bus.type ?? ""}`} type="BUS" name={bus.name} />)}</div></div></>}
    <div className="dg-journey-divider" />
    <p className="dg-journey-source"><Info aria-hidden="true" />교통정보 · 카카오맵 제공<br />교통 상황과 운행 시간은 출발 전에 다시 확인해 주세요.</p>
  </div>;
}

function KakaoRoadviewPreview({ coordinate, facilityName }: { coordinate: Coordinate; facilityName: string }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const maps = window.kakao?.maps;
    const element = elementRef.current;
    if (!maps || !element) {
      setStatus("unavailable");
      return;
    }
    let disposed = false;
    const position = new maps.LatLng(coordinate.latitude, coordinate.longitude);
    const roadview = new maps.Roadview(element);
    const client = new maps.RoadviewClient();
    setStatus("loading");
    client.getNearestPanoId(position, 80, (panoId) => {
      if (disposed) return;
      if (typeof panoId !== "number") {
        setStatus("unavailable");
        return;
      }
      roadview.setPanoId(panoId, position);
      setStatus("ready");
    });
    return () => { disposed = true; };
  }, [coordinate.latitude, coordinate.longitude]);

  return <div className="dg-roadview-wrap" aria-label={`${facilityName} 카카오 거리뷰`}>
    <div ref={elementRef} className="dg-roadview-canvas" />
    {status !== "ready" && <div className="dg-roadview-status">{status === "loading" ? "가까운 거리뷰를 찾고 있어요" : "이 시설 가까이에서 제공되는 거리뷰가 없어요"}</div>}
  </div>;
}

function FilteredClusterProgramCarousel({ title, singleCardMode = false, programs, origin, focusedProgramID, onFocus, onOpen, onClose }: {
  title: string;
  singleCardMode?: boolean;
  programs: WebProgram[];
  origin: Coordinate;
  focusedProgramID: string | null;
  onFocus: (program: WebProgram) => void;
  onOpen: (program: WebProgram) => void;
  onClose: () => void;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SearchSort>("distance");
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const categories = useMemo(() => searchResultCategories(programs), [programs]);
  const visiblePrograms = useMemo(() => {
    const filtered = category ? programs.filter((program) => searchResultCategoryIDs(program).includes(category)) : programs;
    if (sort === "relevance") return filtered;
    return [...filtered].sort((left, right) => {
      if (sort === "free" && left.isFree !== right.isFree) return left.isFree ? -1 : 1;
      if (sort === "available" && isAvailable(left) !== isAvailable(right)) return isAvailable(left) ? -1 : 1;
      return distanceMeters(origin, left) - distanceMeters(origin, right);
    });
  }, [category, origin, programs, sort]);
  const programSignature = visiblePrograms.map((program) => program.id).join("|");
  const selectedIndex = Math.max(0, visiblePrograms.findIndex((program) => program.id === focusedProgramID));

  useEffect(() => {
    pagesRef.current?.scrollTo({ top: 0, behavior: "auto" });
    if (visiblePrograms[0]) onFocus(visiblePrograms[0]);
  // The ID signature changes only when a new cluster drill-down is ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programSignature]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const updateFocusedCard = () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const container = pagesRef.current;
      if (!container || container.clientHeight <= 0) return;
      const index = Math.max(0, Math.min(visiblePrograms.length - 1, Math.round(container.scrollTop / container.clientHeight)));
      const program = visiblePrograms[index];
      if (program && program.id !== focusedProgramID) onFocus(program);
    });
  };

  const animateClose = () => {
    if (closing) return;
    dragStartRef.current = null;
    dragOffsetRef.current = 0;
    setDragging(false);
    setClosing(true);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(onClose, 280);
  };

  const finishDrag = () => {
    const offset = dragOffsetRef.current;
    dragStartRef.current = null;
    setDragging(false);
    if (offset > 84) {
      animateClose();
      return;
    }
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  return <section className={`dg-filtered-cluster-carousel${singleCardMode ? " is-single-card" : ""}${expanded && singleCardMode ? " has-controls" : ""}${expanded && !singleCardMode ? " is-expanded" : ""}${dragging ? " is-dragging" : ""}${closing ? " is-closing" : ""}`} style={{ "--dg-carousel-drag": `${dragOffset}px` } as CSSProperties} aria-label={`${title} 카드`}>
    <header onPointerDown={(event) => { if (closing) return; dragStartRef.current = event.clientY; dragOffsetRef.current = 0; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragStartRef.current === null || closing) return; const nextOffset = Math.max(0, event.clientY - dragStartRef.current); dragOffsetRef.current = nextOffset; setDragOffset(nextOffset); }} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
      <span><strong>{title}</strong><small>{singleCardMode ? "카드를 위아래로 넘겨 하나씩 확인해요" : "위아래로 넘기면 선택한 위치로 이동해요"}</small></span>
      <b>{Math.min(selectedIndex + 1, visiblePrograms.length)} / {visiblePrograms.length.toLocaleString("ko-KR")}</b>
      <button className="dg-carousel-filter-toggle" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "프로그램 분류 접기" : "프로그램 분류 펼치기"}><SlidersHorizontal aria-hidden="true" size={16} /></button>
      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={animateClose} aria-label={`${title} 카드 닫기`}><X aria-hidden="true" size={17} /></button>
    </header>
    {expanded && <section className="dg-carousel-program-controls"><small>프로그램 분류</small><div className="dg-carousel-category-row"><button type="button" className={category === null ? "active" : ""} onClick={() => setCategory(null)}>✨ 전체 {programs.length}</button>{categories.map((item) => <button type="button" key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.emoji} {item.label} {item.count}</button>)}</div><div className="dg-carousel-sort-row">{([['relevance','관련도 순'],['distance','가까운 순'],['available','신청 가능한 순'],['free','무료 먼저']] as Array<[SearchSort,string]>).map(([value,label]) => <button type="button" key={value} className={sort === value ? "active" : ""} onClick={() => setSort(value)}>{label}</button>)}</div></section>}
    <div ref={pagesRef} className="dg-filtered-cluster-card-pages" onScroll={updateFocusedCard}>
      {visiblePrograms.map((program) => <div className="dg-filtered-cluster-card-page" key={program.id}>
        <div className="dg-carousel-program-card">
          <button className="dg-program-card" type="button" onClick={() => onOpen(program)}>
            <img src={`/markers/${programIconName(program)}.png`} alt="" />
            <span className="dg-card-copy">
              <span className={`dg-status ${statusClass(program)}`}>{program.status}</span>
              <strong>{program.name}</strong>
              <small>{distanceLabel(distanceMeters(origin, program))} · {program.facility}</small>
              <em>{program.isFree ? "무료" : program.feeText}</em>
            </span>
          </button>
          <button className="dg-carousel-map-action" type="button" onClick={() => onFocus(program)} aria-label={`${program.name} 지도에서 위치 보기`}><MapIcon aria-hidden="true" size={23} /></button>
        </div>
      </div>)}
    </div>
  </section>;
}

function ProgramPlaceSheet({ state, current, accountFeaturesVisible, reminderIDs, onClose, onIndex, onDetail, onReminder }: {
  state: PlaceSheetState; current: Coordinate; accountFeaturesVisible: boolean; reminderIDs: string[];
  onClose: () => void; onIndex: (index: number) => void; onDetail: (program: WebProgram) => void; onReminder: (program: WebProgram) => void;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  const grabberRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const dragRef = useRef({ pointerID: -1, startY: 0, startHeight: 0, moved: false });
  const onCloseRef = useRef(onClose);
  const [snap, setSnap] = useState<PlaceSheetSnap>("collapsed");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const program = state.programs[state.index];
  const total = Math.max(state.expectedCount, state.programs.length);
  const previous = () => onIndex(state.index <= 0 ? Math.max(0, state.programs.length - 1) : state.index - 1);
  const next = () => onIndex(state.index + 1 >= state.programs.length ? 0 : state.index + 1);

  const dismiss = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    setDragHeight(null);
    setSnap("hidden");
    closeTimerRef.current = window.setTimeout(() => onCloseRef.current(), 240);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    const sheet = sheetRef.current;
    const grabber = grabberRef.current;
    if (!sheet || !grabber || !window.matchMedia("(max-width: 900px)").matches || snap === "hidden") return;

    const begin = (pointerID: number, clientY: number) => {
      const heights = placeSheetHeights(window.innerHeight);
      const height = sheet.getBoundingClientRect().height || heights[snap];
      dragRef.current = { pointerID, startY: clientY, startHeight: height, moved: false };
      setDragHeight(height);
    };
    const move = (pointerID: number, clientY: number) => {
      const drag = dragRef.current;
      if (drag.pointerID !== pointerID) return;
      const heights = placeSheetHeights(window.innerHeight);
      const delta = drag.startY - clientY;
      if (Math.abs(delta) > 6) drag.moved = true;
      setDragHeight(Math.max(heights.hidden, Math.min(heights.expanded, drag.startHeight + delta)));
    };
    const finish = (pointerID: number, clientY: number) => {
      const drag = dragRef.current;
      if (drag.pointerID !== pointerID) return;
      const heights = placeSheetHeights(window.innerHeight);
      const delta = clientY - drag.startY;
      const finalHeight = Math.max(heights.hidden, Math.min(heights.expanded, drag.startHeight - delta));
      let nextSnap: PlaceSheetSnap = snap;
      if (finalHeight < heights.collapsed * 0.55) nextSnap = "hidden";
      else if (delta < -50) nextSnap = "expanded";
      else if (delta > 50) nextSnap = snap === "expanded" ? "collapsed" : "hidden";
      else nextSnap = Math.abs(finalHeight - heights.expanded) < Math.abs(finalHeight - heights.collapsed) ? "expanded" : "collapsed";
      dragRef.current.pointerID = -1;
      setDragHeight(null);
      if (nextSnap === "hidden") dismiss();
      else setSnap(nextSnap);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      begin(event.pointerId, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (dragRef.current.pointerID !== event.pointerId) return;
      event.preventDefault();
      move(event.pointerId, event.clientY);
    };
    const onPointerEnd = (event: PointerEvent) => finish(event.pointerId, event.clientY);
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      event.preventDefault();
      begin(touch.identifier, touch.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === dragRef.current.pointerID);
      if (!touch) return;
      event.preventDefault();
      move(touch.identifier, touch.clientY);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === dragRef.current.pointerID);
      if (touch) finish(touch.identifier, touch.clientY);
    };

    if ("PointerEvent" in window) {
      grabber.addEventListener("pointerdown", onPointerDown, { passive: false });
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
      return () => {
        grabber.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
      };
    }

    grabber.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      grabber.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [dismiss, snap]);

  const toggleSnap = () => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    setSnap((currentSnap) => currentSnap === "expanded" ? "collapsed" : "expanded");
    setDragHeight(null);
  };
  const sheetStyle = (dragHeight === null ? {} : { "--dg-place-sheet-height": `${dragHeight}px` }) as CSSProperties;

  return <section ref={sheetRef} className={`dg-place-sheet dg-place-sheet-${snap}${dragHeight !== null ? " dg-place-sheet-dragging" : ""}`} style={sheetStyle} role="dialog" aria-label="같은 장소 프로그램">
    <button ref={grabberRef} className="dg-place-sheet-grabber" type="button" onClick={toggleSnap} aria-label={snap === "expanded" ? "프로그램 패널 축소하기" : "프로그램 패널 전체로 펼치기"}><span aria-hidden="true" /><em>{snap === "expanded" ? "아래로 내려 축소하거나 닫기" : "위로 올려 전체 보기 · 아래로 내려 닫기"}</em></button>
    <button className="dg-sheet-close" type="button" onClick={dismiss} aria-label="닫기">×</button>
    {total > 1 && <header><button type="button" onClick={previous} disabled={state.programs.length < 2} aria-label="왼쪽으로 이동">‹</button><div><small>같은 장소 프로그램</small><strong>{Math.min(state.index + 1, total)} / {total}</strong></div><button type="button" onClick={next} disabled={state.programs.length < 2} aria-label="오른쪽으로 이동">›</button></header>}
    {program ? <div className="dg-sheet-body">
      <div className="dg-sheet-badges"><span>{program.status}</span><span>집 근처 {distanceLabel(distanceMeters(current, program))}</span></div>
      <h2>{program.name}</h2><p className="dg-sheet-distance">⌖ 우리 집에서 {distanceLabel(distanceMeters(current, program))}</p>
      <dl><div><dt><Building2 className="dg-sheet-info-icon" aria-hidden="true" /></dt><dd>{program.facility}</dd></div><div><dt><Clock className="dg-sheet-info-icon" aria-hidden="true" /></dt><dd>{program.scheduleText ?? program.periodText ?? "이용시간은 예약 페이지에서 확인"}</dd></div><div><dt><span className="dg-sheet-info-icon dg-sheet-info-icon-won" aria-hidden="true">₩</span></dt><dd>{program.isFree ? "무료" : program.feeText} · {program.status}</dd></div></dl>
      <button className="dg-sheet-detail" type="button" onClick={() => onDetail(program)}>자세히 보기</button>
      <div className="dg-sheet-actions">{accountFeaturesVisible && <button type="button" className={reminderIDs.includes(program.id) ? "active" : ""} onClick={() => onReminder(program)}>♧ {reminderIDs.includes(program.id) ? "알림 저장됨" : "알림 받기"}</button>}<a href={mapLink(program)} target="_blank" rel="noreferrer">➤ 길찾기</a></div>
    </div> : <div className="dg-sheet-loading"><strong>{state.loading ? "같은 장소 프로그램을 불러오고 있어요" : "프로그램 정보를 확인할 수 없어요"}</strong></div>}
  </section>;
}

function OpenRunPanel({ programs, reminders, onBack, onToggleReminder, onOpen }: { programs: WebProgram[]; reminders: string[]; onBack: () => void; onToggleReminder: (program: WebProgram) => void; onOpen: (program: WebProgram) => void }) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const suggestions = ["수영", "요가", "필라테스", "미술", "음악", "서예", "공예", "사진", "무료", "시니어"];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcoming = programs.filter((program) => {
    if (!program.receiptStart || !isAvailable(program)) return false;
    const start = new Date(program.receiptStart).getTime();
    return Number.isFinite(start) && start >= todayStart.getTime();
  }).filter((program) => !keywords.length || keywords.some((keyword) => `${program.name} ${program.category} ${program.field} ${program.audiences.join(" ")} ${program.isFree ? "무료" : ""}`.includes(keyword))).sort((a, b) => (a.receiptStart ?? "9999").localeCompare(b.receiptStart ?? "9999")).slice(0, 100);
  const banner = (program: WebProgram) => {
    if (/마감임박/.test(program.status)) return "곧 마감돼요";
    if (!program.receiptStart) return "접수 일정 확인 중";
    const date = new Date(program.receiptStart);
    return `${date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })} 접수 시작`;
  };
  return <section className="dg-openrun-panel"><header><button type="button" className="dg-mobile-panel-back" onClick={onBack}>‹ 지도</button><div><h1>오픈런 알림 <span>⚡</span></h1><p>접수 시작·마감 전에 알려드릴게요</p></div></header><div className="dg-openrun-scroll"><section className="dg-keyword-card"><div><strong>🔔 알림 키워드</strong><small>자세히 보기 ›</small></div><p>관심 키워드를 선택하면 해당 프로그램만 알려드려요</p><div>{suggestions.map((keyword) => <button type="button" key={keyword} className={keywords.includes(keyword) ? "active" : ""} onClick={() => setKeywords((current) => current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword])}>{keywords.includes(keyword) ? `${keyword} ✓` : keyword}</button>)}</div></section>{upcoming.length ? upcoming.map((program) => <article className="dg-openrun-card" key={program.id}><div className="dg-openrun-banner"><span>{banner(program)}</span>{reminders.includes(program.id) && <strong>✓ 알림 켜짐</strong>}</div><button type="button" className="dg-openrun-copy" onClick={() => onOpen(program)}><strong>{program.name}</strong><span>{program.facility} · {program.scheduleText ?? "일정 확인"} · {program.isFree ? "무료" : program.feeText}</span></button><div><button type="button" className={reminders.includes(program.id) ? "is-off" : ""} onClick={() => onToggleReminder(program)}>{reminders.includes(program.id) ? "⏰ 알림 변경" : "🔔 알림 켜기"}</button><button type="button" onClick={() => onOpen(program)}>신청하러 가기</button></div></article>) : <div className="dg-empty"><strong>{keywords.length ? "선택한 키워드에 해당하는 프로그램이 없어요" : "현재 접수가 임박한 프로그램이 없어요"}</strong>{keywords.length > 0 && <button type="button" onClick={() => setKeywords([])}>키워드 해제하기</button>}</div>}<p className="dg-openrun-tip">▦ 프로그램의 알림 받기 버튼에서 원하는 날짜와 시간을 직접 선택할 수 있어요.</p></div></section>;
}

function FullFilterDialog({ personas, subjects, status, freeOnly, paidOnly, radiusKm, count, onPersonas, onSubjects, onStatus, onFree, onPaid, onRadius, onReset, onApply, onClose }: {
  personas: string[]; subjects: string[]; status: StatusFilter; freeOnly: boolean; paidOnly: boolean; radiusKm: number | null; count: number;
  onPersonas: (value: string[]) => void; onSubjects: (value: string[]) => void; onStatus: (value: StatusFilter) => void;
  onFree: (value: boolean) => void; onPaid: (value: boolean) => void; onRadius: (value: number | null) => void; onReset: () => void; onApply: () => void; onClose: () => void;
}) {
  const toggleSubject = (subject: string) => onSubjects(toggleSingleWebDetailFilter(subjects, subject));
  const togglePersona = (persona: string) => onPersonas(personas.includes(persona) ? personas.filter((item) => item !== persona) : [...personas, persona]);
  const dialogRef = useRef<HTMLElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollToTop = () => {
    dialogRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setShowScrollTop(false), 420);
  };
  return <div className="dg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="dg-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="dg-filter-title" onScroll={(event) => setShowScrollTop(event.currentTarget.scrollTop > 140)}>
      <header><h2 id="dg-filter-title">조건 고르기</h2><button type="button" onClick={onReset}>초기화</button><button type="button" className="dg-modal-x" onClick={onClose} aria-label="닫기">×</button></header>
      <FeeStatusFilterSection status={status} freeOnly={freeOnly} paidOnly={paidOnly} onStatus={onStatus} onFree={onFree} onPaid={onPaid} />
      <ProgramDistanceSelector radiusKm={radiusKm} onRadius={onRadius} />
      <PersonaFilterSection active={personas} onClick={togglePersona} />
      <DetailFilterSection active={subjects} onClick={toggleSubject} />
      {showScrollTop && <button className="dg-filter-scroll-top" type="button" onClick={scrollToTop} aria-label="조건 목록 맨 위로 이동"><ChevronUp aria-hidden="true" /></button>}
      <button className="dg-filter-apply" type="button" onClick={onApply}>선택한 조건으로 {count.toLocaleString("ko-KR")}곳 보기</button>
    </section>
  </div>;
}

function ConditionFilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  const accessibilityLabel = count > 0 ? `전체 조건 열기, 선택한 조건 ${count}개` : "전체 조건 열기";
  return <button type="button" className="dg-condition-filter-button" onClick={onClick} aria-label={accessibilityLabel}>
    <SlidersHorizontal aria-hidden="true" />
    {count > 0 && <b className="dg-filter-count-badge">{Math.min(count, 99)}</b>}
  </button>;
}

function ProgramDistanceSelector({ radiusKm, onRadius }: { radiusKm: number | null; onRadius: (value: number | null) => void }) {
  const selectedIndex = Math.max(0, PROGRAM_DISTANCE_RADII_KM.indexOf(radiusKm));
  const selectedLabel = programDistanceRadiusLabel(radiusKm);
  return <section className="dg-nearby-radius-card dg-program-radius-card" aria-label="집에서 프로그램까지 검색 반경">
    <header><span><Crosshair aria-hidden="true" /><span><b>집에서 얼마나 가까운 곳을 찾으세요?</b><small>현재 위치를 기준으로 가까운 프로그램만 보여드려요</small></span></span><strong>{selectedLabel}</strong></header>
    <div className="dg-nearby-radius-control" style={{ "--dg-radius-progress": `${selectedIndex / (PROGRAM_DISTANCE_RADII_KM.length - 1) * 100}%` } as CSSProperties}>
      <div className="dg-nearby-radius-track" aria-hidden="true"><i /><span>{PROGRAM_DISTANCE_RADII_KM.map((value, index) => <b key={value ?? "all"} className={index === selectedIndex ? "active" : ""} />)}</span></div>
      <input type="range" min="0" max={PROGRAM_DISTANCE_RADII_KM.length - 1} step="1" value={selectedIndex} aria-label="집에서 프로그램까지 검색 반경" aria-valuetext={selectedLabel} onChange={(event) => onRadius(PROGRAM_DISTANCE_RADII_KM[Number(event.target.value)] ?? null)} />
      <div className="dg-nearby-radius-labels">{PROGRAM_DISTANCE_RADII_KM.map((value, index) => <button type="button" key={value ?? "all"} className={index === selectedIndex ? "active" : ""} onClick={() => onRadius(value)}>{programDistanceRadiusLabel(value)}</button>)}</div>
    </div>
  </section>;
}

function AlertScheduleDialog({ state, saved, onChange, onSave, onRemove, onClose }: { state: AlertDialogState; saved: boolean; onChange: (value: string) => void; onSave: () => void; onRemove: () => void; onClose: () => void }) {
  const dragRef = useRef({ pointerID: -1, startY: 0 });
  const [dragY, setDragY] = useState(0);
  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { pointerID: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current.pointerID !== event.pointerId) return;
    const next = Math.max(0, event.clientY - dragRef.current.startY);
    setDragY(next);
  };
  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current.pointerID !== event.pointerId) return;
    const next = Math.max(0, event.clientY - dragRef.current.startY);
    dragRef.current.pointerID = -1;
    setDragY(0);
    if (next > 64) onClose();
  };
  return <div className="dg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`dg-alert-dialog${dragY > 0 ? " is-dragging" : ""}`} style={{ "--dg-alert-sheet-drag-y": `${dragY}px` } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="dg-alert-title">
      <button type="button" className="dg-alert-sheet-grabber" aria-label="알림 설정 패널 아래로 닫기" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => { dragRef.current.pointerID = -1; setDragY(0); }}><span /></button>
      <header><div><small>오픈런 알림</small><h2 id="dg-alert-title">날짜와 시간을 골라주세요</h2></div><button type="button" onClick={onClose} aria-label="닫기">×</button></header>
      <p><strong>{state.program.name}</strong><span>{state.program.facility}</span></p>
      <label>알림 받을 시간<input type="datetime-local" value={state.scheduledAt} onChange={(event) => onChange(event.target.value)} /></label>
      <div className="dg-alert-notice">브라우저를 열어 둔 동안에는 기기 알림으로도 알려드리고, 로그인하면 선택한 시간은 앱과 같은 계정에 저장됩니다.</div>
      <div className="dg-alert-actions">{saved && <button type="button" className="danger" onClick={onRemove}>알림 끄기</button>}<button type="button" className="primary" onClick={onSave}>{saved ? "알림 시간 변경" : "알림 저장"}</button></div>
    </section>
  </div>;
}

function FeeStatusFilterSection({ status, freeOnly, paidOnly, onStatus, onFree, onPaid }: { status: StatusFilter; freeOnly: boolean; paidOnly: boolean; onStatus: (value: StatusFilter) => void; onFree: (value: boolean) => void; onPaid: (value: boolean) => void }) {
  const statusOptions: Array<{ label: string; value: StatusFilter }> = [{ label: "접수중", value: "접수중" }, { label: "곧 시작", value: "접수예정" }, { label: "마감임박", value: "마감임박" }];
  return <section className="dg-filter-choice-card dg-fee-status-filter-section">
    <div className="dg-filter-section-heading"><h3>요금·신청 상태</h3><p>지금 확인하고 싶은 조건부터 빠르게 골라보세요</p></div>
    <div className="dg-filter-choice-group"><strong>요금</strong><div><button type="button" className={freeOnly ? "active" : ""} onClick={() => { onFree(!freeOnly); if (!freeOnly) onPaid(false); }}>무료{freeOnly ? " ✓" : ""}</button><button type="button" className={paidOnly ? "active" : ""} onClick={() => { onPaid(!paidOnly); if (!paidOnly) onFree(false); }}>유료{paidOnly ? " ✓" : ""}</button></div></div>
    <hr />
    <div className="dg-filter-choice-group"><strong>신청 상태</strong><div>{statusOptions.map((option) => <button type="button" className={status === option.value ? "active" : ""} key={option.label} onClick={() => onStatus(status === option.value ? "전체" : option.value)}>{option.label}{status === option.value ? " ✓" : ""}</button>)}</div></div>
  </section>;
}

function PersonaFilterSection({ active, onClick }: { active: string[]; onClick: (value: string) => void }) {
  return <section className="dg-filter-section dg-persona-filter-section"><div className="dg-filter-section-heading"><h3>누구를 위한 프로그램인가요?</h3><p>여러 대상을 함께 선택할 수 있어요</p></div><div className="dg-filter-choice-card dg-persona-filter-card">{WEB_PROGRAM_PERSONA_GROUPS.map((group, index) => <div className="dg-filter-choice-group" key={group.title}>{index > 0 && <hr />}<strong>{group.title}</strong><div>{group.items.map((persona) => <button type="button" className={active.includes(persona.label) ? "active" : ""} aria-pressed={active.includes(persona.label)} key={persona.label} onClick={() => onClick(persona.label)}><span aria-hidden="true">{persona.emoji}</span>{persona.label}{active.includes(persona.label) ? " ✓" : ""}</button>)}</div></div>)}</div></section>;
}

function DetailFilterSection({ active, onClick }: { active: string[]; onClick: (value: string) => void }) {
  return <section className="dg-filter-section dg-detail-filter-section"><div className="dg-detail-filter-heading"><h3>어떤 종목을 찾으세요?</h3><p>한 번에 한 종목만 선택할 수 있어요</p></div><div className="dg-detail-filter-groups">{WEB_DETAIL_FILTER_GROUPS.map((group) => <article className="dg-detail-filter-card" key={group.title}><header><strong><span aria-hidden="true">{group.emoji}</span>{group.title}</strong><small>{group.items.length}개</small></header><div>{group.items.map((detail) => <button type="button" className={active.includes(detail.label) ? "active" : ""} aria-pressed={active.includes(detail.label)} key={detail.label} onClick={() => onClick(detail.label)}><img src={`/markers/${detail.iconName}.png`} alt="" />{detail.label}</button>)}</div></article>)}</div></section>;
}

function HeatShelterDetail({ shelter, current, onBack }: { shelter: WebHeatShelter; current: Coordinate; onBack: () => void }) {
  const weekday = [shelter.weekdayOpenTime, shelter.weekdayCloseTime].filter(Boolean).join(" ~ ") || "운영시간 확인 필요";
  const weekend = [shelter.weekendHolidayOpenTime, shelter.weekendHolidayCloseTime].filter(Boolean).join(" ~ ") || "운영 여부 확인 필요";
  return <article className="dg-detail">
    <header className="dg-detail-hero dg-heat-hero"><div className="dg-detail-actions"><button type="button" onClick={onBack}>‹</button></div><div className="dg-detail-badges"><span>❄ 무더위쉼터</span></div><h1>{shelter.name}</h1><p>{shelter.facilityType ?? "냉방 쉼터"}{shelter.facilitySubtype ? ` · ${shelter.facilitySubtype}` : ""}</p></header>
    <div className="dg-detail-scroll"><section><div className="dg-poster"><img src="/markers/icon_heat_shelter.png" alt="" /></div></section><section><h2>이용 정보</h2><dl className="dg-info-list"><div><dt>⌖</dt><dd><small>주소</small><strong>{shelter.roadAddress ?? shelter.address ?? "주소 정보 없음"}</strong><span>{shelter.detailPosition}</span></dd></div><div><dt>◷</dt><dd><small>평일 운영</small><strong>{weekday}</strong><span>주말·공휴일 {weekend}</span></dd></div><div><dt>❄</dt><dd><small>냉방 시설</small><strong>에어컨 {shelter.airconCount ?? 0}대 · 선풍기 {shelter.fanCount ?? 0}대</strong><span>{shelter.capacity ? `수용 인원 ${shelter.capacity.toLocaleString("ko-KR")}명` : "수용 인원 확인 필요"}</span></dd></div><div><dt>⌁</dt><dd><small>현재 위치와 거리</small><strong>{distanceLabel(distanceMeters(current, shelter))}</strong></dd></div></dl></section>{shelter.notes && <section className="dg-easy-summary"><h2>안내</h2><p>{shelter.notes}</p></section>}{shelter.sourceUrl && <a className="dg-route-button" href={shelter.sourceUrl} target="_blank" rel="external nofollow noopener noreferrer">공식 데이터 출처 확인</a>}</div>
  </article>;
}

function PanelHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return <header className="dg-subpanel-header"><button type="button" onClick={onBack}>‹</button><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></header>;
}

function CalendarPanel({ programs, alerts, onBack, onOpen, onDelete }: { programs: WebProgram[]; alerts: WebUserAlert[]; onBack: () => void; onOpen: (program: WebProgram) => void; onDelete: (programID: string) => Promise<void> }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const programsByID = new Map(programs.map((program) => [program.id, program]));
  const alertEvents = alerts.flatMap((alert) => {
    const program = programsByID.get(alert.program_id);
    if (!program) return [];
    const scheduleTimes = [...new Set([
      ...(Array.isArray(alert.scheduled_times) ? alert.scheduled_times : []),
      ...(alert.scheduled_at ? [alert.scheduled_at] : []),
    ])].slice(0, 3);
    return scheduleTimes.flatMap((scheduledAt) => {
      const date = new Date(scheduledAt);
      return Number.isFinite(date.getTime()) ? [{ program, date, kind: "alert" as const }] : [];
    });
  });
  const alertProgramIDs = new Set(alertEvents.map(({ program }) => program.id));
  const receiptEvents = programs.flatMap((program) => {
    if (alertProgramIDs.has(program.id)) return [];
    if (!program.receiptStart) return [];
    const date = new Date(program.receiptStart);
    return Number.isFinite(date.getTime()) ? [{ program, date, kind: "receipt" as const }] : [];
  });
  const monthEvents = [...alertEvents, ...receiptEvents].filter(({ date }) => date.getFullYear() === monthCursor.getFullYear() && date.getMonth() === monthCursor.getMonth()).sort((a, b) => a.date.getTime() - b.date.getTime());
  const events = monthEvents.slice(0, 80);
  const firstWeekday = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const eventDays = new Set(monthEvents.map(({ date }) => date.getDate()));
  const alertDays = new Set(alertEvents.filter(({ date }) => date.getFullYear() === monthCursor.getFullYear() && date.getMonth() === monthCursor.getMonth()).map(({ date }) => date.getDate()));
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const moveMonth = (offset: number) => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  return <section className="dg-aux-panel"><PanelHeader title="일정" subtitle="접수 시작과 저장한 알림을 날짜순으로 모았어요" onBack={onBack} /><div className="dg-month-card"><button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button><strong>{monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월</strong><button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button><div className="dg-week-row">{["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}</div><div className="dg-calendar-grid">{cells.map((day, index) => <span key={`${day ?? "empty"}-${index}`} className={[day && eventDays.has(day) ? "has-event" : "", day && alertDays.has(day) ? "has-alert" : ""].filter(Boolean).join(" ")}>{day ?? ""}</span>)}</div></div><div className="dg-aux-list dg-calendar-event-list">{events.length ? events.map(({ program, date, kind }) => <article className="dg-calendar-event-group" key={`${kind}:${program.id}:${date.toISOString()}`}><button className="dg-calendar-program-card" type="button" onClick={() => onOpen(program)} aria-label={`${program.name} 자세히 보기`}><img src={`/markers/${programIconName(program)}.png`} alt=""/><span><small>{program.status}</small><strong>{program.name}</strong><em>{program.facility}</em></span><ChevronRight aria-hidden="true"/></button><div className="dg-calendar-schedule-card"><span className="dg-date-badge">{date.getDate()}</span><span><small>{kind === "alert" ? "알림 일정" : "접수 일정"}</small><strong>{date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</strong><em>{date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}</em></span>{kind === "alert" && <button type="button" onClick={() => { void onDelete(program.id); }} aria-label={`${program.name} 알림 일정 삭제`}><Trash2 aria-hidden="true"/>삭제</button>}</div></article>) : <div className="dg-empty"><strong>이 달에 표시할 일정이 없어요.</strong><p>다른 달을 확인하거나 프로그램에서 알림 받기를 선택해 보세요.</p></div>}</div></section>;
}

function FamilyPanel({ programs, members, signedIn, onBack, onOpen, onSave, onRemove }: { programs: WebProgram[]; members: WebFamilyMember[]; signedIn: boolean; onBack: () => void; onOpen: (program: WebProgram) => void; onSave: (member: WebFamilyMember) => void; onRemove: (member: WebFamilyMember) => void }) {
  const [role, setRole] = useState<WebFamilyMember["role"]>("어머니");
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("60대");
  const [region, setRegion] = useState("서울특별시 성북구");
  const selectedMember = members.find((member) => member.role === role && (role !== "아이" || member.name === name)) ?? members.find((member) => member.role === role);

  useEffect(() => {
    const member = members.find((item) => item.role === role);
    const frame = window.requestAnimationFrame(() => {
      setName(member?.name ?? "");
      setAgeGroup(member?.age_group ?? (role === "아이" ? "10대" : role === "나" ? "40대" : "60대"));
      setRegion(member?.region ?? "서울특별시 성북구");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [members, role]);

  const familyPrograms = programs.filter((program) => {
    const audienceMatch = role === "아이"
      ? program.audiences.some((value) => /아이|아동|어린이|청소년|유아/.test(value))
      : role === "나" ? true
        : program.isSeniorRecommended || program.audiences.some((value) => /시니어|어르신|성인/.test(value));
    const regionTokens = region.split(/\s+/).filter((token) => token.length > 1);
    const regionMatch = !regionTokens.length || regionTokens.some((token) => `${program.area} ${program.address ?? ""}`.includes(token));
    return audienceMatch && regionMatch;
  }).slice(0, 60);
  const canSave = Boolean(ageGroup.trim() && region.trim() && (role !== "아이" || name.trim()));

  return <section className="dg-aux-panel"><PanelHeader title="가족 모드" subtitle="가족 프로필과 찜 대상을 앱과 같은 계정으로 이어요" onBack={onBack} /><div className="dg-family-tabs">{(["어머니", "아버지", "나", "아이"] as WebFamilyMember["role"][]).map((item) => <button key={item} type="button" className={role === item ? "active" : ""} onClick={() => setRole(item)}>{item}</button>)}</div><div className="dg-family-editor">{role === "아이" && <label>이름<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="아이 별명" /></label>}<label>연령대<select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}>{["10대 미만", "10대", "20대", "30대", "40대", "50대", "60대", "70대", "80대 이상"].map((value) => <option key={value}>{value}</option>)}</select></label><label>관심 지역<input value={region} maxLength={80} onChange={(event) => setRegion(event.target.value)} placeholder="예: 서울특별시 성북구" /></label><div><button type="button" disabled={!canSave} onClick={() => onSave({ role, name: role === "아이" ? name.trim() : null, age_group: ageGroup, region: region.trim() })}>{selectedMember ? "가족 정보 수정" : "가족 정보 저장"}</button>{selectedMember && <button type="button" className="danger" onClick={() => onRemove(selectedMember)}>삭제</button>}</div><p>{signedIn ? "본인 계정에만 보이도록 Supabase RLS로 동기화됩니다." : "로그인 전에는 이 브라우저에만 저장됩니다."}</p></div><div className="dg-family-profile"><strong>{selectedMember?.name || role}를 위한 추천</strong><span>{selectedMember?.region ?? region} · {familyPrograms.length}개</span></div><div className="dg-aux-list">{familyPrograms.length ? familyPrograms.map((program) => <button key={program.id} type="button" onClick={() => onOpen(program)}><img src={`/markers/${programIconName(program)}.png`} alt="" /><span><small>{program.status}</small><strong>{program.name}</strong><em>{program.facility} · {program.isFree ? "무료" : program.feeText}</em></span></button>) : <div className="dg-empty"><strong>이 지역과 연령에 맞는 프로그램이 현재 지도에 없어요.</strong><p>지도를 관심 지역으로 이동한 뒤 다시 확인해 주세요.</p></div>}</div></section>;
}

function HistoryPanel({ history, onBack, onOpen }: { history: Array<{ program: WebProgram; viewedAt: string }>; onBack: () => void; onOpen: (program: WebProgram) => void }) {
  const recent = history;
  return <section className="dg-aux-panel"><PanelHeader title="보관함" subtitle="오늘부터 3일 전까지 열어본 프로그램이에요" onBack={onBack} /><div className="dg-history-summary"><strong>{recent.length}</strong><span>열어본 프로그램</span></div><div className="dg-aux-list">{recent.length ? recent.map((item) => <button key={`${item.program.id}-${item.viewedAt.slice(0, 10)}`} type="button" onClick={() => onOpen(item.program)}><img src={`/markers/${programIconName(item.program)}.png`} alt="" /><span><small>{new Date(item.viewedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</small><strong>{item.program.name}</strong><em>{item.program.facility}</em></span></button>) : <div className="dg-empty"><strong>최근 4일 동안 열어본 프로그램이 없어요.</strong><p>지도 마커나 목록에서 프로그램을 확인하면 자동으로 기록됩니다.</p></div>}</div></section>;
}

function NearbyRadiusSelector({ radius, onRadius }: { radius: number; onRadius: (value: number) => void }) {
  const radii = [100, 300, 500, 1000] as const;
  const radiusIndex = Math.max(0, radii.indexOf(radius as (typeof radii)[number]));
  const [draftIndex, setDraftIndex] = useState(radiusIndex);

  const commit = (index = draftIndex) => {
    const nextRadius = radii[index];
    if (nextRadius !== radius) onRadius(nextRadius);
  };
  const pointerIndex = (input: HTMLInputElement, clientX: number) => {
    const bounds = input.getBoundingClientRect();
    const thumbInset = 13.5;
    const usableWidth = Math.max(1, bounds.width - thumbInset * 2);
    const progress = Math.max(0, Math.min(1, (clientX - bounds.left - thumbInset) / usableWidth));
    return Math.round(progress * (radii.length - 1));
  };
  const selectedLabel = radii[draftIndex] === 1000 ? "1km" : `${radii[draftIndex]}m`;

  return <section className="dg-nearby-radius-card" aria-label="목적지 주변 검색 반경">
    <header><span><Crosshair aria-hidden="true" />목적지에서 반경</span><strong>{selectedLabel}</strong></header>
    <div className="dg-nearby-radius-control" style={{ "--dg-radius-progress": `${draftIndex / (radii.length - 1) * 100}%` } as CSSProperties}>
      <div className="dg-nearby-radius-track" aria-hidden="true"><i /><span>{radii.map((value, index) => <b key={value} className={index === draftIndex ? "active" : ""} />)}</span></div>
      <input
        type="range"
        min="0"
        max={radii.length - 1}
        step="1"
        value={draftIndex}
        aria-label="목적지 주변 검색 반경"
        aria-valuetext={selectedLabel}
        onChange={(event) => setDraftIndex(Number(event.target.value))}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDraftIndex(pointerIndex(event.currentTarget, event.clientX));
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) setDraftIndex(pointerIndex(event.currentTarget, event.clientX));
        }}
        onPointerUp={(event) => {
          const index = pointerIndex(event.currentTarget, event.clientX);
          setDraftIndex(index);
          commit(index);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyUp={() => commit()}
        onBlur={() => commit()}
      />
      <div className="dg-nearby-radius-labels">{radii.map((value, index) => <button type="button" key={value} className={index === draftIndex ? "active" : ""} onClick={() => { setDraftIndex(index); commit(index); }}>{value === 1000 ? "1km" : `${value}m`}</button>)}</div>
    </div>
  </section>;
}

function NearbyPlacesPanel({ program, summary, loading, radius, category, selected, walkingRoute, embedded = false, onBack, onRadius, onCategory, onSelect, onShowOnMap }: {
  program: WebProgram; summary: WebNearbyPlacesSummary | null; loading: boolean; radius: number; category: NearbyCategory; selected: WebNearbyPlace | null; walkingRoute: WebRouteResult | null;
  embedded?: boolean;
  onBack: () => void; onRadius: (value: number) => void; onCategory: (value: NearbyCategory) => void; onSelect: (place: WebNearbyPlace) => void; onShowOnMap?: (place: WebNearbyPlace) => void;
}) {
  const places = (summary?.places ?? []).filter((place) => category === "all" || place.placeType === category);
  const categoryTitle: Record<NearbyCategory, string> = { all: "전체", restaurant: "음식점", cafe: "카페", fast_food: "패스트푸드", convenience_store: "편의점", other_food: "분식" };
  return <section className={`dg-aux-panel${embedded ? " dg-route-nearby-panel" : ""}`}>{!embedded && <PanelHeader title="주변 가게" subtitle={`${program.facility}에서 걸어서 갈 만한 곳`} onBack={onBack} />}<NearbyRadiusSelector radius={radius} onRadius={onRadius} /><div className="dg-nearby-categories">{(Object.keys(categoryTitle) as NearbyCategory[]).map((value) => <button type="button" key={value} className={category === value ? "active" : ""} onClick={() => onCategory(value)}>{categoryTitle[value]} {value === "all" ? summary?.totalCount ?? 0 : summary?.categoryCounts[value] ?? 0}</button>)}</div>{selected && <div className="dg-nearby-route-summary"><strong>{nearbyDisplayName(selected)}</strong><span>{walkingRoute ? `도보 약 ${walkingRoute.totalMinutes}분 · ${distanceLabel(walkingRoute.totalDistanceMeters)}` : `직선 ${distanceLabel(selected.distanceMeters)} · 도보 경로 계산 중`}</span></div>}<div className="dg-aux-list dg-nearby-list">{loading ? <div className="dg-loading"><strong>목적지 주변을 찾고 있어요</strong></div> : places.length ? <>{places.map((place) => {
    const displayName = nearbyDisplayName(place);
    const explicitlyOpen = /^(?:영업|영업중|정상)$/.test(cleanMapText(place.businessStatusName));
    const walkMinutes = Math.max(1, Math.ceil(place.distanceMeters / 75));
    return <article id={`nearby-place-${place.id}`} className={`dg-nearby-card${selected?.id === place.id ? " selected" : ""}`} key={place.id}>
      <div className="dg-nearby-card-top">
        {explicitlyOpen ? <span>영업중</span> : <i />}
        <div className="dg-nearby-map-actions">
          <button type="button" aria-label={`동네고고 지도에서 ${displayName} 마커 강조`} onClick={() => (onShowOnMap ?? onSelect)(place)}><span className="dg-nearby-dongne-map-icon" aria-hidden="true">🗺️</span><span>동네고고 지도</span></button>
          <a href={nearbyNaverMapURL(place)} target="_blank" rel="noreferrer" aria-label={`네이버 지도에서 ${displayName} 검색`}><span className="dg-nearby-brand naver" aria-hidden="true" /><span>네이버 지도</span></a>
          <a href={nearbyKakaoMapURL(place)} target="_blank" rel="noreferrer" aria-label={`카카오 지도에서 ${displayName} 검색`}><span className="dg-nearby-brand kakao" aria-hidden="true" /><span>카카오 지도</span></a>
        </div>
      </div>
      <div className="dg-nearby-card-main"><span className="dg-place-type"><NearbyPlaceIcon placeType={place.placeType} /></span><span><strong>{displayName}</strong><em>{nearbyCategoryDisplayName(place)} · {distanceLabel(place.distanceMeters)} · 도보 약 {walkMinutes}분</em><em className="dg-nearby-address">{place.address ?? "주소 정보 없음"}</em><em className="dg-parking-copy"><CarFront aria-hidden="true" />{nearbyParkingLabel(place)}</em></span></div>
    </article>;
  })}{summary && !summary.isComplete && <p className="dg-nearby-limit">반경 안 {summary.totalCount.toLocaleString("ko-KR")}곳 중 가까운 순으로 {places.length.toLocaleString("ko-KR")}곳을 보여드려요.</p>}</> : <div className="dg-empty"><strong>이 반경에는 표시할 가게가 없어요.</strong><p>반경을 넓혀 다시 찾아보세요.</p></div>}</div></section>;
}
