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
  apply_url: string | null; phone: string | null;
};

type MapController = {
  locate: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  center: () => { latitude: number; longitude: number } | null;
};

const selectFields = "id,name,category,field,facility,address,area,region,latitude,longitude,is_free,fee_text,status,receipt_start,receipt_end,lecture_start,lecture_end,schedule_text,audiences,summary,apply_url,phone";
const categoryStyle: Record<string, { emoji: string; color: string; pale: string }> = {
  교육: { emoji: "✏️", color: "#ef8a39", pale: "#fff3e8" },
  문화: { emoji: "🎨", color: "#7b68d9", pale: "#f2efff" },
  체육: { emoji: "🏃", color: "#2d9bd6", pale: "#eaf7ff" },
  복지: { emoji: "🤝", color: "#2eaf62", pale: "#ebf9f0" },
  "1인가구": { emoji: "🏡", color: "#d15c83", pale: "#fff0f5" },
};
const filterCategories = ["전체", "교육", "문화", "체육", "복지", "1인가구"];

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
function distanceKm(lat: number, lng: number, toLat = 37.5665, toLng = 126.978) {
  const rad = Math.PI / 180;
  const dLat = (lat - toLat) * rad; const dLng = (lng - toLng) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toLat * rad) * Math.cos(lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MapExplorer() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("전체");
  const [onlyFree, setOnlyFree] = useState(false); const [onlyReceiving, setOnlyReceiving] = useState(false);
  const [selected, setSelected] = useState<Program | null>(null); const [mobileList, setMobileList] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false); const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set()); const [alerts, setAlerts] = useState<Set<string>>(new Set());
  const mapControllerRef = useRef<MapController | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [distanceCenter, setDistanceCenter] = useState({ latitude: 37.5665, longitude: 126.978 });

  useEffect(() => {
    let active = true;
    async function fetchPrograms() {
      if (!isSupabaseConfigured) { setError("Supabase 환경 설정을 확인하고 있어요."); setLoading(false); return; }
      const { data, error: fetchError } = await supabase.from("programs").select(selectFields)
        .eq("is_active", true).not("latitude", "is", null).not("longitude", "is", null)
        .order("updated_at", { ascending: false }).limit(240);
      if (!active) return;
      if (fetchError) setError("프로그램을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      else setPrograms((data || []) as Program[]);
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

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ko");
    return programs.filter((program) => category === "전체" || program.category === category)
      .filter((program) => !onlyFree || program.is_free).filter((program) => !onlyReceiving || isReceiving(program))
      .filter((program) => !term || [program.name, program.facility, program.address, program.area, program.field]
        .some((value) => value?.toLocaleLowerCase("ko").includes(term)))
      .sort((a, b) => distanceKm(a.latitude, a.longitude, distanceCenter.latitude, distanceCenter.longitude) - distanceKm(b.latitude, b.longitude, distanceCenter.latitude, distanceCenter.longitude));
  }, [programs, query, category, onlyFree, onlyReceiving, distanceCenter]);

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
    const { data, error: nearbyError } = await supabase.rpc("get_programs_near", {
      p_lat: center.latitude,
      p_lon: center.longitude,
      p_radius: 30,
      p_limit: 240,
      p_offset: 0,
    });
    if (nearbyError) {
      setError("이 지역의 프로그램을 다시 불러오지 못했어요.");
      setMapNotice(null);
    } else {
      setPrograms((data || []) as Program[]);
      setDistanceCenter(center);
      setSelected(null);
      setMapNotice(`지도 중심 반경 30km · ${(data || []).length.toLocaleString()}개`);
    }
    setLoading(false);
  }, []);

  return <main className={styles.shell}>
    <header className={styles.header}>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className={styles.brand} href="/" aria-label="동네고고 홈"><span className={styles.logoMark}><PinIcon /></span><span>동네고고</span></a>
      <div className={styles.headerSearch}><SearchIcon /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="동네, 시설, 프로그램을 검색해 보세요" aria-label="프로그램 검색" />{query && <button onClick={() => setQuery("")} aria-label="검색어 지우기"><CloseIcon /></button>}</div>
      <nav className={styles.nav} aria-label="사용자 메뉴">
        <button className={styles.navButton} onClick={() => user ? setCategory("전체") : setAuthOpen(true)}><HeartIcon /> <span>찜</span></button>
        <button className={styles.loginButton} onClick={() => user ? supabase.auth.signOut() : setAuthOpen(true)}><UserIcon /> <span>{user ? "로그아웃" : "로그인"}</span></button>
      </nav>
    </header>
    <section className={styles.workspace}>
      <aside className={`${styles.panel} ${mobileList ? styles.mobilePanelOpen : ""}`}>
        <div className={styles.panelTop}>
          <div className={styles.mobileHandle} onClick={() => setMobileList(false)} />
          <div className={styles.locationRow}><div><span className={styles.eyebrow}>지금 보고 있는 지역</span><h1>서울특별시 전체 <ChevronIcon /></h1></div><button className={styles.filterButton} onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen}><SlidersIcon /> 필터</button></div>
          <div className={styles.chips}>{filterCategories.map((item) => <button key={item} className={category === item ? styles.chipActive : styles.chip} onClick={() => setCategory(item)}>{item}</button>)}</div>
          {filterOpen && <div className={styles.filterTray}><label><input type="checkbox" checked={onlyReceiving} onChange={(e) => setOnlyReceiving(e.target.checked)} /><span>지금 접수 중</span></label><label><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /><span>무료만 보기</span></label></div>}
          <div className={styles.resultSummary}><strong>{filtered.length.toLocaleString()}개</strong><span>가까운 순</span></div>
        </div>
        <div className={styles.list}>
          {loading && Array.from({ length: 5 }, (_, i) => <ProgramSkeleton key={i} />)}
          {error && <div className={styles.empty}><span>🌱</span><strong>연결을 준비하고 있어요</strong><p>{error}</p></div>}
          {!loading && !error && filtered.length === 0 && <div className={styles.empty}><span>🧭</span><strong>조건에 맞는 프로그램이 없어요</strong><p>검색어나 필터를 조금 넓혀 보세요.</p></div>}
          {filtered.slice(0, 100).map((program) => <ProgramCard key={program.id} program={program} active={selected?.id === program.id} favorite={favorites.has(program.id)} distanceCenter={distanceCenter} onOpen={() => openProgram(program)} onFavorite={() => toggleFavorite(program.id)} />)}
        </div>
      </aside>
      <div className={styles.mapArea}>
        <MapCanvas programs={filtered.slice(0, 100)} selected={selected} onSelect={openProgram} controllerRef={mapControllerRef} onNotice={setMapNotice} />
        <div className={styles.mapTopSearch}><SearchIcon /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="우리 동네 프로그램 검색" /><button onClick={() => setFilterOpen(true)}><SlidersIcon /></button></div>
        <button className={styles.researchButton} onClick={researchHere}><SearchIcon /> 이 지역에서 다시 찾기</button>
        <div className={styles.mapControls}><button aria-label="현재 위치" onClick={() => mapControllerRef.current?.locate()}><LocateIcon /></button><button aria-label="확대" onClick={() => mapControllerRef.current?.zoomIn()}>＋</button><button aria-label="축소" onClick={() => mapControllerRef.current?.zoomOut()}>−</button></div>
        <button className={styles.mobileListButton} onClick={() => setMobileList(true)}><ListIcon /> 목록 {filtered.length}</button>
        <div className={styles.legend}><i /> 프로그램 {filtered.length}개</div>
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
    <div className={styles.cardHead}><span className={styles.categoryTag} style={{ background: style.pale, color: style.color }}>{style.emoji} {program.category || program.field || "프로그램"}</span>{isReceiving(program) && <span className={styles.liveTag}><i /> 접수중</span>}<button className={styles.heartButton} onClick={(e) => { e.stopPropagation(); onFavorite(); }} aria-label={favorite ? "찜 해제" : "찜하기"}><HeartIcon fill={favorite ? "#35b95f" : "none"} className={favorite ? styles.favorited : ""} /></button></div>
    <h2>{program.name}</h2><div className={styles.cardMeta}><span><PinIcon />{program.facility || program.area || "서울"}</span><span>{distanceKm(program.latitude, program.longitude, distanceCenter.latitude, distanceCenter.longitude).toFixed(1)}km</span></div>
    <div className={styles.cardFoot}><span>{dateRange(program.lecture_start, program.lecture_end)}</span><strong className={program.is_free ? styles.free : ""}>{program.is_free ? "무료" : (program.fee_text || "요금 확인")}</strong></div>
  </article>;
}
function ProgramSkeleton() { return <div className={styles.skeleton}><span /><span /><span /><span /></div>; }

function MapCanvas({ programs, selected, onSelect, controllerRef, onNotice }: { programs: Program[]; selected: Program | null; onSelect: (program: Program) => void; controllerRef: MutableRefObject<MapController | null>; onNotice: (message: string | null) => void }) {
  const nodeRef = useRef<HTMLDivElement>(null); const mapRef = useRef<KakaoMap | null>(null); const overlaysRef = useRef<KakaoOverlay[]>([]); const locationOverlayRef = useRef<KakaoOverlay | null>(null); const [ready, setReady] = useState(false); const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadKakaoMap().then((loaded) => {
      if (!active) return;
      if (!loaded || !nodeRef.current || !window.kakao) { setLoadFailed(true); return; }
      const map = new window.kakao.maps.Map(nodeRef.current, { center: new window.kakao.maps.LatLng(37.5665, 126.978), level: 8 });
      mapRef.current = map;
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
    return () => { active = false; controllerRef.current = null; };
  }, [controllerRef, onNotice]);
  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = programs.map((program) => {
      const marker = document.createElement("button"); marker.className = `${styles.mapMarker} ${selected?.id === program.id ? styles.mapMarkerSelected : ""}`; marker.type = "button"; marker.title = program.name; marker.textContent = program.is_free ? "무료" : categoryFor(program).emoji; marker.onclick = () => onSelect(program);
      return new window.kakao!.maps.CustomOverlay({ map: mapRef.current, position: new window.kakao!.maps.LatLng(program.latitude, program.longitude), content: marker, yAnchor: 1, zIndex: selected?.id === program.id ? 8 : 2 });
    });
  }, [programs, selected, onSelect, ready]);
  useEffect(() => { if (!selected || !mapRef.current || !window.kakao) return; mapRef.current.setCenter(new window.kakao.maps.LatLng(selected.latitude, selected.longitude)); mapRef.current.setLevel(5); }, [selected]);
  return <div className={styles.mapCanvas}><div className={styles.kakaoMap} ref={nodeRef} />{!ready && <div className={styles.mapFallback} aria-label="지도 미리보기"><div className={styles.river} />{programs.slice(0, 50).map((program, i) => { const left = 8 + ((program.longitude * 997 + i * 13) % 84 + 84) % 84; const top = 8 + ((program.latitude * 991 + i * 17) % 78 + 78) % 78; return <button key={program.id} className={`${styles.fallbackMarker} ${selected?.id === program.id ? styles.fallbackMarkerSelected : ""}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => onSelect(program)}>{program.is_free ? "무료" : categoryFor(program).emoji}</button>; })}<span className={styles.mapPending}>{loadFailed ? "카카오 지도를 불러오지 못했어요" : "카카오 지도를 연결 중입니다"}</span></div>}</div>;
}

function ProgramDetail({ program, favorite, alerted, onClose, onFavorite, onAlert }: { program: Program; favorite: boolean; alerted: boolean; onClose: () => void; onFavorite: () => void; onAlert: () => void }) {
  const style = categoryFor(program);
  return <div className={styles.detailBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}><article className={styles.detail}>
    <div className={styles.detailHero} style={{ background: `linear-gradient(135deg, ${style.pale}, #f5f8f4)` }}><button className={styles.closeButton} onClick={onClose} aria-label="상세 닫기"><CloseIcon /></button><span className={styles.heroEmoji}>{style.emoji}</span><span className={styles.categoryTag} style={{ background: "white", color: style.color }}>{program.category || program.field || "프로그램"}</span><h2>{program.name}</h2><p><PinIcon /> {program.facility || program.address || program.area}</p></div>
    <div className={styles.detailBody}><div className={styles.detailActions}><button className={favorite ? styles.actionActive : ""} onClick={onFavorite}><HeartIcon fill={favorite ? "#35b95f" : "none"} />{favorite ? "찜했어요" : "찜하기"}</button><button className={alerted ? styles.actionActive : ""} onClick={onAlert}><BellIcon />{alerted ? "알림 켜짐" : "오픈런 알림"}</button></div>
      <section className={styles.infoGrid}><div><span>접수 상태</span><strong>{program.status || (isReceiving(program) ? "접수중" : "일정 확인")}</strong></div><div><span>이용 요금</span><strong className={program.is_free ? styles.free : ""}>{program.is_free ? "무료" : (program.fee_text || "요금 확인")}</strong></div><div><span>운영 일정</span><strong>{dateRange(program.lecture_start, program.lecture_end)}</strong></div><div><span>대상</span><strong>{program.audiences?.slice(0, 2).join(", ") || "누구나"}</strong></div></section>
      <section className={styles.description}><h3>프로그램 소개</h3><p>{shortSummary(program.summary)}</p></section><section className={styles.address}><h3>장소</h3><p>{program.address || program.facility || "공고에서 확인"}</p>{program.phone && <small>문의 {program.phone}</small>}</section>
    </div><div className={styles.detailBottom}><a href={`https://map.kakao.com/link/map/${encodeURIComponent(program.facility || program.name)},${program.latitude},${program.longitude}`} target="_blank" rel="noreferrer">지도 보기</a>{program.apply_url ? <a className={styles.primaryAction} href={program.apply_url} target="_blank" rel="noreferrer">신청 페이지 <ExternalIcon /></a> : <button className={styles.primaryAction} onClick={onAlert}>접수 알림 받기 <BellIcon /></button>}</div>
  </article></div>;
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function signInWithKakao() { const { error } = await supabase.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: window.location.origin } }); if (error) setMessage("카카오 로그인을 시작하지 못했어요."); }
  async function signInWithEmail(e: React.FormEvent) { e.preventDefault(); if (!email) return; const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }); if (error) setMessage("이메일을 확인해 주세요."); else setSent(true); }
  return <div className={styles.modalBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className={styles.authDialog} role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className={styles.closeButton} onClick={onClose} aria-label="로그인 닫기"><CloseIcon /></button><span className={styles.authLogo}><PinIcon /></span><h2 id="auth-title">동네고고와 함께<br />우리 동네를 발견해요</h2><p>찜, 오픈런 알림, 가족 맞춤 추천을<br />앱과 웹에서 그대로 이어갈 수 있어요.</p><button className={styles.kakaoButton} onClick={signInWithKakao}><span>●</span> 카카오로 시작하기</button><div className={styles.divider}><span>또는 이메일</span></div>{sent ? <div className={styles.sentMessage}>✉️ 로그인 링크를 보냈어요.<br /><strong>{email}</strong> 메일함을 확인해 주세요.</div> : <form className={styles.emailForm} onSubmit={signInWithEmail}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="이메일" required /><button>링크 받기</button></form>}{message && <small className={styles.authError}>{message}</small>}<small className={styles.terms}>계속하면 동네고고 이용약관과 개인정보처리방침에 동의하게 됩니다.</small></section></div>;
}
