"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { WebProgram } from "@/lib/web-program-data";

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

const ICON_RULES: Array<[string, string]> = [
  ["무더위", "icon_heat_shelter"], ["어르신체육", "icon_senior_activity"],
  ["수영", "icon_swimming"], ["요가", "icon_yoga"], ["필라테스", "icon_pilates"],
  ["댄스", "icon_aerobics"], ["농구", "icon_basketball"], ["테니스", "icon_tennis"],
  ["골프", "icon_golf"], ["배드민턴", "icon_badminton"], ["탁구", "icon_table_tennis"],
  ["축구", "icon_football"], ["풋살", "icon_football"], ["야구", "icon_baseball"],
  ["배구", "icon_volleyball"], ["클라이밍", "icon_climbing"], ["태권도", "icon_martial_arts"],
  ["헬스", "icon_gym_health"], ["걷기", "icon_walking_trekking"], ["체조", "icon_walking"],
  ["뮤지컬", "icon_musical"], ["오페라", "icon_musical"], ["연극", "icon_theater"],
  ["전시", "icon_exhibition"], ["미술", "icon_visual_arts"], ["공예", "icon_craft"],
  ["무용", "icon_dance"], ["발레", "icon_dance"], ["국악", "icon_traditional_music"],
  ["음악", "icon_music"], ["콘서트", "icon_music"], ["축제", "icon_festival"],
  ["영화", "icon_culture"], ["외국어", "icon_foreign_language"], ["영어", "icon_foreign_language"],
  ["컴퓨터", "icon_digital"], ["디지털", "icon_digital"], ["스마트폰", "icon_digital"],
  ["요리", "icon_cooking"], ["베이킹", "icon_cooking"], ["독서", "icon_humanities"],
  ["글쓰기", "icon_humanities"], ["강좌", "icon_humanities"], ["교육", "icon_humanities"],
  ["건강", "icon_health"], ["복지", "icon_health"], ["공간대여", "icon_space_rental"],
  ["대관", "icon_space_rental"], ["생활", "icon_lifestyle"],
];

function iconName(program: WebProgram) {
  const haystack = `${program.name} ${program.category} ${program.field} ${program.facility}`.toLowerCase();
  return ICON_RULES.find(([keyword]) => haystack.includes(keyword.toLowerCase()))?.[1] ?? "icon_other";
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const radius = 6_371_000;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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

function statusClass(program: WebProgram) {
  if (/마감임박/.test(program.status)) return "urgent";
  if (!isAvailable(program)) return "closed";
  return "open";
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
  const activeSearchRef = useRef("");
  const [programs, setPrograms] = useState<WebProgram[]>([]);
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<WebProgram | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("distance");
  const [fieldFilter, setFieldFilter] = useState("전체");
  const [freeOnly, setFreeOnly] = useState(false);
  const [seniorOnly, setSeniorOnly] = useState(false);
  const [location, setLocation] = useState<Coordinate>(FALLBACK);
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
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
      const mapCenter = map.getCenter();
      setCenter({ latitude: mapCenter.getLat(), longitude: mapCenter.getLng() });
      setMapLevel(map.getLevel());
    const params = new URLSearchParams({
      south: String(sw.getLat()), west: String(sw.getLng()),
      north: String(ne.getLat()), east: String(ne.getLng()), limit: "500",
    });
    if (activeSearchRef.current) params.set("q", activeSearchRef.current);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const rows = await fetchPrograms(params, controller.signal);
      setPrograms(rows);
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
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoMapKey)}&autoload=false`;
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
      if (fieldFilter !== "전체" && !`${program.category} ${program.field}`.includes(fieldFilter)) return false;
      if (freeOnly && !program.isFree) return false;
      if (seniorOnly && !program.audiences.some((audience) => /시니어|어르신|노인|65세/.test(audience))) return false;
      if (tab === "saved" && !favorites.includes(program.id)) return false;
      if (tab === "openrun" && (!program.receiptStart || !isAvailable(program))) return false;
      return true;
    });
    return items.sort((a, b) => {
      if (sort === "free" && a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      if (sort === "available" && isAvailable(a) !== isAvailable(b)) return isAvailable(a) ? -1 : 1;
      return distanceMeters(center, a) - distanceMeters(center, b);
    });
  }, [programs, fieldFilter, freeOnly, seniorOnly, tab, favorites, sort, center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    const grouped = new Map<string, WebProgram[]>();
    const grid = mapLevel <= 3 ? 0.0015 : mapLevel === 4 ? 0.0035 : mapLevel === 5 ? 0.0075 : mapLevel === 6 ? 0.014 : 0.024;
    visiblePrograms.forEach((program) => {
      const key = `${Math.round(program.latitude / grid)}:${Math.round(program.longitude / grid)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), program]);
    });
    Array.from(grouped.values()).slice(0, 500).forEach((group) => {
      const representative = group.find(isAvailable) ?? group[0];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dg-map-marker${selected?.id === representative.id ? " is-selected" : ""}`;
      button.setAttribute("aria-label", group.length > 1 ? `이 주변 ${group.length}개 프로그램` : representative.name);
      const image = document.createElement("img");
      image.src = `/markers/${iconName(representative)}.png`;
      image.alt = "";
      button.appendChild(image);
      if (group.length > 1) {
        const badge = document.createElement("span");
        badge.textContent = group.length > 99 ? "99+" : String(group.length);
        button.appendChild(badge);
      }
      const label = document.createElement("small");
      label.textContent = representative.name.length > 16 ? `${representative.name.slice(0, 16)}…` : representative.name;
      button.appendChild(label);
      button.addEventListener("click", () => setSelected(representative));
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
  }, [visiblePrograms, selected, mapLevel]);

  const submitSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const term = query.trim();
    activeSearchRef.current = term;
    if (!term) { setTab("map"); if (mapRef.current) loadBounds(mapRef.current); return; }
    setTab("search");
    setSelected(null);
    setLoading(true);
    try {
      const rows = await fetchPrograms(new URLSearchParams({ q: term, limit: "160" }));
      setPrograms(rows);
      setError("");
      if (mapRef.current && rows.length && window.kakao?.maps) {
        const bounds = new window.kakao.maps.LatLngBounds();
        rows.slice(0, 80).forEach((program) => bounds.extend(new window.kakao.maps.LatLng(program.latitude, program.longitude)));
        mapRef.current.setBounds(bounds, 70, 70, 70, 70);
      }
    } catch (searchError) { setError((searchError as Error).message); }
    finally { setLoading(false); }
  };

  const moveToCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocation(next);
      if (mapRef.current && window.kakao?.maps) {
        mapRef.current.setCenter(new window.kakao.maps.LatLng(next.latitude, next.longitude));
        mapRef.current.setLevel(4);
      }
    }, () => setError("위치 권한이 없어 정릉동을 기준으로 보여드려요."), { enableHighAccuracy: false, timeout: 8_000 });
  };

  const selectProgram = (program: WebProgram) => {
    setSelected(program);
    if (mapRef.current && window.kakao?.maps) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(program.latitude, program.longitude));
    }
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

  return (
    <main className={`dg-web-app${bigText ? " dg-big-text" : ""}`}>
      <aside className="dg-nav-rail" aria-label="웹 버전 메뉴">
        <Link className="dg-brand-mark" href="/" aria-label="동네고고 소개 페이지로 돌아가기">
          <img src="/brand/app-icon.png" alt="" /><strong>동네<br />고고</strong>
        </Link>
        <nav>
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id && !selected ? "active" : ""} onClick={() => { setTab(item.id); setSelected(null); }}>
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
                <span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역 · 기관 · 강좌명으로 검색" aria-label="프로그램 검색" />
                {query && <button type="button" className="dg-clear" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
                <button type="submit" className="dg-search-button">검색</button>
              </form>
              <div className="dg-location-row"><button type="button" onClick={moveToCurrentLocation}>● 성북구 정릉동</button><span>{visiblePrograms.length}곳</span></div>
              <div className="dg-filter-row">
                {["전체", "교육", "문화", "체육", "복지"].map((field) => <button key={field} type="button" className={fieldFilter === field ? "active" : ""} onClick={() => setFieldFilter(field)}>{field}</button>)}
                <button type="button" className={freeOnly ? "active" : ""} onClick={() => setFreeOnly((value) => !value)}>무료</button>
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
              {!loading && !error && visiblePrograms.length === 0 && <div className="dg-empty"><img src="/web-assets/beodeuli-search-success.png" alt="" /><strong>조건에 맞는 프로그램을 못 찾았어요.</strong><p>검색어를 짧게 바꾸거나 필터를 해제해 보세요.</p></div>}
              {!loading && visiblePrograms.slice(0, 160).map((program) => (
                <button className={`dg-program-card ${selected?.id === program.id ? "selected" : ""}`} type="button" key={program.id} onClick={() => selectProgram(program)}>
                  <img src={`/markers/${iconName(program)}.png`} alt="" />
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
          <button type="button" onClick={() => { setTab("openrun"); setSelected(null); }}><span>▣</span>일정</button>
          <button type="button" onClick={() => { setSeniorOnly(true); setTab("map"); setSelected(null); }}><span>♧</span>부모님</button>
          <button type="button" onClick={() => { setFieldFilter("전체"); setFreeOnly(false); setSeniorOnly(false); }}><span>◔</span>한눈에</button>
          <button type="button" onClick={() => { setTab("saved"); setSelected(null); }}><span>▰</span>보관함</button>
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

function ProgramDetail({ program, current, favorite, reminder, transport, easyFirst, onBack, onFavorite, onReminder, onTransport, onShare }: {
  program: WebProgram; current: Coordinate; favorite: boolean; reminder: boolean; transport: Transport; easyFirst: boolean;
  onBack: () => void; onFavorite: () => void; onReminder: () => void; onTransport: (value: Transport) => void; onShare: () => void;
}) {
  const distance = distanceMeters(current, program);
  return (
    <article className="dg-detail">
      <header className="dg-detail-hero">
        <div className="dg-detail-actions"><button type="button" onClick={onBack} aria-label="목록으로 돌아가기">‹</button><span /><button type="button" onClick={onFavorite} aria-label="찜하기">{favorite ? "♥" : "♡"}</button><button type="button" onClick={onShare} aria-label="공유하기">↗</button><a href={mapLink(program)} target="_blank" rel="noreferrer" aria-label="Kakao 지도에서 보기">⌖</a></div>
        <div className="dg-detail-badges"><span>{program.status}</span>{program.applyUrl && <span>✓ 신청 링크 확인됨</span>}</div>
        <h1>{program.name}</h1><p>▥ {program.facility}</p>
      </header>
      <div className="dg-detail-scroll">
        <section><h2>프로그램 포스터</h2><div className="dg-poster">{program.imageUrl ? <img src={program.imageUrl} alt={`${program.name} 포스터`} /> : <img src={`/markers/${iconName(program)}.png`} alt="" />}</div></section>
        {easyFirst && <section className="dg-easy-summary"><h2>이 프로그램은요</h2><p>{program.summary}</p></section>}
        <section><h2>프로그램 정보</h2><dl className="dg-info-list"><div><dt>♙</dt><dd><small>누가 신청할 수 있나요?</small><strong>{program.requirement ?? (program.audiences.join(" · ") || "신청 페이지에서 확인")}</strong></dd></div><div><dt>◷</dt><dd><small>언제 하나요?</small><strong>{program.periodText ?? program.scheduleText ?? "일정은 신청 페이지에서 확인"}</strong>{program.scheduleText && <span>{program.scheduleText}</span>}</dd></div><div><dt>⌖</dt><dd><small>어디서 하나요?</small><strong>{program.facility}{program.room ? ` · ${program.room}` : ""}</strong><span>{program.address ?? program.area}</span></dd></div><div><dt>₩</dt><dd><small>비용과 준비물</small><strong>{program.isFree ? "무료" : program.feeText}</strong>{program.preparation && <span>{program.preparation}</span>}</dd></div></dl></section>
        {!easyFirst && <section className="dg-easy-summary"><h2>프로그램 안내</h2><p>{program.summary}</p></section>}
        <section><h2>거리정보</h2><div className="dg-distance-card"><div><span>직선 거리</span><strong>{distanceLabel(distance)}</strong></div><p>현재 위치에서 프로그램 장소까지의 직선거리예요.</p><div className="dg-transport-tabs"><button type="button" className={transport === "walk" ? "active" : ""} onClick={() => onTransport("walk")}>🚶 도보</button><button type="button" className={transport === "transit" ? "active" : ""} onClick={() => onTransport("transit")}>🚇 대중교통</button><button type="button" className={transport === "car" ? "active" : ""} onClick={() => onTransport("car")}>🚗 자동차</button></div><a className="dg-route-button" href={routeLink(program, current, transport)} target="_blank" rel="noreferrer">Kakao 지도에서 실제 경로 확인</a></div></section>
        <p className="dg-source">공공데이터 출처: {program.source ?? "제공기관 공개 데이터"}</p>
      </div>
      <footer className="dg-detail-footer">
        {program.applyUrl ? <a className="dg-apply" href={program.applyUrl} target="_blank" rel="noreferrer">신청하러 가기</a> : <button className="dg-apply" type="button" disabled>신청 링크 확인 중</button>}
        <div><button type="button" className={reminder ? "active" : ""} onClick={onReminder}>♧ {reminder ? "알림 저장됨" : "알림 받기"}</button><button type="button" onClick={onShare}>↗ 공유</button>{program.phone ? <a href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}>☎ 전화 문의</a> : <span>전화번호 없음</span>}</div>
      </footer>
    </article>
  );
}
