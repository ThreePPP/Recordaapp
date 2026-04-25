"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { clampRect, hasValidCrop, MIN_CROP_SIZE, normalizeRect } from "@/lib/recorder/crop";
import { fixBlobDuration } from "@/lib/recorder/fixDuration";
import type { RecorderConfig } from "@/types/config";
import type { CaptureSource, CaptureSourceType, CropRect, DragState } from "@/types/recorder";

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTPUT_FPS = 30;
const AUDIO_BITRATE_BPS = 128_000;
const TIMESLICE_MS = 1_000;

const FORMAT_CANDIDATES = [
  { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
  { mimeType: "video/mp4", ext: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", ext: "webm" },
  { mimeType: "video/webm;codecs=vp8,opus", ext: "webm" },
  { mimeType: "video/webm", ext: "webm" },
] satisfies { mimeType: string; ext: string }[];

type RecordFormat = { mimeType: string; ext: string };

function pickFormat(): RecordFormat {
  return FORMAT_CANDIDATES.find((f) => MediaRecorder.isTypeSupported(f.mimeType))
    ?? { mimeType: "", ext: "webm" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CropSelectionEvent = ReactPointerEvent<HTMLDivElement>;

type Options = { config: RecorderConfig; configReady: boolean };

export type DesktopRecorderController = {
  sources: CaptureSource[];
  selectedSourceId: string;
  setSelectedSourceId: (id: string) => void;
  isElectronBridgeReady: boolean;
  statusText: string;
  isSharing: boolean;
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  latestRecordingPath: string | null;
  hasCrop: boolean;
  displayedCrop: CropRect | null;
  previewWidth: number;
  previewHeight: number;
  overlayRef: RefObject<HTMLDivElement | null>;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  refreshElectronSources: () => Promise<void>;
  startSharing: () => Promise<boolean>;
  stopSharing: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearCrop: () => void;
  beginCropSelection: (e: CropSelectionEvent) => void;
  moveCropSelection: (e: CropSelectionEvent) => void;
  endCropSelection: () => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDesktopRecorder({ config, configReady }: Options): DesktopRecorderController {
  // ── State ──────────────────────────────────────────────────────────────────
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceIdRaw] = useState("");
  const [isElectronBridgeReady, setIsElectronBridgeReady] = useState(false);
  const [statusText, setStatus] = useState("Ready to capture your screen");
  const [isSharing, setIsSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [latestRecordingPath, setLatestRecordingPath] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewWidth, setPreviewWidth] = useState(1280);
  const [previewHeight, setPreviewHeight] = useState(720);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);   // from Electron desktop capture
  const sourceStreamRef = useRef<MediaStream | null>(null); // video + mixed audio
  const micStreamRef = useRef<MediaStream | null>(null);
  const cropStreamRef = useRef<MediaStream | null>(null);   // canvas-based cropped stream
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const isSharingStartingRef = useRef(false);
  const autoPreviewedRef = useRef("");
  const isRecordingRef = useRef(false); // sync ref for IPC callbacks
  const isPausedRef = useRef(false);
  const savePathRef = useRef(config.savePath);

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId) ?? null,
    [sources, selectedSourceId],
  );

  const displayedCrop = useMemo(
    () => (dragState ? normalizeRect(dragState) : cropRect),
    [dragState, cropRect],
  );

  const hasCrop = useMemo(() => hasValidCrop(cropRect), [cropRect]);

  // ── Helpers: cleanup ───────────────────────────────────────────────────────

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  }, []);

  const stopCropStream = useCallback(() => {
    if (cropStreamRef.current) {
      cropStreamRef.current.getTracks().forEach((t) => t.stop());
      cropStreamRef.current = null;
    }
  }, []);

  const stopAudioResources = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  // ── Shared: stop sharing ───────────────────────────────────────────────────

  const stopSharing = useCallback(() => {
    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current?.stop();
    }

    stopRaf();
    stopCropStream();
    stopAudioResources();

    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;

    sourceStreamRef.current?.getTracks().forEach((t) => t.stop());
    sourceStreamRef.current = null;

    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;

    setIsSharing(false);
    setIsRecording(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setRecordingDuration(0);
    stopTimers();
    setStatus("Capture stopped");
  }, [stopAudioResources, stopCropStream, stopRaf, stopTimers]);

  // ── Electron: list sources ─────────────────────────────────────────────────

  const refreshElectronSources = useCallback(async () => {
    if (!window.electronAPI?.listCaptureSources) {
      setSources([]);
      setStatus("Electron bridge not found.");
      return;
    }
    try {
      const types: CaptureSourceType[] = ["screen", "window"];
      const list = await window.electronAPI.listCaptureSources(types);
      setSources(list);
      if (list.length > 0) {
        setSelectedSourceIdRaw((cur) => cur || list[0].id);
      }
      setStatus(`Found ${list.length} capture sources`);
    } catch {
      setSources([]);
      setStatus("Failed to load capture sources from Electron");
    }
  }, []);

  // ── Media: acquire desktop stream ─────────────────────────────────────────

  const acquireDesktopStream = useCallback(async () => {
    if (!selectedSourceId) throw new Error("No source selected");

    const videoConstraints = {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: selectedSourceId,
        minWidth: 1280, minHeight: 720,
        maxWidth: 7680, maxHeight: 4320,
      },
    } as MediaTrackConstraints;

    const audioConstraints = {
      mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: selectedSourceId },
    } as MediaTrackConstraints;

    const getStream = (audio: boolean) =>
      navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audio ? audioConstraints : false });

    if (!config.includeSystemAudio) return getStream(false);

    try { return await getStream(true); }
    catch { setStatus("System audio unavailable, continuing without it"); return getStream(false); }
  }, [config.includeSystemAudio, selectedSourceId]);

  // ── Media: mix audio tracks ────────────────────────────────────────────────

  const mixAudio = useCallback((tracks: MediaStreamTrack[]): MediaStreamTrack | null => {
    if (tracks.length === 0) return null;
    if (tracks.length === 1) return tracks[0];

    try {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      tracks.forEach((t) => ctx.createMediaStreamSource(new MediaStream([t])).connect(dest));
      if (ctx.state === "suspended") void ctx.resume();
      audioCtxRef.current = ctx;
      return dest.stream.getAudioTracks()[0] ?? tracks[0];
    } catch {
      return tracks[0];
    }
  }, []);

  // ── Capture: start preview ─────────────────────────────────────────────────

  const startSharing = useCallback(async (): Promise<boolean> => {
    if (isSharingStartingRef.current) return false;
    isSharingStartingRef.current = true;

    try {
      stopSharing();
      setCropRect(null);
      setDragState(null);

      const raw = await acquireDesktopStream();
      rawStreamRef.current = raw;

      let micStream: MediaStream | null = null;
      if (config.includeMicrophone) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          micStreamRef.current = micStream;
        } catch {
          setStatus("Microphone unavailable, continuing without it");
        }
      }

      const videoTrack = raw.getVideoTracks()[0];
      if (!videoTrack) throw new Error("No video track");

      const allAudio = [...raw.getAudioTracks(), ...(micStream?.getAudioTracks() ?? [])];
      const mixed = mixAudio(allAudio);

      const merged = new MediaStream([videoTrack, ...(mixed ? [mixed] : [])]);
      sourceStreamRef.current = merged;

      videoTrack.addEventListener("ended", stopSharing);

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = merged;
        await previewVideoRef.current.play();
        const w = previewVideoRef.current.videoWidth;
        const h = previewVideoRef.current.videoHeight;
        if (w > 0 && h > 0) { setPreviewWidth(w); setPreviewHeight(h); }
      }

      setIsSharing(true);
      const audioLabel = merged.getAudioTracks().length > 0 ? "audio on" : "audio muted";
      setStatus(`Previewing: ${selectedSource?.name ?? "source"} (${audioLabel})`);
      return true;
    } catch {
      setIsSharing(false);
      setStatus("Failed to start capture. Check screen-share permissions.");
      return false;
    } finally {
      isSharingStartingRef.current = false;
    }
  }, [acquireDesktopStream, config.includeMicrophone, config.microphoneDeviceId, mixAudio, selectedSource?.name, stopSharing]);

  // ── Capture: build output stream (with optional crop canvas) ──────────────

  const buildOutputStream = useCallback((): MediaStream => {
    const source = sourceStreamRef.current;
    const video = previewVideoRef.current;
    if (!source || !video) throw new Error("Missing stream or video element");

    // No crop → record raw stream directly
    if (!hasValidCrop(cropRect)) return source;

    // Crop → draw region into a canvas and stream that
    const safe = clampRect(cropRect, previewWidth, previewHeight);
    const scaleX = (video.videoWidth || previewWidth) / previewWidth;
    const scaleY = (video.videoHeight || previewHeight) / previewHeight;

    const sx = Math.round(safe.x * scaleX);
    const sy = Math.round(safe.y * scaleY);
    const sw = Math.max(MIN_CROP_SIZE, Math.round(safe.width * scaleX));
    const sh = Math.max(MIN_CROP_SIZE, Math.round(safe.height * scaleY));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const interval = 1000 / OUTPUT_FPS;
    let last = 0;

    const draw = (t: number) => {
      if (t - last >= interval) {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        last = t;
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    const canvasStream = canvas.captureStream(OUTPUT_FPS);
    source.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    cropStreamRef.current = canvasStream;
    return canvasStream;
  }, [cropRect, previewHeight, previewWidth]);

  // ── Recording: save file ───────────────────────────────────────────────────

  const saveRecording = useCallback(async (
    chunks: Blob[],
    format: RecordFormat,
    durationMs: number,
    preferredSavePath?: string,
  ) => {
    const raw = new Blob(chunks, {
      type: format.mimeType || (format.ext === "mp4" ? "video/mp4" : "video/webm"),
    });

    const filename = `record-${new Date().toISOString().replace(/[:.]/g, "-")}.${format.ext}`;
    const folderPath = preferredSavePath ?? savePathRef.current;

    const doSave = async (blob: Blob) => {
      // ── Electron: write to disk via IPC ──────────────────────────────────
      if (window.electronAPI?.saveRecording && folderPath) {
        try {
          const buffer = await blob.arrayBuffer();
          const saved = await window.electronAPI.saveRecording(buffer, filename, folderPath);
          setStatus(`${filename} saved`);
          setLatestRecordingPath(saved);
          console.info("[recorder] saved →", saved);
          return;
        } catch (err) {
          console.error("[recorder] IPC save failed, falling back to download", err);
        }
      }
      // ── Browser fallback: trigger download ───────────────────────────────
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    // Fix duration so the seek bar works, then save
    fixBlobDuration(raw, durationMs)
      .then(doSave)
      .catch(() => void doSave(raw)); // fallback: save without fix
  }, []);


  // ── Recording: start ───────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (!configReady) { setStatus("Loading settings…"); return; }
    if (isRecording) return;

    let activeSavePath = config.savePath;

    // ── Ensure a save folder is configured before starting ────────────────
    if (window.electronAPI?.selectSavePath && !config.savePath) {
      setStatus("Please select a save folder…");
      const chosen = await window.electronAPI.selectSavePath();
      if (!chosen) {
        setStatus("Recording cancelled — no save folder selected.");
        return;
      }

      try {
        // Persist selected folder for future sessions.
        if (window.electronAPI?.saveAppConfig) {
          await window.electronAPI.saveAppConfig({ ...config, savePath: chosen });
        }
      } catch {
        setStatus("Failed to save selected folder. Try again.");
        return;
      }

      activeSavePath = chosen;
      savePathRef.current = chosen;
    }

    if (!sourceStreamRef.current) {
      if (!await startSharing()) return;
    }

    try {
      chunksRef.current = [];
      stopRaf();
      stopCropStream();
      stopTimers();

      const stream = buildOutputStream();
      const format = pickFormat();
      const opts: MediaRecorderOptions = {
        videoBitsPerSecond: config.videoBitrateKbps * 1000,
        audioBitsPerSecond: AUDIO_BITRATE_BPS,
        ...(format.mimeType ? { mimeType: format.mimeType } : {}),
      };

      const recorder = new MediaRecorder(stream, opts);
      recorderRef.current = recorder;
      recordStartTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        const durationMs = Date.now() - recordStartTimeRef.current;
        stopRaf();
        stopCropStream();
        setIsRecording(false);
        setRecordingDuration(0);
        stopTimers();
        recorderRef.current = null;

        if (chunksRef.current.length === 0) {
          setStatus("Recording stopped — no data captured");
          return;
        }

        saveRecording(chunksRef.current, format, durationMs, activeSavePath);
        chunksRef.current = [];
        setStatus(`Done! Saved as .${format.ext}`);
      };

      recorder.start(TIMESLICE_MS);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          setRecordingDuration((d) => d + 1);
        }
      }, 1000);

      if (config.maxRecordingMinutes > 0) {
        autoStopRef.current = setTimeout(() => {
          if (recorderRef.current?.state !== "inactive") {
            setStatus(`Auto-stop: ${config.maxRecordingMinutes}m limit reached`);
            recorderRef.current?.stop();
          }
        }, config.maxRecordingMinutes * 60_000);
      }

      const mbps = (config.videoBitrateKbps / 1000).toFixed(1);
      const limit = config.maxRecordingMinutes > 0 ? ` · auto-stop ${config.maxRecordingMinutes}m` : "";
      setStatus(`● REC at ${mbps} Mbps${limit} [${format.ext.toUpperCase()}]`);
    } catch {
      setStatus("Failed to start recording");
    }
  }, [
    buildOutputStream, config.maxRecordingMinutes, config.videoBitrateKbps,
    configReady, isRecording, saveRecording, startSharing,
    stopCropStream, stopRaf, stopTimers,
  ]);

  // ── Recording: stop ────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current?.stop();
    }
  }, []);

  // ── Recording: pause / resume ──────────────────────────────────────────────

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setIsPaused(true);
      isPausedRef.current = true;
      setStatus("Recording paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setIsPaused(false);
      isPausedRef.current = false;
      setStatus("Recording resumed");
    }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Detect Electron bridge once on mount
  useEffect(() => {
    setIsElectronBridgeReady(Boolean(window.electronAPI?.listCaptureSources));
  }, []);

  // Load sources when bridge is ready
  useEffect(() => {
    if (isElectronBridgeReady) void refreshElectronSources();
  }, [isElectronBridgeReady, refreshElectronSources]);

  // Cleanup on unmount
  useEffect(() => () => { stopSharing(); }, [stopSharing]);

  // Track overlay size for crop calculations
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { setPreviewWidth(r.width); setPreviewHeight(r.height); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isSharing]);

  // Auto-preview when source changes
  useEffect(() => {
    if (!selectedSourceId || !isElectronBridgeReady) { autoPreviewedRef.current = ""; return; }
    if (autoPreviewedRef.current === selectedSourceId) return;

    let cancelled = false;
    void (async () => {
      const ok = await startSharing();
      if (!cancelled && ok) autoPreviewedRef.current = selectedSourceId;
    })();
    return () => { cancelled = true; };
  }, [isElectronBridgeReady, selectedSourceId, startSharing]);

  // Sync isRecording to ref for IPC callbacks
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Keep latest save path available for async save handlers.
  useEffect(() => { savePathRef.current = config.savePath; }, [config.savePath]);

  // Register global IPC hotkeys
  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanups: Array<() => void> = [];

    if (window.electronAPI.onToggleRecording) {
      const c = window.electronAPI.onToggleRecording(() => {
        isRecordingRef.current ? stopRecording() : void startRecording();
      });
      if (c) cleanups.push(c);
    }

    if (window.electronAPI.onStopSharing) {
      const c = window.electronAPI.onStopSharing(stopSharing);
      if (c) cleanups.push(c);
    }

    return () => cleanups.forEach((c) => c());
  }, [startRecording, stopRecording, stopSharing]);

  // ── Crop selection handlers ────────────────────────────────────────────────

  const setSelectedSourceId = useCallback((id: string) => setSelectedSourceIdRaw(id), []);
  const clearCrop = useCallback(() => setCropRect(null), []);

  const beginCropSelection = useCallback((e: CropSelectionEvent) => {
    if (!isSharing || !overlayRef.current) return;
    const r = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setDragState({ startX: x, startY: y, currentX: x, currentY: y });
  }, [isSharing]);

  const moveCropSelection = useCallback((e: CropSelectionEvent) => {
    if (!dragState || !overlayRef.current) return;
    const r = overlayRef.current.getBoundingClientRect();
    setDragState((cur) => cur && {
      ...cur,
      currentX: Math.max(0, Math.min(e.clientX - r.left, r.width)),
      currentY: Math.max(0, Math.min(e.clientY - r.top, r.height)),
    });
  }, [dragState]);

  const endCropSelection = useCallback(() => {
    if (!dragState || !overlayRef.current) return;
    const r = overlayRef.current.getBoundingClientRect();
    const next = clampRect(normalizeRect(dragState), r.width, r.height);
    setDragState(null);
    if (!hasValidCrop(next)) { setCropRect(null); setStatus("Crop too small — cleared"); return; }
    setCropRect(next);
    setStatus(`Crop: ${Math.round(next.width)} × ${Math.round(next.height)} px`);
  }, [dragState]);

  // ── Return public API ──────────────────────────────────────────────────────

  return {
    sources, selectedSourceId, setSelectedSourceId,
    isElectronBridgeReady, statusText,
    isSharing, isRecording, isPaused, recordingDuration, latestRecordingPath,
    hasCrop, displayedCrop, previewWidth, previewHeight,
    overlayRef, previewVideoRef,
    refreshElectronSources, startSharing, stopSharing,
    startRecording, stopRecording, pauseRecording, resumeRecording, clearCrop,
    beginCropSelection, moveCropSelection, endCropSelection,
  };
}
