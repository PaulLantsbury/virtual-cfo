# Night Scout Calculation Logic

## Purpose

Night Scout is not a reporting dashboard.

Night Scout is an AI CFO.

Its purpose is not simply to explain what happened.

Its purpose is to identify:

* Where performance is below potential
* Whether performance is improving or deteriorating
* How much value is realistically recoverable
* Which actions should be prioritised first

Every opportunity value, recommendation, priority score and launch plan in Night Scout should be generated using the same underlying methodology.

This document defines that methodology.

---

# Core Principle

Night Scout does not ask:

"What happened?"

Night Scout asks:

"What should I do next?"

Every calculation should support that objective.

---

# The Night Scout Opportunity Engine

Every opportunity shown in Night Scout is built from five layers:

1. Current Performance
2. Direction of Travel
3. Historic Best Performance
4. Benchmark Comparison
5. Confidence Score

These are combined to calculate:

* Opportunity Value
* Priority Score
* Recommended Actions

---

# Layer 1: Current Performance

This establishes the current position of the business.

Examples:

* Revenue
* Contribution Margin
* Profit Margin
* Discount Rate
* Marketing Efficiency
* Repeat Purchase Rate
* Inventory Days
* Cash Runway

Example:

Current Contribution Margin

42%

This answers:

"Where are we today?"

---

# Layer 2: Direction Of Travel

Night Scout evaluates whether performance is improving or deteriorating.

To avoid seasonality distortion, Night Scout should not primarily compare one month to the previous month.

Instead it uses:

## Rolling Year-On-Year Trend

Example:

| Month    | Margin YoY |
| -------- | ---------- |
| February | -6%        |
| March    | -4%        |
| April    | -2%        |

Conclusion:

Improving

Although still below target, the gap is narrowing.

---

Another example:

| Month    | Margin YoY |
| -------- | ---------- |
| February | +2%        |
| March    | -1%        |
| April    | -4%        |

Conclusion:

Deteriorating

Performance is moving in the wrong direction.

---

Trend direction becomes a major component of prioritisation.

Night Scout should classify trends as:

* Rapidly Improving
* Improving
* Stable
* Deteriorating
* Rapidly Deteriorating

---

# Layer 3: Historic Best Performance

Night Scout assumes that a business's own proven performance is usually more valuable than a generic benchmark.

Example:

Current Margin:

42%

Best Rolling 3-Month Margin:

49%

Gap:

7 percentage points

This answers:

"What has this business already proven it can achieve?"

---

IMPORTANT

Night Scout should not use:

Best Month Ever

This can create distortions.

Instead Night Scout should use:

Best Rolling 3-Month Average

This creates a more realistic target.

---

# Layer 4: Benchmark Comparison

Benchmarks are used as a sense check.

Examples:

* Ecommerce Contribution Margin
* Marketing Efficiency
* Repeat Purchase Rate
* Inventory Days
* Cash Conversion Cycle

Benchmarks help identify:

* Structural weaknesses
* Unusual performance
* Potential opportunities

However benchmarks should not override business-specific history.

Priority order:

1. Historic Best
2. Benchmark
3. Current Performance

---

# Layer 5: Confidence Score

Not every opportunity is equally achievable.

Night Scout assigns a confidence score based on:

* Data quality
* Trend consistency
* Historical volatility
* Benchmark reliability
* Number of supporting signals
* Business maturity

Confidence levels:

High

Stable trends.
Strong historical evidence.
Reliable benchmark comparison.

Medium

Some volatility.
Moderate evidence.

Low

Limited history.
Highly volatile performance.

---

# Opportunity Value Calculation

Night Scout estimates recoverable value using:

Opportunity Value

=

Performance Gap

×

Relevant Revenue Base

×

Confidence Score

---

Example

Current Margin:

42%

Historic Best:

49%

Gap:

7%

Revenue:

£500,000

Gross Opportunity:

£35,000

Confidence:

80%

Opportunity Value:

£28,000

This becomes the opportunity value shown within the platform.

---

# Priority Score Calculation

Not all opportunities should be tackled first.

Night Scout prioritises using:

Priority Score

=

Opportunity Value

×

Trend Severity

×

Confidence Score

---

Example

Discount Dependency

Opportunity:

£18,000

Trend:

Rapidly Deteriorating

Confidence:

High

Priority:

Very High

---

Example

Shipping Costs

Opportunity:

£22,000

Trend:

Stable

Confidence:

Medium

Priority:

Medium

Although shipping is technically worth more, Night Scout recommends tackling discount dependency first.

This mirrors how a CFO would prioritise actions.

---

# Recommendation Logic

Night Scout recommendations should not simply identify the largest opportunity.

Recommendations should consider:

* Opportunity Value
* Trend Direction
* Confidence
* Ease Of Execution
* Time To Benefit
* Cash Impact

This allows Night Scout to answer:

"Do this first."

rather than:

"This is the biggest number."

---

# Business Maturity Framework

Night Scout must adapt its calculations based on the amount of historical data available.

This prevents newer businesses generating unreliable recommendations.

---

## Maturity Level 1

0–3 Months Of Data

Inputs:

* Current Performance
* Benchmark Comparison

Confidence Cap:

40%

Historic performance is ignored.

Opportunity values should be conservative.

---

## Maturity Level 2

3–12 Months Of Data

Inputs:

* Current Performance
* Benchmark Comparison
* Best Period To Date

Confidence Cap:

70%

Historic best becomes available but remains limited.

---

## Maturity Level 3

12+ Months Of Data

Inputs:

* Current Performance
* Historic Best
* Rolling YoY Trend
* Benchmark Comparison

Confidence Cap:

100%

This becomes the full Night Scout model.

---

# Why Confidence Matters

Example:

Opportunity:

£30,000

Confidence:

80%

Displayed Opportunity:

£24,000

---

Another Example:

Opportunity:

£30,000

Confidence:

40%

Displayed Opportunity:

£12,000

This prevents Night Scout making unrealistic claims when evidence is weak.

---

# Page-Level Application

Every Night Scout page should use the same Opportunity Engine.

---

## Growth Quality

Uses:

* Growth Gap
* Growth Trend
* Historic Best
* Benchmark
* Confidence

Produces:

Recoverable Growth Value

---

## Margin Recovery

Uses:

* Margin Gap
* Margin Trend
* Historic Best
* Benchmark
* Confidence

Produces:

Recoverable Contribution

---

## Profit Growth

Uses:

* Profit Gap
* Profit Trend
* Historic Best
* Benchmark
* Confidence

Produces:

Recoverable Profit

---

## Cash Control

Uses:

* Inventory Gap
* Debtor Gap
* Creditor Gap
* Cash Conversion Gap
* Confidence

Produces:

Recoverable Cash Opportunity

---

## Opportunity Finder

Aggregates opportunities across the platform.

Ranks them using:

Priority Score

---

## Profit Launchpad

Builds recommended routes using:

Combined Priority Scores

*

Combined Opportunity Values

*

Confidence Scores

Produces:

Night Scout Recommended Route

---

# User Explanation Framework

Every opportunity should be explainable.

When a user asks:

"Why is this opportunity worth £18,000?"

Night Scout should be able to explain:

* Current performance
* Historic best performance
* Trend direction
* Benchmark comparison
* Confidence level
* Calculation logic

This creates trust.

---

# Final Principle

Night Scout is not trying to answer:

"What happened?"

Night Scout is trying to answer:

"What should I do next?"

Every page, recommendation, opportunity value and action plan should be generated from that principle.
