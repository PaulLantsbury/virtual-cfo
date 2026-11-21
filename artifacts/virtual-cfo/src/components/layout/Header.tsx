import {useEffect,useState} from 'react';
import {useLocation} from 'wouter';
import {Bell,Menu} from 'lucide-react';
import {DevPlanToggle} from '@/components/DevPlanToggle';
import {CfoMonitoringStatus} from '@/components/CfoMonitoringStatus';
import {BrandLogo} from '@/components/BrandLogo';
import {Sheet,SheetTrigger,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {MainNavigation} from './MainNavigation';

export function Header({showMonitoring=true}:{showMonitoring?:boolean}){
 const [menuOpen,setMenuOpen]=useState(false),[location]=useLocation();
 useEffect(()=>{setMenuOpen(false);},[location]);
 useEffect(()=>{const desktop=window.matchMedia('(min-width: 768px)');const closeOnDesktop=()=>{if(desktop.matches)setMenuOpen(false);};desktop.addEventListener('change',closeOnDesktop);return()=>desktop.removeEventListener('change',closeOnDesktop);},[]);
 return <header className="h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 border-b border-white/10 backdrop-blur-md shrink-0" style={{background:'rgba(11, 31, 58, 0.85)'}}>
  <Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetTrigger asChild><button type="button" aria-label="Open navigation" className="md:hidden p-2 text-white/70 hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"><Menu className="w-5 h-5" aria-hidden="true"/></button></SheetTrigger><SheetContent side="left" className="flex flex-col p-0 bg-sidebar text-sidebar-foreground border-sidebar-border" style={{width:'min(22rem, calc(100vw - 2rem))',maxWidth:'calc(100vw - 2rem)'}}><SheetHeader className="sr-only"><SheetTitle>Night Scout navigation</SheetTitle><SheetDescription>Choose a business workspace, monitoring, settings or help.</SheetDescription></SheetHeader><div className="h-24 shrink-0 flex items-center justify-center px-8 border-b border-sidebar-border/50"><BrandLogo variant="navigation" imageClassName="h-14 w-[182px]"/></div><MainNavigation onNavigate={()=>setMenuOpen(false)} className="flex-1 overflow-y-auto"/></SheetContent></Sheet>
  <BrandLogo variant="navigation" className="hidden sm:inline-flex md:hidden ml-2" imageClassName="h-11 w-[143px]"/>
  <div className="flex items-center gap-2 sm:gap-3 ml-auto min-w-0">{showMonitoring?<CfoMonitoringStatus/>:<span className="text-[10px] sm:text-xs text-white/70">Monitoring not active</span>}<DevPlanToggle/><button className="relative p-2 text-white/70 hover:bg-white/10 rounded-full transition-colors"><Bell className="w-5 h-5"/>{showMonitoring&&<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-[#0B1F3A]"/>}</button></div>
 </header>;
}
