"use client";

import { useEffect, useState } from "react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { type RecorderConfig } from "@/types/config";

export function SettingsPanel() {
  const { config, configPath, isLoading, isDesktopMode, saveState, statusText, saveConfig } =
    useAppConfig();

  const [draft, setDraft] = useState<RecorderConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const isSaving = saveState === "saving";

  async function handleSave() {
    await saveConfig(draft);
  }

  function handleReset() {
    setDraft(config);
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#1a1d24]/80 backdrop-blur-md p-6 shadow-2xl">
      <h2 className="text-xl font-semibold text-white">Application Settings</h2>
      <p className="mt-1 text-sm text-slate-400">Set default behavior for recording sessions.</p>

      <div className="mt-6 grid gap-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/50 bg-[#13161a]/50 p-4 transition hover:bg-[#13161a]">
          <input
            type="checkbox"
            checked={draft.includeSystemAudio}
            onChange={(event) => {
              setDraft((current) => ({ ...current, includeSystemAudio: event.target.checked }));
            }}
            disabled={isLoading || isSaving}
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-0"
          />
          <div className="grid gap-1">
            <span className="text-sm font-medium text-slate-300">Include system audio</span>
            <span className="text-xs text-slate-500">Capture the playback of internal system sounds if supported by the OS.</span>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/50 bg-[#13161a]/50 p-4 transition hover:bg-[#13161a]">
          <input
            type="checkbox"
            checked={draft.includeMicrophone}
            onChange={(event) => {
              setDraft((current) => ({ ...current, includeMicrophone: event.target.checked }));
            }}
            disabled={isLoading || isSaving}
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-0"
          />
          <div className="grid gap-1">
            <span className="text-sm font-medium text-slate-300">Include microphone input</span>
            <span className="text-xs text-slate-500">Record your voice directly alongside the video capture.</span>
          </div>
        </label>

      </div>

      <div className="mt-8 flex flex-wrap gap-3 pt-4 border-t border-slate-800/50">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="rounded-xl border border-transparent bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save settings"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading || isSaving}
          className="rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
        >
          Reset form
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-slate-800/80 bg-[#13161a] p-4 text-xs font-mono text-slate-500">
        <p className="flex justify-between items-center py-1"><span>Status</span> <span className="text-slate-400">{statusText}</span></p>
        <p className="flex justify-between items-center py-1 border-t border-slate-800 border-dashed mt-1 pt-2"><span>Runtime</span> <span className="text-slate-400">{isDesktopMode ? "Electron desktop profile" : "Browser fallback profile"}</span></p>
        {configPath ? <p className="flex justify-between items-center py-1 border-t border-slate-800 border-dashed mt-1 pt-2"><span>Config Path</span> <span className="text-slate-400 truncate max-w-50 sm:max-w-xs">{configPath}</span></p> : null}
      </div>
    </section>
  );
}
