export const BLOG_ARCHIVE_CITIES = [
  "전체",
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
] as const;

export type BlogArchiveCity = (typeof BLOG_ARCHIVE_CITIES)[number];

const LEGACY_REGION_NAMES: Partial<Record<BlogArchiveCity, readonly string[]>> = {
  "강원특별자치도": ["강원특별자치도", "강원도"],
  "전북특별자치도": ["전북특별자치도", "전라북도"],
};

export function blogArchiveRegionValues(city: BlogArchiveCity): readonly string[] {
  if (city === "전체") return [];
  return LEGACY_REGION_NAMES[city] ?? [city];
}
