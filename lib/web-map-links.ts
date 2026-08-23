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
  const query = normalizedNearbyMapAddress(place.address) || nearbyPlaceDisplayName(place);
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

export function nearbyKakaoMapURL(place: WebNearbyPlace) {
  const label = nearbyPlaceDisplayName(place) || normalizedNearbyMapAddress(place.address) || "목적지 주변 가게";
  return `https://map.kakao.com/link/map/${encodeURIComponent(label)},${place.latitude},${place.longitude}`;
}
