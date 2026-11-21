import {Link,useLocation} from 'wouter';
import {LayoutDashboard,BarChart2,Megaphone,Wallet,Target,Bell,Settings,HelpCircle} from 'lucide-react';
import {cn} from '@/lib/utils';
import {CORE_NAV_ITEMS,SUPPORT_NAV_ITEMS,HELP_NAV_ITEM,isNavigationActive,type NavigationItem,type NavigationIcon} from './nav-model';
const icons:Record<NavigationIcon,typeof LayoutDashboard>={overview:LayoutDashboard,profit:BarChart2,marketing:Megaphone,cash:Wallet,plan:Target,monitoring:Bell,settings:Settings,help:HelpCircle};
/** The very same destinations and active-state rules appear in both menus. */
export function MainNavigation({onNavigate,className}:{onNavigate?:()=>void;className?:string}){
 const [location]=useLocation();
 const item=(entry:NavigationItem)=>{const Icon=icons[entry.icon],active=isNavigationActive(location,entry.href);return <Link key={entry.href} href={entry.href} onClick={onNavigate} aria-current={active?'page':undefined} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',active?'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20':'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}><Icon className="w-5 h-5 shrink-0" aria-hidden="true"/><span>{entry.label}</span></Link>;};
 return <nav aria-label="Main navigation" className={cn('flex flex-col min-h-0',className)}><div className="px-4 py-5 space-y-1"><p className="text-[11px] font-semibold text-sidebar-foreground/45 uppercase tracking-wider mb-3 px-3">Your business</p>{CORE_NAV_ITEMS.map(item)}</div><div className="px-4 py-4 space-y-1 border-t border-sidebar-border/50"><p className="text-[11px] font-semibold text-sidebar-foreground/45 uppercase tracking-wider mb-3 px-3">Tools & setup</p>{SUPPORT_NAV_ITEMS.map(item)}</div><div className="px-4 py-4 border-t border-sidebar-border/50 mt-auto">{item(HELP_NAV_ITEM)}</div></nav>;
}
