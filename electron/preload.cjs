const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Capture sources ──────────────────────────────────────────────────────
  listCaptureSources: (types = ["screen", "window"]) => {
    const safe = Array.isArray(types)
      ? types.filter((t) => t === "screen" || t === "window")
      : ["screen", "window"];
    return ipcRenderer.invoke("desktop:getSources", {
      types: safe.length > 0 ? safe : ["screen", "window"],
    });
  },

  // ── Config ───────────────────────────────────────────────────────────────
  getAppConfig: () => ipcRenderer.invoke("config:get"),
  saveAppConfig: (config) => ipcRenderer.invoke("config:save", config),
  getAppConfigPath: () => ipcRenderer.invoke("config:path"),

  // ── Save path ────────────────────────────────────────────────────────────
  // Opens native folder picker → returns path string or null if cancelled
  selectSavePath: () => ipcRenderer.invoke("dialog:selectSavePath"),
  // Writes recording blob to disk at the configured path
  saveRecording: (buffer, filename, folderPath) =>
    ipcRenderer.invoke("file:saveRecording", { buffer, filename, folderPath }),
  // Opens the file location in OS
  openPath: (path) => ipcRenderer.invoke("file:openPath", path),

  // ── App info ─────────────────────────────────────────────────────────────
  // Synchronous-style wrapper — resolves immediately since main returns a value
  getAppVersion: () => ipcRenderer.invoke("app:version"),

  // ── Media permissions ────────────────────────────────────────────────────
  // Call when user enables microphone to ensure OS permission is granted
  requestMicrophonePermission: () =>
    ipcRenderer.invoke("permissions:request-microphone"),
  // Returns "granted" | "denied" | "not-determined" | "restricted"
  getMicrophoneStatus: () =>
    ipcRenderer.invoke("permissions:microphone-status"),

  // ── Hotkey events ────────────────────────────────────────────────────────
  onToggleRecording: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("shortcut:toggle-recording", handler);
    return () =>
      ipcRenderer.removeListener("shortcut:toggle-recording", handler);
  },
  onStopSharing: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("shortcut:stop-sharing", handler);
    return () => ipcRenderer.removeListener("shortcut:stop-sharing", handler);
  },

  // ── Auto-update events ───────────────────────────────────────────────────
  onUpdateAvailable: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on("updater:update-available", handler);
    return () =>
      ipcRenderer.removeListener("updater:update-available", handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on("updater:update-downloaded", handler);
    return () =>
      ipcRenderer.removeListener("updater:update-downloaded", handler);
  },
  installUpdate: () => ipcRenderer.invoke("updater:install-now"),
});
