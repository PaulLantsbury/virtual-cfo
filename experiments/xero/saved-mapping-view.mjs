/** Shared value-free saved mapping contract. No amounts, OAuth or account writes. */
export const XERO_SAVED_CATEGORIES=Object.freeze(['revenue','processingFee','advertising','software','includedCash']);
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>plain(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(`${v}T00:00:00Z`))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;
const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v));
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function parseSavedXeroMapping(value,storeId){
 if(typeof storeId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)||!exact(value,['storeId','state','mapping'])||value.storeId!==storeId)return null;
 if(['not_connected','mapping_unavailable'].includes(value.state))return value.mapping===null?Object.freeze(value):null;
 if(value.state!=='available'||!exact(value.mapping,['version','effectiveFrom','confirmedAt','directoryRetrievedAt','reviewRequired','categories']))return null;
 const m=value.mapping;
 if(!Number.isSafeInteger(m.version)||m.version<1||!day(m.effectiveFrom)||!stamp(m.confirmedAt)||!stamp(m.directoryRetrievedAt)||typeof m.reviewRequired!=='boolean'||!Array.isArray(m.categories)||m.categories.length!==5)return null;
 const seen=new Set(),accounts=new Set();
 for(const category of m.categories){
  if(!exact(category,['category','accounts'])||!XERO_SAVED_CATEGORIES.includes(category.category)||seen.has(category.category)||!Array.isArray(category.accounts)||category.accounts.length>20||(!m.reviewRequired&&category.accounts.length===0))return null;
  seen.add(category.category);
  for(const a of category.accounts){
   if(!exact(a,['accountId','name','type','status'])||!text(a.accountId,256)||accounts.has(a.accountId))return null;
   accounts.add(a.accountId);
   if(a.name===null&&a.type===null&&a.status===null){if(!m.reviewRequired)return null;}
   else if(!text(a.name,256)||!text(a.type,64)||!text(a.status,64))return null;
  }
 }
 return Object.freeze(value);
}
