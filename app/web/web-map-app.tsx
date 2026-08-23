"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import type { WebHeatShelter, WebMapCluster, WebMapViewportResult, WebNearbyPlace, WebNearbyPlacesSummary, WebProgram } from "@/lib/web-program-data";
import { officialProgramAccess } from "@/lib/official-program-access";
import { dominantProgram, programIconName } from "@/lib/web-icon-mapper";
import { haversineMeters, parseSearchIntent, relaxedSuggestions, searchPrograms, type SearchIntent } from "@/lib/web-search-engine";
import type { WebRouteMode, WebRouteResult } from "@/lib/web-route-data";
import {
  currentWebSession,
  deleteWebAlert,
  deleteWebFamilyMember,
  fetchWebUserSnapshot,
  observeWebSession,
  recordWebLegalConsents,
  saveWebFamilyMember,
  signInToWeb,
  signOutFromWeb,
  upsertWebAlert,
  upsertWebFavorite,
  WEB_AUTH_CONSENT_STORAGE_KEY,
  WEB_AUTH_CONSENT_VERSION,
  webAuthConfigured,
  type Session,
  type WebFamilyMember,
  type WebUserAlert,
} from "@/lib/web-user-data";

type KakaoLatLng = { getLat: () => number; getLng: () => number };
type KakaoBounds = { getSouthWest: () => KakaoLatLng; getNorthEast: () => KakaoLatLng; extend: (position: KakaoLatLng) => void };
type KakaoMap = {
  getBounds: () => KakaoBounds; getCenter: () => KakaoLatLng; getLevel: () => number;
  setBounds: (bounds: KakaoBounds, ...padding: number[]) => void; setCenter: (position: KakaoLatLng) => void;
  setLevel: (level: number) => void; panTo: (position: KakaoLatLng) => void;
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
type AuxiliaryPanel = "calendar" | "family" | "history" | "nearby" | "programs" | null;
type PlaceSheetState = { programs: WebProgram[]; index: number; expectedCount: number; loading: boolean };
type NearbyCategory = "all" | WebNearbyPlace["placeType"];
type AlertDialogState = { program: WebProgram; scheduledAt: string };
type MobileSheetSnap = "collapsed" | "medium" | "expanded";

const ROUTE_MODE: Record<Transport, WebRouteMode> = {
  walk: "WALKING",
  transit: "TRANSIT",
  car: "DRIVING",
};

const FALLBACK: Coordinate = { latitude: 37.6027, longitude: 127.0128 };
const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "map", icon: "⌖", label: "지도" },
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
const SEARCH_EXAMPLE_ICONS = ["🌅", "⏰", "👴", "🏊", "🎨", "🎵"];

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

function mobileSheetHeights(viewportHeight: number) {
  const available = Math.max(320, viewportHeight - 74);
  return {
    collapsed: 116,
    medium: Math.min(520, Math.max(330, Math.round(available * 0.56))),
    expanded: Math.max(320, available - 8),
  } satisfies Record<MobileSheetSnap, number>;
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
  const route = transport === "walk" ? "foot" : transport === "car" ? "car" : "publictransit";
  const params = new URLSearchParams({
    sp: `${current.latitude.toFixed(6)},${current.longitude.toFixed(6)}`,
    ep: `${program.latitude.toFixed(6)},${program.longitude.toFixed(6)}`,
    by: route,
  });
  return `https://m.map.kakao.com/scheme/route?${params}`;
}

function nearbyKakaoLink(place: WebNearbyPlace) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`;
}

function nearbyNaverLink(place: WebNearbyPlace) {
  const query = [place.name, place.address].filter(Boolean).join(" ");
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

async function fetchPrograms(params: URLSearchParams, signal?: AbortSignal): Promise<WebProgram[]> {
  const response = await fetch(`/api/web-programs?${params}`, { signal, cache: "no-store" });
  const payload = await response.json() as { programs?: WebProgram[]; message?: string };
  if (!response.ok) throw new Error(payload.message ?? "프로그램을 불러오지 못했습니다.");
  return payload.programs ?? [];
}

export default function WebMapApp({ kakaoMapKey }: { kakaoMapKey: string }) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const routeOverlaysRef = useRef<KakaoOverlay[]>([]);
  const mapItemsRef = useRef<KakaoMapItem[]>([]);
  const mapRequestIDRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const sheetDragRef = useRef({ pointerID: -1, startY: 0, startHeight: 0, moved: false });
  const sheetGrabberRef = useRef<HTMLButtonElement>(null);
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
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>("medium");
  const [mobileSheetDragHeight, setMobileSheetDragHeight] = useState<number | null>(null);
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
  const [selectedNearbyPlace, setSelectedNearbyPlace] = useState<WebNearbyPlace | null>(null);
  const [nearbyWalkingRoute, setNearbyWalkingRoute] = useState<WebRouteResult | null>(null);
  const [activeRoute, setActiveRoute] = useState<WebRouteResult | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => webAuthConfigured());
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

  useEffect(() => {
    const read = (key: string) => {
      try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; }
    };
    const hydratePreferences = () => {
      setFavorites(read("dongnegogo.web.favorites"));
      setReminders(read("dongnegogo.web.reminders"));
      try {
        const alerts = JSON.parse(localStorage.getItem("dongnegogo.web.alerts") ?? "[]") as WebUserAlert[];
        setUserAlerts(alerts.filter((alert) => alert?.program_id));
      } catch { setUserAlerts([]); }
      try {
        const family = JSON.parse(localStorage.getItem("dongnegogo.web.family") ?? "[]") as WebFamilyMember[];
        setFamilyMembers(family.filter((member) => member?.role && member.age_group && member.region));
      } catch { setFamilyMembers([]); }
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
      setFavoriteTargets(mergedTargets);
      setFavorites(Object.keys(mergedTargets));
      setUserAlerts(snapshot.alerts);
      setReminders(snapshot.alerts.map((alert) => alert.program_id));
      setFamilyMembers(snapshot.family);
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
    if (!webAuthConfigured()) return;
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
    setViewHistory((previous) => {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const oldest = today.getTime() - 3 * 86_400_000;
      const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
      const next = [{ program, viewedAt: now.toISOString() }, ...previous.filter((item) => {
        if (new Date(item.viewedAt).getTime() < oldest) return false;
        const itemKey = new Date(item.viewedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        return item.program.id !== program.id || itemKey !== todayKey;
      })].slice(0, 1_600);
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
    const requestID = ++mapRequestIDRef.current;
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
        setError("");
        return;
      }
      const response = await fetch(`/api/web-map?${params}`, { cache: "no-store" });
      const payload = await response.json() as WebMapViewportResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "지도 프로그램을 불러오지 못했습니다.");
      if (mapRequestIDRef.current !== requestID) return;
      let nextPrograms = payload.programs;
      if (payload.mode === "cluster") {
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
      setMapClusters(payload.clusters);
      setProgramCounts(payload.programCounts ?? {});
      setMapMode(payload.mode);
      mapModeRef.current = payload.mode;
      setError("");
    } catch (fetchError) {
      if (mapRequestIDRef.current === requestID) setError((fetchError as Error).message);
    } finally {
      if (mapRequestIDRef.current === requestID) setLoading(false);
    }
  }, [resolveCenteredArea]);

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
      maps.event.addListener(map, "idle", () => {
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = window.setTimeout(() => loadBounds(map), 420);
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
    if ((selected && activeRoute) || (auxiliaryPanel === "nearby" && nearbyDestination && nearbySummary)) {
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
      const overlay = new maps.CustomOverlay({
        map, position: new maps.LatLng(representative.latitude, representative.longitude),
        content: button, yAnchor: 1.15, zIndex: selected?.id === representative.id ? 10 : 2,
      });
      overlaysRef.current.push(overlay);
    });
    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, [visiblePrograms, visibleClusters, selected, selectedHeatShelter, heatShelterMode, heatShelters, mapLevel, mapMode, programCounts, tab, fieldFilter, freeOnly, paidOnly, seniorOnly, audienceFilter, subjectFilters, statusFilter, todayOnly, radiusKm, openProgramSheet, activeRoute, auxiliaryPanel, nearbyDestination, nearbySummary]);

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

    const marker = (coordinate: Coordinate, className: string, label: string, contentText: string, onClick?: () => void) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.setAttribute("aria-label", label);
      button.textContent = contentText;
      if (onClick) button.addEventListener("click", onClick);
      const overlay = new maps.CustomOverlay({
        map,
        position: new maps.LatLng(coordinate.latitude, coordinate.longitude),
        content: button,
        yAnchor: 0.5,
        zIndex: className.includes("selected") ? 30 : 20,
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

    if (auxiliaryPanel === "nearby" && nearbyDestination && nearbySummary) {
      mapItemsRef.current.push(new maps.Circle({
        map,
        center: new maps.LatLng(nearbyDestination.latitude, nearbyDestination.longitude),
        radius: nearbyRadius,
        strokeWeight: 2,
        strokeColor: "#22b14c",
        strokeOpacity: 0.75,
        strokeStyle: "dash",
        fillColor: "#83d43f",
        fillOpacity: 0.10,
      }));
      const mapPlaces = nearbySummary.mapPlaces.filter((place) => nearbyCategory === "all" || place.placeType === nearbyCategory);
      marker(nearbyDestination, "dg-route-endpoint dg-route-destination", `${nearbyDestination.facility} 목적지`, "도착");
      mapPlaces.slice(0, 400).forEach((place) => {
        const selectedPlace = selectedNearbyPlace?.id === place.id;
        const icon = place.placeType === "cafe" ? "☕" : place.placeType === "convenience_store" ? "▣" : place.placeType === "fast_food" ? "🥤" : "🍴";
        marker(
          place,
          `dg-nearby-map-marker dg-nearby-${place.placeType}${selectedPlace ? " selected" : ""}`,
          `${place.name}, ${distanceLabel(place.distanceMeters)}`,
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
      const longitudeDelta = nearbyRadius / (111_000 * Math.max(0.3, Math.cos(nearbyDestination.latitude * Math.PI / 180)));
      [
        { latitude: nearbyDestination.latitude + latitudeDelta, longitude: nearbyDestination.longitude },
        { latitude: nearbyDestination.latitude - latitudeDelta, longitude: nearbyDestination.longitude },
        { latitude: nearbyDestination.latitude, longitude: nearbyDestination.longitude + longitudeDelta },
        { latitude: nearbyDestination.latitude, longitude: nearbyDestination.longitude - longitudeDelta },
      ].forEach((point) => bounds.extend(new maps.LatLng(point.latitude, point.longitude)));
      if (selectedNearbyPlace) bounds.extend(new maps.LatLng(selectedNearbyPlace.latitude, selectedNearbyPlace.longitude));
      map.setBounds(bounds, 70, 80, 70, 500);
    } else if (selected && activeRoute) {
      const routeColors: Record<string, string> = {
        WALKING: "#22b14c",
        BUS: "#3f79d8",
        SUBWAY: "#8b5bd6",
        DRIVING: "#ef7b2d",
        OTHER: "#67716a",
      };
      activeRoute.segments.forEach((segment) => {
        polyline(segment.points, routeColors[segment.type] ?? routeColors[activeRoute.mode] ?? "#22b14c", 7);
      });
      marker(location, `dg-route-endpoint dg-route-origin${usesFallbackLocation ? " fallback" : ""}`, usesFallbackLocation ? "기본 출발 위치" : "현재 위치", usesFallbackLocation ? "기본" : "현재");
      marker(selected, "dg-route-endpoint dg-route-destination", `${selected.facility} 목적지`, "도착");
      const bounds = new maps.LatLngBounds();
      activeRoute.segments.flatMap((segment) => segment.points).forEach((point) => bounds.extend(new maps.LatLng(point.latitude, point.longitude)));
      map.setBounds(bounds, 70, 80, 70, 500);
    }

    return () => {
      routeOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      routeOverlaysRef.current = [];
      mapItemsRef.current.forEach((item) => item.setMap(null));
      mapItemsRef.current = [];
    };
  }, [activeRoute, auxiliaryPanel, location, nearbyCategory, nearbyDestination, nearbyRadius, nearbySummary, nearbyWalkingRoute, selected, selectedNearbyPlace, selectNearbyPlace, usesFallbackLocation]);

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
      const maps = window.kakao?.maps;
      if (mapRef.current && matches.length && maps) {
        const bounds = new maps.LatLngBounds();
        matches.slice(0, 120).forEach((program) => bounds.extend(new maps.LatLng(program.latitude, program.longitude)));
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
      setAccountError(authError instanceof Error ? authError.message : "로그인을 시작하지 못했어요.");
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

  const removeAlert = async () => {
    if (!alertDialog) return;
    const id = alertDialog.program.id;
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
    setSelectedNearbyPlace(null);
    setNearbyWalkingRoute(null);
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
    if (nextTab === "saved" && !session && window.matchMedia("(max-width: 820px)").matches) {
      openAccountSignIn();
      return;
    }
    searchActiveRef.current = nextTab === "search";
    if (nextTab !== "search") setSearchIntent(null);
    setTab(nextTab);
    setSelected(null);
    setActiveRoute(null);
    setSelectedNearbyPlace(null);
    setNearbyWalkingRoute(null);
    setPlaceSheet(null);
    setAuxiliaryPanel(null);
    if (nextTab !== "search" && mapRef.current) window.setTimeout(() => mapRef.current && loadBounds(mapRef.current), 0);
  };

  const openMapTool = (panel: Exclude<AuxiliaryPanel, "nearby" | null>) => {
    if ((panel === "family" || panel === "history") && !session && window.matchMedia("(max-width: 820px)").matches) {
      openAccountSignIn();
      return;
    }
    setSelected(null);
    setPlaceSheet(null);
    setAuxiliaryPanel(panel);
  };

  const toggleMapField = (field: string) => {
    if (heatShelterMode) {
      heatShelterModeRef.current = false;
      setHeatShelterMode(false);
      setHeatShelters([]);
    }
    setFieldFilter(fieldFilter === field ? "전체" : field);
    if (mapRef.current) window.setTimeout(() => mapRef.current && void loadBounds(mapRef.current), 0);
  };

  const sidePanelOverlay = Boolean(selectedHeatShelter || selected || auxiliaryPanel);
  const mobileMapPanel = tab === "map" && !sidePanelOverlay;
  const mobileSheetStyle = (mobileSheetDragHeight === null ? undefined : {
    "--dg-mobile-sheet-height": `${mobileSheetDragHeight}px`,
  }) as CSSProperties | undefined;

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
      setMobileSheetDragHeight(Math.max(heights.collapsed, Math.min(heights.expanded, drag.startHeight + delta)));
    };
    const finish = (pointerID: number, clientY: number) => {
      const drag = sheetDragRef.current;
      if (drag.pointerID !== pointerID) return;
      const heights = mobileSheetHeights(window.innerHeight);
      const finalHeight = Math.max(heights.collapsed, Math.min(heights.expanded, drag.startHeight + drag.startY - clientY));
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

  const cycleMobileSheet = () => {
    if (sheetDragRef.current.moved) {
      sheetDragRef.current.moved = false;
      return;
    }
    setMobileSheetSnap((current) => current === "collapsed" ? "medium" : current === "medium" ? "expanded" : "collapsed");
  };

  return (
    <main className={`dg-web-app dg-tab-${tab}${bigText ? " dg-big-text" : ""}`}>
      <aside className="dg-nav-rail" aria-label="웹 버전 메뉴">
        <Link className="dg-brand-mark" href="/" aria-label="동네고고 소개 페이지로 돌아가기">
          <img src="/brand/app-icon.png" alt="" /><strong>동네<br />고고</strong>
        </Link>
        <nav>
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id && !selected ? "active" : ""} onClick={() => changeTab(item.id)}>
              <span aria-hidden="true">{item.icon}{item.id === "openrun" && openRunBadge > 0 && <em className="dg-tab-badge">{openRunBadge}</em>}</span>{item.label}
            </button>
          ))}
        </nav>
        <Link className="dg-home-link" href="/">소개 페이지</Link>
      </aside>

      <section
        className={`dg-side-panel dg-side-panel-${tab}${sidePanelOverlay ? " dg-side-panel-overlay" : ""}${tab === "search" && searchIntent ? " dg-search-active" : ""}${mobileMapPanel ? ` dg-mobile-map-sheet dg-mobile-sheet-${mobileSheetSnap}${mobileSheetDragHeight !== null ? " dg-mobile-sheet-dragging" : ""}${placeSheet ? " dg-mobile-sheet-suppressed" : ""}` : ""}`}
        style={mobileSheetStyle}
        aria-label="프로그램 탐색 패널"
      >
        {mobileMapPanel && !placeSheet && <button
          type="button"
          ref={sheetGrabberRef}
          className="dg-mobile-sheet-grabber"
          aria-label={`지도 프로그램 패널 ${mobileSheetSnap === "collapsed" ? "중간으로 열기" : mobileSheetSnap === "medium" ? "전체로 펼치기" : "접기"}`}
          onClick={cycleMobileSheet}
        ><span aria-hidden="true" /><em>{mobileSheetSnap === "collapsed" ? "올려서 프로그램 보기" : mobileSheetSnap === "expanded" ? "내려서 지도 보기" : "위아래로 움직여 조절"}</em></button>}
        {selectedHeatShelter ? (
          <HeatShelterDetail shelter={selectedHeatShelter} current={location} onBack={() => setSelectedHeatShelter(null)} />
        ) : selected ? (
          <ProgramDetail
            program={selected} current={location} favorite={favorites.includes(selected.id)}
            usesFallbackLocation={usesFallbackLocation}
            reminder={reminders.includes(selected.id)} transport={transport} easyFirst={easyFirst}
            favoriteTargets={favoriteTargets[selected.id] ?? (favorites.includes(selected.id) ? ["personal"] : [])}
            familyMembers={familyMembers}
            onBack={() => { setSelected(null); setActiveRoute(null); }} onFavorite={() => toggleFavorite(selected.id)}
            onFavoriteTarget={(target) => toggleFavoriteTarget(selected.id, target)}
            onReminder={() => toggleReminder(selected.id)} onTransport={(value) => { setTransport(value); setActiveRoute(null); }}
            onRouteChange={setActiveRoute}
            onShare={() => share(selected)}
            onNearby={() => { setNearbyCategory("all"); void loadNearbyPlaces(selected, 100); }}
          />
        ) : auxiliaryPanel === "nearby" && nearbyDestination ? (
          <NearbyPlacesPanel
            program={nearbyDestination} summary={nearbySummary} loading={nearbyLoading} radius={nearbyRadius} category={nearbyCategory}
            selected={selectedNearbyPlace} walkingRoute={nearbyWalkingRoute}
            onBack={() => { setAuxiliaryPanel(null); setSelected(nearbyDestination); setSelectedNearbyPlace(null); setNearbyWalkingRoute(null); }}
            onRadius={(value) => { void loadNearbyPlaces(nearbyDestination, value); }}
            onCategory={(value) => { setNearbyCategory(value); setSelectedNearbyPlace(null); setNearbyWalkingRoute(null); }}
            onSelect={(place) => { void selectNearbyPlace(place); }}
          />
        ) : auxiliaryPanel === "calendar" ? (
          <CalendarPanel programs={programs} reminders={reminders} onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }} />
        ) : auxiliaryPanel === "family" ? (
          <FamilyPanel programs={programs} members={familyMembers} signedIn={Boolean(session)}
            onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }}
            onSave={saveFamily} onRemove={removeFamily} />
        ) : auxiliaryPanel === "history" ? (
          <HistoryPanel history={viewHistory} onBack={() => setAuxiliaryPanel(null)} onOpen={(program) => { void selectProgram(program); }} />
        ) : tab === "me" ? (
          <section className="dg-profile-panel">
            <div className="dg-panel-title"><Link href="/">‹ 지도</Link><h1>내정보</h1></div>
            <div className="dg-profile-card dg-account-card">
              <small>계정</small>
              {authLoading ? <strong>로그인 상태 확인 중…</strong> : session ? <>
                <strong>{session.user.email ?? "로그인된 계정"}</strong>
                <span>{String(session.user.app_metadata?.provider ?? "Supabase")} 로그인 · 찜·알림·가족 정보 동기화 중</span>
                <button type="button" onClick={() => { void finishAccountSignOut(); }}>로그아웃</button>
              </> : <>
                <span>로그인하면 찜, 오픈런 알림, 가족 정보를 계정에 안전하게 저장할 수 있어요.</span>
                <button type="button" className="dg-login-cta" onClick={openAccountSignIn}>로그인하고 안전하게 저장</button>
              </>}
              {accountError && <p className="dg-account-error" role="alert">{accountError}</p>}
            </div>
            <div className="dg-profile-card">
              <small>우리 동네</small><button type="button" className="dg-region-row" onClick={moveToCurrentLocation}><span>●</span><strong>{centeredArea}</strong><em>변경</em></button>
            </div>
            <div className="dg-profile-card dg-profile-menu-card">
              <small>나의 프로그램</small>
              <button type="button" className="dg-profile-row" onClick={() => { setSeniorOnly(false); setAudienceFilter(null); changeTab("search"); }}><span>◎</span><strong>나를 위한 프로그램 찾기</strong><em>›</em></button>
              <button type="button" className="dg-profile-row" onClick={() => openMapTool("calendar")}><span>▦</span><strong>내 일정 달력</strong><em>›</em></button>
            </div>
            <div className="dg-profile-card dg-profile-menu-card">
              <small>가족을 위한 프로그램</small>
              <button type="button" className="dg-profile-row" onClick={() => {
                if (!session && window.matchMedia("(max-width: 820px)").matches) { openAccountSignIn(); return; }
                setSeniorOnly(true); setAudienceFilter("시니어"); changeTab("search");
              }}><span>♧</span><strong>부모님을 위한 프로그램 찾기</strong><em>›</em></button>
              <button type="button" className="dg-profile-row" onClick={() => {
                if (!session && window.matchMedia("(max-width: 820px)").matches) { openAccountSignIn(); return; }
                setSeniorOnly(false); setAudienceFilter("어린이"); changeTab("search");
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
        ) : tab === "openrun" ? (
          <OpenRunPanel programs={programs} reminders={reminders} onToggleReminder={(program) => toggleReminder(program.id)} onOpen={(program) => { void selectProgram(program); }} />
        ) : (
          <>
            <header className="dg-panel-header">
              <div className="dg-panel-title">{tab === "search" || auxiliaryPanel === "programs" ? <button type="button" onClick={() => auxiliaryPanel === "programs" ? setAuxiliaryPanel(null) : changeTab("map")}>‹ 지도</button> : <Link href="/">‹ 소개</Link>}<h1>{tab === "saved" ? "찜한 프로그램" : tab === "search" ? "찾기" : "지도 주변"}</h1></div>
              <form className="dg-search" onSubmit={submitSearch}>
                <span aria-hidden="true">⌕</span><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시설명·강좌명 또는 자연어로 검색" aria-label="프로그램 검색" />
                {query && <button type="button" className="dg-clear" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
                <button type="button" className="dg-voice" onClick={startVoiceSearch} aria-label="음성으로 검색">◉</button>
                <button type="submit" className="dg-search-button">검색</button>
              </form>
              {tab === "search" && searchIntent && <div className="dg-intent-chips" aria-label="검색 조건">{searchIntent.chips.map((chip) => <button key={chip} type="button" onClick={() => removeIntentChip(chip)} aria-label={`${chip} 조건 삭제`}>{chip} ×</button>)}</div>}
              {tab === "search" && !searchIntent && <div className="dg-search-suggestions">
                {recentSearches.length > 0 && <><small>최근 검색 <button type="button" onClick={() => { setRecentSearches([]); localStorage.removeItem("dongnegogo.web.recentSearches"); }}>전체 삭제</button></small>{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => chooseSearch(recent)}>↻ {recent}</button>)}</>}
                <small>이렇게 검색해보세요</small>
                {SEARCH_EXAMPLES.map((example, index) => <button key={example} type="button" onClick={() => chooseSearch(example)}>{SEARCH_EXAMPLE_ICONS[index]} {example}</button>)}
              </div>}
              {tab === "search" && searchIntent && <p className="dg-search-scope">{loading ? `${centeredArea.split(" ").slice(0, 2).join(" ")} 지역 기준으로 먼저 찾고 있어요. ${searchProgress}%` : `${centeredArea.split(" ").slice(0, 2).join(" ")} 지역 기준 ${visiblePrograms.length}곳을 찾았어요.`}</p>}
              {(tab !== "search" || searchIntent) && <><div className="dg-location-row"><button type="button" onClick={moveToCurrentLocation}>● {centeredArea.split(" ").slice(-2).join(" ")}</button><span>{heatShelterMode ? `${heatShelters.length}곳` : `${visiblePrograms.length}곳`}</span></div>
              <div className="dg-filter-row">
                <button type="button" className={heatShelterMode ? "active heat" : ""} onClick={toggleHeatShelterMode}>❄ 무더위쉼터</button>
                {["교육", "문화예술", "건강운동", "공연전시", "복지", "디지털"].map((field) => <button key={field} type="button" className={!heatShelterMode && fieldFilter === field ? "active" : ""} onClick={() => toggleMapField(field)}>{field}</button>)}
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
              </div></>}
            </header>
            <div className={`dg-result-list${tab === "search" && !searchIntent ? " dg-search-idle" : ""}`}>
              {loading && <div className="dg-loading"><img src="/web-assets/beodeuli-search-assistant.png" alt="" /><strong>{heatShelterMode ? "무더위쉼터를 불러오고 있어요" : "우리 동네 프로그램을 찾고 있어요"}</strong>{tab === "search" && <progress max="100" value={searchProgress} aria-label="검색 진행률" />}</div>}
              {!loading && error && <div className="dg-empty"><strong>{error}</strong><button type="button" onClick={() => mapRef.current && loadBounds(mapRef.current)}>다시 불러오기</button></div>}
              {!loading && !error && !heatShelterMode && visiblePrograms.length === 0 && <div className="dg-empty"><img src="/web-assets/beodeuli-search-success.png" alt="" /><strong>조건에 맞는 프로그램을 못 찾았어요.</strong><p>조건 하나만 넓혀 다시 찾아볼 수 있어요.</p>{searchIntent && <div className="dg-relaxed-search">{relaxedSuggestions(searchIntent).map((item) => <button key={item.label} type="button" onClick={() => applyRelaxedIntent(item.intent)}>{item.label}</button>)}</div>}</div>}
              {!loading && !(tab === "search" && !searchIntent) && !heatShelterMode && visiblePrograms.slice(0, 160).map((program) => (
                <button className="dg-program-card" type="button" key={program.id} onClick={() => { void selectProgram(program); }}>
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
        <div className="dg-mobile-map-chrome">
          <div className="dg-mobile-map-header">
            <Link href="/" aria-label="지도 홈">⌂</Link>
            <button type="button" className="dg-mobile-search-pill" onClick={() => changeTab("search")}><span>⌕</span><strong>{centeredArea.split(" ").at(-1) ?? "우리 동네"} 프로그램 찾기</strong><em>●</em></button>
            <button type="button" className="dg-mobile-bell" onClick={() => changeTab("openrun")} aria-label="알림">♧<i /></button>
          </div>
          <div className="dg-mobile-map-filters" aria-label="지도 빠른 조건">
            <button type="button" className={heatShelterMode ? "active heat" : ""} onClick={toggleHeatShelterMode}>❄ 무더위쉼터</button>
            {[["교육","▣"],["문화예술","◉"],["건강운동","♞"],["공연전시","◈"],["복지","♡"],["디지털","▤"]].map(([field, icon]) => <button key={field} type="button" className={!heatShelterMode && fieldFilter === field ? "active" : ""} onClick={() => toggleMapField(field)}>{icon} {field === "문화예술" ? "문화·예술" : field === "건강운동" ? "건강·운동" : field === "공연전시" ? "공연·전시" : field}</button>)}
            <button type="button" className={audienceFilter === "시니어" ? "active" : ""} onClick={() => setAudienceFilter((value) => value === "시니어" ? null : "시니어")}>👴 시니어</button>
            <button type="button" className={audienceFilter === "어린이" ? "active" : ""} onClick={() => setAudienceFilter((value) => value === "어린이" ? null : "어린이")}>👧 어린이</button>
            <button type="button" className={freeOnly ? "active" : ""} onClick={() => setFreeOnly((value) => !value)}>🆓 무료</button>
            <button type="button" onClick={() => setShowFilter(true)}>☰ 필터</button>
          </div>
        </div>
        <div className="dg-map-tools" aria-label="지도 도구">
          <button type="button" onClick={moveToCurrentLocation}><span>●</span>내 위치</button>
          <button type="button" onClick={() => window.matchMedia("(max-width: 820px)").matches ? openMapTool("programs") : changeTab("map")}><span>▣</span>주변</button>
          <button type="button" onClick={() => openMapTool("calendar")}><span>▦</span>일정</button>
          <button type="button" onClick={() => openMapTool("family")}><span>♧</span>가족</button>
          <button type="button" onClick={() => openMapTool("history")}><span>▰</span>보관함</button>
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
      {alertDialog && <AlertScheduleDialog
        state={alertDialog}
        saved={reminders.includes(alertDialog.program.id)}
        onChange={(scheduledAt) => setAlertDialog((current) => current ? { ...current, scheduledAt } : current)}
        onSave={() => { void saveAlert(); }}
        onRemove={() => { void removeAlert(); }}
        onClose={() => setAlertDialog(null)}
      />}
      {showAuthDialog && !session && <WebAuthDialog
        consentAccepted={authConsentAccepted}
        loading={authLoading}
        onAccept={acceptAccountConsent}
        onBrowse={() => setShowAuthDialog(false)}
        onProvider={(provider) => { void startAccountSignIn(provider); }}
        onClose={() => setShowAuthDialog(false)}
      />}
      {accountError && tab !== "me" && <button type="button" className="dg-sync-toast" onClick={() => setAccountError("")} aria-label="동기화 안내 닫기">{accountError} ×</button>}
    </main>
  );
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
        <p>앱과 같은 계정으로 로그인하면 찜, 오픈런 알림, 가족 정보를 안전하게 이어서 볼 수 있어요.</p>
        <div className="dg-login-buttons" aria-label="로그인 방식 선택">
          <button type="button" disabled={loading} onClick={() => onProvider("kakao")}>Kakao로 계속</button>
          <button type="button" disabled={loading} onClick={() => onProvider("apple")}>Apple로 계속</button>
          <button type="button" disabled={loading} onClick={() => onProvider("google")}>Google로 계속</button>
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

function ProgramDetail({ program, current, usesFallbackLocation, favorite, favoriteTargets, familyMembers, reminder, transport, easyFirst, onBack, onFavorite, onFavoriteTarget, onReminder, onTransport, onRouteChange, onShare, onNearby }: {
  program: WebProgram; current: Coordinate; usesFallbackLocation: boolean; favorite: boolean; favoriteTargets: string[]; familyMembers: WebFamilyMember[]; reminder: boolean; transport: Transport; easyFirst: boolean;
  onBack: () => void; onFavorite: () => void; onFavoriteTarget: (target: string) => void; onReminder: () => void; onTransport: (value: Transport) => void; onRouteChange: (route: WebRouteResult | null) => void; onShare: () => void; onNearby: () => void;
}) {
  const distance = distanceMeters(current, program);
  const routeEstimate = estimatedRoute(distance, transport);
  const transportLabel = transport === "walk" ? "도보" : transport === "car" ? "자동차" : "대중교통";
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

  const timeMetric = usesFallbackLocation ? "—" : route ? `약 ${route.totalMinutes}분` : routeState === "loading" ? "계산 중" : `약 ${routeEstimate.minutes}분`;
  const distanceMetric = usesFallbackLocation ? "—" : route ? distanceLabel(route.totalDistanceMeters) : distanceLabel(routeEstimate.distance);
  const distanceMetricLabel = route ? "이동 거리" : "예상 이동 거리";
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
        {favorite && <section className="dg-favorite-targets"><h2>누구의 찜으로 저장할까요?</h2><div>{targetOptions.map((target) => <button type="button" key={target.id} className={favoriteTargets.includes(target.id) ? "active" : ""} onClick={() => onFavoriteTarget(target.id)}>{target.label}{favoriteTargets.includes(target.id) ? " ✓" : ""}</button>)}</div></section>}
        <section>
          <h2>거리정보</h2>
          <div className="dg-distance-card">
            <div className="dg-route-metrics">
              <div><span>예상 시간</span><strong>{timeMetric}</strong></div>
              <div><span>{distanceMetricLabel}</span><strong>{distanceMetric}</strong></div>
            </div>
            {route ? <p>{transportLabel} 실제 경로를 지도에 표시했어요. 직선 거리는 {distanceLabel(distance)}이며, 경로 공급자의 최신 도로·환승 응답을 사용합니다.</p>
              : routeState === "loading" ? <p>{transportLabel} 실제 경로를 계산하고 있어요.</p>
                : routeState === "waiting" ? <p>현재 위치를 확인하면 {transportLabel} 실제 시간·거리·경로선을 안내해요.</p>
                  : <p>{routeError || `${transportLabel} 경로를 불러오지 못해 직선 거리 ${distanceLabel(distance)}를 기준으로 안내해요.`}</p>}
            {usesFallbackLocation && <p className="dg-location-warning">현재 위치를 아직 확인하지 못했어요. 지도 오른쪽의 ‘내 위치’를 눌러 위치 사용을 허용하면 실제 시간·거리·경로선이 표시됩니다.</p>}
            <div className="dg-transport-tabs"><button type="button" className={transport === "walk" ? "active" : ""} onClick={() => onTransport("walk")}>🚶 도보</button><button type="button" className={transport === "transit" ? "active" : ""} onClick={() => onTransport("transit")}>🚇 대중교통</button><button type="button" className={transport === "car" ? "active" : ""} onClick={() => onTransport("car")}>🚗 자동차</button></div>
            <button className="dg-roadview-button" type="button" onClick={() => setShowRoadview((value) => !value)}>◉ {showRoadview ? "시설 거리뷰 닫기" : "시설 거리뷰 보기"}</button>
            {showRoadview && <KakaoRoadviewPreview coordinate={program} facilityName={program.facility} />}
            <a className="dg-route-button" href={route?.landingURL || routeLink(program, current, transport)} target="_blank" rel="noreferrer">Kakao 지도에서 이어서 보기</a>
            <button className="dg-nearby-button" type="button" onClick={onNearby}>☕ 목적지 주변 가게 보기</button>
          </div>
        </section>
        <p className="dg-source">공공데이터 출처: {program.source ?? "제공기관 공개 데이터"}</p>
      </div>
      <footer className="dg-detail-footer">
        {officialAccess ? <a className="dg-apply" href={officialAccess.href} target="_blank" rel="external nofollow noopener noreferrer" referrerPolicy="no-referrer">{officialAccess.requiresHomepageSearch ? `${officialAccess.providerName} 홈에서 검색` : "신청하러 가기"}</a> : <button className="dg-apply" type="button" disabled>신청 링크 확인 중</button>}
        <div><button type="button" className={reminder ? "active" : ""} onClick={onReminder}>♧ {reminder ? "알림 저장됨" : "알림 받기"}</button><button type="button" onClick={onShare}>↗ 공유</button>{program.phone ? <a href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}>☎ 전화 문의</a> : <span>전화번호 없음</span>}</div>
      </footer>
    </article>
  );
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
  return <section className="dg-openrun-panel"><header><h1>오픈런 알림 <span>⚡</span></h1><p>접수 시작·마감 전에 알려드릴게요</p></header><div className="dg-openrun-scroll"><section className="dg-keyword-card"><div><strong>🔔 알림 키워드</strong><small>자세히 보기 ›</small></div><p>관심 키워드를 선택하면 해당 프로그램만 알려드려요</p><div>{suggestions.map((keyword) => <button type="button" key={keyword} className={keywords.includes(keyword) ? "active" : ""} onClick={() => setKeywords((current) => current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword])}>{keywords.includes(keyword) ? `${keyword} ✓` : keyword}</button>)}</div></section>{upcoming.length ? upcoming.map((program) => <article className="dg-openrun-card" key={program.id}><div className="dg-openrun-banner"><span>{banner(program)}</span>{reminders.includes(program.id) && <strong>✓ 알림 켜짐</strong>}</div><button type="button" className="dg-openrun-copy" onClick={() => onOpen(program)}><strong>{program.name}</strong><span>{program.facility} · {program.scheduleText ?? "일정 확인"} · {program.isFree ? "무료" : program.feeText}</span></button><div><button type="button" className={reminders.includes(program.id) ? "is-off" : ""} onClick={() => onToggleReminder(program)}>{reminders.includes(program.id) ? "⏰ 알림 변경" : "🔔 알림 켜기"}</button><button type="button" onClick={() => onOpen(program)}>신청하러 가기</button></div></article>) : <div className="dg-empty"><strong>{keywords.length ? "선택한 키워드에 해당하는 프로그램이 없어요" : "현재 접수가 임박한 프로그램이 없어요"}</strong>{keywords.length > 0 && <button type="button" onClick={() => setKeywords([])}>키워드 해제하기</button>}</div>}<p className="dg-openrun-tip">▦ 프로그램의 알림 받기 버튼에서 원하는 날짜와 시간을 직접 선택할 수 있어요.</p></div></section>;
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

function AlertScheduleDialog({ state, saved, onChange, onSave, onRemove, onClose }: { state: AlertDialogState; saved: boolean; onChange: (value: string) => void; onSave: () => void; onRemove: () => void; onClose: () => void }) {
  return <div className="dg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dg-alert-dialog" role="dialog" aria-modal="true" aria-labelledby="dg-alert-title">
      <header><div><small>오픈런 알림</small><h2 id="dg-alert-title">날짜와 시간을 골라주세요</h2></div><button type="button" onClick={onClose} aria-label="닫기">×</button></header>
      <p><strong>{state.program.name}</strong><span>{state.program.facility}</span></p>
      <label>알림 받을 시간<input type="datetime-local" value={state.scheduledAt} onChange={(event) => onChange(event.target.value)} /></label>
      <div className="dg-alert-notice">브라우저를 열어 둔 동안에는 기기 알림으로도 알려드리고, 로그인하면 선택한 시간은 앱과 같은 계정에 저장됩니다.</div>
      <div className="dg-alert-actions">{saved && <button type="button" className="danger" onClick={onRemove}>알림 끄기</button>}<button type="button" className="primary" onClick={onSave}>{saved ? "알림 시간 변경" : "알림 저장"}</button></div>
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

function NearbyPlacesPanel({ program, summary, loading, radius, category, selected, walkingRoute, onBack, onRadius, onCategory, onSelect }: {
  program: WebProgram; summary: WebNearbyPlacesSummary | null; loading: boolean; radius: number; category: NearbyCategory; selected: WebNearbyPlace | null; walkingRoute: WebRouteResult | null;
  onBack: () => void; onRadius: (value: number) => void; onCategory: (value: NearbyCategory) => void; onSelect: (place: WebNearbyPlace) => void;
}) {
  const places = (summary?.places ?? []).filter((place) => category === "all" || place.placeType === category);
  const categoryTitle: Record<NearbyCategory, string> = { all: "전체", restaurant: "음식점", cafe: "카페", fast_food: "패스트푸드", convenience_store: "편의점", other_food: "분식" };
  return <section className="dg-aux-panel"><PanelHeader title="주변 가게" subtitle={`${program.facility}에서 걸어서 갈 만한 곳`} onBack={onBack} /><div className="dg-radius-row">{[100, 300, 500, 1000].map((value) => <button type="button" key={value} className={radius === value ? "active" : ""} onClick={() => onRadius(value)}>{value === 1000 ? "1km" : `${value}m`}</button>)}</div><div className="dg-nearby-categories">{(Object.keys(categoryTitle) as NearbyCategory[]).map((value) => <button type="button" key={value} className={category === value ? "active" : ""} onClick={() => onCategory(value)}>{categoryTitle[value]} {value === "all" ? summary?.totalCount ?? 0 : summary?.categoryCounts[value] ?? 0}</button>)}</div>{selected && <div className="dg-nearby-route-summary"><strong>{selected.name}</strong><span>{walkingRoute ? `도보 약 ${walkingRoute.totalMinutes}분 · ${distanceLabel(walkingRoute.totalDistanceMeters)}` : `직선 ${distanceLabel(selected.distanceMeters)} · 도보 경로 계산 중`}</span></div>}<div className="dg-aux-list dg-nearby-list">{loading ? <div className="dg-loading"><strong>목적지 주변을 찾고 있어요</strong></div> : places.length ? <>{places.map((place) => {
    const displayName = place.branchName && !place.name.includes(place.branchName) ? `${place.name} ${place.branchName}` : place.name;
    const parking = place.parkingLotID ? place.parkingAvailableSpaces && place.parkingAvailableSpaces > 0 ? `주변 주차 가능 · ${place.parkingAvailableSpaces}면` : `주변 주차장 · ${place.parkingDistanceMeters ? distanceLabel(place.parkingDistanceMeters) : "정보 확인"}` : "주차 정보 없음";
    return <article id={`nearby-place-${place.id}`} className={`dg-nearby-card${selected?.id === place.id ? " selected" : ""}`} key={place.id}><button type="button" className="dg-nearby-card-main" onClick={() => onSelect(place)}><span className="dg-place-type">{place.placeType === "cafe" ? "☕" : place.placeType === "convenience_store" ? "▣" : place.placeType === "fast_food" ? "🥤" : "🍴"}</span><span><small>{place.businessStatusName ?? categoryTitle[place.placeType]}</small><strong>{displayName}</strong><em>{distanceLabel(place.distanceMeters)} · {place.address ?? "주소 정보 없음"}</em><em className="dg-parking-copy">{parking}</em></span></button><div className="dg-nearby-map-actions"><button type="button" onClick={() => onSelect(place)}>🗺️ 동네고고 지도</button><a href={nearbyNaverLink(place)} target="_blank" rel="noreferrer">네이버 지도</a><a href={nearbyKakaoLink(place)} target="_blank" rel="noreferrer">카카오 지도</a></div></article>;
  })}{summary && !summary.isComplete && <p className="dg-nearby-limit">반경 안 {summary.totalCount.toLocaleString("ko-KR")}곳 중 가까운 순으로 {places.length.toLocaleString("ko-KR")}곳을 보여드려요.</p>}</> : <div className="dg-empty"><strong>이 반경에는 표시할 가게가 없어요.</strong><p>반경을 넓혀 다시 찾아보세요.</p></div>}</div></section>;
}
