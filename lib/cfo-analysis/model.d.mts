import type { EvidenceRequest } from '../cfo-engine/index.mjs';
import { analyzeFinancialChange } from './index.mjs';
export interface PilotApproval { enabled:boolean; approvalId:string; model:string; expiresAt:number; maxCalls:number; maxCostUsd:number; inputUsdPerMillion:number; outputUsdPerMillion:number; }
export interface PilotResult { analysis: ReturnType<typeof analyzeFinancialChange>; model:{status:'fallback'|'selected';reason:string|null;selectedFactKeys:string[]} }
export function createModelPilot(options?:{approval?:PilotApproval|null;transport?:typeof fetch;getApiKey?:()=>string;now?:()=>number}):(input:unknown,expected:EvidenceRequest)=>Promise<PilotResult>;
