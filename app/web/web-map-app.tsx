"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { WebHeatShelter, WebMapCluster, WebMapViewportResult, WebNearbyPlace, WebNearbyPlacesSummary, WebProgram } from "@/lib/web-program-data";
import { officialProgramAccess } from "@/lib/official-program-access";
import { dominantProgram, programIconName } from "@/lib/web-icon-mapper";
import { haversineMeters, parseSearchIntent, relaxedSuggestions, searchPrograms, type SearchIntent } from "@/lib/web-search-engine";

type KakaoLatLng = { getLat: () => number; getLng: () => number };
type KakaoBounds = { getSouthWest: () => KakaoLatLng; getNorthEast: () => KakaoLatLng; extend: (position: KakaoLatLng) => void };
type KakaoMap = {
  getBounds: () => KakaoBounds; getCenter: () => KakaoLatLng; getLevel: () => number;
  setBounds: (bounds: KakaoBounds, ...padding: number[]) => void; setCenter: (position: KakaoLatLng) => void;
  setLevel: (level: number) => void; panTo: (position: KakaoLatLng) => void;
};
type KakaoOverlay = { setMap: (map: KakaoMap | null) => void };
type KakaoMaps = {
  load: (callback: () => void) => void;
  Map: new (element: HTMLDivElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  CustomOverlay: new (options: { map: KakaoMap; position: KakaoLatLng; content: HTMLElement; yAnchor: number; zIndex: number }) => KakaoOverlay;
  event: { addListener: (map: KakaoMap, event: string, callback: () => void) => void };
  services?: {
    Status: { OK: string };
    Geocoder: new () => { coord2RegionCode: (longitude: number, latitude: number, callback: (result: Array<{ region_type: string; address_name: string; region_2depth_name: string; region_3depth_name: string }>, status: string) => void) => void };
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
type AuxiliaryPanel = "calendar" | "family" | "history" | "nearby" | null;
type PlaceSheetState = { programs: WebProgram[]; index: number; expectedCount: number; loading: boolean };
type NearbyCategory = "all" | WebNearbyPlace["placeType"];

const FALLBACK: Coordinate = { latitude: 37.6027, longitude: 127.0128 };
const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "map", icon: "●", label: "지도" },
  { id: "search", icon: "⌕", label: "찾기" },
  { id: "openrun", icon: "♧", label: "오픈런" },
  { id: "saved", icon: "♡", label: "찜" },
  { id: "me", icon: "♙", label: "내정보" },
];

const SEARCH_EXAMPLES = [
  "이번 주말 아이랑 갈 무료 행사",
  "오픈런 접수 시작하는 강좌",
  "우리 동네 시니어 컴퓨터 교실",
  "가까운 무료 수영 강좌",
  "어르신 미술 공예 프로그램",
  "오전에 들을 수 있는 음악 강좌",
];

const SUBJECT_FILTERS = ["음악", "외국어", "수영", "글쓰기", "탁구", "에어로빅", "미술", "요가", "독서논술", "농구", "우쿨렐레", "스마트폰", "건강체조", "요리", "인문학", "공연/전시", "복지", "테니스", "기타"];

function distanceMeters(a: Coordinate, b: Coordinate) {
  return haversineMeters(a, b);
}

function distanceLabel(meters: number) {
  if (!Number.isFinite(meters)) return "거리 확인 중";
  return meters < 1_000 ? `${Math.max(10, Math.round(meters / 10) * 10)}m` : `${(meters / 1_000).toFixed(1)}km`;
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

function aggregationScope(radiusKm: number): WebMapCluster["scope"] {
  if (radiusKm < 5.5) return "localArea";
  if (radiusKm < 14) return "neighborhood";
  if (radiusKm < 50) return "district";
  if (radiusKm < 180) return "city";
  return "province";
}

function markerPlaceKey(program: WebProgram) {
  return `${program.latitude.toFixed(5)}:${program.longitude.toFixed(5)}`;
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

function mapLink(program: WebProgram) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(program.facility)},${program.latitude},${program.longitude}`;
}

function routeLink(program: WebProgram, current: Coordinate, transport: Transport) {
  const route = transport === "walk" ? "walk" : transport === "car" ? "car" : "transit";
  return `https://map.kakao.com/link/to/${encodeURIComponent(program.facility)},${program.latitude},${program.longitude}?from=${current.latitude},${current.longitude}&route=${route}`;
}

async function fetchPrograms(params: URLSearchParams, signal?: AbortSignal): Promise<WebProgram[]> {
  const response = await fetch(`/api/web-programs?${params}`, { signal, cache: "no-store" });
  const payload = await response.json() as { programs?: WebProgram[]; message?: string };
  if (!response.ok) throw new Error(payload.message ?? "프로그램을 불러오지 못했습니다.");
  return payload.programs ?? [];
}

export default function WebMapApp({ kakaoMapKey }: { kakaoMapKey: string }) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const mapModeRef = useRef<"individual" | "cluster">("individual");
  const searchActiveRef = useRef(false);
  const heatShelterModeRef = useRef(false);
  const [programs, setPrograms] = useState<WebProgram[]>([]);
  const [mapClusters, setMapClusters] = useState<WebMapCluster[]>([]);
  const [programCounts, setProgramCounts] = useState<Record<string, number>>({});
  const [mapMode, setMapMode] = useState<"individual" | "cluster">("individual");
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<WebProgram | null>(null);
  const [placeSheet, setPlaceSheet] = useState<PlaceSheetState | null>(null);
  const [auxiliaryPanel, setAuxiliaryPanel] = useState<AuxiliaryPanel>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [query, setQuery] = useState("");
  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  const [searchCandidates, setSearchCandidates] = useState<WebProgram[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("distance");
  const [fieldFilter, setFieldFilter] = useState("전체");
  const [audienceFilter, setAudienceFilter] = useState<string | null>(null);
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [todayOnly, setTodayOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [paidOnly, setPaidOnly] = useState(false);
  const [seniorOnly, setSeniorOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [location, setLocation] = useState<Coordinate>(FALLBACK);
  const [usesFallbackLocation, setUsesFallbackLocation] = useState(true);
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

  useEffect(() => {
    const read = (key: string) => {
      try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; }
    };
    const hydratePreferences = () => {
      setFavorites(read("dongnegogo.web.favorites"));
      setReminders(read("dongnegogo.web.reminders"));
      setBigText(localStorage.getItem("dongnegogo.web.bigText") === "true");
      setEasyFirst(localStorage.getItem("dongnegogo.web.easyFirst") !== "false");
      setPhoneFirst(localStorage.getItem("dongnegogo.web.phoneFirst") === "true");
      setBigAlerts(localStorage.getItem("dongnegogo.web.bigAlerts") !== "false");
      setRecentSearches(read("dongnegogo.web.recentSearches").slice(0, 8));
      try {
        const history = JSON.parse(localStorage.getItem("dongnegogo.web.viewHistory") ?? "[]") as Array<{ program: WebProgram; viewedAt: string }>;
        const sevenDaysAgo = Date.now() - 7 * 86_400_000;
        setViewHistory(history.filter((item) => item?.program?.id && item.viewedAt && new Date(item.viewedAt).getTime() >= sevenDaysAgo).slice(0, 80));
      } catch { setViewHistory([]); }
    };
    const frame = window.requestAnimationFrame(hydratePreferences);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const persistList = useCallback((key: string, value: string[]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      persistList("dongnegogo.web.favorites", next);
      return next;
    });
  }, [persistList]);

  const toggleReminder = useCallback((id: string) => {
    setReminders((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      persistList("dongnegogo.web.reminders", next);
      return next;
    });
  }, [persistList]);

  const recordHistory = useCallback((program: WebProgram) => {
    setViewHistory((previous) => {
      const next = [{ program, viewedAt: new Date().toISOString() }, ...previous.filter((item) => item.program.id !== program.id)].slice(0, 80);
      localStorage.setItem("dongnegogo.web.viewHistory", JSON.stringify(next));
      return next;
    });
  }, []);

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
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
      const mapCenter = map.getCenter();
      const nextCenter = { latitude: mapCenter.getLat(), longitude: mapCenter.getLng() };
      setCenter(nextCenter);
      setMapLevel(map.getLevel());
      resolveCenteredArea(nextCenter);
    const params = new URLSearchParams({
      south: String(sw.getLat()), west: String(sw.getLng()),
      north: String(ne.getLat()), east: String(ne.getLng()),
      previousMode: mapModeRef.current,
      scope: aggregationScope(distanceMeters(nextCenter, { latitude: ne.getLat(), longitude: ne.getLng() }) / 1_000),
    });
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      if (heatShelterModeRef.current) {
        const heatParams = new URLSearchParams({
          south: String(sw.getLat()), west: String(sw.getLng()), north: String(ne.getLat()), east: String(ne.getLng()),
          centerLatitude: String(nextCenter.latitude), centerLongitude: String(nextCenter.longitude),
        });
        const heatResponse = await fetch(`/api/web-heat-shelters?${heatParams}`, { signal: controller.signal });
        const heatPayload = await heatResponse.json() as { shelters?: WebHeatShelter[]; message?: string };
        if (!heatResponse.ok) throw new Error(heatPayload.message ?? "무더위쉼터를 불러오지 못했습니다.");
        setHeatShelters(heatPayload.shelters ?? []);
        setPrograms([]);
        setMapClusters([]);
        setMapMode("individual");
        setError("");
        return;
      }
      const response = await fetch(`/api/web-map?${params}`, { signal: controller.signal, cache: "no-store" });
      const payload = await response.json() as WebMapViewportResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "지도 프로그램을 불러오지 못했습니다.");
      if (payload.mode === "cluster") {
        const listParams = new URLSearchParams({
          south: String(sw.getLat()), west: String(sw.getLng()), north: String(ne.getLat()), east: String(ne.getLng()), limit: "4000",
        });
        setPrograms(await fetchPrograms(listParams, controller.signal));
      } else {
        setPrograms(payload.programs);
      }
      setMapClusters(payload.clusters);
      setProgramCounts(payload.programCounts ?? {});
      setMapMode(payload.mode);
      mapModeRef.current = payload.mode;
      setError("");
    } catch (fetchError) {
      if ((fetchError as Error).name !== "AbortError") setError((fetchError as Error).message);
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }, [resolveCenteredArea]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current || !kakaoMapKey) return;
    let disposed = false;
    const start = () => window.kakao?.maps.load(() => {
      if (disposed || !mapElementRef.current || mapRef.current) return;
      const maps = window.kakao.maps;
      const map = new maps.Map(mapElementRef.current, {
        center: new maps.LatLng(FALLBACK.latitude, FALLBACK.longitude), level: 5,
      });
      mapRef.current = map;
      setMapReady(true);
      maps.event.addListener(map, "idle", () => {
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = window.setTimeout(() => loadBounds(map), 180);
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
    return () => { disposed = true; };
  }, [kakaoMapKey, loadBounds]);

  const toggleHeatShelterMode = () => {
    const next = !heatShelterMode;
    heatShelterModeRef.current = next;
    setHeatShelterMode(next);
    setSelected(null);
    setSelectedHeatShelter(null);
    setPlaceSheet(null);
    if (!next) setHeatShelters([]);
    if (mapRef.current) window.setTimeout(() => mapRef.current && void loadBounds(mapRef.current), 0);
  };

  const visiblePrograms = useMemo(() => {
    const items = programs.filter((program) => {
      if (!fieldMatches(program, fieldFilter)) return false;
      if (freeOnly && !program.isFree) return false;
      if (paidOnly && program.isFree) return false;
      if (seniorOnly && !program.isSeniorRecommended && !program.audiences.some((audience) => /시니어|어르신|노인|65세/.test(audience))) return false;
      if (audienceFilter) {
        const audienceText = `${program.audiences.join(" ")} ${program.requirement ?? ""} ${program.name}`;
        const pattern = audienceFilter === "시니어" ? /시니어|어르신|노인|65세|실버|성인/ : audienceFilter === "성인" ? /성인|일반|직장인/ : audienceFilter === "어린이" ? /아이|아동|어린이|유아|초등|청소년|키즈/ : audienceFilter === "가족" ? /가족|부모|아이|아동|어린이/ : /직장인|성인|일반/;
        if (!pattern.test(audienceText)) return false;
      }
      if (subjectFilters.length) {
        const searchable = `${program.name} ${program.category} ${program.field} ${program.rawCategory} ${program.rawField}`;
        if (!subjectFilters.some((subject) => subject === "기타" ? true : searchable.includes(subject.replace("독서논술", "독서")))) return false;
      }
      if (statusFilter !== "전체" && (statusFilter === "접수중" ? !/접수중|상시|진행중|가능|안내중/.test(program.status) : statusFilter === "접수예정" ? !/예정|곧/.test(program.status) : !/마감임박/.test(program.status))) return false;
      if (todayOnly && !/접수중|상시|진행중|가능|안내중|마감임박/.test(program.status)) return false;
      if (radiusKm !== null && distanceMeters(location, program) > radiusKm * 1_000) return false;
      if (tab === "saved" && !favorites.includes(program.id)) return false;
      if (tab === "openrun" && (!program.receiptStart || !isAvailable(program))) return false;
      return true;
    });
    return items.sort((a, b) => {
      if (sort === "free" && a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      if (sort === "available" && isAvailable(a) !== isAvailable(b)) return isAvailable(a) ? -1 : 1;
      return distanceMeters(center, a) - distanceMeters(center, b);
    });
  }, [programs, fieldFilter, freeOnly, paidOnly, seniorOnly, audienceFilter, subjectFilters, statusFilter, todayOnly, radiusKm, location, tab, favorites, sort, center]);

  const visibleClusters = useMemo(() => {
    const limitByScope: Record<WebMapCluster["scope"], number> = { localArea: 12, neighborhood: 22, district: 18, city: 16, province: 18 };
    const limit = limitByScope[mapClusters[0]?.scope ?? "localArea"];
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

  const openProgramSheet = useCallback(async (group: WebProgram[], expectedCount: number) => {
    const initial = [...group].sort((a, b) => statusRank(a) - statusRank(b) || a.id.localeCompare(b.id));
    setSelected(null);
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
    if (!map || !window.kakao?.maps) return;
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
    if (mapMode === "cluster" && tab === "map" && fieldFilter === "전체" && !freeOnly && !paidOnly && !seniorOnly && !audienceFilter && subjectFilters.length === 0 && statusFilter === "전체" && !todayOnly && radiusKm === null) {
      visibleClusters.forEach((cluster) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `dg-cluster-marker dg-cluster-${cluster.scope}`;
        button.setAttribute("aria-label", `${cluster.areaName} ${cluster.programCount}개 프로그램`);
        const area = document.createElement("strong");
        area.textContent = cluster.areaName.replace(/특별시|광역시|특별자치도/g, "");
        const count = document.createElement("span");
        count.textContent = cluster.scope === "localArea" ? String(cluster.programCount) : `강좌 ${cluster.programCount}`;
        const insight = document.createElement("small");
        insight.textContent = cluster.categoryName || "신청 가능한 프로그램";
        button.append(area, count, insight);
        button.addEventListener("click", () => {
          map.panTo(new window.kakao!.maps.LatLng(cluster.latitude, cluster.longitude));
          map.setLevel(Math.max(1, map.getLevel() - 2));
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
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dg-map-marker${selected?.id === representative.id ? " is-selected" : ""}`;
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
      const overlay = new window.kakao.maps.CustomOverlay({
        map, position: new window.kakao.maps.LatLng(representative.latitude, representative.longitude),
        content: button, yAnchor: 1.15, zIndex: selected?.id === representative.id ? 10 : 2,
      });
      overlaysRef.current.push(overlay);
    });
    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, [visiblePrograms, visibleClusters, selected, selectedHeatShelter, heatShelterMode, heatShelters, mapLevel, mapMode, programCounts, tab, fieldFilter, freeOnly, paidOnly, seniorOnly, audienceFilter, subjectFilters, statusFilter, todayOnly, radiusKm, openProgramSheet]);

  const runSearch = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term) { searchActiveRef.current = false; setSearchIntent(null); setTab("map"); if (mapRef.current) loadBounds(mapRef.current); return; }
    searchActiveRef.current = true;
    setTab("search");
    setSelected(null);
    setLoading(true);
    setSearchProgress(18);
    try {
      const intent = parseSearchIntent(term);
      setSearchIntent(intent);
      const params = new URLSearchParams();
      intent.subjectTerms.forEach((value) => params.append("subject", value));
      intent.areaTerms.forEach((value) => params.append("area", value));
      intent.generalTerms.forEach((value) => params.append("general", value));
      const candidates = await fetchPrograms(params);
      setSearchProgress(82);
      setSearchCandidates(candidates);
      const matches = searchPrograms(candidates, intent, location).map((item) => item.program);
      setPrograms(matches);
      setMapMode("individual");
      setMapClusters([]);
      const nextRecent = [term, ...recentSearches.filter((item) => item !== term)].slice(0, 8);
      setRecentSearches(nextRecent);
      localStorage.setItem("dongnegogo.web.recentSearches", JSON.stringify(nextRecent));
      setError("");
      setSearchProgress(100);
      if (mapRef.current && matches.length && window.kakao?.maps) {
        const bounds = new window.kakao.maps.LatLngBounds();
        matches.slice(0, 120).forEach((program) => bounds.extend(new window.kakao.maps.LatLng(program.latitude, program.longitude)));
        mapRef.current.setBounds(bounds, 70, 70, 70, 70);
      }
    } catch (searchError) { setError((searchError as Error).message); }
    finally { setLoading(false); }
  };

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    void runSearch(query);
  };

  const chooseSearch = (term: string) => {
    setQuery(term);
    void runSearch(term);
  };

  const applyRelaxedIntent = (intent: SearchIntent) => {
    setSearchIntent(intent);
    setPrograms(searchPrograms(searchCandidates, intent, location).map((item) => item.program));
  };

  const removeIntentChip = (chip: string) => {
    if (!searchIntent) return;
    const next: SearchIntent = {
      ...searchIntent,
      subjectTerms: searchIntent.subjectTerms.filter((term) => term !== chip),
      areaTerms: searchIntent.areaTerms.filter((term) => term !== chip),
      audiences: ["어르신", "아이", "가족", "직장인"].includes(chip) ? [] : searchIntent.audiences,
      free: ["무료", "유료"].includes(chip) ? null : searchIntent.free,
      day: ["주말", "평일"].includes(chip) ? null : searchIntent.day,
      time: ["오전", "오후", "저녁"].includes(chip) ? null : searchIntent.time,
      status: ["접수중", "접수예정", "마감임박"].includes(chip) ? null : searchIntent.status,
      dateTarget: ["오늘", "내일"].includes(chip) ? null : searchIntent.dateTarget,
      radiusKm: chip.endsWith("km 이내") ? null : searchIntent.radiusKm,
      chips: searchIntent.chips.filter((item) => item !== chip),
    };
    setSearchIntent(next);
    setPrograms(searchPrograms(searchCandidates, next, location).map((item) => item.program));
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onerror: () => void; start: () => void }; webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onerror: () => void; start: () => void } }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("이 브라우저에서는 음성 검색을 지원하지 않아요."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.onresult = (event) => chooseSearch(event.results[0][0].transcript);
    recognition.onerror = () => setError("음성을 듣지 못했어요. 다시 시도해 주세요.");
    recognition.start();
  };

  const moveToCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocation(next);
      setUsesFallbackLocation(false);
      resolveCenteredArea(next);
      if (mapRef.current && window.kakao?.maps) {
        mapRef.current.setCenter(new window.kakao.maps.LatLng(next.latitude, next.longitude));
        mapRef.current.setLevel(4);
      }
    }, () => setError("위치 권한이 없어 기본 지역을 기준으로 보여드려요."), { enableHighAccuracy: false, timeout: 8_000 });
  };

  const share = async (program: WebProgram) => {
    const url = `${location.origin}/program/${encodeURIComponent(program.id)}`;
    const data = { title: program.name, text: `${program.name} · ${program.facility}`, url };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard?.writeText(url);
  };

  const setPreference = (key: string, value: boolean, setter: (value: boolean) => void) => {
    setter(value);
    localStorage.setItem(`dongnegogo.web.${key}`, String(value));
  };

  const resetFilters = () => {
    setFieldFilter("전체");
    setAudienceFilter(null);
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
    setNearbyCategory("all");
    setNearbyLoading(true);
    setAuxiliaryPanel("nearby");
    setSelected(null);
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

  const changeTab = (nextTab: Tab) => {
    searchActiveRef.current = nextTab === "search";
    if (nextTab !== "search") setSearchIntent(null);
    setTab(nextTab);
    setSelected(null);
    setPlaceSheet(null);
    setAuxiliaryPanel(null);
    if (nextTab !== "search" && mapRef.current) window.setTimeout(() => mapRef.current && loadBounds(mapRef.current), 0);
  };

  return (
    <main className={`dg-web-app${bigText ? " dg-big-text" : ""}`}>
      <aside className="dg-nav-rail" aria-label="웹 버전 메뉴">
        <Link className="dg-brand-mark" href="/" aria-label="동네고고 소개 페이지로 돌아가기">
          <img src="/brand/app-icon.png" alt="" /><strong>동네<br />고고</strong>
        </Link>
        <nav>
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id && !selected ? "active" : ""} onClick={() => changeTab(item.id)}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <Link className="dg-home-link" href="/">소개 페이지</Link>
      </aside>

      <section className="dg-side-panel" aria-label="프로그램 탐색 패널">
        {selectedHeatShelter ? (
          <HeatShelterDetail shelter={selectedHeatShelter} current={location} onBack={() => setSelectedHeatShelter(null)} />
        ) : selected ? (
          <ProgramDetail
            program={selected} current={location} favorite={favorites.includes(selected.id)}
            usesFallbackLocation={usesFallbackLocation}
            reminder={reminders.includes(selected.id)} transport={transport} easyFirst={easyFirst}
            onBack={() => setSelected(null)} onFavorite={() => toggleFavorite(selected.id)}
            onReminder={() => toggleReminder(selected.id)} onTransport={setTransport}
            onShare={() => share(selected)}
            onNearby={() => { void loadNearbyPlaces(selected, 100); }}
          />
        ) : auxiliaryPanel === "nearby" && nearbyDestination ? (
          <NearbyPlacesPanel
            program={nearbyDestination} summary={nearbySummary} loading={nearbyLoading} radius={nearbyRadius} category={nearbyCategory}
            onBack={() => { setAuxiliaryPanel(null); setSelected(nearbyDestination); }}
            onRadius={(value) => { void loadNearbyPlaces(nearbyDestination, value); }} onCategory={setNearbyCategory}
          />
        ) : auxiliaryPanel === "calendar" ? (
          <CalendarPanel programs={programs} reminders={reminders} onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }} />
        ) : auxiliaryPanel === "family" ? (
          <FamilyPanel programs={programs} onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }} />
        ) : auxiliaryPanel === "history" ? (
          <HistoryPanel history={viewHistory} onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }} />
        ) : tab === "me" ? (
          <section className="dg-profile-panel">
            <div className="dg-panel-title"><Link href="/">‹ 지도</Link><h1>내정보</h1></div>
            <div className="dg-profile-card">
              <small>우리 동네</small><strong>서울시 성북구 정릉동</strong><button type="button" onClick={moveToCurrentLocation}>현재 위치로 변경</button>
            </div>
            <div className="dg-profile-card">
              <small>누구를 위한 추천을 받을까요?</small>
              <div className="dg-segmented"><button type="button" className={!seniorOnly ? "active" : ""} onClick={() => setSeniorOnly(false)}>나를 위한</button><button type="button" className={seniorOnly ? "active" : ""} onClick={() => setSeniorOnly(true)}>부모님을 위한</button></div>
            </div>
            <div className="dg-profile-card">
              <small>보기 편하게 설정하기</small>
              <Preference label="글씨 크게 보기" value={bigText} onChange={(value) => setPreference("bigText", value, setBigText)} />
              <Preference label="쉬운 설명 우선" value={easyFirst} onChange={(value) => setPreference("easyFirst", value, setEasyFirst)} />
              <Preference label="전화 문의 버튼 먼저 보기" value={phoneFirst} onChange={(value) => setPreference("phoneFirst", value, setPhoneFirst)} />
              <Preference label="알림 크게 받기" value={bigAlerts} onChange={(value) => setPreference("bigAlerts", value, setBigAlerts)} />
            </div>
            <p className="dg-readonly-note">찜과 설정은 이 브라우저에만 저장됩니다. Supabase 데이터는 변경하지 않습니다.</p>
          </section>
        ) : tab === "openrun" ? (
          <OpenRunPanel programs={programs} reminders={reminders} onToggleReminder={(program) => toggleReminder(program.id)} onOpen={(program) => { void selectProgram(program); }} />
        ) : (
          <>
            <header className="dg-panel-header">
              <div className="dg-panel-title"><Link href="/">‹ 소개</Link><h1>{tab === "saved" ? "찜한 프로그램" : tab === "openrun" ? "오픈런" : tab === "search" ? "찾기" : "지도 주변"}</h1></div>
              <form className="dg-search" onSubmit={submitSearch}>
                <span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시설명·강좌명 또는 자연어로 검색" aria-label="프로그램 검색" />
                {query && <button type="button" className="dg-clear" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
                <button type="button" className="dg-voice" onClick={startVoiceSearch} aria-label="음성으로 검색">◉</button>
                <button type="submit" className="dg-search-button">검색</button>
              </form>
              {tab === "search" && searchIntent && <div className="dg-intent-chips" aria-label="검색 조건">{searchIntent.chips.map((chip) => <button key={chip} type="button" onClick={() => removeIntentChip(chip)} aria-label={`${chip} 조건 삭제`}>{chip} ×</button>)}</div>}
              {tab === "search" && !searchIntent && <div className="dg-search-suggestions">
                {SEARCH_EXAMPLES.map((example) => <button key={example} type="button" onClick={() => chooseSearch(example)}>{example}</button>)}
                {recentSearches.length > 0 && <><small>최근 검색 <button type="button" onClick={() => { setRecentSearches([]); localStorage.removeItem("dongnegogo.web.recentSearches"); }}>전체 삭제</button></small>{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => chooseSearch(recent)}>↻ {recent}</button>)}</>}
              </div>}
              {tab === "search" && searchIntent && <p className="dg-search-scope">{loading ? `${centeredArea.split(" ").slice(0, 2).join(" ")} 지역 기준으로 먼저 찾고 있어요. ${searchProgress}%` : `${centeredArea.split(" ").slice(0, 2).join(" ")} 지역 기준 ${visiblePrograms.length}곳을 찾았어요.`}</p>}
              <div className="dg-location-row"><button type="button" onClick={moveToCurrentLocation}>● {centeredArea.split(" ").slice(-2).join(" ")}</button><span>{heatShelterMode ? `${heatShelters.length}곳` : `${visiblePrograms.length}곳`}</span></div>
              <div className="dg-filter-row">
                <button type="button" className={heatShelterMode ? "active heat" : ""} onClick={toggleHeatShelterMode}>❄ 무더위쉼터</button>
                {["교육", "문화예술", "건강운동", "공연전시", "복지", "디지털"].map((field) => <button key={field} type="button" className={!heatShelterMode && fieldFilter === field ? "active" : ""} onClick={() => {
                  if (heatShelterMode) { heatShelterModeRef.current = false; setHeatShelterMode(false); setHeatShelters([]); }
                  setFieldFilter(fieldFilter === field ? "전체" : field);
                  if (mapRef.current) window.setTimeout(() => mapRef.current && void loadBounds(mapRef.current), 0);
                }}>{field}</button>)}
                <button type="button" className={freeOnly ? "active" : ""} onClick={() => setFreeOnly((value) => !value)}>무료</button>
                <button type="button" className={audienceFilter === "시니어" ? "active" : ""} onClick={() => setAudienceFilter((value) => value === "시니어" ? null : "시니어")}>시니어</button>
                <button type="button" className={todayOnly ? "active" : ""} onClick={() => setTodayOnly((value) => !value)}>오늘 신청</button>
                <button type="button" className={statusFilter === "접수중" ? "active" : ""} onClick={() => setStatusFilter((value) => value === "접수중" ? "전체" : "접수중")}>접수중</button>
                <button type="button" className={showFilter ? "active" : ""} onClick={() => setShowFilter(true)} aria-label="전체 조건 열기">☰ 필터</button>
              </div>
              <div className="dg-sort-row">
                <button type="button" className={sort === "distance" ? "active" : ""} onClick={() => setSort("distance")}>가까운 순</button>
                <button type="button" className={sort === "available" ? "active" : ""} onClick={() => setSort("available")}>신청 가능 순</button>
                <button type="button" className={sort === "free" ? "active" : ""} onClick={() => setSort("free")}>무료 먼저</button>
              </div>
            </header>
            <div className="dg-result-list">
              {loading && <div className="dg-loading"><img src="/web-assets/beodeuli-search-assistant.png" alt="" /><strong>{heatShelterMode ? "무더위쉼터를 불러오고 있어요" : "우리 동네 프로그램을 찾고 있어요"}</strong>{tab === "search" && <progress max="100" value={searchProgress} aria-label="검색 진행률" />}</div>}
              {!loading && error && <div className="dg-empty"><strong>{error}</strong><button type="button" onClick={() => mapRef.current && loadBounds(mapRef.current)}>다시 불러오기</button></div>}
              {!loading && !error && !heatShelterMode && visiblePrograms.length === 0 && <div className="dg-empty"><img src="/web-assets/beodeuli-search-success.png" alt="" /><strong>조건에 맞는 프로그램을 못 찾았어요.</strong><p>조건 하나만 넓혀 다시 찾아볼 수 있어요.</p>{searchIntent && <div className="dg-relaxed-search">{relaxedSuggestions(searchIntent).map((item) => <button key={item.label} type="button" onClick={() => applyRelaxedIntent(item.intent)}>{item.label}</button>)}</div>}</div>}
              {!loading && !heatShelterMode && visiblePrograms.slice(0, 160).map((program) => (
                <button className={`dg-program-card ${selected?.id === program.id ? "selected" : ""}`} type="button" key={program.id} onClick={() => { void selectProgram(program); }}>
                  <img src={`/markers/${programIconName(program)}.png`} alt="" />
                  <span className="dg-card-copy"><span className={`dg-status ${statusClass(program)}`}>{program.status}</span><strong>{program.name}</strong><small>{distanceLabel(distanceMeters(center, program))} · {program.facility}</small><em>{program.isFree ? "무료" : program.feeText}</em></span>
                  <span className="dg-card-arrow" aria-hidden="true">›</span>
                </button>
              ))}
              {!loading && heatShelterMode && heatShelters.map((shelter) => <button className="dg-program-card" type="button" key={shelter.id} onClick={() => setSelectedHeatShelter(shelter)}><img src="/markers/icon_heat_shelter.png" alt="" /><span className="dg-card-copy"><span className="dg-status">운영 정보 확인</span><strong>{shelter.name}</strong><small>{distanceLabel(distanceMeters(center, shelter))} · {shelter.roadAddress ?? shelter.address ?? "주소 정보 없음"}</small><em>{shelter.airconCount ? `에어컨 ${shelter.airconCount}대` : "냉방 시설"}</em></span><span className="dg-card-arrow">›</span></button>)}
            </div>
          </>
        )}
      </section>

      <section className="dg-map-area" aria-label="Kakao 지도">
        <div ref={mapElementRef} className="dg-map-canvas" />
        {!mapReady && <div className="dg-map-skeleton"><img src="/brand/app-icon.png" alt="" /><strong>지도를 준비하고 있어요</strong></div>}
        <div className="dg-map-tools" aria-label="지도 도구">
          <button type="button" onClick={moveToCurrentLocation}><span>●</span>내 위치</button>
          <button type="button" onClick={() => { setAuxiliaryPanel(null); changeTab("map"); }}><span>▣</span>주변</button>
          <button type="button" onClick={() => { setSelected(null); setPlaceSheet(null); setAuxiliaryPanel("calendar"); }}><span>▦</span>일정</button>
          <button type="button" onClick={() => { setSelected(null); setPlaceSheet(null); setAuxiliaryPanel("family"); }}><span>♧</span>가족</button>
          <button type="button" onClick={() => { setSelected(null); setPlaceSheet(null); setAuxiliaryPanel("history"); }}><span>▰</span>보관함</button>
        </div>
        <div className="dg-zoom-tools"><button type="button" aria-label="지도 확대" onClick={() => mapRef.current?.setLevel(Math.max(1, mapRef.current.getLevel() - 1))}>＋</button><button type="button" aria-label="지도 축소" onClick={() => mapRef.current?.setLevel(Math.min(14, mapRef.current.getLevel() + 1))}>−</button></div>
        <div className="dg-map-caption"><strong>{centeredArea} 주변</strong><span>지도를 움직이면 자동으로 다시 찾아요</span></div>
        {placeSheet && <ProgramPlaceSheet
          state={placeSheet}
          current={location}
          onClose={() => setPlaceSheet(null)}
          onIndex={(index) => setPlaceSheet((current) => current ? { ...current, index } : current)}
          onDetail={(program) => { void selectProgram(program); }}
          onReminder={(program) => toggleReminder(program.id)}
          reminderIDs={reminders}
        />}
      </section>
      {showFilter && <FullFilterDialog
        field={fieldFilter} audience={audienceFilter} subjects={subjectFilters} status={statusFilter}
        freeOnly={freeOnly} paidOnly={paidOnly} radiusKm={radiusKm} count={visiblePrograms.length}
        onField={setFieldFilter} onAudience={setAudienceFilter} onSubjects={setSubjectFilters}
        onStatus={setStatusFilter} onFree={(value) => { setFreeOnly(value); if (value) setPaidOnly(false); }}
        onPaid={(value) => { setPaidOnly(value); if (value) setFreeOnly(false); }} onRadius={setRadiusKm}
        onReset={resetFilters} onClose={() => setShowFilter(false)}
      />}
    </main>
  );
}

function Preference({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="dg-preference"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function ProgramDetail({ program, current, usesFallbackLocation, favorite, reminder, transport, easyFirst, onBack, onFavorite, onReminder, onTransport, onShare, onNearby }: {
  program: WebProgram; current: Coordinate; usesFallbackLocation: boolean; favorite: boolean; reminder: boolean; transport: Transport; easyFirst: boolean;
  onBack: () => void; onFavorite: () => void; onReminder: () => void; onTransport: (value: Transport) => void; onShare: () => void; onNearby: () => void;
}) {
  const distance = distanceMeters(current, program);
  const routeEstimate = estimatedRoute(distance, transport);
  const transportLabel = transport === "walk" ? "도보" : transport === "car" ? "자동차" : "대중교통";
  const officialAccess = officialProgramAccess(program.applyUrl);
  return (
    <article className="dg-detail">
      <header className="dg-detail-hero">
        <div className="dg-detail-actions"><button type="button" onClick={onBack} aria-label="목록으로 돌아가기">‹</button><span /><button type="button" onClick={onFavorite} aria-label="찜하기">{favorite ? "♥" : "♡"}</button><button type="button" onClick={onShare} aria-label="공유하기">↗</button><a href={mapLink(program)} target="_blank" rel="noreferrer" aria-label="Kakao 지도에서 보기">⌖</a></div>
        <div className="dg-detail-badges"><span>{program.status}</span>{program.applyUrl && <span>✓ 신청 링크 확인됨</span>}</div>
        <h1>{program.name}</h1><p>▥ {program.facility}</p>
      </header>
      <div className="dg-detail-scroll">
        <section><h2>프로그램 포스터</h2><div className="dg-poster">{program.imageUrl ? <img src={program.imageUrl} alt={`${program.name} 포스터`} /> : <img src={`/markers/${programIconName(program)}.png`} alt="" />}</div></section>
        {easyFirst && <section className="dg-easy-summary"><h2>이 프로그램은요</h2><p>{program.summary}</p></section>}
        <section><h2>프로그램 정보</h2><dl className="dg-info-list"><div><dt>♙</dt><dd><small>누가 신청할 수 있나요?</small><strong>{program.requirement ?? (program.audiences.join(" · ") || "신청 페이지에서 확인")}</strong></dd></div><div><dt>◷</dt><dd><small>언제 하나요?</small><strong>{program.periodText ?? program.scheduleText ?? "일정은 신청 페이지에서 확인"}</strong>{program.scheduleText && <span>{program.scheduleText}</span>}</dd></div><div><dt>⌖</dt><dd><small>어디서 하나요?</small><strong>{program.facility}{program.room ? ` · ${program.room}` : ""}</strong><span>{program.address ?? program.area}</span></dd></div><div><dt>₩</dt><dd><small>비용과 준비물</small><strong>{program.isFree ? "무료" : program.feeText}</strong>{program.preparation && <span>{program.preparation}</span>}</dd></div></dl></section>
        {!easyFirst && <section className="dg-easy-summary"><h2>프로그램 안내</h2><p>{program.summary}</p></section>}
        <section><h2>거리정보</h2><div className="dg-distance-card"><div className="dg-route-metrics"><div><span>예상 시간</span><strong>약 {routeEstimate.minutes}분</strong></div><div><span>예상 이동 거리</span><strong>{distanceLabel(routeEstimate.distance)}</strong></div></div><p>{transportLabel} 경로를 {usesFallbackLocation ? "기본 위치" : "현재 위치"}와 시설 좌표로 추정한 값이에요. 직선 거리는 {distanceLabel(distance)}이며, 실제 도로·환승 경로는 카카오맵에서 확인할 수 있어요.</p>{usesFallbackLocation && <p className="dg-location-warning">정확한 거리정보를 보려면 지도 오른쪽의 ‘내 위치’를 눌러 위치 사용을 허용해 주세요.</p>}<div className="dg-transport-tabs"><button type="button" className={transport === "walk" ? "active" : ""} onClick={() => onTransport("walk")}>🚶 도보</button><button type="button" className={transport === "transit" ? "active" : ""} onClick={() => onTransport("transit")}>🚇 대중교통</button><button type="button" className={transport === "car" ? "active" : ""} onClick={() => onTransport("car")}>🚗 자동차</button></div><a className="dg-route-button" href={routeLink(program, current, transport)} target="_blank" rel="noreferrer">Kakao 지도에서 실제 경로 확인</a><button className="dg-nearby-button" type="button" onClick={onNearby}>☕ 목적지 주변 가게 보기</button></div></section>
        <p className="dg-source">공공데이터 출처: {program.source ?? "제공기관 공개 데이터"}</p>
      </div>
      <footer className="dg-detail-footer">
        {officialAccess ? <a className="dg-apply" href={officialAccess.href} target="_blank" rel="external nofollow noopener noreferrer" referrerPolicy="no-referrer">{officialAccess.requiresHomepageSearch ? `${officialAccess.providerName} 홈에서 검색` : "신청하러 가기"}</a> : <button className="dg-apply" type="button" disabled>신청 링크 확인 중</button>}
        <div><button type="button" className={reminder ? "active" : ""} onClick={onReminder}>♧ {reminder ? "알림 저장됨" : "알림 받기"}</button><button type="button" onClick={onShare}>↗ 공유</button>{program.phone ? <a href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}>☎ 전화 문의</a> : <span>전화번호 없음</span>}</div>
      </footer>
    </article>
  );
}

function ProgramPlaceSheet({ state, current, reminderIDs, onClose, onIndex, onDetail, onReminder }: {
  state: PlaceSheetState; current: Coordinate; reminderIDs: string[];
  onClose: () => void; onIndex: (index: number) => void; onDetail: (program: WebProgram) => void; onReminder: (program: WebProgram) => void;
}) {
  const program = state.programs[state.index];
  const total = Math.max(state.expectedCount, state.programs.length);
  const previous = () => onIndex(state.index <= 0 ? Math.max(0, state.programs.length - 1) : state.index - 1);
  const next = () => onIndex(state.index + 1 >= state.programs.length ? 0 : state.index + 1);
  return <section className="dg-place-sheet" role="dialog" aria-label="같은 장소 프로그램">
    <button className="dg-sheet-close" type="button" onClick={onClose} aria-label="닫기">×</button>
    {total > 1 && <header><button type="button" onClick={previous} disabled={state.programs.length < 2} aria-label="왼쪽으로 이동">‹</button><div><small>같은 장소 프로그램</small><strong>{Math.min(state.index + 1, total)} / {total}</strong></div><button type="button" onClick={next} disabled={state.programs.length < 2} aria-label="오른쪽으로 이동">›</button></header>}
    {program ? <div className="dg-sheet-body">
      <div className="dg-sheet-badges"><span>{program.status}</span><span>집 근처 {distanceLabel(distanceMeters(current, program))}</span></div>
      <h2>{program.name}</h2><p className="dg-sheet-distance">⌖ 우리 집에서 {distanceLabel(distanceMeters(current, program))}</p>
      <dl><div><dt>▥</dt><dd>{program.facility}</dd></div><div><dt>◷</dt><dd>{program.scheduleText ?? program.periodText ?? "이용시간은 예약 페이지에서 확인"}</dd></div><div><dt>₩</dt><dd>{program.isFree ? "무료" : program.feeText} · {program.status}</dd></div></dl>
      <button className="dg-sheet-detail" type="button" onClick={() => onDetail(program)}>자세히 보기</button>
      <div className="dg-sheet-actions"><button type="button" className={reminderIDs.includes(program.id) ? "active" : ""} onClick={() => onReminder(program)}>♧ {reminderIDs.includes(program.id) ? "알림 저장됨" : "알림 받기"}</button><a href={mapLink(program)} target="_blank" rel="noreferrer">➤ 길찾기</a></div>
    </div> : <div className="dg-sheet-loading"><strong>{state.loading ? "같은 장소 프로그램을 불러오고 있어요" : "프로그램 정보를 확인할 수 없어요"}</strong></div>}
  </section>;
}

function OpenRunPanel({ programs, reminders, onToggleReminder, onOpen }: { programs: WebProgram[]; reminders: string[]; onToggleReminder: (program: WebProgram) => void; onOpen: (program: WebProgram) => void }) {
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
  return <section className="dg-openrun-panel"><header><h1>오픈런 알림 <span>⚡</span></h1><p>접수 시작·마감 전에 알려드릴게요</p></header><div className="dg-openrun-scroll"><section className="dg-keyword-card"><div><strong>🔔 알림 키워드</strong><small>자세히 보기 ›</small></div><p>관심 키워드를 선택하면 해당 프로그램만 알려드려요</p><div>{suggestions.map((keyword) => <button type="button" key={keyword} className={keywords.includes(keyword) ? "active" : ""} onClick={() => setKeywords((current) => current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword])}>{keywords.includes(keyword) ? `${keyword} ✓` : keyword}</button>)}</div></section>{upcoming.length ? upcoming.map((program) => <article className="dg-openrun-card" key={program.id}><div className="dg-openrun-banner"><span>{banner(program)}</span>{reminders.includes(program.id) && <strong>✓ 알림 켜짐</strong>}</div><button type="button" className="dg-openrun-copy" onClick={() => onOpen(program)}><strong>{program.name}</strong><span>{program.facility} · {program.scheduleText ?? "일정 확인"} · {program.isFree ? "무료" : program.feeText}</span></button><div><button type="button" className={reminders.includes(program.id) ? "is-off" : ""} onClick={() => onToggleReminder(program)}>{reminders.includes(program.id) ? "🔕 알림 끄기" : "🔔 알림 켜기"}</button><button type="button" onClick={() => onOpen(program)}>신청하러 가기</button></div></article>) : <div className="dg-empty"><strong>{keywords.length ? "선택한 키워드에 해당하는 프로그램이 없어요" : "현재 접수가 임박한 프로그램이 없어요"}</strong>{keywords.length > 0 && <button type="button" onClick={() => setKeywords([])}>키워드 해제하기</button>}</div>}<p className="dg-openrun-tip">▦ 프로그램의 알림 받기 버튼에서 원하는 날짜와 시간을 직접 선택할 수 있어요.</p></div></section>;
}

function FullFilterDialog({ field, audience, subjects, status, freeOnly, paidOnly, radiusKm, count, onField, onAudience, onSubjects, onStatus, onFree, onPaid, onRadius, onReset, onClose }: {
  field: string; audience: string | null; subjects: string[]; status: StatusFilter; freeOnly: boolean; paidOnly: boolean; radiusKm: number | null; count: number;
  onField: (value: string) => void; onAudience: (value: string | null) => void; onSubjects: (value: string[]) => void; onStatus: (value: StatusFilter) => void;
  onFree: (value: boolean) => void; onPaid: (value: boolean) => void; onRadius: (value: number | null) => void; onReset: () => void; onClose: () => void;
}) {
  const toggleSubject = (subject: string) => onSubjects(subjects.includes(subject) ? subjects.filter((item) => item !== subject) : [...subjects, subject]);
  return <div className="dg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dg-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="dg-filter-title">
      <header><h2 id="dg-filter-title">조건 고르기</h2><button type="button" onClick={onReset}>초기화</button><button type="button" className="dg-modal-x" onClick={onClose} aria-label="닫기">×</button></header>
      <FilterSection title="누구를 위한 프로그램인가요?" values={["시니어", "성인", "어린이", "가족", "직장인"]} active={(value) => audience === value} onClick={(value) => onAudience(audience === value ? null : value)} />
      <FilterSection title="어떤 분야인가요? (대분류)" values={["디지털", "건강운동", "문화예술", "공연전시", "복지", "교육"]} active={(value) => field === value} onClick={(value) => onField(field === value ? "전체" : value)} />
      <FilterSection title="세부 종목 선택" values={SUBJECT_FILTERS} active={(value) => subjects.includes(value)} onClick={toggleSubject} />
      <FilterSection title="요금 · 신청 상태" values={["무료", "유료", "접수중", "곧 시작", "마감임박"]} active={(value) => value === "무료" ? freeOnly : value === "유료" ? paidOnly : status === (value === "곧 시작" ? "접수예정" : value)} onClick={(value) => { if (value === "무료") onFree(!freeOnly); else if (value === "유료") onPaid(!paidOnly); else onStatus(status === (value === "곧 시작" ? "접수예정" : value as StatusFilter) ? "전체" : (value === "곧 시작" ? "접수예정" : value as StatusFilter)); }} />
      <FilterSection title="집에서 얼마나 가까운 곳을 찾으세요?" values={["전체", "1km", "3km", "5km"]} active={(value) => value === "전체" ? radiusKm === null : radiusKm === Number(value.replace("km", ""))} onClick={(value) => onRadius(value === "전체" ? null : Number(value.replace("km", "")))} />
      <button className="dg-filter-apply" type="button" onClick={onClose}>선택한 조건으로 {count.toLocaleString("ko-KR")}곳 보기</button>
    </section>
  </div>;
}

function FilterSection({ title, values, active, onClick }: { title: string; values: string[]; active: (value: string) => boolean; onClick: (value: string) => void }) {
  return <section className="dg-filter-section"><h3>{title}</h3><div>{values.map((value) => <button type="button" className={active(value) ? "active" : ""} key={value} onClick={() => onClick(value)}>{value}</button>)}</div></section>;
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

function CalendarPanel({ programs, reminders, onBack, onOpen }: { programs: WebProgram[]; reminders: string[]; onBack: () => void; onOpen: (program: WebProgram) => void }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const datedPrograms = programs.flatMap((program) => {
    if (!program.receiptStart) return [];
    const date = new Date(program.receiptStart);
    return Number.isFinite(date.getTime()) ? [{ program, date }] : [];
  });
  const events = datedPrograms.filter(({ date }) => date.getFullYear() === monthCursor.getFullYear() && date.getMonth() === monthCursor.getMonth()).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 80);
  const firstWeekday = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const eventDays = new Set(events.map(({ date }) => date.getDate()));
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const moveMonth = (offset: number) => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  return <section className="dg-aux-panel"><PanelHeader title="일정" subtitle="접수 시작과 저장한 알림을 날짜순으로 모았어요" onBack={onBack} /><div className="dg-month-card"><button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button><strong>{monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월</strong><button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button><div className="dg-week-row">{["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}</div><div className="dg-calendar-grid">{cells.map((day, index) => <span key={`${day ?? "empty"}-${index}`} className={day && eventDays.has(day) ? "has-event" : ""}>{day ?? ""}</span>)}</div></div><div className="dg-aux-list">{events.length ? events.map(({ program, date }) => <button key={program.id} type="button" onClick={() => onOpen(program)}><span className="dg-date-badge">{date.getDate()}</span><span><small>{reminders.includes(program.id) ? "알림 저장" : "접수 일정"}</small><strong>{program.name}</strong><em>{program.facility}</em></span></button>) : <div className="dg-empty"><strong>이 달에 표시할 일정이 없어요.</strong><p>다른 달을 확인하거나 프로그램에서 알림 받기를 선택해 보세요.</p></div>}</div></section>;
}

function FamilyPanel({ programs, onBack, onOpen }: { programs: WebProgram[]; onBack: () => void; onOpen: (program: WebProgram) => void }) {
  const [role, setRole] = useState("어머니");
  const familyPrograms = programs.filter((program) => role === "아이" ? program.audiences.some((value) => /아이|아동|어린이|청소년/.test(value)) : role === "나" ? true : program.isSeniorRecommended || program.audiences.some((value) => /시니어|어르신|성인/.test(value))).slice(0, 60);
  return <section className="dg-aux-panel"><PanelHeader title="가족 모드" subtitle="가족에게 맞는 프로그램을 골라 보여드려요" onBack={onBack} /><div className="dg-family-tabs">{["어머니", "아버지", "나", "아이"].map((item) => <button key={item} type="button" className={role === item ? "active" : ""} onClick={() => setRole(item)}>{item}</button>)}</div><div className="dg-family-profile"><strong>{role}를 위한 추천</strong><span>현재 지도 지역 · {familyPrograms.length}개</span></div><div className="dg-aux-list">{familyPrograms.map((program) => <button key={program.id} type="button" onClick={() => onOpen(program)}><img src={`/markers/${programIconName(program)}.png`} alt="" /><span><small>{program.status}</small><strong>{program.name}</strong><em>{program.facility} · {program.isFree ? "무료" : program.feeText}</em></span></button>)}</div></section>;
}

function HistoryPanel({ history, onBack, onOpen }: { history: Array<{ program: WebProgram; viewedAt: string }>; onBack: () => void; onOpen: (program: WebProgram) => void }) {
  const recent = history;
  return <section className="dg-aux-panel"><PanelHeader title="보관함" subtitle="최근 7일 동안 열어본 프로그램이에요" onBack={onBack} /><div className="dg-history-summary"><strong>{recent.length}</strong><span>열어본 프로그램</span></div><div className="dg-aux-list">{recent.length ? recent.map((item) => <button key={item.program.id} type="button" onClick={() => onOpen(item.program)}><img src={`/markers/${programIconName(item.program)}.png`} alt="" /><span><small>{new Date(item.viewedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</small><strong>{item.program.name}</strong><em>{item.program.facility}</em></span></button>) : <div className="dg-empty"><strong>최근 7일 동안 열어본 프로그램이 없어요.</strong><p>지도 마커나 목록에서 프로그램을 확인하면 자동으로 기록됩니다.</p></div>}</div></section>;
}

function NearbyPlacesPanel({ program, summary, loading, radius, category, onBack, onRadius, onCategory }: {
  program: WebProgram; summary: WebNearbyPlacesSummary | null; loading: boolean; radius: number; category: NearbyCategory;
  onBack: () => void; onRadius: (value: number) => void; onCategory: (value: NearbyCategory) => void;
}) {
  const places = (summary?.places ?? []).filter((place) => category === "all" || place.placeType === category);
  const categoryTitle: Record<NearbyCategory, string> = { all: "전체", restaurant: "음식점", cafe: "카페", fast_food: "패스트푸드", convenience_store: "편의점", other_food: "분식" };
  return <section className="dg-aux-panel"><PanelHeader title="주변 가게" subtitle={`${program.facility}에서 걸어서 갈 만한 곳`} onBack={onBack} /><div className="dg-radius-row">{[100, 300, 500, 1000].map((value) => <button type="button" key={value} className={radius === value ? "active" : ""} onClick={() => onRadius(value)}>{value === 1000 ? "1km" : `${value}m`}</button>)}</div><div className="dg-nearby-categories">{(Object.keys(categoryTitle) as NearbyCategory[]).map((value) => <button type="button" key={value} className={category === value ? "active" : ""} onClick={() => onCategory(value)}>{categoryTitle[value]} {value === "all" ? summary?.totalCount ?? 0 : summary?.categoryCounts[value] ?? 0}</button>)}</div><div className="dg-aux-list">{loading ? <div className="dg-loading"><strong>목적지 주변을 찾고 있어요</strong></div> : places.length ? places.map((place) => <a key={place.id} href={`https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`} target="_blank" rel="noreferrer"><span className="dg-place-type">{place.placeType === "cafe" ? "☕" : place.placeType === "convenience_store" ? "▣" : "🍴"}</span><span><small>{place.businessStatusName ?? categoryTitle[place.placeType]}</small><strong>{place.branchName && !place.name.includes(place.branchName) ? `${place.name} ${place.branchName}` : place.name}</strong><em>{distanceLabel(place.distanceMeters)} · {place.address ?? "주소 정보 없음"}</em></span></a>) : <div className="dg-empty"><strong>이 반경에는 표시할 가게가 없어요.</strong><p>반경을 넓혀 다시 찾아보세요.</p></div>}</div></section>;
}
