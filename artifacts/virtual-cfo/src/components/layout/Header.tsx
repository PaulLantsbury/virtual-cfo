import { Bell, Menu } from "lucide-react";
import { DevPlanToggle } from "@/components/DevPlanToggle";
import { CfoMonitoringStatus } from "@/components/CfoMonitoringStatus";
import { BrandLogo } from "@/components/BrandLogo";

export function Header() {
  return (
    <header
      className="h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 border-b border-white/10 backdrop-blur-md shrink-0"
      style={{ background: "rgba(11, 31, 58, 0.85)" }}
    >
      <button className="md:hidden p-2 text-white/70 hover:bg-white/10 rounded-lg transition-colors">
        <Menu className="w-5 h-5" />
      </button>
      <BrandLogo
        variant="mascot"
        className="md:hidden ml-2"
        imageClassName="h-11 w-11 rounded-full"
      />

      <div className="flex items-center gap-3 ml-auto">
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
