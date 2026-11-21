import type {XeroAccountMapping,XeroAccountingView} from './contracts.mjs';
export function validateXeroAccountMapping(mapping:unknown):XeroAccountMapping|null;
export function xeroAccountingView(input?:{mapping?:unknown;accountTotals?:unknown}):XeroAccountingView;
