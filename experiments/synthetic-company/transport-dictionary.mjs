/** Lossless SQL transport only. No file reads, network, credentials or execution. */
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const bytes=value=>Buffer.byteLength(value,'utf8');
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
function parts(sql) {
 ensure(typeof sql==='string'&&sql.length>0,'Explicit original SQL required');
 // The accepted package grammar is intentionally narrow. Transaction controls are retained outside SPI.
 const begin=sql.indexOf('\nBEGIN;');
 ensure(begin>=0&&/^\s*(?:--[^\n]*\n)*$/.test(sql.slice(0,begin+1)),'Expected reviewed comment header and outer BEGIN');
 const commit=/COMMIT;\s*$/.exec(sql);ensure(commit,'Expected one terminal COMMIT');
 const prefix=sql.slice(0,begin+7),suffix=sql.slice(commit.index),body=sql.slice(begin+7,commit.index);
 ensure(body.trim().length>0,'Empty transaction body refused');
 return {prefix,body,suffix};
}
function candidates(sql) {
 const counts=new Map();
 const patterns=[/"[^"\\\r\n]{4,240}"/g,/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi];
 for(const pattern of patterns)for(const match of sql.matchAll(pattern))counts.set(match[0],(counts.get(match[0])||0)+1);
 return [...counts].map(([text,count])=>({text,gain:count*(bytes(text)-3)-bytes(text)-12})).filter(c=>c.gain>40).sort((a,b)=>b.gain-a.gain||a.text.localeCompare(b.text));
}
export function reconstructTransport(proposal) {
 let body=proposal.encodedBody;
 for(let i=0;i<proposal.dictionary.length;i++)body=body.replaceAll(String.fromCharCode(0xe000+i),()=>proposal.dictionary[i]);
 const sql=proposal.prefix+body+proposal.suffix;
 ensure(sha(sql)===proposal.originalSha256,'Original SQL checksum mismatch');
 return sql;
}
export function prepareDictionaryTransport(originalSql,{maxEntries=128,expectedJsonHash,stagingAttestation=false}={}) {
 ensure(typeof stagingAttestation==='boolean','Explicit transaction attestation boolean required');
 ensure(Number.isInteger(maxEntries)&&maxEntries>=1&&maxEntries<=4096,'Dictionary bound must be 1..4096');
 ensure(!/[\uE000-\uEFFF]/.test(originalSql),'Original SQL contains reserved dictionary symbols');
 if(expectedJsonHash!==undefined)ensure(sha(JSON.stringify(originalSql))===expectedJsonHash,'Approved JSON-string SQL checksum mismatch');
 const {prefix,body,suffix}=parts(originalSql),dictionary=[];let encodedBody=body;
 for(const {text}of candidates(body)) {
  if(dictionary.length===maxEntries)break;
  const occurrences=encodedBody.split(text).length-1;
  if(occurrences*(bytes(text)-3)-bytes(text)-12<=40)continue;
  const token=String.fromCharCode(0xe000+dictionary.length);dictionary.push(text);encodedBody=encodedBody.replaceAll(text,token);
 }
 const originalSha256=sha(originalSql),originalJsonHash=sha(JSON.stringify(originalSql));
 const proposal={prefix,suffix,dictionary,encodedBody,originalSha256,originalJsonHash};
 ensure(reconstructTransport(proposal)===originalSql,'Lossless byte reconstruction failed');
 const tag='$night_scout_transport$';ensure(![prefix,suffix,encodedBody,...dictionary].some(s=>s.includes(tag)),'Reserved anonymous block delimiter collision');
 const attestation=stagingAttestation?"SELECT pg_catalog.set_config('night_scout.synthetic_target_verified','v2-isolated-staging-reviewed',true);\n":'';
 const wrapperSql=`${prefix}\n${attestation}DO ${tag}
DECLARE
 encoded text := ${literal(encodedBody)};
 dictionary text[] := ARRAY[${dictionary.map(literal).join(',')}]::text[];
 original_prefix text := ${literal(prefix)};
 original_suffix text := ${literal(suffix)};
 i integer;
BEGIN
 FOR i IN 1..COALESCE(pg_catalog.array_length(dictionary,1),0) LOOP
  encoded := pg_catalog.replace(encoded,pg_catalog.chr(57343+i),dictionary[i]);
 END LOOP;
 IF pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(original_prefix||encoded||original_suffix,'UTF8')),'hex') <> ${literal(originalSha256)} THEN
  RAISE EXCEPTION 'Lossless SQL transport checksum mismatch';
 END IF;
 EXECUTE encoded;
END;
${tag};\n${suffix}`;
 return {...proposal,wrapperSql,stagingAttestation,sizes:{originalBytes:bytes(originalSql),originalJsonRequestBytes:bytes(JSON.stringify({query:originalSql})),wrapperBytes:bytes(wrapperSql),wrapperJsonRequestBytes:bytes(JSON.stringify({query:wrapperSql})),dictionaryEntries:dictionary.length},
  limitations:['Anonymous PL/pgSQL wrapper preserves outer transaction and verifies exact original UTF-8 text before execution.','Original transaction body runs through SPI EXECUTE; disposable rehearsal must prove supported statement behaviour before transport approval.','No persistent schema/function/grant/upload table is created. No execution or connection helper is supplied.']};
}
