import { useQuery } from '@tanstack/react-query';
import { xeroMerchantSetupState } from '@/lib/xeroMerchantConnection';
import { xeroMerchantReadinessView } from '@/lib/xeroMerchantReadiness';

const labels: Record<string, string> = { revenue: 'Booked revenue', processingFee: 'Processing fees', advertising: 'Advertising', software: 'Software', includedCash: 'Included cash' };
type Account = { id: string; name: string; type: string; status: string };
type Suggestion = { candidates: { accountName: string; confidence: string }[] };
type TestRead = { reportDate: string; retrievedAt: string; baseCurrency: string; reports: Record<string, string>; shopifyComparison: 'not_requested' };
type Readiness = { available: boolean; reason: string | null; shopifyComparison: 'not_requested' };
type Preview = { mappingStatus: string; mappingReadiness: Readiness; testRead: TestRead; categories: { category: string; confirmed: Account[]; suggestion: Suggestion }[] };

async function fetchPreview(signal: AbortSignal): Promise<Preview> {
  const response = await fetch('http://127.0.0.1:4002/api/xero/mapping-preview', { signal, cache: 'no-store' });
  if (!response.ok) throw Error('unavailable');
  return response.json() as Promise<Preview>;
}

function readableReason(reason: string | null | undefined) {
  return reason ? reason.replaceAll('_', ' ') : 'the local mapping status is unavailable';
}

export function XeroMappingSetup() {
  const query = useQuery({ queryKey: ['xero-local-mapping-preview'], queryFn: ({ signal }) => fetchPreview(signal), retry: false, refetchOnWindowFocus: false });
  const preview = query.data;
  const readiness = preview?.mappingReadiness;
  const isReady = Boolean(preview && readiness?.available);
  const status = query.isPending ? 'loading' : preview ? (isReady ? 'ready' : 'review') : 'unavailable';
  const statusMessage = status === 'loading'
    ? 'Loading the local Xero test mapping.'
    : status === 'ready'
      ? 'The local Xero test mapping is ready for review.'
      : status === 'review'
        ? `Mapping review required: ${readableReason(readiness?.reason)}. No accounting result is assumed.`
        : 'The local test mapping preview is unavailable. No Xero connection or mapping is assumed.';

  const merchantSetup=xeroMerchantSetupState(null,false);
  // A server-provided, value-free staging readiness view will be passed here
  // only after the authenticated endpoint is enabled. Do not infer readiness
  // from this local preview or expose its account values in the browser.
  const merchantReadiness=xeroMerchantReadinessView(null,false);
  return <section aria-labelledby="xero-mapping-heading" className="space-y-5 rounded-2xl border bg-card p-6 sm:p-8">
    <div>
      <h2 id="xero-mapping-heading" className="text-xl font-semibold">Xero account mapping</h2>
      <p id="xero-mapping-description" className="mt-2 text-sm text-muted-foreground">This local test preview shows previously confirmed Xero accounts and review-only suggestions. It does not contact Xero, save changes, or compare Xero with Shopify.</p>
    </div>
    <div aria-atomic="true" aria-live="polite" className={status === 'review' || status === 'unavailable' ? 'rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm' : 'rounded-lg border bg-muted/30 p-3 text-sm'} role="status">{statusMessage}</div>
    {preview && <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Read-only local Xero test completed for {preview.testRead.reportDate} in {preview.testRead.baseCurrency}. It used {Object.values(preview.testRead.reports).join(', ')}. No report values are stored or shown here.</p>}
    <div className="overflow-x-auto">
      <table aria-describedby="xero-mapping-description" className="w-full min-w-[620px] text-sm">
        <caption className="sr-only">Confirmed local Xero account mapping and review-only suggestions</caption>
        <thead className="text-left text-muted-foreground"><tr><th className="pb-3 font-medium" scope="col">Category</th><th className="pb-3 font-medium" scope="col">Confirmed accounts</th><th className="pb-3 font-medium" scope="col">Top suggestion</th><th className="pb-3 font-medium" scope="col">Status</th></tr></thead>
        <tbody>{Object.entries(labels).map(([category, label]) => {
          const item = preview?.categories.find((value) => value.category === category);
          const suggestion = item?.suggestion.candidates[0];
          const confirmedNames = item?.confirmed.map((account) => account.name).join(', ');
          const rowStatus = !preview ? 'Unavailable' : !isReady ? 'Review required' : item?.confirmed.length ? 'Confirmed locally' : 'Review required';
          return <tr key={category} className="border-t"><th className="py-3 text-left font-medium" scope="row">{label}</th><td className="py-3">{confirmedNames || '—'}</td><td className="py-3 text-muted-foreground">{suggestion ? `${suggestion.accountName} (${suggestion.confidence})` : '—'}</td><td className="py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{rowStatus}</span></td></tr>;
        })}</tbody>
      </table>
    </div>
    {status === 'unavailable' && <button className="w-fit text-sm font-medium text-primary underline underline-offset-4" onClick={() => query.refetch()} type="button">Try the local preview again</button>}
    <p className="text-sm text-muted-foreground">Local test preview only. Suggestions remain for review and do not change the confirmed mapping. Mappings stay separate from Shopify trading data. An unmapped account remains unavailable; Night Scout does not assume a zero value.</p>
    <div className="rounded-lg border bg-muted/30 p-4" aria-live="polite">
      <h3 className="font-medium">{merchantSetup.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{merchantSetup.detail}</p>
    </div>
    <div className="rounded-lg border bg-muted/30 p-4" aria-live="polite">
      <h3 className="font-medium">{merchantReadiness.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{merchantReadiness.detail}</p>
    </div>
  </section>;
}
