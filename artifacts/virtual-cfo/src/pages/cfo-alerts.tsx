import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { canAccess, isProUser } from "@/lib/plan";
import { cn } from "@/lib/utils";

type StatusTone = "green" | "amber" | "red";
type Period = "Daily" | "Weekly" | "Monthly";
type Delivery = "Email" | "In-app" | "Both";

interface AttentionItem {
  title: string;
  freeTitle: string;
  why: string;
  trend: string;
  page: string;
  href: string;
  tone: StatusTone;
}

interface PlanItem {
  action: string;
  freeAction: string;
  status: string;
  trend: string;
  tone: StatusTone;
  detail: string;
}

interface InsightItem {
  title: string;
  text: string;
  tone: StatusTone;
}

const TONE_STYLES: Record<StatusTone, { badge: string; dot: string; text: string; panel: string }> = {
  green: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-300",
    dot:   "bg-emerald-500",
    text:  "text-emerald-700 dark:text-emerald-300",
    panel: "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/15",
  },
  amber: {
    badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-300",
    dot:   "bg-amber-500",
    text:  "text-amber-700 dark:text-amber-300",
    panel: "border-amber-200/70 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/15",
  },
  red: {
    badge: "border-destructive/20 bg-destructive/10 text-destructive",
    dot:   "bg-destructive",
    text:  "text-destructive",
    panel: "border-destructive/20 bg-destructive/10",
  },
};

const ATTENTION_ITEMS: AttentionItem[] = [
  {
    title: "Discount dependency increasing",
    freeTitle: "Pricing needs attention",
    why: "Promotion reliance is still the highest-priority pressure on contribution quality.",
    trend: "Worsening",
    page: "Review Opportunity Finder",
    href: "/profit-opportunities",
    tone: "red",
  },
  {
    title: "Marketing efficiency deteriorating",
    freeTitle: "Marketing efficiency needs attention",
    why: "Paid acquisition is not yet showing enough improvement against the current plan.",
    trend: "Worsening",
    page: "Review Growth Efficiency",
    href: "/marketing-efficiency",
    tone: "amber",
  },
  {
    title: "Cash runway tightening",
    freeTitle: "Cash runway needs attention",
    why: "Working-capital pressure remains a monitoring priority while inventory and payables settle.",
    trend: "Stable risk",
    page: "Review Cash Control",
    href: "/cash-control",
    tone: "amber",
  },
  {
    title: "Inventory days worsening",
    freeTitle: "Inventory needs attention",
    why: "Stock is still tying up cash that could support the recovery plan.",
    trend: "Watch",
    page: "Review Profit Launchpad",
    href: "/scenario-lab",
    tone: "amber",
  },
];

const PLAN_PROGRESS: PlanItem[] = [
  {
    action: "Reduce discount dependency",
    freeAction: "Pricing recovery",
    status: "Improving",
    trend: "Positive movement",
    tone: "green",
    detail: "Discount-driven revenue is moving in the right direction after the first pricing action.",
  },
  {
    action: "Improve marketing efficiency",
    freeAction: "Marketing efficiency",
    status: "Stable",
    trend: "No material change",
    tone: "amber",
    detail: "CAC pressure has stopped worsening, but there is not enough evidence of improvement yet.",
  },
  {
    action: "Reduce shipping costs",
    freeAction: "Margin recovery",
    status: "Not started",
    trend: "No movement",
    tone: "red",
    detail: "Fulfilment pressure remains open and needs an owner before the next review.",
  },
  {
    action: "Improve inventory days",
    freeAction: "Cash release",
    status: "Improving",
    trend: "Positive movement",
    tone: "green",
    detail: "Inventory pressure is easing, which should support cash runway if the trend continues.",
  },
];

const INSIGHTS: InsightItem[] = [
  {
    title: "Contribution margin has improved",
    text: "Contribution margin has improved for three consecutive weeks.",
    tone: "green",
  },
  {
    title: "Discount pressure is easing",
    text: "Discount pressure is easing faster than expected after the pricing recovery actions.",
    tone: "green",
  },
  {
    title: "Cash runway has stabilised",
    text: "Cash runway has stabilised but remains under watch.",
    tone: "amber",
  },
  {
    title: "Marketing still needs attention",
    text: "Marketing efficiency still needs attention before the plan can be considered fully on track.",
    tone: "amber",
  },
  {
    title: "Inventory days reduced",
    text: "Inventory days reduced modestly this week.",
    tone: "green",
  },
  {
    title: "AOV remains stable",
    text: "AOV remains within the expected range.",
    tone: "green",
  },
];

const ALERT_HISTORY = [
  "Discount dependency moved from risk to watch after the pricing action.",
  "Cash runway stopped declining after the working-capital review.",
  "Meta CAC remained elevated for two weekly checks.",
  "Inventory days improved after stock purchasing slowed.",
];

const FREE_STATUS = [
  { area: "Pricing recovery", status: "Improving", tone: "green" as const },
  { area: "Marketing efficiency", status: "Needs attention", tone: "amber" as const },
  { area: "Cash control", status: "Stable", tone: "green" as const },
  { area: "Inventory discipline", status: "Improving", tone: "green" as const },
];

const UNLOCK_BULLETS = [
  "See which actions are working",
  "Spot stalled or worsening areas",
  "Track weekly, daily or monthly movement",
  "Receive CFO-style monitoring updates",
  "Know what needs attention next",
];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ToneBadge({ tone, children }: { tone: StatusTone; children: string }) {
  const styles = TONE_STYLES[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", styles.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {children}
    </span>
  );
}

export default function CfoAlerts() {
  const isPro = isProUser();
  const canControl = canAccess("cfo_alerts_controls");
  const [frequency, setFrequency] = useState<Period>("Weekly");
  const [delivery, setDelivery] = useState<Delivery>("In-app");

  return (
    <AppLayout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Night Scout Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track whether Night Scout&apos;s recommendations are improving profit, cash and growth.
          </p>
        </div>
      </div>

      {/* ── Monitoring verdict ─────────────────────────────────────────────── */}
      <div className="sc-purple rounded-2xl px-6 py-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-2">Monitoring verdict</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              {isPro
                ? "Execution is improving. Two priority actions are showing positive movement."
                : "Plan is improving, but one area still needs attention."}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              {isPro
                ? "Night Scout is seeing early improvement in contribution quality and inventory discipline. Marketing efficiency still needs attention before the recovery plan can be considered fully on track."
                : "Night Scout has detected early progress against the recommended plan. Upgrade to see which actions are working, which are stalled and what changed this week."}
            </p>
          </div>
          <div className="w-full lg:w-72 rounded-xl border border-indigo-300/15 bg-indigo-950/20 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70 mb-2">Monitoring status</p>
            <ToneBadge tone="green">Plan improving</ToneBadge>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{isPro ? "Profit signals improving" : "One area needs attention"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>{isPro ? "Marketing remains under watch" : "Detailed monitoring available on Pro"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isPro && (
        <>
          <section className="mb-8">
            <SectionHeader
              title="Monitoring Status"
              subtitle="A high-level read on whether the plan is moving in the right direction."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FREE_STATUS.map((item) => {
                const styles = TONE_STYLES[item.tone];
                return (
                  <div key={item.area} className="rounded-xl border border-border/50 bg-card px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{item.area}</p>
                      <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
                    </div>
                    <p className={cn("text-sm font-bold mt-2", styles.text)}>{item.status}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mb-8">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div>
                  <p className="text-base font-bold text-foreground">Unlock Night Scout Monitoring</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                    Track whether the recommended plan is working, see which actions are improving performance and receive proactive CFO updates.
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 mt-4">
                    {UNLOCK_BULLETS.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href="/upgrade" className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0">
                  Unlock Monitoring
                </Link>
              </div>
            </div>
          </section>

          <AiCfoAskCard pageId="alerts" className="mb-8" />

          <DataBenchmarkAssumptions
            benchmarkNote="Monitoring status is based on broad movement across the current Night Scout plan."
            dataQualityNote="Monitoring commentary uses the same connected business data and mock status layer currently used across the app."
            confidenceNote="Night Scout prioritises material movement and management-control actions rather than every metric fluctuation."
            className="mb-2"
          />
        </>
      )}

      {isPro && (
        <>

      {/* ── Actions requiring attention ─────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader
          title="Actions Requiring Attention"
          subtitle="Highest-priority areas Night Scout is watching right now."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ATTENTION_ITEMS.map((item) => {
            const styles = TONE_STYLES[item.tone];
            return (
              <div key={item.title} className={cn("rounded-2xl border p-5", styles.panel)}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.why}</p>
                  </div>
                  <ToneBadge tone={item.tone}>{item.trend}</ToneBadge>
                </div>
                <Link href={item.href} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  {item.page}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Plan progress ──────────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader
          title="Plan Progress"
          subtitle="Progress against the current Night Scout recommendation plan."
        />
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr] gap-3 px-5 py-3 border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
            <span>Action</span>
            <span>Status</span>
            <span>Trend</span>
          </div>
          <div className="divide-y divide-border/40">
            {PLAN_PROGRESS.map((item) => (
              <div key={item.action} className="grid grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr] gap-3 px-5 py-4 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{isPro ? item.action : item.freeAction}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.detail}</p>
                </div>
                <span className="text-sm text-foreground">{item.status}</span>
                <ToneBadge tone={item.tone}>{item.trend}</ToneBadge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Night Scout insights ───────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader title="Monitoring Insights" subtitle="CFO commentary from the latest monitoring pass." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {INSIGHTS.map((insight) => {
            const Icon = insight.tone === "green" ? TrendingUp : Eye;
            return (
              <div key={insight.title} className="rounded-2xl border border-border/50 bg-card px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", TONE_STYLES[insight.tone].badge)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{insight.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {insight.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

        <section className="mb-8">
          <SectionHeader title="Monitoring History" subtitle="Recent monitoring events and follow-up checks." />
          <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/40">
            {ALERT_HISTORY.map((item) => (
              <div key={item} className="flex items-start gap-3 px-5 py-4">
                <Activity className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </section>

      {/* ── Monitoring settings ────────────────────────────────────────────── */}
      {canControl && (
        <section className="mb-8">
          <details className="rounded-2xl border border-border/50 bg-card px-5 py-5">
            <summary className="cursor-pointer list-none">
              <SectionHeader
                title="Monitoring Settings"
                subtitle="Night Scout decides what matters. Choose the CFO update cadence."
              />
            </summary>
            <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Frequency</p>
              <div className="flex flex-wrap gap-2">
                {(["Daily", "Weekly", "Monthly"] as Period[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFrequency(option)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                      frequency === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option}{option === "Weekly" ? " (recommended)" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Delivery</p>
              <div className="flex flex-wrap gap-2">
                {(["Email", "In-app", "Both"] as Delivery[]).map((option) => {
                  const Icon = option === "Email" ? Mail : option === "In-app" ? Activity : ShieldCheck;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDelivery(option)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                        delivery === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>
          </details>
        </section>
      )}

      <AiCfoAskCard pageId="alerts" className="mb-8" />

      <DataBenchmarkAssumptions
        benchmarkNote="Monitoring status is based on movement across profit, cash, growth and plan-progress indicators."
        dataQualityNote="Monitoring commentary uses the same connected business data and mock status layer currently used across the app."
        confidenceNote="Night Scout prioritises material movement and management-control actions rather than every metric fluctuation."
        className="mb-2"
      />
        </>
      )}
    </AppLayout>
  );
}
