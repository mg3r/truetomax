"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mark } from "@/components/Mark";
import { APP_NAME } from "@/lib/brand";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error"));

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  // Typing the code (instead of tapping the link) keeps you signed in inside the installed phone app.
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError("That code didn't work. Check the latest email, or send a new code.");
    else router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Mark size={36} className="mark-draw text-ink" />
      <h1 className="mt-4 font-serif text-3xl">{APP_NAME}</h1>
      <p className="mt-1 text-muted">What to do today, and why.</p>

      {!sent ? (
        <form onSubmit={sendCode} className="mt-8 space-y-3">
          <label className="block text-sm text-muted" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn w-full justify-center" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 space-y-3">
          <label className="block text-sm text-muted" htmlFor="code">Enter the code sent to {email}</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" required className="field text-center text-xl tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn w-full justify-center" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="w-full text-sm text-muted underline" onClick={() => setSent(false)}>Use a different email</button>
        </form>
      )}
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
