import {
  getBitratePreset,
  MAX_RECORDING_MINUTES_PRESETS,
  VIDEO_BITRATE_PRESETS,
} from "@/types/config";
import type { CaptureSource } from "@/types/recorder";

type RecorderControlPanelProps = {
  isElectronBridgeReady: boolean;
  sources: CaptureSource[];
  selectedSourceId: string;
  statusText: string;
  isSharing: boolean;
  isRecording: boolean;
  recordingDuration: number;
  hasCrop: boolean;
  audioProfileLabel: string;
  configLoading: boolean;
  configSaving: boolean;
  videoBitrateKbps: number;
  maxRecordingMinutes: number;
  onSourceChange: (sourceId: string) => void;
  onVideoBitrateChange: (bitrateKbps: number) => void;
  onMaxRecordingMinutesChange: (minutes: number) => void;
  onRefreshSources: () => Promise<void>;
  onStartSharing: () => Promise<boolean>;
  onStopSharing: () => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onClearCrop: () => void;
};

const baseButtonClass =
  "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-0 focus:ring-offset-[#1a1d24]";

export function RecorderControlPanel({
  isElectronBridgeReady,
  sources,
  selectedSourceId,
  statusText,
  isSharing,
  isRecording,
  recordingDuration,
  hasCrop,
  audioProfileLabel,
  configLoading,
  configSaving,
  videoBitrateKbps,
  maxRecordingMinutes,
  onSourceChange,
  onVideoBitrateChange,
  onMaxRecordingMinutesChange,
  onRefreshSources,
  onStartSharing,
  onStopSharing,
  onStartRecording,
  onStopRecording,
  onClearCrop,
}: RecorderControlPanelProps) {
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const isConfigBusy = configLoading || configSaving || isRecording;
  const selectedBitratePreset = getBitratePreset(videoBitrateKbps);

  return (
    <aside className="rounded-2xl border border-slate-800 bg-[#1a1d24]/80 backdrop-blur-md p-6 shadow-2xl lg:sticky lg:top-8 flex flex-col h-full">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-white">Console</h2>
          <p className="mt-1 text-sm text-cyan-400 font-medium tracking-wide">
            {statusText}
          </p>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full">
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-rose-500 font-mono">
              {formatDuration(recordingDuration)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 gap-6">
        <div className="mt-2 flex gap-2">
           <span className="text-[0.6rem] px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-500/80 font-mono tracking-tighter">
             AUDIO: {configLoading ? "LOADING" : audioProfileLabel.toUpperCase()}
           </span>
           <span className={`text-[0.6rem] px-2 py-0.5 rounded border font-mono tracking-tighter ${isElectronBridgeReady ? "border-emerald-500/30 text-emerald-500/80" : "border-rose-500/30 text-rose-500/80"}`}>
             ENGINE: {isElectronBridgeReady ? "ELECTRON" : "DISCONNECTED"}
           </span>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Target Display / Window</span>
          <div className="relative group">
            <select
              value={selectedSourceId}
              onChange={(event) => onSourceChange(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#13161a] px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition appearance-none cursor-pointer"
            >
              {sources.length === 0 ? <option value="">Searching for sources...</option> : null}
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.type === "screen" ? "🖥️ SCREEN:" : "🪟 WINDOW:"} {source.name}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-cyan-500 transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-800/70 bg-[#13161a]/60 p-3">
          <label className="grid gap-1">
            <span className="text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase">Video bitrate</span>
            <select
              value={String(videoBitrateKbps)}
              onChange={(event) => {
                onVideoBitrateChange(Number(event.target.value));
              }}
              disabled={isConfigBusy}
              className="w-full rounded-lg border border-slate-700 bg-[#101318] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            >
              {VIDEO_BITRATE_PRESETS.map((preset) => (
                <option key={preset.valueKbps} value={preset.valueKbps}>
                  {preset.displayLabel} - {preset.recommendedFor}
                </option>
              ))}
            </select>
            {selectedBitratePreset ? (
              <span className="text-[0.65rem] text-slate-500">
                Recommended usage: {selectedBitratePreset.recommendedFor}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1">
            <span className="text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase">Auto stop</span>
            <select
              value={String(maxRecordingMinutes)}
              onChange={(event) => {
                onMaxRecordingMinutesChange(Number(event.target.value));
              }}
              disabled={isConfigBusy}
              className="w-full rounded-lg border border-slate-700 bg-[#101318] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            >
              {MAX_RECORDING_MINUTES_PRESETS.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "Unlimited" : `${value} min`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            void onRefreshSources();
          }}
          className="rounded-xl border border-slate-800 bg-[#1a1d24] px-4 py-2.5 text-[0.7rem] font-bold text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition uppercase tracking-wider"
        >
          Refresh Signal List
        </button>

        {!isElectronBridgeReady ? (
          <div className="rounded-xl border border-rose-900/20 bg-rose-950/10 p-3">
             <p className="text-[0.65rem] text-rose-400/80 leading-relaxed font-medium">
               ELECTRON ENGINE DISCONNECTED. PLEASE RESTART THE APP TO RESTORE FULL CAPTURE CAPABILITIES.
             </p>
          </div>
        ) : null}

        <div className="mt-auto pt-6 border-t border-slate-800/50 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                void onStartSharing();
              }}
              className={`${baseButtonClass} bg-cyan-600 text-white hover:bg-cyan-500`}
            >
              Start Preview
            </button>
            <button
              type="button"
              onClick={onStopSharing}
              disabled={!isSharing}
              className={`${baseButtonClass} border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800`}
            >
              Stop
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              void onStartRecording();
            }}
            disabled={isRecording}
            className={`${baseButtonClass} bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_20px_rgba(225,29,72,0.5)]`}
          >
            {isRecording ? "● REC" : "● START RECORDING"}
          </button>
          
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button
              type="button"
              onClick={onStopRecording}
              disabled={!isRecording}
              className={`${baseButtonClass} border border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/60 hover:text-rose-200`}
            >
              Finish Recording
            </button>
            <button
              type="button"
              onClick={onClearCrop}
              disabled={!hasCrop}
              className={`${baseButtonClass} border border-amber-900/30 bg-amber-950/20 text-amber-500/70 hover:bg-amber-900/50 hover:text-amber-300`}
            >
              Clear Crop
            </button>
          </div>
          <p className="text-center text-[0.65rem] text-slate-500 font-medium tracking-wide">
            HOTKEYS: <kbd className="font-mono text-cyan-600/80">CTRL+SHIFT+R</kbd> (REC) / <kbd className="font-mono text-cyan-600/80">CTRL+SHIFT+S</kbd> (STOP ALL)
          </p>
        </div>
      </div>
    </aside>
  );
}
