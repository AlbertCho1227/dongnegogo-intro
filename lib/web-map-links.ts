import type { WebNearbyPlace } from "@/lib/web-program-data";

function normalizedMapText(value: string | null | undefined) {
  return (value ?? "").split(/\s+/).filter(Boolean).join(" ");
}

export function nearbyPlaceDisplayName(place: WebNearbyPlace) {
  const name = normalizedMapText(place.name);
  const branch = normalizedMapText(place.branchName);
  return branch && !name.includes(branch) ? `${name} ${branch}` : name;
}

export function normalizedNearbyMapAddress(address: string | null | undefined) {
  const withoutParentheses = normalizedMapText(address).replace(/\s*\([^)]*\)/g, "");
  const withoutUnitDetails = withoutParentheses.replace(
    /,\s*(?:지하?\d*층|\d+층|\d+(?:,\d+)*호|.*일부호).*$/i,
    "",
  );
  return normalizedMapText(withoutUnitDetails);
}

export function nearbyMapSearchQuery(place: WebNearbyPlace) {
  return normalizedMapText([
    nearbyPlaceDisplayName(place),
    normalizedNearbyMapAddress(place.address),
  ].filter(Boolean).join(" "));
}

export function nearbyNaverMapURL(place: WebNearbyPlace) {
  // 긴 도로명 주소만 검색하면 네이버 장소 색인에서 결과가 비는 경우가 있다.
  // 장소명으로 찾고 실제 좌표로 화면 중심을 고정해 목적지까지 함께 보장한다.
  const query = nearbyPlaceDisplayName(place) || normalizedNearbyMapAddress(place.address);
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}?c=${place.longitude},${place.latitude},17,0,0,0,dh`;
}

export function nearbyKakaoMapURL(place: WebNearbyPlace) {
  const label = nearbyPlaceDisplayName(place) || normalizedNearbyMapAddress(place.address) || "목적지 주변 가게";
  return `https://map.kakao.com/link/map/${encodeURIComponent(label)},${place.latitude},${place.longitude}`;
}
