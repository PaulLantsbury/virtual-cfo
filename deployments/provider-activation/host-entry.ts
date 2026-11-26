import {createProviderApiHost} from './host-app.ts';
const port=Number(process.env.PORT);
if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Provider API port unavailable');
let host:Awaited<ReturnType<typeof createProviderApiHost>>;
try{host=await createProviderApiHost(process.env);}catch{console.error('Provider API startup unavailable');process.exit(1);}
const server=host.app.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({state:host.enabled?'ready':'disabled',capability:'provider-api'})));
server.on('error',()=>{console.error('Provider API listener unavailable');void host.close().finally(()=>process.exit(1));});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
 const timeout=setTimeout(()=>process.exit(1),10000);timeout.unref();
 server.close(()=>{void host.close().finally(()=>{clearTimeout(timeout);process.exit(0);});});
});
