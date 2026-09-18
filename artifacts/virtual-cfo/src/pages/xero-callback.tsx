import {useEffect,useState} from 'react';
export default function XeroCallback(){
 const [message,setMessage]=useState('Checking the local authorisation response…');
 useEffect(()=>{const p=new URLSearchParams(location.search),code=p.get('code'),state=p.get('state');
  if(!code||!state){setMessage('Xero authorisation was not completed. You can close this page.');return;}
  fetch('/api/xero/callback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,state})}).then(async r=>r.ok?setMessage('Authorisation was checked locally. No Xero token or accounting data was retained.'):setMessage('The local authorisation check was refused. You can close this page.')).catch(()=>setMessage('The local Xero service is unavailable. You can close this page.'));
 },[]);
 return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-lg text-center space-y-3"><h1 className="text-xl font-semibold">Night Scout Xero test</h1><p>{message}</p></section></main>;
}
