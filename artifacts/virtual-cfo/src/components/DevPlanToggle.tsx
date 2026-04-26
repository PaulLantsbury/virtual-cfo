import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserPlan } from "@/lib/plan";

const STORAGE_KEY = "reviewPlan";

/**
 * Plan toggle — always visible.
 *
 * Persists the selected plan in localStorage so it survives page refreshes
 * and can be used by external reviewers to switch between Free and Pro views.
 *
 * plan.ts reads localStorage["reviewPlan"] first, so switching here
 * immediately affects all canAccess() gates on every page after reload.
 */
export function DevPlanToggle() {
  const [plan, setPlan] = useState<UserPlan>(
    () => (localStorage.getItem(STORAGE_KEY) as UserPlan | null) ?? "free"
  );

  const switchPlan = (next: UserPlan) => {
    if (next === plan) return;
    localStorage.setItem(STORAGE_KEY, next);
    setPlan(next);
    window.location.reload();
  };

  return (
    <div
      title="Switch between Free and Pro view"
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
