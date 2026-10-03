/**
 * The design kit: every piece of artwork the templates draw with.
 *
 * All of it is ours, drawn as canvas paths - CLAUDE.md allows no copied
 * artwork, and vector paths stay crisp at any output size and weigh nothing.
 *
 * Three kinds:
 *   motifs   fixed aspect, drawn centred at a point at a given height
 *   frames   drawn across a rectangle, usually the whole invite
 *   patterns fill an area with a deterministic scatter
 *
 * A design composes these by name. Adding a design never needs new code here;
 * adding a new *kind* of decoration does, and that is the intended seam.
 */

const TAU = Math.PI * 2;

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A leaf pointing along +x, rooted at (x, y). */
function leaf(ctx, x, y, len, wide, dir = 1) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.45, y - wide * dir, x + len, y);
  ctx.quadraticCurveTo(x + len * 0.45, y + wide * dir * 0.35, x, y);
  ctx.closePath();
  ctx.fill();
}

/** Small deterministic generator, so a scatter looks random but never moves. */
function rng(seed) {
  let s = (seed || 1) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------------------ motifs */

export const MOTIFS = {
  /** Nilavilakku, the Kerala lamp. */
  lamp: {
    w: 22, h: 30,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(11, 2);
      ctx.bezierCurveTo(14, 6, 14, 9, 11, 11);
      ctx.bezierCurveTo(8, 9, 8, 6, 11, 2);
      ctx.closePath();
      ctx.stroke();
      line(ctx, 3, 13, 19, 13);
      line(ctx, 11, 13, 11, 24);
      line(ctx, 8, 24, 14, 24);
      line(ctx, 5, 28, 17, 28);
    },
  },

  diya: {
    w: 28, h: 22,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.bezierCurveTo(17, 6, 17, 9, 14, 11);
      ctx.bezierCurveTo(11, 9, 11, 6, 14, 2);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, 13);
      ctx.quadraticCurveTo(14, 23, 25, 13);
      ctx.closePath();
      ctx.stroke();
    },
  },

  crescent: {
    w: 32, h: 32,
    fillOnly: true,
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(16, 16, 15, 0, TAU);
      ctx.arc(24, 13, 14, 0, TAU);
      ctx.fill('evenodd');
    },
  },

  cross: {
    w: 20, h: 30,
    draw(ctx) {
      line(ctx, 10, 1, 10, 29);
      line(ctx, 2, 10, 18, 10);
    },
  },

  dove: {
    w: 34, h: 24,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(2, 16);
      ctx.quadraticCurveTo(12, 20, 22, 14);
      ctx.quadraticCurveTo(30, 10, 32, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, 15);
      ctx.quadraticCurveTo(15, 4, 24, 6);
      ctx.stroke();
    },
  },

  bell: {
    w: 24, h: 26,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(4, 19);
      ctx.bezierCurveTo(4, 9, 8, 6, 12, 5);
      ctx.bezierCurveTo(16, 6, 20, 9, 20, 19);
      ctx.closePath();
      ctx.stroke();
      line(ctx, 2, 19, 22, 19);
      ctx.beginPath();
      ctx.arc(12, 23, 2.2, 0, TAU);
      ctx.stroke();
      line(ctx, 12, 2, 12, 5);
    },
  },

  rings: {
    w: 36, h: 24,
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(13, 13, 9.5, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(24, 13, 9.5, 0, TAU);
      ctx.stroke();
    },
  },

  heart: {
    w: 28, h: 26,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(14, 24);
      ctx.bezierCurveTo(2, 15, 2, 5, 9, 4);
      ctx.bezierCurveTo(12, 3.4, 14, 6, 14, 8);
      ctx.bezierCurveTo(14, 6, 16, 3.4, 19, 4);
      ctx.bezierCurveTo(26, 5, 26, 15, 14, 24);
      ctx.closePath();
      ctx.stroke();
    },
  },

  flourish: {
    w: 60, h: 10,
    draw(ctx) {
      line(ctx, 0, 5, 22, 5);
      line(ctx, 38, 5, 60, 5);
      ctx.beginPath();
      ctx.moveTo(26, 5);
      ctx.lineTo(30, 1);
      ctx.lineTo(34, 5);
      ctx.lineTo(30, 9);
      ctx.closePath();
      ctx.stroke();
    },
  },

  'flourish-leaf': {
    w: 72, h: 14,
    draw(ctx, o) {
      line(ctx, 0, 7, 26, 7);
      line(ctx, 46, 7, 72, 7);
      ctx.fillStyle = o.stroke;
      leaf(ctx, 36, 7, 10, 4, 1);
      leaf(ctx, 36, 7, -10, 4, -1);
      dot(ctx, 36, 7, 1.6);
    },
  },

  sprig: {
    w: 30, h: 46,
    draw(ctx, o) {
      ctx.beginPath();
      ctx.moveTo(15, 46);
      ctx.quadraticCurveTo(13, 24, 15, 2);
      ctx.stroke();
      ctx.fillStyle = o.stroke;
      for (let i = 0; i < 5; i++) {
        const y = 38 - i * 7.5;
        leaf(ctx, 15, y, 11 - i * 1.1, 4.2, 1);
        leaf(ctx, 15, y - 3.4, -(11 - i * 1.1), 4.2, -1);
      }
    },
  },

  laurel: {
    w: 64, h: 50,
    draw(ctx, o) {
      ctx.fillStyle = o.stroke;
      for (const dir of [-1, 1]) {
        const cx = 32 + dir * 4;
        ctx.beginPath();
        ctx.moveTo(cx, 48);
        ctx.quadraticCurveTo(cx + dir * 26, 34, cx + dir * 20, 4);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const t = 0.18 + i * 0.17;
          const x = cx + dir * (26 * 2 * t * (1 - t) + 20 * t * t);
          const y = 48 + (34 - 48) * 2 * t * (1 - t) + (4 - 48) * t * t;
          leaf(ctx, x, y, dir * 9, 3.6, dir);
        }
      }
    },
  },

  mandala: {
    w: 60, h: 60,
    draw(ctx, o) {
      ctx.beginPath();
      ctx.arc(30, 30, 7, 0, TAU);
      ctx.stroke();
      for (const [r, petals, len] of [[12, 8, 7], [22, 12, 9]]) {
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * TAU;
          const x = 30 + Math.cos(a) * r;
          const y = 30 + Math.sin(a) * r;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a);
          ctx.fillStyle = o.stroke;
          leaf(ctx, 0, 0, len, len * 0.42, 1);
          ctx.restore();
        }
      }
      ctx.beginPath();
      ctx.arc(30, 30, 29, 0, TAU);
      ctx.stroke();
    },
  },

  starburst: {
    w: 44, h: 44,
    draw(ctx) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const inner = i % 2 ? 7 : 5;
        const outer = i % 2 ? 16 : 21;
        line(ctx, 22 + Math.cos(a) * inner, 22 + Math.sin(a) * inner,
             22 + Math.cos(a) * outer, 22 + Math.sin(a) * outer);
      }
    },
  },

  sparkle: {
    w: 24, h: 24,
    fillOnly: true,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.quadraticCurveTo(13.4, 10.6, 24, 12);
      ctx.quadraticCurveTo(13.4, 13.4, 12, 24);
      ctx.quadraticCurveTo(10.6, 13.4, 0, 12);
      ctx.quadraticCurveTo(10.6, 10.6, 12, 0);
      ctx.closePath();
      ctx.fill();
    },
  },

  'balloon-cluster': {
    w: 46, h: 58,
    draw(ctx) {
      const balloons = [[13, 15, 11], [32, 12, 12], [23, 27, 10]];
      for (const [x, y, r] of balloons) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.86, r, 0, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + r);
        ctx.quadraticCurveTo(x + (x > 23 ? -5 : 5), y + r + 12, 23, 56);
        ctx.stroke();
      }
    },
  },

  cake: {
    w: 48, h: 44,
    draw(ctx) {
      line(ctx, 24, 2, 24, 8);
      ctx.beginPath();
      ctx.ellipse(24, 10, 2.4, 3.4, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 42); ctx.lineTo(8, 24);
      ctx.quadraticCurveTo(24, 18, 40, 24);
      ctx.lineTo(40, 42);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 31);
      ctx.quadraticCurveTo(16, 36, 24, 31);
      ctx.quadraticCurveTo(32, 26, 40, 31);
      ctx.stroke();
    },
  },

  candle: {
    w: 20, h: 40,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.bezierCurveTo(13.4, 7, 13.4, 11, 10, 13);
      ctx.bezierCurveTo(6.6, 11, 6.6, 7, 10, 2);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(5, 16, 10, 22);
      ctx.stroke();
    },
  },

  'graduation-cap': {
    w: 48, h: 34,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(24, 3); ctx.lineTo(46, 12); ctx.lineTo(24, 21); ctx.lineTo(2, 12);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, 15.5); ctx.lineTo(10, 25);
      ctx.quadraticCurveTo(24, 32, 38, 25);
      ctx.lineTo(38, 15.5);
      ctx.stroke();
      line(ctx, 44, 12.8, 44, 26);
      dot(ctx, 44, 27.6, 2);
    },
  },

  house: {
    w: 46, h: 40,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(2, 19); ctx.lineTo(23, 2); ctx.lineTo(44, 19);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(7, 17); ctx.lineTo(7, 38); ctx.lineTo(39, 38); ctx.lineTo(39, 17);
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(19, 25, 9, 13);
      ctx.stroke();
    },
  },

  rattle: {
    w: 34, h: 40,
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(17, 13, 11, 0, TAU);
      ctx.stroke();
      line(ctx, 17, 24, 17, 34);
      ctx.beginPath();
      ctx.rect(12, 34, 10, 5);
      ctx.stroke();
      dot(ctx, 13, 11, 1.4);
      dot(ctx, 21, 11, 1.4);
    },
  },

  sun: {
    w: 48, h: 48,
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(24, 24, 11, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        line(ctx, 24 + Math.cos(a) * 15, 24 + Math.sin(a) * 15,
             24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22);
      }
    },
  },

  diamond: {
    w: 24, h: 24,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(12, 1); ctx.lineTo(23, 12); ctx.lineTo(12, 23); ctx.lineTo(1, 12);
      ctx.closePath();
      ctx.stroke();
    },
  },

  'dot-rule': {
    w: 80, h: 6,
    draw(ctx, o) {
      ctx.fillStyle = o.stroke;
      for (let i = 0; i <= 8; i++) dot(ctx, i * 10, 3, i === 4 ? 2.4 : 1.2);
    },
  },

  wave: {
    w: 64, h: 12,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(0, 6);
      for (let i = 0; i < 4; i++) {
        ctx.quadraticCurveTo(8 + i * 16, 0, 16 + i * 16, 6);
        ctx.quadraticCurveTo(24 + i * 16, 12, 32 + i * 16, 6);
      }
      ctx.stroke();
    },
  },
};

/* ------------------------------------------------------------------ frames */

export const FRAMES = {
  thin(ctx, x, y, w, h) {
    ctx.strokeRect(x, y, w, h);
  },

  double(ctx, x, y, w, h, o) {
    const gap = o.gap != null ? o.gap : 5;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = (o.width || 1) * 0.6;
    ctx.strokeRect(x + gap, y + gap, w - gap * 2, h - gap * 2);
  },

  corners(ctx, x, y, w, h, o) {
    const n = o.arm != null ? o.arm : 26;
    for (const [cx, cy, sx, sy] of [
      [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
    ]) {
      line(ctx, cx, cy, cx + n * sx, cy);
      line(ctx, cx, cy, cx, cy + n * sy);
    }
  },

  /** Art deco: a thin rect with stepped corners cut into it. */
  deco(ctx, x, y, w, h, o) {
    const s = o.step != null ? o.step : 14;
    ctx.beginPath();
    ctx.moveTo(x + s, y);
    ctx.lineTo(x + w - s, y);
    ctx.lineTo(x + w, y + s);
    ctx.lineTo(x + w, y + h - s);
    ctx.lineTo(x + w - s, y + h);
    ctx.lineTo(x + s, y + h);
    ctx.lineTo(x, y + h - s);
    ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.stroke();
  },

  /** A panel with a rounded arch at the top. */
  arch(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
  },

  rounded(ctx, x, y, w, h, o) {
    const r = Math.min(o.radius != null ? o.radius : 14, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.stroke();
  },

  /** Thin rule inset top and bottom only - quiet, works under any typeface. */
  rules(ctx, x, y, w, h) {
    line(ctx, x, y, x + w, y);
    line(ctx, x, y + h, x + w, y + h);
  },
};

/* ---------------------------------------------------------------- patterns */

export const PATTERNS = {
  confetti(ctx, x, y, w, h, o) {
    const rand = rng(o.seed || 7);
    const count = o.count || 46;
    const colours = o.colours && o.colours.length ? o.colours : [o.fill || '#fff'];
    for (let i = 0; i < count; i++) {
      const px = x + rand() * w;
      const py = y + rand() * h;
      const size = 3 + rand() * 5;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rand() * TAU);
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 0.9) * (0.5 + rand() * 0.5);
      ctx.fillStyle = colours[Math.floor(rand() * colours.length)];
      if (rand() > 0.55) ctx.fillRect(-size / 2, -size / 5, size, size / 2.4);
      else dot(ctx, 0, 0, size / 2.6);
      ctx.restore();
    }
  },

  dots(ctx, x, y, w, h, o) {
    const step = o.step || 26;
    ctx.fillStyle = o.fill || '#000';
    ctx.globalAlpha = o.alpha != null ? o.alpha : 0.25;
    for (let py = y + step / 2; py < y + h; py += step) {
      for (let px = x + step / 2; px < x + w; px += step) dot(ctx, px, py, o.size || 1.3);
    }
  },

  stars(ctx, x, y, w, h, o) {
    const rand = rng(o.seed || 3);
    ctx.fillStyle = o.fill || '#fff';
    for (let i = 0; i < (o.count || 60); i++) {
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 0.8) * (0.25 + rand() * 0.75);
      dot(ctx, x + rand() * w, y + rand() * h, 0.6 + rand() * 1.6);
    }
  },

  /** Soft rays from a point, for a celebratory backdrop. */
  rays(ctx, x, y, w, h, o) {
    const cx = x + w * (o.cx != null ? o.cx : 0.5);
    const cy = y + h * (o.cy != null ? o.cy : 0.3);
    const count = o.count || 16;
    const r = Math.hypot(w, h);
    ctx.globalAlpha = o.alpha != null ? o.alpha : 0.1;
    ctx.fillStyle = o.fill || '#fff';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + (o.rotate || 0);
      const spread = TAU / count / 2.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - spread) * r, cy + Math.sin(a - spread) * r);
      ctx.lineTo(cx + Math.cos(a + spread) * r, cy + Math.sin(a + spread) * r);
      ctx.closePath();
      ctx.fill();
    }
  },
};

/* ------------------------------------------------------------------- draw */

export function motifSize(name, height) {
  const m = MOTIFS[name];
  if (!m) return { width: 0, height: 0 };
  return { width: (height * m.w) / m.h, height };
}

/** Draw a motif centred on (cx, cy) at the given height. */
export function drawMotif(ctx, name, cx, cy, height, opts = {}) {
  const m = MOTIFS[name];
  if (!m) return;
  const scale = height / m.h;
  const stroke = opts.stroke || opts.fill || '#000';

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.rotate) ctx.rotate(opts.rotate);
  ctx.translate(-(m.w * scale) / 2, -height / 2);
  ctx.scale(scale, scale);
  ctx.lineWidth = (opts.width || 1.6) / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.fillStyle = opts.fill || stroke;
  m.draw(ctx, { stroke, fill: opts.fill || stroke });
  ctx.restore();
}

export function drawFrame(ctx, name, x, y, w, h, opts = {}) {
  const fn = FRAMES[name];
  if (!fn) return;
  ctx.save();
  ctx.strokeStyle = opts.stroke || '#000';
  ctx.lineWidth = opts.width || 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  fn(ctx, x, y, w, h, opts);
  ctx.restore();
}

export function drawPattern(ctx, name, x, y, w, h, opts = {}) {
  const fn = PATTERNS[name];
  if (!fn) return;
  ctx.save();
  fn(ctx, x, y, w, h, opts);
  ctx.restore();
}

export const motifNames = Object.keys(MOTIFS);
export const frameNames = Object.keys(FRAMES);
export const patternNames = Object.keys(PATTERNS);
