export function createPgLedger({ pool, programmeKey }) {
  async function tx(fn) {
    const c = await pool.connect();
    try { await c.query('BEGIN'); await c.query("SET LOCAL statement_timeout='5s'"); const result = await fn(c); await c.query('COMMIT'); return result; }
    catch { await c.query('ROLLBACK').catch(() => {}); throw new Error('LEDGER_UNAVAILABLE'); }
    finally { c.release(); }
  }
  async function transition(key, from, to, sourceId = null) {
    return tx(async c => {
      const result = await c.query(`UPDATE staging_test_programme.actions SET state=$4,source_id=$5,
        submitted_at=CASE WHEN $4='submitted' THEN now() ELSE submitted_at END,
        confirmed_at=CASE WHEN $4='confirmed' THEN now() ELSE confirmed_at END
        WHERE programme_key=$1 AND action_key=$2 AND state=$3 RETURNING action_key`, [programmeKey,key,from,to,sourceId]);
      if (result.rowCount !== 1) throw new Error('LEDGER_TRANSITION_REFUSED');
      if (to === 'uncertain') await c.query('UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=$1',[programmeKey]);
    });
  }
  return Object.freeze({ durable: true,
    claim: input => tx(async c => {
      const p = (await c.query('SELECT * FROM staging_test_programme.programmes WHERE programme_key=$1 FOR UPDATE',[programmeKey])).rows[0];
      if (!p || !p.enabled || p.stopped || p.target !== input.target || p.provider !== input.provider || p.action_cap !== input.cap) return { state:'blocked' };
      const clock = (await c.query('SELECT now() AS now')).rows[0].now;
      if (clock < p.starts_at || clock >= p.ends_at) return { state:'blocked' };
      const existing = (await c.query('SELECT state,payload_digest FROM staging_test_programme.actions WHERE programme_key=$1 AND action_key=$2',[programmeKey,input.key])).rows[0];
      if (existing) return { state:existing.payload_digest === input.payloadDigest ? 'existing' : 'blocked' };
      const unresolved = Number((await c.query("SELECT count(*) AS n FROM staging_test_programme.actions WHERE programme_key=$1 AND state IN ('claimed','submitted','uncertain')",[programmeKey])).rows[0].n);
      if (unresolved > 0) return { state:'blocked' };
      const count = Number((await c.query('SELECT count(*) AS n FROM staging_test_programme.actions WHERE programme_key=$1',[programmeKey])).rows[0].n);
      if (count >= p.action_cap) return { state:'blocked' };
      await c.query("INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES($1,$2,$3,'claimed')",[programmeKey,input.key,input.payloadDigest]);
      return { state:'claimed' };
    }), markSubmitted:key => transition(key,'claimed','submitted'), confirm:(key,id) => transition(key,'submitted','confirmed',id), markUncertain:key => transition(key,'submitted','uncertain'),
  });
}
