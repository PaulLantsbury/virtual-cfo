import { Link, useLocation } from "wouter";
import { LayoutDashboard, HelpCircle, TrendingDown, BarChart2, Megaphone, Cpu, Wallet, Tag, FlaskConical, Target, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

const navItems = [
  { icon: LayoutDashboard, label: "Morning Briefing",        href: "/dashboard"              },
  { icon: TrendingDown,    label: "Margin Recovery",         href: "/margin-analysis"        },
  { icon: BarChart2,       label: "Growth Quality",         href: "/growth-quality"         },
  { icon: Megaphone,       label: "Growth Efficiency",      href: "/marketing-efficiency"   },
  { icon: Tag,             label: "Discount Recovery",      href: "/pricing-optimisation"   },
  { icon: Cpu,             label: "Profit Growth",          href: "/profit-engine"          },
  { icon: Wallet,          label: "Cash Control",           href: "/cash-control"           },
  { icon: Target,          label: "Profit Opportunities",   href: "/profit-opportunities"   },
  { icon: FlaskConical,    label: "Profit Launchpad",       href: "/scenario-lab"           },
  { icon: Bell,            label: "Night Scout Alerts",     href: "/cfo-alerts"             },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-2xl z-10">
      <div className="h-24 flex items-center justify-center px-6 border-b border-sidebar-border/50">
        <BrandLogo
          className="group transition-all hover:scale-[1.02]"
          imageClassName="max-h-16 max-w-[220px]"
        />
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-4 px-2">Menu</div>
        {navItems.map((item) => {
          const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/dashboard");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 group",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200",
                isActive ? "" : "group-hover:scale-110"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50">
        <Link
          href="/help"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
          Help & Support
        </Link>
      </div>
    </aside>
  );
}
