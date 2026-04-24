import { memo } from "react";
import {
  getBitratePreset,
  MAX_RECORDING_MINUTES_PRESETS,
  VIDEO_BITRATE_PRESETS,
} from "@/types/config";
import type { CaptureSource } from "@/types/recorder";

// ── Icon components (inline SVG — no extra bundle) ──────────────────────────

function IconMonitor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconVolume() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function IconMute() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RecorderControlPanelProps = {
  isElectronBridgeReady: boolean;
  sources: CaptureSource[];
  selectedSourceId: string;
  statusText: string;
  isSharing: boolean;
  isRecording: boolean;
  recordingDuration: number;
  hasCrop: boolean;
  includeSystemAudio: boolean;
  includeMicrophone: boolean;
  configLoading: boolean;
  configSaving: boolean;
  videoBitrateKbps: number;
  maxRecordingMinutes: number;
  onSourceChange: (id: string) => void;
  onVideoBitrateChange: (kbps: number) => void;
  onMaxRecordingMinutesChange: (min: number) => void;
  onSystemAudioChange: (enabled: boolean) => void;
  onMicrophoneChange: (enabled: boolean) => void;
  onRefreshSources: () => Promise<void>;
  onStartSharing: () => Promise<boolean>;
  onStopSharing: () => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onClearCrop: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const baseBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 active:scale-95";

// ── Component ─────────────────────────────────────────────────────────────────

export const RecorderControlPanel = memo(function RecorderControlPanel({
  isElectronBridgeReady,
  sources,
  selectedSourceId,
  statusText,
  isSharing,
  isRecording,
  recordingDuration,
  hasCrop,
  includeSystemAudio,
  includeMicrophone,
  configLoading,
  configSaving,
  videoBitrateKbps,
  maxRecordingMinutes,
  onSourceChange,
  onVideoBitrateChange,
  onMaxRecordingMinutesChange,
  onSystemAudioChange,
  onMicrophoneChange,
  onRefreshSources,
  onStartSharing,
  onStopSharing,
  onStartRecording,
  onStopRecording,
  onClearCrop,
}: RecorderControlPanelProps) {
  const isConfigBusy = configLoading || configSaving || isRecording;
  const selectedBitratePreset = getBitratePreset(videoBitrateKbps);

  // Derived audio label for status display
  const audioLabel = includeSystemAudio
    ? includeMicrophone ? "System + Mic" : "System audio"
    : includeMicrophone ? "Mic only" : "Muted";

  return (
    <aside className="glass-card panel-scroll flex flex-col gap-0 overflow-hidden">

      {/* ── Header bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-white">Console</h2>
          <p className="mt-0.5 text-[0.7rem] text-cyan-400 font-medium tracking-wide truncate max-w-[220px]" title={statusText}>
            {statusText}
          </p>
        </div>
        {isRecording && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full">
            <span className="rec-dot w-2 h-2 bg-rose-500 rounded-full" />
            <span className="text-xs font-bold text-rose-400 font-mono">{formatDuration(recordingDuration)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">

        {/* ── Engine badge ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-[0.6rem] px-2 py-0.5 rounded border font-mono tracking-tight ${
            isElectronBridgeReady
              ? "border-emerald-500/30 text-emerald-400/80"
              : "border-rose-500/30 text-rose-400/80"
          }`}>
            ENGINE: {isElectronBridgeReady ? "ELECTRON ✓" : "DISCONNECTED"}
          </span>
          <span className="text-[0.6rem] px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-400/80 font-mono tracking-tight">
            AUDIO: {configLoading ? "…" : audioLabel.toUpperCase()}
          </span>
        </div>

        {/* ── Source picker ─────────────────────────────────────────── */}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Display / Window</span>
            <button
              type="button"
              onClick={() => void onRefreshSources()}
              className="flex items-center gap-1 text-[0.65rem] text-slate-500 hover:text-cyan-400 transition"
              title="Refresh source list"
            >
              <IconRefresh /> Refresh
            </button>
          </div>
          <div className="relative">
            <select
              value={selectedSourceId}
              onChange={(e) => onSourceChange(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#13161a] px-4 py-2.5 pr-8 text-sm text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition appearance-none cursor-pointer"
            >
              {sources.length === 0
                ? <option value="">Searching for sources…</option>
                : sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.type === "screen" ? "🖥️" : "🪟"} {s.name}
                    </option>
                  ))
              }
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </div>
        </div>

        {/* ── Audio selection ───────────────────────────────────────── */}
        <div className="grid gap-2">
          <span className="text-xs font-semibold text-slate-300">Audio Input</span>

          {/* Visual toggle buttons — much clearer than hidden checkboxes */}
          <div className="grid grid-cols-2 gap-2">
            {/* System Audio */}
            <button
              type="button"
              disabled={isRecording}
              onClick={() => onSystemAudioChange(!includeSystemAudio)}
              className={`audio-btn flex-col h-auto py-3 ${includeSystemAudio ? "active" : ""}`}
              aria-pressed={includeSystemAudio}
            >
              <IconVolume />
              <span className="mt-1 text-[0.65rem] leading-none">System Audio</span>
              <span className={`mt-1 text-[0.55rem] font-bold ${includeSystemAudio ? "text-cyan-400" : "text-slate-600"}`}>
                {includeSystemAudio ? "ON" : "OFF"}
              </span>
            </button>

            {/* Microphone */}
            <button
              type="button"
              disabled={isRecording}
              onClick={() => onMicrophoneChange(!includeMicrophone)}
              className={`audio-btn flex-col h-auto py-3 ${includeMicrophone ? "active" : ""}`}
              aria-pressed={includeMicrophone}
            >
              <IconMic />
              <span className="mt-1 text-[0.65rem] leading-none">Microphone</span>
              <span className={`mt-1 text-[0.55rem] font-bold ${includeMicrophone ? "text-cyan-400" : "text-slate-600"}`}>
                {includeMicrophone ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          {/* Mute-all shortcut */}
          {(includeSystemAudio || includeMicrophone) && (
            <button
              type="button"
              disabled={isRecording}
              onClick={() => { onSystemAudioChange(false); onMicrophoneChange(false); }}
              className="audio-btn w-full justify-center text-[0.65rem] py-1.5 text-rose-400/70 hover:text-rose-300 border-rose-900/40 hover:border-rose-700/50"
            >
              <IconMute /> Mute all audio
            </button>
          )}
        </div>

        {/* ── Quality settings ──────────────────────────────────────── */}
        <div className="grid gap-3 rounded-xl border border-slate-800/70 bg-[#13161a]/60 p-3">
          <label className="grid gap-1">
            <span className="text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase">Video Bitrate</span>
            <select
              value={String(videoBitrateKbps)}
              onChange={(e) => onVideoBitrateChange(Number(e.target.value))}
              disabled={isConfigBusy}
              className="w-full rounded-lg border border-slate-700 bg-[#101318] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 transition"
            >
              {VIDEO_BITRATE_PRESETS.map((p) => (
                <option key={p.valueKbps} value={p.valueKbps}>
                  {p.displayLabel} — {p.recommendedFor}
                </option>
              ))}
            </select>
            {selectedBitratePreset && (
              <span className="text-[0.6rem] text-slate-500">
                Best for: {selectedBitratePreset.recommendedFor}
              </span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase">Auto-Stop</span>
            <select
              value={String(maxRecordingMinutes)}
              onChange={(e) => onMaxRecordingMinutesChange(Number(e.target.value))}
              disabled={isConfigBusy}
              className="w-full rounded-lg border border-slate-700 bg-[#101318] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 transition"
            >
              {MAX_RECORDING_MINUTES_PRESETS.map((v) => (
                <option key={v} value={v}>{v === 0 ? "No limit" : `${v} min`}</option>
              ))}
            </select>
          </label>
        </div>

        {!isElectronBridgeReady && (
          <div className="rounded-xl border border-rose-900/20 bg-rose-950/10 px-3 py-2">
            <p className="text-[0.65rem] text-rose-400/80 leading-relaxed">
              Electron engine disconnected — restart the app to restore capture.
            </p>
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────── */}
        <div className="mt-auto grid gap-2 border-t border-slate-800/50 pt-4">
          {/* Preview row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void onStartSharing()}
              className={`${baseBtn} bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_12px_rgba(34,211,238,0.2)]`}
            >
              <IconMonitor /> Preview
            </button>
            <button
              type="button"
              onClick={onStopSharing}
              disabled={!isSharing}
              className={`${baseBtn} border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800`}
            >
              Stop
            </button>
          </div>

          {/* Record */}
          <button
            type="button"
            onClick={() => void onStartRecording()}
            disabled={isRecording}
            className={`${baseBtn} bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.25)] hover:shadow-[0_0_22px_rgba(244,63,94,0.4)]`}
          >
            {isRecording ? "● Recording…" : "● Start Recording"}
          </button>

          {/* Finish / Clear row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onStopRecording}
              disabled={!isRecording}
              className={`${baseBtn} border border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/60`}
            >
              Finish
            </button>
            <button
              type="button"
              onClick={onClearCrop}
              disabled={!hasCrop}
              className={`${baseBtn} border border-amber-900/30 bg-amber-950/20 text-amber-500/70 hover:bg-amber-900/50`}
            >
              Clear Crop
            </button>
          </div>

          <p className="text-center text-[0.6rem] text-slate-600 mt-1">
            <kbd className="font-mono text-cyan-700/80">Ctrl+Shift+R</kbd> REC ·{" "}
            <kbd className="font-mono text-cyan-700/80">Ctrl+Shift+S</kbd> STOP
          </p>
        </div>
      </div>
    </aside>
  );
});
