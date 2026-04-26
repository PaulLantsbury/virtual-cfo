/**
 * AI CFO mock response data for each dashboard page.
 *
 * Free users see: verdict + first 2 evidence bullets
 * Pro users see:  verdict + all evidence + recommendedAction + expectedImpact
 */

export type PageId =
  | "dashboard"
  | "margin"
  | "growth"
  | "marketing"
  | "pricing"
  | "profit"
  | "cash"
  | "opportunities"
  | "scenario"
  | "alerts";

export type Confidence = "high" | "medium" | "low";

export interface AiCfoResponse {
  pageId: PageId;
  question: string;
  verdict: string;
  evidence: string[];
  recommendedAction: string;
  expectedImpact: string;
  confidence: Confidence;
}

export const AI_CFO_RESPONSES: Record<PageId, AiCfoResponse> = {
  dashboard: {
    pageId: "dashboard",
    question: "What is the single biggest risk to my business this month?",
    verdict:
      "Margin compression is the primary risk. Revenue is growing, but contribution margin has declined 2.3pp — meaning more revenue is generating less profit per pound. Without intervention, the business is on a path where growth accelerates losses rather than profits.",
    evidence: [
      "Contribution margin fell from 41.2% to 38.9% over the last 30 days — a £9.4k monthly impact at current revenue.",
      "Marketing spend rose 18% whilst revenue grew only 11%, creating a CAC efficiency gap of approximately £12.80 per order.",
      "Inventory holding costs increased by £6.2k, reducing cash headroom to 3.4 months of fixed costs.",
      "Discount rate averaged 14.3% last month, 3.3pp above the profitable threshold of 11%.",
    ],
    recommendedAction:
      "Prioritise three actions this week: (1) reduce discount rate from 14.3% to 11% on orders above £80 — this alone recovers approximately £4.2k/month; (2) pause the lowest-performing paid channel (Meta) and reallocate £3k/month to Email — recovering £2.8k/month in CAC; (3) negotiate extended 45-day payment terms with your top 2 suppliers to release £8k of working capital.",
    expectedImpact:
      "Combined these actions recover an estimated £9.8k–£14.2k/month in contribution within 30–60 days, returning margin to 41–43% range and extending cash runway by 1.1 months.",
    confidence: "high",
  },

  margin: {
    pageId: "margin",
    question: "Where is my contribution margin leaking and what should I fix first?",
    verdict:
      "Discounting and rising COGS are the two margin leaks. The business is recovering less contribution per order than 60 days ago, driven by a 3.3pp excess discount rate and a COGS uplift from supplier pricing. The margin gap to the 45% lower target is £52k per month.",
    evidence: [
      "Average discount rate is 14.3% — each percentage point above 11% costs approximately £3.8k/month in lost contribution.",
      "COGS as a % of revenue increased from 52.1% to 54.4% over the last two periods, driven by a supplier price increase of 4.2%.",
      "Returns rate of 8.7% is above the 7% benchmark — refund processing reduces net contribution by approximately £4.1k/month.",
      "Higher-margin SKUs (>48% CM) account for only 31% of revenue — range mix is shifting toward lower-margin products.",
    ],
    recommendedAction:
      "Start with the discount lever: set a floor of 11% maximum discount on the top 50 SKUs by volume. This is reversible, requires no new budget and recovers the largest single margin increment. In parallel, request a 3-month supplier price freeze — even a 1pp concession recovers £6.4k/month. Review and remove the two lowest-margin product lines from paid ads.",
    expectedImpact:
      "Recovering discounting alone to 11% adds approximately £12.6k/month contribution (£152k annualised). Combined with COGS renegotiation, total margin recovery potential is £18k–£24k/month within 60 days.",
    confidence: "high",
  },

  growth: {
    pageId: "growth",
    question: "Is my revenue growth sustainable or am I buying it at too high a cost?",
    verdict:
      "Growth is currently fragile. Revenue growth of 11% is being funded disproportionately by increased discounting and paid spend — neither of which is sustainable. Organic and repeat-customer revenue is flat, suggesting the underlying engine is not strengthening.",
    evidence: [
      "New customer revenue grew 18% but repeat customer revenue grew only 3% — indicating weak retention economics.",
      "Discount-driven revenue accounts for 34% of total revenue, up from 26% three months ago.",
      "Customer acquisition cost (CAC) rose 12% to £38.40 — whilst average order value held flat at £87.20.",
      "Organic search revenue is flat at 22% of revenue — paid dependency has increased from 41% to 49%.",
    ],
    recommendedAction:
      "Shift the growth mix toward repeat customers and organic channels within 60 days. Build a post-purchase email sequence targeting 60-day re-engagement — this typically recovers 8–12% of lapsed buyers. Reduce paid media by 10% and reinvest into SEO content and review generation to build compounding organic growth.",
    expectedImpact:
      "Improving repeat rate from 3% to 8% growth adds approximately £14k–£19k in contribution per month within 90 days, whilst reducing CAC dependency and improving growth quality score from 54 to an estimated 67–72.",
    confidence: "medium",
  },

  marketing: {
    pageId: "marketing",
    question: "Which marketing channels are profitable and where should I reallocate budget?",
    verdict:
      "Two of four paid channels are unprofitable at current spend levels. Meta and Display have CAC above the £42 break-even threshold — continuing at current allocation means marketing is net-negative on a contribution basis for 38% of spend.",
    evidence: [
      "Meta CAC is £58.20 vs £42 break-even — each £1,000 spent generates approximately £280 in contribution after acquisition costs.",
      "Email marketing has a CAC of £8.40 and contributes 31% of revenue at 47% contribution margin — the highest-performing channel.",
      "Google Search CAC is £31.20 and contribution margin is 43% — profitable but under-invested at only 18% of budget.",
      "Display advertising has a 90-day CAC payback and a 6% contribution margin — effectively break-even at best.",
    ],
    recommendedAction:
      "Reallocate £3,000/month from Meta and Display to Google Search and Email. Specifically: cut Meta by £2,000, cut Display by £1,000, add £1,500 to Google Search and £1,500 to Email automation. This reallocation takes 2–3 weeks and requires only a budget instruction — no creative work needed.",
    expectedImpact:
      "Reallocation recovers approximately £18.2k/month in contribution (£218k annualised). Marketing contribution margin improves from 31% to an estimated 38–42% within 45 days, without changing total spend.",
    confidence: "high",
  },

  pricing: {
    pageId: "pricing",
    question: "How much contribution am I losing to discounting and what is the safe path to fix it?",
    verdict:
      "Discounting is costing approximately £38k/month in lost contribution. The average discount rate of 14.3% is 3.3pp above the profitable threshold, and the business has demonstrated pricing power — customers are not significantly more price-sensitive than 6 months ago, meaning a discount reduction is achievable without major volume loss.",
    evidence: [
      "Average discount rate of 14.3% on a £87.20 AOV means £12.47 of contribution is surrendered per order.",
      "Price elasticity modelling suggests a 3pp discount reduction would reduce volume by approximately 2.1% — a net positive contribution swap.",
      "Top 20% of SKUs by revenue have discount rates of 18–22% — significantly above profitable threshold.",
      "Returning customers have a 40% lower sensitivity to discount removal than new customers — priority segment for phased reduction.",
    ],
    recommendedAction:
      "Run a phased discount reduction: Week 1–2, remove discounts from returning customers (lowest risk, highest margin). Week 3–4, reduce new-customer discounts on orders above £100 from 15% to 11%. Do not reduce discount on AOV under £60 to protect conversion rate on entry products.",
    expectedImpact:
      "Phased to 11% average discount rate recovers approximately £38k/month in contribution. A full recovery to 10% (12-week path) recovers up to £52k/month — equivalent to 4.2pp margin improvement and the single largest lever available.",
    confidence: "high",
  },

  profit: {
    pageId: "profit",
    question: "Is my profit position healthy and what is the biggest threat to it?",
    verdict:
      "Profit is positive but increasingly sensitive to overhead growth. The business operates 39% above break-even, but that buffer is narrowing because fixed costs grew 8% whilst revenue grew 11% — meaning operating leverage is lower than expected. The next cost increase cycle could flip contribution to risk territory.",
    evidence: [
      "Fixed overhead as % of revenue rose from 18.4% to 19.7% over the last 3 periods — absorbing 1.3pp of contribution margin.",
      "Staff cost efficiency (contribution per £ of staff cost) declined from 2.1x to 1.9x — suggesting headcount is ahead of revenue growth.",
      "Break-even revenue is £612k/month — a £204k buffer exists, but at current overhead growth rate that narrows by ~£8k/month.",
      "Contribution per order is £32.80 — down from £35.40 six months ago, reducing profit per unit shipped.",
    ],
    recommendedAction:
      "Freeze discretionary overhead for 60 days — specifically defer any new hires or SaaS tool additions. Identify the two highest-cost overhead items and negotiate annual vs monthly billing (typically 15–20% saving). Focus revenue growth on higher-margin SKUs to improve contribution per order back toward £35.",
    expectedImpact:
      "A 60-day overhead freeze combined with billing optimisation saves approximately £4.8k–£7.2k/month. Restoring contribution per order to £35 at current volume adds approximately £9.4k/month — total impact of £14k–£16k/month profit improvement.",
    confidence: "medium",
  },

  cash: {
    pageId: "cash",
    question: "Is my cash position safe and where is cash getting trapped in the business?",
    verdict:
      "Cash is under pressure despite profitability. Inventory and supplier payment timing are absorbing more cash than the business is generating each month — creating a cash drag that will tighten further if revenue growth continues at the same working capital intensity.",
    evidence: [
      "Cash headroom is £40k–£60k above minimum operating requirement — a 3.4 month buffer that is narrowing monthly.",
      "Inventory days increased from 42 to 58 over the last quarter — £18k more cash is now locked in stock at any point in time.",
      "Supplier payment terms average 28 days, whilst customer payment is effectively immediate (D+1 ecommerce) — a structural working capital gap.",
      "Refund cycle averages 9 days — £6.2k of cash is in transit at any given time from returns processing.",
    ],
    recommendedAction:
      "Target three working capital improvements: (1) negotiate 45-day payment terms with your top 2 suppliers — releasing approximately £12k–£16k of cash; (2) reduce slow-moving inventory (>90 days on hand) via a margin-neutral clearance — releasing £8k–£14k; (3) reduce return processing to 5 days by pre-authorising refunds — releasing £3k of cash in transit.",
    expectedImpact:
      "Combined working capital improvements release £23k–£43k within 60 days, extending cash runway from 3.4 to 4.6–5.8 months. This creates sufficient headroom to fund the next growth cycle without debt.",
    confidence: "medium",
  },

  opportunities: {
    pageId: "opportunities",
    question: "Which opportunity should I tackle first for the fastest profit impact?",
    verdict:
      "Discount optimisation is your highest-impact, lowest-effort opportunity and should be actioned this week. It requires no new budget, no operational change, and directly recovers cash. The combined recoverable contribution across all identified opportunities is £18k–£42k per month.",
    evidence: [
      "Discount recovery (to 11%) is the single largest opportunity at £12k–£18k/month — achievable in 2 weeks.",
      "Budget reallocation from Meta to Email + Google recovers £6k–£9k/month — achievable in 3–4 weeks.",
      "Inventory working capital release recovers £8k–£14k — achievable in 6–8 weeks via supplier negotiation.",
      "Return rate improvement from 8.7% to 7% recovers £3k–£4k/month — achievable via product description and sizing guide updates.",
    ],
    recommendedAction:
      "Start with discount rate reduction today — it is the only opportunity that is immediately reversible if volume is impacted. Set a 14-day test: reduce discount cap from 15% to 12% on repeat customers only. Measure contribution per order vs volume daily. If no volume decline, extend to all customers in week 3.",
    expectedImpact:
      "The discount test alone should recover £4k–£8k in the first 14 days. If successful, full rollout recovers £12k–£18k/month. Executing all four opportunities over a 60-day sprint recovers the full £18k–£42k/month range.",
    confidence: "high",
  },

  scenario: {
    pageId: "scenario",
    question: "What combined scenario gives me the best risk-adjusted profit outcome?",
    verdict:
      "A balanced recovery scenario — combining moderate discount reduction, marketing reallocation and working capital optimisation — delivers the best risk-adjusted outcome. Aggressive single-lever scenarios (e.g. 5pp discount cut) carry meaningful volume risk. The balanced path recovers 15–22% more contribution with lower execution risk.",
    evidence: [
      "Discount-only scenario: +£12k–£18k/month contribution but carries 3–5% volume risk if applied too aggressively.",
      "Marketing reallocation scenario: +£6k–£9k/month with near-zero volume risk — purely a budget instruction.",
      "Combined scenario (discount + marketing): +£18k–£27k/month, volume risk mitigated because marketing efficiency gain offsets acquisition volume loss.",
      "Cash consequence: combined scenario improves cash position by £8k–£14k/month, extending runway from 3.4 to 5.1 months.",
    ],
    recommendedAction:
      "Build a 90-day combined scenario: Month 1 — marketing reallocation (lowest risk, fastest); Month 2 — phased discount reduction on returning customers; Month 3 — supplier payment term negotiation. Stack the improvements to compound the contribution recovery and avoid operational overload.",
    expectedImpact:
      "90-day stacked scenario recovers £18k–£27k/month contribution, increases contribution margin by 2.8–4.1pp, and improves the growth quality score from 54 to an estimated 68–74. Cash runway extends by 1.7 months.",
    confidence: "medium",
  },

  alerts: {
    pageId: "alerts",
    question: "Which areas of my business need proactive monitoring right now?",
    verdict:
      "Marketing efficiency and cash position are the two areas most likely to deteriorate without early warning. Your Meta CAC has been volatile, and cash headroom is narrowing — both warrant active monitoring to prevent surprises.",
    evidence: [
      "Meta CAC increased 18% last week — without an alert this would typically go unnoticed until month-end review.",
      "Cash runway is 3.4 months, below the 4-month comfortable threshold, and tightening by approximately £4k per month.",
      "Discount dependency rose from 26% to 34% over the past 8 weeks — a trend that accelerates margin erosion if unchecked.",
      "Contribution margin fell below 40% twice in the last 6 weeks — both instances required CFO-level decisions.",
    ],
    recommendedAction:
      "Enable the Meta CAC alert, contribution margin threshold alert and cash runway alert immediately. Set the Meta CAC threshold at 15% week-on-week increase and the margin alert at 40%. Review the weekly CFO digest to catch slow-moving risks before they compound.",
    expectedImpact:
      "Early-warning alerts on these three metrics could prevent £8k–£18k per month of undetected margin and cash erosion. Proactive monitoring typically reduces the time-to-decision by 3–4 weeks per issue identified.",
    confidence: "high",
  },
};
