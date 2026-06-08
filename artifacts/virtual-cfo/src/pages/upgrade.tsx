import { Check, Lock, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { user } from "@/lib/plan";

const FREE_FEATURES = [
  "Dashboard",
  "Growth Quality",
  "Margin Recovery",
  "Cash Control",
  "Profit Growth",
  "AI CFO Chat",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Recovery Plans",
  "Opportunity Values",
  "Growth Simulators",
  "Weekly Night Scout Briefings",
  "AI CFO Recommendations",
  "Cash Forecasting",
  "Growth Modelling",
];

const TRUST_POINTS = [
  "Cancel any time — no long-term commitment",
  "Data stays private — no third-party sharing",
  "Built for Shopify + Xero founders",
];

export default function Upgrade() {
  const isAlreadyPro = user.plan === "pro";

  const handleUpgrade = () => {
    // @billing-integration Replace this with Stripe/RevenueCat checkout session
    alert("Billing integration coming soon. In dev: set sessionStorage.setItem(\"userPlan\", \"pro\") and refresh.");
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">

        {/* ── Page header ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700/50 mb-5">
            <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Pricing
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
            Pricing
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Start by finding the problems, then upgrade when you want Night Scout to tell you exactly what to do next.
          </p>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">

          {/* Free plan */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-7 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Find The Problems
                </p>
                {!isAlreadyPro && (
                  <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
                    Current plan
                  </span>
                )}
              </div>
              <p className="text-4xl font-display font-bold text-foreground leading-none mb-1">
                £0
              </p>
              <p className="text-sm text-muted-foreground">See where opportunity exists.</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <div className="w-full py-2.5 px-4 rounded-xl text-center text-sm font-semibold text-muted-foreground bg-secondary border border-border/50">
                {isAlreadyPro ? "Downgrade" : "Your current plan"}
              </div>
            </div>
          </div>

          {/* Pro plan — featured */}
          <div className={cn(
            "rounded-2xl border-2 shadow-lg p-7 flex flex-col relative overflow-hidden",
            "border-indigo-500 dark:border-indigo-400",
            "bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-card"
          )}>
            {/* Most popular badge */}
            <div className="absolute top-0 right-0">
              <div className="bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-1 rounded-bl-xl">
                Most popular
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3">
                Know Exactly What To Do
              </p>
              <p className="text-4xl font-display font-bold text-foreground leading-none mb-1">
                £49
              </p>
              <p className="text-sm text-muted-foreground">per month</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-sm text-foreground font-medium">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              {isAlreadyPro ? (
                <div className="w-full py-2.5 px-4 rounded-xl text-center text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700/60">
                  ✓ Current plan
                </div>
              ) : (
                <button
                  onClick={handleUpgrade}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-lg shadow-indigo-600/25 transition-colors"
                >
                  Wake Up To Profitable Growth
                </button>
              )}
            </div>
          </div>

        </div>

        {/* ── Trust points ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 mb-12">
          {TRUST_POINTS.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-sm text-muted-foreground">{t}</span>
            </div>
          ))}
        </div>

        {/* ── What you unlock ── */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-7 mb-8">
          <h2 className="text-lg font-bold text-foreground mb-6">What Night Scout unlocks</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                title: "Recovery plans",
                body: "Turn hidden profit leaks into practical actions your team can take this week.",
              },
              {
                title: "Opportunity values",
                body: "See the pound value attached to every recovery opportunity Night Scout identifies.",
              },
              {
                title: "Weekly Night Scout briefings",
                body: "Wake up to the most important insight in your business and the action to focus on next.",
              },
              {
                title: "Cash forecasting",
                body: "Spot future cash pressure before it limits your choices.",
              },
              {
                title: "Growth modelling",
                body: "Test how margin, pricing, marketing and cash decisions affect profitable growth.",
              },
              {
                title: "AI CFO recommendations",
                body: "Get clear recommended actions, not just another place to inspect numbers.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        {!isAlreadyPro && (
          <div className="text-center pb-8">
            <button
              onClick={handleUpgrade}
              className="inline-flex items-center gap-2 py-3 px-8 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-lg shadow-indigo-600/25 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Wake Up To Profitable Growth
            </button>
            <p className="text-xs text-muted-foreground mt-3">No long-term commitment. Cancel any time.</p>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
