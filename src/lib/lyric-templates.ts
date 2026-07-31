/**
 * Extra lyric-video engines in the "Vinyl Classic" / "Now Playing" family.
 *
 * These are pure drawing routines. Every shared helper (background, vinyl disc,
 * lyric roll, header, footer) is handed in through `Kit` at call time so this
 * module never has to import back into the route file.
 */

export type LyricLine = { time: number; text: string; end?: number };

export type Palette = {
  id: string;
  name: string;
  bg: [string, string];
  primary: string;
  accent: string;
  text: string;
  muted: string;
};

export type RenderCtx = {
  t: number;
  w: number;
  h: number;
  aspect: "9:16" | "16:9";
  palette: Palette;
  title: string;
  artist: string;
  coverImg: HTMLImageElement | null;
  lyrics: LyricLine[];
  duration: number;
  /** 0 = static, 1 = default subtle motion, up to 2 = doubled. */
  motion: number;
  /** "drift" | "pulse" | "bob" | "still" — which effect gets emphasised. */
  animStyle: string;
};

type C = CanvasRenderingContext2D;

export type RollOpts = {
  top: number;
  bottom: number;
  focusY: number;
  size: number;
  uppercase?: boolean;
  glow?: boolean;
  showRule?: boolean;
};

export type Kit = {
  FONT: string;
  hexA: (hex: string, a: number) => string;
  easeOutCubic: (x: number) => number;
  fmtTime: (s: number) => string;
  findLineIndex: (lines: LyricLine[], t: number) => number;
  wrapText: (ctx: C, text: string, maxWidth: number) => string[];
  tracked: (ctx: C, text: string, x: number, y: number, spacing: number) => void;
  trackedFit: (
    ctx: C,
    text: string,
    x: number,
    y: number,
    maxW: number,
    weight: number,
    size: number,
    spacingRatio: number,
  ) => number;
  roundRect: (ctx: C, x: number, y: number, w: number, h: number, r: number) => void;
  drawBg: (ctx: C, w: number, h: number, p: Palette, t: number) => void;
  drawVinyl: (
    ctx: C,
    x: number,
    y: number,
    r: number,
    t: number,
    cover: HTMLImageElement | null,
    p: Palette,
  ) => void;
  drawProgressRing: (ctx: C, x: number, y: number, r: number, progress: number, p: Palette) => void;
  drawWaveBar: (
    ctx: C,
    x: number,
    y: number,
    w: number,
    h: number,
    progress: number,
    t: number,
    p: Palette,
    seed?: number,
  ) => void;
  drawLyricRoll: (ctx: C, r: RenderCtx, opts: RollOpts) => void;
  drawHeader: (ctx: C, r: RenderCtx, y: number, big: number) => void;
  drawFooterBar: (ctx: C, r: RenderCtx, y: number) => void;
};

const SERIF = `"Iowan Old Style", Georgia, "Times New Roman", serif`;
const COND = `"Arial Narrow", "Helvetica Neue Condensed", Impact, sans-serif`;

// -------------------- local building blocks --------------------

function prog(r: RenderCtx) {
  return r.duration > 0 ? Math.max(0, Math.min(1, r.t / r.duration)) : 0;
}

/** Cover art in a rounded card, with a graceful gradient fallback. */
function coverCard(
  ctx: C,
  kit: Kit,
  r: RenderCtx,
  x: number,
  y: number,
  size: number,
  radius: number,
  shadow = true,
) {
  const { coverImg: img, palette: p } = r;
  const breathe =
    1 +
    Math.sin(r.t * 0.8) * 0.015 * Math.max(0, Math.min(2, r.motion)) * (r.animStyle === "pulse" ? 1.6 : 1);
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(breathe, breathe);
  ctx.translate(-(x + size / 2), -(y + size / 2));
  if (shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.06;
    ctx.fillStyle = "#0d0d0f";
    kit.roundRect(ctx, x, y, size, size, radius);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  kit.roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  if (img && img.naturalWidth) {
    const ratio = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, p.primary);
    g.addColorStop(1, p.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, size, size);
  }
  // subtle top sheen so flat artwork still feels lit
  const sheen = ctx.createLinearGradient(x, y, x, y + size);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, size, size);
  ctx.restore();
  ctx.save();
  kit.roundRect(ctx, x, y, size, size, radius);
  ctx.strokeStyle = kit.hexA(p.text, 0.12);
  ctx.lineWidth = Math.max(1, size * 0.004);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** Full-bleed, heavily blurred artwork behind everything (Apple Music style). */
function coverWash(ctx: C, kit: Kit, r: RenderCtx, alpha = 0.55) {
  const { w, h, coverImg: img } = r;
  if (!img?.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  try {
    ctx.filter = `blur(${Math.round(Math.min(w, h) * 0.09)}px) saturate(1.5)`;
  } catch {
    /* filter unsupported — plain scale still reads fine */
  }
  const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.35;
  const dw = img.naturalWidth * ratio;
  const dh = img.naturalHeight * ratio;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
  const veil = ctx.createLinearGradient(0, 0, 0, h);
  veil.addColorStop(0, "rgba(0,0,0,0.55)");
  veil.addColorStop(0.5, "rgba(0,0,0,0.42)");
  veil.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, w, h);
}

/** Title + artist set as a left-aligned meta block. */
function metaBlock(
  ctx: C,
  kit: Kit,
  r: RenderCtx,
  x: number,
  y: number,
  size: number,
  maxW: number,
  align: CanvasTextAlign = "left",
) {
  const p = r.palette;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  let s = size;
  ctx.font = `800 ${Math.round(s)}px ${kit.FONT}`;
  const title = r.title || "Untitled";
  while (ctx.measureText(title).width > maxW && s > 10) {
    s *= 0.94;
    ctx.font = `800 ${Math.round(s)}px ${kit.FONT}`;
  }
  ctx.fillStyle = p.text;
  ctx.fillText(title, x, y);
  ctx.font = `500 ${Math.round(size * 0.58)}px ${kit.FONT}`;
  ctx.fillStyle = kit.hexA(p.muted, 1);
  ctx.fillText(r.artist || "Unknown artist", x, y + size * 0.95);
}

/** Slim rounded scrubber with elapsed / remaining timestamps. */
function scrubber(ctx: C, kit: Kit, r: RenderCtx, x: number, y: number, barW: number) {
  const { h, palette: p } = r;
  const pr = prog(r);
  const th = Math.max(3, h * 0.005);
  ctx.fillStyle = kit.hexA(p.text, 0.18);
  kit.roundRect(ctx, x, y, barW, th, th / 2);
  ctx.fill();
  ctx.fillStyle = p.primary;
  kit.roundRect(ctx, x, y, barW * pr, th, th / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + barW * pr, y + th / 2, th * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = p.text;
  ctx.fill();
  ctx.font = `500 ${Math.round(h * 0.0145)}px ${kit.FONT}`;
  ctx.fillStyle = kit.hexA(p.muted, 1);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(kit.fmtTime(r.t), x, y + h * 0.028);
  ctx.textAlign = "right";
  ctx.fillText(kit.fmtTime(r.duration), x + barW, y + h * 0.028);
  ctx.textAlign = "center";
}

/** Pivoting tonearm that tracks in toward the label as the song plays. */
function tonearm(ctx: C, kit: Kit, cx: number, cy: number, radius: number, pr: number, p: Palette) {
  const px = cx + radius * 1.05;
  const py = cy - radius * 0.95;
  const len = radius * 1.35;
  const angle = Math.PI * 0.62 + pr * 0.3;
  ctx.save();
  ctx.translate(px, py);
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = radius * 0.08;
  // pivot housing
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.11, 0, Math.PI * 2);
  const hg = ctx.createLinearGradient(-radius * 0.1, -radius * 0.1, radius * 0.1, radius * 0.1);
  hg.addColorStop(0, "#3a3a3d");
  hg.addColorStop(1, "#141416");
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.rotate(angle);
  // arm
  ctx.fillStyle = "#c9ccd1";
  kit.roundRect(ctx, -radius * 0.02, 0, radius * 0.04, len, radius * 0.02);
  ctx.fill();
  // head shell
  ctx.fillStyle = "#1d1d20";
  kit.roundRect(
    ctx,
    -radius * 0.055,
    len - radius * 0.02,
    radius * 0.11,
    radius * 0.13,
    radius * 0.02,
  );
  ctx.fill();
  ctx.fillStyle = p.primary;
  kit.roundRect(
    ctx,
    -radius * 0.02,
    len + radius * 0.09,
    radius * 0.04,
    radius * 0.025,
    radius * 0.01,
  );
  ctx.fill();
  ctx.restore();
}

/** Animated equaliser columns. */
function eqBars(
  ctx: C,
  kit: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  p: Palette,
  count = 5,
) {
  const bw = w / (count * 2 - 1);
  for (let i = 0; i < count; i++) {
    const k = 0.35 + 0.65 * Math.abs(Math.sin(t * (3.1 + i * 0.7) + i));
    const bh = h * k;
    ctx.fillStyle = i % 2 ? p.accent : p.primary;
    kit.roundRect(ctx, x + i * bw * 2, y + (h - bh), bw, bh, bw * 0.4);
    ctx.fill();
  }
}

function currentLine(kit: Kit, r: RenderCtx) {
  const idx = kit.findLineIndex(r.lyrics, r.t);
  return { idx, cur: idx >= 0 ? r.lyrics[idx] : undefined, next: r.lyrics[idx + 1] };
}

/** Big centred lyric with a soft rise-in, auto-fit to the safe width. */
function heroLyric(
  ctx: C,
  kit: Kit,
  r: RenderCtx,
  y: number,
  size: number,
  opts: {
    weight?: number;
    color?: string;
    uppercase?: boolean;
    maxW?: number;
    glow?: boolean;
  } = {},
) {
  const { cur } = currentLine(kit, r);
  if (!cur) return y;
  const p = r.palette;
  const appear = kit.easeOutCubic(Math.min(1, (r.t - cur.time) / 0.35));
  const maxW = opts.maxW ?? r.w * 0.84;
  let s = size;
  const weight = opts.weight ?? 900;
  ctx.font = `${weight} ${Math.round(s)}px ${kit.FONT}`;
  let rows = kit.wrapText(ctx, opts.uppercase ? cur.text.toUpperCase() : cur.text, maxW);
  while (rows.length > 3 && s > size * 0.5) {
    s *= 0.9;
    ctx.font = `${weight} ${Math.round(s)}px ${kit.FONT}`;
    rows = kit.wrapText(ctx, opts.uppercase ? cur.text.toUpperCase() : cur.text, maxW);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.globalAlpha = appear;
  if (opts.glow) {
    ctx.shadowColor = kit.hexA(p.primary, 0.75);
    ctx.shadowBlur = s * 0.5;
  }
  ctx.fillStyle = opts.color ?? p.text;
  let yy = y - ((rows.length - 1) * s * 1.14) / 2 + (1 - appear) * s * 0.25;
  for (const row of rows) {
    ctx.fillText(row, r.w / 2, yy);
    yy += s * 1.14;
  }
  ctx.restore();
  return yy;
}

// -------------------- engines --------------------

type Engine = {
  id: string;
  name: string;
  desc: string;
  draw: (ctx: C, r: RenderCtx, kit: Kit) => void;
};

const vinylTonearm: Engine = {
  id: "vinyl-tonearm",
  name: "Vinyl · Tonearm Deck",
  desc: "Vinyl Classic with a tracking tonearm that arcs in as the song plays.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const vr = vertical ? w * 0.235 : h * 0.26;
    const vx = vertical ? w * 0.44 : w * 0.22;
    const vy = vertical ? h * 0.29 : h * 0.5;
    if (vertical) kit.drawHeader(ctx, r, h * 0.055, h * 0.036);
    kit.drawVinyl(ctx, vx, vy, vr, t, r.coverImg, p);
    kit.drawProgressRing(ctx, vx, vy, vr * 1.14, prog(r), p);
    tonearm(ctx, kit, vx, vy, vr, prog(r), p);
    if (vertical) {
      kit.drawLyricRoll(ctx, r, {
        top: h * 0.49,
        bottom: h * 0.92,
        focusY: h * 0.69,
        size: h * 0.028,
        showRule: true,
      });
      kit.drawFooterBar(ctx, r, h * 0.955);
    } else {
      ctx.save();
      ctx.translate(w * 0.4, 0);
      const sub = { ...r, w: w * 0.58 };
      kit.drawHeader(ctx, sub, h * 0.15, h * 0.058);
      kit.drawLyricRoll(ctx, sub, {
        top: h * 0.3,
        bottom: h * 0.9,
        focusY: h * 0.61,
        size: h * 0.04,
        showRule: true,
      });
      ctx.restore();
      kit.drawFooterBar(ctx, r, h * 0.94);
    }
  },
};

const vinyl45: Engine = {
  id: "vinyl-45",
  name: "Vinyl · 45 RPM Single",
  desc: "Compact spinning single top-left, track meta beside it, tall lyric roll.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const vr = vertical ? w * 0.14 : h * 0.15;
    const vx = vertical ? w * 0.22 : w * 0.13;
    const vy = vertical ? h * 0.13 : h * 0.2;
    kit.drawVinyl(ctx, vx, vy, vr, t, r.coverImg, p);
    kit.drawProgressRing(ctx, vx, vy, vr * 1.18, prog(r), p);
    metaBlock(ctx, kit, r, vx + vr * 1.5, vy - h * 0.012, h * (vertical ? 0.03 : 0.036), w * 0.5);
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(h * 0.014)}px ${kit.FONT}`;
    ctx.fillStyle = kit.hexA(p.primary, 0.9);
    kit.tracked(ctx, "45 RPM · SIDE A", vx + vr * 1.5 + h * 0.05, vy + h * 0.05, h * 0.004);
    ctx.textAlign = "center";
    kit.drawLyricRoll(ctx, r, {
      top: h * (vertical ? 0.26 : 0.34),
      bottom: h * 0.92,
      focusY: h * (vertical ? 0.6 : 0.64),
      size: h * (vertical ? 0.032 : 0.044),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const vinylSleeve: Engine = {
  id: "vinyl-sleeve",
  name: "Vinyl · Record Sleeve",
  desc: "Album sleeve with the disc sliding out behind it, lyrics rolling underneath.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const size = vertical ? w * 0.4 : h * 0.42;
    const cx = vertical ? w * 0.4 : w * 0.24;
    const cy = vertical ? h * 0.2 : h * 0.36;
    const slide = 0.5 + Math.sin(t * 0.5) * 0.04;
    kit.drawVinyl(ctx, cx + size * slide, cy + size / 2, size * 0.47, t, null, p);
    coverCard(ctx, kit, r, cx - size / 2, cy, size, size * 0.02);
    metaBlock(
      ctx,
      kit,
      r,
      cx - size / 2,
      cy + size + h * 0.05,
      h * (vertical ? 0.03 : 0.034),
      vertical ? w * 0.8 : w * 0.4,
    );
    kit.drawLyricRoll(ctx, r, {
      top: h * (vertical ? 0.44 : 0.3),
      bottom: h * 0.92,
      focusY: h * (vertical ? 0.7 : 0.62),
      size: h * (vertical ? 0.03 : 0.042),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const vinylHalo: Engine = {
  id: "vinyl-halo",
  name: "Vinyl · Halo",
  desc: "Oversized disc dropped behind the lyric column for a deep, cinematic frame.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vr = Math.min(w, h) * (r.aspect === "9:16" ? 0.42 : 0.4);
    ctx.save();
    ctx.globalAlpha = 0.5;
    kit.drawVinyl(ctx, w / 2, h * 0.52, vr, t, r.coverImg, p);
    ctx.restore();
    kit.drawProgressRing(ctx, w / 2, h * 0.52, vr * 1.08, prog(r), p);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(0, 0, w, h);
    kit.drawHeader(ctx, r, h * 0.075, h * (r.aspect === "9:16" ? 0.032 : 0.038));
    kit.drawLyricRoll(ctx, r, {
      top: h * 0.2,
      bottom: h * 0.9,
      focusY: h * 0.54,
      size: h * (r.aspect === "9:16" ? 0.036 : 0.05),
      glow: true,
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.95);
  },
};

const vinylMini: Engine = {
  id: "vinyl-mini",
  name: "Vinyl · Mini Header",
  desc: "Small spinning disc locked into the title bar so the lyrics own the frame.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vr = h * 0.038;
    const y = h * 0.075;
    const maxW = w * 0.72;
    let titleSize = h * 0.026;
    ctx.font = `800 ${Math.round(titleSize)}px ${kit.FONT}`;
    const title = (r.title || "Untitled").toUpperCase();
    let tw = ctx.measureText(title).width;
    // Shrink the title so the disc + label never runs off the safe area.
    while (tw + vr * 2.6 > maxW && titleSize > 10) {
      titleSize *= 0.92;
      ctx.font = `800 ${Math.round(titleSize)}px ${kit.FONT}`;
      tw = ctx.measureText(title).width;
    }
    const startX = w / 2 - (tw + vr * 2.6) / 2;
    kit.drawVinyl(ctx, startX + vr, y, vr, t, r.coverImg, p);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    ctx.fillText(title, startX + vr * 2.4, y - h * 0.008, maxW - vr * 2.6);
    ctx.font = `500 ${Math.round(h * 0.016)}px ${kit.FONT}`;
    ctx.fillStyle = kit.hexA(p.muted, 1);
    ctx.fillText(
      (r.artist || "Unknown artist").toUpperCase(),
      startX + vr * 2.4,
      y + h * 0.018,
      maxW - vr * 2.6,
    );
    ctx.textAlign = "center";
    kit.drawLyricRoll(ctx, r, {
      top: h * 0.14,
      bottom: h * 0.92,
      focusY: h * 0.53,
      size: h * (r.aspect === "9:16" ? 0.038 : 0.052),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const vinylNeon: Engine = {
  id: "vinyl-neon",
  name: "Vinyl · Neon Ring",
  desc: "Disc wrapped in pulsing neon rings with a glowing lyric roll.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fillRect(0, 0, w, h);
    const vertical = r.aspect === "9:16";
    const vr = vertical ? w * 0.23 : h * 0.25;
    const vy = vertical ? h * 0.28 : h * 0.5;
    const vx = vertical ? w / 2 : w * 0.22;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const pulse = (t * 0.4 + i / 3) % 1;
      ctx.strokeStyle = kit.hexA(i % 2 ? p.accent : p.primary, 0.5 * (1 - pulse));
      ctx.lineWidth = Math.max(2, vr * 0.02);
      ctx.shadowColor = kit.hexA(p.primary, 0.8);
      ctx.shadowBlur = vr * 0.2;
      ctx.beginPath();
      ctx.arc(vx, vy, vr * (1.2 + pulse * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    kit.drawVinyl(ctx, vx, vy, vr, t, r.coverImg, p);
    kit.drawProgressRing(ctx, vx, vy, vr * 1.1, prog(r), p);
    if (vertical) {
      kit.drawHeader(ctx, r, h * 0.06, h * 0.034);
      kit.drawLyricRoll(ctx, r, {
        top: h * 0.47,
        bottom: h * 0.92,
        focusY: h * 0.68,
        size: h * 0.03,
        glow: true,
      });
      kit.drawFooterBar(ctx, r, h * 0.955);
    } else {
      ctx.save();
      ctx.translate(w * 0.4, 0);
      const sub = { ...r, w: w * 0.58 };
      kit.drawHeader(ctx, sub, h * 0.16, h * 0.055);
      kit.drawLyricRoll(ctx, sub, {
        top: h * 0.3,
        bottom: h * 0.9,
        focusY: h * 0.6,
        size: h * 0.042,
        glow: true,
      });
      ctx.restore();
      kit.drawFooterBar(ctx, r, h * 0.94);
    }
  },
};

const vinylEditorial: Engine = {
  id: "vinyl-editorial",
  name: "Vinyl · Editorial",
  desc: "Serif masthead with the disc bled off the edge — sleeve-notes styling.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const vr = vertical ? w * 0.3 : h * 0.32;
    kit.drawVinyl(
      ctx,
      w * (vertical ? 0.92 : 0.88),
      h * (vertical ? 0.17 : 0.26),
      vr,
      t,
      r.coverImg,
      p,
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.primary;
    ctx.font = `600 ${Math.round(h * 0.014)}px ${kit.FONT}`;
    kit.tracked(ctx, "SIDE A · TRACK 01", w * 0.08 + h * 0.06, h * 0.08, h * 0.006);
    ctx.fillStyle = p.text;
    let s = h * (vertical ? 0.052 : 0.062);
    ctx.font = `400 italic ${Math.round(s)}px ${SERIF}`;
    const title = r.title || "Untitled";
    while (ctx.measureText(title).width > w * 0.6 && s > 12) {
      s *= 0.94;
      ctx.font = `400 italic ${Math.round(s)}px ${SERIF}`;
    }
    ctx.fillText(title, w * 0.08, h * 0.135);
    ctx.font = `500 ${Math.round(h * 0.019)}px ${kit.FONT}`;
    ctx.fillStyle = kit.hexA(p.muted, 1);
    ctx.fillText((r.artist || "Unknown artist").toUpperCase(), w * 0.08, h * 0.18);
    ctx.strokeStyle = kit.hexA(p.primary, 0.55);
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.21);
    ctx.lineTo(w * 0.55, h * 0.21);
    ctx.stroke();
    ctx.textAlign = "center";
    kit.drawLyricRoll(ctx, r, {
      top: h * (vertical ? 0.36 : 0.3),
      bottom: h * 0.92,
      focusY: h * (vertical ? 0.66 : 0.62),
      size: h * (vertical ? 0.032 : 0.044),
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const vinylTwin: Engine = {
  id: "vinyl-twin",
  name: "Vinyl · Twin Decks",
  desc: "Two counter-spinning decks framing the lyric column, DJ-booth style.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const vr = vertical ? w * 0.17 : h * 0.2;
    const y = vertical ? h * 0.19 : h * 0.24;
    kit.drawVinyl(ctx, w * 0.27, y, vr, t, r.coverImg, p);
    kit.drawVinyl(ctx, w * 0.73, y, vr, -t * 0.8, null, p);
    kit.drawProgressRing(ctx, w * 0.27, y, vr * 1.16, prog(r), p);
    kit.drawProgressRing(ctx, w * 0.73, y, vr * 1.16, 1 - prog(r), p);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    kit.trackedFit(
      ctx,
      (r.title || "Untitled").toUpperCase(),
      w / 2,
      y + vr * 1.55,
      w * 0.5,
      800,
      h * 0.026,
      0.06,
    );
    ctx.fillStyle = kit.hexA(p.muted, 1);
    kit.trackedFit(
      ctx,
      (r.artist || "").toUpperCase(),
      w / 2,
      y + vr * 1.55 + h * 0.028,
      w * 0.4,
      500,
      h * 0.015,
      0.2,
    );
    kit.drawLyricRoll(ctx, r, {
      top: h * (vertical ? 0.42 : 0.48),
      bottom: h * 0.92,
      focusY: h * (vertical ? 0.68 : 0.72),
      size: h * (vertical ? 0.032 : 0.038),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const cassette: Engine = {
  id: "tape-cassette",
  name: "Tape · Cassette Deck",
  desc: "Cassette shell with reels that wind in real time, lyrics rolling below.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const bw = vertical ? w * 0.74 : w * 0.36;
    const bh = bw * 0.62;
    const bx = vertical ? (w - bw) / 2 : w * 0.07;
    const by = vertical ? h * 0.1 : h * 0.3;
    const pr = prog(r);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = bw * 0.09;
    ctx.shadowOffsetY = bw * 0.02;
    const shell = ctx.createLinearGradient(bx, by, bx, by + bh);
    shell.addColorStop(0, "#26262a");
    shell.addColorStop(1, "#101012");
    ctx.fillStyle = shell;
    kit.roundRect(ctx, bx, by, bw, bh, bw * 0.045);
    ctx.fill();
    ctx.restore();

    // label strip
    ctx.fillStyle = kit.hexA(p.primary, 0.9);
    kit.roundRect(ctx, bx + bw * 0.07, by + bh * 0.09, bw * 0.86, bh * 0.24, bw * 0.015);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(bh * 0.11)}px ${kit.FONT}`;
    const title = r.title || "Untitled";
    let ts = bh * 0.11;
    while (ctx.measureText(title).width > bw * 0.78 && ts > 8) {
      ts *= 0.94;
      ctx.font = `800 ${Math.round(ts)}px ${kit.FONT}`;
    }
    ctx.fillText(title, bx + bw * 0.11, by + bh * 0.18);
    ctx.font = `500 ${Math.round(bh * 0.075)}px ${kit.FONT}`;
    ctx.fillText((r.artist || "").toUpperCase(), bx + bw * 0.11, by + bh * 0.27);

    // window + reels
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    kit.roundRect(ctx, bx + bw * 0.14, by + bh * 0.4, bw * 0.72, bh * 0.42, bw * 0.02);
    ctx.fill();
    const reelR = bh * 0.16;
    const spin = t * 3.2;
    [
      { x: bx + bw * 0.31, fill: 1 - pr, dir: 1 },
      { x: bx + bw * 0.69, fill: pr, dir: 1 },
    ].forEach((reel) => {
      const cy = by + bh * 0.61;
      ctx.save();
      ctx.translate(reel.x, cy);
      // tape pack
      ctx.beginPath();
      ctx.arc(0, 0, reelR * (0.5 + reel.fill * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = "#2a1d13";
      ctx.fill();
      ctx.rotate(spin * reel.dir);
      ctx.strokeStyle = kit.hexA(p.accent, 0.9);
      ctx.lineWidth = Math.max(2, reelR * 0.09);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -reelR * 0.48);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, reelR * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = "#e6e6e6";
      ctx.fill();
      ctx.restore();
    });
    // tape path between reels
    ctx.strokeStyle = "#43301f";
    ctx.lineWidth = Math.max(2, bh * 0.02);
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.31, by + bh * 0.78);
    ctx.lineTo(bx + bw * 0.69, by + bh * 0.78);
    ctx.stroke();

    if (vertical) {
      kit.drawLyricRoll(ctx, r, {
        top: h * 0.44,
        bottom: h * 0.92,
        focusY: h * 0.69,
        size: h * 0.031,
        showRule: true,
      });
    } else {
      ctx.save();
      ctx.translate(w * 0.45, 0);
      const sub = { ...r, w: w * 0.52 };
      kit.drawLyricRoll(ctx, sub, {
        top: h * 0.14,
        bottom: h * 0.9,
        focusY: h * 0.54,
        size: h * 0.044,
        showRule: true,
      });
      ctx.restore();
    }
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const cdPlayer: Engine = {
  id: "disc-cd",
  name: "Disc · CD Player",
  desc: "Spinning CD with an iridescent sheen and a laser-read progress ring.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const cr = vertical ? w * 0.25 : h * 0.27;
    const cx = vertical ? w / 2 : w * 0.23;
    const cy = vertical ? h * 0.28 : h * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 1.4);
    ctx.beginPath();
    ctx.arc(0, 0, cr, 0, Math.PI * 2);
    ctx.fillStyle = "#0e0e11";
    ctx.fill();
    // iridescence: overlapping tinted arcs
    const hues = ["#ff5f9e", "#ffd166", "#8ef6c4", "#7fb3ff", "#c58bff"];
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, cr, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    hues.forEach((hue, i) => {
      const a0 = (i / hues.length) * Math.PI * 2;
      const g = ctx.createLinearGradient(
        Math.cos(a0) * cr,
        Math.sin(a0) * cr,
        -Math.cos(a0) * cr,
        -Math.sin(a0) * cr,
      );
      g.addColorStop(0, kit.hexA(hue, 0.22));
      g.addColorStop(0.5, kit.hexA(hue, 0.02));
      g.addColorStop(1, kit.hexA(hue, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-cr, -cr, cr * 2, cr * 2);
    });
    ctx.restore();
    // hub
    ctx.beginPath();
    ctx.arc(0, 0, cr * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(230,230,235,0.85)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, cr * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.strokeStyle = kit.hexA(p.text, 0.18);
    ctx.lineWidth = Math.max(1, cr * 0.01);
    ctx.stroke();
    kit.drawProgressRing(ctx, cx, cy, cr * 1.14, prog(r), p);

    if (vertical) {
      kit.drawHeader(ctx, r, h * 0.06, h * 0.034);
      kit.drawLyricRoll(ctx, r, {
        top: h * 0.47,
        bottom: h * 0.92,
        focusY: h * 0.68,
        size: h * 0.03,
        showRule: true,
      });
    } else {
      ctx.save();
      ctx.translate(w * 0.42, 0);
      const sub = { ...r, w: w * 0.56 };
      kit.drawHeader(ctx, sub, h * 0.16, h * 0.055);
      kit.drawLyricRoll(ctx, sub, {
        top: h * 0.3,
        bottom: h * 0.9,
        focusY: h * 0.6,
        size: h * 0.042,
        showRule: true,
      });
      ctx.restore();
    }
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const turntable: Engine = {
  id: "deck-turntable",
  name: "Deck · Turntable",
  desc: "Full turntable plinth anchored at the base with lyrics rising above it.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const deckH = h * (r.aspect === "9:16" ? 0.3 : 0.42);
    const deckY = h - deckH;
    const g = ctx.createLinearGradient(0, deckY, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0.05)");
    g.addColorStop(0.35, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(0, deckY, w, deckH);
    const vr = deckH * 0.62;
    const vx = w * 0.5;
    const vy = h - deckH * 0.06;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, deckY, w, deckH);
    ctx.clip();
    kit.drawVinyl(ctx, vx, vy, vr, t, r.coverImg, p);
    kit.drawProgressRing(ctx, vx, vy, vr * 1.08, prog(r), p);
    tonearm(ctx, kit, vx, vy, vr, prog(r), p);
    ctx.restore();
    kit.drawHeader(ctx, r, h * 0.075, h * (r.aspect === "9:16" ? 0.034 : 0.04));
    kit.drawLyricRoll(ctx, r, {
      top: h * 0.2,
      bottom: deckY - h * 0.01,
      focusY: deckY - deckH * 0.35,
      size: h * (r.aspect === "9:16" ? 0.034 : 0.044),
      showRule: true,
    });
  },
};

const npCard: Engine = {
  id: "np-glass",
  name: "Now Playing · Glass Card",
  desc: "Blurred artwork wash behind a frosted player card and a hero lyric.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    coverWash(ctx, kit, r, 0.7);
    const vertical = r.aspect === "9:16";
    const cardW = vertical ? w * 0.84 : w * 0.44;
    const cardH = vertical ? h * 0.3 : h * 0.36;
    const cx = vertical ? (w - cardW) / 2 : w * 0.07;
    const cy = vertical ? h * 0.1 : h * 0.14;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    kit.roundRect(ctx, cx, cy, cardW, cardH, cardH * 0.12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.stroke();
    ctx.restore();
    const art = cardH * 0.62;
    coverCard(ctx, kit, r, cx + cardH * 0.16, cy + cardH * 0.19, art, art * 0.1);
    metaBlock(
      ctx,
      kit,
      r,
      cx + cardH * 0.16 + art + cardH * 0.14,
      cy + cardH * 0.36,
      h * 0.026,
      cardW - art - cardH * 0.42,
    );
    eqBars(
      ctx,
      kit,
      cx + cardH * 0.16 + art + cardH * 0.14,
      cy + cardH * 0.58,
      cardW * 0.13,
      cardH * 0.12,
      t,
      p,
    );
    scrubber(ctx, kit, r, cx + cardH * 0.16, cy + cardH * 0.86, cardW - cardH * 0.32);
    if (vertical) {
      heroLyric(ctx, kit, r, h * 0.6, h * 0.05, { glow: false });
      kit.drawLyricRoll(ctx, r, {
        top: h * 0.44,
        bottom: h * 0.93,
        focusY: h * 0.7,
        size: h * 0.03,
      });
    } else {
      ctx.save();
      ctx.translate(w * 0.5, 0);
      const sub = { ...r, w: w * 0.48 };
      kit.drawLyricRoll(ctx, sub, {
        top: h * 0.12,
        bottom: h * 0.9,
        focusY: h * 0.52,
        size: h * 0.042,
      });
      ctx.restore();
    }
  },
};

const npWidget: Engine = {
  id: "np-widget",
  name: "Now Playing · Lock Screen",
  desc: "Lock-screen player widget pinned at the top with a tall lyric roll.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    coverWash(ctx, kit, r, 0.6);
    const padX = w * 0.08;
    const art = h * (r.aspect === "9:16" ? 0.075 : 0.12);
    const top = h * 0.07;
    coverCard(ctx, kit, r, padX, top, art, art * 0.16);
    metaBlock(
      ctx,
      kit,
      r,
      padX + art * 1.25,
      top + art * 0.38,
      h * (r.aspect === "9:16" ? 0.024 : 0.03),
      w - padX * 2 - art * 1.4,
    );
    eqBars(ctx, kit, w - padX - h * 0.03, top + art * 0.2, h * 0.03, h * 0.026, t, p, 4);
    scrubber(ctx, kit, r, padX, top + art * 1.16, w - padX * 2);
    kit.drawLyricRoll(ctx, r, {
      top: top + art * 1.6,
      bottom: h * 0.94,
      focusY: h * 0.58,
      size: h * (r.aspect === "9:16" ? 0.036 : 0.05),
      showRule: true,
    });
  },
};

const npWide: Engine = {
  id: "np-split",
  name: "Now Playing · Wide Split",
  desc: "Full-bleed artwork on one half, meta and lyrics on the other.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const artW = vertical ? w : w * 0.46;
    const artH = vertical ? h * 0.42 : h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, artW, artH);
    ctx.clip();
    if (r.coverImg?.naturalWidth) {
      const img = r.coverImg;
      const ratio =
        Math.max(artW / img.naturalWidth, artH / img.naturalHeight) *
        (1.04 + Math.sin(t * 0.25) * 0.02);
      const dw = img.naturalWidth * ratio;
      const dh = img.naturalHeight * ratio;
      ctx.drawImage(img, (artW - dw) / 2, (artH - dh) / 2, dw, dh);
    } else {
      const g = ctx.createLinearGradient(0, 0, artW, artH);
      g.addColorStop(0, p.primary);
      g.addColorStop(1, p.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, artW, artH);
    }
    const fade = vertical
      ? ctx.createLinearGradient(0, artH * 0.5, 0, artH)
      : ctx.createLinearGradient(artW * 0.55, 0, artW, 0);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, p.bg[0]);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, artW, artH);
    ctx.restore();

    const tx = vertical ? w * 0.08 : artW + w * 0.05;
    const ty = vertical ? h * 0.47 : h * 0.2;
    metaBlock(ctx, kit, r, tx, ty, h * (vertical ? 0.032 : 0.042), vertical ? w * 0.84 : w * 0.44);
    ctx.strokeStyle = kit.hexA(p.primary, 0.6);
    ctx.lineWidth = Math.max(1, h * 0.0015);
    ctx.beginPath();
    ctx.moveTo(tx, ty + h * 0.07);
    ctx.lineTo(tx + (vertical ? w * 0.3 : w * 0.16), ty + h * 0.07);
    ctx.stroke();

    if (vertical) {
      kit.drawLyricRoll(ctx, r, {
        top: h * 0.58,
        bottom: h * 0.93,
        focusY: h * 0.75,
        size: h * 0.032,
        showRule: true,
      });
      kit.drawFooterBar(ctx, r, h * 0.965);
    } else {
      ctx.save();
      ctx.translate(artW, 0);
      const sub = { ...r, w: w - artW };
      kit.drawLyricRoll(ctx, sub, {
        top: h * 0.32,
        bottom: h * 0.88,
        focusY: h * 0.6,
        size: h * 0.04,
        showRule: true,
      });
      ctx.restore();
      scrubber(ctx, kit, r, artW + w * 0.05, h * 0.92, w - artW - w * 0.1);
    }
  },
};

const npChip: Engine = {
  id: "np-chip",
  name: "Now Playing · Pill Chip",
  desc: "Tiny rounded now-playing pill so the lyrics get the whole canvas.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const art = h * 0.042;
    ctx.font = `700 ${Math.round(h * 0.019)}px ${kit.FONT}`;
    const label = `${r.title || "Untitled"} — ${r.artist || "Unknown artist"}`;
    const lw = Math.min(ctx.measureText(label).width, w * 0.6);
    const pillW = art * 1.6 + lw + h * 0.05;
    const pillX = (w - pillW) / 2;
    const pillY = h * 0.055;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    kit.roundRect(ctx, pillX, pillY, pillW, art * 1.5, art * 0.75);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    coverCard(ctx, kit, r, pillX + art * 0.25, pillY + art * 0.25, art, art * 0.28, false);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    ctx.fillText(label, pillX + art * 1.45, pillY + art * 0.75, w * 0.6);
    ctx.textAlign = "center";
    kit.drawLyricRoll(ctx, r, {
      top: h * 0.14,
      bottom: h * 0.93,
      focusY: h * 0.54,
      size: h * (r.aspect === "9:16" ? 0.04 : 0.055),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.96);
  },
};

const npMarquee: Engine = {
  id: "np-marquee",
  name: "Now Playing · Marquee",
  desc: "Artwork above a scrolling marquee band and a punched hero lyric.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    coverWash(ctx, kit, r, 0.5);
    const vertical = r.aspect === "9:16";
    const art = Math.min(w, h) * (vertical ? 0.46 : 0.34);
    coverCard(ctx, kit, r, (w - art) / 2, h * (vertical ? 0.09 : 0.08), art, art * 0.05);

    // marquee band
    const bandY = h * (vertical ? 0.09 : 0.08) + art + h * 0.035;
    const bandH = h * 0.05;
    ctx.fillStyle = kit.hexA(p.primary, 0.92);
    ctx.fillRect(0, bandY, w, bandH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, bandY, w, bandH);
    ctx.clip();
    ctx.fillStyle = "#0b0b0c";
    ctx.font = `900 ${Math.round(bandH * 0.5)}px ${COND}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const phrase = `${(r.title || "Untitled").toUpperCase()}   ★   ${(r.artist || "").toUpperCase()}   ★   `;
    const pw = Math.max(1, ctx.measureText(phrase).width);
    const shift = (t * w * 0.06) % pw;
    for (let x = -shift; x < w + pw; x += pw) ctx.fillText(phrase, x, bandY + bandH / 2);
    ctx.restore();
    ctx.textAlign = "center";

    heroLyric(ctx, kit, r, h * (vertical ? 0.76 : 0.78), h * (vertical ? 0.052 : 0.062), {
      uppercase: true,
      color: p.text,
    });
    scrubber(ctx, kit, r, w * 0.14, h * 0.93, w * 0.72);
  },
};

const npEq: Engine = {
  id: "np-equaliser",
  name: "Now Playing · Equaliser",
  desc: "Artwork sitting on a live spectrum with the lyric roll above it.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const art = Math.min(w, h) * (vertical ? 0.24 : 0.26);
    const ax = (w - art) / 2;
    const ay = h * (vertical ? 0.08 : 0.07);
    coverCard(ctx, kit, r, ax, ay, art, art * 0.08);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    kit.trackedFit(
      ctx,
      (r.title || "Untitled").toUpperCase(),
      w / 2,
      ay + art + h * 0.04,
      w * 0.7,
      800,
      h * 0.028,
      0.05,
    );
    ctx.fillStyle = kit.hexA(p.muted, 1);
    kit.trackedFit(
      ctx,
      (r.artist || "").toUpperCase(),
      w / 2,
      ay + art + h * 0.072,
      w * 0.6,
      500,
      h * 0.016,
      0.24,
    );
    kit.drawLyricRoll(ctx, r, {
      top: ay + art + h * 0.1,
      bottom: h * 0.87,
      focusY: h * (vertical ? 0.66 : 0.62),
      size: h * (vertical ? 0.032 : 0.042),
      showRule: true,
    });
    // spectrum floor
    const specH = h * 0.06;
    kit.drawWaveBar(ctx, w * 0.06, h * 0.925, w * 0.88, specH, prog(r), t, p, 3);
    scrubber(ctx, kit, r, w * 0.14, h * 0.965, w * 0.72);
  },
};

const npTicket: Engine = {
  id: "np-ticket",
  name: "Now Playing · Ticket Stub",
  desc: "Perforated ticket-stub card with a thumbnail, serial number and lyrics.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const cw = vertical ? w * 0.84 : w * 0.4;
    const ch = cw * 0.42;
    const cx = vertical ? (w - cw) / 2 : w * 0.07;
    const cy = h * (vertical ? 0.09 : 0.16);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = ch * 0.2;
    ctx.fillStyle = "#f4f1ea";
    kit.roundRect(ctx, cx, cy, cw, ch, ch * 0.08);
    ctx.fill();
    ctx.restore();
    // perforation
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.setLineDash([ch * 0.05, ch * 0.05]);
    ctx.lineWidth = Math.max(1, ch * 0.01);
    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.66, cy + ch * 0.08);
    ctx.lineTo(cx + cw * 0.66, cy + ch * 0.92);
    ctx.stroke();
    ctx.setLineDash([]);
    const art = ch * 0.7;
    coverCard(ctx, kit, r, cx + ch * 0.15, cy + ch * 0.15, art, art * 0.06, false);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#15151a";
    ctx.font = `900 ${Math.round(ch * 0.15)}px ${kit.FONT}`;
    ctx.fillText(r.title || "Untitled", cx + ch * 0.25 + art, cy + ch * 0.36, cw * 0.36);
    ctx.font = `500 ${Math.round(ch * 0.1)}px ${kit.FONT}`;
    ctx.fillStyle = "#5b5b63";
    ctx.fillText(
      (r.artist || "Unknown artist").toUpperCase(),
      cx + ch * 0.25 + art,
      cy + ch * 0.54,
      cw * 0.36,
    );
    ctx.save();
    ctx.translate(cx + cw * 0.83, cy + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a8a92";
    ctx.font = `600 ${Math.round(ch * 0.09)}px ${kit.FONT}`;
    kit.tracked(
      ctx,
      `NO. ${String(Math.floor(prog(r) * 999) + 1).padStart(3, "0")}`,
      0,
      0,
      ch * 0.03,
    );
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawLyricRoll(ctx, r, {
      top: cy + ch + h * 0.03,
      bottom: h * 0.92,
      focusY: h * (vertical ? 0.68 : 0.62),
      size: h * (vertical ? 0.032 : 0.042),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const npRadio: Engine = {
  id: "np-radio",
  name: "Now Playing · Radio Dial",
  desc: "Retro tuner dial with a sweeping needle driving the lyric column.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const dw = w * (vertical ? 0.84 : 0.5);
    const dh = h * (vertical ? 0.11 : 0.14);
    const dx = (w - dw) / 2;
    const dy = h * 0.08;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    kit.roundRect(ctx, dx, dy, dw, dh, dh * 0.16);
    ctx.fill();
    ctx.strokeStyle = kit.hexA(p.primary, 0.5);
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.stroke();
    // ticks
    const ticks = 40;
    for (let i = 0; i <= ticks; i++) {
      const x = dx + dh * 0.2 + ((dw - dh * 0.4) * i) / ticks;
      const major = i % 5 === 0;
      ctx.strokeStyle = kit.hexA(p.text, major ? 0.6 : 0.25);
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, dy + dh * (major ? 0.42 : 0.5));
      ctx.lineTo(x, dy + dh * 0.68);
      ctx.stroke();
    }
    const nx = dx + dh * 0.2 + (dw - dh * 0.4) * prog(r);
    ctx.save();
    ctx.shadowColor = kit.hexA(p.primary, 0.9);
    ctx.shadowBlur = dh * 0.3;
    ctx.strokeStyle = p.primary;
    ctx.lineWidth = Math.max(2, h * 0.003);
    ctx.beginPath();
    ctx.moveTo(nx, dy + dh * 0.28);
    ctx.lineTo(nx, dy + dh * 0.8);
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = kit.hexA(p.muted, 1);
    ctx.font = `600 ${Math.round(h * 0.013)}px ${kit.FONT}`;
    kit.tracked(ctx, "FM · ON AIR", w / 2, dy + dh * 0.2, h * 0.005);
    ctx.fillStyle = p.text;
    kit.trackedFit(
      ctx,
      (r.title || "Untitled").toUpperCase(),
      w / 2,
      dy + dh + h * 0.04,
      w * 0.7,
      800,
      h * 0.028,
      0.05,
    );
    ctx.fillStyle = kit.hexA(p.muted, 1);
    kit.trackedFit(
      ctx,
      (r.artist || "").toUpperCase(),
      w / 2,
      dy + dh + h * 0.072,
      w * 0.6,
      500,
      h * 0.016,
      0.24,
    );
    kit.drawLyricRoll(ctx, r, {
      top: dy + dh + h * 0.1,
      bottom: h * 0.92,
      focusY: h * (vertical ? 0.62 : 0.62),
      size: h * (vertical ? 0.034 : 0.044),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const npPoster: Engine = {
  id: "np-poster",
  name: "Now Playing · Tour Poster",
  desc: "Duotone artwork poster with condensed billing type and lower-third lyrics.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    if (r.coverImg?.naturalWidth) {
      const img = r.coverImg;
      ctx.save();
      ctx.globalAlpha = 0.55;
      const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.05;
      ctx.drawImage(
        img,
        (w - img.naturalWidth * ratio) / 2,
        (h - img.naturalHeight * ratio) / 2,
        img.naturalWidth * ratio,
        img.naturalHeight * ratio,
      );
      ctx.globalCompositeOperation = "color";
      ctx.fillStyle = p.primary;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, kit.hexA(p.bg[0], 0.85));
    shade.addColorStop(0.4, kit.hexA(p.bg[0], 0.35));
    shade.addColorStop(1, kit.hexA(p.bg[0], 0.95));
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.primary;
    ctx.font = `600 ${Math.round(h * 0.014)}px ${kit.FONT}`;
    kit.tracked(ctx, "LIVE SESSION · TRACK 01", w / 2, h * 0.08, h * 0.006);
    const words = (r.title || "Untitled").toUpperCase().split(" ");
    let ty = h * 0.16;
    for (const word of words.slice(0, 3)) {
      let s = h * (r.aspect === "9:16" ? 0.085 : 0.1);
      ctx.font = `900 ${Math.round(s)}px ${COND}`;
      while (ctx.measureText(word).width > w * 0.86 && s > 14) {
        s *= 0.93;
        ctx.font = `900 ${Math.round(s)}px ${COND}`;
      }
      ctx.fillStyle = p.text;
      ctx.fillText(word, w / 2, ty);
      ty += s * 0.92;
    }
    ctx.font = `500 ${Math.round(h * 0.018)}px ${kit.FONT}`;
    ctx.fillStyle = kit.hexA(p.accent, 0.95);
    kit.tracked(ctx, (r.artist || "").toUpperCase(), w / 2, ty + h * 0.015, h * 0.008);
    kit.drawLyricRoll(ctx, r, {
      top: Math.max(h * 0.45, ty + h * 0.06),
      bottom: h * 0.92,
      focusY: h * 0.74,
      size: h * (r.aspect === "9:16" ? 0.032 : 0.042),
      uppercase: true,
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const npAmbient: Engine = {
  id: "np-ambient",
  name: "Now Playing · Ambient Bloom",
  desc: "Artwork bloom behind an oversized, softly lit lyric — minimal and premium.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    coverWash(ctx, kit, r, 0.85);
    const art = Math.min(w, h) * (r.aspect === "9:16" ? 0.2 : 0.18);
    const pulse = 1 + Math.sin(t * 0.9) * 0.012;
    ctx.save();
    ctx.translate(w / 2, h * 0.18);
    ctx.scale(pulse, pulse);
    coverCard(ctx, kit, r, -art / 2, -art / 2, art, art * 0.5);
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    kit.trackedFit(
      ctx,
      r.title || "Untitled",
      w / 2,
      h * 0.18 + art * 0.75,
      w * 0.7,
      700,
      h * 0.026,
      0.02,
    );
    ctx.fillStyle = kit.hexA(p.muted, 1);
    kit.trackedFit(
      ctx,
      (r.artist || "").toUpperCase(),
      w / 2,
      h * 0.18 + art * 0.75 + h * 0.03,
      w * 0.6,
      500,
      h * 0.015,
      0.24,
    );
    heroLyric(ctx, kit, r, h * 0.58, h * (r.aspect === "9:16" ? 0.058 : 0.07), {
      weight: 300,
      glow: true,
    });
    scrubber(ctx, kit, r, w * 0.18, h * 0.9, w * 0.64);
  },
};

const npStudio: Engine = {
  id: "np-studio",
  name: "Now Playing · Studio Monitor",
  desc: "Console-style panel with level meters, take number and a steady lyric roll.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const px = w * 0.07;
    const panelY = h * 0.06;
    const panelH = h * (vertical ? 0.19 : 0.26);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    kit.roundRect(ctx, px, panelY, w - px * 2, panelH, h * 0.012);
    ctx.fill();
    ctx.strokeStyle = kit.hexA(p.primary, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    const art = panelH * 0.6;
    coverCard(ctx, kit, r, px + panelH * 0.2, panelY + panelH * 0.2, art, art * 0.08, false);
    metaBlock(
      ctx,
      kit,
      r,
      px + panelH * 0.2 + art * 1.2,
      panelY + panelH * 0.4,
      h * 0.024,
      w - px * 2 - art * 1.6,
    );
    // level meters
    const meterX = w - px - panelH * 0.75;
    for (let m = 0; m < 2; m++) {
      const my = panelY + panelH * (0.28 + m * 0.26);
      const mw = panelH * 0.55;
      const lvl = 0.35 + 0.6 * Math.abs(Math.sin(t * (2.6 + m) + m));
      ctx.fillStyle = kit.hexA(p.text, 0.14);
      kit.roundRect(ctx, meterX, my, mw, panelH * 0.07, panelH * 0.035);
      ctx.fill();
      ctx.fillStyle = lvl > 0.85 ? "#f87171" : p.primary;
      kit.roundRect(ctx, meterX, my, mw * lvl, panelH * 0.07, panelH * 0.035);
      ctx.fill();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(h * 0.013)}px ${kit.FONT}`;
    ctx.fillStyle = kit.hexA(p.muted, 1);
    ctx.fillText(
      `TAKE 01 · ${kit.fmtTime(r.t)} / ${kit.fmtTime(r.duration)}`,
      px + panelH * 0.2,
      panelY + panelH * 0.85,
    );
    ctx.textAlign = "center";
    kit.drawLyricRoll(ctx, r, {
      top: panelY + panelH + h * 0.03,
      bottom: h * 0.93,
      focusY: h * 0.6,
      size: h * (vertical ? 0.036 : 0.048),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.965);
  },
};

const npCassetteJ: Engine = {
  id: "np-jcard",
  name: "Now Playing · J-Card",
  desc: "Folded cassette J-card layout with a tracklist spine and lyric roll.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    const vertical = r.aspect === "9:16";
    const cardW = vertical ? w * 0.8 : w * 0.34;
    const cardH = cardW * 0.72;
    const cx = vertical ? (w - cardW) / 2 : w * 0.07;
    const cy = h * (vertical ? 0.08 : 0.16);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = cardH * 0.18;
    ctx.fillStyle = p.bg[1];
    kit.roundRect(ctx, cx, cy, cardW, cardH, cardH * 0.03);
    ctx.fill();
    ctx.restore();
    const art = cardH * 0.82;
    coverCard(ctx, kit, r, cx + cardH * 0.09, cy + cardH * 0.09, art, cardH * 0.02, false);
    // spine
    ctx.fillStyle = kit.hexA(p.primary, 0.9);
    ctx.fillRect(cx + cardW - cardH * 0.26, cy, cardH * 0.26, cardH);
    ctx.save();
    ctx.translate(cx + cardW - cardH * 0.13, cy + cardH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111";
    ctx.font = `800 ${Math.round(cardH * 0.1)}px ${kit.FONT}`;
    ctx.fillText(
      `${(r.title || "Untitled").toUpperCase()} · ${(r.artist || "").toUpperCase()}`,
      0,
      0,
      cardH * 0.9,
    );
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawLyricRoll(ctx, r, {
      top: cy + cardH + h * 0.03,
      bottom: h * 0.92,
      focusY: h * (vertical ? 0.68 : 0.6),
      size: h * (vertical ? 0.032 : 0.044),
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.955);
  },
};

const npSpotlight: Engine = {
  id: "np-spotlight",
  name: "Now Playing · Stage Spotlight",
  desc: "Stage-lit disc under a moving spotlight cone with lyrics in the beam.",
  draw: (ctx, r, kit) => {
    const { w, h, t, palette: p } = r;
    kit.drawBg(ctx, w, h, p, t);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, h);
    // beam
    const sway = Math.sin(t * 0.4) * w * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const beam = ctx.createLinearGradient(w / 2 + sway, 0, w / 2, h);
    beam.addColorStop(0, kit.hexA(p.accent, 0.3));
    beam.addColorStop(1, kit.hexA(p.primary, 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(w / 2 + sway - w * 0.04, 0);
    ctx.lineTo(w / 2 + sway + w * 0.04, 0);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.1, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const vr = Math.min(w, h) * (r.aspect === "9:16" ? 0.19 : 0.2);
    kit.drawVinyl(ctx, w / 2, h * (r.aspect === "9:16" ? 0.24 : 0.3), vr, t, r.coverImg, p);
    kit.drawProgressRing(ctx, w / 2, h * (r.aspect === "9:16" ? 0.24 : 0.3), vr * 1.14, prog(r), p);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    kit.trackedFit(
      ctx,
      (r.title || "Untitled").toUpperCase(),
      w / 2,
      h * (r.aspect === "9:16" ? 0.38 : 0.48),
      w * 0.7,
      800,
      h * 0.03,
      0.05,
    );
    ctx.fillStyle = kit.hexA(p.muted, 1);
    kit.trackedFit(
      ctx,
      (r.artist || "").toUpperCase(),
      w / 2,
      h * (r.aspect === "9:16" ? 0.415 : 0.52),
      w * 0.6,
      500,
      h * 0.016,
      0.24,
    );
    kit.drawLyricRoll(ctx, r, {
      top: h * (r.aspect === "9:16" ? 0.46 : 0.56),
      bottom: h * 0.92,
      focusY: h * (r.aspect === "9:16" ? 0.7 : 0.76),
      size: h * (r.aspect === "9:16" ? 0.034 : 0.038),
      glow: true,
      showRule: true,
    });
    kit.drawFooterBar(ctx, r, h * 0.96);
  },
};

export const EXTRA_LYRIC_ENGINES: Engine[] = [
  vinylTonearm,
  vinyl45,
  vinylSleeve,
  vinylHalo,
  vinylMini,
  vinylNeon,
  vinylEditorial,
  vinylTwin,
  cassette,
  cdPlayer,
  turntable,
  npCard,
  npWidget,
  npWide,
  npChip,
  npMarquee,
  npEq,
  npTicket,
  npRadio,
  npPoster,
  npAmbient,
  npStudio,
  npCassetteJ,
  npSpotlight,
];

export const EXTRA_LYRIC_MAP = new Map(EXTRA_LYRIC_ENGINES.map((e) => [e.id, e]));
