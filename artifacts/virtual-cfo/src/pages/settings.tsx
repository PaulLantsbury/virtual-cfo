import {AppLayout} from '@/components/layout/AppLayout';
import {ShopifyConnectionStatus} from '@/components/ShopifyConnectionStatus';
import {XeroMappingSetup} from '@/components/XeroMappingSetup';
export default function Settings(){return <AppLayout showMonitoring={false}><div className="max-w-4xl mx-auto space-y-6"><h1 className="text-3xl font-bold tracking-tight">Settings</h1><ShopifyConnectionStatus/><XeroMappingSetup/><section className="rounded-2xl border bg-card p-6"><h2 className="text-lg font-semibold">Other settings</h2><p className="mt-2 text-muted-foreground">Company profile, team and billing settings are not connected yet.</p></section></div></AppLayout>;}
