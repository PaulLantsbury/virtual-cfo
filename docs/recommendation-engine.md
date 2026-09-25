Night Scout Recommendation Engine
Technical Specification v1
Purpose
The Recommendation Engine is the decision layer in Night Scout.
It takes the opportunities identified by the Opportunity Engine and decides:
Which opportunity should be tackled first
Which opportunities should be grouped together
Which actions should appear in the Morning Briefing
Which actions should appear in Opportunity Finder
Which route should be recommended in Profit Launchpad
Which items should be monitored in Night Scout Monitoring
The Recommendation Engine exists to make Night Scout behave like a CFO.
It should not simply recommend the largest number.
It should recommend the best next action.

Core Principle
Night Scout should answer:
"What should I do next?"
not:
"Which metric changed the most?"
Recommendations should balance:
financial value
urgency
confidence
ease of execution
cash impact
time to benefit
strategic fit

Input
The Recommendation Engine receives opportunity objects from the Opportunity Engine.
Each opportunity should contain:
type Opportunity = {
  id: string;
  title: string;
  category: string;

  adjustedOpportunityValue: number;
  priorityScore: number;

  confidenceLabel: "Low" | "Medium" | "High";
  priorityLabel: "Do First" | "High Priority" | "Next Up" | "Watch List";

  trendDirection:
    | "rapidly_improving"
    | "improving"
    | "stable"
    | "deteriorating"
    | "rapidly_deteriorating";

  easeOfExecution: "Low" | "Medium" | "High";
  timeToBenefit: "Immediate" | "Short" | "Medium" | "Long";
  cashImpact: "Positive" | "Neutral" | "Negative";

  pageSource:
    | "Growth Quality"
    | "Margin Recovery"
    | "Growth Efficiency"
    | "Discount Recovery"
    | "Profit Growth"
    | "Cash Control";

  recommendedAction: string;
  rationale: string;
};

Recommendation Score
The engine should calculate a recommendation score.
This score is used internally only.
Users should see plain-English labels such as:
Do First
High Priority
Next Up
Watch List
Formula:
recommendationScore =
  valueScore
  * urgencyScore
  * confidenceScore
  * easeScore
  * timeToBenefitScore
  * cashImpactScore

Score Components
Value Score
Based on adjusted opportunity value.
Higher opportunity value increases recommendation priority.
Example scale:
valueScore:
  low = 0.8
  medium = 1.0
  high = 1.2
  veryHigh = 1.4

Urgency Score
Based on trend direction.
urgencyScore:
  rapidly_deteriorating = 1.4
  deteriorating = 1.2
  stable = 1.0
  improving = 0.85
  rapidly_improving = 0.7
Deteriorating trends should rise in priority.
Improving trends should not disappear, but they should become less urgent.

Confidence Score
Based on confidence label.
confidenceScore:
  High = 1.2
  Medium = 1.0
  Low = 0.7
Low-confidence items should rarely become Do First unless the risk is severe.

Ease Score
Based on execution effort.
easeScore:
  Low effort = 1.2
  Medium effort = 1.0
  High effort = 0.8
Night Scout should prefer actions a founder can actually execute.

Time To Benefit Score
timeToBenefitScore:
  Immediate = 1.2
  Short = 1.1
  Medium = 1.0
  Long = 0.8
Fast wins should be prioritised when all else is equal.

Cash Impact Score
cashImpactScore:
  Positive = 1.2
  Neutral = 1.0
  Negative = 0.8
Actions that improve cash should be prioritised when cash risk is elevated.

Recommendation Labels
Map internal recommendation score to user-facing labels:
Do First:
  highest ranked opportunity with strong confidence and practical actionability

High Priority:
  strong opportunity but slightly lower urgency, confidence or ease

Next Up:
  meaningful opportunity but not the immediate focus

Watch List:
  emerging issue or lower-confidence opportunity
Avoid showing numeric scores to users.

Do First Rules
The Do First recommendation should normally satisfy:
High or Medium confidence
Clear management control
Reasonable time to benefit
Meaningful financial value
Deteriorating, stable or controllable trend
Do First should not normally be:
Low confidence
Long time to benefit
Highly dependent on external factors
Large value but difficult to control

Conflict Rules
If highest value is low confidence
Do not automatically recommend it first.
Example:
High value inventory opportunity
Low confidence
Long time to benefit
Recommendation:
Next Up or Watch List

If lower value is high confidence and easy to execute
It can become Do First.
Example:
Discount reduction
Medium value
High confidence
Low effort
Immediate benefit
Recommendation:
Do First

If cash risk is high
Cash-positive opportunities should be promoted.
Example:
Inventory days worsening
Cash runway below threshold
Recommendation:
High Priority or Do First
even if profit impact is lower.

If multiple opportunities are related
Group them into one recommendation.
Example:
Discount dependency
Low full-price sales
Contribution margin pressure
Group as:
Pricing & Margin Recovery

Output Destinations
The Recommendation Engine feeds multiple parts of Night Scout.

Morning Briefing
Show:
one top recommendation
one key opportunity
one key risk
one positive signal
Example:
"Do first: reduce discount dependency. This remains the highest-confidence route to recover contribution."

Opportunity Finder
Show ranked opportunity list:
Do First
High Priority
Next Up
Watch List
Opportunity Finder is the full ranked list.

Profit Launchpad
Build recommended routes from grouped recommendations.
Example route types:
Profit Focus
Prioritises:
contribution recovery
discount control
margin improvement
Cash Focus
Prioritises:
inventory reduction
runway protection
working capital release
Balanced Growth
Balances:
contribution recovery
cash impact
execution ease
growth preservation

Night Scout Monitoring
Track whether recommendations are improving.
Monitoring status should be based on:
whether the recommended metric is improving
whether the trend is moving in the expected direction
whether the action remains high priority
whether the opportunity value is shrinking or growing

Recommendation Grouping
Recommendations should be grouped into themes where appropriate.
Themes:
Pricing & Margin
Marketing Efficiency
Cash Control
Inventory Discipline
Profit Growth
Growth Quality
This prevents Night Scout showing too many fragmented actions.

Launch Plan Construction
Profit Launchpad should not simply take the top three opportunities.
It should build a coherent plan.
Plan selection factors
combined value
combined confidence
cash impact
execution burden
risk of conflicting actions
Example:
Do not recommend:
increase paid marketing spend
and preserve cash aggressively
unless framed as an alternative route.

Recommended Route Logic
Profit Focus
Choose when:
profit opportunity is large
cash position is stable
margin leakage is high
Cash Focus
Choose when:
cash runway is weak
working capital opportunity is large
growth actions may increase cash risk
Balanced Growth
Choose when:
profit opportunity exists
cash risk exists
growth should continue carefully
Balanced Growth should usually be the default recommendation when there are mixed signals.

Monitoring Logic
Once a recommendation is active, Monitoring should classify progress as:
"Improving"
"Stable"
"Needs Attention"
"Not Started"
Improving
Metric is moving in expected direction.
Stable
No material movement.
Needs Attention
Metric is deteriorating or opportunity value is increasing.
Not Started
No movement detected after recommendation was issued.

Alert Logic
The Recommendation Engine should trigger monitoring alerts when:
Do First item deteriorates
opportunity value increases materially
confidence increases enough to act
active recommendation shows no improvement
cash risk escalates
trend reverses

Explanation Logic
Every recommendation should be explainable.
Example:
"Night Scout recommends discount reduction first because it has high confidence, low execution effort, immediate contribution impact and has deteriorated for three consecutive periods."
Every explanation should include:
why this action
why now
why not something else
expected impact
confidence

Free vs Pro Packaging
Free
Show:
broad recommendation category
priority label
confidence
effort
timing
Hide:
exact action
exact value
detailed rationale
implementation steps
supporting evidence
launch plan
Pro
Show:
exact recommendation
opportunity value
rationale
implementation steps
launch plan
monitoring status

Guardrails
Night Scout should not over-prescribe.
Avoid:
recommending low-confidence actions as Do First
recommending actions that conflict
showing too many priorities
overreacting to one volatile period
using tiny changes as major alerts
Preferred language:
"Night Scout recommends"
"This appears to be"
"Highest-confidence route"
"Worth monitoring"
"Do first"
Avoid:
"Guaranteed"
"Certain"
"Must"
"Will save"

Implementation Phases
Phase 1
Rank opportunities.
Apply:
Do First
High Priority
Next Up
Watch List
Start with:
Opportunity Finder
Morning Briefing

Phase 2
Build grouped recommendations.
Apply to:
Profit Launchpad
Profit Growth
Margin Recovery

Phase 3
Build active plan monitoring.
Apply to:
Night Scout Monitoring
Weekly Briefing

Phase 4
Build explanation layer.
Use recommendation explanations inside:
Ask Night Scout
tooltips
upgrade prompts
weekly emails

Final Principle
The Opportunity Engine finds the money.
The Recommendation Engine decides what to do first.
Night Scout should always make the founder feel:
"I know where to focus next."
This becomes the document sitting directly above the Opportunity Engine spec.
