// Fictional offline inputs only; never fetched from a provider or customer store.
export const lineage={storeId:'fixture-store',accountId:'fixture-account',connectionId:'fixture-connection',from:'2026-10-01',to:'2026-10-02',version:'fixture-v1'};
export const displayContext={lineage,currency:'GBP',timeZone:'Europe/London'};
export const days=[{date:'2026-10-01',amountMinor:'1200',observedAt:'2026-10-03T09:00:00Z',runId:'fixture-run-1',coverage:'reported'},{date:'2026-10-02',amountMinor:null,observedAt:null,runId:null,coverage:'unknown'}];
export const saved={connection:'current',reauthorizationRequired:false,evidenceAvailability:'available',lineage,observationFreshness:'stale',days};
export function fixtureProps(name:string){
 const result=structuredClone(saved),requested={...lineage},display=structuredClone(displayContext);
 let membershipAuthorized=true;
 if(name==='expired'){result.connection='expired';result.reauthorizationRequired=true;}
 if(['disconnected','superseded','revoked'].includes(name))result.connection=name;
 if(name==='membership-revoked')membershipAuthorized=false;
 if(name.startsWith('wrong-')){const key=name.slice(6) as keyof typeof lineage;requested[key]='wrong-'+requested[key];}
 if(name==='all-unknown'){result.evidenceAvailability='unavailable';result.days=result.days.map(day=>({...day,amountMinor:null,observedAt:null,runId:null,coverage:'unknown'}));}
 return {result,requested,displayContext:display,membershipAuthorized};
}
