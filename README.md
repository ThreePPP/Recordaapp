# ScreenStudio 🎥

**ScreenStudio** is a high-performance desktop screen recorder built with **Electron** and **Next.js**.  
It captures your screen or any application window with optional system audio and microphone, then saves the recording as a seekable video file.

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Full-screen / Window capture** | Pick any screen or open window from the Electron source list |
| **Custom crop region** | Drag on the preview to select a specific area to record |
| **Audio mixing** | Toggle System Audio and Microphone independently from the main panel |
| **Seekable output** | Recordings have correct duration metadata — the seek bar works! |
| **Configurable bitrate** | Choose from preset quality levels (1 Mbps → 50 Mbps) |
| **Auto-stop timer** | Set a maximum recording duration (up to 3 hours) |
| **Global hotkeys** | `Ctrl+Shift+R` to toggle recording · `Ctrl+Shift+S` to stop sharing |
| **Bilingual UI** | Switch between **English** and **ภาษาไทย** in Settings |
| **Auto-update** | App checks GitHub Releases on startup and notifies when a new version is ready |
| **Mic permission** | Automatically requests microphone access from the OS when enabled |

---

## 📥 Download (End Users)

Go to the [**Releases**](https://github.com/ThreePPP/Recordaapp/releases) tab and download the latest:

- **`ScreenStudio x.x.x.exe`** — Portable version (no installation needed, just run)

> **Windows SmartScreen warning**: The app is currently unsigned. Click **"More info" → "Run anyway"** to proceed.

---

## 🛠️ Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Git](https://git-scm.com/)

### Clone & Install

```bash
git clone https://github.com/ThreePPP/Recordaapp.git
cd Recordaapp
npm install
```

### Run in Development Mode

```bash
npm run dev
```

This starts the Next.js dev server + Electron simultaneously.  
Press **`Ctrl+Shift+I`** inside the app window to open DevTools when needed.

---

## 📦 Building a Release

### Local Build — Portable .exe (No Developer Mode needed)

```bash
npm run build:portable
# Output: dist/ScreenStudio 1.x.x.exe
```

> This is the recommended build method on standard Windows accounts.  
> `signAndEditExecutable: false` is set in `electron-builder.yml` to skip symlink creation.

### Publish to GitHub Releases (Automated)

Bump the version, commit, tag, and push — GitHub Actions handles the rest:

```bash
# 1. Edit version in package.json, then:
git add .
git commit -m "chore: bump version to 1.x.x"
git tag v1.x.x
git push origin master
git push origin v1.x.x
```

The [Release workflow](.github/workflows/release.yml) will:
1. Build the Next.js static export (`output: 'export'`)
2. Package portable `.exe` via `electron-builder`
3. Upload it to a new GitHub Release automatically

---

## 🔄 Auto-Update System

- The app uses [`electron-updater`](https://www.npmjs.com/package/electron-updater) to check GitHub Releases on startup (4 second delay)
- Updates are downloaded silently in the background
- A banner appears in the app header when an update is available or ready
- Click **"Restart & Install"** to apply immediately

```
App starts → checks GitHub Releases (after 4s)
  → "Downloading v1.x.x…" banner
  → download complete
  → "Restart & Install" button → quitAndInstall()
```

> Auto-update only works in the **packaged `.exe`**, not in `npm run dev`.  
> A valid `latest.yml` must be present in the GitHub Release for electron-updater to work.

---

## 🗂️ Project Structure

```
recordapp/
├── electron/
│   ├── main.cjs          # Main process: window, IPC, permissions, auto-updater
│   └── preload.cjs       # Context bridge — IPC API exposed to renderer
├── src/
│   ├── app/              # Next.js App Router pages (/ and /settings)
│   ├── components/
│   │   ├── layout/       # AppShell — header, version badge, update banner
│   │   ├── recorder/     # RecorderWorkspace, ControlPanel, PreviewPane
│   │   └── settings/     # SettingsPanel — language picker, audio defaults
│   ├── hooks/
│   │   ├── useDesktopRecorder.ts   # Core recording logic (capture, crop, save)
│   │   ├── useAppConfig.ts         # Persistent config (IPC ↔ Electron)
│   │   └── useLang.tsx             # Bilingual context (TH/EN, persisted to localStorage)
│   ├── lib/
│   │   ├── i18n.ts               # Translation strings (English + Thai)
│   │   └── recorder/
│   │       ├── crop.ts           # Crop rect math utilities
│   │       └── fixDuration.ts    # WebM seek fix (fix-webm-duration)
│   └── types/
│       ├── config.ts         # RecorderConfig type + presets
│       ├── recorder.ts       # CaptureSource, CropRect, DragState types
│       └── electron.d.ts     # Window.electronAPI type declarations
├── electron-builder.yml      # Packaging config (portable, signAndEditExecutable: false)
├── .github/workflows/
│   └── release.yml           # CI/CD: auto-build on version tag push
└── package.json
```

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Shift + R` | Toggle recording (start / stop) |
| `Ctrl + Shift + S` | Stop sharing / end preview |
| `Ctrl + Shift + I` | Toggle DevTools (development mode only) |

---

## 🚀 Releasing a New Version

1. Update `version` in `package.json` (e.g. `"1.0.2"` → `"1.1.0"`)
2. Commit, tag, and push:
   ```bash
   git add package.json
   git commit -m "chore: bump version to 1.1.0"
   git tag v1.1.0
   git push origin master
   git push origin v1.1.0
   ```
3. GitHub Actions builds the portable `.exe` and creates a Release automatically
4. Users running older versions will see the update notification on next launch

---

## 🐛 Known Issues & Notes

| Issue | Status | Notes |
|---|---|---|
| `ICU data received` log on startup | ✅ Fixed in v1.0.2 | Removed GPU command-line switches + `disableHardwareAcceleration()` |
| Windows SmartScreen warning | ⚠️ By design | App is unsigned — click "More info → Run anyway" |
| Build fails with symlink error | ✅ Fixed in v1.0.2 | `signAndEditExecutable: false` in `electron-builder.yml` |
| DevTools auto-opens | ✅ Fixed in v1.0.1 | Now only opens with `Ctrl+Shift+I` |

---

## 📋 Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | Next.js 16 (App Router) + React 19 |
| Desktop Runtime | Electron 36 |
| Styling | Vanilla CSS + Tailwind CSS v4 |
| Internationalization | Custom `useLang` context (EN / TH) |
| Capture API | Chromium `desktopCapturer` + `MediaRecorder` |
| Audio Mixing | Web Audio API (`AudioContext`) |
| Seek Fix | [`fix-webm-duration`](https://github.com/nicktindall/fix-webm-duration) |
| Auto-Update | [`electron-updater`](https://www.electron.build/auto-update) |
| Packaging | [`electron-builder`](https://www.electron.build/) |

---

## 📄 License

MIT © 2026 [ThreePPP](https://github.com/ThreePPP)
