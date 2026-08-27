import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_MARKER_COLLISION_SPACING, spreadMarkerCollisions } from "../lib/marker-collision.ts";

test("nearby marker images are all kept visible", () => {
  const points = [{ id: "a", x: 100, y: 100 }, { id: "b", x: 112, y: 104 }];
  const offsets = spreadMarkerCollisions(points);
  const displayed = points.map((point) => ({
    x: point.x + offsets.get(point.id).x,
    y: point.y + offsets.get(point.id).y,
  }));
  assert.ok(
    Math.hypot(displayed[0].x - displayed[1].x, displayed[0].y - displayed[1].y)
      >= DEFAULT_MARKER_COLLISION_SPACING,
  );
});

test("already separated marker images keep zero offset", () => {
  const offsets = spreadMarkerCollisions([{ id: "a", x: 0, y: 0 }, { id: "b", x: 200, y: 200 }]);
  assert.deepEqual(offsets.get("a"), { x: 0, y: 0 });
  assert.deepEqual(offsets.get("b"), { x: 0, y: 0 });
});

test("same-place representative stays intact while dense distinct places remain visible", () => {
  const representative = [{ id: "same-place:14-programs", x: 100, y: 100 }];
  assert.deepEqual(spreadMarkerCollisions(representative).get(representative[0].id), { x: 0, y: 0 });

  const places = Array.from({ length: 20 }, (_, index) => ({ id: `place-${index}`, x: 100, y: 100 }));
  const offsets = spreadMarkerCollisions(places);
  const displayed = places.map((point) => ({
    x: point.x + offsets.get(point.id).x,
    y: point.y + offsets.get(point.id).y,
  }));
  displayed.forEach((point, index) => displayed.slice(index + 1).forEach((candidate) => {
    assert.ok(
      Math.hypot(point.x - candidate.x, point.y - candidate.y)
        >= DEFAULT_MARKER_COLLISION_SPACING - 0.01,
    );
  }));
});

test("separating neighboring groups never creates another overlap", () => {
  const points = [
    { id: "a", x: 0, y: 0 }, { id: "b", x: 8, y: 10 },
    { id: "c", x: 108, y: 0 }, { id: "d", x: 116, y: 10 },
    { id: "e", x: 216, y: 0 }, { id: "f", x: 224, y: 10 },
  ];
  const offsets = spreadMarkerCollisions(points);
  const displayed = points.map((point) => ({
    x: point.x + offsets.get(point.id).x,
    y: point.y + offsets.get(point.id).y,
  }));
  displayed.forEach((point, index) => displayed.slice(index + 1).forEach((candidate) => {
    assert.ok(
      Math.hypot(point.x - candidate.x, point.y - candidate.y)
        >= DEFAULT_MARKER_COLLISION_SPACING - 0.01,
    );
  }));
});
