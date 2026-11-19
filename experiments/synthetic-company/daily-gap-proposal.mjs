/** Offline fixed-range gap proposal. No connection, clock override, caller payload or execution. */
import {createHash} from 'node:crypto';
import {addDays,date} from './generator.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
export const GAP_CAPABILITY_SOURCE_SHA256='5032e5afe139bc870aacec1ccd85d23e25c421cdf9ab350861fe1798cda5afb1';
const hash=value=>createHash('sha256').update(value).digest('hex');
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
const hex=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const keys=(value,list)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===list.slice().sort().join();
function replacement(source,old,next){ensure(source.split(old).length===2,'Exact audited gap derivation marker required');return source.replace(old,next);}
export function validateGapApproval(approval){
 ensure(keys(approval,['storeId','initialThrough','firstDay','lastDay','expiresAt','reviewRef','days']),'Exact gap approval fields required');
 ensure(approval.storeId===identity.storeId,'Fixed isolated synthetic company required');
 for(const key of ['initialThrough','firstDay','lastDay'])date(approval[key]);
 ensure(approval.initialThrough>='2024-11-01'&&approval.firstDay===addDays(approval.initialThrough,1)&&approval.lastDay>=approval.firstDay,'Fixed contiguous gap range required');
 ensure(typeof approval.expiresAt==='string'&&Number.isFinite(Date.parse(approval.expiresAt))&&new Date(approval.expiresAt).toISOString()===approval.expiresAt,'Exact finite expiry required');
 ensure(typeof approval.reviewRef==='string'&&/^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,199}$/.test(approval.reviewRef),'Bounded private review reference required');
 ensure(Array.isArray(approval.days)&&approval.days.length>0&&approval.days.length<=31,'One to 31 explicitly reviewed days required');
 let next=approval.firstDay;
 for(const row of approval.days){ensure(keys(row,['day','materialSha256','sourceHash','reviewRef'])&&row.day===next&&hex(row.materialSha256)&&hex(row.sourceHash)&&typeof row.reviewRef==='string'&&/^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,199}$/.test(row.reviewRef),'Exact ordered day material/hash/reference required');next=addDays(next,1);}
 ensure(addDays(next,-1)===approval.lastDay,'Exact reviewed gap coverage required');
 return structuredClone(approval);
}
export function prepareDailyGapProposal({capabilitySql,approval}={}){
 ensure(typeof capabilitySql==='string'&&hash(capabilitySql)===GAP_CAPABILITY_SOURCE_SHA256,'Independently pinned daily capability source required');
 const a=validateGapApproval(approval);
 const start='CREATE FUNCTION finance_daily_v1.append_completed_day(expected_through date,requested_day date) RETURNS jsonb';
 const end='\nALTER FUNCTION finance_daily_v1.validate_reviewed_day(date,jsonb) OWNER TO daily_capability_owner;';
 ensure(capabilitySql.split(start).length===2&&capabilitySql.split(end).length===2,'Exact append function boundaries required');
 let append=capabilitySql.slice(capabilitySql.indexOf(start),capabilitySql.indexOf(end));
 append=replacement(append,start,'CREATE FUNCTION finance_daily_gap_v1.append_reviewed_gap_day(expected_through date,requested_day date) RETURNS jsonb');
 append=replacement(append," IF NOT p.enabled THEN RAISE EXCEPTION 'Daily capability is disabled';END IF;"," PERFORM finance_daily_gap_v1.assert_approved_day(expected_through,requested_day);");
 append=replacement(append," IF requested_day<>cutoff OR (clock AT TIME ZONE 'Europe/London')::time NOT BETWEEN time '02:00:00' AND time '02:14:59.999999' THEN RAISE EXCEPTION 'Yesterday and reviewed London window required; gaps need separate review';END IF;"," PERFORM finance_daily_gap_v1.assert_approved_day(expected_through,requested_day);");
 const sql=`-- PRIVATE FIXED-RANGE PROPOSAL. Installation/enablement/writes require separate exact approval.
-- The original daily function is never replaced. This temporary authority must be retired.
BEGIN;
DO $fresh$ BEGIN
 IF to_regnamespace('finance_daily_gap_v1') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='daily_gap_invoker') THEN RAISE EXCEPTION 'Fresh temporary gap namespace and role required';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='daily_capability_owner' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT rolcreaterole AND NOT rolcreatedb) THEN RAISE EXCEPTION 'Existing restricted daily owner required';END IF;
END $fresh$;
CREATE ROLE daily_gap_invoker NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE SCHEMA finance_daily_gap_v1;
REVOKE ALL ON SCHEMA finance_daily_gap_v1 FROM PUBLIC;
GRANT USAGE ON SCHEMA finance_daily_gap_v1 TO daily_capability_owner,daily_gap_invoker;
CREATE TABLE finance_daily_gap_v1.approval(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),store_id uuid NOT NULL,initial_through date NOT NULL,first_day date NOT NULL,last_day date NOT NULL,expires_at timestamptz NOT NULL,review_ref text NOT NULL,days jsonb NOT NULL,enabled boolean NOT NULL DEFAULT false,CHECK(first_day=initial_through+1 AND last_day>=first_day AND last_day-first_day<31));
INSERT INTO finance_daily_gap_v1.approval VALUES(true,${lit(a.storeId)}::uuid,${lit(a.initialThrough)}::date,${lit(a.firstDay)}::date,${lit(a.lastDay)}::date,${lit(a.expiresAt)}::timestamptz,${lit(a.reviewRef)},${lit(JSON.stringify(a.days))}::jsonb,false);
ALTER TABLE finance_daily_gap_v1.approval ENABLE ROW LEVEL SECURITY;
CREATE POLICY gap_owner_read ON finance_daily_gap_v1.approval FOR SELECT TO daily_capability_owner USING(true);
GRANT SELECT ON finance_daily_gap_v1.approval TO daily_capability_owner;
CREATE FUNCTION finance_daily_gap_v1.guard_approval() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$BEGIN
 IF TG_OP<>'UPDATE' OR (to_jsonb(NEW)-'enabled')<>(to_jsonb(OLD)-'enabled') THEN RAISE EXCEPTION 'Gap approval scope is immutable';END IF;RETURN NEW;
END$$;
CREATE TRIGGER gap_fixed BEFORE UPDATE OR DELETE ON finance_daily_gap_v1.approval FOR EACH ROW EXECUTE FUNCTION finance_daily_gap_v1.guard_approval();
CREATE TRIGGER gap_no_truncate BEFORE TRUNCATE ON finance_daily_gap_v1.approval FOR EACH STATEMENT EXECUTE FUNCTION finance_daily_v1.guard_reviewed_material();
CREATE FUNCTION finance_daily_gap_v1.assert_approved_day(expected_through date,requested_day date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a finance_daily_gap_v1.approval%ROWTYPE;p finance_daily_v1.programme%ROWTYPE;clock timestamptz;BEGIN
 SELECT * INTO STRICT a FROM finance_daily_gap_v1.approval WHERE singleton;
 SELECT * INTO STRICT p FROM finance_daily_v1.programme WHERE singleton;
 clock=pg_catalog.clock_timestamp();
 IF current_setting('transaction_isolation')<>'serializable' OR NOT a.enabled OR clock>=a.expires_at OR a.last_day>=(clock AT TIME ZONE 'Europe/London')::date OR requested_day<a.first_day OR requested_day>a.last_day OR expected_through<>requested_day-1 OR a.store_id<>p.store_id OR a.initial_through<>p.initial_through OR a.last_day>p.ceiling OR p.enabled THEN RAISE EXCEPTION 'Explicit completed unexpired gap approval required; ordinary programme stays disabled';END IF;
END$$;
${append}
CREATE FUNCTION finance_daily_gap_v1.publish_approved_gap() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='5s' AS $$
DECLARE a finance_daily_gap_v1.approval%ROWTYPE;p finance_daily_v1.programme%ROWTYPE;through_day date;day date;r jsonb;m jsonb;mh text;rr text;results jsonb:='[]'::jsonb;replay boolean;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('synthetic-reviewed-daily-programme',0));
 SELECT * INTO STRICT a FROM finance_daily_gap_v1.approval WHERE singleton;
 SELECT * INTO STRICT p FROM finance_daily_v1.programme WHERE singleton;
 PERFORM finance_daily_gap_v1.assert_approved_day(a.initial_through,a.first_day);
 PERFORM pg_advisory_xact_lock(hashtextextended('history-v2:'||p.store_id::text,0));
 SELECT t.through_day INTO STRICT through_day FROM finance_history_v2.contracts t WHERE store_id=p.store_id FOR UPDATE;
 IF through_day<>a.initial_through AND through_day<>a.last_day THEN RAISE EXCEPTION 'Gap requires exact initial horizon or full reconciled replay';END IF;
 IF jsonb_typeof(a.days)<>'array' OR jsonb_array_length(a.days)<>a.last_day-a.first_day+1 THEN RAISE EXCEPTION 'Exact finite day manifest required';END IF;
 day=a.first_day;
 FOR r IN SELECT value FROM jsonb_array_elements(a.days) LOOP
  IF r->>'day' IS DISTINCT FROM day::text THEN RAISE EXCEPTION 'Gap day sequence differs';END IF;
  SELECT rd.material,rd.material_sha256,rd.review_ref INTO m,mh,rr FROM finance_daily_v1.reviewed_days rd WHERE rd.day=(r->>'day')::date;
  IF m IS NULL OR mh IS DISTINCT FROM r->>'materialSha256' OR mh IS DISTINCT FROM encode(sha256(convert_to(m::text,'UTF8')),'hex') OR rr IS DISTINCT FROM r->>'reviewRef' OR m->>'sourceHash' IS DISTINCT FROM r->>'sourceHash' THEN RAISE EXCEPTION 'Gap reviewed material/hash/reference differs';END IF;
  PERFORM finance_daily_v1.validate_reviewed_day(day,m);
  day=day+1;
 END LOOP;
 replay=through_day=a.last_day;
 FOR day IN SELECT a.first_day+g FROM generate_series(0,a.last_day-a.first_day) g LOOP
  IF replay THEN results=results||jsonb_build_array(finance_daily_v1.inspect_daily_receipt(day)||jsonb_build_object('replay',true,'inserted',0));
  ELSE results=results||jsonb_build_array(finance_daily_gap_v1.append_reviewed_gap_day(day-1,day));END IF;
 END LOOP;
 SELECT t.through_day INTO STRICT through_day FROM finance_history_v2.contracts t WHERE store_id=p.store_id;
 IF through_day<>a.last_day THEN RAISE EXCEPTION 'Gap final horizon differs';END IF;
 RETURN jsonb_build_object('state','gap-verified-in-transaction','reviewRef',a.review_ref,'from',a.first_day,'to',a.last_day,'replay',replay,'days',results,'verifiedAt',pg_catalog.clock_timestamp());
END$$;
ALTER FUNCTION finance_daily_gap_v1.guard_approval() OWNER TO daily_capability_reviewer;
ALTER FUNCTION finance_daily_gap_v1.assert_approved_day(date,date) OWNER TO daily_capability_owner;
ALTER FUNCTION finance_daily_gap_v1.append_reviewed_gap_day(date,date) OWNER TO daily_capability_owner;
ALTER FUNCTION finance_daily_gap_v1.publish_approved_gap() OWNER TO daily_capability_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_daily_gap_v1 FROM PUBLIC,daily_gap_invoker;
GRANT EXECUTE ON FUNCTION finance_daily_gap_v1.publish_approved_gap() TO daily_gap_invoker;
REVOKE ALL ON ALL TABLES IN SCHEMA finance_daily_gap_v1 FROM PUBLIC,daily_gap_invoker;
ALTER TABLE finance_daily_gap_v1.approval OWNER TO daily_capability_reviewer;
ALTER SCHEMA finance_daily_gap_v1 OWNER TO daily_capability_reviewer;
COMMIT;
`;
 const retirementSql=`-- Separate authority-retirement proposal, only after committed bridge acceptance.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('synthetic-reviewed-daily-programme',0));
DO $retire$ DECLARE d date;r jsonb;BEGIN
 IF NOT EXISTS(SELECT 1 FROM finance_daily_gap_v1.approval WHERE singleton AND store_id=${lit(a.storeId)}::uuid AND initial_through=${lit(a.initialThrough)}::date AND first_day=${lit(a.firstDay)}::date AND last_day=${lit(a.lastDay)}::date AND review_ref=${lit(a.reviewRef)} AND days=${lit(JSON.stringify(a.days))}::jsonb AND expires_at=${lit(a.expiresAt)}::timestamptz) THEN RAISE EXCEPTION 'Exact gap approval required before retirement';END IF;
 IF NOT EXISTS(SELECT 1 FROM finance_history_v2.contracts WHERE store_id=${lit(a.storeId)}::uuid AND through_day>=${lit(a.lastDay)}::date) THEN RAISE EXCEPTION 'Committed gap horizon required before retirement';END IF;
 FOR d IN SELECT ${lit(a.firstDay)}::date+g FROM generate_series(0,${a.days.length-1}) g LOOP r=finance_daily_v1.inspect_daily_receipt(d);IF r->>'state' IS DISTINCT FROM 'committed-reconciled' THEN RAISE EXCEPTION 'Committed gap receipt required before retirement';END IF;END LOOP;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='daily_gap_invoker')) THEN RAISE EXCEPTION 'Revoke separately approved gap login membership before retirement';END IF;
END $retire$;
DROP FUNCTION finance_daily_gap_v1.publish_approved_gap() RESTRICT;
DROP FUNCTION finance_daily_gap_v1.append_reviewed_gap_day(date,date) RESTRICT;
DROP FUNCTION finance_daily_gap_v1.assert_approved_day(date,date) RESTRICT;
DROP TRIGGER gap_fixed ON finance_daily_gap_v1.approval;
DROP TRIGGER gap_no_truncate ON finance_daily_gap_v1.approval;
DROP FUNCTION finance_daily_gap_v1.guard_approval() RESTRICT;
DROP TABLE finance_daily_gap_v1.approval RESTRICT;
DROP SCHEMA finance_daily_gap_v1 RESTRICT;
DROP ROLE daily_gap_invoker;
COMMIT;
`;
 return {status:'private-fixed-gap-proposal-only',remoteApplied:false,activationAllowed:false,approval:a,capabilitySourceSha256:GAP_CAPABILITY_SOURCE_SHA256,sql,sqlSha256:hash(sql),retirementSql,retirementSha256:hash(retirementSql),limitations:['Installation is disabled; separate exact installation, material, membership, enablement and write approval required.','Publisher requires one caller SERIALIZABLE transaction and exact finite completed range; it is not a catch-up scheduler.','The normal yesterday/window capability is unchanged.','The transaction result is not a commit acknowledgement; inspect ordinary durable receipts independently after commit or uncertain outcome.','Temporary gap authority blocks the ordinary strict catalogue preflight until separately retired; permanent financial/publication receipts are retained.']};
}
