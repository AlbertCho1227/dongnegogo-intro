"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { WebMapCluster, WebMapViewportResult, WebProgram } from "@/lib/web-program-data";
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
};

declare global {
  interface Window { kakao?: { maps: KakaoMaps } }
}

type Tab = "map" | "search" | "openrun" | "saved" | "me";
type Sort = "distance" | "available" | "free";
type StatusFilter = "전체" | "접수중" | "접수예정" | "마감임박";
type Transport = "walk" | "transit" | "car";
type Coordinate = { latitude: number; longitude: number };

const FALLBACK: Coordinate = { latitude: 37.6027, longitude: 127.0128 };
const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "map", icon: "●", label: "지도" },
  { id: "search", icon: "⌕", label: "찾기" },
  { id: "openrun", icon: "♧", label: "오픈런" },
  { id: "saved", icon: "♡", label: "찜" },
  { id: "me", icon: "♙", label: "내정보" },
];

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
  const [programs, setPrograms] = useState<WebProgram[]>([]);
  const [mapClusters, setMapClusters] = useState<WebMapCluster[]>([]);
  const [programCounts, setProgramCounts] = useState<Record<string, number>>({});
  const [mapMode, setMapMode] = useState<"individual" | "cluster">("individual");
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<WebProgram | null>(null);
  const [query, setQuery] = useState("");
  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  const [searchCandidates, setSearchCandidates] = useState<WebProgram[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("distance");
  const [fieldFilter, setFieldFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [todayOnly, setTodayOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [seniorOnly, setSeniorOnly] = useState(false);
  const [location, setLocation] = useState<Coordinate>(FALLBACK);
  const [usesFallbackLocation, setUsesFallbackLocation] = useState(true);
  const [center, setCenter] = useState<Coordinate>(FALLBACK);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(kakaoMapKey));
  const [mapReady, setMapReady] = useState(false);
  const [mapLevel, setMapLevel] = useState(5);
  const [error, setError] = useState(kakaoMapKey ? "" : "Kakao 지도 연결 설정을 확인해 주세요.");
  const [transport, setTransport] = useState<Transport>("transit");
  const [bigText, setBigText] = useState(false);
  const [easyFirst, setEasyFirst] = useState(true);
  const [phoneFirst, setPhoneFirst] = useState(false);
  const [bigAlerts, setBigAlerts] = useState(true);

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
  }, []);

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

  const visiblePrograms = useMemo(() => {
    const items = programs.filter((program) => {
      if (!fieldMatches(program, fieldFilter)) return false;
      if (freeOnly && !program.isFree) return false;
      if (seniorOnly && !program.isSeniorRecommended && !program.audiences.some((audience) => /시니어|어르신|노인|65세/.test(audience))) return false;
      if (statusFilter !== "전체" && (statusFilter === "접수중" ? !/접수중|상시|진행중|가능|안내중/.test(program.status) : statusFilter === "접수예정" ? !/예정|곧/.test(program.status) : !/마감임박/.test(program.status))) return false;
      if (todayOnly && !/접수중|상시|진행중|가능|안내중|마감임박/.test(program.status)) return false;
      if (tab === "saved" && !favorites.includes(program.id)) return false;
      if (tab === "openrun" && (!program.receiptStart || !isAvailable(program))) return false;
      return true;
    });
    return items.sort((a, b) => {
      if (sort === "free" && a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      if (sort === "available" && isAvailable(a) !== isAvailable(b)) return isAvailable(a) ? -1 : 1;
      return distanceMeters(center, a) - distanceMeters(center, b);
    });
  }, [programs, fieldFilter, freeOnly, seniorOnly, statusFilter, todayOnly, tab, favorites, sort, center]);

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
    if (mapRef.current && window.kakao?.maps) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(program.latitude, program.longitude));
    }
    try {
      const hydrated = await fetchPrograms(new URLSearchParams({ id: program.id }));
      if (hydrated[0]) setSelected((currentProgram) => currentProgram?.id === program.id ? hydrated[0] : currentProgram);
    } catch {
      // The compact map row is still sufficient when optional detail hydration fails.
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    if (mapMode === "cluster" && tab === "map" && fieldFilter === "전체" && !freeOnly && !seniorOnly && statusFilter === "전체" && !todayOnly) {
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
      button.addEventListener("click", () => { void selectProgram(representative); });
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
  }, [visiblePrograms, visibleClusters, selected, mapLevel, mapMode, programCounts, tab, fieldFilter, freeOnly, seniorOnly, statusFilter, todayOnly, selectProgram]);

  const runSearch = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term) { searchActiveRef.current = false; setSearchIntent(null); setTab("map"); if (mapRef.current) loadBounds(mapRef.current); return; }
    searchActiveRef.current = true;
    setTab("search");
    setSelected(null);
    setLoading(true);
    try {
      const intent = parseSearchIntent(term);
      setSearchIntent(intent);
      const params = new URLSearchParams();
      intent.subjectTerms.forEach((value) => params.append("subject", value));
      intent.areaTerms.forEach((value) => params.append("area", value));
      intent.generalTerms.forEach((value) => params.append("general", value));
      const candidates = await fetchPrograms(params);
      setSearchCandidates(candidates);
      const matches = searchPrograms(candidates, intent, location).map((item) => item.program);
      setPrograms(matches);
      setMapMode("individual");
      setMapClusters([]);
      const nextRecent = [term, ...recentSearches.filter((item) => item !== term)].slice(0, 8);
      setRecentSearches(nextRecent);
      localStorage.setItem("dongnegogo.web.recentSearches", JSON.stringify(nextRecent));
      setError("");
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
      if (mapRef.current && window.kakao?.maps) {
        mapRef.current.setCenter(new window.kakao.maps.LatLng(next.latitude, next.longitude));
        mapRef.current.setLevel(4);
      }
    }, () => setError("위치 권한이 없어 정릉동을 기준으로 보여드려요."), { enableHighAccuracy: false, timeout: 8_000 });
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

  const changeTab = (nextTab: Tab) => {
    searchActiveRef.current = nextTab === "search";
    if (nextTab !== "search") setSearchIntent(null);
    setTab(nextTab);
    setSelected(null);
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
        {selected ? (
          <ProgramDetail
            program={selected} current={location} favorite={favorites.includes(selected.id)}
            usesFallbackLocation={usesFallbackLocation}
            reminder={reminders.includes(selected.id)} transport={transport} easyFirst={easyFirst}
            onBack={() => setSelected(null)} onFavorite={() => toggleFavorite(selected.id)}
            onReminder={() => toggleReminder(selected.id)} onTransport={setTransport}
            onShare={() => share(selected)}
          />
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
              {tab === "search" && searchIntent && <div className="dg-intent-chips" aria-label="검색 조건">{searchIntent.chips.map((chip) => <span key={chip}>{chip}</span>)}</div>}
              {tab === "search" && !searchIntent && <div className="dg-search-suggestions">
                {["이번 주말 아이랑 갈 무료 행사", "내일 오픈런 접수 시작하는 강좌", "우리 동네 시니어 컴퓨터 교실", "가까운 무료 수영 강좌"].map((example) => <button key={example} type="button" onClick={() => chooseSearch(example)}>{example}</button>)}
                {recentSearches.length > 0 && <><small>최근 검색</small>{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => chooseSearch(recent)}>↻ {recent}</button>)}</>}
              </div>}
              <div className="dg-location-row"><button type="button" onClick={moveToCurrentLocation}>● 성북구 정릉동</button><span>{visiblePrograms.length}곳</span></div>
              <div className="dg-filter-row">
                {["전체", "교육", "문화예술", "건강운동", "공연전시", "복지", "디지털"].map((field) => <button key={field} type="button" className={fieldFilter === field ? "active" : ""} onClick={() => setFieldFilter(field)}>{field}</button>)}
                <button type="button" className={freeOnly ? "active" : ""} onClick={() => setFreeOnly((value) => !value)}>무료</button>
                <button type="button" className={seniorOnly ? "active" : ""} onClick={() => setSeniorOnly((value) => !value)}>어르신</button>
                <button type="button" className={todayOnly ? "active" : ""} onClick={() => setTodayOnly((value) => !value)}>오늘 신청</button>
                <button type="button" className={statusFilter === "접수중" ? "active" : ""} onClick={() => setStatusFilter((value) => value === "접수중" ? "전체" : "접수중")}>접수중</button>
              </div>
              <div className="dg-sort-row">
                <button type="button" className={sort === "distance" ? "active" : ""} onClick={() => setSort("distance")}>가까운 순</button>
                <button type="button" className={sort === "available" ? "active" : ""} onClick={() => setSort("available")}>신청 가능 순</button>
                <button type="button" className={sort === "free" ? "active" : ""} onClick={() => setSort("free")}>무료 먼저</button>
              </div>
            </header>
            <div className="dg-result-list">
              {loading && <div className="dg-loading"><img src="/web-assets/beodeuli-search-assistant.png" alt="" /><strong>우리 동네 프로그램을 찾고 있어요</strong></div>}
              {!loading && error && <div className="dg-empty"><strong>{error}</strong><button type="button" onClick={() => mapRef.current && loadBounds(mapRef.current)}>다시 불러오기</button></div>}
              {!loading && !error && visiblePrograms.length === 0 && <div className="dg-empty"><img src="/web-assets/beodeuli-search-success.png" alt="" /><strong>조건에 맞는 프로그램을 못 찾았어요.</strong><p>조건 하나만 넓혀 다시 찾아볼 수 있어요.</p>{searchIntent && <div className="dg-relaxed-search">{relaxedSuggestions(searchIntent).map((item) => <button key={item.label} type="button" onClick={() => applyRelaxedIntent(item.intent)}>{item.label}</button>)}</div>}</div>}
              {!loading && visiblePrograms.slice(0, 160).map((program) => (
                <button className={`dg-program-card ${selected?.id === program.id ? "selected" : ""}`} type="button" key={program.id} onClick={() => { void selectProgram(program); }}>
                  <img src={`/markers/${programIconName(program)}.png`} alt="" />
                  <span className="dg-card-copy"><span className={`dg-status ${statusClass(program)}`}>{program.status}</span><strong>{program.name}</strong><small>{distanceLabel(distanceMeters(center, program))} · {program.facility}</small><em>{program.isFree ? "무료" : program.feeText}</em></span>
                  <span className="dg-card-arrow" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="dg-map-area" aria-label="Kakao 지도">
        <div ref={mapElementRef} className="dg-map-canvas" />
        {!mapReady && <div className="dg-map-skeleton"><img src="/brand/app-icon.png" alt="" /><strong>지도를 준비하고 있어요</strong></div>}
        <div className="dg-map-tools" aria-label="지도 도구">
          <button type="button" onClick={moveToCurrentLocation}><span>◎</span>주변</button>
          <button type="button" onClick={() => changeTab("openrun")}><span>▣</span>일정</button>
          <button type="button" onClick={() => { setSeniorOnly(true); changeTab("map"); }}><span>♧</span>부모님</button>
          <button type="button" onClick={() => { setFieldFilter("전체"); setFreeOnly(false); setSeniorOnly(false); setStatusFilter("전체"); setTodayOnly(false); }}><span>◔</span>한눈에</button>
          <button type="button" onClick={() => changeTab("saved")}><span>▰</span>보관함</button>
        </div>
        <div className="dg-zoom-tools"><button type="button" aria-label="지도 확대" onClick={() => mapRef.current?.setLevel(Math.max(1, mapRef.current.getLevel() - 1))}>＋</button><button type="button" aria-label="지도 축소" onClick={() => mapRef.current?.setLevel(Math.min(14, mapRef.current.getLevel() + 1))}>−</button></div>
        <div className="dg-map-caption"><strong>성북구 정릉동 주변</strong><span>지도를 움직이면 자동으로 다시 찾아요</span></div>
      </section>
    </main>
  );
}

function Preference({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="dg-preference"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function ProgramDetail({ program, current, usesFallbackLocation, favorite, reminder, transport, easyFirst, onBack, onFavorite, onReminder, onTransport, onShare }: {
  program: WebProgram; current: Coordinate; usesFallbackLocation: boolean; favorite: boolean; reminder: boolean; transport: Transport; easyFirst: boolean;
  onBack: () => void; onFavorite: () => void; onReminder: () => void; onTransport: (value: Transport) => void; onShare: () => void;
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
        <section><h2>거리정보</h2><div className="dg-distance-card"><div className="dg-route-metrics"><div><span>예상 시간</span><strong>약 {routeEstimate.minutes}분</strong></div><div><span>예상 이동 거리</span><strong>{distanceLabel(routeEstimate.distance)}</strong></div></div><p>{transportLabel} 경로를 {usesFallbackLocation ? "정릉동 기준 위치" : "현재 위치"}와 시설 좌표로 추정한 값이에요. 직선 거리는 {distanceLabel(distance)}이며, 실제 도로·환승 경로는 카카오맵에서 확인할 수 있어요.</p>{usesFallbackLocation && <p className="dg-location-warning">정확한 거리정보를 보려면 지도 오른쪽의 ‘주변’을 눌러 위치 사용을 허용해 주세요.</p>}<div className="dg-transport-tabs"><button type="button" className={transport === "walk" ? "active" : ""} onClick={() => onTransport("walk")}>🚶 도보</button><button type="button" className={transport === "transit" ? "active" : ""} onClick={() => onTransport("transit")}>🚇 대중교통</button><button type="button" className={transport === "car" ? "active" : ""} onClick={() => onTransport("car")}>🚗 자동차</button></div><a className="dg-route-button" href={routeLink(program, current, transport)} target="_blank" rel="noreferrer">Kakao 지도에서 실제 경로 확인</a></div></section>
        <p className="dg-source">공공데이터 출처: {program.source ?? "제공기관 공개 데이터"}</p>
      </div>
      <footer className="dg-detail-footer">
        {officialAccess ? <a className="dg-apply" href={officialAccess.href} target="_blank" rel="external nofollow noopener noreferrer" referrerPolicy="no-referrer">{officialAccess.requiresHomepageSearch ? "공식 예약 홈에서 검색" : "신청하러 가기"}</a> : <button className="dg-apply" type="button" disabled>신청 링크 확인 중</button>}
        <div><button type="button" className={reminder ? "active" : ""} onClick={onReminder}>♧ {reminder ? "알림 저장됨" : "알림 받기"}</button><button type="button" onClick={onShare}>↗ 공유</button>{program.phone ? <a href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}>☎ 전화 문의</a> : <span>전화번호 없음</span>}</div>
      </footer>
    </article>
  );
}
