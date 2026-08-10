export type KidExportOptions = {
  canvas: HTMLCanvasElement;
  duration: number;
  drawFrame: (ctx: CanvasRenderingContext2D, time: number) => void;
  audioStream?: MediaStream;
  onProgress?: (value: number) => void;
  fps?: number;
  videoBitsPerSecond?: number;
};

/**
 * Records against a wall clock. MediaRecorder timestamps are real-time, so
 * rendering frames in a tight loop produces sped-up/truncated files even when
 * the canvas receives every logical frame.
 */
export async function recordKidCanvas({
  canvas,
  duration,
  drawFrame,
  audioStream,
  onProgress,
  fps = 30,
  videoBitsPerSecond = 12_000_000,
}: KidExportOptions): Promise<{ blob: Blob; extension: "mp4" | "webm" }> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Video duration is invalid");

  const stream = canvas.captureStream(fps);
  audioStream?.getAudioTracks().forEach((track) => stream.addTrack(track));
  const mime = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
    ? "video/mp4;codecs=avc1"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("The browser could not record this video"));
  });

  drawFrame(ctx, 0);
  recorder.start(1000);
  const startedAt = performance.now();
  const frameMs = 1000 / fps;
  let nextFrameAt = startedAt;
  let lastProgressAt = 0;

  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const elapsed = Math.min(duration, (now - startedAt) / 1000);
      if (now >= nextFrameAt || elapsed >= duration) {
        drawFrame(ctx, elapsed);
        nextFrameAt += frameMs;
      }
      if (now - lastProgressAt > 120) {
        lastProgressAt = now;
        onProgress?.(Math.min(99, (elapsed / duration) * 100));
      }
      if (elapsed >= duration) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  drawFrame(ctx, duration);
  await new Promise((resolve) => setTimeout(resolve, 180));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  onProgress?.(100);
  return {
    blob: new Blob(chunks, { type: mime.split(";")[0] }),
    extension: mime.includes("mp4") ? "mp4" : "webm",
  };
}

export function downloadKidVideo(blob: Blob, filename: string, extension: "mp4" | "webm") {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.${extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}