import type { RecorderConfig } from "@/types/config";
import type { CaptureSource, CaptureSourceType } from "@/types/recorder";

type UpdateInfo = { version: string; releaseDate?: string };
type PermissionStatus = "granted" | "denied" | "not-determined" | "restricted";

declare global {
  interface Window {
    electronAPI?: {
      // Capture
      listCaptureSources: (types?: CaptureSourceType[]) => Promise<CaptureSource[]>;

      // Config
      getAppConfig: () => Promise<RecorderConfig>;
      saveAppConfig: (config: RecorderConfig) => Promise<RecorderConfig>;
      getAppConfigPath?: () => Promise<string>;

      // Save path
      selectSavePath?: () => Promise<string | null>;
      saveRecording?: (buffer: ArrayBuffer, filename: string, folderPath: string) => Promise<string>;
      openPath?: (path: string) => Promise<void>;

      // App info
      getAppVersion: () => Promise<string>;

      // Media permissions
      requestMicrophonePermission?: () => Promise<boolean>;
      getMicrophoneStatus?: () => Promise<PermissionStatus>;

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
