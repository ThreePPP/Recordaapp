import type { RecorderConfig } from "@/types/config";
import type { CaptureSource, CaptureSourceType } from "@/types/recorder";

type UpdateInfo = {
  version: string;
  releaseDate?: string;
};

declare global {
  interface Window {
    electronAPI?: {
      // Capture
      listCaptureSources: (types?: CaptureSourceType[]) => Promise<CaptureSource[]>;

      // Config
      getAppConfig: () => Promise<RecorderConfig>;
      saveAppConfig: (config: RecorderConfig) => Promise<RecorderConfig>;
      getAppConfigPath?: () => Promise<string>;

      // App info
      getAppVersion: () => Promise<string>;

      // Hotkeys
      onToggleRecording?: (callback: () => void) => () => void;
      onStopSharing?: (callback: () => void) => () => void;

      // Auto-update
      onUpdateAvailable?: (callback: (info: UpdateInfo) => void) => () => void;
      onUpdateDownloaded?: (callback: (info: UpdateInfo) => void) => () => void;
      installUpdate?: () => Promise<void>;
    };
  }
}

export {};
