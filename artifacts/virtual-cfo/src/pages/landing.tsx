import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BarChart3, ChevronRight, CheckCircle2, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <img
            src={`${import.meta.env.BASE_URL}nightscout-logo.png`}
            alt="Night Scout logo"
            className="h-12 w-auto"
          />
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Briefing</a>
            <a href="#opportunities" className="hover:text-foreground transition-colors">Opportunities</a>
            <Link href="/upgrade" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="font-semibold text-sm hover:text-primary transition-colors">Log in</Link>
            <Link href="/signup">
              <Button className="rounded-full px-6">Find Hidden Profit</Button>
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
            Wake Up To <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Profitable Growth</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Night Scout works while you sleep, analysing your Shopify and Xero data to uncover hidden profit, cash flow risks and growth opportunities.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm font-semibold text-foreground"
          >
            {["Connect Shopify + Xero in minutes", "No spreadsheets", "Plain-English CFO insights"].map((item) => (
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
                Find Hidden Profit <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-background/50 backdrop-blur">
              See Night Scout In Action
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
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Good Morning</p>
                  <h2 className="text-2xl font-display font-bold text-foreground">Night Scout identified:</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                  <Sparkles className="w-3.5 h-3.5" />
                  Overnight scan complete
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4 p-5">
                {[
                  ["£20,400", "hidden contribution", "Profit leak found"],
                  ["£18,000", "profit opportunity", "Recovery available"],
                  ["+ 2", "cash flow risks", "Needs attention"],
                ].map(([value, label, note]) => (
                  <div key={label} className="rounded-xl bg-background border border-border p-5">
                    <p className="text-3xl font-display font-bold text-foreground">{value}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{label}</p>
                    <p className="text-xs text-muted-foreground mt-3">{note}</p>
                  </div>
                ))}
              </div>
              <div className="mx-5 mb-5 rounded-xl bg-primary/10 border border-primary/20 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Recommended focus</p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xl font-display font-bold text-foreground">Reduce discount dependency</p>
                  <Button size="sm" className="rounded-full w-full sm:w-auto">View action</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Systems Section */}
      <section className="py-24 bg-card relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground mb-6 leading-tight">
              Your Business Is Already Telling You What To Fix
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Night Scout connects your systems and automatically explains:
            </p>
            <ul className="flex flex-col gap-4 mb-10">
              {[
                "Where profit is leaking",
                "Why margins are changing",
                "How long your cash will last",
                "Which actions create the biggest impact",
                "What to focus on next",
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
            Night Scout explains what is really happening —{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">automatically.</span>
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-card relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Your AI CFO In Five Minutes</h2>
          </div>

          <div className="grid md:grid-cols-5 gap-5">
            {[
              {
                icon: BarChart3,
                title: "Growth Quality",
                desc: "Is growth creating value or destroying it?"
              },
              {
                icon: TrendingUp,
                title: "Margin Recovery",
                desc: "Find hidden profit opportunities."
              },
              {
                icon: Wallet,
                title: "Cash Control",
                desc: "Spot future cash issues before they happen."
              },
              {
                icon: ShieldCheck,
                title: "Profit Growth",
                desc: "Understand what drives profit and what is holding it back."
              },
              {
                icon: ShieldCheck,
                title: "Weekly Night Scout Briefing",
                desc: "Wake up to the most important insight in your business."
              }
            ].map((feat, i) => (
              <div key={i} className="bg-background p-6 rounded-xl border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
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

      {/* Opportunities Section */}
      <section id="opportunities" className="py-24 bg-background relative z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-foreground mb-12">
            Hidden Profit Found This Month
          </h2>
          <div className="grid md:grid-cols-3 gap-5 mb-10 text-left">
            {[
              ["Contribution Recovery", "£20,400"],
              ["Profit Growth Opportunity", "£18,000"],
              ["Cash Released", "£12,500"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-7 shadow-sm">
                <p className="text-sm font-semibold text-muted-foreground mb-4">{label}</p>
                <p className="text-4xl font-display font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xl font-semibold text-foreground">Night Scout doesn't just report problems.</p>
          <p className="text-xl font-semibold text-primary mt-2">It quantifies the opportunity.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar py-12 text-sidebar-foreground border-t border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}nightscout-logo.png`}
              alt="Night Scout logo"
              className="h-10 w-auto"
            />
          </div>
          <p className="text-sidebar-foreground/60 text-sm">© 2024 Night Scout Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
