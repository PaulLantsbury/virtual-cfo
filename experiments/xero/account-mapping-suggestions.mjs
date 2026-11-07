const categories=Object.freeze(['revenue','processingFee','advertising','software','includedCash']);
const rules=Object.freeze({
 revenue:Object.freeze({types:new Set(['REVENUE','SALES']),words:[['sales',45],['revenue',40],['turnover',40]]}),
 processingFee:Object.freeze({types:new Set(['OVERHEADS','EXPENSE']),words:[['bank fees',55],['merchant fees',55],['processing fees',55],['payment fees',55],['card fees',50]]}),
 advertising:Object.freeze({types:new Set(['OVERHEADS','EXPENSE']),words:[['advertising',55],['marketing',45],['promotion',40]]}),
 software:Object.freeze({types:new Set(['OVERHEADS','EXPENSE']),words:[['software',55],['subscription',45],['saas',45],['it ',25]]}),
 includedCash:Object.freeze({types:new Set(['BANK']),words:[['bank',35],['cash',35],['payment',25]]})
});

/** Produces review-only mapping suggestions from one Xero account directory. */
export function suggestXeroAccountMappings(accounts){
 if(!Array.isArray(accounts)||!accounts.every(validAccount))throw Error('Xero account suggestions are unavailable');
 const active=accounts.filter(account=>account.status==='ACTIVE');
 return Object.freeze(Object.fromEntries(categories.map(category=>[category,suggest(category,active)])));
}

function suggest(category,accounts){
 const rule=rules[category];
 const candidates=accounts.map(account=>score(category,account,rule)).filter(Boolean).sort((a,b)=>b.score-a.score||a.accountName.localeCompare(b.accountName));
 return Object.freeze({category,candidates:Object.freeze(candidates),requiresReview:true,status:candidates.length===0?'no_suggestion':candidates.length>1&&candidates[0].score===candidates[1].score?'ambiguous':'suggested'});
}
function score(category,account,rule){
 const reasons=[];let score=0;
 if(rule.types.has(account.type)){score+=35;reasons.push(`account type: ${account.type}`);}
 if(category==='includedCash'&&!rule.types.has(account.type))return null;
 const lower=account.name.toLowerCase();
 let nameMatch=false;for(const [word,points] of rule.words)if(wordMatch(lower,word)){nameMatch=true;score+=points;reasons.push(`name contains “${word.trim()}”`);}
 if(score===0||(!nameMatch&&!['revenue','includedCash'].includes(category)))return null;
 return Object.freeze({accountId:account.id,accountName:account.name,accountType:account.type,score,confidence:score>=75?'high':score>=45?'medium':'low',reasons:Object.freeze(reasons)});
}
const wordMatch=(text,word)=>new RegExp(`\\b${word.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(text);
function validAccount(account){return account&&Object.getPrototypeOf(account)===Object.prototype&&['id','name','type','status'].every(key=>typeof account[key]==='string'&&account[key].trim()!=='');}
