/** Typed synthetic accrual correction only; no SQL, source mutation or tax-rate inference. */
const ensure=(x,m)=>{if(!x)throw Error(m);};
export function amendedExpense(body,amount){
 ensure(body.kind==='expense_accrual','Unsupported correction type: only expense accrual amount is supported');
 ensure(Number.isSafeInteger(amount)&&amount>=0,'Absolute expense amount must be safe nonnegative integer pennies');
 const copy=structuredClone(body),expense=copy.postings.filter(p=>p.account.startsWith('expense:'));
 ensure(expense.length===1&&copy.postings.every(p=>[expense[0].account,'vat_control','accrued_payable'].includes(p.account)),'Unsupported expense journal structure');
 const old=expense[0].amount;ensure(Number.isSafeInteger(old)&&old>=0,'Original expense unsupported');
 const exempt=expense[0].account==='expense:insurance',tax=exempt?0:Math.round(amount/5);
 copy.postings=[{account:expense[0].account,amount},...(tax?[{account:'vat_control',amount:tax}]:[]),{account:'accrued_payable',amount:-amount-tax}];
 const classified=['variableCosts','marketing','overheads'].filter(k=>Object.hasOwn(copy.metrics,k));ensure(classified.length===1,'Expense category evidence unavailable');copy.metrics[classified[0]]=amount;copy.metrics.inputVat=tax;
 ensure(copy.postings.reduce((sum,p)=>sum+p.amount,0)===0,'Unbalanced amended expense');return copy;
}
