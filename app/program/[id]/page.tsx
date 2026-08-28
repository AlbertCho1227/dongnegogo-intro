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

function sharedProgramOverviewStory(program: SharedProgram) {
  const category = program.category?.trim() || program.field?.trim() || "공공";
  const venue = program.facility?.trim() || "운영기관";
  const area = program.area?.trim() || "우리 동네";
  const audience = program.requirement?.trim() || program.audiences.join(" · ") || "누구나 신청할 수 있어요.";
  const receipt = [program.receiptStart?.slice(0, 10), program.receiptEnd?.slice(0, 10)].filter(Boolean).join(" ~ ");
  const schedule = program.periodText?.trim() || program.scheduleText?.trim();
  const fee = program.isFree
    ? `완전 무료예요. ${program.preparation?.trim() || "준비물도 없어요."}`
    : [program.feeText?.trim() || "요금 확인", program.preparation?.trim()].filter(Boolean).join(" · ");
  return {
    activityHeading: `${category} 프로그램, 이렇게 활용해 보세요`,
    activityBody: `${program.name} 참여 전 일정과 장소를 함께 메모해 두면 방문 준비가 쉬워요. 참여 후에는 기억에 남은 내용이나 다음에 확인할 점을 짧게 남겨 보세요.`,
    checklist: [
      `신청 대상: ${audience}`,
      `접수 상태: ${program.status || "일정 확인"}`,
      receipt ? `접수 일정: ${receipt}` : null,
      schedule ? `운영 일정: ${schedule}` : null,
      `비용과 준비물: ${fee}`,
      `장소: ${venue}`,
    ].filter((item): item is string => Boolean(item)).slice(0, 6),
    searchHeading: `${area} ${category} 프로그램을 구체적으로 찾는 법`,
    searchBody: `찾기에서 ‘${area} ${category}’처럼 지역과 분야를 함께 입력하면 비슷한 프로그램을 더 빠르게 찾을 수 있어요. 최종 일정과 신청 조건은 운영기관의 최신 안내를 기준으로 확인해 주세요.`,
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
  const story = sharedProgramOverviewStory(program);

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
            <div className={styles.storyIntro}><h3><img src="/icons/program-detail/2a-book.svg" alt="" />프로그램 안내</h3>{program.description.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            <div className={styles.storyDivider} />
            <section className={styles.storySection}><h3><img src="/icons/program-detail/2a-bulb.svg" alt="" />{story.activityHeading}</h3><p>{story.activityBody}</p></section>
            <div className={styles.storyDivider} />
            <section className={styles.storySection}><h3><img src="/icons/program-detail/2a-checklist.svg" alt="" />신청 전 체크리스트</h3><ul>{story.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <div className={styles.storyDivider} />
            <section className={styles.storySection}><h3><img src="/icons/program-detail/2a-search.svg" alt="" />{story.searchHeading}</h3><p>{story.searchBody}</p></section>
          </div>

          <dl className={styles.placeFacts}>
            <div><dt><img src="/icons/program-detail/1c-pin.svg" alt="" /></dt><dd>{program.address ?? place}</dd></div>
            <div><dt><img src="/icons/program-detail/1c-calendar.svg" alt="" /></dt><dd>{receiptEnd ? `${receiptEnd} 접수 마감` : "신청 일정은 앱에서 확인해 주세요"}</dd></div>
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
