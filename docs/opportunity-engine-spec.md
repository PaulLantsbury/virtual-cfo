Night Scout Opportunity Engine — Technical Specification
Version 1.0
1. Purpose
The Opportunity Engine is the calculation layer that powers Night Scout recommendations.
It standardises how Night Scout calculates:
recoverable value
confidence
priority
recommended actions
launch plans
alerts
The engine ensures every page is driven by the same CFO logic.

2. Core Output
Every opportunity should return the same object shape:
type Opportunity = {
  id: string;
  page: string;
  title: string;
  category: string;

  currentValue: number;
  targetValue: number;
  performanceGap: number;

  revenueBase: number;
  grossOpportunityValue: number;
  confidenceScore: number;
  adjustedOpportunityValue: number;

  trendDirection:
    | "rapidly_improving"
    | "improving"
    | "stable"
    | "deteriorating"
    | "rapidly_deteriorating";

  trendSeverityScore: number;
  priorityScore: number;

  confidenceLabel: "Low" | "Medium" | "High";
  priorityLabel: "Low" | "Medium" | "High" | "Very High";

  recommendedAction: string;
  explanation: string;

  dataMaturityLevel: 1 | 2 | 3;
};

3. Data Maturity Levels
Night Scout must adapt to the amount of history available.
Level 1: 0–3 months of data
Use:
current performance
benchmark comparison
Do not use:
historic best
YoY trend
Confidence cap:
0.4

Level 2: 3–12 months of data
Use:
current performance
benchmark comparison
best period to date
Confidence cap:
0.7

Level 3: 12+ months of data
Use:
current performance
best rolling 3-month average
rolling YoY trend
benchmark comparison
Confidence cap:
1.0

4. Performance Gap Logic
The engine should calculate the gap between current performance and the target.
Preferred target order:
historic best rolling 3-month average
benchmark
best period to date
safe default target
Do not use best month ever as the primary target.
Example:
performanceGap = targetValue - currentValue
For metrics where lower is better:
performanceGap = currentValue - targetValue
Examples where lower is better:
discount rate
CAC
return rate
inventory days
overhead load
Examples where higher is better:
contribution margin
profit margin
repeat purchase rate
cash runway
profit conversion

5. Opportunity Value Calculation
Base formula:
grossOpportunityValue =
  performanceGap * revenueBase
Adjusted formula:
adjustedOpportunityValue =
  grossOpportunityValue * confidenceScore
Example:
currentMargin = 0.42
targetMargin = 0.49
performanceGap = 0.07
revenueBase = 500000
grossOpportunityValue = 35000
confidenceScore = 0.8
adjustedOpportunityValue = 28000
Displayed opportunity:
£28,000

6. Trend Direction Logic
For mature businesses, trend should primarily use rolling YoY comparison.
Example:
currentMonthYoY = -0.04
previousMonthYoY = -0.01
threeMonthYoY = 0.02
Classify:
rapidly_improving
improving
stable
deteriorating
rapidly_deteriorating
Suggested logic:
if trendSlope >= 0.05:
  rapidly_improving

if trendSlope >= 0.02:
  improving

if trendSlope > -0.02 && trendSlope < 0.02:
  stable

if trendSlope <= -0.02:
  deteriorating

if trendSlope <= -0.05:
  rapidly_deteriorating
For businesses with less than 12 months of data, use sequential trend instead:
latest period vs prior period
rolling 3-period movement
volatility-adjusted confidence

7. Trend Severity Score
Trend direction converts into a score:
rapidly_improving: 0.7
improving: 0.85
stable: 1.0
deteriorating: 1.2
rapidly_deteriorating: 1.4
Deteriorating trends increase priority.
Improving trends reduce urgency but do not eliminate opportunity.

8. Confidence Score
Confidence should reflect how reliable the opportunity estimate is.
Inputs:
data maturity
data completeness
volatility
trend consistency
benchmark reliability
number of supporting signals
Suggested starting formula:
confidenceScore =
  baseMaturityConfidence
  * dataCompletenessFactor
  * trendConsistencyFactor
  * volatilityFactor
  * benchmarkReliabilityFactor
Apply maturity cap:
confidenceScore = min(confidenceScore, maturityConfidenceCap)
Labels:
0.0 - 0.49 = Low
0.5 - 0.74 = Medium
0.75 - 1.0 = High

9. Priority Score
Priority determines what Night Scout recommends first.
Formula:
priorityScore =
  adjustedOpportunityValue
  * trendSeverityScore
  * easeOfExecutionScore
  * cashImpactScore
Suggested additional scores:
easeOfExecutionScore:
  low effort = 1.2
  medium effort = 1.0
  high effort = 0.8

cashImpactScore:
  strong positive cash impact = 1.2
  neutral cash impact = 1.0
  negative cash impact = 0.8
Priority labels:
Very High
High
Medium
Low

10. Page Application
Growth Quality
Opportunity examples:
poor repeat purchase
low customer quality
weak profit per new customer
deteriorating retention
Revenue base:
recent revenue
cohort revenue
customer-level revenue
Target:
historic best repeat purchase
benchmark repeat purchase
best rolling customer quality score

Margin Recovery
Opportunity examples:
discount dependency
shipping cost pressure
returns leakage
payment/fulfilment cost drag
Revenue base:
net revenue
gross revenue
order volume × per-order gap
Target:
best rolling contribution margin
benchmark contribution margin
best rolling discount rate

Profit Growth
Opportunity examples:
discount leakage
fixed cost pressure
returns and leakage
poor profit conversion
Revenue base:
monthly revenue
contribution after variable costs
fixed cost base
Target:
best rolling profit margin
benchmark profit conversion
best overhead load

Cash Control
Opportunity examples:
inventory trapped cash
debtor drag
supplier timing
runway deterioration
Revenue base:
inventory value
receivables
payables
monthly cash burn
Target:
best rolling working capital days
benchmark inventory days
safe runway threshold

Opportunity Finder
Purpose:
Aggregate all opportunities.
Sort by:
priorityScore
Group into:
High Confidence Opportunities
Emerging Opportunities
Watch List

Profit Launchpad
Purpose:
Combine opportunities into recommended routes.
Input:
top opportunities
priority scores
cash impact
confidence
effort
timing
Output:
recommended route
alternative routes
plan impact
implementation roadmap

Alerts
Purpose:
Trigger alerts when an opportunity meaningfully changes.
Examples:
priority score moves from Medium to High
opportunity value increases by more than 20%
trend changes from stable to deteriorating
cash runway falls below threshold
confidence increases enough to recommend action

11. Explanation Logic
Every opportunity should be explainable in plain English.
Example explanation:
Night Scout estimates £18,000 is recoverable because discounting is 6 percentage points above your best rolling 3-month level, the gap has widened for two consecutive periods, and similar businesses typically operate with lower promotional dependency.
Each explanation should include:
current performance
target performance
gap
trend
confidence
recommended action

12. Guardrails
The Opportunity Engine must avoid overclaiming.
Rules:
never show high confidence with less than 3 months of data
never rely only on external benchmarks
never use best month ever as the target
cap confidence for immature businesses
reduce confidence for volatile metrics
avoid showing exact values where confidence is low
explain estimates as recoverable potential, not guaranteed savings
Preferred language:
appears recoverable
could recover
estimated opportunity
potential improvement
Avoid:
will save
guaranteed
certain

13. Implementation Phases
Phase 1: Centralise opportunity calculations
Create shared utility functions:
calculatePerformanceGap()
calculateTrendDirection()
calculateConfidenceScore()
calculateOpportunityValue()
calculatePriorityScore()

Phase 2: Apply to core pages
Start with:
Margin Recovery
Profit Growth
Opportunity Finder
Profit Launchpad

Phase 3: Apply to remaining pages
Then apply to:
Growth Quality
Pricing / Discount Recovery
Marketing Efficiency
Cash Control

Phase 4: Add explanations and alerts
Use the engine to power:
AI CFO explanations
Night Scout Alerts
weekly briefing
launch plan monitoring

14. Final Principle
The Opportunity Engine exists to make Night Scout behave like a CFO.
It should not simply report metrics.
It should identify:
what matters
why it matters
how much is at stake
how confident Night Scout is
what should happen next



APPENDIX: Page-Level Application
Version: 1.0
Purpose:
Translate the Night Scout Calculation Logic into a practical implementation framework.
This document defines:
Inputs
Targets
Confidence logic
Opportunity calculations
Priority calculations
for every major Night Scout page.

Global Engine Structure
Every page follows:
Current State
↓
Performance Gap
↓
Trend Analysis
↓
Confidence Adjustment
↓
Opportunity Value
↓
Priority Score
↓
Recommendation

Shared Functions
All pages should eventually use common utilities:
calculatePerformanceGap()

calculateTrendDirection()

calculateConfidenceScore()

calculateOpportunityValue()

calculatePriorityScore()

generateRecommendation()
These become the core Opportunity Engine.

Growth Quality
Objective
Measure whether growth is creating long-term value.

Inputs
Revenue
Orders
Customers
Repeat customers
AOV
CAC
LTV

Current State
Current repeat purchase rate
Current customer quality score
Current LTV/CAC ratio

Target
Priority:
Best rolling 3-month average
Benchmark
Best period to date

Revenue Base
Revenue from new customer cohorts.

Opportunity Calculation
Estimate recoverable revenue and profit from improved customer quality.

Outputs
Growth Quality Score
Recoverable Growth Value
Priority Score
Confidence

Margin Recovery
Objective
Identify contribution leakage.

Inputs
Revenue
COGS
Discounts
Shipping
Returns
Transaction fees
Contribution margin

Current State
Current contribution margin.

Target
Best rolling 3-month contribution margin.
Fallback:
Benchmark contribution margin.

Revenue Base
Net sales.

Opportunities
Discounting
Shipping
Returns
Fees

Opportunity Formula
Margin Gap
× Revenue
× Confidence

Outputs
Recoverable Contribution
Opportunity Ranking
Priority Score

Profit Growth
Objective
Identify profit trapped in the business.

Inputs
Contribution
Overheads
Profit
Discounting
Returns
Staff costs

Current State
Current profit margin.
Current overhead load.

Target
Best rolling 3-month profit conversion.
Benchmark profit conversion.

Revenue Base
Monthly revenue.

Opportunities
Discounting
Fixed costs
Returns & leakage
Revenue quality

Outputs
Recoverable Profit
Priority Ranking
Recommended Actions

Cash Control
Objective
Identify trapped cash.

Inputs
Inventory
Receivables
Payables
Cash balance
Cash burn
Revenue

Current State
Current cash runway.
Current working capital position.

Targets
Best rolling working capital position.
Benchmark inventory days.
Safe runway thresholds.

Opportunities
Inventory reduction
Receivable collection
Payable optimisation
Runway extension

Outputs
Recoverable Cash
Cash Risk Score
Priority Actions

Growth Efficiency
(Marketing Efficiency)
Objective
Improve profitable customer acquisition.

Inputs
Spend
Revenue
Orders
CAC
ROAS
Contribution by channel

Current State
Channel efficiency.

Target
Best rolling channel efficiency.
Benchmark CAC.
Benchmark ROAS.

Opportunities
Reduce inefficient spend.
Increase high-return spend.
Improve acquisition mix.

Outputs
Recoverable Marketing Contribution
Channel Ranking
Priority Actions

Discount Recovery
(Pricing)
Objective
Identify profit lost through pricing and promotions.

Inputs
Discount %
Full-price sales %
Contribution per order
AOV
Returns

Target
Best rolling discount profile.
Benchmark discount profile.

Opportunities
Discount reduction
Full-price mix
Promotion efficiency

Outputs
Recoverable Contribution
Pricing Confidence
Priority Actions

Opportunity Finder
Objective
Aggregate all opportunities.

Inputs
All page opportunities.

Logic
Collect:
Adjusted Opportunity Value
Priority Score
Confidence

Grouping
High Confidence Opportunities
Confidence > 75%
Priority High

Emerging Opportunities
Confidence 50–75%

Watch List
Confidence < 50%

Sort Order
Priority Score descending.

Profit Launchpad
Objective
Build recommended routes.

Inputs
Top-ranked opportunities.
Priority Scores.
Confidence Scores.
Cash Impact.
Ease Of Execution.

Route Types
Profit Focus
Cash Focus
Balanced Growth

Route Scoring
Total Opportunity
× Confidence
× Ease Of Execution
× Cash Impact

Output
Recommended Route
Alternative Routes
Implementation Plan

Night Scout Alerts
Objective
Notify when an opportunity changes materially.

Alert Triggers
Priority Score changes.
Confidence changes.
Trend changes.
Opportunity value changes.
Cash risk thresholds.

Examples
Opportunity Increased
Recoverable contribution increased from £14k to £22k.

Priority Escalated
Discount dependency moved from Medium to High priority.

Trend Reversal
Margin changed from improving to deteriorating.

Weekly Night Scout Briefing
Inputs
All opportunity changes.
All priority changes.
All alerts.

Output
Good morning.
Largest opportunity:
£18k Discount Dependency
Largest change:
Cash runway improved by 12 days.
Recommended action:
Reduce blanket discounting.

Technical Roadmap
Phase 1
Build shared engine functions.

Phase 2
Apply to:
Margin Recovery
Profit Growth
Opportunity Finder
Profit Launchpad

Phase 3
Apply to:
Growth Quality
Growth Efficiency
Discount Recovery
Cash Control

Phase 4
Power:
Alerts
Weekly Briefings
Mission Control

Final Principle
Night Scout does not optimise pages.
Night Scout optimises decisions.
Every opportunity should answer:
What is wrong?
How much is available?
How confident are we?
What should happen next?
