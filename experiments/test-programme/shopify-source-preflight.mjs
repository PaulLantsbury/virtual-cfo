import {pathToFileURL} from 'node:url';
import {mintShopifyWriterToken} from './shopify-writer-token.mjs';
import {createProviderTransport} from './provider-transport.mjs';
const TARGET='pocketlaunchpad1.myshopify.com';
const CLIENT_ID='92d61376b8ed23ecf85d7f8a12c6255b';
// Authenticated source reads only. The app-boundary acknowledgement comes from the
// separately inspected Dev Dashboard installation, not from a caller's shop claim.
export async function shopifySourcePreflight({env=process.env,fetchImpl=fetch,now=()=>new Date()}={}) {
 try {
  if(env.NIGHT_SCOUT_TEST_PROGRAMME_ENABLED==='true' || env.NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF!=='bioalckltvkhlczusdvl' || env.NIGHT_SCOUT_TEST_PROGRAMME_TARGET!==TARGET || env.NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_ID!==CLIENT_ID || env.NIGHT_SCOUT_TEST_WRITER_SHOPIFY_APP_BOUNDARY_VERIFIED!=='true')throw Error();
  let scopes;
  const scopedFetch=async(url,options)=>{
   const response=await fetchImpl(url,options);
   if(!response.ok || response.redirected)throw Error();
   // The existing token helper validates the scope response, including size,
   // duplicates and allowlist. Capture only its validated handles for the receipt.
   if(url===`https://${TARGET}/admin/oauth/access_scopes.json`){
    const reader=response.body?.getReader();if(!reader)throw Error();
    const chunks=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>32768){await reader.cancel();throw Error();}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const data=JSON.parse(new TextDecoder().decode(bytes));
    scopes=Array.isArray(data.access_scopes)?data.access_scopes.map(s=>s.handle):undefined;
    return new Response(bytes,{status:response.status,headers:response.headers});
   }
   return response;
  };
  const token=await mintShopifyWriterToken({target:TARGET,clientId:CLIENT_ID,clientSecret:env.NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_SECRET,fetchImpl:scopedFetch});
  const verified=await createProviderTransport({provider:'shopify',target:TARGET,token,fetchImpl}).verifyTarget({provider:'shopify',target:TARGET,verifiedTestTarget:true});
  if(!verified || !scopes)throw Error();
  return {domain:TARGET,currency:'GBP',partnerDevelopment:true,separateWriterApp:true,sameOrganisation:true,grantedScopes:scopes.sort(),observedAt:now().toISOString()};
 }catch{throw new Error('SHOPIFY_SOURCE_PREFLIGHT_UNAVAILABLE');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{process.stdout.write(JSON.stringify(await shopifySourcePreflight())+'\n');}
 catch{process.stdout.write(JSON.stringify({event:'shopify_source_preflight',state:'unavailable'})+'\n');process.exitCode=1;}
}
