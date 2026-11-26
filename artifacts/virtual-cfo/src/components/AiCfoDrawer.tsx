import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAiCfo } from '@/components/AiCfoProvider';

/** Legacy Ask entry point: no mock answer may impersonate evidence-bound analysis. */
export function AiCfoDrawer() {
 const {isOpen,closeDrawer}=useAiCfo();
 const closeRef=useRef<HTMLButtonElement>(null),drawerRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!isOpen)return undefined;
  const previous=document.activeElement,overflow=document.body.style.overflow;
  closeRef.current?.focus();document.body.style.overflow='hidden';
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();closeDrawer();}
   if(e.key==='Tab'){
    const buttons=drawerRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if(!buttons?.length)return;
    const first=buttons[0],last=buttons[buttons.length-1],active=document.activeElement;
    if(e.shiftKey&&(active===first||!drawerRef.current?.contains(active))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(active===last||!drawerRef.current?.contains(active))){e.preventDefault();first.focus();}
   }
  };
  window.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',key);if(previous instanceof HTMLElement)previous.focus();};
 },[isOpen,closeDrawer]);
 if(!isOpen)return null;
 return <><div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={closeDrawer} aria-hidden="true"/>
 <aside ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="ask-availability-title" className="fixed top-0 right-0 z-50 h-full w-full max-w-[500px] bg-background shadow-2xl border-l border-border flex flex-col">
 <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-primary/5"><Sparkles className="w-5 h-5 text-primary"/><h2 id="ask-availability-title" className="flex-1 font-semibold">Ask Night Scout</h2><button ref={closeRef} onClick={closeDrawer} className="p-2 rounded-full hover:bg-secondary" aria-label="Close"><X className="w-5 h-5"/></button></div>
 <div className="overflow-y-auto p-5 space-y-4"><p role="status" className="font-semibold">Personalised answers are not available here yet.</p><p>This drawer does not analyse your company or send your question to an AI service. Earlier example answers are withheld because they were not based on your selected evidence.</p><p>Use Explore the Numbers on the page to check supported figures, dates and limitations. A connection alone does not establish complete evidence or support a recommendation.</p><p>No confidence rating, expected saving, action plan or reminder has been created.</p><button className="rounded-lg border border-primary/30 px-4 py-2 text-primary" onClick={closeDrawer}>Return to the page</button></div>
 </aside></>;
}
