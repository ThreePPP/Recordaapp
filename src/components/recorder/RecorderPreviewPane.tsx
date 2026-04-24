import { memo } from "react";
import type { CropRect } from "@/types/recorder";
import type { PointerEventHandler, RefObject } from "react";

type RecorderPreviewPaneProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  isSharing: boolean;
  isRecording: boolean;
  displayedCrop: CropRect | null;
  previewWidth: number;
  previewHeight: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: () => void;
  onPointerLeave: () => void;
};

export const RecorderPreviewPane = memo(function RecorderPreviewPane({
  overlayRef,
  previewVideoRef,
  isSharing,
  isRecording,
  displayedCrop,
  previewWidth,
  previewHeight,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: RecorderPreviewPaneProps) {
  return (
    <section className="glass-card flex flex-col gap-4 p-4 sm:p-6 min-h-[300px] sm:min-h-[420px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Preview Monitor</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isSharing
              ? "Drag on the preview to select a crop region"
              : "Select a source and click Preview to begin"}
          </p>
        </div>
        {/* Recording indicator */}
        {isRecording && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/30 px-2.5 py-1 rounded-full">
            <span className="rec-dot w-1.5 h-1.5 rounded-full bg-rose-500" />
            REC
          </span>
        )}
      </div>

      {/* Video area */}
      <div
        ref={overlayRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        style={{ aspectRatio: `${previewWidth} / ${previewHeight}` }}
        className={[
          "preview-overlay relative w-full rounded-xl border overflow-hidden bg-black/80",
          isSharing ? "cursor-crosshair border-slate-700/50" : "border-dashed border-slate-700/40 flex items-center justify-center",
        ].join(" ")}
      >
        {/* Live video */}
        <video
          ref={previewVideoRef}
          muted
          playsInline
          autoPlay
          className="h-full w-full object-contain"
          // Hint browser to decode video on GPU
          style={{ transform: "translateZ(0)" }}
        />

        {/* Crop overlay */}
        {displayedCrop && (
          <div
            className="crop-box pointer-events-none absolute border-[3px] border-cyan-400 bg-cyan-400/10"
            style={{
              left: `${displayedCrop.x}px`,
              top: `${displayedCrop.y}px`,
              width: `${displayedCrop.width}px`,
              height: `${displayedCrop.height}px`,
              boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4), 0 0 0 9999px rgba(9,12,18,0.55)",
            }}
          >
            {/* Size label */}
            <span
              className="absolute -top-6 left-0 text-[0.6rem] font-mono text-cyan-300 bg-slate-900/90 px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{ transform: "translateZ(0)" }}
            >
              {Math.round(displayedCrop.width)} × {Math.round(displayedCrop.height)}
            </span>
          </div>
        )}

        {/* No-signal placeholder */}
        {!isSharing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-3 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p className="text-xs font-medium tracking-widest uppercase opacity-60">No signal</p>
          </div>
        )}
      </div>
    </section>
  );
});
