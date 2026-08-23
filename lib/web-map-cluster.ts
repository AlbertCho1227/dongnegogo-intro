export type WebMapAggregationScope = "individual" | "localArea" | "neighborhood" | "district" | "city" | "province";

export const WEB_MAP_INDIVIDUAL_RADIUS_KM = 1.8;

function radiusScope(radiusKm: number): WebMapAggregationScope {
  if (radiusKm < 2.8) return "individual";
  if (radiusKm < 5.5) return "localArea";
  if (radiusKm < 14) return "neighborhood";
  if (radiusKm < 50) return "district";
  if (radiusKm < 180) return "city";
  return "province";
}

/** Mirrors MapAggregationScope.stabilizedScope and forcedScaleClusterScope in iOS. */
export function webMapScopeForRadius(
  radiusKm: number,
  previous: WebMapAggregationScope,
): WebMapAggregationScope {
  if (previous === "individual") {
    if (radiusKm < WEB_MAP_INDIVIDUAL_RADIUS_KM) return "individual";
    const next = radiusScope(radiusKm);
    return next === "individual" ? "localArea" : next;
  }
  if (previous === "localArea") {
    if (radiusKm < 1.55) return "individual";
    if (radiusKm < 6.2) return "localArea";
  }
  if (previous === "neighborhood" && radiusKm >= 4.85 && radiusKm < 15.7) return "neighborhood";
  if (previous === "district" && radiusKm >= 12.3 && radiusKm < 56) return "district";
  if (previous === "city" && radiusKm >= 44 && radiusKm < 202) return "city";
  if (previous === "province" && radiusKm >= 158) return "province";
  return radiusScope(radiusKm);
}

export function clusterDisplayAreaName(areaName: string): string {
  for (const suffix of ["특별자치시", "특별자치도", "특별시", "광역시"]) {
    if (areaName.endsWith(suffix)) return areaName.slice(0, -suffix.length);
  }
  return areaName.endsWith("도") && areaName.length > 2 ? areaName.slice(0, -1) : areaName;
}

export function resolvedClusterAreaName(
  scope: Exclude<WebMapAggregationScope, "individual">,
  fallback: string,
  region1DepthName: string,
  region2DepthName: string,
  region3DepthName: string,
): string {
  const region1 = region1DepthName.trim();
  const region2 = region2DepthName.trim();
  const region3 = region3DepthName.trim();
  if (scope === "localArea") return region3 || clusterDisplayAreaName(fallback);
  if (scope === "neighborhood" || scope === "district") return region2 || clusterDisplayAreaName(fallback);
  if (scope === "city") {
    if (/도$/.test(region1)) {
      const city = region2.split(/\s+/).find((part) => /시$/.test(part));
      return city || region2 || clusterDisplayAreaName(fallback);
    }
    return clusterDisplayAreaName(region1 || fallback);
  }
  return clusterDisplayAreaName(region1 || fallback);
}

export const WEB_MAP_CLUSTER_DISPLAY_LIMIT: Record<Exclude<WebMapAggregationScope, "individual">, number> = {
  localArea: 12,
  neighborhood: 22,
  district: 18,
  city: 16,
  province: 18,
};
