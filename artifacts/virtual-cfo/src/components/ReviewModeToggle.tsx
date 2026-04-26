import { useState } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserPlan } from "@/lib/plan";

const STORAGE_KEY = "reviewPlan";

function getStored(): UserPlan | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "pro" || v === "free" ? v : null;
}

export function ReviewModeToggle() {
  const [plan, setPlan] = useState<UserPlan>(() => getStored() ?? "free");
  const [active, setActive] = useState<boolean>(() => getStored() !== null);

  const switchPlan = (next: UserPlan) => {
    localStorage.setItem(STORAGE_KEY, next);
    setPlan(next);
    setActive(true);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2">
      {active && (
        <span className="hidden sm:inline-flex items-center text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-secondary px-2 py-0.5 rounded-full border border-border/50 select-none">
          Review mode
        </span>
      )}
      <div
        title="Review Mode — switch between Free and Pro views"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary border border-border/60 select-none"
      >
        <Eye className="w-3 h-3 text-muted-foreground/70 shrink-0" />
        <div className="flex items-center rounded-[5px] bg-background/60 p-0.5 gap-px border border-border/40">
          {(["free", "pro"] as UserPlan[]).map((p) => (
            <button
              key={p}
              onClick={() => switchPlan(p)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors",
                active && plan === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
