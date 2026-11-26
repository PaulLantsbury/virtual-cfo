export type QuestionId = 'briefing' | 'profit-change' | 'marketing-spend' | 'cash';
export type Status = 'ready' | 'stale' | 'withheld';
export type MetricName = 'netProductSales' | 'netShipping' | 'cogs' | 'variableCosts' | 'advertising' | 'overheads' | 'da' | 'grossProfit' | 'contributionBeforeMarketing' | 'contribution' | 'operatingProfit' | 'ebitda';
export interface Scope { readonly companyId: string; readonly storeId: string; readonly currency: 'GBP'; readonly timeZone: 'Europe/London'; }
export interface Request extends Scope { readonly from: string; readonly to: string; readonly asOf: string; }
export interface Metric { readonly value: number | null; readonly state: 'supported' | 'unavailable'; readonly evidenceRef: string; }
export interface Period { readonly provenance: Scope & {readonly from: string;readonly to: string;readonly reportVersion: string;readonly sourceVersion: string;readonly formulaVersion: string;readonly observedAt: string;readonly dataThrough: string}; readonly freshness: 'current' | 'stale' | 'invalidated'; readonly metrics: Readonly<Record<MetricName,Metric>>; }
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key:string]: JsonValue };
declare const evidencePacketBrand: unique symbol;
export interface EvidencePacket { readonly [evidencePacketBrand]: true; readonly version:'cfo-offline-v1'; readonly label:string; readonly status:Status; readonly reason:string|null; readonly companyName?:string; readonly reviewDate?:string; readonly current:Period|null; readonly prior:Period|null; readonly change:{readonly value:number|null;readonly metricRefs:readonly string[];readonly reason:string|null}|null; readonly cash:{readonly availableCash:number;readonly restricted:number;readonly unsettled:number;readonly asOf:string;readonly currency:string;readonly sourceVersion:string;readonly evidenceRef:string}|null; readonly sources:Readonly<Record<string,JsonValue>>; }
export interface Claim { readonly metricRef:string; readonly value:number; readonly evidenceRef:string|readonly string[]; }
export interface Narrative { readonly label:string;readonly questionId:QuestionId;readonly status:Status;readonly statements:readonly string[];readonly claims:readonly Claim[]; }
export const FICTIONAL_SCOPE: Readonly<Scope>;
export const REVIEW_DATE: '2026-11-26';
export const QUESTION_IDS: readonly QuestionId[];
export function createEvidencePacket(input:unknown,request:Request):EvidencePacket;
export function renderNarrative(packet:EvidencePacket,questionId?:QuestionId):Narrative;
export function validateNarrative(packet:EvidencePacket,narrative:unknown):boolean;
