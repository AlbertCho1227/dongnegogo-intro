"use client";

import type { User } from "@supabase/supabase-js";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadKakaoMap } from "@/lib/kakao-map";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  BellIcon, ChevronIcon, CloseIcon, ExternalIcon, HeartIcon, ListIcon,
  LocateIcon, PinIcon, SearchIcon, SlidersIcon, UserIcon,
} from "./icons";
import styles from "./MapExplorer.module.css";

type Program = {
  id: string; name: string; category: string | null; field: string | null;
  facility: string | null; address: string | null; area: string | null;
  region: string | null; latitude: number; longitude: number;
  is_free: boolean | null; fee_text: string | null; status: string | null;
  receipt_start: string | null; receipt_end: string | null;
  lecture_start: string | null; lecture_end: string | null;
  schedule_text: string | null; audiences: string[] | null; summary: string | null;
  apply_url: string | null; phone: string | null; is_senior_recommended: boolean | null;
  primary_image_url: string | null; primary_image_source: string | null; image_count: number | null;
};

type ProgramMedia = {
  media_id: string;
  source_key: string;
  source_id: string | null;
  media_role: "program_poster" | "program_image";
  image_url: string;
  thumbnail_url: string | null;
  external_url: string | null;
  attribution: string | null;
  license: string | null;
  license_url: string | null;
  is_primary: boolean;
};

type FacilityMedia = {
  media_id: string;
  provider: string;
  media_type: "official_photo" | "kakao_place" | "kakao_roadview" | "google_place_photo" | "google_streetview" | "mapillary";
  photo_url: string | null;
  thumbnail_url: string | null;
  external_url: string | null;
  attribution: string | null;
  match_confidence: number | null;
  is_primary: boolean;
};

type MapController = {
  locate: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  center: () => { latitude: number; longitude: number } | null;
};

const categoryStyle: Record<string, { emoji: string; color: string; pale: string }> = {
  교육: { emoji: "✏️", color: "#ef8a39", pale: "#fff3e8" },
  문화: { emoji: "🎨", color: "#7b68d9", pale: "#f2efff" },
  체육: { emoji: "🏃", color: "#2d9bd6", pale: "#eaf7ff" },
  복지: { emoji: "🤝", color: "#2eaf62", pale: "#ebf9f0" },
  "1인가구": { emoji: "🏡", color: "#d15c83", pale: "#fff0f5" },
  시설대관: { emoji: "🏛️", color: "#4f8b63", pale: "#eef7ef" },
  문화행사: { emoji: "🎭", color: "#8b5fc4", pale: "#f5effc" },
  전시: { emoji: "🖼️", color: "#d17935", pale: "#fff4e9" },
  진료: { emoji: "🩺", color: "#3b8ea8", pale: "#eaf7fa" },
};
const filterCategories = ["전체", "교육", "문화", "체육", "복지", "1인가구"];
const defaultCenter = { latitude: 37.5665, longitude: 126.978 };
const mapSelectFields = "id,name,category,field,facility,address,area,region,latitude,longitude,is_free,fee_text,status,receipt_start,receipt_end,lecture_start,lecture_end,schedule_text,audiences,summary,apply_url,phone,is_senior_recommended,primary_image_url,primary_image_source,image_count";

async function fetchMapSamples(center: { latitude: number; longitude: number }) {
  const results = await Promise.all([800, 1600, 2400].map((offset) => supabase
    .rpc("get_programs_near", {
      p_lat: center.latitude, p_lon: center.longitude,
      p_radius: 12, p_limit: 320, p_offset: offset,
    })
    .select(mapSelectFields)
    .eq("is_active", true)));
  return results.flatMap(({ data }) => (data || []) as Program[]);
}

function categoryFor(program: Program) {
  return categoryStyle[program.category || ""] || { emoji: "📍", color: "#35a962", pale: "#edf9f1" };
}
function compactDate(value: string | null) {
  if (!value) return "일정 확인";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}
function dateRange(start: string | null, end: string | null) {
  if (!start && !end) return "상세 일정은 공고에서 확인하세요";
  if (!end) return `${compactDate(start)}부터`;
  return `${compactDate(start)} ~ ${compactDate(end)}`;
}
function shortSummary(value: string | null) {
  if (!value) return "프로그램 상세 내용은 모집 공고에서 확인할 수 있어요.";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function isReceiving(program: Program) {
  const status = program.status || "";
  if (status.includes("접수중") || status.includes("신청중")) return true;
  const now = Date.now();
  const start = program.receipt_start ? new Date(program.receipt_start).getTime() : -Infinity;
  const end = program.receipt_end ? new Date(program.receipt_end).getTime() : Infinity;
  return now >= start && now <= end;
}
function isSenior(program: Program) {
  const text = [program.name, program.summary, ...(program.audiences || [])].filter(Boolean).join(" ");
  return Boolean(program.is_senior_recommended || /시니어|어르신|노년|고령|50\+|60세|65세/.test(text));
}
function isFamily(program: Program) {
  const text = [program.name, program.summary, ...(program.audiences || [])].filter(Boolean).join(" ");
  return /아이|아동|어린이|유아|가족|부모|초등/.test(text);
}
function opensTomorrow(program: Program) {
  if (!program.receipt_start) return false;
  const target = new Date(program.receipt_start); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  return target.getFullYear() === tomorrow.getFullYear() && target.getMonth() === tomorrow.getMonth() && target.getDate() === tomorrow.getDate();
}
function scheduleLabel(program: Program) {
  if (program.schedule_text) return program.schedule_text;
  return dateRange(program.lecture_start, program.lecture_end);
}
function distanceKm(lat: number, lng: number, toLat = 37.5665, toLng = 126.978) {
  const rad = Math.PI / 180;
  const dLat = (lat - toLat) * rad; const dLng = (lng - toLng) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toLat * rad) * Math.cos(lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MapExplorer() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [mapPrograms, setMapPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("전체");
  const [onlyFree, setOnlyFree] = useState(false); const [onlyReceiving, setOnlyReceiving] = useState(false);
  const [onlySenior, setOnlySenior] = useState(false); const [onlyFamily, setOnlyFamily] = useState(false);
  const [onlyTomorrow, setOnlyTomorrow] = useState(false); const [sortBy, setSortBy] = useState<"distance" | "receiving" | "free" | "senior">("distance");
  const [selected, setSelected] = useState<Program | null>(null); const [mobileList, setMobileList] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false); const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set()); const [alerts, setAlerts] = useState<Set<string>>(new Set());
  const mapControllerRef = useRef<MapController | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [distanceCenter, setDistanceCenter] = useState(defaultCenter);

  useEffect(() => {
    let active = true;
    async function fetchPrograms() {
      if (!isSupabaseConfigured) { setError("Supabase 환경 설정을 확인하고 있어요."); setLoading(false); return; }
      const [{ data, error: fetchError }, sampledPrograms] = await Promise.all([
        supabase.rpc("get_programs_near", {
          p_lat: defaultCenter.latitude, p_lon: defaultCenter.longitude,
          p_radius: 12, p_limit: 240, p_offset: 0,
        }).eq("is_active", true),
        fetchMapSamples(defaultCenter),
      ]);
      if (!active) return;
      if (fetchError) setError("프로그램을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      else {
        const nearbyPrograms = (data || []) as Program[];
        setPrograms(nearbyPrograms);
        setMapPrograms([...nearbyPrograms, ...sampledPrograms]);
      }
      setLoading(false);
    }
    fetchPrograms();
    supabase.auth.getUser().then(({ data }) => active && setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        setFavorites(new Set());
        setAlerts(new Set());
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("user_favorites").select("program_id").eq("user_id", user.id),
      supabase.from("open_run_alerts").select("program_id").eq("user_id", user.id),
    ]).then(([favoriteResult, alertResult]) => {
      setFavorites(new Set((favoriteResult.data || []).map((row) => row.program_id)));
      setAlerts(new Set((alertResult.data || []).map((row) => row.program_id)));
    });
  }, [user]);

  const matchesProgram = useCallback((program: Program) => {
    const term = query.trim().toLocaleLowerCase("ko");
    return (category === "전체" || program.category === category)
      && (!onlyFree || Boolean(program.is_free)) && (!onlyReceiving || isReceiving(program))
      && (!onlySenior || isSenior(program)) && (!onlyFamily || isFamily(program))
      && (!onlyTomorrow || opensTomorrow(program))
      && (!term || [program.name, program.facility, program.address, program.area, program.field]
        .some((value) => value?.toLocaleLowerCase("ko").includes(term)));
  }, [query, category, onlyFree, onlyReceiving, onlySenior, onlyFamily, onlyTomorrow]);

  const filtered = useMemo(() => programs.filter(matchesProgram).sort((a, b) => {
        if (sortBy === "receiving") return Number(isReceiving(b)) - Number(isReceiving(a));
        if (sortBy === "free") return Number(Boolean(b.is_free)) - Number(Boolean(a.is_free));
        if (sortBy === "senior") return Number(isSenior(b)) - Number(isSenior(a));
        return distanceKm(a.latitude, a.longitude, distanceCenter.latitude, distanceCenter.longitude) - distanceKm(b.latitude, b.longitude, distanceCenter.latitude, distanceCenter.longitude);
      }), [programs, matchesProgram, distanceCenter, sortBy]);

  const filteredMapPrograms = useMemo(() => mapPrograms.filter(matchesProgram), [mapPrograms, matchesProgram]);

  const locationLabel = useMemo(() => {
    const nearest = programs.reduce<Program | null>((closest, program) => {
      if (!closest) return program;
      return distanceKm(program.latitude, program.longitude, distanceCenter.latitude, distanceCenter.longitude) < distanceKm(closest.latitude, closest.longitude, distanceCenter.latitude, distanceCenter.longitude) ? program : closest;
    }, null);
    return [nearest?.region, nearest?.area].filter(Boolean).join(" ") || "서울특별시 중구";
  }, [programs, distanceCenter]);

  const requireUser = useCallback(() => { if (user) return true; setAuthOpen(true); return false; }, [user]);
  const toggleFavorite = useCallback(async (programId: string) => {
    if (!requireUser() || !user) return;
    const exists = favorites.has(programId);
    setFavorites((current) => { const next = new Set(current); if (exists) next.delete(programId); else next.add(programId); return next; });
    const result = exists
      ? await supabase.from("user_favorites").delete().eq("user_id", user.id).eq("program_id", programId)
      : await supabase.from("user_favorites").insert({ user_id: user.id, program_id: programId });
    if (result.error) setFavorites((current) => { const next = new Set(current); if (exists) next.add(programId); else next.delete(programId); return next; });
  }, [favorites, requireUser, user]);
  const toggleAlert = useCallback(async (programId: string) => {
    if (!requireUser() || !user) return;
    const exists = alerts.has(programId);
    setAlerts((current) => { const next = new Set(current); if (exists) next.delete(programId); else next.add(programId); return next; });
    const result = exists
      ? await supabase.from("open_run_alerts").delete().eq("user_id", user.id).eq("program_id", programId)
      : await supabase.from("open_run_alerts").insert({ user_id: user.id, program_id: programId, minutes_before: 60 });
    if (result.error) setAlerts((current) => { const next = new Set(current); if (exists) next.add(programId); else next.delete(programId); return next; });
  }, [alerts, requireUser, user]);
  const openProgram = useCallback((program: Program) => { setSelected(program); setMobileList(false); }, []);
  const researchHere = useCallback(async () => {
    const center = mapControllerRef.current?.center();
    if (!center) {
      setMapNotice("지도를 불러오는 중이에요.");
      return;
    }
    setLoading(true);
    setError(null);
    const [{ data, error: nearbyError }, sampledPrograms] = await Promise.all([
      supabase.rpc("get_programs_near", {
        p_lat: center.latitude, p_lon: center.longitude,
        p_radius: 12, p_limit: 240, p_offset: 0,
      }).eq("is_active", true),
      fetchMapSamples(center),
    ]);
    if (nearbyError) {
      setError("이 지역의 프로그램을 다시 불러오지 못했어요.");
      setMapNotice(null);
    } else {
      const nearbyPrograms = (data || []) as Program[];
      setPrograms(nearbyPrograms);
      setMapPrograms([...nearbyPrograms, ...sampledPrograms]);
      setDistanceCenter(center);
      setSelected(null);
      setMapNotice(`지도 중심 반경 12km · ${(data || []).length.toLocaleString()}개`);
    }
    setLoading(false);
  }, []);

  return <main className={styles.shell}>
    <section className={styles.workspace}>
      <aside className={`${styles.panel} ${mobileList ? styles.mobilePanelOpen : ""}`}>
        <div className={styles.panelBrand}>
          <div className={styles.mobileHandle} onClick={() => setMobileList(false)} />
          <div className={styles.brandRow}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className={styles.brand} href="/" aria-label="동네고고 홈"><span className={styles.logoMark}><PinIcon /></span><span>동네고고</span></a>
            <nav className={styles.panelNav} aria-label="사용자 메뉴">
              <button aria-label="오픈런 알림" onClick={() => user ? setSortBy("receiving") : setAuthOpen(true)}><BellIcon />{alerts.size > 0 && <i>{alerts.size}</i>}</button>
              <button aria-label={user ? "로그아웃" : "로그인"} onClick={() => user ? supabase.auth.signOut() : setAuthOpen(true)}><UserIcon /></button>
            </nav>
          </div>
          <div className={styles.panelSearch}><SearchIcon /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="지역 · 기관 · 강좌명으로 검색" aria-label="프로그램 검색" />{query && <button onClick={() => setQuery("")} aria-label="검색어 지우기"><CloseIcon /></button>}</div>
        </div>

        <div className={styles.panelFilters}>
          <div className={styles.locationRow}><span className={styles.locationPill}><PinIcon />{locationLabel}</span><span className={styles.resultCount}>강좌 <b>{filtered.length.toLocaleString()}</b>개</span><button onClick={researchHere}>동네 변경</button></div>
          <div className={styles.quickChips}>
            <button className={onlyFree ? styles.quickActive : ""} onClick={() => setOnlyFree((v) => !v)}>무료</button>
            <button className={onlySenior ? styles.quickActive : ""} onClick={() => setOnlySenior((v) => !v)}>시니어</button>
            <button className={onlyReceiving ? styles.quickActive : ""} onClick={() => setOnlyReceiving((v) => !v)}>오늘 신청</button>
            <button className={onlyTomorrow ? styles.quickActive : ""} onClick={() => setOnlyTomorrow((v) => !v)}>내일 오픈런</button>
            <button className={onlyFamily ? styles.quickActive : ""} onClick={() => setOnlyFamily((v) => !v)}>아이와 함께</button>
          </div>
          {filterOpen && <div className={styles.categoryTray}>{filterCategories.map((item) => <button key={item} className={category === item ? styles.categoryActive : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>}
        </div>

        <div className={styles.sortTabs} role="tablist" aria-label="정렬 방식">
          <button className={sortBy === "distance" ? styles.sortActive : ""} onClick={() => setSortBy("distance")}>가까운 순</button>
          <button className={sortBy === "receiving" ? styles.sortActive : ""} onClick={() => setSortBy("receiving")}>신청 가능 순</button>
          <button className={sortBy === "free" ? styles.sortActive : ""} onClick={() => setSortBy("free")}>무료 먼저</button>
          <button className={sortBy === "senior" ? styles.sortActive : ""} onClick={() => setSortBy("senior")}>시니어 추천</button>
        </div>

        <div className={styles.list}>
          {loading && Array.from({ length: 5 }, (_, i) => <ProgramSkeleton key={i} />)}
          {error && <div className={styles.empty}><span>🌱</span><strong>프로그램을 불러오지 못했어요</strong><p>{error}</p></div>}
          {!loading && !error && filtered.length === 0 && <div className={styles.empty}><span>🧭</span><strong>조건에 맞는 프로그램이 없어요</strong><p>검색어나 필터를 조금 넓혀 보세요.</p></div>}
          {filtered.slice(0, 120).map((program) => <ProgramCard key={program.id} program={program} active={selected?.id === program.id} favorite={favorites.has(program.id)} distanceCenter={distanceCenter} onOpen={() => openProgram(program)} onFavorite={() => toggleFavorite(program.id)} />)}
        </div>
        <div className={styles.panelFoot}><span>✓ 공공데이터 기반</span><span>✦ 쉬운 설명</span><span>✓ 신청 링크 확인</span></div>
      </aside>

      <div className={styles.mapArea}>
        <MapCanvas programs={filteredMapPrograms} selected={selected} onSelect={openProgram} controllerRef={mapControllerRef} onNotice={setMapNotice} />
        <div className={styles.mapTopSearch}><SearchIcon /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="우리 동네 프로그램 검색" /><button onClick={() => setFilterOpen((v) => !v)}><SlidersIcon /></button></div>
        <div className={styles.mapCategories}>
          {[{ label: "전체 강좌", value: "전체", emoji: "📍" }, { label: "교육", value: "교육", emoji: "📚" }, { label: "스포츠", value: "체육", emoji: "🏃" }, { label: "공연·전시", value: "문화", emoji: "🎭" }, { label: "1인가구", value: "1인가구", emoji: "🏡" }].map((item) => <button key={item.label} className={category === item.value ? styles.mapCategoryActive : ""} onClick={() => setCategory(item.value)}><span>{item.emoji}</span>{item.label}</button>)}
        </div>
        <button className={styles.researchButton} onClick={researchHere}><SearchIcon /> 이 지역에서 다시 찾기</button>
        <div className={styles.toolRail}>
          <button className={styles.toolActive}><span>▱</span>지도</button>
          <button onClick={() => setFilterOpen((v) => !v)}><SlidersIcon />필터</button>
          <button onClick={() => mapControllerRef.current?.locate()}><LocateIcon />주변</button>
          <button onClick={() => setSortBy("distance")}><span>↔</span>거리</button>
          <button onClick={() => user ? setSortBy("receiving") : setAuthOpen(true)}><BellIcon />오픈런</button>
          <button onClick={() => user ? setCategory("전체") : setAuthOpen(true)}><HeartIcon />찜</button>
        </div>
        <div className={styles.mapControls}><button aria-label="현재 위치" onClick={() => mapControllerRef.current?.locate()}><LocateIcon /></button><button aria-label="확대" onClick={() => mapControllerRef.current?.zoomIn()}>＋</button><button aria-label="축소" onClick={() => mapControllerRef.current?.zoomOut()}>−</button></div>
        <button className={styles.mapCta} onClick={() => setMobileList(true)}>✦ {locationLabel} 강좌 {filtered.length.toLocaleString()}개 자세히 보기 <ChevronIcon /></button>
        <button className={styles.mobileListButton} onClick={() => setMobileList(true)}><ListIcon /> 목록 {filtered.length}</button>
        {mapNotice && <div className={styles.mapNotice}>{mapNotice}</div>}
      </div>
    </section>
    {selected && <ProgramDetail program={selected} favorite={favorites.has(selected.id)} alerted={alerts.has(selected.id)} onClose={() => setSelected(null)} onFavorite={() => toggleFavorite(selected.id)} onAlert={() => toggleAlert(selected.id)} />}
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
  </main>;
}

function ProgramCard({ program, active, favorite, distanceCenter, onOpen, onFavorite }: { program: Program; active: boolean; favorite: boolean; distanceCenter: { latitude: number; longitude: number }; onOpen: () => void; onFavorite: () => void }) {
  const style = categoryFor(program);
  return <article className={`${styles.card} ${active ? styles.cardActive : ""}`} onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
    <div className={styles.cardVisual} style={{ background: style.pale }}>
      {program.primary_image_url ? <img src={program.primary_image_url} alt="" loading="lazy" /> : <span>{style.emoji}</span>}
    </div>
    <div className={styles.cardContent}>
      <div className={styles.cardHead}>{program.is_free && <span className={styles.freeTag}>무료</span>}{isSenior(program) && <span className={styles.seniorTag}>시니어 추천</span>}{isReceiving(program) && <span className={styles.liveTag}>접수중</span>}{opensTomorrow(program) && <span className={styles.tomorrowTag}>내일 오픈런</span>}</div>
      <h2>{program.name}</h2>
      <div className={styles.cardMeta}><span>{program.facility || program.area || "장소 확인"}</span><i>·</i><span>{distanceKm(program.latitude, program.longitude, distanceCenter.latitude, distanceCenter.longitude) < 1 ? `${Math.round(distanceKm(program.latitude, program.longitude, distanceCenter.latitude, distanceCenter.longitude) * 1000)}m` : `${distanceKm(program.latitude, program.longitude, distanceCenter.latitude, distanceCenter.longitude).toFixed(1)}km`}</span><i>·</i><span>{scheduleLabel(program)}</span></div>
    </div>
    <button className={styles.heartButton} onClick={(e) => { e.stopPropagation(); onFavorite(); }} aria-label={favorite ? "찜 해제" : "찜하기"}><HeartIcon fill={favorite ? "#35b95f" : "none"} className={favorite ? styles.favorited : ""} /></button>
  </article>;
}
function ProgramSkeleton() { return <div className={styles.skeleton}><span /><span /><span /><span /></div>; }

function MapCanvas({ programs, selected, onSelect, controllerRef, onNotice }: { programs: Program[]; selected: Program | null; onSelect: (program: Program) => void; controllerRef: MutableRefObject<MapController | null>; onNotice: (message: string | null) => void }) {
  const nodeRef = useRef<HTMLDivElement>(null); const mapRef = useRef<KakaoMap | null>(null); const overlaysRef = useRef<KakaoOverlay[]>([]); const locationOverlayRef = useRef<KakaoOverlay | null>(null); const [ready, setReady] = useState(false); const [loadFailed, setLoadFailed] = useState(false); const [mapLevel, setMapLevel] = useState(8);
  const markerGroups = useMemo(() => {
    const groups = new Map<string, { program: Program; count: number }>();
    const cellLat = Math.max(.0018, .006 * (2 ** ((mapLevel - 5) * .75)));
    const cellLng = cellLat * 1.6;
    programs.forEach((program) => {
      const key = `${Math.round(program.latitude / cellLat)}:${Math.round(program.longitude / cellLng)}`;
      const current = groups.get(key);
      if (!current) groups.set(key, { program, count: 1 });
      else groups.set(key, { program: selected?.id === program.id ? program : current.program, count: current.count + 1 });
    });
    return Array.from(groups.values()).slice(0, 72);
  }, [programs, selected, mapLevel]);
  useEffect(() => {
    let active = true; let zoomListener: (() => void) | null = null;
    loadKakaoMap().then((loaded) => {
      if (!active) return;
      if (!loaded || !nodeRef.current || !window.kakao) { setLoadFailed(true); return; }
      const map = new window.kakao.maps.Map(nodeRef.current, { center: new window.kakao.maps.LatLng(defaultCenter.latitude, defaultCenter.longitude), level: 8 });
      mapRef.current = map;
      zoomListener = () => setMapLevel(map.getLevel());
      window.kakao.maps.event.addListener(map, "zoom_changed", zoomListener);
      controllerRef.current = {
        center: () => {
          const point = map.getCenter();
          return { latitude: point.getLat(), longitude: point.getLng() };
        },
        zoomIn: () => map.setLevel(Math.max(1, map.getLevel() - 1)),
        zoomOut: () => map.setLevel(Math.min(14, map.getLevel() + 1)),
        locate: () => {
          if (!navigator.geolocation) { onNotice("이 브라우저에서는 현재 위치를 사용할 수 없어요."); return; }
          onNotice("현재 위치를 확인하고 있어요…");
          navigator.geolocation.getCurrentPosition(({ coords }) => {
            const position = new window.kakao!.maps.LatLng(coords.latitude, coords.longitude);
            map.setCenter(position);
            map.setLevel(4);
            locationOverlayRef.current?.setMap(null);
            const currentDot = document.createElement("div");
            currentDot.className = styles.currentLocationMarker;
            currentDot.setAttribute("aria-label", "현재 위치");
            locationOverlayRef.current = new window.kakao!.maps.CustomOverlay({ map, position, content: currentDot, zIndex: 10 });
            onNotice("현재 위치로 이동했어요. 이 지역에서 다시 찾아보세요.");
          }, () => onNotice("위치 권한을 허용하면 현재 위치로 이동할 수 있어요."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
        },
      };
      setReady(true);
    });
    return () => {
      active = false; controllerRef.current = null;
      if (zoomListener && mapRef.current && window.kakao) window.kakao.maps.event.removeListener(mapRef.current, "zoom_changed", zoomListener);
    };
  }, [controllerRef, onNotice]);
  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = markerGroups.map(({ program, count }) => {
      const style = categoryFor(program);
      const marker = document.createElement("button"); marker.className = `${styles.mapMarker} ${selected?.id === program.id ? styles.mapMarkerSelected : ""}`; marker.type = "button"; marker.title = program.name; marker.setAttribute("aria-label", `${program.name}, ${program.facility || program.area || "장소 확인"}`); marker.onclick = () => onSelect(program);
      const emoji = document.createElement("span"); emoji.className = styles.mapMarkerEmoji; emoji.textContent = style.emoji;
      const copy = document.createElement("span"); copy.className = styles.mapMarkerCopy;
      const title = document.createElement("strong"); title.textContent = program.field || program.category || "프로그램";
      const place = document.createElement("small"); place.textContent = program.facility || program.area || "장소 확인";
      copy.append(title, place); marker.append(emoji, copy);
      if (count > 1) { const badge = document.createElement("i"); badge.textContent = String(count); marker.append(badge); }
      return new window.kakao!.maps.CustomOverlay({ map: mapRef.current, position: new window.kakao!.maps.LatLng(program.latitude, program.longitude), content: marker, yAnchor: 1, zIndex: selected?.id === program.id ? 8 : 2 });
    });
  }, [markerGroups, selected, onSelect, ready]);
  useEffect(() => { if (!selected || !mapRef.current || !window.kakao) return; mapRef.current.setCenter(new window.kakao.maps.LatLng(selected.latitude, selected.longitude)); mapRef.current.setLevel(5); }, [selected]);
  return <div className={styles.mapCanvas}><div className={styles.kakaoMap} ref={nodeRef} />{!ready && <div className={styles.mapFallback} aria-label="지도 미리보기"><div className={styles.river} />{programs.slice(0, 50).map((program, i) => { const left = 8 + ((program.longitude * 997 + i * 13) % 84 + 84) % 84; const top = 8 + ((program.latitude * 991 + i * 17) % 78 + 78) % 78; return <button key={program.id} className={`${styles.fallbackMarker} ${selected?.id === program.id ? styles.fallbackMarkerSelected : ""}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => onSelect(program)}>{program.is_free ? "무료" : categoryFor(program).emoji}</button>; })}<span className={styles.mapPending}>{loadFailed ? "카카오 지도를 불러오지 못했어요" : "카카오 지도를 연결 중입니다"}</span></div>}</div>;
}

function ProgramDetail({ program, favorite, alerted, onClose, onFavorite, onAlert }: { program: Program; favorite: boolean; alerted: boolean; onClose: () => void; onFavorite: () => void; onAlert: () => void }) {
  const style = categoryFor(program);
  const [facilityMedia, setFacilityMedia] = useState<FacilityMedia[]>([]);
  const [programMedia, setProgramMedia] = useState<ProgramMedia[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from("program_facility_media")
      .select("media_id,provider,media_type,photo_url,thumbnail_url,external_url,attribution,match_confidence,is_primary")
      .eq("program_id", program.id)
      .order("is_primary", { ascending: false })
      .order("media_type", { ascending: true })
      .then(({ data }) => {
        if (active) setFacilityMedia((data || []) as FacilityMedia[]);
      });
    return () => { active = false; };
  }, [program.id]);

  useEffect(() => {
    let active = true;
    supabase
      .from("program_media_public")
      .select("media_id,source_key,source_id,media_role,image_url,thumbnail_url,external_url,attribution,license,license_url,is_primary")
      .eq("program_id", program.id)
      .order("is_primary", { ascending: false })
      .order("media_role", { ascending: true })
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        const seen = new Set<string>();
        const unique = ((data || []) as ProgramMedia[]).filter((media) => {
          const key = media.image_url.trim().toLowerCase().replace(/#.*$/, "");
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setProgramMedia(unique);
      });
    return () => { active = false; };
  }, [program.id]);

  const photoMedia = facilityMedia.find((media) => Boolean(media.photo_url || media.thumbnail_url));
  const placeMedia = facilityMedia.find((media) => media.media_type === "kakao_place" && media.external_url);
  const roadviewMedia = facilityMedia.find((media) => media.media_type === "kakao_roadview" && media.external_url);
  const hasCoordinates = Number.isFinite(program.latitude) && Number.isFinite(program.longitude);
  const fallbackPlaceUrl = program.facility || program.address
    ? `https://map.kakao.com/link/search/${encodeURIComponent([program.facility, program.address].filter(Boolean).join(" "))}`
    : null;
  return <div className={styles.detailBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}><article className={styles.detail}>
    <div className={styles.detailHero} style={{ background: `linear-gradient(135deg, ${style.pale}, #f5f8f4)` }}><button className={styles.closeButton} onClick={onClose} aria-label="상세 닫기"><CloseIcon /></button><span className={styles.heroEmoji}>{style.emoji}</span><span className={styles.categoryTag} style={{ background: "white", color: style.color }}>{program.category || program.field || "프로그램"}</span><h2>{program.name}</h2><p><PinIcon /> {program.facility || program.address || program.area}</p></div>
    <div className={styles.detailBody}><div className={styles.detailActions}><button className={favorite ? styles.actionActive : ""} onClick={onFavorite}><HeartIcon fill={favorite ? "#35b95f" : "none"} />{favorite ? "찜했어요" : "찜하기"}</button><button className={alerted ? styles.actionActive : ""} onClick={onAlert}><BellIcon />{alerted ? "알림 켜짐" : "오픈런 알림"}</button></div>
      <section className={styles.infoGrid}><div><span>접수 상태</span><strong>{program.status || (isReceiving(program) ? "접수중" : "일정 확인")}</strong></div><div><span>이용 요금</span><strong className={program.is_free ? styles.free : ""}>{program.is_free ? "무료" : (program.fee_text || "요금 확인")}</strong></div><div><span>운영 일정</span><strong>{dateRange(program.lecture_start, program.lecture_end)}</strong></div><div><span>대상</span><strong>{program.audiences?.slice(0, 2).join(", ") || "누구나"}</strong></div></section>
      <section className={styles.description}><h3>프로그램 소개</h3><p>{shortSummary(program.summary)}</p></section>
      {programMedia.length > 0 && <section className={styles.programMediaSection} aria-label="프로그램 이미지">
        <h3>프로그램 이미지</h3>
        <div className={styles.programMediaGrid}>
          {programMedia.map((media) => <a key={media.media_id} className={styles.programMediaItem} href={media.external_url || media.image_url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.thumbnail_url || media.image_url} alt={`${program.name} 대표 이미지`} loading="lazy" />
          </a>)}
        </div>
        <small className={styles.programMediaAttribution}>{programMedia[0]?.attribution || "공공데이터 제공 이미지"}</small>
      </section>}
      <section className={styles.address} aria-label="시설정보">
        <h3>시설정보</h3>
        <div className={styles.facilityLine}><span>시설</span><strong>{program.facility || "시설명 확인"}</strong></div>
        <div className={styles.facilityLine}><span>주소</span><strong>{program.address || "주소 확인"}</strong></div>
        {program.phone && <small>문의 {program.phone}</small>}
        <div className={styles.facilityMedia}>
          {photoMedia && <a className={styles.facilityPhoto} href={photoMedia.photo_url || photoMedia.thumbnail_url || undefined} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoMedia.thumbnail_url || photoMedia.photo_url || ""} alt={`${program.facility || "시설"} 사진`} />
          </a>}
          {!photoMedia && <div className={styles.facilityPhotoPlaceholder}><span>📍</span><strong>시설 사진·거리뷰</strong><small>카카오맵에서 실제 위치를 확인할 수 있어요.</small></div>}
          <div className={styles.facilityMediaActions}>
            {(placeMedia?.external_url || fallbackPlaceUrl) && <a href={placeMedia?.external_url || fallbackPlaceUrl || undefined} target="_blank" rel="noreferrer">장소 정보 보기 <ExternalIcon /></a>}
            {hasCoordinates && <a href={roadviewMedia?.external_url || `https://map.kakao.com/link/roadview/${program.latitude},${program.longitude}`} target="_blank" rel="noreferrer">거리뷰 보기 <ExternalIcon /></a>}
          </div>
          {hasCoordinates && <FacilityRoadview latitude={program.latitude} longitude={program.longitude} />}
          <small className={styles.mediaAttribution}>{facilityMedia[0]?.attribution || "카카오맵 시설 위치"}</small>
        </div>
      </section>
    </div><div className={styles.detailBottom}><a href={`https://map.kakao.com/link/map/${encodeURIComponent(program.facility || program.name)},${program.latitude},${program.longitude}`} target="_blank" rel="noreferrer">지도 보기</a>{program.apply_url ? <a className={styles.primaryAction} href={program.apply_url} target="_blank" rel="noreferrer">신청 페이지 <ExternalIcon /></a> : <button className={styles.primaryAction} onClick={onAlert}>접수 알림 받기 <BellIcon /></button>}</div>
  </article></div>;
}

function FacilityRoadview({ latitude, longitude }: { latitude: number; longitude: number }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let active = true;
    loadKakaoMap().then((loaded) => {
      if (!active) return;
      if (!loaded || !nodeRef.current || !window.kakao?.maps.Roadview || !window.kakao.maps.RoadviewClient) {
        setState("empty");
        return;
      }
      const position = new window.kakao.maps.LatLng(latitude, longitude);
      const roadview = new window.kakao.maps.Roadview(nodeRef.current);
      const client = new window.kakao.maps.RoadviewClient();
      client.getNearestPanoId(position, 80, (panoId) => {
        if (!active) return;
        if (!panoId) {
          setState("empty");
          return;
        }
        roadview.setPanoId(panoId, position);
        setState("ready");
      });
    });
    return () => { active = false; };
  }, [latitude, longitude]);

  if (state === "empty") return <div className={styles.facilityRoadviewEmpty}>이 위치에는 제공 가능한 거리뷰 사진이 없어요.</div>;
  return <div className={styles.facilityRoadview} aria-label="시설 거리뷰">
    <div className={styles.facilityRoadviewCanvas} ref={nodeRef} />
    {state === "loading" && <span>시설 거리뷰를 준비하고 있어요…</span>}
  </div>;
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function signInWithKakao() { const { error } = await supabase.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: window.location.origin } }); if (error) setMessage("카카오 로그인을 시작하지 못했어요."); }
  async function signInWithEmail(e: React.FormEvent) { e.preventDefault(); if (!email) return; const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }); if (error) setMessage("이메일을 확인해 주세요."); else setSent(true); }
  return <div className={styles.modalBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className={styles.authDialog} role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className={styles.closeButton} onClick={onClose} aria-label="로그인 닫기"><CloseIcon /></button><span className={styles.authLogo}><PinIcon /></span><h2 id="auth-title">동네고고와 함께<br />우리 동네를 발견해요</h2><p>찜, 오픈런 알림, 가족 맞춤 추천을<br />앱과 웹에서 그대로 이어갈 수 있어요.</p><button className={styles.kakaoButton} onClick={signInWithKakao}><span>●</span> 카카오로 시작하기</button><div className={styles.divider}><span>또는 이메일</span></div>{sent ? <div className={styles.sentMessage}>✉️ 로그인 링크를 보냈어요.<br /><strong>{email}</strong> 메일함을 확인해 주세요.</div> : <form className={styles.emailForm} onSubmit={signInWithEmail}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="이메일" required /><button>링크 받기</button></form>}{message && <small className={styles.authError}>{message}</small>}<small className={styles.terms}>계속하면 동네고고 이용약관과 개인정보처리방침에 동의하게 됩니다.</small></section></div>;
}
