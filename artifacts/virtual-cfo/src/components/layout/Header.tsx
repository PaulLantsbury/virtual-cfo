import { Bell, Search, Menu } from "lucide-react";
import { DevPlanToggle } from "@/components/DevPlanToggle";
import { CfoMonitoringStatus } from "@/components/CfoMonitoringStatus";

export function Header() {
  return (
    <header className="h-16 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions, reports..."
            className="w-64 pl-9 pr-4 py-2 bg-secondary/50 border border-transparent focus:border-border focus:bg-background rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CfoMonitoringStatus />
        <DevPlanToggle />
        <button className="relative p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
        </button>
      </div>
    </header>
  );
}
