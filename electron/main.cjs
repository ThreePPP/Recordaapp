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
  protocol,
  net,
} = require("electron");
const { autoUpdater } = require("electron-updater");

// ── App-level config ───────────────────────────────────────────────────────────

const isDev = !app.isPackaged;
const CONFIG_FILE = "app-config.json";

const ALLOWED_PERMISSIONS = new Set([
  "media", "mediaKeySystem", "display-capture", "audioCapture", "videoCapture",
]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

const DEFAULT_CONFIG = {
  preferredCaptureMode: "electron",
  includeSystemAudio: true,
  includeMicrophone: false,
  microphoneDeviceId: "",
  videoBitrateKbps: 8000,
  maxRecordingMinutes: 0,
  savePath: "",
};

// ── Command-line switches ──────────────────────────────────────────────────────
app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
app.commandLine.appendSwitch("allow-http-screen-capture");
// Disable GPU to prevent ICU file descriptor error on Windows.
// Screen recording uses the renderer's MediaRecorder API — GPU accel is not needed.
app.disableHardwareAcceleration();

// ── Register custom app:// protocol BEFORE app is ready ───────────────────────
// This scheme is used so that all static-export asset URLs are absolute
// (e.g. app://localhost/_next/...) and work regardless of route depth.
protocol.registerSchemesAsPrivileged([{
  scheme: "app",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

// ── Config helpers ─────────────────────────────────────────────────────────────

function clamp(value, min, max, fallback) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function normalizeConfig(c) {
  return {
    preferredCaptureMode: c?.preferredCaptureMode === "systemPicker" ? "systemPicker" : "electron",
    includeSystemAudio: c?.includeSystemAudio !== false,
    includeMicrophone: c?.includeMicrophone === true,
    microphoneDeviceId: typeof c?.microphoneDeviceId === "string" ? c.microphoneDeviceId.trim() : "",
    videoBitrateKbps: clamp(c?.videoBitrateKbps, 1000, 50000, DEFAULT_CONFIG.videoBitrateKbps),
    maxRecordingMinutes: clamp(c?.maxRecordingMinutes, 0, 180, DEFAULT_CONFIG.maxRecordingMinutes),
    savePath: typeof c?.savePath === "string" ? c.savePath.trim() : "",
  };
}

function sanitizeFilename(filename) {
  if (typeof filename !== "string") return "";
  const cleaned = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "";
}

function isPathInside(parent, target) {
  const p = path.resolve(parent);
  const t = path.resolve(target);
  return t === p || t.startsWith(`${p}${path.sep}`);
}

// ── URL / security helpers ─────────────────────────────────────────────────────

const isDevUrl = (url) => { try { const u = new URL(url); return (u.protocol === "http:" || u.protocol === "https:") && (u.hostname === "localhost" || u.hostname === "127.0.0.1"); } catch { return false; } };
const isAppUrl = (url) => { try { return new URL(url).protocol === "app:"; } catch { return false; } };
const isTrustedRenderer = (wc) => { const url = wc?.getURL?.() ?? ""; return url && (isDev ? isDevUrl(url) : isAppUrl(url)); };
const isAllowedNav = (url) => isDev ? isDevUrl(url) : isAppUrl(url);
const isSafeExternal = (url) => { try { return ALLOWED_PROTOCOLS.has(new URL(url).protocol); } catch { return false; } };

// ── Config persistence ─────────────────────────────────────────────────────────

const configFilePath = () => path.join(app.getPath("userData"), CONFIG_FILE);

async function loadConfig() {
  try {
    const raw = await fs.readFile(configFilePath(), "utf8");
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return saveConfig(DEFAULT_CONFIG);
  }
}

async function saveConfig(candidate) {
  const normalized = normalizeConfig(candidate);
  const fp = configFilePath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

// ── Permission setup ───────────────────────────────────────────────────────────

function setupPermissions(ses) {
  ses.setPermissionRequestHandler((wc, permission, callback) =>
    callback(isTrustedRenderer(wc) && ALLOWED_PERMISSIONS.has(permission))
  );
  ses.setPermissionCheckHandler((wc, permission) =>
    Boolean(isTrustedRenderer(wc) && ALLOWED_PERMISSIONS.has(permission))
  );
  ses.setDisplayMediaRequestHandler(
    (_req, callback) => {
      desktopCapturer
        .getSources({ types: ["screen", "window"], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => callback({ video: sources[0], audio: "loopback" }))
        .catch(() => callback({}));
    },
    { useSystemPicker: false },
  );
}

// ── Microphone permission (macOS only) ────────────────────────────────────────

async function requestMicrophonePermission() {
  if (process.platform !== "darwin") return true;
  try {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    if (status === "granted") return true;
    if (status === "not-determined") return systemPreferences.askForMediaAccess("microphone");
    if (status === "denied") {
      await dialog.showMessageBox({
        type: "warning",
        title: "Microphone Access Required",
        message: "ScreenStudio needs microphone access.\n\nPlease open System Preferences → Security & Privacy → Microphone and enable ScreenStudio.",
        buttons: ["OK"],
      });
    }
    return false;
  } catch {
    return true;
  }
}

// ── URL helper ─────────────────────────────────────────────────────────────────

function getStartUrl() {
  if (isDev) return process.env.ELECTRON_START_URL || "http://localhost:3000";
  // Use the custom app:// scheme — assets are served relative to this origin,
  // so sub-routes like /settings/ load their chunks correctly.
  return "app://localhost/index.html";
}

// ── Auto Updater ───────────────────────────────────────────────────────────────

function setupAutoUpdater(win) {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
  autoUpdater.on("update-available", (info) => win.webContents.send("updater:update-available", { version: info.version, releaseDate: info.releaseDate }));
  autoUpdater.on("update-downloaded", (info) => win.webContents.send("updater:update-downloaded", { version: info.version }));
  autoUpdater.on("error", (err) => console.warn("[updater] error:", err.message));
}

// ── Window ─────────────────────────────────────────────────────────────────────

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 880, minHeight: 600,
    backgroundColor: "#111417",
    title: "ScreenStudio",
    resizable: true, maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    // In dev, allow localhost navigation freely.
    if (isDev) return;

    // In production, only app:// URLs are allowed for internal navigation.
    if (isAppUrl(url)) return;

    // Block everything else — if it looks like an external link, open in browser.
    event.preventDefault();
    if (isSafeExternal(url)) void shell.openExternal(url);
  });

  win.loadURL(getStartUrl());

  if (isDev) {
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      win.webContents.isDevToolsOpened()
        ? win.webContents.closeDevTools()
        : win.webContents.openDevTools({ mode: "detach" });
    });
  }

  setupAutoUpdater(win);
  return win;
}

// ── IPC handlers ───────────────────────────────────────────────────────────────

// Updater
ipcMain.handle("updater:install-now", () => autoUpdater.quitAndInstall(false, true));

// Permissions
ipcMain.handle("permissions:request-microphone", () => requestMicrophonePermission());
ipcMain.handle("permissions:microphone-status", () =>
  process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("microphone") : "granted"
);

// Desktop capture
ipcMain.handle("desktop:getSources", async (_e, payload) => {
  const rawTypes = Array.isArray(payload?.types) ? payload.types : ["screen", "window"];
  const types = [...new Set(rawTypes.filter((t) => t === "screen" || t === "window"))];
  const sources = await desktopCapturer.getSources({
    types: types.length > 0 ? types : ["screen", "window"],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false,
  });
  return sources.map((s) => ({ id: s.id, name: s.name, type: s.id.startsWith("screen:") ? "screen" : "window" }));
});

// Config
ipcMain.handle("config:get", () => loadConfig());
ipcMain.handle("config:save", (_e, payload) => saveConfig(payload));
ipcMain.handle("config:path", () => configFilePath());

// Save path dialog
ipcMain.handle("dialog:selectSavePath", async () => {
  const result = await dialog.showOpenDialog({ title: "Select Recording Save Folder", properties: ["openDirectory", "createDirectory"] });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

// Write recording to disk
ipcMain.handle("file:saveRecording", async (_e, { buffer, filename, folderPath }) => {
  const dir = typeof folderPath === "string" && folderPath.trim() ? path.resolve(folderPath) : "";
  const safe = sanitizeFilename(filename);
  if (!dir || !safe) throw new Error("Missing or invalid folderPath/filename");

  await fs.mkdir(dir, { recursive: true });
  const filePath = path.resolve(dir, safe);
  if (!isPathInside(dir, filePath)) throw new Error("Invalid file path");

  await fs.writeFile(filePath, Buffer.from(buffer));
  return filePath;
});

// Open in file manager
ipcMain.handle("file:openPath", (_e, filePath) => shell.showItemInFolder(filePath));

// App info
ipcMain.handle("app:version", () => app.getVersion());

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // ── Register app:// protocol to serve static Next.js export ─────────────────
  // All requests to app://localhost/* are mapped to the out/ directory.
  // This makes asset URLs absolute so sub-routes (e.g. /settings/) load
  // their JS chunks correctly — impossible with assetPrefix: "./" (relative).
  if (!isDev) {
    const outDir = path.join(__dirname, "..", "out");
    protocol.handle("app", (req) => {
      // Strip the origin: app://localhost/some/path?query → some/path
      let urlPath = req.url.slice("app://localhost/".length);
      urlPath = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
      if (!urlPath || urlPath === "") urlPath = "index.html";
      const filePath = path.join(outDir, urlPath);
      return net.fetch(pathToFileURL(filePath).toString());
    });
  }

  setupPermissions(session.defaultSession);
  await requestMicrophonePermission();

  const mainWindow = createMainWindow();

  const broadcast = (channel) => () =>
    BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel));

  globalShortcut.register("CommandOrControl+Shift+R", broadcast("shortcut:toggle-recording"));
  globalShortcut.register("CommandOrControl+Shift+S", broadcast("shortcut:stop-sharing"));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  void mainWindow; // suppress unused-variable lint warning
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
