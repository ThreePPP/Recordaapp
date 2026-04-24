/**
 * Fixes the duration metadata of a MediaRecorder Blob (WebM or MP4).
 * MediaRecorder does not write duration into the container header,
 * which causes browsers to disable the seek bar.
 *
 * For WebM  → uses the `fix-webm-duration` library to rewrite the header.
 * For MP4   → the browser cannot seek MP4 from MediaRecorder at all; we
 *             return the original blob unchanged (MP4 from MediaRecorder is
 *             already frame-accurate; the missing moov atom is a Chromium
 *             limitation that requires server-side muxing to fix).
 */
export async function fixBlobDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (!blob.type.includes("webm")) {
    return blob;
  }

  try {
    const { default: fixWebmDuration } = await import("fix-webm-duration");
    return await fixWebmDuration(blob, durationMs, { logger: false });
  } catch {
    // If the library fails for any reason, return the original blob.
    return blob;
  }
}
