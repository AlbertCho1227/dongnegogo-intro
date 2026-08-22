export type OfficialProgramAccess = {
  href: string;
  providerName: string;
  requiresHomepageSearch: boolean;
};

const SEOUL_RESERVATION_HOST = "yeyak.seoul.go.kr";
const SEOUL_RESERVATION_HOME = `https://${SEOUL_RESERVATION_HOST}/`;
const ESHARE_HOSTS = new Set(["eshare.go.kr", "www.eshare.go.kr"]);
const ESHARE_HOME = "https://www.eshare.go.kr/";

/**
 * Some public-service sites reject external deep links as abnormal traffic.
 * Use their public homepage instead of retrying or attempting to bypass that
 * protection. The original URL remains untouched in the read-only database.
 */
export function officialProgramAccess(value: string | null | undefined): OfficialProgramAccess | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  if (url.hostname.toLowerCase() === SEOUL_RESERVATION_HOST) {
    return {
      href: SEOUL_RESERVATION_HOME,
      providerName: "서울시 공공서비스예약",
      requiresHomepageSearch: true,
    };
  }

  if (ESHARE_HOSTS.has(url.hostname.toLowerCase())) {
    return {
      href: ESHARE_HOME,
      providerName: "공유누리",
      requiresHomepageSearch: true,
    };
  }

  url.hash = "";
  return {
    href: url.href,
    providerName: url.hostname.replace(/^www\./, ""),
    requiresHomepageSearch: false,
  };
}
