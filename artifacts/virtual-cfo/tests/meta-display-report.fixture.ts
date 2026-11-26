// Fictional exact producer wire, constructed only for controlled offline tests.
export const fixtureStore='d7500000-0000-4000-8000-000000000009';
export function savedReport({storeId=fixtureStore,from='2026-10-01',to='2026-10-02',amount='1200',expired=false}={}){
 const first=Date.parse(from+'T00:00:00Z'),last=Date.parse(to+'T00:00:00Z');
 const days=Array.from({length:Math.round((last-first)/86400000)+1},(_,i)=>({date:new Date(first+i*86400000).toISOString().slice(0,10),coverageState:i===0?'provider_row':'not_collected',spendMinor:i===0?amount:null,observedAt:i===0?'2026-11-01T09:00:00Z':null,runId:i===0?'33333333-3333-4333-8333-333333333333':null,runStatus:i===0?'complete':null,runStartedAt:i===0?'2026-11-01T08:59:00Z':null}));
 return {status:'available',storeId,from,to,account:{providerAccountId:'123456',currency:'GBP',timeZone:'Europe/London'},lineage:{storeId,accountId:'123456',connectionId:'22222222-2222-4222-8222-222222222222',from,to,version:`sha256:${'a'.repeat(64)}`},connectionState:expired?'expired':'current',reauthorizationRequired:expired,evidenceAvailability:'available',observationFreshness:'unknown',days};
}
