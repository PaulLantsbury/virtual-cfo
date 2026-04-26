import { Bell, Search, Menu } from "lucide-react";
import { DevPlanToggle } from "@/components/DevPlanToggle";
import { CfoMonitoringStatus } from "@/components/CfoMonitoringStatus";

export function Header() {
  return (
    <header
      className="h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 border-b border-white/10 backdrop-blur-md shrink-0"
      style={{ background: "rgba(11, 31, 58, 0.85)" }}
    >
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-white/70 hover:bg-white/10 rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search transactions, reports..."
            className="w-64 pl-9 pr-4 py-2 bg-white/8 border border-white/12 focus:border-white/25 focus:bg-white/12 rounded-xl text-sm text-white placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-white/10"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CfoMonitoringStatus />
        <DevPlanToggle />
        <button className="relative p-2 text-white/70 hover:bg-white/10 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-[#0B1F3A]" />
        </button>
      </div>
    </header>
  );
}
