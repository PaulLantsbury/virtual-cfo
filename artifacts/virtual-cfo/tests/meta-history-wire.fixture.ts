// Disposable exact additive wire; no real account/store/provider data.
export const wireLineage={storeId:'11111111-1111-4111-8111-111111111111',accountId:'123456',connectionId:'22222222-2222-4222-8222-222222222222',from:'2026-10-01',to:'2026-10-02',version:`sha256:${'a'.repeat(64)}`};
export const wireDay={date:'2026-10-01',coverageState:'provider_row',spendMinor:'1200',observedAt:'2026-10-03T09:00:00Z',runId:'33333333-3333-4333-8333-333333333333',runStatus:'complete',runStartedAt:'2026-10-03T08:59:00Z'};
export const wire={status:'available',storeId:wireLineage.storeId,from:wireLineage.from,to:wireLineage.to,account:{providerAccountId:wireLineage.accountId,currency:'GBP',timeZone:'Europe/London'},lineage:wireLineage,connectionState:'current',reauthorizationRequired:false,evidenceAvailability:'available',observationFreshness:'unknown',days:[wireDay,{date:'2026-10-02',coverageState:'not_collected',spendMinor:null,observedAt:null,runId:null,runStatus:null,runStartedAt:null}]};
export function wireFixture(name:string){
 const input=structuredClone(wire),requested={...wireLineage};let membershipAuthorized=true;
 if(name==='wire-expired'){input.connectionState='expired';input.reauthorizationRequired=true;}
 if(name==='wire-revoked')membershipAuthorized=false;
 if(name==='wire-wrong-account')requested.accountId='654321';
 if(name==='wire-all-unknown'){input.evidenceAvailability='unavailable';input.days=input.days.map(d=>({...d,coverageState:'not_collected',spendMinor:null,observedAt:null,runId:null,runStatus:null,runStartedAt:null}));}
 if(name==='wire-disconnected')return {wire:{status:'not_connected',storeId:wireLineage.storeId,from:wireLineage.from,to:wireLineage.to,account:null,days:[]},requested,membershipAuthorized};
 return {wire:input,requested,membershipAuthorized};
}
