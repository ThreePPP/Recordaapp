import type { CropRect } from "@/types/recorder";
import type { PointerEventHandler, RefObject } from "react";

type RecorderPreviewPaneProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  isSharing: boolean;
  displayedCrop: CropRect | null;
  previewWidth: number;
  previewHeight: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: () => void;
  onPointerLeave: () => void;
};

export function RecorderPreviewPane({
  overlayRef,
  previewVideoRef,
  isSharing,
  displayedCrop,
  previewWidth,
  previewHeight,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: RecorderPreviewPaneProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#1a1d24]/80 backdrop-blur-md p-6 shadow-2xl flex flex-col h-full min-h-[500px]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Preview Monitor</h2>
        <p className="mt-1 text-sm text-slate-400">
          Drag on the preview to select a custom capture region.
        </p>
      </div>

      <div
        ref={overlayRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        style={{ aspectRatio: `${previewWidth} / ${previewHeight}` }}
        className={`relative overflow-hidden rounded-xl border border-slate-700/50 shadow-inner flex-1 w-full flex bg-black/80 ${
          isSharing ? "cursor-crosshair" : "items-center justify-center border-dashed"
        }`}
      >
        <video ref={previewVideoRef} muted playsInline autoPlay className="h-full w-full object-contain" />

        {displayedCrop ? (
          <div
            className="pointer-events-none absolute border-[3px] border-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            style={{
              left: `${displayedCrop.x}px`,
              top: `${displayedCrop.y}px`,
              width: `${displayedCrop.width}px`,
              height: `${displayedCrop.height}px`,
              boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.5), 0 0 0 5000px rgba(9,12,18,0.6)",
            }}
          />
        ) : null}

        {!isSharing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <p className="text-sm font-medium tracking-widest uppercase opacity-80">
              No signal detected
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
