import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from "webm-muxer";

export type KidExportOptions = {
  canvas: HTMLCanvasElement;
  duration: number;
  drawFrame: (ctx: CanvasRenderingContext2D, time: number) => void;
  /** Deterministic audio track. Preferred — render it with an OfflineAudioContext. */
  audioBuffer?: AudioBuffer | null;
  /** Legacy real-time audio. Only usable by the MediaRecorder fallback path. */
  audioStream?: MediaStream;
  onProgress?: (value: number) => void;
  fps?: number;
  videoBitsPerSecond?: number;
  /** Text burned into every frame (free-tier watermark). */
  watermark?: string | null;
};

export type KidExportResult = { blob: Blob; extension: "mp4" | "webm" };

/**
 * Yields to the event loop without setTimeout. Background tabs clamp timers to
 * ~1s, which is what made exports stall when the user switched away; a
 * MessageChannel macrotask is not clamped, so encoding keeps full speed while
 * the tab is hidden.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

function drawWatermark(ctx: CanvasRenderingContext2D, text: string) {
  const { width, height } = ctx.canvas;
  const size = Math.round(Math.min(width, height) * 0.032);
  ctx.save();
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.55;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.4;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, width - size, height - size);
  ctx.restore();
}

async function pickVideoConfig(width: number, height: number, fps: number, bitrate: number) {
  const candidates = ["avc1.640034", "avc1.640033", "avc1.4d0034", "avc1.42003c"];
  for (const codec of candidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      framerate: fps,
      bitrate,
      // Annex-B is not accepted by mp4-muxer; avc keeps length-prefixed NALUs.
      avc: { format: "avc" },
      hardwareAcceleration: "no-preference",
    };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return config;
    } catch {
      // Try the next profile.
    }
  }
  return null;
}

async function encodeAudioTrack(
  buffer: AudioBuffer,
  addChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void,
): Promise<void> {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => addChunk(chunk, meta),
    error: (error) => console.error("audio encode", error),
  });
  encoder.configure({
    codec: "mp4a.40.2",
    sampleRate,
    numberOfChannels: channels,
    bitrate: 192_000,
  });

  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));

  const frameSize = 1024;
  for (let offset = 0; offset < buffer.length; offset += frameSize) {
    const count = Math.min(frameSize, buffer.length - offset);
    const planar = new Float32Array(count * channels);
    for (let c = 0; c < channels; c += 1) {
      planar.set(data[c].subarray(offset, offset + count), c * count);
    }
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: count,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: planar,
    });
    encoder.encode(audioData);
    audioData.close();
    if (encoder.encodeQueueSize > 24) await yieldToEventLoop();
  }
  await encoder.flush();
  encoder.close();
}

/**
 * Frame-exact encoder. Every single frame is rendered and handed to the
 * hardware encoder with an explicit presentation timestamp, so the output is
 * always exactly `fps` frames per second regardless of how fast the machine
 * renders or whether the tab is in the background.
 */
async function exportWithWebCodecs(options: Required<Pick<KidExportOptions, "canvas" | "duration" | "drawFrame">> & KidExportOptions): Promise<KidExportResult | null> {
  const { canvas, duration, drawFrame, audioBuffer, onProgress, watermark } = options;
  const fps = options.fps ?? 60;
  const bitrate = options.videoBitsPerSecond ?? 16_000_000;

  if (typeof VideoEncoder === "undefined") return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const videoConfig = await pickVideoConfig(canvas.width, canvas.height, fps, bitrate);
  if (!videoConfig) return null;

  const audioChannels = audioBuffer ? Math.min(2, audioBuffer.numberOfChannels) : 0;
  const canEncodeAudio = !!audioBuffer && typeof AudioEncoder !== "undefined";

  const target = new Mp4Target();
  const muxer = new Mp4Muxer({
    target,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
    video: { codec: "avc", width: canvas.width, height: canvas.height, frameRate: fps },
    ...(canEncodeAudio
      ? { audio: { codec: "aac", numberOfChannels: audioChannels, sampleRate: audioBuffer!.sampleRate } }
      : {}),
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => console.error("video encode", error),
  });
  encoder.configure(videoConfig);

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameDuration = 1_000_000 / fps;
  let lastReport = 0;

  for (let i = 0; i < totalFrames; i += 1) {
    drawFrame(ctx, i / fps);
    if (watermark) drawWatermark(ctx, watermark);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(i * frameDuration),
      duration: Math.round(frameDuration),
    });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();

    // Backpressure — keeps memory flat on long exports.
    while (encoder.encodeQueueSize > 12) await yieldToEventLoop();
    if (i % 4 === 0) await yieldToEventLoop();

    const now = performance.now();
    if (now - lastReport > 120) {
      lastReport = now;
      onProgress?.(Math.min(96, ((i + 1) / totalFrames) * (canEncodeAudio ? 92 : 98)));
    }
  }

  await encoder.flush();
  encoder.close();

  if (canEncodeAudio) {
    onProgress?.(96);
    await encodeAudioTrack(audioBuffer!, (chunk, meta) => muxer.addAudioChunk(chunk, meta));
  }

  muxer.finalize();
  onProgress?.(100);
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), extension: "mp4" };
}

/** VP9/Opus frame-exact fallback for browsers without an H.264 encoder. */
async function exportWithWebmCodecs(options: KidExportOptions): Promise<KidExportResult | null> {
  const { canvas, duration, drawFrame, audioBuffer, onProgress, watermark } = options;
  const fps = options.fps ?? 60;
  if (typeof VideoEncoder === "undefined") return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const config: VideoEncoderConfig = {
    codec: "vp09.00.51.08",
    width: canvas.width,
    height: canvas.height,
    framerate: fps,
    bitrate: options.videoBitsPerSecond ?? 16_000_000,
  };
  try {
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) return null;
  } catch {
    return null;
  }

  const channels = audioBuffer ? Math.min(2, audioBuffer.numberOfChannels) : 0;
  const useAudio = !!audioBuffer && typeof AudioEncoder !== "undefined";
  const target = new WebmTarget();
  const muxer = new WebmMuxer({
    target,
    video: { codec: "V_VP9", width: canvas.width, height: canvas.height, frameRate: fps },
    ...(useAudio ? { audio: { codec: "A_OPUS", numberOfChannels: channels, sampleRate: audioBuffer!.sampleRate } } : {}),
    firstTimestampBehavior: "offset",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => console.error("video encode", error),
  });
  encoder.configure(config);

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameDuration = 1_000_000 / fps;
  for (let i = 0; i < totalFrames; i += 1) {
    drawFrame(ctx, i / fps);
    if (watermark) drawWatermark(ctx, watermark);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameDuration), duration: Math.round(frameDuration) });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 12) await yieldToEventLoop();
    if (i % 4 === 0) await yieldToEventLoop();
    if (i % 15 === 0) onProgress?.(Math.min(96, ((i + 1) / totalFrames) * 92));
  }
  await encoder.flush();
  encoder.close();

  if (useAudio) {
    const opus = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (error) => console.error("audio encode", error),
    });
    opus.configure({ codec: "opus", sampleRate: audioBuffer!.sampleRate, numberOfChannels: channels, bitrate: 160_000 });
    const planes: Float32Array[] = [];
    for (let c = 0; c < channels; c += 1) planes.push(audioBuffer!.getChannelData(c));
    const size = 960;
    for (let offset = 0; offset < audioBuffer!.length; offset += size) {
      const count = Math.min(size, audioBuffer!.length - offset);
      const planar = new Float32Array(count * channels);
      for (let c = 0; c < channels; c += 1) planar.set(planes[c].subarray(offset, offset + count), c * count);
      const data = new AudioData({
        format: "f32-planar",
        sampleRate: audioBuffer!.sampleRate,
        numberOfFrames: count,
        numberOfChannels: channels,
        timestamp: Math.round((offset / audioBuffer!.sampleRate) * 1_000_000),
        data: planar,
      });
      opus.encode(data);
      data.close();
      if (opus.encodeQueueSize > 24) await yieldToEventLoop();
    }
    await opus.flush();
    opus.close();
  }

  muxer.finalize();
  onProgress?.(100);
  return { blob: new Blob([target.buffer], { type: "video/webm" }), extension: "webm" };
}

/** Last-resort real-time recorder for browsers without WebCodecs. */
async function exportWithMediaRecorder(options: KidExportOptions): Promise<KidExportResult> {
  const { canvas, duration, drawFrame, onProgress, watermark } = options;
  const fps = options.fps ?? 60;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  let audioStream = options.audioStream;
  let liveCtx: AudioContext | null = null;
  if (!audioStream && options.audioBuffer) {
    liveCtx = new AudioContext({ sampleRate: options.audioBuffer.sampleRate });
    const dest = liveCtx.createMediaStreamDestination();
    const source = liveCtx.createBufferSource();
    source.buffer = options.audioBuffer;
    source.connect(dest);
    source.start();
    audioStream = dest.stream;
  }

  const stream = canvas.captureStream(fps);
  audioStream?.getAudioTracks().forEach((track) => stream.addTrack(track));
  const mime = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
    ? "video/mp4;codecs=avc1"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: options.videoBitsPerSecond ?? 16_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("The browser could not record this video"));
  });

  drawFrame(ctx, 0);
  if (watermark) drawWatermark(ctx, watermark);
  recorder.start(1000);
  const startedAt = performance.now();
  const frameMs = 1000 / fps;
  let nextFrameAt = startedAt;

  await new Promise<void>((resolve) => {
    const tick = () => {
      const now = performance.now();
      const elapsed = Math.min(duration, (now - startedAt) / 1000);
      if (now >= nextFrameAt || elapsed >= duration) {
        drawFrame(ctx, elapsed);
        if (watermark) drawWatermark(ctx, watermark);
        nextFrameAt += frameMs;
        onProgress?.(Math.min(99, (elapsed / duration) * 100));
      }
      if (elapsed >= duration) resolve();
      else void yieldToEventLoop().then(tick);
    };
    tick();
  });

  await new Promise((resolve) => setTimeout(resolve, 180));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  await liveCtx?.close();
  onProgress?.(100);
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), extension: mime.includes("mp4") ? "mp4" : "webm" };
}

export async function recordKidCanvas(options: KidExportOptions): Promise<KidExportResult> {
  const { duration } = options;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Video duration is invalid");
  if (!options.canvas.getContext("2d")) throw new Error("Canvas is unavailable");

  try {
    const mp4 = await exportWithWebCodecs(options as never);
    if (mp4) return mp4;
  } catch (error) {
    console.error("WebCodecs mp4 export failed, falling back", error);
  }
  try {
    const webm = await exportWithWebmCodecs(options);
    if (webm) return webm;
  } catch (error) {
    console.error("WebCodecs webm export failed, falling back", error);
  }
  return exportWithMediaRecorder(options);
}

export function downloadKidVideo(blob: Blob, filename: string, extension: "mp4" | "webm") {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.${extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
