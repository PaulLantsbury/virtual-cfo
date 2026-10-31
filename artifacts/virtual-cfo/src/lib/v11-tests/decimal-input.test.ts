import test from "node:test";
import assert from "node:assert/strict";
import { parsePoundsInput, difference } from "../v11/index.ts";

test("SP06: direct GBP inputs convert exactly to pence without binary multiplication artefacts", () => {
  for (const [raw, pence] of [
    ["17.99", 1799],
    ["0.01", 1],
    ["0", 0],
    ["105.50", 10550],
    [".50", 50],
    ["1.", 100],
    ["90071992547409.91", Number.MAX_SAFE_INTEGER],
  ] as const) {
    assert.equal(parsePoundsInput(raw), pence);
  }
  for (const raw of [
    "",
    "not money",
    "1.999",
    "1e3",
    "Infinity",
    "90071992547409.92",
  ])
    assert.equal(parsePoundsInput(raw), null);
});

test("UN02/DT03: money deltas preserve precision and missing values rather than substituting zero", () => {
  assert.equal(
    difference(157213 / 9980, 197560 / 9600),
    157213 / 9980 - 197560 / 9600,
  );
  assert.equal(difference(0, 0), 0);
  for (const [a, b] of [
    [null, 1],
    [1, null],
    [NaN, 1],
    [1, Infinity],
  ] as const)
    assert.equal(difference(a, b), null);
});
