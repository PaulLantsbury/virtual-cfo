/** Deliberately bounded failure information: never retain response bodies,
 * credentials, URLs or session errors in user-facing exceptions. */
export class ReviewedReportingRequestError extends Error {
 readonly stage:'session'|'transport'|'http'|'response';
 readonly status?:number;
 constructor(stage:'session'|'transport'|'http'|'response',status?:number){
  super(stage==='session'||status===401||status===403?'Your access could not be verified. Please sign in again.':stage==='http'?`The reporting service could not complete this request (status ${status}). Please check again.`:stage==='transport'?'The reporting service could not be reached. Please check again.':'The reporting service returned an unreadable response. Please check again.');
  this.name='ReviewedReportingRequestError';this.stage=stage;this.status=status;
 }
}
type SessionResult={data:{session:null|{user:{id:string};access_token:string}},error:unknown};
export async function reviewedReportingRequest(path:string,query:Record<string,string>,signal:AbortSignal,userId:string|null,getSession:()=>Promise<SessionResult>,fetcher:typeof fetch=fetch):Promise<any>{
 signal.throwIfAborted();
 let session:SessionResult;
 try{session=await getSession();}catch{signal.throwIfAborted();throw new ReviewedReportingRequestError('session');}
 // A superseded date selection must not send a late request after session lookup.
 signal.throwIfAborted();
 if(session.error||!session.data.session||session.data.session.user.id!==userId)throw new ReviewedReportingRequestError('session');
 let response:Response;
 try{response=await fetcher(`${path}?${new URLSearchParams(query)}`,{headers:{Authorization:`Bearer ${session.data.session.access_token}`},signal});}
 catch{signal.throwIfAborted();throw new ReviewedReportingRequestError('transport');}
 if(!response.ok)throw new ReviewedReportingRequestError('http',response.status);
 try{return await response.json();}catch{signal.throwIfAborted();throw new ReviewedReportingRequestError('response');}
}
/** A cached successful response is deliberately hidden while rechecking. That
 * transient absence is loading, not failed financial-source validation. */
export function reviewedRangeReadError(read:{isFetching:boolean;isError:boolean;isSuccess:boolean;error:unknown},availabilityFetching:boolean,hasMonth:boolean):string|null{
 if(read.isFetching||availabilityFetching)return null;
 if(read.isError)return read.error instanceof ReviewedReportingRequestError?read.error.message:'The selected date range could not be checked. Please check again.';
 return read.isSuccess&&!hasMonth?'The range source evidence did not pass its checks.':null;
}
