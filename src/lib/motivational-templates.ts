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
    if ((rows.length * size * lineH <= maxH && rows.every((x) => ctx.measureText(x).width <= maxW)) || size <= 14) {
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
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  let y = centreY - ((rows.length - 1) * size * lineH) / 2;
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
      const end = drawRows(ctx, rows, w / 2, h * 0.48, size, 1.3, p.text);
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
    const end = drawRows(ctx, rows, w / 2, h * 0.49, size, 1.02, p.text);
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
    drawRows(ctx, rows, w / 2, y + boxH / 2, size, 1.28, p.text);
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
    const end = drawRows(ctx, rows, w / 2, h * 0.54, size, 1.3, p.text);
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
    ctx.fillText(String(index + 1).padStart(2, "0"), x, h * 0.5 - (rows.length * size * 1.08) / 2 - h * 0.04);
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
    ctx.fillRect(x - w * 0.045, h * 0.5 - (rows.length * size * 1.08) / 2, Math.max(4, w * 0.008), rows.length * size * 1.08);
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
      const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.22, p.text);
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
      kit.roundRect(ctx, -tw / 2 - size * 0.4, -size * 0.66, tw + size * 0.8, size * 1.32, size * 0.1);
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
      ctx.fillRect(x + ctx.measureText(lastRow).width + size * 0.12, y - size * 1.5 - size * 0.42, size * 0.5, size * 0.82);
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
    const end = drawRows(ctx, rows, w / 2, h * 0.5, size, 1.1, p.text);
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
      const y = ((n * 7 + i * 131) % 233280 / 233280) * h;
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
    const end = drawRows(ctx, rows, w / 2, h * 0.68, size, 1.3, p.text);
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
      kit.roundRect(ctx, w * 0.1 + i * (segW + gap), h * 0.1, segW, Math.max(3, h * 0.005), h * 0.0025);
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
    drawRows(ctx, rows, w / 2, h * 0.48, size, 1.1, p.text);
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
      drawRows(ctx, rows, w / 2, h * 0.44, size, 1.05, p.text);
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

export const EXTRA_MOTIVATIONAL_MAP = new Map(
  EXTRA_MOTIVATIONAL_ENGINES.map((e) => [e.id, e]),
);
