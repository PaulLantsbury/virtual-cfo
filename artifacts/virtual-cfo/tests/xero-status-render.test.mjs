import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));
const ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {XERO_MAPPING_CATEGORIES}=await import('../src/lib/xeroStagingDiscovery.ts');
const {xeroMerchantReadinessView}=await import('../src/lib/xeroMerchantReadiness.ts');
// Render the real component JSX and branches; substitute only external hooks/readers.
async function load(name){
 const source=(await readFile(new URL(`../src/components/${name}.tsx`,import.meta.url),'utf8')).replace(/^import .*?;\s*$/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const injected=`const {React,useEffect,useState,useQuery,useQueryClient,useActiveStore,xeroMerchantReadinessView,XERO_MAPPING_CATEGORIES,SavedXeroMappingReview}=globalThis.__xeroRenderDependencies;\n`;
 return (await import('data:text/javascript;base64,'+Buffer.from(injected+js).toString('base64')))[name];
}
let query;
globalThis.__xeroRenderDependencies={React,useEffect:React.useEffect,useState:React.useState,useQuery:()=>query,useQueryClient:()=>({}),useActiveStore:()=> 'store-a',xeroMerchantReadinessView,XERO_MAPPING_CATEGORIES,SavedXeroMappingReview:()=>React.createElement('p',null,'Saved mapping review')};
const Evidence=await load('XeroMerchantEvidenceStatus'),Discovery=await load('XeroStagingDiscovery');
const data={storeId:'store-a',connection:{status:'active',mappingReviewRequired:false},evidenceState:'ready',evidenceRetrievedAt:'2026-11-21T00:00:00Z'};
const render=(Component,state)=>{query={data,refetch:()=>{},isPending:false,isFetching:false,isError:false,isSuccess:true,...state};return renderToStaticMarkup(React.createElement(Component));};
test('failed recheck with retained active metadata exposes retry, never saved/positive',()=>{
 const discovery=render(Discovery,{isError:true,isSuccess:false});
 assert.match(discovery,/Xero connection status unavailable/);assert.match(discovery,/Check connection again/);assert.doesNotMatch(discovery,/Xero connection saved|Saved mapping review|emerald/);
 const evidence=render(Evidence,{isError:true,isSuccess:false});
 assert.match(evidence,/Xero accounting evidence is unavailable/);assert.match(evidence,/Check again/);assert.doesNotMatch(evidence,/supported Xero snapshot|emerald/);
});
test('initial pending and background recheck show checking without green saved evidence',()=>{
 for(const state of [{data:undefined,isPending:true,isSuccess:false},{isFetching:true}]){
  const discovery=render(Discovery,state),evidence=render(Evidence,state);
  assert.match(discovery,/Checking Xero connection/);assert.match(evidence,/Checking Xero accounting evidence/);
  assert.doesNotMatch(discovery+evidence,/Xero connection saved|supported Xero snapshot|emerald/);
 }
});
test('successful current status retains saved connection and dated supported evidence',()=>{
 assert.match(render(Discovery,{}),/Xero connection saved/);
 assert.match(render(Evidence,{}),/supported Xero snapshot is saved/);
});
test('saved active connection with a mapping review flag is amber and does not claim current owner confirmation',()=>{
 const html=render(Discovery,{data:{...data,connection:{...data.connection,mappingReviewRequired:true}}});
 assert.match(html,/Saved Xero mapping needs review/);assert.match(html,/requires owner review/);assert.match(html,/amber/);assert.doesNotMatch(html,/owner-confirmed mapping|emerald/);
});
delete globalThis.__xeroRenderDependencies;
