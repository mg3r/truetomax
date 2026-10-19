"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mark } from "@/components/Mark";
import { APP_NAME } from "@/lib/brand";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);

  // Email and password, typed inside the app, keeps you signed in on the installed phone app too.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError("That email and password don't match. Check both and try again.");
      return router.replace("/");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) return router.replace("/");
    setNotice("Account created. Confirm it from the email Supabase just sent, then sign in here.");
    setMode("signin");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Mark size={36} className="mark-draw text-ink" />
      <h1 className="mt-4 font-serif text-3xl">{APP_NAME}</h1>
      <p className="mt-1 text-muted">What to do today, and why.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm text-muted" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-muted" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn w-full justify-center" disabled={busy}>
          {busy ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
      >
        {mode === "signin" ? "First time here? Create your account" : "Already have an account? Sign in"}
      </button>

      {notice && <p role="status" className="mt-4 text-sm">{notice}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
