import type { Request, Scope } from './evidence-packet.mjs';
export const FICTIONAL_SCOPE: Readonly<Scope>;
export const REVIEW_DATE:'2026-11-26';
export type Scenario='normal'|'zero'|'negative'|'missing-costs'|'missing-advertising'|'missing-overheads'|'missing-cash'|'cash-supported'|'stale'|'invalidated'|'denied'|'comparison-mismatch'|'prompt-injection';
export const SCENARIOS:readonly Scenario[];
export function makeRequest():Request;
export function makeFictionalInput(scenario?:Scenario):unknown;
