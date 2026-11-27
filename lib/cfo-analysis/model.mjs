import { analyzeFinancialChange } from './index.mjs';
const ENDPOINT = 'https://api.openai.com/v1/responses';
/** Server-only, single-process finite pilot. Approval must be supplied by the operator;
 * construction does not constitute approval. Restarting must not rearm a pilot. */
export function createModelPilot({ approval = null, transport = globalThis.fetch, getApiKey = () => '', now = Date.now } = {}) {
  approval = approval ? Object.freeze({ ...approval }) : null;
  let calls = 0;
  return async function analyze(input, expected) {
    const analysis = analyzeFinancialChange(input, expected);
    const fallback = reason => ({ analysis, model: { status: 'fallback', reason, selectedFactKeys: analysis.facts.map(f => f.key) } });
    if (!approval || approval.enabled !== true || !approval.approvalId || !approval.model || !Number.isFinite(approval.expiresAt) || now() >= approval.expiresAt) return fallback('disabled');
    // Fixed finite ceiling, additional operator cap may only reduce it.
    if (!Number.isInteger(approval.maxCalls) || approval.maxCalls < 1 || approval.maxCalls > 10 || calls >= approval.maxCalls) return fallback('call-limit');
    if (!(approval.maxCostUsd > 0 && approval.maxCostUsd <= 0.1) || !(Number.isFinite(approval.inputUsdPerMillion) && Number.isFinite(approval.outputUsdPerMillion) && approval.inputUsdPerMillion > 0 && approval.outputUsdPerMillion > 0)) return fallback('budget-unapproved');
    if (analysis.status !== 'ready' || !analysis.investigation || !analysis.facts.length) return fallback('evidence-unavailable');
    const facts = analysis.facts.map(({ key, currentPence, priorPence, changePence }) => ({ key, currentPence, priorPence, changePence }));
    const payload = { currency: analysis.scope.currency, facts };
    const body = { model: approval.model, store: false, reasoning: { effort: 'none' }, max_output_tokens: 256,
      instructions: 'Choose one to three distinct financial fact keys that best explain the recorded change. Return only the JSON object. Never invent a key or write advice. All values are integer minor currency units. No cause can be inferred.',
      input: JSON.stringify(payload), text: { format: { type: 'json_schema', name: 'fact_selection', strict: true, schema: { type: 'object', properties: { factKeys: { type: 'array', items: { type: 'string', enum: facts.map(f => f.key) }, minItems: 1, maxItems: 3 } }, required: ['factKeys'], additionalProperties: false } } } };
    const serialized = JSON.stringify(body);
    // UTF-8 byte count is a conservative token ceiling, plus envelope allowance.
    const inputCeiling = new TextEncoder().encode(serialized).length + 1024;
    if (inputCeiling > 4000) return fallback('payload-limit');
    const reservedCost = (inputCeiling * approval.inputUsdPerMillion + 256 * approval.outputUsdPerMillion) / 1e6;
    if (reservedCost * approval.maxCalls > approval.maxCostUsd) return fallback('budget-limit');
    let key;
    try { key = getApiKey(); } catch { return fallback('credential-unavailable'); }
    if (typeof key !== 'string' || !key) return fallback('credential-unavailable');
    calls++;
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 10000); });
      const response = await Promise.race([transport(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: serialized, signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('request'); return r.json(); }), timeout]);
      if (response.status !== 'completed' || !Array.isArray(response.output)) return fallback('invalid-response');
      const blocks = response.output.flatMap(item => item.content ?? []);
      if (blocks.length !== 1 || blocks[0].type !== 'output_text' || blocks[0].text.length > 2048) return fallback('invalid-response');
      const parsed = JSON.parse(blocks[0].text);
      if (!parsed || Object.keys(parsed).join() !== 'factKeys' || !Array.isArray(parsed.factKeys) || parsed.factKeys.length < 1 || parsed.factKeys.length > 3 || new Set(parsed.factKeys).size !== parsed.factKeys.length || parsed.factKeys.some(k => !facts.some(f => f.key === k))) return fallback('invalid-selection');
      return { analysis, model: { status: 'selected', reason: null, selectedFactKeys: parsed.factKeys } };
    } catch { return fallback('request-failed'); }
    finally { clearTimeout(timer); }
  };
}
