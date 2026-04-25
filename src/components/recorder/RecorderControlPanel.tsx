import { memo, useCallback, useEffect, useState } from "react";
import {
  getBitratePreset,
  MAX_RECORDING_MINUTES_PRESETS,
  VIDEO_BITRATE_PRESETS,
} from "@/types/config";
import type { CaptureSource } from "@/types/recorder";
import { useLang } from "@/hooks/useLang";

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconMonitor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconVolume() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function IconMute() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  isElectronBridgeReady: boolean;
  sources: CaptureSource[];
  selectedSourceId: string;
  statusText: string;
  isSharing: boolean;
  isRecording: boolean;
  isPaused: boolean;
  latestRecordingPath: string | null;
  recordingDuration: number;
  hasCrop: boolean;
  includeSystemAudio: boolean;
  includeMicrophone: boolean;
  microphoneDeviceId?: string;
  configLoading: boolean;
  configSaving: boolean;
  videoBitrateKbps: number;
  maxRecordingMinutes: number;
  onSourceChange: (id: string) => void;
  onVideoBitrateChange: (kbps: number) => void;
  onMaxRecordingMinutesChange: (min: number) => void;
  onSystemAudioChange: (enabled: boolean) => void;
  onMicrophoneChange: (enabled: boolean) => void;
  onMicrophoneDeviceChange: (id: string) => void;
  onRefreshSources: () => Promise<void>;
  onStartSharing: () => Promise<boolean>;
  onStopSharing: () => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
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
  isPaused,
  latestRecordingPath,
  recordingDuration,
  hasCrop,
  includeSystemAudio,
  includeMicrophone,
  microphoneDeviceId,
  configLoading,
  configSaving,
  videoBitrateKbps,
  maxRecordingMinutes,
  onSourceChange,
  onVideoBitrateChange,
  onMaxRecordingMinutesChange,
  onSystemAudioChange,
  onMicrophoneChange,
  onMicrophoneDeviceChange,
  onRefreshSources,
  onStartSharing,
  onStopSharing,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onClearCrop,
}: Props) {
  const { t } = useLang();
  const isConfigBusy = configLoading || configSaving || isRecording;
  const selectedBitratePreset = getBitratePreset(videoBitrateKbps);

  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMicDevices(devices.filter((d) => d.kind === "audioinput"));
      } catch (err) {
        console.warn("Failed to enumerate devices", err);
      }
    }
    void fetchDevices();

    navigator.mediaDevices.addEventListener("devicechange", fetchDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", fetchDevices);
  }, []);

  const audioStatusText = includeSystemAudio
    ? includeMicrophone ? `${t.systemAudio} + ${t.microphone}` : t.systemAudio
    : includeMicrophone ? t.microphone : "Muted";

  // Request OS microphone permission before enabling mic capture
  const handleMicToggle = useCallback(async () => {
    if (includeMicrophone) {
      // Turning off — no permission needed
      onMicrophoneChange(false);
      return;
    }
    // Turning on — ask OS for permission first
    const granted = await window.electronAPI
      ?.requestMicrophonePermission?.();
    // granted is undefined in browser mode (non-Electron) — allow anyway
    if (granted !== false) {
      onMicrophoneChange(true);
    }
  }, [includeMicrophone, onMicrophoneChange]);

  return (
    <aside className="glass-card panel-scroll flex flex-col gap-0 overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
        <div className="min-w-0 flex-1 mr-3">
          <h2 className="text-base font-bold text-white">{t.consoleTitle}</h2>
          <p className="mt-0.5 text-[0.7rem] text-cyan-400 font-medium truncate" title={statusText}>
            {statusText}
          </p>
        </div>
        {isRecording && (
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full">
            <span className="rec-dot w-2 h-2 bg-rose-500 rounded-full" />
            <span className="text-xs font-bold text-rose-400 font-mono">{formatDuration(recordingDuration)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">

        {/* ── Status badges ──────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-[0.6rem] px-2 py-0.5 rounded border font-mono tracking-tight ${
            isElectronBridgeReady ? "border-emerald-500/30 text-emerald-400/80" : "border-rose-500/30 text-rose-400/80"
          }`}>
            {t.engineLabel}: {isElectronBridgeReady ? t.engineOk : t.engineDisconnected}
          </span>
          <span className="text-[0.6rem] px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-400/80 font-mono tracking-tight">
            {t.audioLabel}: {configLoading ? "…" : audioStatusText.toUpperCase()}
          </span>
        </div>

        {/* ── Source picker ──────────────────────────────────────── */}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">{t.displayWindow}</span>
            <button type="button" onClick={() => void onRefreshSources()}
              className="flex items-center gap-1 text-[0.65rem] text-slate-500 hover:text-cyan-400 transition">
              <IconRefresh /> {t.refreshBtn}
            </button>
          </div>
          <div className="relative">
            <select value={selectedSourceId} onChange={(e) => onSourceChange(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#13161a] px-4 py-2.5 pr-8 text-sm text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition appearance-none cursor-pointer">
              {sources.length === 0
                ? <option value="">{t.searchingSources}</option>
                : sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.type === "screen" ? "🖥️" : "🪟"} {s.name}
                    </option>
                  ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </div>
        </div>

        {/* ── Audio Input ────────────────────────────────────────── */}
        <div className="grid gap-2">
          <span className="text-xs font-semibold text-slate-300">{t.audioInput}</span>
          <div className="grid grid-cols-2 gap-2">

            {/* System Audio */}
            <button type="button" disabled={isRecording}
              onClick={() => onSystemAudioChange(!includeSystemAudio)}
              aria-pressed={includeSystemAudio}
              className={`audio-btn flex-col h-auto py-3 ${includeSystemAudio ? "active" : ""}`}>
              <IconVolume />
              <span className="mt-1 text-[0.65rem] leading-none">{t.systemAudio}</span>
              <span className={`mt-1.5 text-[0.55rem] font-bold px-1.5 py-0.5 rounded ${
                includeSystemAudio ? "bg-cyan-500/15 text-cyan-400" : "text-slate-600"
              }`}>{includeSystemAudio ? "ON" : "OFF"}</span>
            </button>

            {/* Microphone — requests OS permission on first enable */}
            <button type="button" disabled={isRecording}
              onClick={() => void handleMicToggle()}
              aria-pressed={includeMicrophone}
              className={`audio-btn flex-col h-auto py-3 ${includeMicrophone ? "active" : ""}`}>
              <IconMic />
              <span className="mt-1 text-[0.65rem] leading-none">{t.microphone}</span>
              <span className={`mt-1.5 text-[0.55rem] font-bold px-1.5 py-0.5 rounded ${
                includeMicrophone ? "bg-cyan-500/15 text-cyan-400" : "text-slate-600"
              }`}>{includeMicrophone ? "ON" : "OFF"}</span>
            </button>
          </div>

          {/* Mute all */}
          {(includeSystemAudio || includeMicrophone) && (
            <button type="button" disabled={isRecording}
              onClick={() => { onSystemAudioChange(false); onMicrophoneChange(false); }}
              className="audio-btn w-full justify-center text-[0.65rem] py-1.5 text-rose-400/70 hover:text-rose-300 border-rose-900/40 hover:border-rose-700/50">
              <IconMute /> {t.muteAll}
            </button>
          )}

          {/* Mic Device Select */}
          {includeMicrophone && micDevices.length > 0 && (
            <div className="grid gap-1 mt-1">
              <span className="text-[0.65rem] font-semibold tracking-wide text-slate-400 uppercase">{t.microphoneDevice}</span>
              <select value={microphoneDeviceId || ""} onChange={(e) => onMicrophoneDeviceChange(e.target.value)}
                disabled={isRecording}
                className="w-full rounded-lg border border-slate-700 bg-[#101318] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 transition cursor-pointer appearance-none">
                <option value="">{t.defaultDevice}</option>
                {micDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.slice(0, 5)})`}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Quality ────────────────────────────────────────────── */}
        <div className="grid gap-3 rounded-xl border border-slate-800/70 bg-[#13161a]/60 p-3">
          <label className="grid gap-1">
            <span className="text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase">{t.videoBitrate}</span>
            <select value={String(videoBitrateKbps)} onChange={(e) => onVideoBitrateChange(Number(e.target.value))}
              disabled={isConfigBusy}
              className="w-full rounded-lg border border-slate-700 bg-[#101318] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 transition">
              {VIDEO_BITRATE_PRESETS.map((p) => (
                <option key={p.valueKbps} value={p.valueKbps}>{p.displayLabel} — {p.recommendedFor}</option>
              ))}
            </select>
            {selectedBitratePreset && (
              <span className="text-[0.6rem] text-slate-500">{t.bestFor} {selectedBitratePreset.recommendedFor}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase">{t.autoStop}</span>
            <select value={String(maxRecordingMinutes)} onChange={(e) => onMaxRecordingMinutesChange(Number(e.target.value))}
              disabled={isConfigBusy}
              className="w-full rounded-lg border border-slate-700 bg-[#101318] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 transition">
              {MAX_RECORDING_MINUTES_PRESETS.map((v) => (
                <option key={v} value={v}>{v === 0 ? t.noLimit : `${v} min`}</option>
              ))}
            </select>
          </label>
        </div>

        {!isElectronBridgeReady && (
          <div className="rounded-xl border border-rose-900/20 bg-rose-950/10 px-3 py-2">
            <p className="text-[0.65rem] text-rose-400/80 leading-relaxed">{t.electronDisconnected}</p>
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────── */}
        <div className="mt-auto grid gap-2 border-t border-slate-800/50 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void onStartSharing()}
              className={`${baseBtn} bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_12px_rgba(34,211,238,0.2)]`}>
              <IconMonitor /> {t.preview}
            </button>
            <button type="button" onClick={onStopSharing} disabled={!isSharing}
              className={`${baseBtn} border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800`}>
              {t.stop}
            </button>
          </div>

          {!isRecording ? (
            <button type="button" onClick={() => void onStartRecording()} disabled={isRecording}
              className={`${baseBtn} bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.25)] hover:shadow-[0_0_22px_rgba(244,63,94,0.4)]`}>
              ● {t.startRecording}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={isPaused ? onResumeRecording : onPauseRecording}
                className={`${baseBtn} border border-amber-900/50 bg-amber-950/30 text-amber-500 hover:bg-amber-900/50`}>
                {isPaused ? `▶ ${t.resumeRecording}` : `⏸ ${t.pauseRecording}`}
              </button>
              <button type="button" onClick={onStopRecording}
                className={`${baseBtn} bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.25)] hover:shadow-[0_0_22px_rgba(244,63,94,0.4)]`}>
                ■ {t.finish}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onClearCrop} disabled={!hasCrop}
              className={`${baseBtn} border border-amber-900/30 bg-amber-950/20 text-amber-500/70 hover:bg-amber-900/50`}>
              {t.clearCrop}
            </button>
            {!isRecording && latestRecordingPath ? (
              <button type="button" onClick={() => void window.electronAPI?.openPath?.(latestRecordingPath)}
                className={`${baseBtn} border border-emerald-900/30 bg-emerald-950/20 text-emerald-500/80 hover:bg-emerald-900/50`}>
                📂 {t.openLatest}
              </button>
            ) : (
              <div />
            )}
          </div>

          <p className="text-center text-[0.6rem] text-slate-600 mt-1">
            <kbd className="font-mono text-cyan-700/80">Ctrl+Shift+R</kbd> {t.hotkeys} ·{" "}
            <kbd className="font-mono text-cyan-700/80">Ctrl+Shift+S</kbd> {t.stop}
          </p>
        </div>
      </div>
    </aside>
  );
});
