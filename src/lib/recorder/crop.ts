import type { CropRect, DragState } from "@/types/recorder";

export const MIN_CROP_SIZE = 24;

export function normalizeRect(drag: DragState): CropRect {
  const x = Math.min(drag.startX, drag.currentX);
  const y = Math.min(drag.startY, drag.currentY);
  const width = Math.abs(drag.currentX - drag.startX);
  const height = Math.abs(drag.currentY - drag.startY);

  return { x, y, width, height };
}

export function clampRect(rect: CropRect, maxWidth: number, maxHeight: number): CropRect {
  const x = Math.max(0, Math.min(rect.x, maxWidth));
  const y = Math.max(0, Math.min(rect.y, maxHeight));
  const width = Math.max(0, Math.min(rect.width, maxWidth - x));
  const height = Math.max(0, Math.min(rect.height, maxHeight - y));

  return { x, y, width, height };
}

export function hasValidCrop(rect: CropRect | null): rect is CropRect {
  if (!rect) {
    return false;
  }

  return rect.width >= MIN_CROP_SIZE && rect.height >= MIN_CROP_SIZE;
}
