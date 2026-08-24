/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OFFICIAL_MAP_ICONS } from "@/lib/official-map-icons";
import { getSharedProgram, type SharedProgram } from "@/lib/program-share-data";

import { OpenAppButton } from "./OpenAppButton";
import styles from "./program-share.module.css";

type PageProps = { params: Promise<{ id: string }> };

function cleanID(value: string): string {
  const trimmed = value.trim();
  // Next decodes this segment in Node, while the production worker can provide
  // its encoded form. A decoded public-data ID already contains its namespace
  // colon, so avoid decoding it twice when the ID itself contains a `%xx` token.
  if (trimmed.includes(":")) return trimmed;
  try { return decodeURIComponent(trimmed).trim(); } catch { return trimmed; }
}

function categoryEmoji(program: SharedProgram): string {
  const value = `${program.category} ${program.field} ${program.name}`;
  if (/수영|아쿠아/.test(value)) return "🏊";
  if (/전시|미술|공예/.test(value)) return "🎨";
  if (/공연|연극|뮤지컬/.test(value)) return "🎭";
  if (/음악|악기|노래/.test(value)) return "🎵";
  if (/체육|운동|요가|필라테스/.test(value)) return "🏃";
  if (/교육|강좌|학습|외국어/.test(value)) return "📚";
  return "🌿";
}

function formatKoreanDate(raw: string): string | null {
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);
}

function deadlineCopy(program: SharedProgram): string {
  if (!program.receiptEnd) return program.status === "접수중"
    ? "지금 신청할 수 있어요."
    : "접수 일정은 앱에서 확인해 주세요.";
  const end = new Date(program.receiptEnd);
  if (!Number.isFinite(end.getTime())) return "접수 일정은 앱에서 확인해 주세요.";
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "접수가 마감되었어요.";
  if (days === 0) return "오늘 마감해요.";
  return `마감까지 ${days}일 남았어요.`;
}

function mapLinks(program: SharedProgram) {
  const query = [program.facility, program.address].filter(Boolean).join(" ");
  const encodedQuery = encodeURIComponent(query || program.name);
  const validCoordinate = program.latitude !== null && program.longitude !== null
    && Math.abs(program.latitude) > 0.001 && Math.abs(program.longitude) > 0.001;
  const coordinate = validCoordinate ? `${program.latitude},${program.longitude}` : null;
  return {
    kakao: coordinate
      ? `https://map.kakao.com/link/map/${encodeURIComponent(program.facility)},${coordinate}`
      : `https://map.kakao.com/?q=${encodedQuery}`,
    naver: `https://map.naver.com/p/search/${encodedQuery}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinate ?? query ?? program.name)}`,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const program = await getSharedProgram(cleanID(id)).catch(() => null);
  if (!program) return { title: "프로그램을 찾을 수 없어요 | 동네고고" };
  const shareTitle = `[동네고고] - ${program.name}`;
  return {
    title: shareTitle,
    description: program.description,
    alternates: { canonical: `/program/${encodeURIComponent(program.id)}` },
    openGraph: {
      title: shareTitle,
      description: `${program.name} · ${program.facility} · ${program.status}`,
      type: "article",
      siteName: "동네고고",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: `${program.name} · ${program.facility} · ${program.status}`,
    },
  };
}

export default async function ProgramSharePage({ params }: PageProps) {
  const { id } = await params;
  const program = await getSharedProgram(cleanID(id)).catch(() => null);
  if (!program) notFound();

  const maps = mapLinks(program);
  const receiptEnd = program.receiptEnd ? formatKoreanDate(program.receiptEnd) : null;
  const place = [program.facility, program.room].filter((value, index, items) => value && items.indexOf(value) === index).join(" · ");
  const detailLine = [program.periodText, program.scheduleText].filter(Boolean).join(" · ");
  const audience = program.audiences.slice(0, 2).join(" · ");

  return (
    <main className={styles.page}>
      <article className={styles.shareSheet}>
        <section className={styles.hero}>
          <div className={styles.brandRow}>
            <img src="/brand/app-icon.png" alt="동네고고" />
            <strong>동네고고에서 찾았어요.</strong>
          </div>
          <div className={styles.heroGallery} aria-label="프로그램 대표 이미지와 포스터">
            {program.images.length ? program.images.slice(0, 4).map((image, index) => (
              <figure className={styles.heroSlide} key={image.url}>
                <img src={image.thumbnailUrl ?? image.url} alt={`${program.name} ${index === 0 ? "대표 포스터" : `사진 ${index + 1}`}`} />
              </figure>
            )) : (
              <div className={styles.imageFallback}><img src="/brand/app-icon.png" alt="동네고고" /><span>프로그램 이미지를 준비하고 있어요</span></div>
            )}
          </div>
          {program.images.length > 1 && <p className={styles.swipeHint}>좌우로 넘겨 사진을 더 볼 수 있어요</p>}
        </section>

        <section className={styles.programCard} aria-labelledby="shared-program-name">
          <div className={styles.cardTopRow}>
            <div className={styles.badges}>
              <span>{program.isFree ? "무료" : program.feeText}</span>
              <span>{program.status}</span>
              {audience && <span className={styles.audienceBadge}>{audience}</span>}
            </div>
            <div className={styles.cardIcons} aria-hidden="true"><span>{categoryEmoji(program)}</span><span>⌖</span></div>
          </div>
          <h1 id="shared-program-name">{program.name}</h1>
          <p className={styles.subline}>{[program.area, place].filter(Boolean).join(" · ")}</p>
          {detailLine && <p className={styles.schedule}>{detailLine}</p>}

          <div className={styles.about}>
            <h2>이 프로그램은요</h2>
            <p>{program.description}</p>
          </div>

          <dl className={styles.placeFacts}>
            <div><dt>📍</dt><dd>{program.address ?? place}</dd></div>
            <div><dt>🗓️</dt><dd>{receiptEnd ? `${receiptEnd} 접수 마감` : "신청 일정은 앱에서 확인해 주세요"}</dd></div>
          </dl>
        </section>

        <section className={styles.deadline} aria-label="마감 알림 안내">
          <strong>{deadlineCopy(program)}</strong>
          <span>알림을 켜두면 놓치지 않아요.</span>
        </section>

        <OpenAppButton programID={program.id} />
        <p className={styles.appFallback}>동네고고 웹 지도에서 이 프로그램의 상세 정보를 바로 열어요.</p>

        {program.images.length > 1 && (
          <section className={styles.morePhotos} aria-labelledby="shared-program-photos">
            <h2 id="shared-program-photos">프로그램 사진</h2>
            <div className={styles.photoRail}>
              {program.images.map((image, index) => (
                <figure key={`more-${image.url}`}>
                  <img src={image.thumbnailUrl ?? image.url} alt={`${program.name} 사진 ${index + 1}`} loading="lazy" />
                  {(image.attribution || image.license) && (
                    <figcaption>
                      {image.attribution && <span>출처: {image.attribution}</span>}
                      {image.licenseUrl ? <a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license ?? "이용조건"}</a> : image.license && <span>{image.license}</span>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className={styles.mapSection} aria-labelledby="shared-program-maps">
          <h2 id="shared-program-maps">지도에서 더 자세히 보기</h2>
          <p>원하는 지도 앱에서 목적지 위치와 가는 길을 확인하세요.</p>
          <div className={styles.mapButtons}>
            <a href={maps.kakao} target="_blank" rel="noreferrer"><img src={OFFICIAL_MAP_ICONS.kakao.publicPath} alt="" width={28} height={28} />카카오 지도</a>
            <a href={maps.naver} target="_blank" rel="noreferrer"><img src={OFFICIAL_MAP_ICONS.naver.publicPath} alt="" width={28} height={28} />네이버 지도</a>
            <a href={maps.google} target="_blank" rel="noreferrer"><img src={OFFICIAL_MAP_ICONS.google.publicPath} alt="" width={28} height={28} />구글 지도</a>
          </div>
        </section>

        <footer className={styles.footer}>
          <a href="/public-data">데이터 출처·이용정책</a><span>·</span><a href="/privacy">개인정보처리방침</a>
        </footer>
      </article>
    </main>
  );
}
