import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TimelineProvider } from "@/lib/timeline";
import NotFound from "@/pages/not-found";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import MarginAnalysis from "@/pages/margin-analysis";
import GrowthQuality from "@/pages/growth-quality";
import MarketingEfficiency from "@/pages/marketing-efficiency";
import Opportunities from "@/pages/opportunities";
import ProfitEngine from "@/pages/profit-engine";
import CashControl from "@/pages/cash-control";
import PricingOptimisation from "@/pages/pricing-optimisation";
import Settings from "@/pages/settings";
import Upgrade from "@/pages/upgrade";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/transactions" component={Dashboard} /> {/* Map to dashboard for now */}
      <Route path="/dashboard/reports" component={Dashboard} /> {/* Map to dashboard for now */}
      <Route path="/margin-analysis" component={MarginAnalysis} />
      <Route path="/growth-quality" component={GrowthQuality} />
      <Route path="/marketing-efficiency" component={MarketingEfficiency} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/profit-engine" component={ProfitEngine} />
      <Route path="/cash-control" component={CashControl} />
      <Route path="/pricing-optimisation" component={PricingOptimisation} />
      <Route path="/settings" component={Settings} />
      <Route path="/upgrade" component={Upgrade} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TimelineProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TimelineProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
