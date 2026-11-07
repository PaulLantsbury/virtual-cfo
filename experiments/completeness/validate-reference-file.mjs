import {eventDay} from '../financial-v1/event-evidence.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=500&&v===v.trim();
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const currencies=new Set(Intl.supportedValuesOf('currency').filter(c=>new Intl.NumberFormat('en-GB',{style:'currency',currency:c}).resolvedOptions().maximumFractionDigits===2));
const scopeKeys=['storeId','currency','timezone','from','to'];
const eventKeys=['storeId','currency','type','id','orderId','timestamp','productExVat','shippingExVat','vat','cash'];
/** Local JSON format validation only. No external data access or approval.
 * Success yields a copy in the existing comparator contract, never certification.
 */
export function validateReferenceFile(contents,{expectedScope}={}){
 const issues=[];const issue=(path,code,message)=>{if(issues.length<100)issues.push({path,code,message});};
 const fail=()=>({status:'invalid_reference_file',coverageCertified:false,issues,ledger:null});
 if(typeof contents!=='string'||new TextEncoder().encode(contents).length>1048576){issue('$','FILE_LIMIT','Provide a UTF-8 JSON file of at most 1 MiB.');return fail();}
 let file;try{file=JSON.parse(contents);}catch{issue('$','INVALID_JSON','The file is not valid JSON.');return fail();}
 const shape=(v,keys,path)=>{if(!object(v)){issue(path,'OBJECT_REQUIRED','An object is required.');return false;}for(const k of keys)if(!Object.hasOwn(v,k))issue(`${path}.${k}`,'MISSING_FIELD','This field is required.');if(Object.keys(v).some(k=>!keys.includes(k)))issue(path,'UNKNOWN_FIELD','Unexpected fields are not supported in version 1.');return true;};
 if(!shape(file,['schemaVersion','scope','evidenceRef','events'],'$'))return fail();
 if(file.schemaVersion!==1)issue('$.schemaVersion','UNSUPPORTED_VERSION','schemaVersion must be 1.');
 if(!text(file.evidenceRef))issue('$.evidenceRef','INVALID_REFERENCE','Provide a nonblank evidence reference without surrounding spaces (up to 500 characters).');
 if(shape(file.scope,scopeKeys,'$.scope')){
 const s=file.scope;
 if(!text(s.storeId))issue('$.scope.storeId','INVALID_ID','Provide a store ID.');
 if(!currencies.has(s.currency))issue('$.scope.currency','UNSUPPORTED_CURRENCY','Use a supported currency with two decimal places, such as GBP.');
 try{if(!text(s.timezone))throw Error();eventDay('2026-01-01T00:00:00Z',s.timezone);}catch{issue('$.scope.timezone','INVALID_TIMEZONE','Provide a recognised store timezone.');}
 for(const k of ['from','to'])if(!date(s[k]))issue(`$.scope.${k}`,'INVALID_DATE','Use a real calendar date in YYYY-MM-DD format.');
 if(date(s.from)&&date(s.to)&&s.from>s.to)issue('$.scope','REVERSED_PERIOD','The end date must not precede the start date.');
 if(expectedScope!==undefined&&(!object(expectedScope)||scopeKeys.some(k=>s[k]!==expectedScope[k])))issue('$.scope','SCOPE_MISMATCH','The file does not match the expected store, currency, timezone or period.');
 }
 if(!Array.isArray(file.events)||file.events.length>10000){issue('$.events','EVENT_LIMIT','Provide an array of at most 10,000 events.');return fail();}
 const seen=new Set();
 for(const [i,e] of file.events.entries()){
 const p=`$.events[${i}]`;if(!shape(e,eventKeys,p))continue;
 for(const k of ['id','orderId'])if(!text(e[k]))issue(`${p}.${k}`,'INVALID_ID','Provide a nonblank ID without surrounding spaces.');
 if(!['sale','refund'].includes(e.type))issue(`${p}.type`,'INVALID_TYPE','Use sale or refund.');
 if(e.storeId!==file.scope?.storeId||e.currency!==file.scope?.currency)issue(p,'EVENT_SCOPE_MISMATCH','Event store and currency must match the file scope.');
 try{eventDay(e.timestamp,file.scope?.timezone);}catch{issue(`${p}.timestamp`,'INVALID_TIMESTAMP','Provide a real event timestamp with an explicit UTC offset.');}
 const amounts=['productExVat','shippingExVat','vat','cash'];
 for(const k of amounts)if(!Number.isSafeInteger(e[k])||e[k]<0)issue(`${p}.${k}`,'INVALID_AMOUNT','Use nonnegative integer minor units, for example 2400 for GBP 24.00.');
 if(amounts.every(k=>Number.isSafeInteger(e[k])&&e[k]>=0)){const sum=e.productExVat+e.shippingExVat+e.vat;if(!Number.isSafeInteger(sum)||sum!==e.cash)issue(p,'COMPONENT_MISMATCH','Product, shipping and VAT must add up to the payment or refund.');}
 const key=JSON.stringify([e.type,e.id]);if(seen.has(key))issue(`${p}.id`,'DUPLICATE_EVENT','This event type and ID already appear in the file.');seen.add(key);
 }
 if(issues.length)return fail();
 return {status:'valid_reference_file',coverageCertified:false,issues:[],ledger:{scope:file.scope,evidenceRef:file.evidenceRef,events:file.events}};
}
