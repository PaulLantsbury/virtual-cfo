import {dispatchRenderShopify} from './render-shopify-gate.mjs';
// No arguments, environment clock or timezone override; collector imports are lazy.
try{
 if(process.argv.length!==2)throw Error('Arguments not supported');
 const receipt=await dispatchRenderShopify({now:new Date(),env:process.env,loadCollector:()=>import('../../experiments/shopify/cloud-nightly.mjs')});
 process.stdout.write(`${JSON.stringify(receipt)}\n`);
}catch{
 process.stderr.write('Shopify staging reader unavailable; inspect durable history before retrying\n');
 process.exitCode=1;
}
