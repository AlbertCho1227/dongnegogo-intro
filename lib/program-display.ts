const INTEGER_TEXT = /^\d+$/;
const AMOUNT_TEXT = /^\d[\d,]*$/;

export function displayScheduleText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text) return null;
  return INTEGER_TEXT.test(text) ? `총 ${Number(text).toLocaleString("ko-KR")}회` : text;
}

export function displayRequirementText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text) return null;
  return INTEGER_TEXT.test(text) ? `정원 ${Number(text).toLocaleString("ko-KR")}명` : text;
}

export function displayRoomText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text && !INTEGER_TEXT.test(text) ? text : null;
}

export function displayFeeText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text || !AMOUNT_TEXT.test(text)) return text || null;
  const amount = Number(text.replaceAll(",", ""));
  if (!Number.isFinite(amount)) return text;
  return amount === 0 ? "무료" : `${amount.toLocaleString("ko-KR")}원`;
}

export function displayAudienceTexts(values: string[], requirement?: string | null): string[] {
  const hasNumericFragment = values.some((value) => INTEGER_TEXT.test(value.trim()));
  const fullRequirement = displayRequirementText(requirement);
  if (hasNumericFragment && fullRequirement && !/^정원\s/.test(fullRequirement)) return [fullRequirement];
  return [...new Set(values.map((value) => value.trim()).filter((value) => value && !INTEGER_TEXT.test(value)))];
}
