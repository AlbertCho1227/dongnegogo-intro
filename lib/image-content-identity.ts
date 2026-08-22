const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const SHA256_FILE_PATTERN = /(?:^|\/)([a-f0-9]{64})(?:\.[a-z0-9]{1,10})?$/i;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * 같은 이미지가 program-posters와 verified 경로에 각각 저장되어도 파일명의
 * SHA-256은 동일하다. URL보다 콘텐츠 해시를 우선해 eShare/공유누리 출처명이
 * 다른 동일 사진을 한 장으로 취급한다.
 */
export function imageContentIdentity(explicitHash: unknown, ...urls: Array<string | null>): string {
  const suppliedHash = nonEmptyString(explicitHash);
  if (suppliedHash && SHA256_PATTERN.test(suppliedHash)) return `sha256:${suppliedHash.toLowerCase()}`;

  for (const value of urls) {
    if (!value) continue;
    try {
      const matchedHash = new URL(value).pathname.match(SHA256_FILE_PATTERN)?.[1];
      if (matchedHash) return `sha256:${matchedHash.toLowerCase()}`;
    } catch {
      // 호출부에서 검증한 URL이지만, 파싱 실패 시 아래 문자열 정규화로 대체한다.
    }
  }

  const firstURL = urls.find((value): value is string => !!value);
  if (!firstURL) return "missing-image";
  try {
    const normalized = new URL(firstURL);
    normalized.hash = "";
    normalized.search = "";
    normalized.pathname = normalized.pathname
      .replace("/storage/v1/render/image/", "/storage/v1/object/")
      .replace("/storage/v1/object/sign/", "/storage/v1/object/public/");
    return `url:${normalized.href.toLowerCase()}`;
  } catch {
    return `url:${firstURL.split("#", 1)[0].split("?", 1)[0].toLowerCase()}`;
  }
}

export type ContentImageCandidate = {
  contentIdentity: string;
  contentAliases?: string[];
  thumbnailUrl: string | null;
  attribution: string | null;
  license: string | null;
  licenseUrl: string | null;
};

function mergedAttribution(primary: string | null, duplicate: string | null): string | null {
  if (!primary) return duplicate;
  if (!duplicate || primary === duplicate) return primary;
  return [...new Set([primary, duplicate])].join(" · ");
}

/**
 * 동일 콘텐츠 가운데 먼저 수집된 대표 사진을 유지하되, 뒤 사진에만 있는
 * 출처·이용조건은 합쳐서 저작권 고지가 사라지지 않게 한다.
 */
export function dedupeImagesByContent<T extends ContentImageCandidate>(candidates: T[]): T[] {
  const deduplicated: T[] = [];
  const indexByIdentity = new Map<string, number>();

  for (const candidate of candidates) {
    const identities = [...new Set([candidate.contentIdentity, ...(candidate.contentAliases ?? [])])];
    const duplicateIndex = identities
      .map((identity) => indexByIdentity.get(identity))
      .find((index): index is number => index !== undefined);
    if (duplicateIndex === undefined) {
      for (const identity of identities) indexByIdentity.set(identity, deduplicated.length);
      deduplicated.push(candidate);
      continue;
    }

    for (const identity of identities) indexByIdentity.set(identity, duplicateIndex);
    const preferred = deduplicated[duplicateIndex];
    deduplicated[duplicateIndex] = {
      ...preferred,
      thumbnailUrl: preferred.thumbnailUrl ?? candidate.thumbnailUrl,
      attribution: mergedAttribution(preferred.attribution, candidate.attribution),
      license: preferred.license ?? candidate.license,
      licenseUrl: preferred.licenseUrl ?? candidate.licenseUrl,
    };
  }

  return deduplicated;
}
