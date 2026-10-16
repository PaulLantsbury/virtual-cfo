/** Pure staging London admission. This file imports no collector/database code. */
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hourCycle:'h23',hour:'2-digit',minute:'2-digit'});
export function renderShopifyWindow(now){
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))return {state:'skipped',reason:'invalid_clock'};
 const parts=Object.fromEntries(clock.formatToParts(now).map(part=>[part.type,part.value]));
 return parts.hour==='02'&&Number(parts.minute)<15?{state:'admitted'}:{state:'skipped',reason:'outside_london_refresh_window'};
}
/** Injected clock/collector are tests only. The executable passes the real clock.
 * The existing collector owns durable claims, scope computation and safe output. */
export async function dispatchRenderShopify({now,env,loadCollector}={}){
 const gate=renderShopifyWindow(now);
 if(gate.state!=='admitted')return gate;
 if(env?.NIGHT_SCOUT_CLOUD_ENABLED!=='true')return {state:'disabled',executionMode:'tick',writeAttempted:false};
 if(env.NIGHT_SCOUT_REPORT_SCOPE!=='rolling-31-completed-days'||env.NIGHT_SCOUT_REPORT_FROM!==undefined||env.NIGHT_SCOUT_REPORT_TO!==undefined)throw Error('Rolling completed-period mode required');
 if(typeof loadCollector!=='function')throw Error('Shopify reader unavailable');
 const {runCloudNightly}=await loadCollector();
 return runCloudNightly({env,mode:'tick',confirmTarget:'bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17'});
}
