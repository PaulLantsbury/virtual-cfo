import {useLayoutEffect,useMemo,useSyncExternalStore} from 'react';
import {useAuth} from './auth/AuthProvider';
import {supabase} from './supabase';
import {createGoogleController,googleContextEvent,googleScopeKey,type GooglePorts,type GoogleScope,type GoogleUiState} from './googleAdsUi';
export function invalidateGoogleAdsViews(){window.dispatchEvent(new Event(googleContextEvent));try{localStorage.setItem(googleContextEvent,String(Date.now()));}catch{/* same-tab invalidation still works; focus always clears */}}
export function useGoogleAdsUi<T>(extra=''){
 const auth=useAuth(),controller=useMemo(()=>createGoogleController<T>(),[]);
 const scope:GoogleScope={userId:auth.userId??'',storeId:auth.storeId??'',revision:auth.revision},key=googleScopeKey(scope,extra),ready=auth.status==='ready';
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 useLayoutEffect(()=>{controller.clear();return controller.clear;},[controller,key,ready]);
 useLayoutEffect(()=>{const clear=controller.clear;const storage=(e:StorageEvent)=>{if(e.key===googleContextEvent)clear();};const {data:{subscription}}=supabase.auth.onAuthStateChange(clear);window.addEventListener('focus',clear);window.addEventListener(googleContextEvent,clear);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',clear);return()=>{subscription.unsubscribe();window.removeEventListener('focus',clear);window.removeEventListener(googleContextEvent,clear);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',clear);clear();};},[controller]);
 const ports:GooglePorts={fetcher:(input,init)=>fetch(input,init),session:async()=>{const {data,error}=await supabase.auth.getSession();const s=data.session;if(error||!s?.expires_at)return null;return {access_token:s.access_token,expires_at:s.expires_at,user:{id:s.user.id}};}};
 const current:GoogleUiState<T>=ready&&state.key===key?state:{status:'idle',key};
 return {state:current,ready,scope,clear:controller.clear,run:(task:(s:GoogleScope,signal:AbortSignal,p:GooglePorts)=>Promise<T>)=>ready?controller.run(key,signal=>task(scope,signal,ports)):undefined};
}
