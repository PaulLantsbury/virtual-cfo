import { decryptStagingEnvelope, encryptStagingEnvelope, refreshXeroCredential } from '../../deployments/nightly-staging/xero-refresh-runtime.mjs';
import {validWriterScopes} from './writer-oauth-scopes.mjs';
export {validWriterScopes} from './writer-oauth-scopes.mjs';
function bytes(value){if(value instanceof Uint8Array)return Buffer.from(value);if(typeof value==='string' && /^\\x[0-9a-f]+$/i.test(value))return Buffer.from(value.slice(2),'hex');throw new Error('Invalid envelope bytes');}


// Separate encrypted writer envelope. Existing read-worker credentials are never read.
export async function withRefreshedXeroWriter({pool,programmeKey,target,masterKey,keyVersion,clientId,clientSecret,fetchImpl=fetch,consume}) {
  let plain;
  const rpc=async(sql,args)=>(await pool.query(sql,args)).rows;
  try {
    if (typeof masterKey!=='string' || masterKey.length<32 || !clientId || !clientSecret || !keyVersion) throw new Error('Invalid private writer config');
    const rows=await rpc('SELECT * FROM staging_test_programme.claim_writer_envelope($1,$2)',[programmeKey,target]);
    if (rows.length!==1) throw new Error('Writer refresh claim unavailable');
    const r=rows[0];
    if (r.tenant_id!==target || r.key_version!==keyVersion || r.algorithm!=='AES-256-GCM' || !Number.isInteger(r.version)) throw new Error('Invalid writer envelope');
    const context={connectionId:r.connection_id,tenantId:r.tenant_id,keyVersion:r.key_version,ciphertext:bytes(r.ciphertext),encryptedDek:bytes(r.encrypted_dek)};
    plain=decryptStagingEnvelope(masterKey,context);
    const boundedFetch=async(url,opts)=>{
      if(url!=='https://identity.xero.com/connect/token') throw new Error('Invalid OAuth endpoint');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try {
        const response=await fetchImpl(url,{...opts,signal:controller.signal,redirect:'error'});
        const reader=response.body?.getReader(); if(!reader) throw new Error('Invalid OAuth response');
        const chunks=[];let n=0;
        while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>32768){await reader.cancel();throw new Error('OAuth response limit');}chunks.push(Buffer.from(value));}
        return new Response(Buffer.concat(chunks,n),{status:response.status});
      } finally{clearTimeout(timer);}
    };
    const fresh=await refreshXeroCredential({refreshToken:plain,clientId,clientSecret,fetchImpl:boundedFetch});
    const next=encryptStagingEnvelope(masterKey,context,fresh.refreshToken);
    const rotated=await rpc('SELECT staging_test_programme.rotate_writer_envelope($1,$2,$3,$4,$5,$6) AS ok',[programmeKey,target,r.refresh_claim,r.version,next.ciphertext,next.encryptedDek]);
    if(rotated.length!==1 || rotated[0].ok!==true) throw new Error('Writer rotation unavailable');
    // Save rotated material before checking scopes: never discard a valid new refresh token.
    if(!validWriterScopes(fresh.scope)) throw new Error('Writer scope unavailable');
    return await consume(fresh.accessToken);
  } catch {
    await rpc('SELECT staging_test_programme.stop_programme($1)',[programmeKey]).catch(()=>{});
    throw new Error('XERO_TEST_WRITER_UNAVAILABLE');
  } finally{plain?.fill(0);}
}
