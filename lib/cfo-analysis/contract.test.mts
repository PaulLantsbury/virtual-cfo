import { analyzeFinancialChange, type AnalysisResult } from './index.mjs';
import { createModelPilot, type PilotResult } from './model.mjs';
import type { EvidenceRequest } from '../cfo-engine/index.mjs';
declare const raw:unknown;
declare const request:EvidenceRequest;
const result:AnalysisResult=analyzeFinancialChange(raw,request);
const noAction:false=result.canExecute;
const model:Promise<PilotResult>=createModelPilot()(raw,request);
// @ts-expect-error current figures are immutable
result.facts[0].currentPence=1;
// @ts-expect-error result cannot authorise execution
const executable:true=result.canExecute;
void [noAction,model,executable];
import {prepareHistoryCfoAnalysis,createHistoryCfoAnalysis,type HistoryAnalysisRequest} from '../../experiments/synthetic-company/history-cfo-analysis.mjs';
declare const historyRequest:HistoryAnalysisRequest;
const packet=prepareHistoryCfoAnalysis(historyRequest);
const historyResult:AnalysisResult=createHistoryCfoAnalysis(historyRequest);
const historyModel:Promise<PilotResult>=createModelPilot()(packet.input,packet.expected);
void [historyResult,historyModel];
