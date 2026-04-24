"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string }
  | { status: "downloaded"; version: string };

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  // Fetch version once on mount
  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(setAppVersion).catch(() => {});
  }, []);

  // Register update listeners
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const c1 = window.electronAPI?.onUpdateAvailable?.((info) => {
      setUpdate({ status: "available", version: info.version });
      setDismissedUpdate(false);
    });
    if (c1) cleanups.push(c1);

    const c2 = window.electronAPI?.onUpdateDownloaded?.((info) => {
      setUpdate({ status: "downloaded", version: info.version });
      setDismissedUpdate(false);
    });
    if (c2) cleanups.push(c2);

    return () => cleanups.forEach((c) => c());
  }, []);

  const showBanner = !dismissedUpdate && update.status !== "idle";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-slate-800 bg-[#1a1d24]/80 backdrop-blur-md p-6 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-cyan-400">
              Desktop Recorder
            </p>
            <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
              Screen<span className="text-cyan-400">Studio</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Record your screen with optional audio and configurable defaults.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Version badge */}
            {appVersion && (
              <span className="text-[0.6rem] font-mono px-2.5 py-1 rounded-full border border-slate-700/60 text-slate-500 tracking-widest">
                v{appVersion}
              </span>
            )}

            <nav className="flex gap-3">
              <Link
                href="/"
                className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
              >
                Recorder
              </Link>
              <Link
                href="/settings"
                className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
              >
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Update Banner ───────────────────────────────────────────────── */}
      {showBanner && (
        <div
          className={`relative flex items-center justify-between gap-4 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg transition-all ${
            update.status === "downloaded"
              ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
              : "border-cyan-500/30 bg-cyan-950/30 text-cyan-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {update.status === "downloaded" ? (
              /* Downloaded — ready to install */
              <>
                <span className="text-emerald-400 text-base">✓</span>
                <span>
                  Update <strong>v{update.version}</strong> downloaded and ready to install.
                </span>
              </>
            ) : (
              /* Available — downloading */
              <>
                <span className="animate-pulse text-cyan-400 text-base">↓</span>
                <span>
                  Update <strong>v{update.version}</strong> found — downloading in background…
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {update.status === "downloaded" && (
              <button
                type="button"
                onClick={() => void window.electronAPI?.installUpdate?.()}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition"
              >
                Restart & Install
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissedUpdate(true)}
              aria-label="Dismiss update notification"
              className="rounded-lg border border-current/30 px-2.5 py-1.5 text-xs opacity-60 hover:opacity-100 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {children}
    </main>
  );
}
