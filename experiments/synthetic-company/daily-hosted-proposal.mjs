/** Generate an unapplied staging adaptation; no database client or execution path. */
import {createHash} from 'node:crypto';
import {date} from './generator.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {GAP_CAPABILITY_SOURCE_SHA256} from './daily-gap-proposal.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function prepareHostedDailyProposal({capabilitySql,expectedThrough,expectedSeals=24}={}){
 if(typeof capabilitySql!=='string'||sha(capabilitySql)!==GAP_CAPABILITY_SOURCE_SHA256)throw Error('Exact independently reviewed capability source required');
 date(expectedThrough);
 if(expectedThrough<'2024-11-01'||!Number.isSafeInteger(expectedSeals)||expectedSeals<0||expectedSeals>120)throw Error('Exact bounded baseline expectation required');
 const marker='BEGIN;\nDO $$BEGIN';
 if(capabilitySql.split(marker).length!==2)throw Error('Exact installation boundary required');
 const guard=`BEGIN;
DO $hosted_preflight$ BEGIN
 IF current_setting('server_version_num')::int<170000 OR current_setting('server_version_num')::int>=180000 THEN RAISE EXCEPTION 'Reviewed PostgreSQL 17 target required';END IF;
 IF NOT EXISTS(SELECT 1 FROM finance_history_v2.contracts WHERE store_id='${identity.storeId}'::uuid AND profile='uk-gifts-v2' AND edition='synthetic-history-v2-2026-11' AND date_from='2024-11-01'::date AND through_day='${expectedThrough}'::date AND currency='GBP' AND timezone='Europe/London') THEN RAISE EXCEPTION 'Exact isolated staging contract/horizon required';END IF;
 IF (SELECT count(*) FROM finance_history_v2.seals WHERE store_id='${identity.storeId}'::uuid)<>${expectedSeals} THEN RAISE EXCEPTION 'Reviewed closed-month seal count differs';END IF;
 IF EXISTS(SELECT 1 FROM finance_history_v2.invalidations i JOIN finance_history_v2.seals s USING(snapshot_id) WHERE s.store_id='${identity.storeId}'::uuid) THEN RAISE EXCEPTION 'Invalidated prior evidence requires separate review';END IF;
END $hosted_preflight$;
DO $$BEGIN`;
 const sql='-- UNAPPLIED STAGING INSTALLATION PROPOSAL. Explicit target/access approval required.\n-- Baseline fingerprints and all independently pinned metadata must also pass the private review.\n'+capabilitySql.slice(capabilitySql.indexOf('BEGIN;')).replace(marker,()=>guard);
 return {status:'staging-installation-proposal-only',activationAllowed:false,remoteApplied:false,expectedThrough,expectedSeals,sourceSha256:GAP_CAPABILITY_SOURCE_SHA256,sql,sqlSha256:sha(sql)};
}
