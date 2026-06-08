import { useState } from "react";
import {
  Bell, AlertTriangle, CheckCircle2, Lock, Sparkles,
  ChevronDown, ChevronRight, Mail, Smartphone, TrendingDown,
  BarChart2, Wallet, Megaphone, Target, Calendar,
  Eye, ArrowRight, Info, ShoppingCart, Zap, Activity,
  HelpCircle,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { canAccess, isProUser } from "@/lib/plan";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { AiCfoInlineButtons } from "@/components/AiCfoInlineButtons";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { useAiCfo } from "@/components/AiCfoProvider";
import { MONTHLY_CM_PCT } from "@/lib/data/business-snapshot";
import { CASH_RUNWAY } from "@/lib/data/cash-snapshot";
import { DISCOUNT_DEP } from "@/lib/data/growth-metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "red" | "amber" | "green";

interface AlertItem {
  id: string;
  label: string;
  category: string;
  rule: string;
  threshold: string;
  frequency: string;
  method: string;
  severity: Severity;
  lastTriggered?: string;
  recommended?: boolean;
}

interface ReportConfig {
  id: string;
  title: string;
  frequency: string;
  description: string;
  includes: string[];
  frequencies: string[];
}

interface RecentAlertItem {
  date: string;
  alert: string;
  impact: string;
  severity: Severity;
  action: string;
  status: "new" | "reviewed";
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECOMMENDED_ALERTS: AlertItem[] = [
  {
    id: "rec-meta-cac",
    label: "Meta CAC increase",
    category: "Marketing",
    rule: "Alert if Meta CAC rises by more than 15% week-on-week.",
    threshold: ">15% WoW",
    frequency: "Weekly",
    method: "In-app + Email",
    severity: "red",
    recommended: true,
  },
  {
    id: "rec-margin",
    label: "Contribution margin below target",
    category: "Margin",
    rule: "Alert if contribution margin falls below 40%.",
    threshold: "<40%",
    frequency: "Daily",
    method: "In-app",
    severity: "amber",
    recommended: true,
  },
  {
    id: "rec-cash-runway",
    label: "Cash runway tightening",
    category: "Cash",
    rule: "Alert if cash runway falls below 3 months.",
    threshold: "<3 months",
    frequency: "Weekly",
    method: "In-app + Email",
    severity: "amber",
    recommended: true,
  },
  {
    id: "rec-discount",
    label: "Discount dependency rising",
    category: "Pricing",
    rule: "Alert if discount dependency rises above 35%.",
    threshold: ">35%",
    frequency: "Weekly",
    method: "In-app",
    severity: "amber",
    recommended: true,
  },
];

interface CategoryGroup {
  id: string;
  label: string;
  icon: typeof Bell;
  color: string;
  alerts: AlertItem[];
}

const ALERT_CATEGORIES: CategoryGroup[] = [
  {
    id: "sales",
    label: "Sales alerts",
    icon: ShoppingCart,
    color: "text-emerald-600 dark:text-emerald-400",
    alerts: [
      { id: "s1", label: "Daily sales below target",            category: "Sales",   rule: "Alert if daily sales fall below your 30-day average.",         threshold: "<30d avg",  frequency: "Daily",   method: "In-app",         severity: "amber" },
      { id: "s2", label: "Revenue down vs prior 7-day average", category: "Sales",   rule: "Alert if revenue is down more than 10% vs prior 7-day avg.",   threshold: "<-10%",     frequency: "Daily",   method: "In-app",         severity: "amber" },
      { id: "s3", label: "AOV drops by more than 10%",          category: "Sales",   rule: "Alert if average order value drops more than 10%.",            threshold: "<-10%",     frequency: "Weekly",  method: "In-app",         severity: "amber" },
      { id: "s4", label: "Orders fall by more than 15%",        category: "Sales",   rule: "Alert if order count falls more than 15% week-on-week.",       threshold: "<-15% WoW", frequency: "Weekly",  method: "In-app + Email", severity: "red"   },
    ],
  },
  {
    id: "margin",
    label: "Margin alerts",
    icon: TrendingDown,
    color: "text-blue-600 dark:text-blue-400",
    alerts: [
      { id: "m1", label: "Contribution margin below 40%",         category: "Margin", rule: "Alert if contribution margin falls below 40%.",                threshold: "<40%",       frequency: "Daily",   method: "In-app",         severity: "amber", lastTriggered: "2 days ago" },
      { id: "m2", label: "Margin drops by more than 3pp",         category: "Margin", rule: "Alert if margin drops by more than 3 percentage points MoM.",  threshold: ">3pp drop",  frequency: "Monthly", method: "In-app + Email", severity: "red"   },
      { id: "m3", label: "Shipping cost per order rises by 10%",  category: "Margin", rule: "Alert if shipping cost per order rises by more than 10%.",     threshold: ">10%",       frequency: "Weekly",  method: "In-app",         severity: "amber" },
      { id: "m4", label: "Discount dependency exceeds 35%",       category: "Margin", rule: "Alert if discount-driven revenue exceeds 35% of total revenue.", threshold: ">35%",      frequency: "Weekly",  method: "In-app",         severity: "amber" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing alerts",
    icon: Megaphone,
    color: "text-violet-600 dark:text-violet-400",
    alerts: [
      { id: "mk1", label: "Meta CAC rises by more than 15%",   category: "Marketing", rule: "Alert if Meta CAC rises more than 15% week-on-week.",        threshold: ">15% WoW",   frequency: "Weekly",  method: "In-app + Email", severity: "red",   lastTriggered: "Yesterday" },
      { id: "mk2", label: "Google ROAS falls below target",     category: "Marketing", rule: "Alert if Google ROAS falls below your 2.5x target.",         threshold: "<2.5x",      frequency: "Weekly",  method: "In-app",         severity: "amber" },
      { id: "mk3", label: "Blended CAC exceeds target",         category: "Marketing", rule: "Alert if blended CAC exceeds £42 break-even threshold.",      threshold: ">£42",       frequency: "Weekly",  method: "In-app",         severity: "amber" },
      { id: "mk4", label: "CAC payback exceeds 1.6 orders",    category: "Marketing", rule: "Alert if CAC payback period exceeds 1.6 orders.",             threshold: ">1.6 orders", frequency: "Monthly", method: "In-app",         severity: "amber" },
    ],
  },
  {
    id: "cash",
    label: "Cash alerts",
    icon: Wallet,
    color: "text-amber-600 dark:text-amber-400",
    alerts: [
      { id: "c1", label: "Cash runway below 3 months",                   category: "Cash", rule: "Alert if available cash runway falls below 3 months.",              threshold: "<3 months", frequency: "Weekly",  method: "In-app + Email", severity: "amber", lastTriggered: "Monday" },
      { id: "c2", label: "Working capital drag increases by £25k",        category: "Cash", rule: "Alert if working capital drag increases by more than £25k MoM.",   threshold: ">£25k",     frequency: "Monthly", method: "In-app + Email", severity: "red"   },
      { id: "c3", label: "Inventory days exceed 90 days",                 category: "Cash", rule: "Alert if average inventory days on hand exceeds 90 days.",          threshold: ">90 days",  frequency: "Weekly",  method: "In-app",         severity: "amber" },
      { id: "c4", label: "Supplier payments accelerate materially",       category: "Cash", rule: "Alert if supplier payment terms effectively shorten by 7+ days.",   threshold: ">7 days",   frequency: "Monthly", method: "In-app",         severity: "amber" },
    ],
  },
  {
    id: "opportunity",
    label: "Opportunity alerts",
    icon: Target,
    color: "text-rose-600 dark:text-rose-400",
    alerts: [
      { id: "o1", label: "New opportunity worth more than £5k/month detected", category: "Opportunity", rule: "Alert when a new profit opportunity exceeding £5k/month is identified.", threshold: ">£5k/mo",  frequency: "Weekly",  method: "In-app",         severity: "green" },
      { id: "o2", label: "Recoverable contribution exceeds £25k/month",        category: "Opportunity", rule: "Alert if total recoverable contribution rises above £25k/month.",       threshold: ">£25k/mo", frequency: "Weekly",  method: "In-app + Email", severity: "amber" },
      { id: "o3", label: "Discount leakage increases by £10k",                 category: "Opportunity", rule: "Alert if discount leakage increases by more than £10k MoM.",           threshold: ">£10k",    frequency: "Monthly", method: "In-app",         severity: "amber" },
      { id: "o4", label: "Scenario opportunity exceeds £40k/month",            category: "Opportunity", rule: "Alert if a modelled scenario opportunity exceeds £40k/month.",          threshold: ">£40k/mo", frequency: "Monthly", method: "In-app + Email", severity: "green" },
    ],
  },
];

const CFO_REPORTS: ReportConfig[] = [
  {
    id: "daily-pulse",
    title: "Daily Trading Pulse",
    frequency: "Every morning",
    description: "A quick overnight summary of trading performance.",
    includes: ["Yesterday's sales and orders", "Average order value", "Contribution margin", "CAC warning if relevant"],
    frequencies: ["Every morning", "Weekdays only", "Mon, Wed, Fri"],
  },
  {
    id: "weekly-digest",
    title: "Weekly Night Scout Briefing",
    frequency: "Every Monday",
    description: "A comprehensive weekly overview from Night Scout.",
    includes: ["Sales vs last week", "Contribution margin", "Cash runway", "Biggest risk", "Biggest opportunity", "Top recommended action"],
    frequencies: ["Every Monday", "Every Friday", "Mid-week (Wednesday)"],
  },
  {
    id: "monthly-summary",
    title: "Monthly Night Scout Summary",
    frequency: "Month-end",
    description: "A full month-end board-ready summary.",
    includes: ["Revenue and contribution", "Profit performance", "Cash position", "Opportunities identified", "Recommended plan for next month"],
    frequencies: ["Month-end", "1st of month", "Last Friday of month"],
  },
];

const RECENT_ALERTS_FEED: RecentAlertItem[] = [
  { date: "Today",     alert: "Meta CAC increased 18% week-on-week",                       impact: "Potential impact: −£6.4k/month contribution",               severity: "red",   action: "Review Meta campaigns",       status: "new"      },
  { date: "Yesterday", alert: `Discount dependency reached ${DISCOUNT_DEP}%`,              impact: "Potential impact: −£9.2k/month contribution",               severity: "amber", action: "Reduce blanket offers",       status: "new"      },
  { date: "Monday",    alert: `Cash runway fell to ${CASH_RUNWAY} months`,                 impact: "Potential impact: increased liquidity risk within 60 days", severity: "amber", action: "Reduce stock build",          status: "reviewed" },
  { date: "Last week", alert: `Contribution margin fell to ${MONTHLY_CM_PCT}%`,            impact: "Potential impact: −£12k/month contribution",                severity: "amber", action: "Review margin recovery plan", status: "reviewed" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, { dot: string; badge: string; text: string }> = {
  red: {
    dot:   "bg-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    text:  "text-destructive",
  },
  amber: {
    dot:   "bg-amber-500",
    badge: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
    text:  "text-amber-700 dark:text-amber-400",
  },
  green: {
    dot:   "bg-emerald-500",
    badge: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
    text:  "text-emerald-700 dark:text-emerald-400",
  },
};

const CATEGORY_BADGE: Record<string, string> = {
  Marketing:   "bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 border-violet-200/60 dark:border-violet-700/30",
  Margin:      "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-700/30",
  Cash:        "bg-amber-50 dark:bg-amber-950/15 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-700/30",
  Pricing:     "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-700/30",
  Sales:       "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/30",
  Opportunity: "bg-rose-50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-700/25",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  red:   "High",
  amber: "Medium",
  green: "Low",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 border border-primary/20">
      <Lock className="w-2.5 h-2.5" />
      Pro only
    </span>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function AlertToggleCard({
  alert,
  enabled,
  onToggle,
  isPro,
  showExplain,
  onExplain,
}: {
  alert: AlertItem;
  enabled: boolean;
  onToggle: () => void;
  isPro: boolean;
  showExplain?: boolean;
  onExplain?: () => void;
}) {
  const sev = SEVERITY_STYLES[alert.severity];
  const catBadge = CATEGORY_BADGE[alert.category] ?? CATEGORY_BADGE["Sales"];

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors",
        enabled && isPro
          ? "border-primary/25 bg-primary/3"
          : "border-border/60"
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Toggle */}
        <div className="mt-0.5 flex items-center gap-1.5">
          <Switch
            checked={enabled}
            onCheckedChange={isPro ? onToggle : undefined}
            disabled={!isPro}
            aria-label={`Toggle ${alert.label}`}
          />
          {!isPro && <Lock className="w-3 h-3 text-muted-foreground/40" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-sm font-semibold text-foreground">{alert.label}</span>
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", catBadge)}>
              {alert.category}
            </span>
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-1", sev.badge)}>
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sev.dot)} />
              {SEVERITY_LABEL[alert.severity]}
            </span>
            {enabled && isPro && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                Active
              </span>
            )}
            {!isPro && <LockBadge />}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{alert.rule}</p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-[10px] text-muted-foreground/70">
              <span className="font-semibold">Threshold:</span> {alert.threshold}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              <span className="font-semibold">Frequency:</span> {alert.frequency}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              <span className="font-semibold">Via:</span> {alert.method}
            </span>
            {alert.lastTriggered && (
              <span className="text-[10px] text-muted-foreground/50">
                Last triggered: {alert.lastTriggered}
              </span>
            )}
          </div>
        </div>

        {/* Explain button */}
        {showExplain && (
          <button
            onClick={isPro ? onExplain : undefined}
            disabled={!isPro}
            className={cn(
              "flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors shrink-0",
              isPro
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
            )}
            title={isPro ? "AI CFO explanation" : "Pro only"}
          >
            <Sparkles className="w-3 h-3" />
            Explain
            {!isPro && <Lock className="w-2.5 h-2.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ReportCard({
  report,
  enabled,
  onToggle,
  selectedFrequency,
  onFrequencyChange,
  isPro,
  onPreview,
}: {
  report: ReportConfig;
  enabled: boolean;
  onToggle: () => void;
  selectedFrequency: string;
  onFrequencyChange: (f: string) => void;
  isPro: boolean;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 transition-colors",
        enabled && isPro ? "border-primary/25 bg-primary/3" : "border-border/60"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5 flex items-center gap-1.5">
          <Switch
            checked={enabled}
            onCheckedChange={isPro ? onToggle : undefined}
            disabled={!isPro}
            aria-label={`Toggle ${report.title}`}
          />
          {!isPro && <Lock className="w-3 h-3 text-muted-foreground/40" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-foreground">{report.title}</span>
            {enabled && isPro && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                Active
              </span>
            )}
            {!isPro && <LockBadge />}
          </div>
          <p className="text-xs text-muted-foreground">{report.description}</p>
        </div>
      </div>

      {/* Includes */}
      <ul className="space-y-1 mb-4 pl-2">
        {report.includes.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/40">
        {/* Frequency selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <select
            value={selectedFrequency}
            onChange={(e) => isPro && onFrequencyChange(e.target.value)}
            disabled={!isPro}
            className={cn(
              "text-xs rounded-lg border border-border/50 bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors",
              !isPro && "opacity-50 cursor-not-allowed"
            )}
          >
            {report.frequencies.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Delivery method */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span>Email delivery</span>
        </div>

        {/* Preview */}
        <button
          onClick={onPreview}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          {isPro ? "Preview example" : "Preview example"}
        </button>
      </div>
    </div>
  );
}

function ReportPreviewModal({ report, onClose }: { report: ReportConfig; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground/60 hover:text-foreground transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Example preview</p>
            <p className="text-sm font-bold text-foreground">{report.title}</p>
          </div>
        </div>
        <div className="space-y-2.5 text-xs text-muted-foreground">
          {report.includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-4 text-center">
          Frequency: {report.frequency} · This is a layout preview only.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CfoAlerts() {
  const isPro = isProUser();
  const canControl = canAccess("cfo_alerts_controls");
  const { openDrawer } = useAiCfo();

  const [enabledAlerts, setEnabledAlerts] = useState<Set<string>>(
    new Set(isPro ? ["rec-meta-cac"] : [])
  );
  const [enabledReports, setEnabledReports] = useState<Set<string>>(
    new Set(isPro ? ["weekly-digest"] : [])
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["marketing", "margin"])
  );
  const [reportFrequencies, setReportFrequencies] = useState<Record<string, string>>({
    "daily-pulse":   "Every morning",
    "weekly-digest": "Every Monday",
    "monthly-summary": "Month-end",
  });
  const [notifSettings, setNotifSettings] = useState({
    inApp: isPro,
    email: false,
    weeklySummary: false,
  });
  const [previewReport, setPreviewReport] = useState<ReportConfig | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState(false);

  function toggleAlert(id: string) {
    if (!canControl) { setUpgradePrompt(true); return; }
    setEnabledAlerts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleReport(id: string) {
    if (!canControl) { setUpgradePrompt(true); return; }
    setEnabledReports((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleNotif(key: keyof typeof notifSettings) {
    if (!canControl) { setUpgradePrompt(true); return; }
    setNotifSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <AppLayout>
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Night Scout Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose what Night Scout should monitor and how often you want to be notified.
          </p>
        </div>
        {!isPro && (
          <Link
            href="/upgrade"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
          >
            <Zap className="w-4 h-4" />
            Unlock Night Scout Alerts
          </Link>
        )}
      </div>

      {/* ── CFO monitoring status panel ─────────────────────────────────────── */}
      <div className="sc-purple rounded-2xl px-5 py-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-900/50 shrink-0">
            <Activity className="w-3.5 h-3.5 text-indigo-300" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-300">Night Scout is currently monitoring</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "Revenue trends — daily sales vs 30-day average",
            "Contribution margin — tracking vs 40% target",
            "Meta CAC efficiency — week-on-week movement",
            "Cash runway — inventory and payables cycle",
            "Discount dependency — % revenue from offers",
            "AOV stability — order value changes by channel",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-foreground/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-snug">{item}</span>
            </div>
          ))}
        </div>
        {!isPro && (
          <p className="mt-3 text-xs text-muted-foreground/70 border-t border-primary/15 pt-3">
            Monitoring is active in preview mode.{" "}
            <Link href="/upgrade" className="text-primary underline underline-offset-2 font-semibold">Upgrade to Pro</Link>{" "}
            to receive live alerts and notifications.
          </p>
        )}
      </div>

      {/* ── Traffic-light monitoring status ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Sales trend",
            value: "On track",
            sub: "Daily revenue above 30d avg",
            icon: ShoppingCart,
            status: "green" as const,
          },
          {
            label: "Contribution margin",
            value: `${MONTHLY_CM_PCT}%  ↓`,
            sub: "Flagged — approaching 40% threshold",
            icon: BarChart2,
            status: "amber" as const,
          },
          {
            label: "Marketing efficiency",
            value: "CAC +18%",
            sub: "Action required — Meta spend inefficient",
            icon: Megaphone,
            status: "red" as const,
          },
          {
            label: "Highest risk area",
            value: "Marketing efficiency",
            sub: "Based on last 7 days of data",
            icon: AlertTriangle,
            status: "amber" as const,
          },
        ].map(({ label, value, sub, icon: Icon, status }) => {
          const statusStyles = {
            green: { dot: "bg-emerald-500", border: "border-emerald-200 dark:border-emerald-800/50", valueColor: "text-emerald-700 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", badgeLabel: "On track" },
            amber: { dot: "bg-amber-500", border: "border-amber-200 dark:border-amber-800/50", valueColor: "text-amber-700 dark:text-amber-400", badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", badgeLabel: "Flagged" },
            red:   { dot: "bg-red-500",   border: "border-red-200 dark:border-red-800/50",     valueColor: "text-red-700 dark:text-red-400",     badge: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",     badgeLabel: "Action needed" },
          }[status];
          return (
            <div key={label} className={cn("rounded-2xl border bg-card p-4 shadow-sm", statusStyles.border)}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 leading-tight">{label}</p>
                <Icon className={cn("w-4 h-4 shrink-0", statusStyles.valueColor)} />
              </div>
              <p className={cn("text-lg font-bold leading-tight", statusStyles.valueColor)}>{value}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">{sub}</p>
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-2", statusStyles.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusStyles.dot)} />
                {statusStyles.badgeLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Free upgrade banner ─────────────────────────────────────────────── */}
      {!isPro && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/80 dark:bg-indigo-950/30 px-6 py-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex-1">
              <p className="text-base font-bold text-indigo-900 dark:text-indigo-200 mb-2">
                Unlock proactive Night Scout monitoring
              </p>
              <p className="text-sm text-indigo-700/80 dark:text-indigo-400/80 leading-snug mb-4">
                Night Scout watches your sales, margin, cash and marketing performance so you know when something needs attention before it becomes a bigger problem.
              </p>
              <ul className="space-y-1.5 mb-5">
                {[
                  "Monitor sales, margin, cash and marketing movements",
                  "Receive warning alerts when key signals move",
                  "Schedule daily, weekly and monthly Night Scout briefings",
                  "Get plain-English recommendations and suggested actions",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-indigo-800 dark:text-indigo-300">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/upgrade"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                Unlock Night Scout Alerts
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="hidden sm:flex items-center justify-center w-24 opacity-20">
              <Bell className="w-16 h-16 text-indigo-600" />
            </div>
          </div>
        </div>
      )}

      {/* ── AI CFO Ask card ─────────────────────────────────────────────────── */}
      <AiCfoAskCard pageId="alerts" />

      {/* ══ RECOMMENDED ALERTS ═══════════════════════════════════════════════ */}
      <div className="mb-8">
        <SectionHeader
          title="Recommended alerts"
          subtitle="Suggested alerts based on your current business risks."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RECOMMENDED_ALERTS.map((alert) => {
            const enabled = enabledAlerts.has(alert.id);
            const sev = SEVERITY_STYLES[alert.severity];
            const catBadge = CATEGORY_BADGE[alert.category] ?? CATEGORY_BADGE["Sales"];
            return (
              <div
                key={alert.id}
                className={cn(
                  "rounded-2xl border bg-card p-5 flex flex-col gap-3 transition-colors",
                  enabled && isPro ? "border-primary/25 bg-primary/3" : "border-border/60"
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", catBadge)}>
                    {alert.category}
                  </span>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-1", sev.badge)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sev.dot)} />
                    {SEVERITY_LABEL[alert.severity]} risk
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 border border-primary/20">
                    Recommended
                  </span>
                  {enabled && isPro && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                      Active
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-bold text-foreground mb-1">{alert.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{alert.rule}</p>
                </div>

                <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                    <span><span className="font-semibold">Threshold:</span> {alert.threshold}</span>
                    <span><span className="font-semibold">Freq:</span> {alert.frequency}</span>
                  </div>
                  {isPro ? (
                    <Button
                      size="sm"
                      variant={enabled ? "outline" : "default"}
                      className="text-xs h-7 px-3"
                      onClick={() => toggleAlert(alert.id)}
                    >
                      {enabled ? "Disable" : "Enable alert"}
                    </Button>
                  ) : (
                    <Link
                      href="/upgrade"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-semibold border border-border/60 hover:bg-secondary/80 transition-colors"
                    >
                      <Lock className="w-3 h-3" />
                      Pro only
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ALERT CATEGORIES ═════════════════════════════════════════════════ */}
      <div className="mb-8">
        <SectionHeader title="All alert categories" subtitle="Enable individual alert rules to start monitoring." />
        <div className="space-y-3">
          {ALERT_CATEGORIES.map((cat) => {
            const expanded = expandedCategories.has(cat.id);
            const Icon = cat.icon;
            const activeInCat = cat.alerts.filter((a) => enabledAlerts.has(a.id)).length;
            return (
              <div key={cat.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
                  aria-expanded={expanded}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-5 h-5", cat.color)} />
                    <span className="text-sm font-bold text-foreground">{cat.label}</span>
                    {activeInCat > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                        {activeInCat} active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground/60">
                    <span className="text-xs">{cat.alerts.length} alerts</span>
                    {expanded
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {/* Alert cards */}
                {expanded && (
                  <div className="px-5 pb-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                    {cat.alerts.map((alert) => (
                      <AlertToggleCard
                        key={alert.id}
                        alert={alert}
                        enabled={enabledAlerts.has(alert.id)}
                        onToggle={() => toggleAlert(alert.id)}
                        isPro={canControl}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ RECURRING NIGHT SCOUT BRIEFINGS ══════════════════════════════════ */}
      <div className="mb-8">
        <SectionHeader
          title="Recurring Night Scout Briefings"
          subtitle="Choose the regular summaries Night Scout should prepare."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CFO_REPORTS.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              enabled={enabledReports.has(report.id)}
              onToggle={() => toggleReport(report.id)}
              selectedFrequency={reportFrequencies[report.id] ?? report.frequency}
              onFrequencyChange={(f) => {
                if (!canControl) { setUpgradePrompt(true); return; }
                setReportFrequencies((prev) => ({ ...prev, [report.id]: f }));
              }}
              isPro={canControl}
              onPreview={() => setPreviewReport(report)}
            />
          ))}
        </div>
        {!isPro && (
          <p className="text-xs text-muted-foreground/60 text-center mt-3">
            Briefing delivery and configuration available on Pro.{" "}
            <Link href="/upgrade" className="text-primary underline underline-offset-2">Unlock briefings on Pro</Link>
          </p>
        )}
      </div>

      {/* ══ WHAT NIGHT SCOUT WOULD HAVE FLAGGED ═════════════════════════════ */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              What Night Scout would have flagged this week
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isPro
                ? "Issues Night Scout detected — with estimated financial impact."
                : "Preview of what live monitoring would catch — upgrade to activate."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          {RECENT_ALERTS_FEED.map((item, i) => {
            const sev = SEVERITY_STYLES[item.severity];
            return (
              <div
                key={i}
                className="flex flex-col gap-2 px-5 py-4 border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors"
              >
                {/* Row 1: date + alert + severity */}
                <div className="flex flex-wrap items-start gap-3">
                  <span className="text-xs text-muted-foreground/60 whitespace-nowrap mt-0.5 w-20 shrink-0">{item.date}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground leading-snug">{item.alert}</span>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 font-medium">{item.impact}</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 whitespace-nowrap shrink-0", sev.badge)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sev.dot)} />
                    {SEVERITY_LABEL[item.severity]}
                  </span>
                </div>

                {/* Row 2: action text + inline buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pl-23">
                  <span className="text-xs text-muted-foreground leading-snug">{item.action}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isPro ? (
                      <>
                        <button
                          onClick={() => openDrawer("alerts")}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                          Explain
                        </button>
                        <button
                          onClick={() => openDrawer("alerts", "What should I do about this?")}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                        >
                          <HelpCircle className="w-3 h-3" />
                          What should I do?
                        </button>
                        <button
                          onClick={() => openDrawer("alerts", "Model the financial impact of fixing this.")}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                        >
                          <BarChart2 className="w-3 h-3" />
                          Model impact
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-secondary text-muted-foreground/40 border border-border/50 cursor-not-allowed">
                        <Lock className="w-2.5 h-2.5" />
                        Explain — Pro only
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ NOTIFICATION SETTINGS ════════════════════════════════════════════ */}
      <div className="mb-8">
        <SectionHeader title="Notification settings" />
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          {!isPro && (
            <div className="flex items-center gap-2.5 mb-4 p-3 rounded-xl bg-secondary/40 border border-border/50">
              <Lock className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              <p className="text-xs text-muted-foreground/80">
                Notification delivery is available on Pro.{" "}
                <Link href="/upgrade" className="text-primary underline underline-offset-2 font-semibold">Upgrade to activate.</Link>
              </p>
            </div>
          )}

          <div className="space-y-3">
            {[
              { key: "inApp" as const,        label: "In-app alerts",        icon: Smartphone, available: true,  desc: "Show notifications inside Night Scout." },
              { key: "email" as const,         label: "Email alerts",         icon: Mail,       available: true,  desc: "Send alert emails to your account email." },
              { key: "weeklySummary" as const, label: "Weekly summary email", icon: Calendar,   available: true,  desc: "Receive the weekly CFO Digest by email." },
            ].map(({ key, label, icon: Icon, desc }) => (
              <div key={key} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                <Icon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground/70">{desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isPro && <Lock className="w-3 h-3 text-muted-foreground/40" />}
                  <Switch
                    checked={notifSettings[key]}
                    onCheckedChange={isPro ? () => toggleNotif(key) : undefined}
                    disabled={!isPro}
                    aria-label={label}
                  />
                </div>
              </div>
            ))}

            {/* Coming later */}
            {[
              { label: "Slack notifications",    icon: Info, desc: "Coming later" },
              { label: "WhatsApp notifications",  icon: Info, desc: "Coming later" },
            ].map(({ label, icon: Icon, desc }) => (
              <div key={label} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0 opacity-50">
                <Icon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground/70">{desc}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                  Coming later
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ DATA & BENCHMARK ASSUMPTIONS ═════════════════════════════════════ */}
      <DataBenchmarkAssumptions
        benchmarkNote="Alerts are based on the quality and timing of connected sales, marketing, margin and cash data. Thresholds should be reviewed as your business changes."
        dataQualityNote="Alert thresholds are set using industry benchmarks for Shopify brands at £500k–£10m revenue. Your actual thresholds may differ depending on business model, margins and growth stage."
        confidenceNote="Alert triggers reflect significant metric movements, not normal day-to-day variance. Review triggered alerts in context before acting."
        className="mb-6"
      />

      {/* Report preview modal */}
      {previewReport && (
        <ReportPreviewModal report={previewReport} onClose={() => setPreviewReport(null)} />
      )}

      {/* Upgrade prompt (when Free user tries to interact) */}
      {upgradePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUpgradePrompt(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <p className="text-base font-bold text-foreground mb-2">Night Scout Alerts — Pro feature</p>
            <p className="text-sm text-muted-foreground mb-5 leading-snug">
              Upgrade to Pro to enable alerts, configure thresholds and receive proactive Night Scout monitoring.
            </p>
            <Link
              href="/upgrade"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              onClick={() => setUpgradePrompt(false)}
            >
              <Zap className="w-4 h-4" />
              Upgrade to Pro
            </Link>
            <button
              onClick={() => setUpgradePrompt(false)}
              className="block w-full text-center text-xs text-muted-foreground/60 mt-3 hover:text-muted-foreground transition-colors"
            >
              Continue with preview
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
