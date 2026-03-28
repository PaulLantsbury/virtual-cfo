import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export default function Settings() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">Settings</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Settings Nav */}
          <div className="md:col-span-1 space-y-1">
            <button className="w-full text-left px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-md shadow-primary/20">
              General
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-xl text-muted-foreground font-medium hover:bg-secondary hover:text-foreground transition-colors">
              Team Members
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-xl text-muted-foreground font-medium hover:bg-secondary hover:text-foreground transition-colors">
              Integrations
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-xl text-muted-foreground font-medium hover:bg-secondary hover:text-foreground transition-colors">
              Billing
            </button>
          </div>

          {/* Settings Content */}
          <div className="md:col-span-3 space-y-8">
            <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-sm border border-border/50">
              <h2 className="text-xl font-semibold mb-6">Company Profile</h2>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-secondary border border-border flex items-center justify-center text-2xl font-bold text-muted-foreground">
                    AC
                  </div>
                  <div>
                    <Button variant="outline" className="mb-2">Upload Logo</Button>
                    <p className="text-xs text-muted-foreground">JPG, GIF or PNG. 1MB max.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Company Name</label>
                    <input 
                      type="text" 
                      defaultValue="Acme Corp" 
                      className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Industry</label>
                    <select className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                      <option>SaaS / Technology</option>
                      <option>E-commerce</option>
                      <option>Agency / Services</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-foreground">Contact Email</label>
                    <input 
                      type="email" 
                      defaultValue="finance@acmecorp.com" 
                      className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-sm border border-border/50">
              <h2 className="text-xl font-semibold mb-2">Danger Zone</h2>
              <p className="text-sm text-muted-foreground mb-6">Irreversible actions for your company account.</p>
              
              <div className="flex items-center justify-between p-4 border border-destructive/20 bg-destructive/5 rounded-xl">
                <div>
                  <h4 className="font-semibold text-destructive">Delete Company</h4>
                  <p className="text-sm text-muted-foreground">Permanently delete your company and all data.</p>
                </div>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
