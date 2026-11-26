/** Offline contract proposal. Not imported by customer routes or UI. */
export type Lineage = Readonly<{storeId:string; accountId:string; connectionId:string; from:string; to:string; version:string}>;
export type DayEvidence = Readonly<{date:string; amountMinor:string|null; observedAt:string|null; runId:string|null; coverage:'reported'|'unknown'}>;
export type HistoryInput = Readonly<{
 /** Supplied only by trusted membership authorization, never browser input. */
 membershipAuthorized:boolean;
 requested:Lineage; selected:Lineage|null;
 connection:'current'|'expired'|'disconnected'|'superseded';
 observationFreshness:'current'|'stale'|'unknown';
 days:readonly DayEvidence[];
}>;
export function proposeHistoryContract(input:HistoryInput) {
 const keys = ['storeId','accountId','connectionId','from','to','version'] as const;
 const matches = input.selected !== null && keys.every(key => input.requested[key] === input.selected![key] && input.requested[key].length > 0);
 const available = input.membershipAuthorized === true && matches && (input.connection === 'current' || input.connection === 'expired');
 return Object.freeze({
  connection:input.connection,
  reauthorizationRequired:input.connection === 'expired',
  evidenceAvailability:available ? (input.days.some(day => day.coverage === 'reported' && day.amountMinor !== null) ? 'available' as const : 'unavailable' as const) : 'withheld' as const,
  lineage:available ? Object.freeze({...input.selected!}) : null,
  observationFreshness:available ? input.observationFreshness : 'unknown' as const,
  days:Object.freeze(available ? input.days.map(day=>Object.freeze({...day})) : []),
 });
}
