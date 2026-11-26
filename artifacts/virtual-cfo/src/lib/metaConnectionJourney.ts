import {cancelMetaAdSelection,disconnectMetaAds,fetchMetaAdSelection,fetchMetaAdsStatus,selectMetaAdAccount,startMetaAdsConnect,type MetaAdAccount,type MetaConnection} from './metaAdsApi.ts';
export type MetaConnectionScope=Readonly<{userId:string;storeId:string;revision:number;ready:boolean}>;
export const metaConnectionScopeKey=(s:MetaConnectionScope)=>JSON.stringify([s.userId,s.storeId,s.revision,s.ready]);
export type MetaSelection=Readonly<{accounts:readonly MetaAdAccount[];expiresAt:string}>;
export type MetaConnectionJourneyState=Readonly<{scopeKey:string;busy:boolean;connections:readonly MetaConnection[]|null;selection:MetaSelection|null;message:string}>;
export type MetaConnectionAction='status'|'selection'|'connect'|'choose'|'cancel'|'disconnect';
type Context=Readonly<{expectedUserId:string;signal:AbortSignal}>;
export type MetaConnectionPorts={
 status:(storeId:string,context:Context)=>Promise<{connections:readonly MetaConnection[]}>;
 selection:(storeId:string,context:Context)=>Promise<MetaSelection>;
 connect:(storeId:string,context:Context)=>Promise<string>;
 choose:(storeId:string,accountId:string,context:Context)=>Promise<void>;
 cancel:(storeId:string,context:Context)=>Promise<void>;
 disconnect:(storeId:string,connectionId:string,context:Context)=>Promise<void>;
 navigate:(url:string)=>void;
 now:()=>number;
};
const ports:MetaConnectionPorts={
 status:(storeId,c)=>fetchMetaAdsStatus(storeId,c.signal,c),selection:(storeId,c)=>fetchMetaAdSelection(storeId,c.signal,c),
 connect:(storeId,c)=>startMetaAdsConnect(storeId,c),choose:(storeId,id,c)=>selectMetaAdAccount(storeId,id,c),
 cancel:(storeId,c)=>cancelMetaAdSelection(storeId,c),disconnect:(storeId,id,c)=>disconnectMetaAds(storeId,id,c),
 navigate:url=>window.location.assign(url),now:()=>Date.now(),
};
const empty=(scopeKey=''):MetaConnectionJourneyState=>Object.freeze({scopeKey,busy:false,connections:null,selection:null,message:''});
const valid=(s:MetaConnectionScope)=>s.ready&&!!s.userId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.storeId)&&Number.isSafeInteger(s.revision);
/** Browser scope guards complement server membership checks; no request happens until run(). */
export function createMetaConnectionJourney(currentScope:()=>MetaConnectionScope,overrides:Partial<MetaConnectionPorts>={}){
 const api={...ports,...overrides};let state=empty(),sequence=0,abort:AbortController|null=null;
 const listeners=new Set<()=>void>();const publish=(next:MetaConnectionJourneyState)=>{state=Object.freeze(next);listeners.forEach(fn=>fn());};
 const clear=()=>{sequence++;abort?.abort();abort=null;publish(empty());};
 return {getSnapshot:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},clear,
 async run(action:MetaConnectionAction,id=''){
  const scope={...currentScope()},key=metaConnectionScopeKey(scope);
  if(!valid(scope)||state.busy)return;
  const prior=state.scopeKey===key?state:empty(key);
  if(action==='connect'&&prior.connections===null)return;
  if(action==='choose'&&(!prior.selection||!prior.selection.accounts.some(a=>a.accountId===id)||Date.parse(prior.selection.expiresAt)<=api.now())){publish({...empty(key),message:'The account selection is unavailable or expired. Check pending selection or start again.'});return;}
  if(action==='cancel'&&!prior.selection)return;
  if(action==='disconnect'&&!prior.connections?.some(c=>c.connectionId===id&&c.status!=='disconnected'))return;
  const request=++sequence;abort?.abort();abort=new AbortController();const context={expectedUserId:scope.userId,signal:abort.signal};
  const current=()=>request===sequence&&!context.signal.aborted&&metaConnectionScopeKey(currentScope())===key;
  // Remove old status/selection while any request is unresolved, including mutations.
  publish({...empty(key),busy:true,message:'Checking the requested Meta connection action…'});
  const deadline=setTimeout(()=>{if(current()){abort?.abort();publish({...empty(key),message:'The request timed out. Its outcome is unknown; check connection status before trying again.'});}},15000);
  try{
   if(action==='status') {const result=await api.status(scope.storeId,context);if(current())publish({...empty(key),connections:result.connections,message:'Connection status checked. This does not verify saved spend or start collection.'});}
   else if(action==='selection'){const result=await api.selection(scope.storeId,context);if(current())publish(Date.parse(result.expiresAt)>api.now()?{...empty(key),selection:result,message:'Choose an account explicitly. No account is selected automatically.'}:{...empty(key),message:'The pending selection has expired. Check connection status before starting again.'});}
   else if(action==='connect'){const url=await api.connect(scope.storeId,context);if(current()){publish({...empty(key),message:'Opening Meta authorization…'});api.navigate(url);}}
   else {
    if(action==='choose')await api.choose(scope.storeId,id,context);
    else if(action==='cancel')await api.cancel(scope.storeId,context);
    else await api.disconnect(scope.storeId,id,context);
    if(current())publish({...empty(key),message:action==='choose'?'Account selection saved. Check connection status to confirm the current record.':action==='cancel'?'Pending selection cancelled. No collection was started.':'Disconnect request completed. Check connection status. Retained records are not permission to display disconnected-account spend.'});
   }
  }catch{if(current())publish({...empty(key),message:'The action could not be confirmed. Check connection status before trying again. No previous account or result is substituted.'});}finally{clearTimeout(deadline);}
 },};
}
