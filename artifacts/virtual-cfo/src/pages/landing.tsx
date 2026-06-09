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
          <BrandLogo imageClassName="h-20" />
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
            <a href="#discover" className="hover:text-foreground transition-colors">Discoveries</a>
            <a href="#process" className="hover:text-foreground transition-colors">How it works</a>
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
          <BrandLogo
            variant="mascot"
            glow
            className="mx-auto mb-12"
            imageClassName="h-48 w-48 sm:h-60 sm:w-60 rounded-full"
          />

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
            While you sleep, Night Scout analyses your Shopify and Xero data, finds hidden opportunities, spots cashflow risks and prepares your next CFO briefing.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm font-semibold text-foreground"
          >
            {[
              "Where profit is leaking",
              "How much cash you really have",
              "What action will make the biggest difference next",
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

      {/* Founder belief section */}
      <section id="founders" className="py-24 bg-background relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-foreground mb-10 leading-tight">
            Most founders think they're growing profitably
          </h2>
          <ul className="flex flex-col items-center gap-4 mb-10">
            {[
              "Revenue is up, but contribution is quietly leaking away.",
              "Discounts are doing more of the work than retention.",
              "Cash is tightening before the warning signs feel obvious.",
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
            Night Scout shows what profitable growth really looks like before another week slips by.
          </p>
        </div>
      </section>

      {/* Overnight discoveries */}
      <section id="discover" className="py-24 bg-card relative z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">What Night Scout discovers overnight</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              It reads the signals founders rarely have time to connect, then turns them into practical CFO actions by morning.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                title: "Hidden profit",
                value: "£20,400",
                desc: "Contribution leaking through discounts, costs and channel mix."
              },
              {
                title: "Cash risk",
                value: "+ 2",
                desc: "Upcoming cashflow pressure before it becomes a founder firefight."
              },
              {
                title: "Next best action",
                value: "1 focus",
                desc: "The most important move to make next, ranked by impact."
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
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Your Night Scout CFO in five minutes</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Connect the systems you already use and wake up to founder-grade insight, not another data chore.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-5">
            {[
              {
                icon: BarChart3,
                title: "Growth Quality",
                desc: "See whether growth is creating value or masking weakness."
              },
              {
                icon: TrendingUp,
                title: "Margin Recovery",
                desc: "Find profit leaks and the actions most likely to recover them."
              },
              {
                icon: Wallet,
                title: "Cash Control",
                desc: "Know how much cash you really have and what could tighten next."
              },
              {
                icon: ShieldCheck,
                title: "Profit Growth",
                desc: "Understand what is driving profit and what is holding it back."
              },
              {
                icon: Sparkles,
                title: "Night Scout Briefing",
                desc: "Wake up to the insight Night Scout would put first."
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
              Set it up once. Night Scout keeps watch while the business is quiet.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-5">
            {[
              ["01", "Connect Shopify", "Bring in the trading signals that reveal demand, discounts and customer behaviour."],
              ["02", "Connect Xero", "Add the cash, cost and profitability context behind the numbers."],
              ["03", "Night Scout analyses your data overnight", "Night Scout looks for hidden profit, cashflow risk and practical next moves."],
              ["04", "Wake up to your CFO briefing", "Start the day with the one action most likely to improve profitable growth."],
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
            <BrandLogo imageClassName="h-16" />
          </div>
          <p className="text-sidebar-foreground/60 text-sm">© 2024 Night Scout Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
