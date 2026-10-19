"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** A button that asks the partner to do something, then refreshes the page with the result. */
export function AskPartner({ endpoint, body, label, busyLabel, className = "btn" }: { endpoint: string; body?: object; label: string; busyLabel: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, { method: "POST", body: JSON.stringify(body ?? {}) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Your partner couldn't finish that. Try again.");
    router.refresh();
  }

  return (
    <div>
      <button className={className} onClick={go} disabled={busy}>{busy ? busyLabel : label}</button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
