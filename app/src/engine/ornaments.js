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

  /**
   * A dove in flight: round head, oval body, one raised wing, a fanned tail.
   *
   * Two loose curves - which is what this was - read as a leaf, and a leaf on
   * a baptism card is not a near miss, it is the wrong drawing. The head is a
   * circle on purpose: at 50px with a hairline stroke, a shape the eye can
   * name beats a shape that is anatomically closer.
   */
  dove: {
    w: 36, h: 28,
    draw(ctx) {
      // Body.
      ctx.beginPath();
      ctx.moveTo(8, 20);
      ctx.bezierCurveTo(10, 26, 24, 25, 26, 16);
      ctx.bezierCurveTo(27, 12, 22, 9, 16, 11);
      ctx.bezierCurveTo(10, 13, 7, 16, 8, 20);
      ctx.stroke();
      // Head and beak.
      ctx.beginPath();
      ctx.arc(28, 9, 4.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(32, 8.4);
      ctx.lineTo(36, 10.2);
      ctx.lineTo(32, 11.2);
      ctx.stroke();
      // The raised wing.
      ctx.beginPath();
      ctx.moveTo(14, 15);
      ctx.quadraticCurveTo(15, 4, 24, 2);
      ctx.quadraticCurveTo(21, 10, 22, 17);
      ctx.stroke();
      // Tail feathers.
      ctx.beginPath();
      ctx.moveTo(9, 18.5);
      ctx.lineTo(1, 14.5);
      ctx.moveTo(9, 21);
      ctx.lineTo(1, 22);
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

  /** A small heraldic shield. Reads as a monogram crest at any size. */
  crest: {
    w: 40, h: 50,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(4, 4);
      ctx.lineTo(36, 4);
      ctx.lineTo(36, 26);
      ctx.quadraticCurveTo(36, 42, 20, 47);
      ctx.quadraticCurveTo(4, 42, 4, 26);
      ctx.closePath();
      ctx.stroke();
      line(ctx, 10, 13, 30, 13);
    },
  },

  /** A broken ring, for initials to sit inside. */
  'monogram-ring': {
    w: 52, h: 52,
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(26, 26, 24, 0.42, Math.PI * 2 - 0.42);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(26, 26, 19.5, 0.52, Math.PI * 2 - 0.52);
      ctx.stroke();
    },
  },

  lotus: {
    w: 56, h: 40,
    draw(ctx) {
      for (const [dx, lean] of [[0, 0], [-13, -0.42], [13, 0.42], [-24, -0.8], [24, 0.8]]) {
        ctx.save();
        ctx.translate(28 + dx, 36);
        ctx.rotate(lean);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-8, -18, 0, -30);
        ctx.quadraticCurveTo(8, -18, 0, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    },
  },

  paisley: {
    w: 34, h: 48,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(17, 46);
      ctx.bezierCurveTo(1, 38, 2, 14, 15, 6);
      ctx.bezierCurveTo(26, 0, 33, 10, 28, 18);
      ctx.bezierCurveTo(24, 24, 16, 22, 17, 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(17, 40);
      ctx.bezierCurveTo(7, 34, 8, 18, 17, 13);
      ctx.stroke();
    },
  },

  /** Art-deco fan: the Chrysler Building in twelve strokes. */
  'deco-fan': {
    w: 60, h: 34,
    draw(ctx) {
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        line(ctx, 30, 32, 30 + Math.cos(a) * 27, 32 + Math.sin(a) * 27);
      }
      ctx.beginPath();
      ctx.arc(30, 32, 27, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(30, 32, 15, Math.PI, 0);
      ctx.stroke();
    },
  },

  /** A scrolling flourish for a corner, drawn pointing down-right. */
  filigree: {
    w: 46, h: 46,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.bezierCurveTo(26, 4, 42, 20, 44, 44);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, 4);
      ctx.bezierCurveTo(22, 14, 20, 26, 11, 25);
      ctx.bezierCurveTo(5, 24, 6, 16, 13, 17);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(42, 36);
      ctx.bezierCurveTo(32, 24, 20, 26, 21, 35);
      ctx.bezierCurveTo(22, 41, 30, 40, 29, 33);
      ctx.stroke();
    },
  },

  wreath: {
    w: 56, h: 56,
    draw(ctx, o) {
      ctx.fillStyle = o.stroke;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU - Math.PI / 2;
        const x = 28 + Math.cos(a) * 21;
        const y = 28 + Math.sin(a) * 21;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2);
        leaf(ctx, 0, 0, 8, 3.2, i % 2 ? 1 : -1);
        ctx.restore();
      }
    },
  },

  chandelier: {
    w: 44, h: 50,
    draw(ctx, o) {
      line(ctx, 22, 2, 22, 14);
      ctx.beginPath();
      ctx.moveTo(6, 18);
      ctx.quadraticCurveTo(22, 10, 38, 18);
      ctx.stroke();
      ctx.fillStyle = o.stroke;
      for (const [x, len] of [[8, 14], [15, 22], [22, 28], [29, 22], [36, 14]]) {
        line(ctx, x, 18, x, 18 + len);
        dot(ctx, x, 18 + len + 2.4, 2.2);
      }
    },
  },

  'olive-branch': {
    w: 56, h: 30,
    draw(ctx, o) {
      ctx.beginPath();
      ctx.moveTo(2, 26);
      ctx.quadraticCurveTo(26, 22, 54, 5);
      ctx.stroke();
      ctx.fillStyle = o.stroke;
      for (let i = 0; i < 5; i++) {
        const t = 0.12 + i * 0.19;
        const x = 2 + (26 - 2) * 2 * t * (1 - t) + (54 - 2) * t * t;
        const y = 26 + (22 - 26) * 2 * t * (1 - t) + (5 - 26) * t * t;
        leaf(ctx, x, y, 10, 3.6, 1);
        leaf(ctx, x, y - 2, -9, 3.2, -1);
      }
    },
  },

  quill: {
    w: 34, h: 46,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(4, 43);
      ctx.quadraticCurveTo(18, 30, 30, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(30, 3);
      ctx.quadraticCurveTo(12, 10, 9, 33);
      ctx.quadraticCurveTo(22, 28, 30, 3);
      ctx.closePath();
      ctx.stroke();
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

  /** A double rule with a scroll at each corner. The dress-uniform frame. */
  ornate(ctx, x, y, w, h, o) {
    const gap = o.gap != null ? o.gap : 7;
    ctx.strokeRect(x, y, w, h);
    const inner = ctx.lineWidth;
    ctx.lineWidth = inner * 0.55;
    ctx.strokeRect(x + gap, y + gap, w - gap * 2, h - gap * 2);
    ctx.lineWidth = inner;
    const arm = 18;
    for (const [cx, cy, sx, sy] of [
      [x + gap, y + gap, 1, 1], [x + w - gap, y + gap, -1, 1],
      [x + gap, y + h - gap, 1, -1], [x + w - gap, y + h - gap, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx + arm * sx, cy);
      ctx.quadraticCurveTo(cx + arm * 0.3 * sx, cy + arm * 0.3 * sy, cx, cy + arm * sy);
      ctx.stroke();
    }
  },

  /** Scalloped edge, like a pressed card. */
  scallop(ctx, x, y, w, h, o) {
    const r = o.scallop != null ? o.scallop : 9;
    ctx.beginPath();
    // `side` names which edge is being drawn. It used to double as the
    // "is this horizontal" flag, and 'left' and 'right' are truthy strings,
    // so the two vertical edges were drawn with the horizontal formula and
    // the frame came out as a scribble of diagonals across the card.
    const run = (from, to, side, flip) => {
      const horizontal = side === 'top' || side === 'bottom';
      const span = Math.abs(to - from);
      const n = Math.max(2, Math.round(span / (r * 2)));
      const step = span / n;
      for (let i = 0; i < n; i++) {
        const a = from + step * i * (to > from ? 1 : -1);
        const b = from + step * (i + 1) * (to > from ? 1 : -1);
        const mid = (a + b) / 2;
        if (horizontal) ctx.quadraticCurveTo(mid, flip, b, side === 'top' ? y : y + h);
        else ctx.quadraticCurveTo(flip, mid, side === 'left' ? x : x + w, b);
      }
    };
    ctx.moveTo(x, y);
    run(x, x + w, 'top', y - r);
    run(y, y + h, 'right', x + w + r);
    run(x + w, x, 'bottom', y + h + r);
    run(y + h, y, 'left', x - r);
    ctx.closePath();
    ctx.stroke();
  },

  /** A border of beads rather than a line. */
  /**
   * A hairline threaded with pearls.
   *
   * Beads alone, small and far apart, read as a dashed border from a slide
   * deck rather than as beading. The continuous rule underneath is what makes
   * it a border; the pearls sitting on it are what make it beaded.
   */
  beaded(ctx, x, y, w, h, o) {
    const step = o.bead != null ? o.bead : 11;
    const r = Math.max(1.5, ctx.lineWidth * 1.5);
    const line = ctx.lineWidth;

    ctx.save();
    ctx.lineWidth = line * 0.6;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    ctx.fillStyle = ctx.strokeStyle;
    const put = (px, py) => { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); };
    const across = Math.max(2, Math.round(w / step));
    const down = Math.max(2, Math.round(h / step));
    for (let i = 0; i <= across; i++) { put(x + (w / across) * i, y); put(x + (w / across) * i, y + h); }
    for (let i = 1; i < down; i++) { put(x, y + (h / down) * i); put(x + w, y + (h / down) * i); }
  },

  /** A filled panel sitting inside the frame, for text to rest on. */
  'inset-panel'(ctx, x, y, w, h, o) {
    if (o.panelFill) {
      ctx.fillStyle = o.panelFill;
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeRect(x, y, w, h);
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

  /** Fine speckle. Stops a flat fill looking like a flat fill. */
  paper(ctx, x, y, w, h, o) {
    const rand = rng(o.seed || 17);
    ctx.fillStyle = o.fill || '#000';
    const count = o.count || Math.round((w * h) / 420);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 0.05) * (0.35 + rand() * 0.65);
      dot(ctx, x + rand() * w, y + rand() * h, 0.4 + rand() * 0.9);
    }
  },

  /** A woven crosshatch, for designs that want to feel like cloth or card. */
  linen(ctx, x, y, w, h, o) {
    const step = o.step || 5;
    ctx.strokeStyle = o.fill || '#000';
    ctx.globalAlpha = o.alpha != null ? o.alpha : 0.045;
    ctx.lineWidth = 0.6;
    for (let px = x; px < x + w; px += step) line(ctx, px, y, px, y + h);
    for (let py = y; py < y + h; py += step) line(ctx, x, py, x + w, py);
  },

  /** Coarser film grain, for dark grounds that would otherwise band. */
  grain(ctx, x, y, w, h, o) {
    const rand = rng(o.seed || 29);
    const count = o.count || Math.round((w * h) / 200);
    for (let i = 0; i < count; i++) {
      const v = rand();
      ctx.fillStyle = v > 0.5 ? '#ffffff' : '#000000';
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 0.05) * rand();
      ctx.fillRect(x + rand() * w, y + rand() * h, 1, 1);
    }
  },

  /** Darkened edges. Pushes the eye to the middle, like a lit photograph. */
  vignette(ctx, x, y, w, h, o) {
    const g = ctx.createRadialGradient(
      x + w / 2, y + h * 0.45, Math.min(w, h) * 0.26,
      x + w / 2, y + h * 0.45, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${o.alpha != null ? o.alpha : 0.34})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
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

  // `height` is the size a design asks for, and most motifs are about as wide
  // as they are tall, so scaling by height is right for them. The rule-shaped
  // ones are not: dot-rule is 80x6, so asking for 56 asks for something 746px
  // wide on a 360px frame, and what lands is four enormous dots with the rest
  // off the edge. Nothing may be drawn wider than the live measure.
  const maxWidth = opts.maxWidth || 240;
  const scale = Math.min(height / m.h, maxWidth / m.w);
  const stroke = opts.stroke || opts.fill || '#000';

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.rotate) ctx.rotate(opts.rotate);
  ctx.translate(-(m.w * scale) / 2, -(m.h * scale) / 2);
  ctx.scale(scale, scale);
  ctx.lineWidth = (opts.width || 1.6) / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // A gradient has to be built under this transform, in the motif's own
  // coordinate space, or a foil highlight lands somewhere off the shape.
  const resolved = opts.resolve
    ? opts.resolve(ctx, { x: 0, y: 0, w: m.w, h: m.h })
    : { stroke, fill: opts.fill };
  const strokeStyle = resolved.stroke || stroke;
  const fillStyle = resolved.fill || strokeStyle;

  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = fillStyle;
  m.draw(ctx, { stroke: strokeStyle, fill: fillStyle });
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
