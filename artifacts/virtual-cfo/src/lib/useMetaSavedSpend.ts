import {useLayoutEffect,useMemo,useSyncExternalStore} from 'react';
import {useAuth} from './auth/AuthProvider';
import {createMetaSpendDisplayController,metaSpendScopeKey,validMetaSpendScope} from './metaSpendDisplay';

export function useMetaSavedSpend(from:string,to:string){
 const auth=useAuth(),controller=useMemo(()=>createMetaSpendDisplayController(),[]);
 const scope={userId:auth.userId??'',storeId:auth.storeId??'',revision:auth.revision,from,to};
 const key=metaSpendScopeKey(scope),authorized=auth.status==='ready';
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 useLayoutEffect(()=>{controller.clear();return()=>controller.clear();},[controller,key,authorized]);
 const current=authorized&&state.scopeKey===key?state:{status:'idle' as const,scopeKey:key};
 return {state:current,canLoad:authorized&&validMetaSpendScope(scope),clear:controller.clear,load:()=>{if(authorized&&validMetaSpendScope(scope))return controller.load(scope);return undefined;}};
}
