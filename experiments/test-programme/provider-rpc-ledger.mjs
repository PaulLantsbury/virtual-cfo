export function createRpcLedger({pool,programmeKey}) {
  const rpc=async(sql,args)=>{
    try{return (await pool.query(sql,args)).rows;}catch{throw new Error('LEDGER_UNAVAILABLE');}
  };
  const transition=async(key,oldState,newState,id=null)=>{
    const r=await rpc('SELECT staging_test_programme.transition_action($1,$2,$3,$4,$5) AS ok',[programmeKey,key,oldState,newState,id]);
    if(r.length!==1 || r[0].ok!==true) throw new Error('LEDGER_TRANSITION_REFUSED');
  };
  return Object.freeze({durable:true,
    claim:async input=>{
      const r=await rpc('SELECT staging_test_programme.claim_action($1,$2,$3,$4,$5,$6) AS state',[programmeKey,input.key,input.payloadDigest,input.provider,input.target,input.cap]);
      if(r.length!==1 || !['claimed','existing','blocked'].includes(r[0].state)) throw new Error('LEDGER_UNAVAILABLE');
      return {state:r[0].state};
    },markSubmitted:key=>transition(key,'claimed','submitted'),confirm:(key,id)=>transition(key,'submitted','confirmed',id),markUncertain:key=>transition(key,'submitted','uncertain'),
  });
}
