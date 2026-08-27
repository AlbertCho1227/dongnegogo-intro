export type MarkerScreenPoint = { id: string; x: number; y: number };
export type MarkerPixelOffset = { x: number; y: number };

const ZERO_OFFSET: MarkerPixelOffset = Object.freeze({ x: 0, y: 0 });

/** Separates only the rendered icons; source coordinates and map actions stay exact. */
export function spreadMarkerCollisions(
  points: readonly MarkerScreenPoint[],
  minimumSpacing = 58,
): Map<string, MarkerPixelOffset> {
  const sorted = [...points].sort((left, right) => left.id.localeCompare(right.id));
  const result = new Map(sorted.map((point) => [point.id, ZERO_OFFSET] as const));
  const remaining = new Set(sorted.map((_, index) => index));
  const thresholdSquared = minimumSpacing * minimumSpacing;
  while (remaining.size > 0) {
    const seed = remaining.values().next().value as number;
    remaining.delete(seed);
    const component = [seed];
    for (let cursor = 0; cursor < component.length; cursor += 1) {
      const current = sorted[component[cursor]];
      const connected: number[] = [];
      remaining.forEach((candidateIndex) => {
        const candidate = sorted[candidateIndex];
        const dx = current.x - candidate.x;
        const dy = current.y - candidate.y;
        if (dx * dx + dy * dy < thresholdSquared) connected.push(candidateIndex);
      });
      connected.forEach((candidateIndex) => {
        remaining.delete(candidateIndex);
        component.push(candidateIndex);
      });
    }
    if (component.length < 2) continue;
    const members = component.map((index) => sorted[index]).sort((a, b) => a.id.localeCompare(b.id));
    const centerX = members.reduce((sum, point) => sum + point.x, 0) / members.length;
    const centerY = members.reduce((sum, point) => sum + point.y, 0) / members.length;
    const ringTotal = Math.ceil(members.length / 12);
    const baseCount = Math.floor(members.length / ringTotal);
    const remainder = members.length % ringTotal;
    let memberIndex = 0;
    let previousRadius = 0;
    for (let ringIndex = 0; ringIndex < ringTotal; ringIndex += 1) {
      const ringCount = baseCount + (ringIndex < remainder ? 1 : 0);
      const requiredRadius = Math.max(
        minimumSpacing * 0.55,
        minimumSpacing / (2 * Math.sin(Math.PI / Math.max(ringCount, 2))),
      );
      const radius = Math.max(requiredRadius, previousRadius + (ringIndex === 0 ? 0 : minimumSpacing));
      const phase = ringIndex % 2 === 0 ? 0 : Math.PI / Math.max(ringCount, 1);
      for (let index = 0; index < ringCount; index += 1) {
        const point = members[memberIndex];
        memberIndex += 1;
        const angle = -Math.PI / 2 + phase + (Math.PI * 2 * index) / ringCount;
        const targetX = centerX + Math.cos(angle) * radius;
        const targetY = centerY + Math.sin(angle) * radius;
        result.set(point.id, { x: targetX - point.x, y: targetY - point.y });
      }
      previousRadius = radius;
    }
  }
  return result;
}
