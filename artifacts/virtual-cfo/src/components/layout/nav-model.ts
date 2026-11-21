/** One navigation contract for desktop and small-screen layouts.
 * Legacy and review-only URLs remain routed, but are not extra core workspaces. */
export type NavigationIcon = 'overview'|'profit'|'marketing'|'cash'|'plan'|'monitoring'|'settings'|'help';
export type NavigationItem = {readonly label:string;readonly href:string;readonly icon:NavigationIcon};
export const CORE_NAV_ITEMS:readonly NavigationItem[] = [
  {label:'Scout’s View',href:'/dashboard',icon:'overview'},
  {label:'Profit Engine',href:'/profit-engine',icon:'profit'},
  {label:'Growth & Marketing',href:'/new-marketing',icon:'marketing'},
  {label:'Cash Control',href:'/new-cash-control',icon:'cash'},
  {label:'Plan',href:'/plan',icon:'plan'},
];
export const SUPPORT_NAV_ITEMS:readonly NavigationItem[] = [
  {label:'Monitoring',href:'/monitoring',icon:'monitoring'},
  {label:'Settings',href:'/settings',icon:'settings'},
];
export const HELP_NAV_ITEM:NavigationItem={label:'Help & Support',href:'/help',icon:'help'};
export function isNavigationActive(location:string,href:string):boolean{
  const path=location.split(/[?#]/,1)[0];
  return path===href||path.startsWith(href+'/');
}
