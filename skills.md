# Project Skills & Competency Map 🗺️

This document outlines the technical skills and knowledge required to maintain and evolve the **ScreenStudio** project.

## 🏗️ Core Architecture
- **Electron.js (v36+)**: Deep understanding of Main vs. Renderer processes, IPC bridge security, and native window management.
- **Next.js (v16+ / App Router)**: Leveraging React Server Components (where applicable) and the modern file-based routing system.
- **TypeScript**: Strict type safety across the IPC boundary and complex media stream handling.

## 🎨 UI & UX Design
- **Tailwind CSS v4**: Utility-first styling with the latest features of the v4 engine.
- **Responsive Desktop Design**: Creating layouts that adapt to various window sizes and high-DPI displays.
- **I18n (Internationalization)**: Managing multi-language support (TH/EN) with persistent state.

## 🎥 Media & Audio Engineering
- **Web Media APIs**:
  - `MediaRecorder`: Handling live encoding and blob management.
  - `desktopCapturer`: Selecting and acquiring screen/window sources.
  - `MediaStream`: Real-time stream manipulation and track management.
- **Web Audio API**: 
  - `AudioContext`: Mixing multiple input sources (System + Mic).
  - `createMediaStreamDestination`: Routing mixed audio back into the recording stream.
- **Canvas API**: 
  - High-performance frame-by-frame rendering for custom crop regions.
  - Frame rate (FPS) synchronization.

## 🛠️ Tooling & DevOps
- **Electron Builder**: Configuring portable builds, signing (or skipping), and resource management.
- **Auto-Update System**: Integrating `electron-updater` with GitHub Releases.
- **GitHub Actions**: Automated CI/CD pipelines for building `.exe` artifacts on tag push.

## 🤖 AI-Assisted Development
- **Prompt Engineering**: Using AI agents (like Antigravity) to refactor complex hooks and debug IPC race conditions.
- **Context Management**: Maintaining a clean project structure that AI can easily navigate and understand.

---

## 📈 Future Skill Expansion (Roadmap)
- **Native Performance**: Learning **Rust (NAPI-RS)** to replace heavy JS-based canvas cropping with native buffers.
- **FFmpeg Integration**: Moving from browser-based encoding to binary-based encoding for better compression.
- **System Hooks**: Low-level Windows API interaction for "Always on Top" recording indicators or window-border highlighting.

---

## 🦾 Agent Integration Skills (from skills.sh)
These are specialized capabilities for AI agents to assist in developing this project:
- **remotion-best-practices**: For mastering video-as-code patterns and timeline management.
- **canvas-design**: Optimizing real-time frame cropping and rendering performance using Canvas API.
- **ui-ux-pro-max**: Implementing premium, high-end desktop aesthetics and micro-interactions.
- **systematic-debugging**: Solving complex hardware-level and IPC race conditions in Electron.
- **mcp-builder**: Future-proofing for AI agent integration and cross-platform automation.

