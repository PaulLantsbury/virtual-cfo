/** Pure proposal compiler. Produces immutable parameterised statements; never connects or executes. */
import {supplementalDigest} from './supplemental-reader.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {stableId,RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const ensure=(v,m)=>{if(!v)throw Error(m);};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
function finiteJSON(value,seen=new Set(),depth=0,budget={nodes:0}){
 ensure(depth<=32&&++budget.nodes<=5000000,'Plan JSON exceeds bounded review size');
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='string'){ensure(Buffer.byteLength(value)<=1024*1024,'Plan string exceeds bound');return;}
 if(typeof value==='number'){ensure(Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER&&!Object.is(value,-0),'Finite precise plan JSON required');return;}
 ensure(value&&typeof value==='object'&&!seen.has(value),'Plain finite plan JSON required');seen.add(value);
 const array=Array.isArray(value);if(array)ensure(Object.getPrototypeOf(value)===Array.prototype,'Plain plan arrays required');ensure(array||Object.getPrototypeOf(value)===Object.prototype,'Plain plan JSON required');
 const keys=Object.keys(value);ensure(Reflect.ownKeys(value).length===keys.length+(array?1:0)&&(!array||keys.length===value.length),'Hidden or sparse plan JSON refused');
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);ensure(!['__proto__','constructor','prototype'].includes(key)&&d&&'value'in d,'Unsafe plan property');finiteJSON(d.value,seen,depth+1,budget);}seen.delete(value);
}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
const columns='snapshot_id,store_id,date_from,date_to,kind,financial_version,sales_revision,cost_revision,body,body_hash,observed_at,invalidated';
const incoming=`SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(snapshot_id uuid,store_id uuid,date_from date,date_to date,kind text,financial_version uuid,sales_revision text,cost_revision text,body jsonb,body_hash text,observed_at timestamptz,invalidated boolean)`;
const sameKey=`(t.snapshot_id=i.snapshot_id OR (t.store_id=i.store_id AND t.date_from=i.date_from AND t.date_to=i.date_to AND t.kind=i.kind AND t.financial_version=i.financial_version))`;
const sameRow=`(t.snapshot_id,t.store_id,t.date_from,t.date_to,t.kind,t.financial_version,t.sales_revision,t.cost_revision,t.body,t.body_hash,t.observed_at,t.invalidated) IS NOT DISTINCT FROM (i.snapshot_id,i.store_id,i.date_from,i.date_to,i.kind,i.financial_version,i.sales_revision,i.cost_revision,i.body,i.body_hash,i.observed_at,i.invalidated)`;
/** The caller MUST independently supply the reviewed immutable hash and row count.
 * Existing same-key rows must be byte-equivalent JSON/indexes, never updated.
 * The existing INSERT trigger checks current financial-version/revision authority. */
export function prepareSupplementalPublication(plan,{expectedPlanHash,expectedRecords,expectedStore=identity.storeId}={}){
 ensure(expectedStore===identity.storeId&&sha(expectedPlanHash)&&Number.isInteger(expectedRecords)&&expectedRecords>=1&&expectedRecords<=48,'Exact reviewed store, plan hash and bounded row count required');
 finiteJSON(plan);
 ensure(plan?.contract==='synthetic-supplemental-plan-v1'&&plan.state==='prepared-only'&&plan.storeId===identity.storeId&&plan.planHash===expectedPlanHash,'Reviewed supplemental plan required');
 const {planHash,...artifact}=plan;ensure(digest(artifact)===expectedPlanHash,'Reviewed plan hash differs');
 ensure(Array.isArray(plan.records)&&plan.records.length===expectedRecords&&plan.counters?.records===expectedRecords&&plan.counters.months>=1&&plan.counters.months<=24,'Exact reviewed record count differs');
 ensure(plan.hashes?.records===digest(plan.records)&&plan.hashes.financialReports===digest(plan.proofs?.financialReports)&&plan.hashes.proofs===digest(plan.proofs),'Reviewed proof/record digest differs');
 ensure(Array.isArray(plan.kinds)&&plan.kinds.length>=1&&plan.kinds.length<=2&&new Set(plan.kinds).size===plan.kinds.length&&plan.kinds.every(k=>['cash','acquisition'].includes(k)),'Exact reviewed kinds required');
 ensure(expectedRecords===plan.counters.months*plan.kinds.length,'Every reviewed month requires every chosen kind');
 const ids=new Set(),keys=new Set(),periods=new Map();
 for(const r of plan.records){
  ensure(exact(r,columns)&&r.store_id===identity.storeId&&uuid(r.snapshot_id)&&uuid(r.financial_version)&&r.invalidated===false&&plan.kinds.includes(r.kind)&&sha(r.sales_revision)&&sha(r.cost_revision),'Invalid supplemental publication index');
  const b=r.body,s=b?.scope;
  ensure(exact(b,'contract,kind,scope,financialVersionId,salesRevision,costRevision,sourceBasis,observedAt,payload')&&exact(s,'storeId,currency,timezone,from,to')&&b.contract==='reviewed-supplement-v1'&&b.sourceBasis==='synthetic-local'&&s.storeId===identity.storeId&&s.currency==='GBP'&&s.timezone==='Europe/London'&&s.from===r.date_from&&s.to===r.date_to&&b.kind===r.kind&&b.financialVersionId===r.financial_version&&b.salesRevision===r.sales_revision&&b.costRevision===r.cost_revision&&b.observedAt===r.observed_at&&r.observed_at===plan.observedAt,'Publication body/index binding differs');
  ensure(/^\d{4}-\d{2}-01$/.test(r.date_from)&&new Date(r.date_from+'T00:00:00Z').toISOString().slice(0,10)===r.date_from&&new Date(Date.UTC(+r.date_from.slice(0,4),+r.date_from.slice(5,7),0)).toISOString().slice(0,10)===r.date_to,'Complete reviewed months required');
  ensure(r.body_hash===supplementalDigest(b)&&r.snapshot_id===stableId('supplemental-v1',`${r.kind}:${r.store_id}:${r.date_from}:${r.date_to}:${r.financial_version}:${r.body_hash}`),'Publication source/hash/id differs');
  const key=[r.store_id,r.date_from,r.date_to,r.kind,r.financial_version].join(':');ensure(!ids.has(r.snapshot_id)&&!keys.has(key),'Duplicate reviewed supplemental row');ids.add(r.snapshot_id);keys.add(key);
  const period=periods.get(r.date_from)||{to:r.date_to,version:r.financial_version,kinds:new Set()};ensure(period.to===r.date_to&&period.version===r.financial_version&&!period.kinds.has(r.kind),'Mixed financial baseline in reviewed month');period.kinds.add(r.kind);periods.set(r.date_from,period);
 }
 ensure(plan.counters.cash===plan.records.filter(r=>r.kind==='cash').length&&plan.counters.acquisition===plan.records.filter(r=>r.kind==='acquisition').length,'Reviewed kind counters differ');
 const ordered=[...periods].sort(([a],[b])=>a.localeCompare(b));ensure(ordered.length===plan.counters.months&&ordered[0][0]===plan.from&&ordered.at(-1)[1].to===plan.to,'Reviewed period bounds differ');
 for(let i=0;i<ordered.length;i++){ensure(ordered[i][1].kinds.size===plan.kinds.length,'Missing reviewed month kind');if(i){const next=new Date(ordered[i-1][1].to+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);ensure(next.toISOString().slice(0,10)===ordered[i][0],'Noncontiguous publication months refused');}}
 const records=structuredClone(plan.records),json=JSON.stringify(records),values=[json,expectedRecords,identity.storeId];
 const statements=[
  {label:'begin',text:'BEGIN',values:[]},
  {label:'bounded-lock',text:"SET LOCAL lock_timeout='3s'",values:[]},
  {label:'bounded-statement',text:"SET LOCAL statement_timeout='30s'",values:[]},
  {label:'single-company-lock',text:"SELECT pg_advisory_xact_lock(hashtextextended($1,0))",values:['supplemental-publication-v1:'+identity.storeId]},
  {label:'exact-baseline-preflight',text:`WITH incoming AS (${incoming}) SELECT 1/(CASE WHEN (SELECT count(*) FROM incoming)=$2 AND NOT EXISTS(SELECT 1 FROM incoming i WHERE i.store_id<>$3::uuid OR i.invalidated) AND NOT EXISTS(SELECT 1 FROM incoming i JOIN finance_review_supplement_v1.snapshots t ON ${sameKey} WHERE NOT (${sameRow})) THEN 1 ELSE 0 END) AS exact_baseline`,values},
  {label:'insert-or-exact-replay',text:`WITH incoming AS (${incoming}) INSERT INTO finance_review_supplement_v1.snapshots(${columns}) SELECT ${columns} FROM incoming ON CONFLICT DO NOTHING`,values:[json]},
  {label:'exact-publication-postflight',text:`WITH incoming AS (${incoming}) SELECT 1/(CASE WHEN (SELECT count(*) FROM incoming)=$2 AND NOT EXISTS(SELECT 1 FROM incoming i WHERE NOT EXISTS(SELECT 1 FROM finance_review_supplement_v1.snapshots t WHERE ${sameRow})) THEN 1 ELSE 0 END) AS exact_publication`,values:[json,expectedRecords]},
  {label:'commit',text:'COMMIT',values:[]},
 ];
 return freeze({state:'prepared-only',contract:'supplemental-publication-proposal-v1',remoteApplied:false,planHash:expectedPlanHash,expectedRecords,storeId:identity.storeId,from:plan.from,to:plan.to,recordsHash:plan.hashes.records,statements});
}
/** Read-only grants for an existing trusted server role; preserves unrelated
 * existing read-only memberships. No login/role creation or write grants. */
export function generateRestrictedSupplementReadAccess(roleName,{expectedStore}={}){
 ensure(expectedStore===identity.storeId&&typeof roleName==='string'&&/^[a-z][a-z0-9_]{1,62}$/.test(roleName)&&!roleName.startsWith('pg_')&&!['postgres','public','anon','authenticated','service_role'].includes(roleName),'Exact synthetic store and verified restricted existing role required');
 const role='"'+roleName+'"';
 const readonly=`EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('finance_review_supplement_v1','finance_history_v2','finance_v1') AND c.relkind IN('r','p','v','m','f') AND has_table_privilege('${roleName}',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')) OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname IN('finance_review_supplement_v1','finance_history_v2','finance_v1') AND has_schema_privilege('${roleName}',n.oid,'CREATE'))`;
 const publicWrites=`EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('stores','store_memberships','orders','refunds','order_line_items','overhead_entries','marketing_channel_daily_metrics','cash_balance_snapshots') AND has_table_privilege('${roleName}',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES'))`;
 const roleCapabilities=`EXISTS(SELECT 1 FROM pg_catalog.pg_roles capability_role WHERE (capability_role.rolname='${roleName}' OR pg_has_role('${roleName}',capability_role.oid,'MEMBER')) AND (capability_role.rolsuper OR capability_role.rolbypassrls OR capability_role.rolcreaterole OR capability_role.rolcreatedb OR capability_role.rolreplication OR ${readonly.replaceAll("'"+roleName+"'",'capability_role.oid')} OR ${publicWrites.replaceAll("'"+roleName+"'",'capability_role.oid')}))`;
 const browsers=`EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND (has_schema_privilege(r.oid,'finance_review_supplement_v1','USAGE,CREATE') OR has_table_privilege(r.oid,'finance_review_supplement_v1.snapshots','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')))`;
 const expectedPolicy="((store_id = 'd7500000-0000-4000-8000-000000000009'::uuid) AND (NOT invalidated) AND (EXISTS ( SELECT 1 FROM public.store_memberships m WHERE ((m.store_id = snapshots.store_id) AND (m.user_id = (NULLIF(current_setting('night_scout.profit_user_id'::text, true), ''::text))::uuid)))))".replace(/\s/g,'').replaceAll("'","''");
 const guard=`DO $supplement_read_preflight$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='${roleName}' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN RAISE EXCEPTION 'Existing restricted server role required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='finance_review_supplement_v1.snapshots'::regclass AND relrowsecurity) OR (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid='finance_review_supplement_v1.snapshots'::regclass)<>1 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='finance_review_supplement_v1.snapshots'::regclass AND polname='supplement_member_read' AND polcmd='r' AND polroles=ARRAY[0::oid] AND polpermissive AND polwithcheck IS NULL AND regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]]','','g')='${expectedPolicy}') THEN RAISE EXCEPTION 'Exact reviewed membership RLS required'; END IF;
 IF ${readonly} OR ${publicWrites} OR ${roleCapabilities} THEN RAISE EXCEPTION 'Effective source access must remain read-only'; END IF;
 IF ${browsers} THEN RAISE EXCEPTION 'Browser/default-role supplemental access must remain denied'; END IF;
 IF has_schema_privilege('${roleName}','finance_review_supplement_v1','USAGE') OR has_table_privilege('${roleName}','finance_review_supplement_v1.snapshots','SELECT') THEN RAISE EXCEPTION 'Existing supplemental access differs; preserve and review separately'; END IF;
 END $supplement_read_preflight$;`;
 const postflight=`DO $supplement_read_postflight$ BEGIN IF ${readonly} OR ${publicWrites} OR ${roleCapabilities} OR ${browsers} THEN RAISE EXCEPTION 'Supplemental read-only postflight failed'; END IF; END $supplement_read_postflight$;`;
 return freeze({state:'prepared-only',remoteApplied:false,storeId:identity.storeId,commitSql:`BEGIN;\nSET LOCAL search_path=pg_catalog;\n${guard}\nGRANT USAGE ON SCHEMA finance_review_supplement_v1 TO ${role};\nGRANT SELECT ON finance_review_supplement_v1.snapshots TO ${role};\n${postflight}\nCOMMIT;`,rollbackSql:`BEGIN;\nREVOKE SELECT ON finance_review_supplement_v1.snapshots FROM ${role};\nREVOKE USAGE ON SCHEMA finance_review_supplement_v1 FROM ${role};\nCOMMIT;`});
}

/** Explicit PostgreSQL escape-string literal: safe even when the connection has
 * standard_conforming_strings=off at initial parse time. Never use interpolation
 * of unreviewed SQL. Both apostrophes and every backslash are encoded. */
const sqlText=value=>"E'"+value.replaceAll('\\','\\\\').replaceAll("'","''")+"'";
/** Operator-only single-call rendering. Still pure: no connection or execution.
 * The exact reviewed JSON appears once; three verification phases read the same
 * transaction-local buffer. Fixed-name collisions abort rather than overwrite.
 * This is not a financial/provider writer or a generic SQL/template renderer. */
export function prepareSupplementalSingleCallSql(plan,{maxBytes=1900000,...reviewed}={}){
 ensure(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<2000000,'Single-call byte cap must be below two million bytes');
 const proposal=prepareSupplementalPublication(plan,reviewed);
 const byLabel=new Map(proposal.statements.map(statement=>[statement.label,statement]));
 const recordsJSON=byLabel.get('insert-or-exact-replay').values[0];
 const table='pg_temp.night_scout_supplement_review_buffer_v1';
 const buffered=label=>{
  const text=byLabel.get(label)?.text;ensure(typeof text==='string','Expected reviewed publication phase required');
  const rendered=text.replaceAll('$1::jsonb',`(SELECT payload FROM ${table})`).replaceAll('$3::uuid',`(SELECT store_id FROM ${table})`).replaceAll('$2',`(SELECT expected_records FROM ${table})`);
  ensure(!/\$\d/.test(rendered),'Unbound reviewed publication parameter');return rendered+';';
 };
 const sql=[
  'BEGIN;',
  byLabel.get('bounded-lock').text+';',byLabel.get('bounded-statement').text+';',
  'SET LOCAL standard_conforming_strings=on;',
  "SELECT 1/(CASE WHEN current_setting('standard_conforming_strings')='on' THEN 1 ELSE 0 END) AS exact_literal_setting;",
  `CREATE TEMP TABLE ${table}(plan_hash text NOT NULL,expected_records integer NOT NULL,store_id uuid NOT NULL,payload jsonb NOT NULL) ON COMMIT DROP;`,
  `INSERT INTO ${table}(plan_hash,expected_records,store_id,payload) VALUES(${sqlText(proposal.planHash)},${proposal.expectedRecords},${sqlText(proposal.storeId)}::uuid,${sqlText(recordsJSON)}::jsonb);`,
  `SELECT 1/(CASE WHEN (SELECT count(*) FROM ${table})=1 AND (SELECT plan_hash FROM ${table})=${sqlText(proposal.planHash)} AND (SELECT expected_records FROM ${table})=${proposal.expectedRecords} AND (SELECT store_id FROM ${table})=${sqlText(identity.storeId)}::uuid THEN 1 ELSE 0 END) AS exact_reviewed_buffer;`,
  `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(byLabel.get('single-company-lock').values[0])},0));`,
  buffered('exact-baseline-preflight'),buffered('insert-or-exact-replay'),buffered('exact-publication-postflight'),
  'COMMIT;',
 ].join('\n');
 const sqlBytes=Buffer.byteLength(sql,'utf8'),toolArgumentBytes=Buffer.byteLength(JSON.stringify({query:sql}),'utf8');
 ensure(sqlBytes<=maxBytes&&toolArgumentBytes<=maxBytes,'Reviewed single-call SQL exceeds the configured byte cap');
 return freeze({state:'prepared-only',contract:'supplemental-single-call-sql-v1',remoteApplied:false,planHash:proposal.planHash,recordsHash:proposal.recordsHash,expectedRecords:proposal.expectedRecords,storeId:proposal.storeId,from:proposal.from,to:proposal.to,sql,sqlBytes,toolArgumentBytes,maxBytes});
}
