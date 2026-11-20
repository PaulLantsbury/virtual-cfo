import {useAuth} from '@/lib/auth/AuthProvider';
import {VisualPlanWorkspace} from './plan-visual';

export default function PlanPage(){
 const auth=useAuth();
 const legacyScope=auth.status==='ready'&&auth.userId&&auth.storeId
  ? 'night-scout:plan:v1:'+auth.userId+':'+auth.storeId : null;
 const scope=legacyScope?legacyScope.replace(':v1:',':monthly-v2:'):null;
 return <VisualPlanWorkspace key={scope??'unavailable'} legacyScope={legacyScope} scope={scope}/>;
}
