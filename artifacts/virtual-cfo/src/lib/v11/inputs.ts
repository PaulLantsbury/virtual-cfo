import type { Money } from "./types.ts";
/** Parse a decimal GBP input exactly. Signs are retained for field-specific validation by the calculation contract. */
export function parsePoundsInput(raw: string): Money | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/.exec(value);
  if (!match) return null;
  const whole = (match[2] ?? "0").replace(/^0+(?=\d)/, ""),
    fraction = match[3] ?? match[4] ?? "";
  if (whole.length > 14) return null;
  const pence =
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) *
    (match[1] === "-" ? -1n : 1n);
  if (
    pence > BigInt(Number.MAX_SAFE_INTEGER) ||
    pence < BigInt(Number.MIN_SAFE_INTEGER)
  )
    return null;
  return Number(pence);
}
/** Same-unit difference without presentation rounding or substituting missing values with zero. */
export function difference(
  current: number | null,
  previous: number | null,
): number | null {
  if (
    current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  )
    return null;
  const value = current - previous;
  return Number.isFinite(value) ? value : null;
}
