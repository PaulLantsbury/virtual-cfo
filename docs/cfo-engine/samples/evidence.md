# Sample policy and evidence decisions

All inputs are fictional acceptance fixtures from the earlier tested offline prototype. Each monetary claim is rederived by the shared financial calculator and admitted through the new CFO engine. This sample adapter is not a database adapter and proves no merchant access, source completeness or provider reconciliation.

[Machine-readable decisions](examples.json) · [Readable briefings](briefings.md)

## normal

Result: ready. JSON location: examples.json#/examples/0.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → supported; rules: calculation, comparison, ladder; reason: none.
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → supported; rules: calculation, ladder; reason: none.
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..

## missing-costs

Result: ready. JSON location: examples.json#/examples/1.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-contribution"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-operatingProfit"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: Comparable current and prior measures are required..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → withheld; rules: context, ladder; reason: Current validated measures are required..
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → withheld; rules: context, ladder; reason: Current validated measures are required..

## missing-advertising

Result: ready. JSON location: examples.json#/examples/2.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-operatingProfit"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-advertising"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: Comparable current and prior measures are required..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → withheld; rules: context, ladder; reason: Current validated measures are required..
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → withheld; rules: context, ladder; reason: Current validated measures are required..

## missing-overheads

Result: ready. JSON location: examples.json#/examples/3.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: Comparable current and prior measures are required..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → withheld; rules: context, ladder; reason: Current validated measures are required..
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..

## missing-cash

Result: ready. JSON location: examples.json#/examples/4.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → supported; rules: calculation, comparison, ladder; reason: none.
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → supported; rules: calculation, ladder; reason: none.
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..

## missing-customer

Result: ready. JSON location: examples.json#/examples/5.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → supported; rules: calculation, comparison, ladder; reason: none.
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → supported; rules: calculation, ladder; reason: none.
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..

## stale

Result: stale. JSON location: examples.json#/examples/6.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: Refresh stale evidence before comparisons or advice..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → withheld; rules: context, ladder; reason: Refresh stale evidence before comparisons or advice..
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → withheld; rules: context, ladder; reason: Refresh stale evidence before comparisons or advice..

## invalidated

Result: withheld. JSON location: examples.json#/examples/7.

- {"kind":"fact","metricId":"current-netProductSales"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-grossProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-contribution"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-operatingProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-advertising"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..

## denied

Result: withheld. JSON location: examples.json#/examples/8.

- {"kind":"fact","metricId":"current-netProductSales"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-grossProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-contribution"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-operatingProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-advertising"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..

## scope-mismatch

Result: withheld. JSON location: examples.json#/examples/9.

- {"kind":"fact","metricId":"current-netProductSales"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-grossProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-contribution"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-operatingProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-advertising"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → withheld; rules: context, ladder; reason: A valid authorized evidence context is required..

## comparison-mismatch

Result: ready. JSON location: examples.json#/examples/10.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → withheld; rules: context, ladder; reason: Comparable current and prior measures are required..
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → supported; rules: calculation, ladder; reason: none.
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..

## zero

Result: ready. JSON location: examples.json#/examples/11.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → supported; rules: calculation, comparison, ladder; reason: none.
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → supported; rules: calculation, ladder; reason: none.
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..

## negative

Result: ready. JSON location: examples.json#/examples/12.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → supported; rules: calculation, comparison, ladder; reason: none.
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → supported; rules: calculation, ladder; reason: none.
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..

## prompt-injection

Result: ready. JSON location: examples.json#/examples/13.

- {"kind":"fact","metricId":"current-netProductSales"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-grossProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-contribution"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-operatingProfit"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"fact","metricId":"current-advertising"} → supported; rules: context, calculation, freshness; reason: none.
- {"kind":"arithmetic","currentId":"current-operatingProfit","priorId":"prior-operatingProfit"} → supported; rules: calculation, comparison, ladder; reason: none.
- {"kind":"fact","metricId":"current-availableCash"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"fact","metricId":"current-repeatCustomers"} → withheld; rules: context, ladder; reason: This measure lacks validated calculation evidence..
- {"kind":"investigation","topic":"profit-change","metricIds":["current-grossProfit","current-contribution","current-operatingProfit","current-ebitda"]} → supported; rules: calculation, ladder; reason: none.
- {"kind":"conditional-test","topic":"marketing-economics","metricIds":["current-advertising","current-contribution"]} → requires-human-review; rules: ladder, commercial-review; reason: Substantive plan evidence and approval are not validated by this offline engine..
