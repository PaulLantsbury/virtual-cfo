/** Trusted server selection only. No grants, writes, connection setup or client-selected source basis. */
import {validateStagingSnapshot} from '../synthetic-company/staging-snapshot-contract.mjs';
import {profitEvidenceDigest} from './profit-evidence-reader.mjs';
export const TRUSTED_PROFIT_FORMULA='night-scout-v11-2026-10-30';
export const TRUSTED_SYNTHETIC_POLICY=Object.freeze({storeId:'d7500000-0000-4000-8000-000000000009',sourceBasis:'synthetic-local',profileVersion:'uk-gifts-v2',formulaVersion:TRUSTED_PROFIT_FORMULA});
const unavailable=()=>({state:'unavailable',metadata:null,reason:'Verified reporting snapshot metadata is unavailable'});
export function trustedSnapshotUnavailable(){return unavailable();}
/** Same repeatable-read transaction and verified source result as the profit reader. */
export async function readTrustedProfitSnapshot(tx,{scope,version,salesRevision,report,readError,policy}={}) {
 if(!policy||policy.storeId!==scope.storeId||!['synthetic-local','shopify-operational'].includes(policy.sourceBasis)
   ||policy.formulaVersion!==TRUSTED_PROFIT_FORMULA
   ||(policy.sourceBasis==='synthetic-local'&&policy.profileVersion!=='uk-gifts-v2'))return unavailable();
 // A matching row is insufficient when actual source or cost evidence no longer validates.
 if(!salesRevision||!version?.source_manifest||version.source_manifest.salesRevision!==salesRevision||!report?.sales)return unavailable();
 const {rows:stores}=await tx.query('SELECT currency_code,timezone FROM public.stores WHERE id=$1',[scope.storeId]);
 if(stores.length!==1||stores[0].currency_code!==scope.currency||stores[0].timezone!=='Europe/London')return unavailable();
 const {rows}=await tx.query(`SELECT s.snapshot_id,s.store_id,s.date_from::text,s.date_to::text,s.currency,s.timezone,s.source_basis,
 s.formula_version,s.contract_version,s.sales_revision,s.profit_version_id,
 to_char(s.source_as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') source_as_of,
 to_char(s.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') observed_at,
 s.manifest_digest,s.profile_version,s.coverage,(s.source_as_of<=transaction_timestamp() AND s.observed_at<=transaction_timestamp()) clock_valid,NULL::uuid invalidated_by,NULL::uuid superseded_by
 FROM finance_v1.reporting_snapshots s
 LEFT JOIN finance_v1.reporting_snapshot_invalidations i ON i.snapshot_id=s.snapshot_id AND i.store_id=s.store_id
 WHERE s.store_id=$1 AND s.date_from=$2::date AND s.date_to=$3::date AND s.currency=$4
 AND s.profit_version_id=$5 AND i.snapshot_id IS NULL
 ORDER BY s.snapshot_id LIMIT 2`,[scope.storeId,scope.from,scope.to,scope.currency,version.id]);
 if(rows.some(row=>(row.coverage?.costs==='complete'&&(readError||report.state!=='complete'))||row.clock_valid!==true||row.manifest_digest!==profitEvidenceDigest(version.source_manifest)
   ||row.profile_version!==(policy.sourceBasis==='synthetic-local'?policy.profileVersion:null)))return unavailable();
 const selected=validateStagingSnapshot({authorised:true,refreshState:'current',
  expected:{store_id:scope.storeId,date_from:scope.from,date_to:scope.to,currency:scope.currency,timezone:stores[0].timezone,
   source_basis:policy.sourceBasis,formula_version:policy.formulaVersion,contract_version:1,sales_revision:salesRevision,profit_version_id:version.id},rows});
 if(!selected.metadata)return unavailable();
 return {...selected,verification:'canonical-current',metadata:{...selected.metadata,freshnessBasis:'canonical-source-revision',providerFreshness:'unverified',coverageReference:`reporting-snapshot:${selected.metadata.snapshotId}`}};
}
