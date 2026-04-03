import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserPlan } from "@/lib/plan";

/**
 * Developer-only plan toggle.
 *
 * Visible only when Vite builds in development mode (import.meta.env.DEV).
 * Tree-shaken out of production bundles — never ships to end users.
 *
 * Usage:
 *   1. Click "Free" or "Pro" to switch plan
 *   2. Page reloads automatically so all canAccess() gates re-evaluate
 *   3. State persists in sessionStorage across reloads within the same tab
 *
 * Reset: close the tab or sessionStorage.removeItem("userPlan")
 */
export function DevPlanToggle() {
  const [plan, setPlan] = useState<UserPlan>(
    () => (sessionStorage.getItem("userPlan") as UserPlan | null) ?? "free"
  );

  // Only render in Vite dev mode — constant at compile time, tree-shaken in prod
  if (!import.meta.env.DEV) return null;

  const switchPlan = (next: UserPlan) => {
    if (next === plan) return;
    sessionStorage.setItem("userPlan", next);
    setPlan(next);
    window.location.reload();
  };

  return (
    <div
      title="Developer plan toggle — not visible to users"
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 dark:bg-amber-950/25 dark:border-amber-700/60 select-none"
    >
      <FlaskConical className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
        Dev
      </span>
      <div className="flex items-center bg-amber-100 dark:bg-amber-900/30 rounded-[5px] p-0.5 gap-px">
        {(["free", "pro"] as UserPlan[]).map((p) => (
          <button
            key={p}
            onClick={() => switchPlan(p)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors",
              plan === p
                ? "bg-amber-500 text-white shadow-sm"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40"
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
