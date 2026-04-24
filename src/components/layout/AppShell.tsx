"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState, memo } from "react";

type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string }
  | { status: "downloaded"; version: string };

type AppShellProps = { children: ReactNode };

// Memoised — never re-renders unless children change
export const AppShell = memo(function AppShell({ children }: AppShellProps) {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const c1 = window.electronAPI?.onUpdateAvailable?.((info) => {
      setUpdate({ status: "available", version: info.version });
      setDismissed(false);
    });
    if (c1) cleanups.push(c1);
    const c2 = window.electronAPI?.onUpdateDownloaded?.((info) => {
      setUpdate({ status: "downloaded", version: info.version });
      setDismissed(false);
    });
    if (c2) cleanups.push(c2);
    return () => cleanups.forEach((c) => c());
  }, []);

  const showBanner = !dismissed && update.status !== "idle";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-3 py-5 sm:px-5 sm:py-7 md:px-8 md:py-9">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="glass-card px-5 py-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">

          {/* Brand */}
          <div className="min-w-0">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-cyan-400">
              Desktop Recorder
            </p>
            <h1 className="flex items-baseline gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Screen<span className="text-cyan-400">Studio</span>
              {appVersion && (
                <span className="ml-1 text-[0.55rem] font-mono text-slate-500 border border-slate-700/60 rounded-full px-2 py-0.5 leading-none">
                  v{appVersion}
                </span>
              )}
            </h1>
          </div>

          {/* Nav */}
          <nav className="flex gap-2 shrink-0">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white sm:px-4 sm:text-sm"
            >
              Recorder
            </Link>
            <Link
              href="/settings"
              className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white sm:px-4 sm:text-sm"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Update Banner ───────────────────────────────────────── */}
      {showBanner && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium ${
            update.status === "downloaded"
              ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
              : "border-cyan-500/30 bg-cyan-950/30 text-cyan-300"
          }`}
        >
          <span className="flex items-center gap-2">
            {update.status === "downloaded" ? "✓" : "↓"}
            {update.status === "downloaded"
              ? <>Update <strong>v{update.version}</strong> ready — restart to install</>
              : <>Downloading update <strong>v{update.version}</strong>…</>
            }
          </span>
          <div className="flex gap-2">
            {update.status === "downloaded" && (
              <button
                type="button"
                onClick={() => void window.electronAPI?.installUpdate?.()}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-bold text-white transition"
              >
                Restart & Install
              </button>
            )}
            <button type="button" onClick={() => setDismissed(true)}
              className="rounded-lg border border-current/30 px-2.5 py-1 text-xs opacity-60 hover:opacity-100 transition">
              ✕
            </button>
          </div>
        </div>
      )}

      {children}
    </main>
  );
});
