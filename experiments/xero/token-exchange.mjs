const tokenEndpoint='https://identity.xero.com/connect/token',connectionsEndpoint='https://api.xero.com/connections';
const safe=error=>{throw Error(error)};
export async function exchangeReadOnlyCode({code,config,fetchImpl=fetch}){
 if(typeof code!=='string'||code.length<8||!config?.clientId||!config?.clientSecret||config.redirectUri!=='http://localhost:3000/xero/callback')safe('Xero authorisation exchange is invalid');
 const response=await fetchImpl(tokenEndpoint,{method:'POST',redirect:'error',headers:{authorization:`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:config.redirectUri})});
 if(!response.ok)safe('Xero authorisation exchange failed');const token=await response.json();
 if(typeof token?.access_token!=='string'||token.access_token.length<16||typeof token?.expires_in!=='number')safe('Xero authorisation exchange failed');
 return Object.freeze({accessToken:token.access_token,expiresIn:token.expires_in});
}
export async function discoverConnectedTenant({accessToken,fetchImpl=fetch}){
 if(typeof accessToken!=='string'||accessToken.length<16)safe('Xero tenant discovery is invalid');
 const response=await fetchImpl(connectionsEndpoint,{headers:{authorization:`Bearer ${accessToken}`},redirect:'error'});
 if(!response.ok)safe('Xero tenant discovery failed');const rows=await response.json();
 if(!Array.isArray(rows)||rows.length!==1||typeof rows[0]?.tenantId!=='string'||!rows[0].tenantId)safe('Select exactly one Xero organisation before discovery');
 return Object.freeze({tenantId:rows[0].tenantId,tenantName:typeof rows[0].tenantName==='string'?rows[0].tenantName:undefined});
}
