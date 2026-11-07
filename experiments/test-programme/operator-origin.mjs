const customerHosts=new Set(['night-scout-xero-staging.onrender.com','night-scout-xero-staging.replit.app']);
export function operatorOrigin(value){
 let url;try{url=new URL(value);}catch{throw Error('Operator origin unavailable');}
 if(typeof value!=='string'||value!==url.origin||url.protocol!=='https:'||url.username||url.password||url.port||customerHosts.has(url.hostname)||!url.hostname.includes('.')||!/^[a-z0-9.-]+$/.test(url.hostname)||/^[0-9.]+$/.test(url.hostname)||/\.(local|internal|localhost)$/.test(url.hostname))throw Error('Operator origin unavailable');
 return url.origin;
}
export function operatorCallback(value){return `${operatorOrigin(value)}/api/xero/test-writer/callback`;}
