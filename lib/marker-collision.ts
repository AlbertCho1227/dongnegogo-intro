export type MarkerScreenPoint = { id: string; x: number; y: number };
export type MarkerPixelOffset = { x: number; y: number };

const ZERO_OFFSET: MarkerPixelOffset = Object.freeze({ x: 0, y: 0 });
// 52px circle + protruding count badge + a visible gap between nearby places.
export const DEFAULT_MARKER_COLLISION_SPACING = 72;

/** Separates only the rendered icons; source coordinates and map actions stay exact. */
export function spreadMarkerCollisions(
  points: readonly MarkerScreenPoint[],
  minimumSpacing = DEFAULT_MARKER_COLLISION_SPACING,
): Map<string, MarkerPixelOffset> {
  const sorted = [...points].sort((left, right) =>
    left.y - right.y || left.x - right.x || left.id.localeCompare(right.id));
  const result = new Map(sorted.map((point) => [point.id, ZERO_OFFSET] as const));
  const thresholdSquared = minimumSpacing * minimumSpacing;
  const cells = new Map<string, Array<{ x: number; y: number }>>();
  const cellKey = (x: number, y: number) => `${Math.floor(x / minimumSpacing)}:${Math.floor(y / minimumSpacing)}`;
  const collides = (x: number, y: number) => {
    const cellX = Math.floor(x / minimumSpacing);
    const cellY = Math.floor(y / minimumSpacing);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      const neighbors = cells.get(`${cellX + dx}:${cellY + dy}`) ?? [];
      if (neighbors.some((placed) => {
        const deltaX = placed.x - x;
        const deltaY = placed.y - y;
        return deltaX * deltaX + deltaY * deltaY < thresholdSquared - 0.0001;
      })) return true;
    }
    return false;
  };
  const record = (x: number, y: number) => {
    const key = cellKey(x, y);
    cells.set(key, [...(cells.get(key) ?? []), { x, y }]);
  };

  sorted.forEach((point) => {
    let targetX = point.x;
    let targetY = point.y;
    if (collides(targetX, targetY)) {
      let found = false;
      for (let ring = 1; !found; ring += 1) {
        const radius = minimumSpacing * ring;
        const slots = Math.max(8, Math.ceil(Math.PI * 2 * ring));
        const phase = ring % 2 === 0 ? Math.PI / slots : 0;
        for (let slot = 0; slot < slots; slot += 1) {
          const angle = -Math.PI / 2 + phase + (Math.PI * 2 * slot) / slots;
          const candidateX = point.x + Math.cos(angle) * radius;
          const candidateY = point.y + Math.sin(angle) * radius;
          if (collides(candidateX, candidateY)) continue;
          targetX = candidateX;
          targetY = candidateY;
          found = true;
          break;
        }
      }
    }
    result.set(point.id, { x: targetX - point.x, y: targetY - point.y });
    record(targetX, targetY);
  });
  return result;
}
