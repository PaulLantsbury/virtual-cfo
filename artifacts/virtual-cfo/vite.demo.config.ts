import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
const root=import.meta.dirname;
export default defineConfig({
 root,base:'/',publicDir:false,
 plugins:[react(),tailwindcss(),{
  name:'demo-data-boundary',
  generateBundle(_options,bundle){
   const modules=[...this.getModuleIds()];
   const forbidden=modules.filter(id=>/\/src\/lib\/(supabase|auth\/AuthProvider|analytics\/|.*Api\.)|\/node_modules\/.*supabase|\/experiments\/|\/api-server\//i.test(id));
   if(forbidden.length)throw new Error(`Demo imported live infrastructure: ${forbidden.join(', ')}`);
   for(const [name,item] of Object.entries(bundle)){if(item.type==='asset'&&name==='demo.html'){delete bundle[name];item.fileName='index.html';bundle['index.html']=item;}}
   this.emitFile({type:'asset',fileName:'demo-boundary.json',source:JSON.stringify({data:'fictional-sample-only',providerConnections:false,customerAuthentication:false,modules:modules.filter(id=>id.includes('/src/')).map(id=>id.split('/src/')[1]).sort()},null,2)});
  }
 }],
 resolve:{alias:[
  {find:'@/components/layout/AppLayout',replacement:path.join(root,'src/demo/DemoLayout.tsx')},
  {find:'@/lib/auth/AuthProvider',replacement:path.join(root,'src/demo/DemoAuth.ts')},
  {find:'@',replacement:path.join(root,'src')},
 ],dedupe:['react','react-dom']},
 build:{outDir:path.join(root,'dist/demo'),emptyOutDir:true,rollupOptions:{input:path.join(root,'demo.html')}}
});
