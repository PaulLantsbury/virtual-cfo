// Read-only, value-free readiness check. Never prints environment values.
import {reviewConnectionOptions} from '../../experiments/shopify/review-runtime.mjs';
const names=['NIGHT_SCOUT_REVIEW_PROJECT_REF','NIGHT_SCOUT_REVIEW_AUTH_URL','NIGHT_SCOUT_REVIEW_PUBLIC_KEY','NIGHT_SCOUT_REVIEW_DATABASE_URL'];
export function reportingConfigReadiness(env){
 const present=Object.fromEntries(names.map(name=>[name,typeof env[name]==='string'&&env[name].length>0]));
 let valid=false;
 try{reviewConnectionOptions({projectRef:env.NIGHT_SCOUT_REVIEW_PROJECT_REF,authUrl:env.NIGHT_SCOUT_REVIEW_AUTH_URL,publishableKey:env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY,databaseUrl:env.NIGHT_SCOUT_REVIEW_DATABASE_URL});valid=true;}catch{}
 return {event:'web_reporting_configuration',enabled:env.NIGHT_SCOUT_REVIEW_ENABLED==='true',staging:env.NIGHT_SCOUT_RUNTIME_ENV==='staging',expectedProject:env.NIGHT_SCOUT_REVIEW_PROJECT_REF==='bioalckltvkhlczusdvl',present,validDedicatedConfiguration:valid};
}
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(reportingConfigReadiness(process.env)));
