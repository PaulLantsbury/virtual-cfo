import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BarChart3, ChevronRight, CheckCircle2, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <BrandLogo className="shrink-0" imageClassName="h-9 w-[117px] sm:h-16 sm:w-[208px]" />
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
            <a href="#discover" className="hover:text-foreground transition-colors">Discoveries</a>
            <a href="#process" className="hover:text-foreground transition-colors">How it works</a>
            <Link href="/upgrade" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/login" className="font-semibold text-sm hover:text-primary transition-colors">Log in</Link>
            <Link href="/signup">
              <Button className="rounded-full px-3 sm:px-6">Explore Night Scout</Button>
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
          <BrandLogo
            className="mx-auto mb-12"
            imageClassName="h-20 w-[260px] sm:h-40 sm:w-[520px]"
          />

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.1]"
          >
            Understand Your <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Profit and Cash</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Review supported financial evidence, inspect what changed and explore conditional plans. Availability depends on the connected sources; personalised AI answers, scheduled briefings and cash forecasts are not active capabilities here.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm font-semibold text-foreground"
          >
            {[
              "Where recorded profit changed",
              "Which cash evidence is supported",
              "What to check before choosing an action",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {item}
              </li>
            ))}
          </motion.ul>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full">
                Explore Night Scout <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button onClick={()=>document.getElementById('discover')?.scrollIntoView({behavior:'smooth'})} variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-background/50 backdrop-blur">
              Explore the example below
            </Button>
          </motion.div>

          {/* Hero morning briefing preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 relative mx-auto max-w-4xl rounded-2xl md:rounded-[2rem] border border-border/50 bg-background/80 backdrop-blur-xl shadow-2xl p-4 md:p-6 text-left"
          >
            <div className="rounded-xl md:rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Illustrative design · fictional amounts</p>
                  <h2 className="text-2xl font-display font-bold text-foreground">Example evidence questions</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                  <Sparkles className="w-3.5 h-3.5" />
                  Example only · not a scan
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4 p-5">
                {[
                  ["£20,400", "example contribution", "Fictional amount, not a saving"],
                  ["£18,000", "example scenario change", "Conditional illustration"],
                  ["+ 2", "example cash questions", "No forecast performed"],
                ].map(([value, label, note]) => (
                  <div key={label} className="rounded-xl bg-background border border-border p-5">
                    <p className="text-3xl font-display font-bold text-foreground">{value}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{label}</p>
                    <p className="text-xs text-muted-foreground mt-3">{note}</p>
                  </div>
                ))}
              </div>
              <div className="mx-5 mb-5 rounded-xl bg-primary/10 border border-primary/20 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Example investigation</p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xl font-display font-bold text-foreground">Review discounts and contribution</p>
                  <span className="text-sm text-muted-foreground">No action created</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Founder belief section */}
      <section id="founders" className="py-24 bg-background relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-foreground mb-10 leading-tight">
            Sales growth is only part of the picture
          </h2>
          <ul className="flex flex-col items-center gap-4 mb-10">
            {[
              "Revenue can rise while less contribution remains.",
              "Discounts and repeat purchases need distinct evidence.",
              "Profit does not establish cash available to spend.",
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
            Start with the evidence and check the limits before changing the business.
          </p>
        </div>
      </section>

      {/* Overnight discoveries */}
      <section id="discover" className="py-24 bg-card relative z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Questions Night Scout helps you explore</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The examples below illustrate questions to investigate. They are not observed customer results, identified savings or completed monitoring checks.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                title: "Contribution example",
                value: "£20,400",
                desc: "An illustrative amount to inspect, not a recoverable saving."
              },
              {
                title: "Cash questions",
                value: "+ 2",
                desc: "Check dated balances, commitments and evidence gaps; no forecast is asserted."
              },
              {
                title: "Next investigation",
                value: "1 focus",
                desc: "Choose a scoped investigation; no universal opportunity ranking is implied."
              }
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-background p-7 shadow-sm">
                <p className="text-sm font-semibold text-muted-foreground mb-4">{item.title}</p>
                <p className="text-4xl font-display font-bold text-foreground mb-4">{item.value}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-background relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Explore the financial picture</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Supported views show their sources and limitations. Connected accounts are not automatically complete or reconciled.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-5">
            {[
              {
                icon: BarChart3,
                title: "Growth Quality",
                desc: "Review growth measures with their scope and limitations."
              },
              {
                icon: TrendingUp,
                title: "Profit Engine",
                desc: "Inspect recorded sales, costs and named profit measures."
              },
              {
                icon: Wallet,
                title: "Cash Control",
                desc: "Review supported cash evidence and unavailable inputs."
              },
              {
                icon: ShieldCheck,
                title: "Plan",
                desc: "Test explicit assumptions against a supported baseline."
              },
              {
                icon: Sparkles,
                title: "Night Scout Briefing",
                desc: "Review supported findings on the page; scheduled delivery is not active here."
              }
            ].map((feat, i) => (
              <div key={i} className="bg-card p-6 rounded-xl border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <feat.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold mb-3">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-24 bg-card relative z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">How Night Scout works</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Check source availability, inspect the figures and decide what to investigate. No automatic business action follows.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-5">
            {[
              ["01", "Connect Shopify", "Check which trading evidence is available; connection alone does not establish customer behaviour."],
              ["02", "Connect Xero", "Keep accounting evidence distinct from trading data; cash needs its own mapped sources."],
              ["03", "Review available evidence", "Inspect supported figures and missing inputs, with explicit periods and definitions."],
              ["04", "Choose a next check", "Use a scoped investigation or conditional test; outcomes and savings are not guaranteed."],
            ].map(([step, title, desc]) => (
              <div key={step} className="rounded-xl border border-border bg-background p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">{step}</p>
                <h3 className="text-lg font-bold text-foreground mb-3">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar py-12 text-sidebar-foreground border-t border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <BrandLogo imageClassName="h-16 w-[208px]" />
          </div>
          <p className="text-sidebar-foreground/60 text-sm">© 2024 Night Scout Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
