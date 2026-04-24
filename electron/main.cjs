const path = require("node:path");
const fs = require("node:fs/promises");
const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  shell,
  globalShortcut,
  dialog,
} = require("electron");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;
const CONFIG_FILE_NAME = "app-config.json";
const DEFAULT_RECORDER_CONFIG = {
  preferredCaptureMode: "electron",
  includeSystemAudio: true,
  includeMicrophone: false,
  videoBitrateKbps: 8000,
  maxRecordingMinutes: 0,
};

// ── Command-line switches ──────────────────────────────────────────────────────
app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
app.commandLine.appendSwitch("allow-http-screen-capture");

// ── Config helpers ─────────────────────────────────────────────────────────────

function normalizeBitrateKbps(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(50000, Math.max(1000, Math.round(n))) : DEFAULT_RECORDER_CONFIG.videoBitrateKbps;
}

function normalizeMaxRecordingMinutes(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(180, Math.max(0, Math.round(n))) : DEFAULT_RECORDER_CONFIG.maxRecordingMinutes;
}

function normalizeRecorderConfig(candidate) {
  return {
    preferredCaptureMode: candidate?.preferredCaptureMode === "systemPicker" ? "systemPicker" : "electron",
    includeSystemAudio: candidate?.includeSystemAudio !== false,
    includeMicrophone: candidate?.includeMicrophone === true,
    videoBitrateKbps: normalizeBitrateKbps(candidate?.videoBitrateKbps),
    maxRecordingMinutes: normalizeMaxRecordingMinutes(candidate?.maxRecordingMinutes),
  };
}

function getConfigFilePath() {
  return path.join(app.getPath("userData"), CONFIG_FILE_NAME);
}

async function saveRecorderConfig(candidate) {
  const configPath = getConfigFilePath();
  const normalized = normalizeRecorderConfig(candidate);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

async function loadRecorderConfig() {
  const configPath = getConfigFilePath();
  try {
    const content = await fs.readFile(configPath, "utf8");
    return normalizeRecorderConfig(JSON.parse(content));
  } catch {
    return saveRecorderConfig(DEFAULT_RECORDER_CONFIG);
  }
}

// ── URL helper ─────────────────────────────────────────────────────────────────

function getStartUrl() {
  if (isDev) {
    return process.env.ELECTRON_START_URL || "http://localhost:3000";
  }
  // In packaged app, Next.js is statically exported to ./out/
  return `file://${path.join(__dirname, "..", "out", "index.html")}`;
}

// ── Auto Updater ───────────────────────────────────────────────────────────────

function setupAutoUpdater(mainWindow) {
  if (isDev) return; // Don't check for updates in development

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Silently check for updates after 3 seconds
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);

  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("updater:update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow.webContents.send("updater:update-downloaded", {
      version: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    // Silently ignore updater errors (no internet, GitHub down, etc.)
    console.warn("[updater] error:", err.message);
  });
}

// ── IPC: Updater ───────────────────────────────────────────────────────────────

ipcMain.handle("updater:install-now", () => {
  autoUpdater.quitAndInstall(false, true);
});

// ── Window ─────────────────────────────────────────────────────────────────────

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#111417",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(getStartUrl());

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  setupAutoUpdater(mainWindow);
  return mainWindow;
}

// ── IPC: Desktop capture ───────────────────────────────────────────────────────

ipcMain.handle("desktop:getSources", async (_event, payload) => {
  const rawTypes = Array.isArray(payload?.types) ? payload.types : ["screen", "window"];
  const types = [...new Set(rawTypes.filter((t) => t === "screen" || t === "window"))];

  const sources = await desktopCapturer.getSources({
    types: types.length > 0 ? types : ["screen", "window"],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false,
  });

  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.id.startsWith("screen:") ? "screen" : "window",
  }));
});

// ── IPC: Config ────────────────────────────────────────────────────────────────

ipcMain.handle("config:get", () => loadRecorderConfig());
ipcMain.handle("config:save", (_event, payload) => saveRecorderConfig(payload));
ipcMain.handle("config:path", () => getConfigFilePath());

// ── IPC: App info ──────────────────────────────────────────────────────────────

ipcMain.handle("app:version", () => app.getVersion());

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow();

  globalShortcut.register("CommandOrControl+Shift+R", () => {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("shortcut:toggle-recording")
    );
  });

  globalShortcut.register("CommandOrControl+Shift+S", () => {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("shortcut:stop-sharing")
    );
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
