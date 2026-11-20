import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generate,summarise,addDays} from './generator.mjs';
import {buildAcquisitionSource} from './acquisition-source.mjs';
import {prepareAcquisitionCosts,firstOrderEconomics,matureCohortEconomics} from './acquisition-costs.mjs';
import {supplementalDigest} from './supplemental-reader.mjs';
const fixture=generate({from:'2024-11-01',asOf:'2025-04-01'}),identities=buildAcquisitionSource(generate({from:'2024-01-01',asOf:'2025-04-01'}));
const source=prepareAcquisitionCosts(fixture,identities);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const seal=source=>{delete source.sourceHash;source.sourceHash=hash(source);return source;};
const before=t=>t.netProductSales+t.netShipping-t.cogs-t.variableCosts;
test('every allocated variable expense preserves exact source pennies, correct categories and no overhead/ads duplication',()=>{
 assert.ok(source.allocationProofs.length>0);
 const categories=new Set(source.allocationProofs.map(p=>p.category));assert.deepEqual(categories,new Set(['storage','returns','pickPack','carrier','packaging','processor']));
 for(const p of source.allocationProofs){assert.equal(p.allocations.reduce((n,a)=>n+a.amount,0)+p.unallocated,p.amount);assert.equal(p.unallocated,0);assert.match(p.sourceHash,/^[a-f0-9]{64}$/);}
 for(const p of source.repeatMarketingProofs)assert.equal(p.allocations.reduce((n,a)=>n+a.amount,0)+p.unallocated,p.amount);
 const month=summarise(fixture,'2025-02-01','2025-02-28'),entries=source.contributionEntries.filter(e=>e.date>='2025-02-01'&&e.date<='2025-02-28');
 assert.equal(entries.reduce((n,e)=>n+before(e),0),month.contribution+month.marketing);
 assert.equal(entries.reduce((n,e)=>n+e.variableCosts,0),month.variableCosts);
 assert.ok(source.contributionEntries.every(e=>e.date>=fixture.from));
});
test('current first-order numerator includes only paid first orders and their observed refunds, not repeat orders or older firsts',()=>{
 const result=firstOrderEconomics(source,identities,{from:'2025-02-01',to:'2025-02-28'});
 const first=identities.orderObservations.filter(o=>o.paidFirst&&o.date>='2025-02-01'&&o.date<='2025-02-28');
 const ids=new Set(first.map(o=>o.orderId)),entries=source.contributionEntries.filter(e=>ids.has(e.orderId)&&e.date<='2025-02-28');
 assert.equal(result.customers,first.length);assert.equal(result.contributionBeforeMarketing,entries.reduce((n,e)=>n+before(e),0));
 assert.equal(result.repeatMarketingCosts,0,'Paid first-order contribution before advertising must not include repeat-order advertising');
 assert.equal(result.acquisitionSpend,identities.spendAllocations.filter(a=>a.date>='2025-02-01'&&a.date<='2025-02-28').reduce((n,a)=>n+a.acquisition,0));
 assert.equal(result.contributionBeforeMarketing,result.netProductSales+result.netShipping-result.cogs-result.variableCosts);
 assert.match(supplementalDigest(result),/^[a-f0-9]{64}$/);
});
test('mature age0–89 cohort sums customer-linked first/repeat contribution and matched repeat marketing without ratio persistence',()=>{
 const args={from:'2024-11-01',to:'2024-11-30',observedThrough:'2025-03-31'},result=matureCohortEconomics(source,identities,args);
 assert.equal(result.curve.length,90);assert.equal(result.curve[0].day,0);assert.equal(result.curve[89].day,89);
 const first=identities.orderObservations.filter(o=>o.paidFirst&&o.date>=args.from&&o.date<=args.to),customers=new Map(first.map(o=>[o.customerId,o.date]));
 const entries=source.contributionEntries.filter(e=>{const day=customers.get(e.customerId);return day&&e.date>=day&&e.date<addDays(day,90);});
 const end=result.curve.at(-1);
 assert.equal(end.contributionBeforeMarketing,entries.reduce((n,e)=>n+before(e),0));
 assert.equal(end.repeatMarketingCosts,entries.reduce((n,e)=>n+e.repeatMarketingCosts,0));assert.ok(end.repeatMarketingCosts>0);
 assert.equal(result.customers,first.length);assert.ok(!('paybackDays' in result));assert.ok(!('cac' in result));
 assert.match(supplementalDigest(result),/^[a-f0-9]{64}$/);
});
test('immature, unsupported, changed source and unallocated relevant cost refuse economics rather than invent a result',()=>{
 assert.throws(()=>matureCohortEconomics(source,identities,{from:'2025-01-01',to:'2025-01-31',observedThrough:'2025-03-31'}),/Complete 90-day/);
 assert.throws(()=>firstOrderEconomics(source,identities,{from:'2024-10-01',to:'2024-10-31'}),/Covered/);
 const changed=structuredClone(source);changed.contributionEntries[0].variableCosts++;
 assert.throws(()=>firstOrderEconomics(changed,identities,{from:'2025-02-01',to:'2025-02-28'}),/integrity/);
 const gap=structuredClone(source);gap.allocationProofs.find(p=>p.date==='2025-02-01').unallocated=1;gap.allocationHash=hash(gap.allocationProofs);seal(gap);
 assert.throws(()=>firstOrderEconomics(gap,identities,{from:'2025-02-01',to:'2025-02-28'}),/Unallocated/);
 assert.throws(()=>prepareAcquisitionCosts(generate({from:'2024-01-01',asOf:'2025-04-01'}),identities),/financial-anchored/);
});
test('later observed first-order refunds can lower contribution; source financial books and identity inputs stay immutable',()=>{
 const beforeFixture=JSON.stringify(fixture),beforeIdentities=JSON.stringify(identities);
 const initial=firstOrderEconomics(source,identities,{from:'2025-02-01',to:'2025-02-28'}),later=firstOrderEconomics(source,identities,{from:'2025-02-01',to:'2025-02-28',observedThrough:'2025-03-31'});
 assert.ok(later.netProductSales<=initial.netProductSales);assert.ok(later.cogs<=initial.cogs);assert.ok(later.variableCosts>=initial.variableCosts);
 assert.equal(JSON.stringify(fixture),beforeFixture);assert.equal(JSON.stringify(identities),beforeIdentities);
});
test('exact final maturity day is required; zero spend cannot be treated as zero-day economic payback',()=>{
 const args={from:'2024-11-01',to:'2024-11-30'};
 assert.throws(()=>matureCohortEconomics(source,identities,{...args,observedThrough:'2025-02-27'}),/Complete 90-day/);
 assert.equal(matureCohortEconomics(source,identities,{...args,observedThrough:'2025-02-28'}).state,'supported');
 // Marketing channel rotates daily. An email-only ad day can still have paid-source first orders,
 // but has no matched allocated acquisition spend: its contribution is valid, its acquisition return is not.
 const date=identities.spendAllocations.find(a=>a.date>='2024-11-01'&&a.channel==='email'&&identities.orderObservations.some(o=>o.paidFirst&&o.date===a.date)).date;
 const first=firstOrderEconomics(source,identities,{from:date,to:date});
 assert.ok(first.customers>0);assert.equal(first.acquisitionSpend,0);assert.equal(first.acquisitionMetricsState,'unavailable');
 assert.throws(()=>matureCohortEconomics(source,identities,{from:date,to:date,observedThrough:addDays(date,90)}),/Positive paired/);
});
test('unmatched repeat marketing and missing source body proof refuse complete cohort economics',()=>{
 const changed=structuredClone(identities);changed.orderObservations[0].customerId='tampered';
 assert.throws(()=>prepareAcquisitionCosts(fixture,changed),/body changed/);
 const gap=structuredClone(source);gap.repeatMarketingProofs.find(p=>p.date==='2024-11-05').unallocated=1;gap.repeatMarketingHash=hash(gap.repeatMarketingProofs);seal(gap);
 assert.throws(()=>matureCohortEconomics(gap,identities,{from:'2024-11-01',to:'2024-11-30',observedThrough:'2025-03-31'}),/Unallocated/);
});
