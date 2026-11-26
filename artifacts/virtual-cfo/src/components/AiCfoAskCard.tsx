import { Sparkles } from 'lucide-react';
import { useAiCfo } from '@/components/AiCfoProvider';
import type { PageId } from '@/lib/aiCfoResponses';
import { cn } from '@/lib/utils';
export function AiCfoAskCard({pageId,className}:{pageId:PageId;className?:string}){
 const {openDrawer}=useAiCfo();
 return <div className={cn('rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 mb-6',className)}><div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-primary"/><p className="text-sm font-semibold">Ask Night Scout · not yet available</p></div><p className="text-sm text-muted-foreground mb-3">Personalised answers require verified evidence. Explore the Numbers remains available on the page.</p><button className="text-sm font-semibold text-primary underline" onClick={()=>openDrawer(pageId)}>About Ask Night Scout</button></div>;
}
