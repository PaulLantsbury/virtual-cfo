import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {historicalProfitFixture,setupHistoricalProfitEvidence,HISTORICAL_PROFIT_IDS as ids} from './historical-profit-fixture.mjs';
import {readProfitEvidence} from './profit-evidence-reader.mjs';
import {createProfitSalesReader} from './profit-sales-reader.mjs';

const {types}=createRequire(new URL('../../lib/db/package.json',import.meta.url))('pg');
const parseInt8=types.getTypeParser(20,'text');
assert.equal(parseInt8('1500'),'1500');

// node-postgres's default int8 decoder returns decimal text. The wrapper models
// that driver boundary without changing persisted source rows or their proofs.
function int8Driver(db,decode=value=>parseInt8(String(value))) {
 const wrap=tx=>({
  exec:sql=>tx.exec(sql),
  query:async(sql,args)=>{
   const result=await tx.query(sql,args);
   return {...result,rows:result.rows.map(row=>Object.hasOwn(row,'historic_unit_cost_pence')?{...row,historic_unit_cost_pence:decode(row.historic_unit_cost_pence)}:row)};
  }
 });
 return {...wrap(db),transaction:callback=>db.transaction(tx=>callback(wrap(tx)))};
}
for(const legacyDecimalProof of [false,true])test(`Profit proofs retain exact costs across int8 drivers (${legacyDecimalProof?'decimal-text':'number'} stored proof)`,async()=>{
 const f=await historicalProfitFixture({prepareProfit:false});
 try{
  await setupHistoricalProfitEvidence(legacyDecimalProof?int8Driver(f.db):f.db,f.profitOptions);
  const scope=f.scopes['2026-08'],readSales=createProfitSalesReader({userId:f.userId});
  const read=db=>readProfitEvidence(db,{versionId:ids.versions['2026-08'],scope,readSales});
  for(const db of [f.db,int8Driver(f.db)]){
   const r=await read(db);assert.equal(r.readError,null);
   for(const [metric,value]of Object.entries({cogs:36000,grossProfit:60000,contribution:49600,operatingProfit:46600,ebitda:47200}))assert.equal(r.result[metric].value,value,metric);
  }
  const tampered=await read(int8Driver(f.db,value=>String(Number(value)+1)));
  assert.match(tampered.readError.productCosts,/Historical landed-cost proof unavailable/);
  assert.equal(tampered.result.cogs.value,null);assert.equal(tampered.result.sales.netProductSales,96000);
  for(const decode of [()=> '9007199254740993',()=> '15e2',()=> '01500',()=> '-1500']){
   const invalid=await read(int8Driver(f.db,decode));
   assert.match(invalid.readError.productCosts,/Cost precision unsupported/);
   assert.equal(invalid.result.cogs.value,null);
  }
 }finally{await f.db.close();}
});
