export type OpenRunCityProgram = {
  region?: string | null;
  area?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const metropolitan = new Set(["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종"]);
const provinces = new Set([
  "경기", "강원", "충청북", "충청남", "전라북", "전라남", "경상북", "경상남", "제주",
  "충북", "충남", "전북", "전남", "경북", "경남",
]);

function shortAdministrativeName(value: string) {
  return value.replace(/특별자치시|특별시|광역시|특별자치도|도|시|군$/u, "");
}

export function openRunCityName(regionPath: string) {
  const components = regionPath.trim().split(/\s+/u).filter(Boolean);
  const first = components[0] ?? "서울특별시";
  const topLevel = shortAdministrativeName(first);
  if (metropolitan.has(topLevel)) return topLevel;
  if (provinces.has(topLevel) && components[1]) return shortAdministrativeName(components[1]);
  return topLevel || "서울";
}

export function openRunCityLabel(cityName: string) {
  const normalized = cityName.trim() || "서울";
  if (/[시군도]$/u.test(normalized)) return normalized;
  const provinceLabels: Record<string, string> = {
    경기: "경기도", 강원: "강원도", 충북: "충청북도", 충남: "충청남도",
    전북: "전라북도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주도",
  };
  return provinceLabels[normalized] ?? `${normalized}시`;
}

export function openRunProgramMatchesCity(program: OpenRunCityProgram, cityName: string) {
  const city = shortAdministrativeName(cityName.replace(/\s+/gu, ""));
  if (!city) return true;
  const document = [program.region, program.area, program.address]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/gu, "");
  return document.includes(city);
}

export function nearestOpenRunCityName(
  programs: OpenRunCityProgram[],
  coordinate: { latitude: number; longitude: number },
) {
  let nearest: OpenRunCityProgram | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const program of programs) {
    const latitude = Number(program.latitude);
    const longitude = Number(program.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const distance = (latitude - coordinate.latitude) ** 2 + (longitude - coordinate.longitude) ** 2;
    if (distance < nearestDistance) {
      nearest = program;
      nearestDistance = distance;
    }
  }
  return openRunCityName([nearest?.region, nearest?.area, nearest?.address].filter(Boolean).join(" "));
}
