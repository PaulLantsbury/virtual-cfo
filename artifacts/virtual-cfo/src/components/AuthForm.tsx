import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export function AuthForm({ signup = false }: { signup?: boolean }) {
  const [, navigate] = useLocation();
  const { beginSignIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get('email') || '').trim();
    const password = String(fields.get('password') || '');
    if (signup && password !== fields.get('confirmation')) { setError('The passwords do not match.'); return; }
    beginSignIn();
    setBusy(true); setError(''); setMessage('');
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) { setError('We could not create your account. Check your details and try again.'); return; }
        form.reset();
        if (data.session) navigate('/dashboard');
        else setMessage('Check your email for a confirmation link, then sign in. Your account will also need to be linked to a store.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.session) { setError('We could not sign you in. Check your email and password, and confirm your email if needed.'); return; }
        form.reset(); navigate('/dashboard');
      }
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }
  const inputClass = 'w-full rounded-xl border-2 border-border bg-background px-4 py-3 focus:outline-none focus:border-primary';
  return <main className="min-h-screen grid lg:grid-cols-2">
    <div className="flex flex-col justify-center p-8 sm:p-12">
      <Link href="/" className="mb-8 text-sm text-primary">← Back to home</Link>
      <div className="w-full max-w-md mx-auto">
        <BrandLogo className="mb-8" imageClassName="h-20" />
        <h1 className="text-3xl font-display font-bold mb-3">{signup ? 'Create your Night Scout account' : 'Welcome back to Night Scout'}</h1>
        <p className="text-muted-foreground mb-8">{signup ? 'Create an account, then ask your administrator to link your store.' : 'Sign in to access your store.'}</p>
        <form onSubmit={submit} className="space-y-5">
          <div><label htmlFor="email" className="block mb-2 font-medium">Email address</label><input id="email" name="email" type="email" autoComplete="email" required disabled={busy} className={inputClass} /></div>
          <div><label htmlFor="password" className="block mb-2 font-medium">Password</label><input id="password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} required disabled={busy} className={inputClass} /></div>
          {signup && <div><label htmlFor="confirmation" className="block mb-2 font-medium">Confirm password</label><input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={busy} className={inputClass} /></div>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
          {message && <p role="status">{message}</p>}
          <Button type="submit" className="w-full h-12" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</Button>
        </form>
        <p className="mt-6 text-sm">{signup ? 'Already have an account? ' : 'Need an account? '}<Link className="text-primary underline" href={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create account'}</Link></p>
      </div>
    </div>
    <div className="hidden lg:flex bg-sidebar text-white items-end p-12"><div><h2 className="text-3xl font-display mb-4">A clearer view of your business.</h2><p className="text-white/75">Your store data stays hidden until your account and store access are verified.</p></div></div>
  </main>;
}
