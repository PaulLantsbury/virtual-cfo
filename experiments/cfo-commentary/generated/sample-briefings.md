# Offline deterministic CFO examples

**Fictional Northbridge Home Ltd — no ChatGPT service connected.**

October 2026 is the latest completed month at the fixed review date 26 November 2026; September is its comparison. All amounts and evidence are fictional. Packet hashes establish internal coherence, not real source completeness or authorization.

## normal

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/0/packet. Claims use the following full artifact pointers:

- examples.json#/0/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/prior/profitInput"]
- examples.json#/0/packet/change: 80000 pence; evidence ["examples.json#/0/packet/current/metrics/operatingProfit","examples.json#/0/packet/prior/metrics/operatingProfit"]
- examples.json#/0/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.

Packet base: examples.json#/0/packet. Claims use the following full artifact pointers:

- examples.json#/0/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/prior/profitInput"]
- examples.json#/0/packet/change: 80000 pence; evidence ["examples.json#/0/packet/current/metrics/operatingProfit","examples.json#/0/packet/prior/metrics/operatingProfit"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: £6,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/0/packet. Claims use the following full artifact pointers:

- examples.json#/0/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/0/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/0/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## zero

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £0.00.
Gross profit: £0.00.
Contribution after marketing: £0.00.
Operating overheads including depreciation and amortisation: £0.00.
Operating profit: £0.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: -£2,700.00. This describes a difference, not its business cause.
Advertising deducted once in contribution: £0.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/1/packet. Claims use the following full artifact pointers:

- examples.json#/1/packet/current/metrics/netProductSales: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/grossProfit: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/contribution: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/overheads: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/operatingProfit: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/prior/profitInput"]
- examples.json#/1/packet/change: -270000 pence; evidence ["examples.json#/1/packet/current/metrics/operatingProfit","examples.json#/1/packet/prior/metrics/operatingProfit"]
- examples.json#/1/packet/current/metrics/advertising: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £0.00.
Gross profit: £0.00.
Contribution after marketing: £0.00.
Operating overheads including depreciation and amortisation: £0.00.
Operating profit: £0.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: -£2,700.00. This describes a difference, not its business cause.

Packet base: examples.json#/1/packet. Claims use the following full artifact pointers:

- examples.json#/1/packet/current/metrics/netProductSales: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/grossProfit: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/contribution: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/overheads: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/operatingProfit: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/prior/profitInput"]
- examples.json#/1/packet/change: -270000 pence; evidence ["examples.json#/1/packet/current/metrics/operatingProfit","examples.json#/1/packet/prior/metrics/operatingProfit"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £0.00.
Contribution after marketing: £0.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/1/packet. Claims use the following full artifact pointers:

- examples.json#/1/packet/current/metrics/advertising: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]
- examples.json#/1/packet/current/metrics/contribution: 0 pence; evidence ["examples.json#/1/packet/sources/c174f38c0517c5bbb5e29718639bfdf8620f9bf7ad183ad3816093bfa0655bff/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## negative

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: -£70.00.
Gross profit: -£70.00.
Contribution after marketing: -£75.00.
Operating overheads including depreciation and amortisation: £0.00.
Operating profit: -£75.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: -£2,775.00. This describes a difference, not its business cause.
Advertising deducted once in contribution: £0.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/2/packet. Claims use the following full artifact pointers:

- examples.json#/2/packet/current/metrics/netProductSales: -7000 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/grossProfit: -7000 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/contribution: -7500 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/overheads: 0 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/operatingProfit: -7500 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/prior/profitInput"]
- examples.json#/2/packet/change: -277500 pence; evidence ["examples.json#/2/packet/current/metrics/operatingProfit","examples.json#/2/packet/prior/metrics/operatingProfit"]
- examples.json#/2/packet/current/metrics/advertising: 0 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: -£70.00.
Gross profit: -£70.00.
Contribution after marketing: -£75.00.
Operating overheads including depreciation and amortisation: £0.00.
Operating profit: -£75.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: -£2,775.00. This describes a difference, not its business cause.

Packet base: examples.json#/2/packet. Claims use the following full artifact pointers:

- examples.json#/2/packet/current/metrics/netProductSales: -7000 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/grossProfit: -7000 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/contribution: -7500 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/overheads: 0 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/operatingProfit: -7500 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/prior/profitInput"]
- examples.json#/2/packet/change: -277500 pence; evidence ["examples.json#/2/packet/current/metrics/operatingProfit","examples.json#/2/packet/prior/metrics/operatingProfit"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £0.00.
Contribution after marketing: -£75.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/2/packet. Claims use the following full artifact pointers:

- examples.json#/2/packet/current/metrics/advertising: 0 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]
- examples.json#/2/packet/current/metrics/contribution: -7500 pence; evidence ["examples.json#/2/packet/sources/6a07d6ce6605510fc69899b66c86f016a07b70afa76db4a69a622b38cbd1be40/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## missing-costs

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: unavailable because required evidence is missing or incompatible.
Contribution after marketing: unavailable because required evidence is missing or incompatible.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: unavailable because required evidence is missing or incompatible.
Profit comparison withheld: comparable current supported periods are unavailable.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/3/packet. Claims use the following full artifact pointers:

- examples.json#/3/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/3/packet/sources/a6bef2520011144268fbb48669d3c99d35d6d370d0b3f46ace75855703fc948a/current/profitInput"]
- examples.json#/3/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/3/packet/sources/a6bef2520011144268fbb48669d3c99d35d6d370d0b3f46ace75855703fc948a/current/profitInput"]
- examples.json#/3/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/3/packet/sources/a6bef2520011144268fbb48669d3c99d35d6d370d0b3f46ace75855703fc948a/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: unavailable because required evidence is missing or incompatible.
Contribution after marketing: unavailable because required evidence is missing or incompatible.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: unavailable because required evidence is missing or incompatible.
Profit comparison withheld: comparable current supported periods are unavailable.

Packet base: examples.json#/3/packet. Claims use the following full artifact pointers:

- examples.json#/3/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/3/packet/sources/a6bef2520011144268fbb48669d3c99d35d6d370d0b3f46ace75855703fc948a/current/profitInput"]
- examples.json#/3/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/3/packet/sources/a6bef2520011144268fbb48669d3c99d35d6d370d0b3f46ace75855703fc948a/current/profitInput"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: unavailable because required evidence is missing or incompatible.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/3/packet. Claims use the following full artifact pointers:

- examples.json#/3/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/3/packet/sources/a6bef2520011144268fbb48669d3c99d35d6d370d0b3f46ace75855703fc948a/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## missing-advertising

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: unavailable because required evidence is missing or incompatible.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: unavailable because required evidence is missing or incompatible.
Profit comparison withheld: comparable current supported periods are unavailable.
Advertising deducted once in contribution: unavailable because required evidence is missing or incompatible.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/4/packet. Claims use the following full artifact pointers:

- examples.json#/4/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/4/packet/sources/e113b30ae93c51c35fa96dceb06372dc4378f2cc9cb316a17648eeb58da1a68f/current/profitInput"]
- examples.json#/4/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/4/packet/sources/e113b30ae93c51c35fa96dceb06372dc4378f2cc9cb316a17648eeb58da1a68f/current/profitInput"]
- examples.json#/4/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/4/packet/sources/e113b30ae93c51c35fa96dceb06372dc4378f2cc9cb316a17648eeb58da1a68f/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: unavailable because required evidence is missing or incompatible.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: unavailable because required evidence is missing or incompatible.
Profit comparison withheld: comparable current supported periods are unavailable.

Packet base: examples.json#/4/packet. Claims use the following full artifact pointers:

- examples.json#/4/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/4/packet/sources/e113b30ae93c51c35fa96dceb06372dc4378f2cc9cb316a17648eeb58da1a68f/current/profitInput"]
- examples.json#/4/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/4/packet/sources/e113b30ae93c51c35fa96dceb06372dc4378f2cc9cb316a17648eeb58da1a68f/current/profitInput"]
- examples.json#/4/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/4/packet/sources/e113b30ae93c51c35fa96dceb06372dc4378f2cc9cb316a17648eeb58da1a68f/current/profitInput"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: unavailable because required evidence is missing or incompatible.
Contribution after marketing: unavailable because required evidence is missing or incompatible.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## missing-overheads

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: unavailable because required evidence is missing or incompatible.
Operating profit: unavailable because required evidence is missing or incompatible.
Profit comparison withheld: comparable current supported periods are unavailable.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/5/packet. Claims use the following full artifact pointers:

- examples.json#/5/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]
- examples.json#/5/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]
- examples.json#/5/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]
- examples.json#/5/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: unavailable because required evidence is missing or incompatible.
Operating profit: unavailable because required evidence is missing or incompatible.
Profit comparison withheld: comparable current supported periods are unavailable.

Packet base: examples.json#/5/packet. Claims use the following full artifact pointers:

- examples.json#/5/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]
- examples.json#/5/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]
- examples.json#/5/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: £6,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/5/packet. Claims use the following full artifact pointers:

- examples.json#/5/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]
- examples.json#/5/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/5/packet/sources/604268d06a3e1361aef88f839b539db94411a274dc833db7e9c5e864630d4998/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## missing-cash

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/6/packet. Claims use the following full artifact pointers:

- examples.json#/6/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/prior/profitInput"]
- examples.json#/6/packet/change: 80000 pence; evidence ["examples.json#/6/packet/current/metrics/operatingProfit","examples.json#/6/packet/prior/metrics/operatingProfit"]
- examples.json#/6/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.

Packet base: examples.json#/6/packet. Claims use the following full artifact pointers:

- examples.json#/6/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/prior/profitInput"]
- examples.json#/6/packet/change: 80000 pence; evidence ["examples.json#/6/packet/current/metrics/operatingProfit","examples.json#/6/packet/prior/metrics/operatingProfit"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: £6,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/6/packet. Claims use the following full artifact pointers:

- examples.json#/6/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]
- examples.json#/6/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/6/packet/sources/10466ac7bfb37bbb1e7cf37998371201a25bdb4a75603638a14c6217f67bffae/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## cash-supported

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Dated unrestricted cash at 2026-10-31: £25,000.00. Unsettled balances are excluded. This is a balance, not spending headroom.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/7/packet. Claims use the following full artifact pointers:

- examples.json#/7/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/prior/profitInput"]
- examples.json#/7/packet/change: 80000 pence; evidence ["examples.json#/7/packet/current/metrics/operatingProfit","examples.json#/7/packet/prior/metrics/operatingProfit"]
- examples.json#/7/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/cash/availableCash: 2500000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/cash"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.

Packet base: examples.json#/7/packet. Claims use the following full artifact pointers:

- examples.json#/7/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/prior/profitInput"]
- examples.json#/7/packet/change: 80000 pence; evidence ["examples.json#/7/packet/current/metrics/operatingProfit","examples.json#/7/packet/prior/metrics/operatingProfit"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: £6,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/7/packet. Claims use the following full artifact pointers:

- examples.json#/7/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]
- examples.json#/7/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Dated unrestricted cash at 2026-10-31: £25,000.00. Unsettled balances are excluded. This is a balance, not spending headroom.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/7/packet. Claims use the following full artifact pointers:

- examples.json#/7/packet/cash/availableCash: 2500000 pence; evidence ["examples.json#/7/packet/sources/3e2c1f2f9b920eac538a1cec86ed313e53760e3c1b41ba0fefc55478644a06dd/cash"]

## stale

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Stale: last available same-scope figures may be out of date. No new comparison or spending advice is generated.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Profit comparison withheld: comparable current supported periods are unavailable.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/8/packet. Claims use the following full artifact pointers:

- examples.json#/8/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Stale: last available same-scope figures may be out of date. No new comparison or spending advice is generated.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Profit comparison withheld: comparable current supported periods are unavailable.

Packet base: examples.json#/8/packet. Claims use the following full artifact pointers:

- examples.json#/8/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Stale: last available same-scope figures may be out of date. No new comparison or spending advice is generated.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: £6,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/8/packet. Claims use the following full artifact pointers:

- examples.json#/8/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]
- examples.json#/8/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/8/packet/sources/8d25f43bc19bb6275be3cbf21c26039e1264fd754b76a65e842e82664b409948/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Stale: last available same-scope figures may be out of date. No new comparison or spending advice is generated.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## invalidated

### briefing

This scope is unavailable. No previous company figures or advice are shown.

### profit-change

This scope is unavailable. No previous company figures or advice are shown.

### marketing-spend

This scope is unavailable. No previous company figures or advice are shown.

### cash

This scope is unavailable. No previous company figures or advice are shown.

## denied

### briefing

This scope is unavailable. No previous company figures or advice are shown.

### profit-change

This scope is unavailable. No previous company figures or advice are shown.

### marketing-spend

This scope is unavailable. No previous company figures or advice are shown.

### cash

This scope is unavailable. No previous company figures or advice are shown.

## comparison-mismatch

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Profit comparison withheld: comparable current supported periods are unavailable.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/11/packet. Claims use the following full artifact pointers:

- examples.json#/11/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Profit comparison withheld: comparable current supported periods are unavailable.

Packet base: examples.json#/11/packet. Claims use the following full artifact pointers:

- examples.json#/11/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: £6,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/11/packet. Claims use the following full artifact pointers:

- examples.json#/11/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]
- examples.json#/11/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/11/packet/sources/f49bcea1de1f817df9fd0c66f0d6cb2d96845ba5ad460d787722f2b2454da5fb/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

## prompt-injection

### briefing

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.
Advertising deducted once in contribution: £1,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.

Packet base: examples.json#/12/packet. Claims use the following full artifact pointers:

- examples.json#/12/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/prior/profitInput"]
- examples.json#/12/packet/change: 80000 pence; evidence ["examples.json#/12/packet/current/metrics/operatingProfit","examples.json#/12/packet/prior/metrics/operatingProfit"]
- examples.json#/12/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]

### profit-change

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Net product sales excluding VAT and shipping: £14,000.00.
Gross profit: £8,000.00.
Contribution after marketing: £6,000.00.
Operating overheads including depreciation and amortisation: £2,500.00.
Operating profit: £3,500.00.
Prior period 2026-09-01 to 2026-09-30 (report fictional-09-snapshot-v1, source fictional-09-costs-v1, formula profit-evidence-v1; observed 2026-11-01T12:00:00Z, data through 2026-09-30) operating profit: £2,700.00. Arithmetic change: £800.00. This describes a difference, not its business cause.

Packet base: examples.json#/12/packet. Claims use the following full artifact pointers:

- examples.json#/12/packet/current/metrics/netProductSales: 1400000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/grossProfit: 800000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/overheads: 250000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/operatingProfit: 350000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/prior/metrics/operatingProfit: 270000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/prior/profitInput"]
- examples.json#/12/packet/change: 80000 pence; evidence ["examples.json#/12/packet/current/metrics/operatingProfit","examples.json#/12/packet/prior/metrics/operatingProfit"]

### marketing-spend

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Advertising deducted once in contribution: £1,000.00.
Contribution after marketing: £6,000.00.
A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.

Packet base: examples.json#/12/packet. Claims use the following full artifact pointers:

- examples.json#/12/packet/current/metrics/advertising: 100000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]
- examples.json#/12/packet/current/metrics/contribution: 600000 pence; evidence ["examples.json#/12/packet/sources/40afe11e6f2ee627d33b68d0a0d08c9401fb6d162fbc4d4db144aa58a4698392/current/profitInput"]

### cash

Fictional Northbridge Home Ltd | fictional-northbridge-home | fictional-northbridge-store | GBP | Europe/London | 2026-10-01 to 2026-10-31 | report fictional-10-snapshot-v1 | source fictional-10-costs-v1 | formula profit-evidence-v1.
Evidence observed 2026-11-01T12:00:00Z; data through 2026-10-31.
Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.
Runway withheld: three complete reviewed months of actual net cash burn are not supplied.
