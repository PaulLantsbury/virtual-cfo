/**
 * cash-snapshot.ts
 *
 * Central mock data for cash position and working capital.
 * Single source of truth for: Cash Control, Scenario Lab, Dashboard, Alerts.
 *
 * @temporary This is a static mock snapshot.
 * @future Replace with live feeds from Xero (cash balance, fixed costs, WC movements)
 *         and Shopify (inventory, receivables) when integrations are connected.
 * Pages should import from this file rather than declaring these values locally.
 */

/** Current cash balance at period end (£) */
export const CASH_BALANCE = 186_000;

/** Cash runway — months of fixed costs covered by current cash balance */
export const CASH_RUNWAY = 3.4;

/**
 * Monthly fixed cost base — payroll, software, rent and other overheads.
 * Also used in Profit Engine (as BASE_FIXED_COSTS) and Scenario Lab.
 * @future Sourced from Xero nominal ledger (fixed overhead categories)
 */
export const MONTHLY_FIXED_COSTS = 120_000;

/**
 * Working capital drag — cash currently tied up in stock and receivables
 * before it returns to the bank account.
 * @future Computed from inventory value + AR − AP at period end
 */
export const WORKING_CAPITAL_DRAG = 74_000;

/** Net cash movement for the period: trading inflows minus WC movements (£) */
export const NET_CASH_MOVEMENT = 14_000;

/**
 * Inventory days — average days of stock on hand.
 * @future Sourced from Shopify inventory value ÷ COGS per day
 */
export const INVENTORY_DAYS = 82;

/**
 * Supplier payment days — average days before suppliers are paid.
 * @future Sourced from Xero AP ageing report
 */
export const SUPPLIER_DAYS = 42;

/**
 * Cash conversion cycle = Inventory days − Supplier days + Receivable days.
 * @future Computed: INVENTORY_DAYS - SUPPLIER_DAYS + receivableDays
 */
export const CASH_CONVERSION_CYCLE = 47;
