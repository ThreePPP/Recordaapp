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
  const rawStreamRef = useRef<MediaStream | null>(null);
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cropStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const isSharingStartingRef = useRef(false);
  const autoPreviewedRef = useRef("");
  // Sync refs — used inside IPC callbacks / async closures where stale state is a risk
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const savePathRef = useRef(config.savePath);
  const configRef = useRef(config);

  // Keep refs in sync with latest values on every render (no extra effects needed)
  isRecordingRef.current = isRecording;
  isPausedRef.current = isPaused;
  savePathRef.current = config.savePath;
  configRef.current = config;

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

  /** Stop and nullify a set of MediaStreams. */
  const stopStreams = useCallback((...streamRefs: Array<React.MutableRefObject<MediaStream | null>>) => {
    for (const ref of streamRefs) {
      ref.current?.getTracks().forEach((t) => t.stop());
      ref.current = null;
    }
  }, []);

  const stopAudioResources = useCallback(() => {
    stopStreams(micStreamRef);
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, [stopStreams]);

  // ── Shared: stop sharing ───────────────────────────────────────────────────

  const stopSharing = useCallback(() => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();

    stopRaf();
    stopStreams(cropStreamRef, rawStreamRef, sourceStreamRef);
    stopAudioResources();

    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;

    setIsSharing(false);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    stopTimers();
    setStatus("Capture stopped");
  }, [stopAudioResources, stopRaf, stopStreams, stopTimers]);

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
      if (list.length > 0) setSelectedSourceIdRaw((cur) => cur || list[0].id);
      setStatus(`Found ${list.length} capture sources`);
    } catch {
      setSources([]);
      setStatus("Failed to load capture sources from Electron");
    }
  }, []);

  // ── Media: acquire desktop stream ─────────────────────────────────────────

  const acquireDesktopStream = useCallback(async (sourceId: string, includeSystemAudio: boolean) => {
    if (!sourceId) throw new Error("No source selected");

    const videoConstraints = {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        minWidth: 1280, minHeight: 720,
        maxWidth: 7680, maxHeight: 4320,
      },
    } as MediaTrackConstraints;

    const getStream = (audio: boolean) =>
      navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audio ? ({ mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: sourceId } } as MediaTrackConstraints) : false,
      });

    if (!includeSystemAudio) return getStream(false);
    try { return await getStream(true); }
    catch { setStatus("System audio unavailable, continuing without it"); return getStream(false); }
  }, []);

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

      const { includeSystemAudio, includeMicrophone } = configRef.current;
      const raw = await acquireDesktopStream(selectedSourceId, includeSystemAudio);
      rawStreamRef.current = raw;

      let micStream: MediaStream | null = null;
      if (includeMicrophone) {
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
        const { videoWidth: w, videoHeight: h } = previewVideoRef.current;
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
  }, [acquireDesktopStream, mixAudio, selectedSource?.name, selectedSourceId, stopSharing]);

  // ── Capture: build output stream (with optional crop canvas) ──────────────

  const buildOutputStream = useCallback((): MediaStream => {
    const source = sourceStreamRef.current;
    const video = previewVideoRef.current;
    if (!source || !video) throw new Error("Missing stream or video element");

    if (!hasValidCrop(cropRect)) return source;

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
      if (t - last >= interval) { ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh); last = t; }
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
    folderPath: string,
  ) => {
    const raw = new Blob(chunks, {
      type: format.mimeType || (format.ext === "mp4" ? "video/mp4" : "video/webm"),
    });
    const filename = `record-${new Date().toISOString().replace(/[:.]/g, "-")}.${format.ext}`;

    const doSave = async (blob: Blob) => {
      if (window.electronAPI?.saveRecording && folderPath) {
        try {
          const buffer = await blob.arrayBuffer();
          const saved = await window.electronAPI.saveRecording(buffer, filename, folderPath);
          setStatus(`${filename} saved`);
          setLatestRecordingPath(saved);
          return;
        } catch (err) {
          console.error("[recorder] IPC save failed, falling back to download", err);
        }
      }
      // Browser fallback
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    fixBlobDuration(raw, durationMs)
      .then(doSave)
      .catch(() => void doSave(raw));
  }, []);

  // ── Recording: start ───────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (!configReady) { setStatus("Loading settings…"); return; }
    if (isRecordingRef.current) return;

    // Read latest config from ref (avoids stale closure & removes config deps)
    const cfg = configRef.current;
    let activeSavePath = cfg.savePath;

    if (window.electronAPI?.selectSavePath && !activeSavePath) {
      setStatus("Please select a save folder…");
      const chosen = await window.electronAPI.selectSavePath();
      if (!chosen) { setStatus("Recording cancelled — no save folder selected."); return; }
      try {
        if (window.electronAPI?.saveAppConfig) {
          await window.electronAPI.saveAppConfig({ ...cfg, savePath: chosen });
        }
      } catch {
        setStatus("Failed to save selected folder. Try again.");
        return;
      }
      activeSavePath = chosen;
      savePathRef.current = chosen;
    }

    if (!sourceStreamRef.current && !await startSharing()) return;

    try {
      chunksRef.current = [];
      stopRaf();
      stopStreams(cropStreamRef);
      stopTimers();

      const stream = buildOutputStream();
      const format = pickFormat();
      const recorder = new MediaRecorder(stream, {
        videoBitsPerSecond: cfg.videoBitrateKbps * 1000,
        audioBitsPerSecond: AUDIO_BITRATE_BPS,
        ...(format.mimeType ? { mimeType: format.mimeType } : {}),
      });
      recorderRef.current = recorder;
      recordStartTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const durationMs = Date.now() - recordStartTimeRef.current;
        stopRaf();
        stopStreams(cropStreamRef);
        setIsRecording(false);
        setRecordingDuration(0);
        stopTimers();
        recorderRef.current = null;

        if (chunksRef.current.length === 0) { setStatus("Recording stopped — no data captured"); return; }
        saveRecording(chunksRef.current, format, durationMs, activeSavePath);
        chunksRef.current = [];
        setStatus(`Done! Saved as .${format.ext}`);
      };

      recorder.start(TIMESLICE_MS);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        if (!isPausedRef.current) setRecordingDuration((d) => d + 1);
      }, 1000);

      if (cfg.maxRecordingMinutes > 0) {
        autoStopRef.current = setTimeout(() => {
          if (recorderRef.current?.state !== "inactive") {
            setStatus(`Auto-stop: ${cfg.maxRecordingMinutes}m limit reached`);
            recorderRef.current?.stop();
          }
        }, cfg.maxRecordingMinutes * 60_000);
      }

      const mbps = (cfg.videoBitrateKbps / 1000).toFixed(1);
      const limit = cfg.maxRecordingMinutes > 0 ? ` · auto-stop ${cfg.maxRecordingMinutes}m` : "";
      setStatus(`● REC at ${mbps} Mbps${limit} [${format.ext.toUpperCase()}]`);
    } catch {
      setStatus("Failed to start recording");
    }
  }, [buildOutputStream, configReady, saveRecording, startSharing, stopRaf, stopStreams, stopTimers]);

  // ── Recording: stop / pause / resume ──────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  }, []);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setIsPaused(true);
      setStatus("Recording paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setIsPaused(false);
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
