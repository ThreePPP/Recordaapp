import type { CaptureMode } from "@/types/recorder";

export type VideoBitratePreset = {
  valueKbps: number;
  displayLabel: string;
  recommendedFor: string;
};

export const VIDEO_BITRATE_PRESETS = [
  { valueKbps: 1500, displayLabel: "1.5 Mbps", recommendedFor: "480p30, presentation-heavy content" },
  { valueKbps: 2500, displayLabel: "2.5 Mbps", recommendedFor: "720p30, lightweight recording" },
  { valueKbps: 3500, displayLabel: "3.5 Mbps", recommendedFor: "720p30, sharper text and UI" },
  { valueKbps: 5000, displayLabel: "5 Mbps", recommendedFor: "720p60 or 1080p30, balanced" },
  { valueKbps: 6500, displayLabel: "6.5 Mbps", recommendedFor: "1080p30, improved motion detail" },
  { valueKbps: 8000, displayLabel: "8 Mbps", recommendedFor: "1080p30, high quality" },
  { valueKbps: 10000, displayLabel: "10 Mbps", recommendedFor: "1080p60, moderate motion" },
  { valueKbps: 12000, displayLabel: "12 Mbps", recommendedFor: "1080p60, high motion" },
  { valueKbps: 16000, displayLabel: "16 Mbps", recommendedFor: "1440p30" },
  { valueKbps: 20000, displayLabel: "20 Mbps", recommendedFor: "1440p60 or 4K24" },
  { valueKbps: 25000, displayLabel: "25 Mbps", recommendedFor: "4K30" },
  { valueKbps: 32000, displayLabel: "32 Mbps", recommendedFor: "4K60, strong CPU/GPU required" },
] as const satisfies readonly VideoBitratePreset[];

export const VIDEO_BITRATE_PRESETS_KBPS = VIDEO_BITRATE_PRESETS.map((preset) => preset.valueKbps);
export const MAX_RECORDING_MINUTES_PRESETS = [0, 1, 3, 5, 10, 15, 30, 60] as const;

export const DEFAULT_VIDEO_BITRATE_KBPS = 8000;
export const DEFAULT_MAX_RECORDING_MINUTES = 0;

const MIN_VIDEO_BITRATE_KBPS = 1000;
const MAX_VIDEO_BITRATE_KBPS = 50000;
const MAX_RECORDING_MINUTES_LIMIT = 180;

export function getBitratePreset(valueKbps: number): VideoBitratePreset | undefined {
  return VIDEO_BITRATE_PRESETS.find((preset) => preset.valueKbps === valueKbps);
}

export function formatBitrateLabel(valueKbps: number): string {
  return `${(valueKbps / 1000).toFixed(valueKbps % 1000 === 0 ? 0 : 1)} Mbps`;
}

export type RecorderConfig = {
  preferredCaptureMode: CaptureMode;
  includeSystemAudio: boolean;
  includeMicrophone: boolean;
  microphoneDeviceId?: string;
  videoBitrateKbps: number;
  maxRecordingMinutes: number;
  /** Folder path where recordings are saved. Empty string = not configured. */
  savePath: string;
};

export const DEFAULT_RECORDER_CONFIG: RecorderConfig = {
  preferredCaptureMode: "electron",
  includeSystemAudio: true,
  includeMicrophone: false,
  microphoneDeviceId: "",
  videoBitrateKbps: DEFAULT_VIDEO_BITRATE_KBPS,
  maxRecordingMinutes: DEFAULT_MAX_RECORDING_MINUTES,
  savePath: "",
};

function normalizeBitrateKbps(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_VIDEO_BITRATE_KBPS;
  }

  return Math.min(MAX_VIDEO_BITRATE_KBPS, Math.max(MIN_VIDEO_BITRATE_KBPS, Math.round(numeric)));
}

function normalizeMaxRecordingMinutes(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_MAX_RECORDING_MINUTES;
  }

  return Math.min(MAX_RECORDING_MINUTES_LIMIT, Math.max(0, Math.round(numeric)));
}

export function normalizeRecorderConfig(value: Partial<RecorderConfig> | null | undefined): RecorderConfig {
  const preferredCaptureMode: CaptureMode = value?.preferredCaptureMode === "systemPicker"
    ? "systemPicker"
    : "electron";

  return {
    preferredCaptureMode,
    includeSystemAudio: value?.includeSystemAudio !== false,
    includeMicrophone: value?.includeMicrophone === true,
    microphoneDeviceId: typeof value?.microphoneDeviceId === "string" ? value.microphoneDeviceId : "",
    videoBitrateKbps: normalizeBitrateKbps(value?.videoBitrateKbps),
    maxRecordingMinutes: normalizeMaxRecordingMinutes(value?.maxRecordingMinutes),
    savePath: typeof value?.savePath === "string" ? value.savePath : "",
  };
}
