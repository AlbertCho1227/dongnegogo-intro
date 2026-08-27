import type { WebProgram } from "@/lib/web-program-data";

export type WebFamilyRole = "어머니" | "아버지" | "나" | "아이";

export type WebFamilyProgramResult = {
  programs: WebProgram[];
  region: string;
  radiusMeters: number | null;
  regionProgramCount: number;
};

function ageNumber(ageGroup: string): number | null {
  const match = ageGroup.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function searchableText(program: WebProgram): string {
  return [
    program.name,
    program.category,
    program.field,
    program.summary,
    ...program.audiences,
  ].join(" ").normalize("NFC");
}

function childRank(program: WebProgram, ageGroup: string): number {
  const text = searchableText(program);
  const exactTerms = /10대 미만|초등/.test(ageGroup)
    ? ["유아", "어린이", "아동", "초등"]
    : ["청소년", "중학생", "고등학생", "10대"];
  if (exactTerms.some((term) => text.includes(term))) return 2;
  return /아이|유아|어린이|아동|초등|청소년|중학생|고등학생|가족/.test(text) ? 1 : 0;
}

/**
 * Applies the saved family role and age after the server has loaded the saved
 * region independently from the map viewport. Children keep the complete
 * regional list, with age matches first, just like the native family screen.
 */
export function familyProgramsForProfile(
  programs: readonly WebProgram[],
  role: WebFamilyRole,
  ageGroup: string,
): WebProgram[] {
  if (role === "아이") {
    return [...programs].sort((left, right) => childRank(right, ageGroup) - childRank(left, ageGroup));
  }

  const age = ageNumber(ageGroup);
  if ((role === "어머니" || role === "아버지") && (age === null || age >= 60)) {
    return programs.filter((program) => program.isSeniorRecommended
      || /시니어|어르신|노인|고령|60세|65세|70대|80대|90대/.test(searchableText(program)));
  }

  return programs.filter((program) => {
    if (!program.audiences.length) return true;
    return /성인|일반|누구나|직장인|청년|중장년/.test(searchableText(program));
  });
}
