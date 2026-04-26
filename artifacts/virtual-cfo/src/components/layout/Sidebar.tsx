import { Link, useLocation } from "wouter";
import { LayoutDashboard, PieChart, Settings, HelpCircle, Briefcase, TrendingDown, BarChart2, Megaphone, Target, Cpu, Wallet, Tag, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard",              href: "/dashboard"              },
  { icon: TrendingDown,    label: "Margin Analysis",        href: "/margin-analysis"        },
  { icon: BarChart2,       label: "Growth Quality",         href: "/growth-quality"         },
  { icon: Megaphone,       label: "Marketing Efficiency",   href: "/marketing-efficiency"   },
  { icon: Target,          label: "Opportunities",          href: "/opportunities"          },
  { icon: Cpu,             label: "Profit Engine",          href: "/profit-engine"          },
  { icon: Wallet,          label: "Cash Control",           href: "/cash-control"           },
  { icon: Tag,             label: "Pricing Optimisation",   href: "/pricing-optimisation"   },
  { icon: FlaskConical,    label: "Scenario Lab",           href: "/scenario-lab"           },
  { icon: PieChart,        label: "Reports",                href: "/dashboard/reports"      },
  { icon: Settings,        label: "Settings",               href: "/settings"               },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-2xl z-10">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Virtual CFO</span>
        </Link>
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
