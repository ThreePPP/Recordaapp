"use client";

import { useEffect, useState } from "react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useLang } from "@/hooks/useLang";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { type RecorderConfig } from "@/types/config";

// ── Main Settings Panel ──────────────────────────────────────────────────────

export function SettingsPanel() {
  const { config, configPath, isLoading, isDesktopMode, saveState, statusText, saveConfig } =
    useAppConfig();
  const { lang, t, setLang } = useLang();

  const [draft, setDraft] = useState<RecorderConfig>(config);
  const [mounted, setMounted] = useState(false);
  // Ensure client-only render (avoids SSR/hydration mismatch in Electron static export)
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setDraft(config); }, [config]);

  const isSaving = saveState === "saving";

  // ── Save path picker ───────────────────────────────────────────────────────
  const handleBrowseSavePath = async () => {
    const chosen = await window.electronAPI?.selectSavePath?.();
    if (chosen) {
      setDraft((cur) => ({ ...cur, savePath: chosen }));
    }
  };

  if (!mounted) {
    return (
      <section className="glass-card p-6 max-w-2xl w-full mx-auto flex items-center justify-center min-h-[200px]">
        <span className="text-sm text-slate-500 animate-pulse">Loading settings…</span>
      </section>
    );
  }

  return (
    <section className="glass-card p-6 grid gap-8 max-w-2xl w-full mx-auto">

      <div>
        <h2 className="text-xl font-bold text-white">{t.settingsTitle}</h2>
        <p className="mt-1 text-sm text-slate-400">{t.settingsDesc}</p>
      </div>

      {/* ── Language selector ────────────────────────────────────── */}
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{t.langSection}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{t.langHint}</p>
        </div>
        <div className="flex gap-2">
          {(Object.entries(LANGUAGES) as [Lang, string][]).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                lang === code
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-400"
                  : "border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {code === "th" ? "🇹🇭" : "🇬🇧"} {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800/60" />

      {/* ── Save Location ──────────────────────────────────────────── */}
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{t.savePathSection}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{t.savePathHint}</p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-[#13161a]/50 p-4">
          {/* Folder icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <div className="flex-1 min-w-0">
            {draft.savePath
              ? <p className="text-xs text-slate-300 font-mono truncate" title={draft.savePath}>{draft.savePath}</p>
              : <p className="text-xs text-amber-400/80 italic">{t.savePathNotSet}</p>
            }
          </div>
          <button type="button"
            onClick={() => void handleBrowseSavePath()}
            disabled={isSaving}
            className="shrink-0 rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition disabled:opacity-50">
            {draft.savePath ? t.savePathChange : t.savePathBrowse}
          </button>
        </div>
      </div>

      {/* ── Save / Reset ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800/50">
        <button type="button" onClick={() => void saveConfig(draft)}
          disabled={isLoading || isSaving}
          className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50">
          {isSaving ? t.saving : t.saveSettings}
        </button>
        <button type="button" onClick={() => setDraft(config)}
          disabled={isLoading || isSaving}
          className="rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50">
          {t.resetForm}
        </button>
      </div>

      <div className="border-t border-slate-800/60" />

      {/* ── Debug info ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800/80 bg-[#13161a] p-4 text-xs font-mono text-slate-500 grid gap-2">
        <div className="flex justify-between">
          <span>{t.statusLabel}</span>
          <span className="text-slate-400 truncate max-w-[200px] sm:max-w-xs text-right">{statusText}</span>
        </div>
        <div className="flex justify-between border-t border-slate-800/60 pt-2">
          <span>{t.runtimeLabel}</span>
          <span className="text-slate-400">{isDesktopMode ? t.runtimeDesktop : t.runtimeBrowser}</span>
        </div>
        {configPath && (
          <div className="flex justify-between border-t border-slate-800/60 pt-2">
            <span>{t.configPathLabel}</span>
            <span className="text-slate-400 truncate max-w-[200px] sm:max-w-xs text-right">{configPath}</span>
          </div>
        )}
      </div>
    </section>
  );
}
