/**
 * Extra motivational-quote engines.
 *
 * The backdrop is painted by the route before these run, and the whole text
 * layer is already transformed for the user's size/position settings — so each
 * engine only draws type and framing furniture.
 */

export type TranscriptWord = { text: string; start: number; end: number };
export type TimedLine = { time: number; end: number; text: string; words: TranscriptWord[] };

export type Palette = {
  id: string;
  name: string;
  bg: [string, string];
  primary: string;
  accent: string;
  text: string;
  dim: string;
};

export type RenderCtx = {
  t: number;
  w: number;
  h: number;
  aspect: "9:16" | "16:9" | "1:1";
  palette: Palette;
  lines: TimedLine[];
  duration: number;
  author: string;
  dim: number;
  // The route owns the backdrop; engines never read it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backdrop: any;
};

type C = CanvasRenderingContext2D;

export type Kit = {
  FONT: string;
  SERIF: string;
  MONO: string;
  COND: string;
  hexA: (hex: string, a: number) => string;
  easeOutCubic: (x: number) => number;
  wrapText: (ctx: C, text: string, maxWidth: number) => string[];
  roundRect: (ctx: C, x: number, y: number, w: number, h: number, r: number) => void;
  fitFont: (ctx: C, text: string, maxW: number, start: number, spec: string) => number;
  activeLine: (lines: TimedLine[], t: number) => { line?: TimedLine; index: number };
  activeWord: (line: TimedLine | undefined, t: number) => TranscriptWord | undefined;
  drawAuthor: (ctx: C, r: RenderCtx, y: number) => void;
};

type Engine = {
  id: string;
  name: string;
  desc: string;
  draw: (ctx: C, r: RenderCtx, kit: Kit) => void;
};

// -------------------- shared bits --------------------

function state(kit: Kit, r: RenderCtx) {
  const { line, index } = kit.activeLine(r.lines, r.t);
  const span = line ? Math.max(0.4, line.end - line.time) : 1;
  const frac = line ? Math.max(0, Math.min(1, (r.t - line.time) / span)) : 0;
  const appear = line ? kit.easeOutCubic(Math.min(1, (r.t - line.time) / 0.32)) : 0;
  return { line, index, frac, appear };
}

/** Fit a block of text to a box and return the rows plus final size. */
function layout(
  ctx: C,
  kit: Kit,
  text: string,
  maxW: number,
  maxH: number,
  start: number,
  spec: string,
  lineH = 1.18,
) {
  let size = Math.round(start);
  for (let i = 0; i < 40; i++) {
    ctx.font = spec.replace("{s}", String(size));
    const rows = kit.wrapText(ctx, text, maxW);
    if (
      (rows.length * size * lineH <= maxH && rows.every((x) => ctx.measureText(x).width <= maxW)) ||
      size <= 14
    ) {
      return { rows, size };
    }
    size = Math.max(14, Math.round(size * 0.93));
  }
  return { rows: kit.wrapText(ctx, text, maxW), size };
}

function drawRows(
  ctx: C,
  rows: string[],
  cx: number,
  centreY: number,
  size: number,
  lineH: number,
  color: string | CanvasGradient,
  drift = 0,
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  let y = centreY - ((rows.length - 1) * size * lineH) / 2 + drift;
  for (const row of rows) {
    ctx.fillText(row, cx, y);
    y += size * lineH;
  }
  return y - size * lineH;
}

function softShadow(ctx: C, blur: number) {
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = blur * 0.12;
}

function baseSize(r: RenderCtx, vertical: number, wide: number) {
  return Math.round(r.h * (r.aspect === "16:9" ? wide : vertical));
}

// -------------------- engines --------------------

const cinemaSlate: Engine = {
  id: "cinema-slate",
  name: "Cinema Slate",
  desc: "Letterboxed film frame with an editorial serif quote and timecode ticks.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const bar = h * 0.11;
    ctx.fillStyle = "rgba(0,0,0,0.92)";
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
    ctx.fillStyle = kit.hexA(p.primary, 0.85);
    ctx.fillRect(0, bar, w, Math.max(1, h * 0.0012));
    ctx.fillRect(0, h - bar - Math.max(1, h * 0.0012), w, Math.max(1, h * 0.0012));
    const { line, appear } = state(kit, r);
    if (line) {
      const { rows, size } = layout(
        ctx,
        kit,
        `“${line.text}”`,
        w * 0.76,
        h * 0.4,
        baseSize(r, 0.05, 0.062),
        `400 italic {s}px ${kit.SERIF}`,
        1.3,
      );
      ctx.save();
      ctx.globalAlpha = appear;
      softShadow(ctx, size * 0.4);
      const end = drawRows(ctx, rows, w / 2, h * 0.48, size, 1.3, p.text, (1 - appear) * size * 0.22);
      ctx.restore();
      kit.drawAuthor(ctx, r, end + size * 0.95);
    }
    // slate ticks
    ctx.fillStyle = kit.hexA(p.text, 0.5);
    ctx.font = `600 ${Math.round(h * 0.015)}px ${kit.MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`REC ${r.t.toFixed(2)}s`, w * 0.05, bar / 2);
    ctx.textAlign = "right";
    ctx.fillText("SCENE 01 / TAKE 01", w * 0.95, bar / 2);
    ctx.textAlign = "center";
  },
};

const impactFrame: Engine = {
  id: "impact-frame",
  name: "Impact Frame",
  desc: "Double hairline frame with corner ticks and a heavy condensed statement.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const inset = Math.min(w, h) * 0.07;
    ctx.strokeStyle = kit.hexA(p.primary, 0.75);
    ctx.lineWidth = Math.max(1.5, h * 0.002);
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    ctx.strokeStyle = kit.hexA(p.text, 0.25);
    ctx.lineWidth = Math.max(1, h * 0.001);
    ctx.strokeRect(inset * 1.35, inset * 1.35, w - inset * 2.7, h - inset * 2.7);
    const tick = inset * 0.5;
    ctx.strokeStyle = p.primary;
    ctx.lineWidth = Math.max(2, h * 0.0035);
    [
      [inset, inset, 1, 1],
      [w - inset, inset, -1, 1],
      [inset, h - inset, 1, -1],
      [w - inset, h - inset, -1, -1],
    ].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * tick);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * tick, y);
      ctx.stroke();
    });
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.72,
      h * 0.42,
      baseSize(r, 0.085, 0.105),
      `900 {s}px ${kit.COND}`,
      1.02,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.25);
    const end = drawRows(ctx, rows, w / 2, h * 0.49, size, 1.02, p.text, (1 - appear) * size * 0.22);
    ctx.restore();
    ctx.fillStyle = p.primary;
    ctx.fillRect(w / 2 - w * 0.05, end + size * 0.55, w * 0.1, Math.max(3, h * 0.0045));
    kit.drawAuthor(ctx, r, end + size * 0.95);
  },
};

const glassCard: Engine = {
  id: "glass-card",
  name: "Glass Card",
  desc: "Frosted card with an accent spine — clean, modern, endlessly readable.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      w * 0.66,
      h * 0.34,
      baseSize(r, 0.045, 0.056),
      `600 {s}px ${kit.FONT}`,
      1.28,
    );
    const boxH = rows.length * size * 1.28 + size * 1.6;
    const boxW = w * 0.78;
    const x = (w - boxW) / 2;
    const y = h * 0.5 - boxH / 2;
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    kit.roundRect(ctx, x, y, boxW, boxH, size * 0.5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.stroke();
    ctx.fillStyle = p.primary;
    kit.roundRect(ctx, x, y + boxH * 0.2, Math.max(4, w * 0.006), boxH * 0.6, w * 0.003);
    ctx.fill();
    drawRows(ctx, rows, w / 2, y + boxH / 2, size, 1.28, p.text, (1 - appear) * size * 0.18);
    ctx.restore();
    kit.drawAuthor(ctx, r, y + boxH + size * 0.9);
  },
};

const sunriseWash: Engine = {
  id: "sunrise",
  name: "Sunrise Wash",
  desc: "Warm horizon glow with the quote rising line by line out of the light.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const g = ctx.createLinearGradient(0, h, 0, h * 0.35);
    g.addColorStop(0, kit.hexA(p.primary, 0.45));
    g.addColorStop(0.5, kit.hexA(p.accent, 0.12));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      w * 0.78,
      h * 0.36,
      baseSize(r, 0.055, 0.07),
      `300 {s}px ${kit.FONT}`,
      1.24,
    );
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    softShadow(ctx, size * 0.35);
    let y = h * 0.52 - ((rows.length - 1) * size * 1.24) / 2;
    rows.forEach((row, i) => {
      const a = Math.max(0, Math.min(1, appear * 1.4 - i * 0.25));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.text;
      ctx.fillText(row, w / 2, y + (1 - a) * size * 0.5);
      y += size * 1.24;
    });
    ctx.restore();
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

const minimalRule: Engine = {
  id: "minimal-rule",
  name: "Minimal Rule",
  desc: "Small-caps label above a hairline rule and a light, airy quote.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, appear } = state(kit, r);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = kit.hexA(p.primary, 0.95);
    ctx.font = `700 ${Math.round(h * 0.016)}px ${kit.FONT}`;
    ctx.fillText("D A I L Y   R E M I N D E R", w / 2, h * 0.36);
    ctx.strokeStyle = kit.hexA(p.text, 0.3);
    ctx.lineWidth = Math.max(1, h * 0.001);
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.395);
    ctx.lineTo(w * 0.68, h * 0.395);
    ctx.stroke();
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      w * 0.7,
      h * 0.3,
      baseSize(r, 0.05, 0.06),
      `200 {s}px ${kit.FONT}`,
      1.3,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    const end = drawRows(ctx, rows, w / 2, h * 0.54, size, 1.3, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    kit.drawAuthor(ctx, r, end + size * 1.1);
  },
};

const boldLeft: Engine = {
  id: "bold-left",
  name: "Bold Left Block",
  desc: "Numbered left-aligned block of heavy caps with an accent spine.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, index, appear } = state(kit, r);
    if (!line) return;
    const x = w * 0.12;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.76,
      h * 0.42,
      baseSize(r, 0.062, 0.078),
      `900 {s}px ${kit.FONT}`,
      1.08,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(h * 0.018)}px ${kit.MONO}`;
    ctx.fillStyle = p.primary;
    ctx.fillText(
      String(index + 1).padStart(2, "0"),
      x,
      h * 0.5 - (rows.length * size * 1.08) / 2 - h * 0.04,
    );
    let y = h * 0.5 - ((rows.length - 1) * size * 1.08) / 2;
    ctx.font = `900 ${size}px ${kit.FONT}`;
    softShadow(ctx, size * 0.22);
    for (const row of rows) {
      ctx.fillStyle = p.text;
      ctx.fillText(row, x + (1 - appear) * w * 0.02, y);
      y += size * 1.08;
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.primary;
    ctx.fillRect(
      x - w * 0.045,
      h * 0.5 - (rows.length * size * 1.08) / 2,
      Math.max(4, w * 0.008),
      rows.length * size * 1.08,
    );
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawAuthor(ctx, r, y + size * 0.3);
  },
};

const focusWord: Engine = {
  id: "focus-word",
  name: "Focus Word",
  desc: "Whole line stays visible while the spoken word lights up in the accent.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line } = state(kit, r);
    if (!line) return;
    const cur = kit.activeWord(line, r.t);
    const size = baseSize(r, 0.055, 0.068);
    ctx.font = `800 ${size}px ${kit.FONT}`;
    ctx.textBaseline = "middle";
    const words = line.words.length
      ? line.words
      : line.text.split(" ").map((tx) => ({ text: tx, start: line.time, end: line.end }));
    const rows: TranscriptWord[][] = [];
    let row: TranscriptWord[] = [];
    for (const word of words) {
      const test = [...row, word].map((x) => x.text).join(" ");
      if (ctx.measureText(test).width > w * 0.8 && row.length) {
        rows.push(row);
        row = [word];
      } else row.push(word);
    }
    if (row.length) rows.push(row);
    let y = h * 0.5 - ((rows.length - 1) * size * 1.22) / 2;
    for (const rw of rows) {
      const widths = rw.map((x) => ctx.measureText(x.text + " ").width);
      const total = widths.reduce((a, b) => a + b, 0);
      let x = w / 2 - total / 2;
      ctx.textAlign = "left";
      rw.forEach((word, i) => {
        const isCur = cur && word.start === cur.start && word.text === cur.text;
        const spoken = r.t >= word.start;
        ctx.save();
        if (isCur) {
          const pop = 1 + kit.easeOutCubic(Math.min(1, (r.t - word.start) / 0.16)) * 0.06;
          ctx.translate(x + widths[i] / 2, y);
          ctx.scale(pop, pop);
          ctx.translate(-(x + widths[i] / 2), -y);
          ctx.shadowColor = kit.hexA(p.primary, 0.9);
          ctx.shadowBlur = size * 0.45;
          ctx.fillStyle = p.primary;
        } else {
          ctx.fillStyle = spoken ? p.text : kit.hexA(p.text, 0.32);
        }
        ctx.fillText(word.text, x, y);
        ctx.restore();
        x += widths[i];
      });
      ctx.textAlign = "center";
      y += size * 1.22;
    }
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

const chapterCount: Engine = {
  id: "chapter-count",
  name: "Chapter Counter",
  desc: "Oversized chapter numeral behind the quote with a progress rail.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, index, appear } = state(kit, r);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.12;
    ctx.font = `900 ${Math.round(h * 0.38)}px ${kit.COND}`;
    ctx.fillStyle = p.primary;
    ctx.fillText(String(Math.max(1, index + 1)).padStart(2, "0"), w / 2, h * 0.48);
    ctx.restore();
    if (line) {
      const { rows, size } = layout(
        ctx,
        kit,
        line.text,
        w * 0.74,
        h * 0.34,
        baseSize(r, 0.05, 0.062),
        `700 {s}px ${kit.FONT}`,
        1.22,
      );
      ctx.save();
      ctx.globalAlpha = appear;
      softShadow(ctx, size * 0.35);
      const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.22, p.text, (1 - appear) * size * 0.2);
      ctx.restore();
      kit.drawAuthor(ctx, r, end + size * 1.1);
    }
    const prog = r.duration > 0 ? Math.min(1, r.t / r.duration) : 0;
    ctx.fillStyle = kit.hexA(p.text, 0.16);
    ctx.fillRect(w * 0.12, h * 0.9, w * 0.76, Math.max(2, h * 0.0028));
    ctx.fillStyle = p.primary;
    ctx.fillRect(w * 0.12, h * 0.9, w * 0.76 * prog, Math.max(2, h * 0.0028));
  },
};

const ribbon: Engine = {
  id: "ribbon",
  name: "Accent Ribbon",
  desc: "Each line sits on its own angled accent ribbon that snaps into place.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.62,
      h * 0.36,
      baseSize(r, 0.055, 0.07),
      `900 {s}px ${kit.FONT}`,
      1.34,
    );
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${size}px ${kit.FONT}`;
    let y = h * 0.5 - ((rows.length - 1) * size * 1.34) / 2;
    rows.forEach((row, i) => {
      const a = Math.max(0, Math.min(1, appear * 1.5 - i * 0.2));
      const tw = ctx.measureText(row).width;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y);
      ctx.rotate((i % 2 ? -1 : 1) * 0.018);
      ctx.fillStyle = i % 2 ? p.text : p.primary;
      kit.roundRect(
        ctx,
        -tw / 2 - size * 0.4,
        -size * 0.66,
        tw + size * 0.8,
        size * 1.32,
        size * 0.1,
      );
      ctx.fill();
      ctx.fillStyle = i % 2 ? p.bg[0] : "#0b0b0c";
      ctx.fillText(row, 0, 0);
      ctx.restore();
      y += size * 1.34;
    });
    ctx.restore();
    kit.drawAuthor(ctx, r, y + size * 0.3);
  },
};

const splitPanel: Engine = {
  id: "split-panel",
  name: "Split Panel",
  desc: "Solid accent panel on one side with the quote set against it.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const vertical = r.aspect !== "16:9";
    const { line, appear } = state(kit, r);
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = p.bg[0];
    if (vertical) ctx.fillRect(0, h * 0.34, w, h * 0.42);
    else ctx.fillRect(0, 0, w * 0.52, h);
    ctx.restore();
    ctx.fillStyle = p.primary;
    if (vertical) ctx.fillRect(0, h * 0.34, w, Math.max(3, h * 0.004));
    else ctx.fillRect(w * 0.52 - Math.max(3, w * 0.003), 0, Math.max(3, w * 0.003), h);
    if (!line) return;
    const boxW = vertical ? w * 0.8 : w * 0.4;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      boxW,
      vertical ? h * 0.3 : h * 0.5,
      baseSize(r, 0.048, 0.06),
      `800 {s}px ${kit.FONT}`,
      1.22,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    const x = vertical ? w * 0.1 : w * 0.06;
    let y = (vertical ? h * 0.55 : h * 0.5) - ((rows.length - 1) * size * 1.22) / 2;
    for (const row of rows) {
      ctx.fillText(row, x, y);
      y += size * 1.22;
    }
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawAuthor(ctx, r, y + size * 0.4);
  },
};

const typedCaret: Engine = {
  id: "typed-caret",
  name: "Typed Caret",
  desc: "Mono type revealed character by character with a blinking caret.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, frac } = state(kit, r);
    if (!line) return;
    const shown = line.text.slice(0, Math.ceil(line.text.length * Math.min(1, frac * 1.35)));
    const { rows, size } = layout(
      ctx,
      kit,
      shown || " ",
      w * 0.72,
      h * 0.36,
      baseSize(r, 0.034, 0.042),
      `500 {s}px ${kit.MONO}`,
      1.5,
    );
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const x = w * 0.14;
    let y = h * 0.5 - ((rows.length - 1) * size * 1.5) / 2;
    ctx.fillStyle = p.primary;
    ctx.fillText("> ", x - size * 1.1, y);
    for (const row of rows) {
      ctx.fillStyle = p.text;
      ctx.fillText(row, x, y);
      y += size * 1.5;
    }
    const lastRow = rows[rows.length - 1] ?? "";
    if (Math.floor(r.t * 2) % 2 === 0) {
      ctx.fillStyle = p.primary;
      ctx.fillRect(
        x + ctx.measureText(lastRow).width + size * 0.12,
        y - size * 1.5 - size * 0.42,
        size * 0.5,
        size * 0.82,
      );
    }
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawAuthor(ctx, r, y + size * 0.3);
  },
};

const echoLayers: Engine = {
  id: "echo",
  name: "Echo Layers",
  desc: "Ghosted repeats fan out behind the live line for depth and motion.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.8,
      h * 0.34,
      baseSize(r, 0.062, 0.078),
      `900 {s}px ${kit.FONT}`,
      1.1,
    );
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${size}px ${kit.FONT}`;
    for (let k = 3; k >= 1; k--) {
      ctx.globalAlpha = appear * 0.1 * k * 0.5;
      ctx.fillStyle = p.primary;
      let y = h * 0.5 - ((rows.length - 1) * size * 1.1) / 2 + k * size * 0.09;
      for (const row of rows) {
        ctx.fillText(row, w / 2 + k * size * 0.07, y);
        y += size * 1.1;
      }
    }
    ctx.globalAlpha = appear;
    const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.1, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    kit.drawAuthor(ctx, r, end + size * 0.9);
  },
};

const neonSign: Engine = {
  id: "neon-sign",
  name: "Neon Sign",
  desc: "Tube-lit outline caps with a warm flicker and reflected glow.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.78,
      h * 0.34,
      baseSize(r, 0.06, 0.075),
      `800 {s}px ${kit.FONT}`,
      1.24,
    );
    const flicker = 0.88 + Math.abs(Math.sin(r.t * 17)) * 0.12;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${size}px ${kit.FONT}`;
    ctx.globalAlpha = appear;
    ctx.lineJoin = "round";
    let y = h * 0.5 - ((rows.length - 1) * size * 1.24) / 2;
    for (const row of rows) {
      ctx.shadowColor = kit.hexA(p.primary, 0.95 * flicker);
      ctx.shadowBlur = size * 0.85;
      ctx.strokeStyle = kit.hexA(p.primary, 0.95);
      ctx.lineWidth = Math.max(2, size * 0.05);
      ctx.strokeText(row, w / 2, y);
      ctx.shadowBlur = size * 0.3;
      ctx.fillStyle = kit.hexA(p.accent, 0.96);
      ctx.fillText(row, w / 2, y);
      y += size * 1.24;
    }
    ctx.restore();
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

const filmGrain: Engine = {
  id: "film-grain",
  name: "Film Grain",
  desc: "Analogue grain and scanline sweep under a low-set serif quote.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    ctx.save();
    ctx.globalAlpha = 0.06;
    const step = Math.max(6, Math.round(h / 220));
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 420; i++) {
      const n = (i * 9301 + Math.floor(r.t * 60) * 49297) % 233280;
      const x = (n / 233280) * w;
      const y = (((n * 7 + i * 131) % 233280) / 233280) * h;
      ctx.fillRect(x, y, step * 0.5, step * 0.5);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = p.accent;
    const sweep = ((r.t * 0.25) % 1) * h;
    ctx.fillRect(0, sweep, w, h * 0.06);
    ctx.restore();
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      w * 0.74,
      h * 0.3,
      baseSize(r, 0.046, 0.058),
      `400 {s}px ${kit.SERIF}`,
      1.3,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.5);
    const end = drawRows(ctx, rows, w / 2, h * 0.68, size, 1.3, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    kit.drawAuthor(ctx, r, end + size * 1.1);
  },
};

const tickerRail: Engine = {
  id: "ticker-rail",
  name: "Ticker Rail",
  desc: "Segmented progress ticks at the top and a plated attribution at the base.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const segs = Math.max(6, Math.min(24, r.lines.length || 12));
    const prog = r.duration > 0 ? Math.min(1, r.t / r.duration) : 0;
    const railW = w * 0.8;
    const gap = railW * 0.012;
    const segW = (railW - gap * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i / segs < prog ? p.primary : kit.hexA(p.text, 0.16);
      kit.roundRect(
        ctx,
        w * 0.1 + i * (segW + gap),
        h * 0.1,
        segW,
        Math.max(3, h * 0.005),
        h * 0.0025,
      );
      ctx.fill();
    }
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.8,
      h * 0.36,
      baseSize(r, 0.066, 0.082),
      `900 {s}px ${kit.FONT}`,
      1.1,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.3);
    drawRows(ctx, rows, w / 2, h * 0.48, size, 1.1, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    if (r.author) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(h * 0.02)}px ${kit.FONT}`;
      const label = r.author.toUpperCase();
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = p.primary;
      kit.roundRect(ctx, w / 2 - tw / 2 - h * 0.02, h * 0.86, tw + h * 0.04, h * 0.042, h * 0.021);
      ctx.fill();
      ctx.fillStyle = "#0b0b0c";
      ctx.fillText(label, w / 2, h * 0.881);
      ctx.restore();
    }
  },
};

const marqueeBand: Engine = {
  id: "marquee-band",
  name: "Marquee Band",
  desc: "Scrolling accent band under a punchy centred statement.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    const { line, appear } = state(kit, r);
    if (line) {
      const { rows, size } = layout(
        ctx,
        kit,
        line.text.toUpperCase(),
        w * 0.8,
        h * 0.34,
        baseSize(r, 0.07, 0.086),
        `900 {s}px ${kit.COND}`,
        1.05,
      );
      ctx.save();
      ctx.globalAlpha = appear;
      softShadow(ctx, size * 0.25);
      drawRows(ctx, rows, w / 2, h * 0.44, size, 1.05, p.text, (1 - appear) * size * 0.2);
      ctx.restore();
    }
    const bandY = h * 0.76;
    const bandH = h * 0.055;
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, bandY, w, bandH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, bandY, w, bandH);
    ctx.clip();
    ctx.fillStyle = "#0b0b0c";
    ctx.font = `900 ${Math.round(bandH * 0.5)}px ${kit.COND}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const phrase = `${(r.author || "KEEP GOING").toUpperCase()}   ◆   `;
    const pw = Math.max(1, ctx.measureText(phrase).width);
    const shift = (r.t * w * 0.07) % pw;
    for (let x = -shift; x < w + pw; x += pw) ctx.fillText(phrase, x, bandY + bandH / 2);
    ctx.restore();
    ctx.textAlign = "center";
  },
};

export const EXTRA_MOTIVATIONAL_ENGINES: Engine[] = [
  cinemaSlate,
  impactFrame,
  glassCard,
  sunriseWash,
  minimalRule,
  boldLeft,
  focusWord,
  chapterCount,
  ribbon,
  splitPanel,
  typedCaret,
  echoLayers,
  neonSign,
  filmGrain,
  tickerRail,
  marqueeBand,
];

export const EXTRA_MOTIVATIONAL_MAP = new Map(EXTRA_MOTIVATIONAL_ENGINES.map((e) => [e.id, e]));


// -------------------- grit poster --------------------

const gritPoster: Engine = {
  id: "grit-poster",
  name: "Grit Poster",
  desc: "Near-black textured poster with HUD ticks, corner brackets and a tracked progress rail.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    // textured near-black wash + vignette
    ctx.save();
    ctx.fillStyle = "#050505";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 260; i++) {
      const n = (i * 7919 + Math.floor(r.t * 8) * 5171) % 100000;
      const x = (n / 100000) * w;
      const y = (((n * 13 + i * 97) % 100000) / 100000) * h;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.68)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // corner brackets (HUD chrome)
    const inset = Math.min(w, h) * 0.06;
    const tick = inset * 0.55;
    ctx.strokeStyle = kit.hexA(p.primary, 0.85);
    ctx.lineWidth = Math.max(2, h * 0.0032);
    [
      [inset, inset, 1, 1],
      [w - inset, inset, -1, 1],
      [inset, h - inset, 1, -1],
      [w - inset, h - inset, -1, -1],
    ].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * tick);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * tick, y);
      ctx.stroke();
    });

    // vertical tick scales, left + right, with subtle drift
    const drift = Math.sin(r.t * 0.6) * h * 0.004;
    ctx.font = `600 ${Math.round(h * 0.012)}px ${kit.MONO}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = kit.hexA(p.text, 0.4);
    for (let i = 0; i <= 8; i++) {
      const y = inset * 1.6 + (i * (h - inset * 3.2)) / 8 + drift;
      ctx.strokeStyle = kit.hexA(p.text, 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(inset * 0.55, y);
      ctx.lineTo(inset * 0.85, y);
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillText(String(i * 12).padStart(2, "0"), inset * 0.9, y);
      ctx.beginPath();
      ctx.moveTo(w - inset * 0.85, y);
      ctx.lineTo(w - inset * 0.55, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(String(100 - i * 12).padStart(2, "0"), w - inset * 0.9, y);
    }
    ctx.textAlign = "center";

    // bordered tag box
    ctx.save();
    ctx.font = `700 ${Math.round(h * 0.015)}px ${kit.MONO}`;
    const tag = "MOTIVATIONAL // NO.01";
    const tw = ctx.measureText(tag).width;
    ctx.strokeStyle = kit.hexA(p.primary, 0.8);
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.strokeRect(w / 2 - tw / 2 - h * 0.018, h * 0.18, tw + h * 0.036, h * 0.036);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = kit.hexA(p.text, 0.85);
    ctx.fillText(tag, w / 2, h * 0.198);
    ctx.restore();

    const { line, index, appear } = state(kit, r);
    if (line) {
      const words = line.text.toUpperCase().split(" ").filter(Boolean);
      const accentIdx = Math.min(words.length - 1, Math.max(0, Math.floor(words.length / 2)));
      const { rows, size } = layout(
        ctx,
        kit,
        words.join(" "),
        w * 0.78,
        h * 0.4,
        baseSize(r, 0.078, 0.096),
        `900 {s}px ${kit.COND}`,
        1.02,
      );
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.font = `900 ${size}px ${kit.COND}`;
      softShadow(ctx, size * 0.3);
      let y = h * 0.5 - ((rows.length - 1) * size * 1.02) / 2 + (1 - appear) * size * 0.25;
      let wordCount = 0;
      for (const row of rows) {
        const rowWords = row.split(" ");
        const widths = rowWords.map((wd) => ctx.measureText(wd + " ").width);
        const total = widths.reduce((a, b) => a + b, 0);
        let x = w / 2 - total / 2;
        ctx.textAlign = "left";
        rowWords.forEach((wd, i) => {
          ctx.fillStyle = wordCount === accentIdx ? p.primary : p.text;
          ctx.fillText(wd, x, y);
          x += widths[i];
          wordCount++;
        });
        ctx.textAlign = "center";
        y += size * 1.02;
      }
      ctx.restore();

      // thin rule with X marker
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.strokeStyle = kit.hexA(p.text, 0.4);
      ctx.lineWidth = Math.max(1, h * 0.0012);
      ctx.beginPath();
      ctx.moveTo(w * 0.3, y + size * 0.28);
      ctx.lineTo(w / 2 - h * 0.02, y + size * 0.28);
      ctx.moveTo(w / 2 + h * 0.02, y + size * 0.28);
      ctx.lineTo(w * 0.7, y + size * 0.28);
      ctx.stroke();
      ctx.font = `700 ${Math.round(h * 0.02)}px ${kit.MONO}`;
      ctx.fillStyle = p.primary;
      ctx.fillText("×", w / 2, y + size * 0.28);
      ctx.restore();

      // letter-spaced subline
      const sub = (r.author || `CHAPTER ${String(index + 1).padStart(2, "0")}`)
        .toUpperCase()
        .split("")
        .join(" ");
      ctx.save();
      ctx.globalAlpha = appear * 0.75;
      ctx.font = `600 ${Math.round(h * 0.017)}px ${kit.FONT}`;
      ctx.fillStyle = kit.hexA(p.text, 0.75);
      ctx.fillText(sub, w / 2, y + size * 0.55);
      ctx.restore();
    }

    // bottom labelled progress bar tracking video time
    const prog = r.duration > 0 ? Math.min(1, r.t / r.duration) : 0;
    const barY = h * 0.92;
    const barW = w * 0.78;
    ctx.font = `600 ${Math.round(h * 0.013)}px ${kit.MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = kit.hexA(p.text, 0.55);
    ctx.fillText("PROGRESS", w / 2 - barW / 2, barY - h * 0.012);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(prog * 100)}%`, w / 2 + barW / 2, barY - h * 0.012);
    ctx.fillStyle = kit.hexA(p.text, 0.18);
    ctx.fillRect(w / 2 - barW / 2, barY, barW, Math.max(2, h * 0.0026));
    ctx.fillStyle = p.primary;
    ctx.fillRect(w / 2 - barW / 2, barY, barW * prog, Math.max(2, h * 0.0026));
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
  },
};

// -------------------- neon stack --------------------

const neonStack: Engine = {
  id: "neon-stack",
  name: "Neon Stack",
  desc: "Stacked type on black: a whisper word, a flanked accent word, and a glowing headline.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const { line, appear } = state(kit, r);
    if (!line) return;
    const words = line.text.toUpperCase().split(" ").filter(Boolean);
    const top = words[0] ?? "";
    const mid = words[1] ?? words[0] ?? "";
    const glow = words.length > 2 ? words.slice(2).join(" ") : words[words.length - 1] ?? "";
    const bottom = (r.author || "STAY THE COURSE").toUpperCase();

    const pulse = 0.85 + Math.sin(r.t * 2.2) * 0.15;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.save();
    ctx.globalAlpha = appear;
    const topSize = kit.fitFont(ctx, top, w * 0.6, baseSize(r, 0.036, 0.045), `700 {s}px ${kit.FONT}`);
    ctx.font = `700 ${topSize}px ${kit.FONT}`;
    ctx.fillStyle = p.text;
    ctx.fillText(top, w / 2, h * 0.24 - (1 - appear) * h * 0.03);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = appear;
    const midSize = Math.round(h * 0.02);
    ctx.font = `700 ${midSize}px ${kit.FONT}`;
    const midW = ctx.measureText(mid.split("").join(" ")).width;
    ctx.strokeStyle = kit.hexA(p.accent, 0.7);
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.beginPath();
    ctx.moveTo(w / 2 - midW / 2 - h * 0.09, h * 0.32);
    ctx.lineTo(w / 2 - midW / 2 - h * 0.02, h * 0.32);
    ctx.moveTo(w / 2 + midW / 2 + h * 0.02, h * 0.32);
    ctx.lineTo(w / 2 + midW / 2 + h * 0.09, h * 0.32);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.fillText(mid.split("").join(" "), w / 2, h * 0.32);
    ctx.restore();

    const { rows, size } = layout(
      ctx,
      kit,
      glow,
      w * 0.86,
      h * 0.34,
      baseSize(r, 0.11, 0.14),
      `900 {s}px ${kit.FONT}`,
      1.05,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.font = `900 ${size}px ${kit.FONT}`;
    ctx.shadowColor = kit.hexA(p.primary, 0.95 * pulse);
    ctx.shadowBlur = size * 0.9 * pulse;
    ctx.fillStyle = p.primary;
    let y = h * 0.54 - ((rows.length - 1) * size * 1.05) / 2 + (1 - appear) * size * 0.2;
    for (const row of rows) {
      ctx.fillText(row, w / 2, y);
      y += size * 1.05;
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = appear * 0.85;
    const bSize = Math.round(h * 0.019);
    ctx.font = `600 ${bSize}px ${kit.FONT}`;
    const spaced = bottom.split("").join(" ");
    ctx.fillStyle = p.text;
    ctx.fillText(spaced, w / 2, y + size * 0.18);
    const uw = ctx.measureText(spaced).width;
    ctx.strokeStyle = kit.hexA(p.text, 0.5);
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.beginPath();
    ctx.moveTo(w / 2 - uw * 0.25, y + size * 0.32);
    ctx.lineTo(w / 2 + uw * 0.25, y + size * 0.32);
    ctx.stroke();
    ctx.restore();
  },
};

// -------------------- paper press --------------------

const paperPress: Engine = {
  id: "paper-press",
  name: "Paper Press",
  desc: "Warm paper grain with left-aligned condensed lines, an ink slab and a script flourish.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    ctx.save();
    ctx.fillStyle = "#f4ecdd";
    ctx.globalAlpha = 0.94;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#3a2c1a";
    for (let i = 0; i < 320; i++) {
      const n = (i * 6113 + 2003) % 100000;
      const x = (n / 100000) * w;
      const y = (((n * 11 + i * 71) % 100000) / 100000) * h;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();

    const { line, appear } = state(kit, r);
    if (!line) return;
    const ink = "#241b10";
    const words = line.text.toUpperCase().split(" ").filter(Boolean);
    const x = w * 0.1;
    const maxW = w * 0.8;
    const size = kit.fitFont(ctx, words.join(" "), maxW, baseSize(r, 0.07, 0.088), `800 {s}px ${kit.COND}`);
    ctx.font = `800 ${size}px ${kit.COND}`;
    const rows = kit.wrapText(ctx, words.join(" "), maxW);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    let y = h * 0.5 - ((rows.length - 1) * size * 1.14) / 2;
    const lastRowIdx = rows.length - 1;

    rows.forEach((row, i) => {
      const a = Math.max(0, Math.min(1, appear * 1.6 - i * 0.25));
      ctx.save();
      ctx.globalAlpha = a;
      const isAccent = i === Math.max(0, rows.length - 2);
      if (i === lastRowIdx) {
        const rw = ctx.measureText(row).width;
        ctx.fillStyle = kit.hexA(ink, 0.92);
        ctx.save();
        ctx.translate(x - size * 0.1, y - size * 0.82);
        ctx.rotate(-0.02);
        kit.roundRect(ctx, 0, 0, rw + size * 0.4, size * 1.05, size * 0.08);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#f4ecdd";
      } else {
        ctx.fillStyle = isAccent ? "#b0552f" : ink;
      }
      ctx.fillText(row, x + (1 - a) * size * 0.35, y);
      if (i < lastRowIdx) {
        const rw = ctx.measureText(row).width;
        ctx.strokeStyle = kit.hexA(ink, 0.35);
        ctx.lineWidth = Math.max(1, size * 0.03);
        ctx.beginPath();
        ctx.moveTo(x + rw + size * 0.18, y - size * 0.28);
        ctx.lineTo(x + rw + size * 0.34, y - size * 0.28);
        ctx.stroke();
      }
      ctx.restore();
      y += size * 1.14;
    });

    ctx.save();
    ctx.globalAlpha = appear;
    ctx.font = `italic 500 ${Math.round(size * 0.42)}px ${kit.SERIF}`;
    ctx.fillStyle = "#b0552f";
    ctx.fillText(r.author ? r.author : "with grit", x + size * 0.2, y - size * 0.15);
    ctx.restore();

    ctx.strokeStyle = kit.hexA(ink, 0.5);
    ctx.lineWidth = Math.max(1, h * 0.0015);
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.9);
    ctx.lineTo(w * 0.94, h * 0.9);
    ctx.stroke();
    ctx.textAlign = "center";
  },
};

// -------------------- bold block --------------------

const boldBlock: Engine = {
  id: "bold-block",
  name: "Bold Block",
  desc: "Saturated flat colour field with massive left-aligned caps and inverted blocks.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const { line, appear } = state(kit, r);
    if (!line) return;
    const x = w * 0.08;
    const maxW = w * 0.84;
    const words = line.text.toUpperCase().split(" ").filter(Boolean);
    const size = kit.fitFont(ctx, words.join(" "), maxW, baseSize(r, 0.075, 0.095), `900 {s}px ${kit.FONT}`);
    ctx.font = `900 ${size}px ${kit.FONT}`;
    const rows = kit.wrapText(ctx, words.join(" "), maxW);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    let y = h * 0.5 - ((rows.length - 1) * size * 1.12) / 2;

    // top dash marks
    ctx.save();
    ctx.globalAlpha = appear * 0.8;
    ctx.fillStyle = "#0b0b0c";
    for (let i = 0; i < 5; i++) ctx.fillRect(x + i * size * 0.5, y - size * 1.5, size * 0.28, Math.max(3, h * 0.006));
    ctx.restore();

    rows.forEach((row, i) => {
      const a = Math.max(0, Math.min(1, appear * 1.5 - i * 0.18));
      const drift = (1 - a) * size * 0.3;
      ctx.save();
      ctx.globalAlpha = a;
      const rw = ctx.measureText(row).width;
      if (i % 2 === 1) {
        ctx.fillStyle = "#0b0b0c";
        ctx.fillRect(x - size * 0.08, y - size * 0.86, rw + size * 0.32, size * 1.08);
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.fillStyle = "#0b0b0c";
      }
      ctx.fillText(row, x + size * 0.08 + drift, y);
      ctx.restore();
      y += size * 1.12;
    });

    ctx.save();
    ctx.globalAlpha = appear * 0.8;
    ctx.fillStyle = "#0b0b0c";
    for (let i = 0; i < 5; i++) ctx.fillRect(x + i * size * 0.5, y + size * 0.5, size * 0.28, Math.max(3, h * 0.006));
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawAuthor(ctx, r, y + size * 1.1);
  },
};

// -------------------- rail stack --------------------

const railStack: Engine = {
  id: "rail-stack",
  name: "Rail Stack",
  desc: "Charcoal backdrop with a vertical accent rail beside stacked heavy caps and a tag line.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    ctx.save();
    ctx.fillStyle = "#111113";
    ctx.globalAlpha = 0.7;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const { line, appear } = state(kit, r);
    if (!line) return;
    const railX = w * 0.1;
    const words = line.text.toUpperCase().split(" ").filter(Boolean);
    const x = railX + w * 0.045;
    const maxW = w * 0.78;
    const size = kit.fitFont(ctx, words.join(" "), maxW, baseSize(r, 0.068, 0.086), `900 {s}px ${kit.COND}`);
    ctx.font = `900 ${size}px ${kit.COND}`;
    const rows = kit.wrapText(ctx, words.join(" "), maxW);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const blockH = rows.length * size * 1.1;
    let y = h * 0.5 - blockH / 2 + size * 0.8;
    const startY = y - size * 0.9;

    ctx.save();
    ctx.globalAlpha = appear;
    ctx.fillStyle = p.primary;
    ctx.fillRect(railX, startY, Math.max(4, w * 0.008), blockH + size * 0.2);
    ctx.restore();

    rows.forEach((row, i) => {
      const a = Math.max(0, Math.min(1, appear * 1.5 - i * 0.2));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = i === rows.length - 1 ? p.primary : p.text;
      ctx.fillText(row, x + (1 - a) * w * 0.03, y);
      ctx.restore();
      y += size * 1.1;
    });

    // caption with one accent word
    const capWords = (r.author || "MOVE WITH INTENT").toUpperCase().split(" ");
    const mid = Math.floor(capWords.length / 2);
    ctx.save();
    ctx.globalAlpha = appear * 0.85;
    ctx.font = `600 ${Math.round(h * 0.017)}px ${kit.FONT}`;
    let cx = x;
    capWords.forEach((wd, i) => {
      ctx.fillStyle = i === mid ? p.primary : kit.hexA(p.text, 0.85);
      const spaced = wd.split("").join(" ") + "   ";
      ctx.fillText(spaced, cx, y + size * 0.3);
      cx += ctx.measureText(spaced).width;
    });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = appear;
    ctx.fillStyle = p.primary;
    ctx.fillRect(x, y + size * 0.5, w * 0.14, Math.max(3, h * 0.0035));
    ctx.restore();
    ctx.textAlign = "center";
  },
};


// Register the poster-style engines after their declarations.
for (const e of [gritPoster, neonStack, paperPress, boldBlock, railStack]) {
  EXTRA_MOTIVATIONAL_ENGINES.push(e);
  EXTRA_MOTIVATIONAL_MAP.set(e.id, e);
}

// -------------------- typography · solid & gradient backgrounds --------------------
// These templates ignore the uploaded footage entirely: they paint a flat
// solid colour or a slowly animated dark gradient and set pure type on top.
// They still honour the per-template size/position/tilt controls (applied by
// the caller's transform) and the active palette / ColorCustomiser overrides.

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  return [parseInt(n.slice(0, 2), 16) || 0, parseInt(n.slice(2, 4), 16) || 0, parseInt(n.slice(4, 6), 16) || 0];
}
function mix(a: string, b: string, t: number) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
/** Push a colour towards near-black so the background reads as a solid/dark surface. */
function deepen(hex: string, amt = 0.72) {
  return mix(hex, "#000000", amt);
}

function paintFlatSolid(ctx: C, w: number, h: number, hex: string) {
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, w, h);
}

function paintVerticalGradient(ctx: C, w: number, h: number, top: string, bottom: string, t: number) {
  const drift = Math.sin(t * 0.15) * h * 0.06;
  const g = ctx.createLinearGradient(0, -drift, 0, h + drift);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function paintRadialGradient(ctx: C, w: number, h: number, inner: string, outer: string, t: number) {
  const pulse = 0.9 + Math.sin(t * 0.6) * 0.1;
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.05,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72 * pulse,
  );
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Slowly rotating multi-stop dark gradient — an "aurora" without any footage. */
function paintAuroraGradient(ctx: C, w: number, h: number, p: Palette, t: number) {
  const cx = w / 2 + Math.sin(t * 0.11) * w * 0.12;
  const cy = h / 2 + Math.cos(t * 0.09) * h * 0.12;
  const angle = t * 0.08;
  const x0 = cx + Math.cos(angle) * w * 0.6;
  const y0 = cy + Math.sin(angle) * h * 0.6;
  const x1 = cx - Math.cos(angle) * w * 0.6;
  const y1 = cy - Math.sin(angle) * h * 0.6;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, deepen(p.bg[1], 0.55));
  g.addColorStop(0.45, deepen(p.primary, 0.82));
  g.addColorStop(0.72, deepen(p.accent, 0.88));
  g.addColorStop(1, deepen(p.bg[0], 0.85));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const solidMidnight: Engine = {
  id: "solid-midnight",
  name: "Solid · Midnight Solid",
  desc: "Flat near-black background with a huge centred condensed statement and a thin accent rule.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintFlatSolid(ctx, w, h, deepen(p.bg[0], 0.85));
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.8,
      h * 0.42,
      baseSize(r, 0.08, 0.1),
      `900 {s}px ${kit.COND}`,
      1.04,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.25);
    const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.04, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    ctx.fillStyle = p.accent;
    ctx.fillRect(w / 2 - w * 0.06, end + size * 0.5, w * 0.12, Math.max(3, h * 0.0042));
    kit.drawAuthor(ctx, r, end + size * 0.95);
  },
};

const solidInkGradient: Engine = {
  id: "solid-ink-gradient",
  name: "Solid · Ink Gradient",
  desc: "Vertical navy-to-black gradient, left-aligned serif quote and a small-caps author line.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintVerticalGradient(ctx, w, h, deepen(p.bg[1], 0.35), "#000000", r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const x = w * 0.1;
    const maxW = w * 0.78;
    const { rows, size } = layout(
      ctx,
      kit,
      `“${line.text}”`,
      maxW,
      h * 0.4,
      baseSize(r, 0.052, 0.066),
      `400 italic {s}px ${kit.SERIF}`,
      1.28,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    softShadow(ctx, size * 0.3);
    let y = h * 0.5 - ((rows.length - 1) * size * 1.28) / 2;
    for (const row of rows) {
      ctx.fillText(row, x + (1 - appear) * w * 0.03, y);
      y += size * 1.28;
    }
    ctx.restore();
    ctx.textAlign = "center";
    if (r.author) {
      ctx.save();
      ctx.globalAlpha = appear * 0.85;
      ctx.textAlign = "left";
      ctx.font = `700 ${Math.round(size * 0.32)}px ${kit.FONT}`;
      ctx.fillStyle = p.accent;
      ctx.fillText(r.author.toUpperCase().split("").join(" "), x, y + size * 0.3);
      ctx.restore();
      ctx.textAlign = "center";
    }
  },
};

const solidEmberFade: Engine = {
  id: "solid-ember-fade",
  name: "Solid · Ember Fade",
  desc: "Charcoal-to-ember radial gradient with big bold centred type revealed word by word.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintRadialGradient(ctx, w, h, deepen(p.primary, 0.55), deepen(p.bg[0], 0.9), r.t);
    const { line } = state(kit, r);
    if (!line) return;
    const words = line.text.toUpperCase().split(" ").filter(Boolean);
    const span = Math.max(0.4, line.end - line.time);
    const shownCount = Math.max(
      1,
      Math.ceil(words.length * Math.min(1, ((r.t - line.time) / span) * 1.2)),
    );
    const text = words.slice(0, shownCount).join(" ");
    const { rows, size } = layout(
      ctx,
      kit,
      text,
      w * 0.82,
      h * 0.4,
      baseSize(r, 0.078, 0.098),
      `800 {s}px ${kit.FONT}`,
      1.08,
    );
    ctx.save();
    softShadow(ctx, size * 0.4);
    drawRows(ctx, rows, w / 2, h * 0.5, size, 1.08, p.text);
    ctx.restore();
    kit.drawAuthor(ctx, r, h * 0.5 + rows.length * size * 0.6);
  },
};

const solidSlateSplit: Engine = {
  id: "solid-slate-split",
  name: "Solid · Slate Split",
  desc: "Solid slate field with a diagonal darker band behind the quote.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintFlatSolid(ctx, w, h, deepen(p.bg[0], 0.6));
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.06 + Math.sin(r.t * 0.2) * 0.006);
    ctx.fillStyle = deepen(p.bg[1], 0.85);
    ctx.fillRect(-w * 0.75, -h * 0.24, w * 1.5, h * 0.48);
    ctx.restore();
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      w * 0.72,
      h * 0.34,
      baseSize(r, 0.06, 0.075),
      `700 {s}px ${kit.FONT}`,
      1.2,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.3);
    const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.2, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    kit.drawAuthor(ctx, r, end + size * 0.95);
  },
};

const solidMonoTerminal: Engine = {
  id: "solid-mono-terminal",
  name: "Solid · Mono Terminal",
  desc: "Pure black backdrop with a monospace caption stack and a blinking caret.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintFlatSolid(ctx, w, h, "#000000");
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = kit.hexA(p.primary, 0.35);
    ctx.lineWidth = 1;
    for (let y = h * 0.08; y < h * 0.95; y += h * 0.05) {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, y);
      ctx.lineTo(w * 0.06, y + h * 0.01);
      ctx.stroke();
    }
    ctx.restore();
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      w * 0.76,
      h * 0.36,
      baseSize(r, 0.04, 0.05),
      `500 {s}px ${kit.MONO}`,
      1.42,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const x = w * 0.12;
    let y = h * 0.5 - ((rows.length - 1) * size * 1.42) / 2;
    rows.forEach((row, i) => {
      ctx.fillStyle = p.primary;
      ctx.fillText("> ", x - size * 1.1, y);
      ctx.fillStyle = p.text;
      ctx.fillText(row, x, y);
      if (i === rows.length - 1 && Math.floor(r.t * 2) % 2 === 0) {
        ctx.fillStyle = p.accent;
        ctx.fillRect(x + ctx.measureText(row).width + size * 0.12, y - size * 0.42, size * 0.5, size * 0.84);
      }
      y += size * 1.42;
    });
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

const solidAuroraDeep: Engine = {
  id: "solid-aurora-deep",
  name: "Solid · Aurora Deep",
  desc: "Slowly shifting dark aurora gradient behind large centred type.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintAuroraGradient(ctx, w, h, p, r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text,
      w * 0.78,
      h * 0.38,
      baseSize(r, 0.062, 0.078),
      `700 {s}px ${kit.FONT}`,
      1.22,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.45);
    const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.22, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    kit.drawAuthor(ctx, r, end + size * 0.95);
  },
};

const solidPaperNoir: Engine = {
  id: "solid-paper-noir",
  name: "Solid · Paper Noir",
  desc: "Off-black background with a thin bordered frame around a centred serif quote.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintFlatSolid(ctx, w, h, deepen(p.bg[0], 0.78));
    const inset = Math.min(w, h) * 0.06;
    ctx.strokeStyle = kit.hexA(p.text, 0.28);
    ctx.lineWidth = Math.max(1, h * 0.0012);
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      `“${line.text}”`,
      w * 0.7,
      h * 0.36,
      baseSize(r, 0.05, 0.062),
      `400 italic {s}px ${kit.SERIF}`,
      1.3,
    );
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.35);
    const end = drawRows(ctx, rows, w / 2, h * 0.48, size, 1.3, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    if (r.author) {
      ctx.save();
      ctx.globalAlpha = appear * 0.85;
      ctx.font = `600 ${Math.round(size * 0.3)}px ${kit.FONT}`;
      ctx.fillStyle = p.accent;
      ctx.textAlign = "center";
      ctx.fillText(r.author.toUpperCase().split("").join(" "), w / 2, end + size * 0.85);
      ctx.restore();
    }
  },
};

const solidBoldStack: Engine = {
  id: "solid-bold-stack",
  name: "Solid · Bold Stack Solid",
  desc: "Solid accent-dark field with stacked uppercase blocks and alternating accent-filled rows.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintFlatSolid(ctx, w, h, deepen(p.accent, 0.86));
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(
      ctx,
      kit,
      line.text.toUpperCase(),
      w * 0.66,
      h * 0.4,
      baseSize(r, 0.058, 0.072),
      `900 {s}px ${kit.FONT}`,
      1.32,
    );
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${size}px ${kit.FONT}`;
    let y = h * 0.5 - ((rows.length - 1) * size * 1.32) / 2;
    rows.forEach((row, i) => {
      const a = Math.max(0, Math.min(1, appear * 1.5 - i * 0.2));
      const tw = ctx.measureText(row).width;
      ctx.save();
      ctx.globalAlpha = a;
      if (i % 2 === 1) {
        ctx.fillStyle = p.primary;
        kit.roundRect(ctx, w / 2 - tw / 2 - size * 0.35, y - size * 0.62, tw + size * 0.7, size * 1.24, size * 0.08);
        ctx.fill();
        ctx.fillStyle = "#0b0b0c";
      } else {
        ctx.fillStyle = p.text;
      }
      ctx.fillText(row, w / 2, y + (1 - a) * size * 0.2);
      ctx.restore();
      y += size * 1.32;
    });
    ctx.restore();
    kit.drawAuthor(ctx, r, y + size * 0.25);
  },
};

export const TYPOGRAPHY_SOLID_ENGINES: Engine[] = [
  solidMidnight,
  solidInkGradient,
  solidEmberFade,
  solidSlateSplit,
  solidMonoTerminal,
  solidAuroraDeep,
  solidPaperNoir,
  solidBoldStack,
];

for (const e of TYPOGRAPHY_SOLID_ENGINES) {
  EXTRA_MOTIVATIONAL_ENGINES.push(e);
  EXTRA_MOTIVATIONAL_MAP.set(e.id, e);
}

// -------------------- 15 new: solid / paper / gradient backgrounds --------------------
// Each of these ignores footage entirely and paints its own subtly-animated
// backdrop (flat colour + breathing vignette + grain, warm paper grain, or a
// drifting gradient). Every one uses a distinct text-reveal animation.

function paintVignetteBreath(ctx: C, w: number, h: number, t: number, base = 0.4, amp = 0.1) {
  const k = Math.max(0, Math.min(0.85, base + Math.sin(t * 0.4) * amp));
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${k})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function paintGrain(ctx: C, w: number, h: number, t: number, alpha = 0.045, color = "#ffffff", count = 240) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const n = (i * 7919 + Math.floor(t * 10) * 5171) % 100000;
    const x = (n / 100000) * w;
    const y = (((n * 13 + i * 97) % 100000) / 100000) * h;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

function paintSolidBreath(ctx: C, w: number, h: number, hex: string, t: number) {
  paintFlatSolid(ctx, w, h, hex);
  paintGrain(ctx, w, h, t, 0.035, "#ffffff", 200);
  paintVignetteBreath(ctx, w, h, t, 0.4, 0.1);
}

function paintPaperBreath(ctx: C, w: number, h: number, t: number, base = "#f4ecdd") {
  paintFlatSolid(ctx, w, h, base);
  paintGrain(ctx, w, h, t, 0.05, "#3a2c1a", 320);
  const k = 0.16 + Math.sin(t * 0.35) * 0.05;
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(60,40,20,${k})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function paintDiagGradient(ctx: C, w: number, h: number, c0: string, c1: string, c2: string, t: number) {
  const angle = 0.5 + Math.sin(t * 0.1) * 0.18;
  const x0 = w * 0.5 - Math.cos(angle) * w * 0.7;
  const y0 = h * 0.5 - Math.sin(angle) * h * 0.7;
  const x1 = w * 0.5 + Math.cos(angle) * w * 0.7;
  const y1 = h * 0.5 + Math.sin(angle) * h * 0.7;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0);
  g.addColorStop(0.5, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  paintVignetteBreath(ctx, w, h, t, 0.28, 0.08);
}

// 1 — per-word cascade
const gradWordCascade: Engine = {
  id: "grad-word-cascade",
  name: "Gradient · Word Cascade",
  desc: "Drifting diagonal gradient with each word cascading in on a stagger.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintDiagGradient(ctx, w, h, deepen(p.bg[0], 0.6), deepen(p.primary, 0.72), deepen(p.bg[1], 0.7), r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text, w * 0.8, h * 0.4, baseSize(r, 0.062, 0.078), `800 {s}px ${kit.FONT}`, 1.2);
    ctx.save();
    ctx.font = `800 ${size}px ${kit.FONT}`;
    softShadow(ctx, size * 0.3);
    let y = h * 0.5 - ((rows.length - 1) * size * 1.2) / 2;
    const totalWords = rows.reduce((a, row) => a + row.split(" ").length, 0);
    let wordIdx = 0;
    for (const row of rows) {
      const words = row.split(" ");
      const widths = words.map((wd) => ctx.measureText(wd + " ").width);
      const total = widths.reduce((a, b) => a + b, 0);
      let x = w / 2 - total / 2;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      words.forEach((wd, i) => {
        const localAppear = Math.max(0, Math.min(1, appear * totalWords * 1.15 - wordIdx));
        const e = kit.easeOutCubic(localAppear);
        ctx.save();
        ctx.globalAlpha = e;
        ctx.fillStyle = p.text;
        ctx.fillText(wd, x, y + (1 - e) * size * 0.6);
        ctx.restore();
        x += widths[i];
        wordIdx++;
      });
      y += size * 1.2;
    }
    ctx.restore();
    ctx.textAlign = "center";
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

// 2 — letter-by-letter kinetic scale
const solidKineticLetters: Engine = {
  id: "solid-kinetic-letters",
  name: "Solid · Kinetic Letters",
  desc: "Breathing near-black field with letters scaling up into place one by one.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintSolidBreath(ctx, w, h, deepen(p.bg[0], 0.82), r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const text = line.text.toUpperCase();
    const { rows, size } = layout(ctx, kit, text, w * 0.78, h * 0.4, baseSize(r, 0.07, 0.088), `900 {s}px ${kit.COND}`, 1.08);
    ctx.font = `900 ${size}px ${kit.COND}`;
    softShadow(ctx, size * 0.3);
    let y = h * 0.5 - ((rows.length - 1) * size * 1.08) / 2;
    const totalChars = rows.reduce((a, row) => a + row.length, 0);
    let charIdx = 0;
    for (const row of rows) {
      const chars = row.split("");
      const widths = chars.map((c) => ctx.measureText(c).width);
      const total = widths.reduce((a, b) => a + b, 0);
      let x = w / 2 - total / 2;
      for (let i = 0; i < chars.length; i++) {
        const localAppear = Math.max(0, Math.min(1, appear * totalChars * 1.3 - charIdx));
        const e = kit.easeOutCubic(localAppear);
        const scale = 0.4 + e * 0.6;
        ctx.save();
        ctx.globalAlpha = e;
        ctx.translate(x + widths[i] / 2, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = p.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(chars[i], 0, 0);
        ctx.restore();
        x += widths[i];
        charIdx++;
      }
      y += size * 1.08;
    }
    kit.drawAuthor(ctx, r, y + size * 0.3);
  },
};

// 3 — mask wipe reveal
const gradWipeReveal: Engine = {
  id: "grad-wipe-reveal",
  name: "Gradient · Wipe Reveal",
  desc: "Aurora gradient with the quote wiped on left-to-right through a moving edge.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintAuroraGradient(ctx, w, h, p, r.t);
    const { line, frac } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text, w * 0.78, h * 0.36, baseSize(r, 0.06, 0.075), `800 {s}px ${kit.FONT}`, 1.22);
    const boxTop = h * 0.5 - (rows.length * size * 1.22) / 2 - size * 0.3;
    const boxH = rows.length * size * 1.22 + size * 0.6;
    const revealW = w * Math.min(1, frac * 1.6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, boxTop, revealW, boxH);
    ctx.clip();
    softShadow(ctx, size * 0.3);
    drawRows(ctx, rows, w / 2, h * 0.5, size, 1.22, p.text);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - frac * 1.6);
    ctx.fillStyle = p.primary;
    ctx.fillRect(revealW - Math.max(2, w * 0.004), boxTop, Math.max(2, w * 0.004), boxH);
    ctx.restore();
    kit.drawAuthor(ctx, r, boxTop + boxH + size * 0.4);
  },
};

// 4 — line-by-line slide with blur
const paperSlideBlur: Engine = {
  id: "paper-slide-blur",
  name: "Paper · Slide Blur",
  desc: "Warm paper grain with each line sliding up and sharpening out of a blur.",
  draw: (ctx, r, kit) => {
    const { w, h } = r;
    paintPaperBreath(ctx, w, h, r.t);
    const ink = "#241b10";
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text, w * 0.76, h * 0.36, baseSize(r, 0.052, 0.066), `700 {s}px ${kit.FONT}`, 1.28);
    ctx.font = `700 ${size}px ${kit.FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let y = h * 0.5 - ((rows.length - 1) * size * 1.28) / 2;
    rows.forEach((row, i) => {
      const localAppear = Math.max(0, Math.min(1, appear * 1.6 - i * 0.28));
      const e = kit.easeOutCubic(localAppear);
      const blur = (1 - e) * 10;
      ctx.save();
      ctx.globalAlpha = e;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).filter = blur > 0.2 ? `blur(${blur}px)` : "none";
      ctx.fillStyle = ink;
      ctx.fillText(row, w / 2, y + (1 - e) * size * 0.5);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).filter = "none";
      ctx.restore();
      y += size * 1.28;
    });
    if (r.author) {
      ctx.fillStyle = "#b0552f";
      ctx.font = `600 ${Math.round(size * 0.3)}px ${kit.FONT}`;
      ctx.fillText(r.author.toUpperCase(), w / 2, y + size * 0.2);
    }
  },
};

// 5 — typewriter with caret (gradient)
const gradTypewriterCaret: Engine = {
  id: "grad-typewriter-caret",
  name: "Gradient · Typewriter Caret",
  desc: "Slow vertical gradient drift with a monospace line typed out and a blinking caret.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintVerticalGradient(ctx, w, h, deepen(p.primary, 0.68), deepen(p.bg[0], 0.9), r.t);
    paintVignetteBreath(ctx, w, h, r.t, 0.22, 0.06);
    const { line, frac } = state(kit, r);
    if (!line) return;
    const shown = line.text.slice(0, Math.ceil(line.text.length * Math.min(1, frac * 1.3)));
    const { rows, size } = layout(ctx, kit, shown || " ", w * 0.74, h * 0.34, baseSize(r, 0.038, 0.048), `500 {s}px ${kit.MONO}`, 1.46);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let y = h * 0.5 - ((rows.length - 1) * size * 1.46) / 2;
    for (const row of rows) {
      ctx.fillStyle = p.text;
      ctx.fillText(row, w / 2, y);
      y += size * 1.46;
    }
    const lastRow = rows[rows.length - 1] ?? "";
    if (Math.floor(r.t * 2) % 2 === 0) {
      const rw = ctx.measureText(lastRow).width;
      ctx.fillStyle = p.accent;
      ctx.fillRect(w / 2 + rw / 2 + size * 0.12, y - size * 1.46 - size * 0.42, size * 0.5, size * 0.84);
    }
    ctx.restore();
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

// 6 — split-flap
const solidSplitFlap: Engine = {
  id: "solid-split-flap",
  name: "Solid · Split Flap",
  desc: "Breathing solid field with a departures-board split-flap letter flip reveal.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintSolidBreath(ctx, w, h, deepen(p.bg[0], 0.8), r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const text = line.text.toUpperCase();
    const { rows, size } = layout(ctx, kit, text, w * 0.8, h * 0.4, baseSize(r, 0.065, 0.082), `900 {s}px ${kit.MONO}`, 1.15);
    ctx.font = `900 ${size}px ${kit.MONO}`;
    let y = h * 0.5 - ((rows.length - 1) * size * 1.15) / 2;
    const totalChars = rows.reduce((a, row) => a + row.length, 0);
    let idx = 0;
    for (const row of rows) {
      const chars = row.split("");
      const widths = chars.map((c) => ctx.measureText(c).width);
      const cellW = Math.max(...widths, size * 0.1) * 1.08;
      const total = chars.length * cellW;
      let x = w / 2 - total / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const c of chars) {
        const localAppear = Math.max(0, Math.min(1, appear * totalChars * 1.4 - idx));
        const flap = Math.min(1, localAppear * 1.6);
        const scaleY = flap < 1 ? Math.max(0.05, Math.abs(Math.cos(flap * Math.PI))) : 1;
        ctx.save();
        ctx.translate(x + cellW / 2, y);
        ctx.scale(1, scaleY);
        ctx.fillStyle = kit.hexA(p.text, 0.08);
        kit.roundRect(ctx, -cellW / 2 + 2, -size * 0.62, cellW - 4, size * 1.24, size * 0.08);
        ctx.fill();
        ctx.fillStyle = flap < 1 ? p.primary : p.text;
        ctx.fillText(c, 0, 0);
        ctx.restore();
        x += cellW;
        idx++;
      }
      y += size * 1.15;
    }
    kit.drawAuthor(ctx, r, y + size * 0.3);
  },
};

// 7 — vertical roll
const paperVerticalRoll: Engine = {
  id: "paper-vertical-roll",
  name: "Paper · Vertical Roll",
  desc: "Paper grain backdrop with each line rolling up into view through a clipped band.",
  draw: (ctx, r, kit) => {
    const { w, h } = r;
    paintPaperBreath(ctx, w, h, r.t, "#efe6d2");
    const ink = "#241b10";
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text, w * 0.74, h * 0.34, baseSize(r, 0.056, 0.07), `800 {s}px ${kit.COND}`, 1.3);
    ctx.font = `800 ${size}px ${kit.COND}`;
    let y = h * 0.5 - ((rows.length - 1) * size * 1.3) / 2;
    rows.forEach((row, i) => {
      const localAppear = Math.max(0, Math.min(1, appear * 1.6 - i * 0.25));
      const e = kit.easeOutCubic(localAppear);
      const rowH = size * 1.3;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y - rowH / 2, w, rowH);
      ctx.clip();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = ink;
      ctx.globalAlpha = e;
      ctx.fillText(row, w / 2, y - (1 - e) * rowH);
      ctx.restore();
      y += size * 1.3;
    });
    if (r.author) {
      ctx.fillStyle = "#b0552f";
      ctx.font = `600 ${Math.round(size * 0.3)}px ${kit.FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(r.author.toUpperCase(), w / 2, y + size * 0.2);
    }
  },
};

// 8 — scale-punch on beat
const gradScalePunch: Engine = {
  id: "grad-scale-punch",
  name: "Gradient · Scale Punch",
  desc: "Diagonal drifting gradient with the whole statement punching to the beat of each word.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintDiagGradient(ctx, w, h, deepen(p.bg[1], 0.62), deepen(p.accent, 0.7), deepen(p.bg[0], 0.72), r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    let punch = 0;
    if (line.words.length) {
      const cur = kit.activeWord(line, r.t);
      if (cur) punch = 1 - kit.easeOutCubic(Math.min(1, (r.t - cur.start) / 0.12));
    } else {
      punch = Math.max(0, 1 - (r.t - line.time) / 0.15);
    }
    const scale = 1 + punch * 0.14;
    const { rows, size } = layout(ctx, kit, line.text.toUpperCase(), w * 0.78, h * 0.4, baseSize(r, 0.07, 0.088), `900 {s}px ${kit.FONT}`, 1.1);
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate(w / 2, h * 0.5);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h * 0.5);
    softShadow(ctx, size * 0.35);
    drawRows(ctx, rows, w / 2, h * 0.5, size, 1.1, p.text, (1 - appear) * size * 0.2);
    ctx.restore();
    kit.drawAuthor(ctx, r, h * 0.5 + rows.length * size * 0.62);
  },
};

// 9 — rotating word swap
const solidWordSwap: Engine = {
  id: "solid-word-swap",
  name: "Solid · Word Swap",
  desc: "Solid accent field flipping through one word of the line at a time above a full caption.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintSolidBreath(ctx, w, h, deepen(p.primary, 0.82), r.t);
    const { line } = state(kit, r);
    if (!line) return;
    const words = line.text.split(" ").filter(Boolean);
    if (!words.length) return;
    const per = 0.85;
    const idx = Math.floor(Math.max(0, r.t - line.time) / per) % words.length;
    const localT = ((Math.max(0, r.t - line.time) % per) + per) % per;
    const flip = Math.min(1, localT / 0.18);
    const word = words[idx] ?? "";
    const size = kit.fitFont(ctx, word.toUpperCase(), w * 0.8, baseSize(r, 0.09, 0.11), `900 {s}px ${kit.FONT}`);
    ctx.save();
    ctx.font = `900 ${size}px ${kit.FONT}`;
    const scaleY = Math.max(0.08, Math.abs(Math.cos((1 - flip) * (Math.PI / 2))));
    ctx.translate(w / 2, h * 0.44);
    ctx.scale(1, scaleY);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    softShadow(ctx, size * 0.3);
    ctx.fillStyle = p.text;
    ctx.fillText(word.toUpperCase(), 0, 0);
    ctx.restore();
    const { rows, size: capSize } = layout(ctx, kit, line.text.toUpperCase(), w * 0.72, h * 0.16, Math.round(h * 0.022), `600 {s}px ${kit.FONT}`, 1.3);
    ctx.save();
    ctx.globalAlpha = 0.75;
    drawRows(ctx, rows, w / 2, h * 0.66, capSize, 1.3, kit.hexA(p.text, 0.75));
    ctx.restore();
    kit.drawAuthor(ctx, r, h * 0.66 + rows.length * capSize * 0.9);
  },
};

// 10 — underline sweep
const paperUnderlineSweep: Engine = {
  id: "paper-underline-sweep",
  name: "Paper · Underline Sweep",
  desc: "Warm paper texture with a hand-drawn underline sweeping beneath the settled quote.",
  draw: (ctx, r, kit) => {
    const { w, h } = r;
    paintPaperBreath(ctx, w, h, r.t, "#f7f0e2");
    const ink = "#241b10";
    const { line, appear, frac } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text, w * 0.74, h * 0.34, baseSize(r, 0.054, 0.068), `600 {s}px ${kit.SERIF}`, 1.3);
    ctx.save();
    ctx.globalAlpha = appear;
    const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.3, ink, (1 - appear) * size * 0.2);
    ctx.restore();
    const lastRow = rows[rows.length - 1] ?? "";
    ctx.font = `600 ${size}px ${kit.SERIF}`;
    const rw = ctx.measureText(lastRow).width;
    const sweep = Math.min(1, frac * 1.4);
    ctx.save();
    ctx.strokeStyle = "#b0552f";
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(w / 2 - rw / 2, end + size * 0.12);
    ctx.lineTo(w / 2 - rw / 2 + rw * sweep, end + size * 0.12);
    ctx.stroke();
    ctx.restore();
    if (r.author) {
      ctx.fillStyle = "#b0552f";
      ctx.font = `600 ${Math.round(size * 0.3)}px ${kit.FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(r.author.toUpperCase(), w / 2, end + size * 0.6);
    }
  },
};

// 11 — box-in reveal
const gradBoxReveal: Engine = {
  id: "grad-box-reveal",
  name: "Gradient · Box Reveal",
  desc: "Aurora gradient with a frame that contracts around the quote as it settles.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintAuroraGradient(ctx, w, h, p, r.t + 10);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text.toUpperCase(), w * 0.72, h * 0.36, baseSize(r, 0.06, 0.075), `800 {s}px ${kit.COND}`, 1.15);
    ctx.font = `800 ${size}px ${kit.COND}`;
    const blockH = rows.length * size * 1.15 + size * 0.6;
    const blockW = Math.max(...rows.map((row) => ctx.measureText(row).width)) + size * 0.8;
    const grow = 1 + (1 - appear) * 0.5;
    ctx.save();
    ctx.globalAlpha = Math.min(1, appear * 1.6);
    ctx.strokeStyle = p.primary;
    ctx.lineWidth = Math.max(2, h * 0.003);
    ctx.strokeRect(w / 2 - (blockW * grow) / 2, h * 0.5 - (blockH * grow) / 2, blockW * grow, blockH * grow);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = appear;
    softShadow(ctx, size * 0.3);
    drawRows(ctx, rows, w / 2, h * 0.5, size, 1.15, p.text);
    ctx.restore();
    kit.drawAuthor(ctx, r, h * 0.5 + blockH / 2 + size * 0.3);
  },
};

// 12 — stagger fade from centre
const solidStaggerCentre: Engine = {
  id: "solid-stagger-centre",
  name: "Solid · Stagger Centre",
  desc: "Breathing solid field with words fading and scaling in outward from the centre word.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintSolidBreath(ctx, w, h, deepen(p.bg[1], 0.75), r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text, w * 0.78, h * 0.4, baseSize(r, 0.058, 0.073), `700 {s}px ${kit.FONT}`, 1.24);
    ctx.font = `700 ${size}px ${kit.FONT}`;
    ctx.textBaseline = "middle";
    let y = h * 0.5 - ((rows.length - 1) * size * 1.24) / 2;
    const total = rows.reduce((a, row) => a + row.split(" ").length, 0);
    const centre = (total - 1) / 2;
    let counter = 0;
    for (const row of rows) {
      const words = row.split(" ");
      const widths = words.map((wd) => ctx.measureText(wd + " ").width);
      const totalW = widths.reduce((a, b) => a + b, 0);
      let x = w / 2 - totalW / 2;
      for (let i = 0; i < words.length; i++) {
        const dist = Math.abs(counter - centre);
        const localAppear = Math.max(0, Math.min(1, appear * 1.4 - dist * 0.14));
        const e = kit.easeOutCubic(localAppear);
        ctx.save();
        ctx.globalAlpha = e;
        ctx.translate(x + widths[i] / 2, y);
        ctx.scale(0.6 + e * 0.4, 0.6 + e * 0.4);
        ctx.fillStyle = p.text;
        ctx.textAlign = "center";
        ctx.fillText(words[i], 0, 0);
        ctx.restore();
        x += widths[i];
        counter++;
      }
      y += size * 1.24;
    }
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

// 13 — marquee ticker
const paperMarqueeTicker: Engine = {
  id: "paper-marquee-ticker",
  name: "Paper · Marquee Ticker",
  desc: "Paper texture with an inked headline beneath a scrolling ticker strip.",
  draw: (ctx, r, kit) => {
    const { w, h } = r;
    paintPaperBreath(ctx, w, h, r.t, "#f4ecdd");
    const ink = "#241b10";
    const bandY = h * 0.1;
    const bandH = h * 0.05;
    ctx.fillStyle = ink;
    ctx.fillRect(0, bandY, w, bandH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, bandY, w, bandH);
    ctx.clip();
    ctx.fillStyle = "#f4ecdd";
    ctx.font = `700 ${Math.round(bandH * 0.5)}px ${kit.MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const phrase = `${(r.author || "KEEP MOVING").toUpperCase()}   ·   `;
    const pw = Math.max(1, ctx.measureText(phrase).width);
    const shift = (r.t * w * 0.06) % pw;
    for (let x = -shift; x < w + pw; x += pw) ctx.fillText(phrase, x, bandY + bandH / 2);
    ctx.restore();
    ctx.textAlign = "center";
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text, w * 0.76, h * 0.34, baseSize(r, 0.052, 0.066), `700 {s}px ${kit.FONT}`, 1.24);
    ctx.save();
    ctx.globalAlpha = appear;
    drawRows(ctx, rows, w / 2, h * 0.54, size, 1.24, ink, (1 - appear) * size * 0.2);
    ctx.restore();
  },
};

// 14 — glitch-in
const gradGlitchIn: Engine = {
  id: "grad-glitch-in",
  name: "Gradient · Glitch In",
  desc: "Drifting dark gradient with the statement snapping into focus through an RGB-split glitch.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintDiagGradient(ctx, w, h, deepen(p.bg[0], 0.68), deepen(p.bg[1], 0.6), deepen(p.primary, 0.75), r.t + 5);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const { rows, size } = layout(ctx, kit, line.text.toUpperCase(), w * 0.8, h * 0.4, baseSize(r, 0.07, 0.088), `900 {s}px ${kit.FONT}`, 1.1);
    ctx.font = `900 ${size}px ${kit.FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let y = h * 0.5 - ((rows.length - 1) * size * 1.1) / 2;
    rows.forEach((row, i) => {
      const localAppear = Math.max(0, Math.min(1, appear * 1.8 - i * 0.15));
      const glitch = Math.max(0, 1 - localAppear * 2.2);
      const jitter = glitch * size * 0.12;
      const seed = Math.sin(r.t * 37 + i * 13) * jitter;
      ctx.save();
      ctx.globalAlpha = Math.min(1, localAppear * 1.6);
      ctx.fillStyle = kit.hexA("#ff3b6b", 0.7 * glitch);
      ctx.fillText(row, w / 2 - seed, y);
      ctx.fillStyle = kit.hexA("#38f5ff", 0.7 * glitch);
      ctx.fillText(row, w / 2 + seed, y);
      ctx.fillStyle = p.text;
      ctx.fillText(row, w / 2, y);
      ctx.restore();
      y += size * 1.1;
    });
    kit.drawAuthor(ctx, r, y + size * 0.2);
  },
};

// 15 — stacked emphasis words
const solidStackedEmphasis: Engine = {
  id: "solid-stacked-emphasis",
  name: "Solid · Stacked Emphasis",
  desc: "Breathing solid field with each word stacked, alternating sides, longest word emphasised.",
  draw: (ctx, r, kit) => {
    const { w, h, palette: p } = r;
    paintSolidBreath(ctx, w, h, deepen(p.bg[0], 0.88), r.t);
    const { line, appear } = state(kit, r);
    if (!line) return;
    const words = line.text.toUpperCase().split(" ").filter(Boolean).slice(0, 5);
    if (!words.length) return;
    const n = words.length;
    const totalH = h * 0.7;
    const rowH = totalH / n;
    const longest = Math.max(...words.map((x) => x.length));
    ctx.textBaseline = "middle";
    words.forEach((wd, i) => {
      const localAppear = Math.max(0, Math.min(1, appear * 1.6 - i * 0.18));
      const e = kit.easeOutCubic(localAppear);
      const emphasis = wd.length === longest ? 1.25 : 1;
      const size = kit.fitFont(ctx, wd, w * 0.9, Math.round(rowH * 0.72 * emphasis), `900 {s}px ${kit.FONT}`);
      ctx.font = `900 ${size}px ${kit.FONT}`;
      const align: CanvasTextAlign = i % 2 === 0 ? "left" : "right";
      ctx.textAlign = align;
      const x = align === "left" ? w * 0.06 : w * 0.94;
      const y = h * 0.16 + rowH * i + rowH / 2;
      ctx.save();
      ctx.globalAlpha = e;
      ctx.fillStyle = emphasis > 1 ? p.primary : p.text;
      ctx.fillText(wd, x + (align === "left" ? (1 - e) * w * 0.1 : -(1 - e) * w * 0.1), y);
      ctx.restore();
    });
    ctx.textAlign = "center";
    kit.drawAuthor(ctx, r, h * 0.16 + rowH * n + rowH * 0.3);
  },
};

export const KINETIC_BACKDROP_ENGINES: Engine[] = [
  gradWordCascade,
  solidKineticLetters,
  gradWipeReveal,
  paperSlideBlur,
  gradTypewriterCaret,
  solidSplitFlap,
  paperVerticalRoll,
  gradScalePunch,
  solidWordSwap,
  paperUnderlineSweep,
  gradBoxReveal,
  solidStaggerCentre,
  paperMarqueeTicker,
  gradGlitchIn,
  solidStackedEmphasis,
];

for (const e of KINETIC_BACKDROP_ENGINES) {
  EXTRA_MOTIVATIONAL_ENGINES.push(e);
  EXTRA_MOTIVATIONAL_MAP.set(e.id, e);
}
