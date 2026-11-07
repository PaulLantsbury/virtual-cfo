/**
 * Local contract for the first Xero accounting and cash readers.
 * Accounting is accrual/P&L and cash is a separate dated balance view.  Values
 * remain Xero-reported integer minor units: this reader never converts them or
 * accepts Shopify figures.
 */
const unavailable=(reason)=>Object.freeze({available:false,reason,accounting:null,cash:null,shopifyComparison:'not_requested'});
const categories=Object.freeze(['revenue','processingFee','advertising','software','includedCash']);

export function readXeroAccountingPeriod({scope,mapping,source}={}){
 if(!validScope(scope)||!completeMapping(mapping)||!plain(source))return unavailable('account_mapping_review_required');
 if(source.state==='failed')return unavailable('source_refresh_failed');
 if(source.state==='invalidated')return unavailable('source_review_required');
 if(source.state!=='supported'||!validDate(source.asOf)||!sameScope(scope,source.scope)||!plain(source.values))return unavailable('accounting_evidence_unavailable');
 const values=source.values;
 if(!categories.every(category=>Number.isSafeInteger(values[category])))return unavailable('accounting_evidence_unavailable');
 return Object.freeze({available:true,reason:null,accounting:Object.freeze({basis:'accrual_p_and_l',currency:scope.currency,period:Object.freeze({from:scope.from,to:scope.to}),bookedRevenue:values.revenue,processingFees:values.processingFee,advertising:values.advertising,software:values.software,asOf:source.asOf}),cash:Object.freeze({basis:'dated_unrestricted_balance',currency:scope.currency,includedBalance:values.includedCash,asOf:source.asOf,unsettledProcessorFunds:'separate_or_unavailable'}),shopifyComparison:'not_requested'});
}

function completeMapping(value){return plain(value)&&value.ready===true&&categories.every(category=>Array.isArray(value[category])&&value[category].length>0&&value[category].every(id=>typeof id==='string'&&id.trim()!==''));}
function validScope(value){return plain(value)&&validDate(value.from)&&validDate(value.to)&&typeof value.currency==='string'&&/^[A-Z]{3}$/.test(value.currency)&&value.from<=value.to;}
function sameScope(a,b){return validScope(b)&&a.from===b.from&&a.to===b.to&&a.currency===b.currency;}
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;}
function plain(value){return value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;}
