"use client";

import { useEffect, useState } from "react";

type State = "checking" | "unsupported" | "install" | "off" | "on" | "blocked";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Turn the morning notification on or off for this device. */
export function MorningToggle() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhones only allow notifications once the app is on the home screen.
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        return setState(ios ? "install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  async function turnOn() {
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const res = await fetch("/api/push/key");
      const { key, error } = await res.json();
      if (!key) throw new Error(error ?? "Notifications aren't set up yet.");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const saved = await fetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      if (!saved.ok) throw new Error((await saved.json()).error ?? "Couldn't save this device.");
      setState("on");
      setNote("On. You'll get your affirmation around 7:30 each morning.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
    setNote(null);
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const res = await fetch("/api/push/test", { method: "POST" });
    const { sent } = await res.json().catch(() => ({ sent: 0 }));
    setNote(sent ? "Sent. It should arrive in a few seconds." : "Nothing was sent. Turn it off and on again.");
    setBusy(false);
  }

  return (
    <div className="mt-3">
      {state === "checking" && <p className="text-sm text-muted">Checking this device…</p>}
      {state === "install" && (
        <p className="text-sm text-muted">On iPhone, add truetomax to your Home Screen first (Share → Add to Home Screen), open it from there, then come back here.</p>
      )}
      {state === "unsupported" && <p className="text-sm text-muted">This browser can&rsquo;t receive notifications. Try the app installed on your phone.</p>}
      {state === "blocked" && <p className="text-sm text-muted">Notifications are blocked for truetomax. Allow them in your phone or browser settings, then reload.</p>}
      {state === "off" && (
        <button className="btn" onClick={turnOn} disabled={busy}>{busy ? "Turning on…" : "Turn on for this device"}</button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">On for this device</span>
          <button className="btn-quiet" onClick={test} disabled={busy}>Send a test</button>
          <button className="text-xs text-muted hover:text-ink" onClick={turnOff} disabled={busy}>Turn off</button>
        </div>
      )}
      {note && <p role="status" className="mt-2 text-sm text-muted">{note}</p>}
    </div>
  );
}
