export type CaptureSourceType = "screen" | "window";
export type CaptureMode = "systemPicker" | "electron";

export type CaptureSource = {
  id: string;
  name: string;
  type: CaptureSourceType;
};

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DragState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};
