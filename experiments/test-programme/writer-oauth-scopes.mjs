// Side-effect-free strict consent boundary for separate test writer.
const allowedScopes=new Set(['openid','profile','email','offline_access','accounting.invoices','accounting.settings.read','accounting.contacts.read']);
export function validWriterScopes(raw) {
  if (typeof raw!=='string' || raw.length>4096) return false;
  const scopes=raw.split(' '),set=new Set(scopes);
  return scopes.length===set.size && scopes.every(s=>allowedScopes.has(s)) && ['offline_access','accounting.invoices','accounting.settings.read'].every(s=>set.has(s));
}
