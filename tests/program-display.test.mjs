import assert from "node:assert/strict";
import test from "node:test";

const source = await import("../lib/program-display.ts");

test("numeric API fields are converted to labeled display text", () => {
  assert.equal(source.displayScheduleText("6"), "총 6회");
  assert.equal(source.displayRequirementText("10"), "정원 10명");
  assert.equal(source.displayFeeText("20,000"), "20,000원");
  assert.equal(source.displayRoomText("278"), null);
});

test("comma-split school grades use the complete requirement", () => {
  assert.deepEqual(
    source.displayAudienceTexts(["어린이(초등학교 1", "2", "3학년)"], "어린이(초등학교 1, 2, 3학년)"),
    ["어린이(초등학교 1, 2, 3학년)"],
  );
});
