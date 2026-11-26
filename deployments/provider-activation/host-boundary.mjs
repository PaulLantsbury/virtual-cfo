// Presence-only capability boundary. Never returns or logs environment values.
const prefix = 'NIGHT_SCOUT_';
const common = new Set(['NIGHT_SCOUT_RUNTIME_ENV','NIGHT_SCOUT_STAGING_CA_PEM','NIGHT_SCOUT_REVIEW_AUTH_URL','NIGHT_SCOUT_REVIEW_PUBLIC_KEY']);
const shared = ['STAGING_PROJECT_REF','STAGING_OWNER_ID','STAGING_STORE_ID'];
const api = ['API_DATABASE_URL','API_RUNTIME_ENABLED','ENVELOPE_MASTER_KEY','ENVELOPE_KEY_VERSION','REDIRECT_URI','ALLOWED_ORIGIN'];
const collector = ['COLLECTOR_DATABASE_URL','COLLECTOR_RUNTIME_ENABLED','COLLECTOR_ENABLED','ACCEPTANCE_ENABLED','ACCEPTANCE_STORE_ID','ACCEPTANCE_FROM','ACCEPTANCE_TO','ACCEPTANCE_RETRY_ORDINAL','ENVELOPE_MASTER_KEY','ENVELOPE_KEY_VERSION'];
const forbidden = /^(DATABASE_URL|PGPASSWORD|PGUSER|PGSERVICE|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|NODE_OPTIONS|DD_API_KEY|NEW_RELIC_LICENSE_KEY|OTEL_EXPORTER_.*|RENDER_API_KEY|GOOGLE_APPLICATION_CREDENTIALS|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)$/;
const profiles = new Set(['website-report','private-api','meta-collector','google-collector']);
const fail = () => {throw new Error('Provider capability environment unavailable');};
export function validateHostEnvironment(profile, env) {
 if(!profiles.has(profile)||!env||typeof env!=='object'||Array.isArray(env)) fail();
 const descriptors=Object.getOwnPropertyDescriptors(env);
 const allowed=new Set(common);
 if(profile==='private-api') allowed.add('NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED');
 for(const provider of ['META','GOOGLE']) {
  const p=`${prefix}${provider}_ADS_`;
  let fields=[];
  if(profile==='website-report') fields=[...shared,'REPORT_DATABASE_URL','REPORT_RUNTIME_ENABLED'];
  if(profile==='private-api') fields=[...shared,...api,...(provider==='META'?['APP_ID','APP_SECRET','API_VERSION']:['CLIENT_ID','CLIENT_SECRET','PKCE_KEY'])];
  if(profile===`${provider.toLowerCase()}-collector`) fields=[...shared,...collector,...(provider==='META'?['API_VERSION']:['CLIENT_ID','CLIENT_SECRET','REDIRECT_URI'])];
  for(const field of fields) allowed.add(p+field);
 }
 let providerVariableCount=0;
 for(const [name,d] of Object.entries(descriptors)) {
  if(!('value' in d)) fail();
  const value=d.value;
  if(value===undefined||value===null||value==='') continue;
  if(typeof value!=='string') fail();
  if(forbidden.test(name)) fail();
  const providerKey=/^NIGHT_SCOUT_(META|GOOGLE)_ADS_/.test(name);
  const enableFlag=providerKey&&name.endsWith('_ENABLED');
  if(enableFlag&&!['true','false'].includes(value)) fail();
  // Explicit false switches may remain for other capabilities. Credentials may not.
  if(providerKey&&!allowed.has(name)&&!(enableFlag&&value==='false')) fail();
  if(profile!=='website-report'&&name.startsWith(prefix)&&!allowed.has(name)&&!(enableFlag&&value==='false')) fail();
  if(providerKey&&allowed.has(name)) providerVariableCount++;
 }
 const get=name=>descriptors[name]?.value;
 if(profile==='private-api') {
  const enabled=get('NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED');
  if(enabled!==undefined&&enabled!==''&&!['true','false'].includes(enabled)) fail();
  if(enabled!=='true'&&['META','GOOGLE'].some(p=>get(`NIGHT_SCOUT_${p}_ADS_API_RUNTIME_ENABLED`)==='true')) fail();
 }
 if(profile.endsWith('-collector')) {
  const provider=profile.split('-')[0].toUpperCase();
  const ordinal=get(`NIGHT_SCOUT_${provider}_ADS_ACCEPTANCE_RETRY_ORDINAL`);
  if(ordinal!==undefined&&ordinal!==''&&ordinal!=='0') fail();
 }
 return Object.freeze({profile,providerVariableCount,canExecute:false});
}
