import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BarChart3, TrendingUp, ShieldCheck, Zap, Briefcase, ChevronRight, ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Briefcase className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight">Virtual CFO</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Testimonials</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="font-semibold text-sm hover:text-primary transition-colors">Log in</Link>
            <Link href="/login">
              <Button className="rounded-full px-6">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 relative overflow-hidden">
        {/* Abstract Generated Background */}
        <div className="absolute inset-0 z-0 opacity-[0.15] dark:opacity-30 pointer-events-none">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Hero background" 
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-accent/20 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium text-sm mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            Built for Shopify founders using Xero
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.1]"
          >
            Your AI CFO for <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Shopify businesses using Xero</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Understand whether your business is growing profitably — and what to do about it — in minutes instead of spreadsheets.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full">
                See your financial health in minutes <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-background/50 backdrop-blur">
              View live demo
            </Button>
          </motion.div>

          {/* Hero Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 relative mx-auto max-w-5xl rounded-2xl md:rounded-[2rem] border border-border/50 bg-background/50 backdrop-blur-xl shadow-2xl p-2 md:p-4"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 h-full rounded-[2rem] pointer-events-none"></div>
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&h=900&fit=crop" 
              alt="Dashboard Preview" 
              className="rounded-xl md:rounded-2xl border border-border shadow-sm object-cover w-full h-[400px] md:h-[600px]"
            />
          </motion.div>
        </div>
      </section>

      {/* Insight Preview Strip */}
      <section className="relative z-20 bg-sidebar border-y border-sidebar-border overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-widest">Live dashboard preview</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {/* Contribution Margin */}
            <div className="flex-none min-w-[180px] bg-sidebar-accent/40 border border-sidebar-border rounded-xl p-4">
              <p className="text-xs text-sidebar-foreground/50 mb-1 font-medium">Contribution Margin</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-sidebar-foreground">21%</span>
                <span className="flex items-center gap-0.5 text-red-400 text-sm font-semibold mb-0.5">
                  <ArrowDownRight className="w-3.5 h-3.5" />↓
                </span>
              </div>
              <p className="text-xs text-red-400/80 mt-1">Lower than expected</p>
            </div>

            {/* Cash Runway */}
            <div className="flex-none min-w-[180px] bg-sidebar-accent/40 border border-sidebar-border rounded-xl p-4">
              <p className="text-xs text-sidebar-foreground/50 mb-1 font-medium">Cash Runway</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-sidebar-foreground">4.2</span>
                <span className="text-sidebar-foreground/60 text-sm mb-0.5 font-medium">months</span>
              </div>
              <p className="text-xs text-amber-400/80 mt-1">Monitor closely</p>
            </div>

            {/* Discount Dependency */}
            <div className="flex-none min-w-[180px] bg-sidebar-accent/40 border border-sidebar-border rounded-xl p-4">
              <p className="text-xs text-sidebar-foreground/50 mb-1 font-medium">Discount Dependency</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-sidebar-foreground">38%</span>
                <span className="flex items-center gap-0.5 text-red-400 text-sm font-semibold mb-0.5">
                  <ArrowUpRight className="w-3.5 h-3.5" />↑
                </span>
              </div>
              <p className="text-xs text-red-400/80 mt-1">Rising quickly</p>
            </div>

            {/* Repeat Purchase Rate */}
            <div className="flex-none min-w-[180px] bg-sidebar-accent/40 border border-sidebar-border rounded-xl p-4">
              <p className="text-xs text-sidebar-foreground/50 mb-1 font-medium">Repeat Purchase Rate</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-sidebar-foreground">27%</span>
                <span className="flex items-center gap-0.5 text-red-400 text-sm font-semibold mb-0.5">
                  <ArrowDownRight className="w-3.5 h-3.5" />↓
                </span>
              </div>
              <p className="text-xs text-red-400/80 mt-1">Needs attention</p>
            </div>

            {/* AI Insight Card */}
            <div className="flex-none min-w-[260px] bg-primary/20 border border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs text-primary font-semibold uppercase tracking-widest">AI Insight</p>
              </div>
              <p className="text-sm text-sidebar-foreground leading-snug font-medium">
                Margin pressure increasing due to promotions
              </p>
              <p className="text-xs text-sidebar-foreground/40 mt-2">Updated just now</p>
            </div>
          </div>
        </div>
      </section>

      {/* Built For Section */}
      <section className="py-24 bg-card relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground mb-6 leading-tight">
              Built for founders who already use Shopify and Xero
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Virtual CFO connects your store and accounting data automatically to explain:
            </p>
            <ul className="flex flex-col gap-4 mb-10">
              {[
                "Whether your growth is profitable",
                "How long your cash will last",
                "What is driving margin changes",
                "Where performance is improving or weakening",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="flex-none mt-1 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                  </span>
                  <span className="text-foreground text-lg">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-base font-semibold text-muted-foreground tracking-wide">No spreadsheets required.</p>
          </div>
        </div>
      </section>

      {/* Pain Point Section */}
      <section className="py-24 bg-background relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-foreground mb-10 leading-tight">
            Most founders don't know whether<br className="hidden md:block" /> they are growing profitably
          </h2>
          <ul className="flex flex-col items-center gap-4 mb-10">
            {[
              "Revenue is rising but margins are falling",
              "Discounting is driving growth more than retention",
              "Cash is tightening faster than expected",
            ].map((point) => (
              <li key={point} className="flex items-center gap-3 text-lg text-muted-foreground">
                <span className="flex-none w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                </span>
                {point}
              </li>
            ))}
          </ul>
          <p className="text-xl font-semibold text-foreground">
            Virtual CFO explains what is really happening —{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">automatically.</span>
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-card relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Everything you need to run your business</h2>
            <p className="text-lg text-muted-foreground">Replace messy spreadsheets with real-time financial dashboards that actually make sense.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: BarChart3,
                title: "True Contribution Margin",
                desc: "See whether your growth is actually profitable after fulfilment, fees, and discounts."
              },
              {
                icon: TrendingUp,
                title: "Cash Runway Visibility",
                desc: "Know how many months of cash you really have left based on real trading performance."
              },
              {
                icon: ShieldCheck,
                title: "AI CFO Commentary",
                desc: "Get a plain-English financial briefing explaining what changed in your business and why."
              }
            ].map((feat, i) => (
              <div key={i} className="bg-background p-8 rounded-3xl border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feat.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feat.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar py-12 text-sidebar-foreground border-t border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-xl">Virtual CFO</span>
          </div>
          <p className="text-sidebar-foreground/60 text-sm">© 2024 Virtual CFO Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
