import {BrandLogo} from '@/components/BrandLogo';
import {MainNavigation} from './MainNavigation';

export function Sidebar(){return <aside className="hidden md:flex flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-2xl z-10"><div className="h-24 shrink-0 flex items-center justify-center px-6 border-b border-sidebar-border/50"><BrandLogo variant="navigation" className="group transition-all hover:scale-[1.02]" imageClassName="h-16 w-[208px]"/></div><MainNavigation className="flex-1 overflow-y-auto"/></aside>;}
