import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate auth delay then redirect
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1000);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 sm:p-12 relative">
        <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back to home
        </Link>
        
        <div className="w-full max-w-md">
          <BrandLogo className="mb-8" imageClassName="h-20" />
          
          <h1 className="text-3xl font-display font-bold mb-2">Welcome Back To Night Scout</h1>
          <p className="text-muted-foreground mb-8">Wake up to profitable growth.</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Email address</label>
              <input 
                type="email" 
                required
                placeholder="founder@startup.com" 
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-foreground">Password</label>
                <a href="#" className="text-sm font-medium text-primary hover:underline">Forgot password?</a>
              </div>
              <input 
                type="password" 
                required
                placeholder="••••••••" 
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
            
            <Button type="submit" className="w-full h-12 text-base mt-2" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In to Night Scout"}
            </Button>
            
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-background text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <Button type="button" variant="outline" className="w-full h-12">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </Button>
          </form>
          
          <p className="mt-8 text-center text-sm text-muted-foreground">
            New to Night Scout?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">Get started</Link>
          </p>

          <div className="mt-8 pt-6 border-t border-dashed border-border">
            <p className="text-xs text-center text-muted-foreground/60 mb-3 uppercase tracking-widest font-semibold">Development preview</p>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 text-sm border-dashed text-muted-foreground hover:text-foreground gap-2"
              onClick={() => {
                sessionStorage.setItem("demoMode", "true");
                window.location.href = "/dashboard";
              }}
            >
              <Sparkles className="w-4 h-4" />
              Enter demo briefing
            </Button>
          </div>
        </div>
      </div>
      
      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-sidebar">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-side.png`} 
          alt="Abstract financial data" 
          className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar/90 via-sidebar/20 to-transparent"></div>
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Good Morning.</p>
            <h2 className="text-2xl font-display font-bold text-white mb-5">Night Scout identified:</h2>
            <div className="space-y-3 mb-6">
              <p className="flex justify-between gap-4 text-white/90"><span>£20,400 hidden contribution</span><span className="text-emerald-300">found</span></p>
              <p className="flex justify-between gap-4 text-white/90"><span>£18,000 profit opportunity</span><span className="text-emerald-300">ready</span></p>
              <p className="flex justify-between gap-4 text-white/90"><span>+ 1 cash risk</span><span className="text-amber-300">watch</span></p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Recommended focus</p>
              <p className="text-xl font-display font-bold text-white">Reduce discount dependency</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
