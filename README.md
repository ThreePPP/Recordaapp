# ScreenStudio 🎥

**ScreenStudio** is a high-performance desktop screen recorder built with **Electron** and **Next.js**.  
It captures your screen or any application window with optional system audio and microphone, then saves the recording as a seekable video file.

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Full-screen / Window capture** | Pick any screen or open window from the Electron source list |
| **Custom crop region** | Drag on the preview to select a specific area to record |
| **Audio mixing** | Record system audio, microphone, or both simultaneously |
| **Seekable output** | Recordings have correct duration metadata — the seek bar works! |
| **Configurable bitrate** | Choose from preset quality levels (1 Mbps → 50 Mbps) |
| **Auto-stop timer** | Set a maximum recording duration (up to 3 hours) |
| **Global hotkeys** | `Ctrl+Shift+R` to toggle recording · `Ctrl+Shift+S` to stop |
| **Auto-update** | App checks GitHub Releases on startup and notifies you when a new version is available |

---

## 📥 Download (End Users)

Go to the [**Releases**](https://github.com/ThreePPP/Recordaapp/releases) tab and download the latest:

- **`ScreenStudio-Setup-x.x.x.exe`** — NSIS Installer (recommended)
- **`ScreenStudio-x.x.x.exe`** — Portable version (no installation needed)

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

---

## 📦 Building a Release

### Local Build (Portable .exe — no Developer Mode needed)

```bash
npm run build:portable
# Output: dist/ScreenStudio-1.0.0.exe
```

### Local Build (NSIS Installer — requires Windows Developer Mode)

Enable Developer Mode first:  
`Settings → System → For Developers → Developer Mode: ON`

```bash
npm run build:exe
# Output: dist/ScreenStudio-Setup-1.0.0.exe
```

### Publish to GitHub Releases (Recommended)

Push a version tag — GitHub Actions will build and upload everything automatically:

```bash
# 1. Bump version in package.json first, then:
git add .
git commit -m "chore: release v1.x.x"
git tag v1.x.x
git push origin main --tags
```

The [Release workflow](.github/workflows/release.yml) will:
1. Build the Next.js static export
2. Package both NSIS installer and portable `.exe`
3. Upload them to a new GitHub Release

---

## 🔄 Auto-Update System

- The app uses [`electron-updater`](https://www.npmjs.com/package/electron-updater) to check for updates on startup
- Updates are downloaded silently in the background
- A banner appears in the header when an update is ready
- Click **"Restart & Install"** to apply the update immediately

Update flow:
```
App starts → checks GitHub Releases → 
  "Downloading..." banner → download complete →
  "Restart & Install" button → quitAndInstall()
```

---

## 🗂️ Project Structure

```
recordapp/
├── electron/
│   ├── main.cjs          # Electron main process + auto-updater
│   └── preload.cjs       # Context bridge (IPC API exposed to renderer)
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/
│   │   ├── layout/       # AppShell (header, version badge, update banner)
│   │   └── recorder/     # RecorderWorkspace, ControlPanel, PreviewPane
│   ├── hooks/
│   │   ├── useDesktopRecorder.ts   # Core recording logic
│   │   └── useAppConfig.ts         # Persistent config (IPC ↔ Electron)
│   ├── lib/recorder/
│   │   ├── crop.ts           # Crop rect math utilities
│   │   └── fixDuration.ts    # WebM seek fix (fix-webm-duration)
│   └── types/
│       ├── config.ts         # RecorderConfig type + presets
│       ├── recorder.ts       # CaptureSource, CropRect, DragState types
│       └── electron.d.ts     # Window.electronAPI type declarations
├── electron-builder.yml      # Packaging config (NSIS + portable)
├── .github/workflows/
│   └── release.yml           # CI/CD: auto-build on version tag
└── package.json
```

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Shift + R` | Toggle recording (start / stop) |
| `Ctrl + Shift + S` | Stop sharing / end preview |

---

## 🚀 Releasing a New Version

1. Update `version` in `package.json` (e.g., `"1.0.0"` → `"1.1.0"`)
2. Commit and tag:
   ```bash
   git add package.json
   git commit -m "chore: bump version to 1.1.0"
   git tag v1.1.0
   git push origin main --tags
   ```
3. GitHub Actions builds the `.exe` and creates a Release automatically
4. Users running v1.0.0 will see the update notification on next launch

---

## 📋 Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | Next.js 16 (App Router) + React 19 |
| Desktop Runtime | Electron 36 |
| Styling | Tailwind CSS v4 |
| Capture API | Chromium `desktopCapturer` + `MediaRecorder` |
| Audio Mixing | Web Audio API (`AudioContext`) |
| Seek Fix | [`fix-webm-duration`](https://github.com/nicktindall/fix-webm-duration) |
| Auto-Update | [`electron-updater`](https://www.electron.build/auto-update) |
| Packaging | [`electron-builder`](https://www.electron.build/) |

---

## 📄 License

MIT © 2026 [ThreePPP](https://github.com/ThreePPP)
