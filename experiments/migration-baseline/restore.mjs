import {readFileSync} from 'node:fs';
export const root=new URL('../../db-migrations/reconciliation/2026-09-08/',import.meta.url);
export const catalog=JSON.parse(readFileSync(new URL('public-catalog.json',root)));
export const grants=JSON.parse(readFileSync(new URL('object-grants.json',root)));
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const relation=s=>'public.'+quote(s);

/** Disposable in-memory database only. Recreates observed public objects, not
 * migration execution history, production identities or seed/customer records.
 * Captured legacy function semantics/permissions are intentionally not fixed.
 */
export async function restoreObservedPublic(db){
  if(catalog.policies.length||catalog.triggers.length)throw new Error('Review newly captured policy/trigger restore requirements');
  await db.exec('SET check_function_bodies = false');
  for(const role of ['anon','authenticated','service_role'])await db.exec(`CREATE ROLE ${quote(role)} NOLOGIN`);
  for(const t of catalog.tables){
    const cols=t.columns.map(c=>{
      if(c.identity || !['','s'].includes(c.generated))throw new Error('Unsupported identity/generated column: '+t.name+'.'+c.name);
      const expression=c.generated==='s'?` GENERATED ALWAYS AS (${c.default}) STORED`:(c.default?' DEFAULT '+c.default:'');
      return `${quote(c.name)} ${c.type}${expression}${c.not_null?' NOT NULL':''}`;
    });
    await db.exec(`CREATE TABLE ${relation(t.name)} (${cols.join(',')})`);
  }
  for(const type of ['nonforeign','foreign'])for(const c of catalog.constraints.filter(c=>(c.type==='f')===(type==='foreign'))){
    await db.exec(`ALTER TABLE ${relation(c.table)} ADD CONSTRAINT ${quote(c.name)} ${c.definition}`);
  }
  for(const i of catalog.indexes)await db.exec(i.definition);
  for(const f of catalog.functions)await db.exec(f.definition);
  let pending=[...catalog.views];
  while(pending.length){
    const deferred=[];let last;
    for(const v of pending){try{await db.exec(`CREATE VIEW ${relation(v.name)}${v.options?.length?' WITH ('+v.options.join(',')+')':''} AS ${v.definition}`);}catch(e){deferred.push(v);last=e;}}
    if(deferred.length===pending.length)throw last;
    pending=deferred;
  }
  for(const t of catalog.tables){
    if(t.rls)await db.exec(`ALTER TABLE ${relation(t.name)} ENABLE ROW LEVEL SECURITY`);
    if(t.force_rls)await db.exec(`ALTER TABLE ${relation(t.name)} FORCE ROW LEVEL SECURITY`);
  }
  // Function defaults grant PUBLIC execute; restore the observed object ACLs.
  for(const t of [...catalog.tables,...catalog.views])await db.exec(`REVOKE ALL ON TABLE ${relation(t.name)} FROM PUBLIC,anon,authenticated,service_role`);
  for(const f of catalog.functions)await db.exec(`REVOKE ALL ON FUNCTION ${relation(f.name)}(${f.arguments}) FROM PUBLIC,anon,authenticated,service_role`);
  for(const g of grants){
    if(g.grantee==='postgres')continue; // Local database owner retains ownership rights.
    const object=g.kind==='relation'?`TABLE ${relation(g.name)}`:`FUNCTION ${relation(g.name)}(${g.arguments})`;
    const who=g.grantee==='PUBLIC'?'PUBLIC':quote(g.grantee);
    await db.exec(`GRANT ${g.privileges.join(',')} ON ${object} TO ${who}${g.grantable?' WITH GRANT OPTION':''}`);
  }
  await db.exec('SET check_function_bodies = true');
}
