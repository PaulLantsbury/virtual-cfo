import {readFileSync} from 'node:fs';
export const verificationQuery=readFileSync(new URL('./verify-test-ingestion.sql',import.meta.url),'utf8');
const failure='Shopify test-ingestion verification unavailable; no provider call, write or retry was attempted.';
/** Existing authorised operator connection only. This opens no credentials/network/provider
 * and changes no grants. Read-only snapshot always rolls back; output contains no source IDs.
 */
export async function verifyTestIngestion(client){
 try{
  if(typeof client?.query!=='function')throw Error();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='15s'");
  const rows=(await client.query(verificationQuery)).rows;
  if(rows?.length!==1||rows[0]?.result?.event!=='shopify_test_ingestion_verification')throw Error();
  await client.query('ROLLBACK');
  return rows[0].result;
 }catch{
  try{await client?.query('ROLLBACK');}catch{}
  throw Error(failure);
 }
}
