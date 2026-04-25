const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  shell,
  globalShortcut,
  session,
  systemPreferences,
  dialog,
} = require("electron");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;
const CONFIG_FILE_NAME = "app-config.json";
const ALLOWED_PERMISSION_TYPES = new Set([
  "media",
  "mediaKeySystem",
  "display-capture",
  "audioCapture",
  "videoCapture",
]);
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const DEFAULT_RECORDER_CONFIG = {
  preferredCaptureMode: "electron",
  includeSystemAudio: true,
  includeMicrophone: false,
  videoBitrateKbps: 8000,
  maxRecordingMinutes: 0,
  savePath: "",
};

// ── Command-line switches ──────────────────────────────────────────────────────
// These two flags are required for desktopCapturer + screen getUserMedia
app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
app.commandLine.appendSwitch("allow-http-screen-capture");
// NOTE: Do NOT add --no-sandbox or GPU switches here — they cause the
//   "Invalid file descriptor to ICU data received" error on Windows
//   because Chromium GPU subprocesses cannot inherit the ICU fd.

// Disable GPU process to prevent ICU file descriptor error on Windows.
// Screen recording uses the renderer's MediaRecorder API — GPU accel is
// not needed in the Electron main process for this use case.
app.disableHardwareAcceleration();

// ── Config helpers ─────────────────────────────────────────────────────────────

function normalizeBitrateKbps(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n)
    ? Math.min(50000, Math.max(1000, Math.round(n)))
    : DEFAULT_RECORDER_CONFIG.videoBitrateKbps;
}

function normalizeMaxRecordingMinutes(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n)
    ? Math.min(180, Math.max(0, Math.round(n)))
    : DEFAULT_RECORDER_CONFIG.maxRecordingMinutes;
}

function normalizeSavePath(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRecorderConfig(candidate) {
  return {
    preferredCaptureMode:
      candidate?.preferredCaptureMode === "systemPicker"
        ? "systemPicker"
        : "electron",
    includeSystemAudio: candidate?.includeSystemAudio !== false,
    includeMicrophone: candidate?.includeMicrophone === true,
    videoBitrateKbps: normalizeBitrateKbps(candidate?.videoBitrateKbps),
    maxRecordingMinutes: normalizeMaxRecordingMinutes(
      candidate?.maxRecordingMinutes
    ),
    savePath: normalizeSavePath(candidate?.savePath),
  };
}

function isDevAppUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    const isLocalHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    return isHttp && isLocalHost;
  } catch {
    return false;
  }
}

function isTrustedRenderer(webContents) {
  const pageUrl = webContents?.getURL?.() || "";
  if (!pageUrl) {
    return false;
  }

  if (isDev) {
    return isDevAppUrl(pageUrl);
  }

  return pageUrl.startsWith("file://");
}

function isAllowedNavigation(rawUrl) {
  if (isDev) {
    return isDevAppUrl(rawUrl);
  }
  return rawUrl.startsWith("file://");
}

function isSafeExternalUrl(rawUrl) {
  try {
    const protocol = new URL(rawUrl).protocol;
    return ALLOWED_EXTERNAL_PROTOCOLS.has(protocol);
  } catch {
    return false;
  }
}

function sanitizeFilename(filename) {
  if (typeof filename !== "string") {
    return "";
  }

  const cleaned = path
    .basename(filename)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") {
    return "";
  }

  return cleaned;
}

function isPathInside(parentPath, targetPath) {
  const parent = path.resolve(parentPath);
  const target = path.resolve(targetPath);
  return target === parent || target.startsWith(`${parent}${path.sep}`);
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
  return pathToFileURL(path.join(__dirname, "..", "out", "index.html")).toString();
}

// ── Permission handlers ────────────────────────────────────────────────────────
// Grant all media permissions automatically so the renderer can capture
// screen + audio + microphone without browser-style permission dialogs.

function setupPermissions(ses) {
  // Allow all permission requests from the app itself
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (!isTrustedRenderer(webContents)) {
      callback(false);
      return;
    }
    callback(ALLOWED_PERMISSION_TYPES.has(permission));
  });

  // Allow permission checks (navigator.permissions.query)
  ses.setPermissionCheckHandler((webContents, permission) => {
    if (!isTrustedRenderer(webContents)) {
      return false;
    }
    return ALLOWED_PERMISSION_TYPES.has(permission);
  });

  // Handle getDisplayMedia — return the chosen Electron source
  // This lets the renderer call navigator.mediaDevices.getDisplayMedia()
  ses.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ["screen", "window"], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          // Auto-approve: pass the first screen source; the renderer picks later
          callback({ video: sources[0], audio: "loopback" });
        })
        .catch(() => callback({}));
    },
    { useSystemPicker: false }
  );
}

// Ask Windows for microphone access (macOS-style API also works on Windows via
// systemPreferences — on Windows it triggers the OS permission prompt if needed)
async function requestMicrophonePermission() {
  if (process.platform !== "darwin") return true; // Windows grants via session handler
  try {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    if (status === "granted") return true;
    if (status === "not-determined") {
      return await systemPreferences.askForMediaAccess("microphone");
    }
    if (status === "denied") {
      await dialog.showMessageBox({
        type: "warning",
        title: "Microphone Access Required",
        message:
          "ScreenStudio needs microphone access.\n\nPlease open System Preferences → Security & Privacy → Microphone and enable ScreenStudio.",
        buttons: ["OK"],
      });
    }
    return false;
  } catch {
    return true;
  }
}

// ── Auto Updater ───────────────────────────────────────────────────────────────

function setupAutoUpdater(mainWindow) {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);

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
    console.warn("[updater] error:", err.message);
  });
}

// ── IPC: Updater ───────────────────────────────────────────────────────────────

ipcMain.handle("updater:install-now", () => {
  autoUpdater.quitAndInstall(false, true);
});

// ── IPC: Media permissions ─────────────────────────────────────────────────────

// Renderer calls this when user enables microphone toggle
ipcMain.handle("permissions:request-microphone", async () => {
  return await requestMicrophonePermission();
});

// Returns current microphone permission status
ipcMain.handle("permissions:microphone-status", () => {
  if (process.platform === "darwin") {
    return systemPreferences.getMediaAccessStatus("microphone");
  }
  // On Windows, the session handler auto-grants; report as granted
  return "granted";
});

// ── Window ─────────────────────────────────────────────────────────────────────

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: "#111417",
    // Title bar / frame
    title: "ScreenStudio",
    // Enable resizing on all sides
    resizable: true,
    maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Allow getUserMedia from the renderer
      webSecurity: true,
    },
  });

  // Prevent navigation to external URLs (open in browser instead)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url);
      }
      return;
    }

    if (isDev || !url.startsWith("file://")) {
      return;
    }

    const outDir = path.join(__dirname, "..", "out");
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const clean = pathname.replace(/\/+$/, "").replace(/\/index\.html$/, "") || "/";
      const target =
        clean === "" || clean === "/" || clean.endsWith("/index.html")
          ? path.join(outDir, "index.html")
          : path.join(outDir, clean.replace(/^\//, ""), "index.html");
      const targetUrl = pathToFileURL(target).toString();
      if (targetUrl !== url) {
        event.preventDefault();
        mainWindow.loadURL(targetUrl);
      }
    } catch {
      // Ignore malformed URLs from navigation events.
    }
  });

  mainWindow.loadURL(getStartUrl());


  // DevTools: only open in dev mode via Ctrl+Shift+I shortcut, NOT auto-opened
  // (removes the red-X issue from the screenshot)
  if (isDev) {
    // Register a shortcut to toggle DevTools instead of auto-opening
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: "detach" });
      }
    });
  }

  setupAutoUpdater(mainWindow);
  return mainWindow;
}

// ── IPC: Desktop capture ───────────────────────────────────────────────────────

ipcMain.handle("desktop:getSources", async (_event, payload) => {
  const rawTypes = Array.isArray(payload?.types)
    ? payload.types
    : ["screen", "window"];
  const types = [
    ...new Set(rawTypes.filter((t) => t === "screen" || t === "window")),
  ];

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
ipcMain.handle("config:save", (_event, payload) =>
  saveRecorderConfig(payload)
);
ipcMain.handle("config:path", () => getConfigFilePath());

// ── IPC: Save path picker ──────────────────────────────────────────────────────

// Opens a native folder-picker dialog and returns the selected path (or null).
ipcMain.handle("dialog:selectSavePath", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Recording Save Folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ── IPC: Write recording to disk ───────────────────────────────────────────────

// Receives a Uint8Array buffer + filename + folder path from the renderer,
// writes the file, and returns the full file path on success.
ipcMain.handle("file:saveRecording", async (_event, payload) => {
  const { buffer, filename, folderPath } = payload;
  const normalizedFolderPath =
    typeof folderPath === "string" && folderPath.trim().length > 0
      ? path.resolve(folderPath)
      : "";
  const safeFilename = sanitizeFilename(filename);

  if (!normalizedFolderPath || !safeFilename) {
    throw new Error("Missing or invalid folderPath/filename");
  }

  // Ensure the folder exists
  await fs.mkdir(normalizedFolderPath, { recursive: true });
  const filePath = path.resolve(normalizedFolderPath, safeFilename);
  if (!isPathInside(normalizedFolderPath, filePath)) {
    throw new Error("Invalid file path");
  }

  await fs.writeFile(filePath, Buffer.from(buffer));
  return filePath;
});

// ── IPC: Open path ─────────────────────────────────────────────────────────────

ipcMain.handle("file:openPath", (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── IPC: App info ──────────────────────────────────────────────────────────────

// Returns the version from package.json immediately (no async needed)
ipcMain.handle("app:version", () => app.getVersion());


// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Set up media permissions before creating the window
  setupPermissions(session.defaultSession);

  // Request microphone access at startup (Windows: handled by session handler;
  // macOS: triggers the system prompt)
  await requestMicrophonePermission();

  const mainWindow = createMainWindow();

  // Global hotkeys
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

  // Suppress unused-variable warning
  void mainWindow;
});

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
