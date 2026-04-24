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

  // ── App info ─────────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke("app:version"),

  // ── Hotkey events ────────────────────────────────────────────────────────
  onToggleRecording: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("shortcut:toggle-recording", handler);
    return () => ipcRenderer.removeListener("shortcut:toggle-recording", handler);
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
    return () => ipcRenderer.removeListener("updater:update-available", handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on("updater:update-downloaded", handler);
    return () => ipcRenderer.removeListener("updater:update-downloaded", handler);
  },
  installUpdate: () => ipcRenderer.invoke("updater:install-now"),
});
