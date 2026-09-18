import {useEffect,useState} from 'react';
export default function XeroCallback(){
 const [message,setMessage]=useState('Checking the local authorisation response…');
 useEffect(()=>{const p=new URLSearchParams(location.search),code=p.get('code'),state=p.get('state');
  if(!code||!state){setMessage('Xero authorisation was not completed. You can close this page.');return;}
  fetch('http://localhost:4002/api/xero/callback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,state})}).then(async r=>{if(!r.ok){setMessage('The local Xero snapshot was unavailable. You can close this page.');return;}const result=await r.json();const a=result.accounting;if(!a?.available){setMessage('The fixed-date Xero reports were read, but the selected account values were unavailable. No token, raw report or inferred value was retained.');return;}const pounds=(minor:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(minor/100);setMessage(`Read-only test complete: revenue ${pounds(a.revenue)}; processing fees ${pounds(a.processingFee)}; advertising ${pounds(a.advertising)}; software ${pounds(a.software)}; included cash ${pounds(a.includedCash)}. No token or raw report was retained.`);}).catch(()=>setMessage('The local Xero service is unavailable. You can close this page.'));
 },[]);
 return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-lg text-center space-y-3"><h1 className="text-xl font-semibold">Night Scout Xero test</h1><p>{message}</p></section></main>;
}
