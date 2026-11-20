/** Pure shared presentation/source guards; bundled by the reporting server. No auth, client or writer dependencies. */
import {cashSupplementView} from '../../artifacts/virtual-cfo/src/lib/cashSupplement.ts';
import {validateAcquisitionPayload} from '../../artifacts/virtual-cfo/src/lib/marketing/acquisition-evidence.ts';
export {validateAcquisitionPayload};
export const validateCashPayload=(payload,financial)=>cashSupplementView(payload,financial)!==null;
