/**
 * Text layout for the canvas.
 *
 * Two things matter here and both come from the quality bar in CLAUDE.md: a
 * design has to look right with a short name and with a very long one, and
 * Malayalam has to shape correctly. Shaping is the browser's job once the
 * right font is loaded; fitting is ours.
 */

/**
 * Break `text` into at most `maxLines` lines that each fit `maxWidth`.
 *
 * Breaks on spaces only. A word too long for the box is left long on purpose,
 * so the caller can shrink the type instead: breaking "Padmavathy" into
 * "Padmava / thy" is worse than any font size, and it is what this did until
 * the hard wrap was moved out of here and made a last resort.
 */
export function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

/**
 * Break on characters. Only ever reached once the type is already as small as
 * the design permits and a single word still will not fit - a 30-character
 * unbroken name at minSize. Running off the edge of the card is worse.
 */
export function hardWrap(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) return lines;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Choose the largest font size at which `text` fits the given box.
 *
 * @returns {{size: number, lines: string[], lineHeight: number}}
 */
export function layoutText(ctx, text, opts) {
  const {
    family,
    weight = 400,
    size,
    maxWidth,
    maxLines = 1,
    lineHeight = 1.18,
    minSize = Math.max(10, size * 0.5),
  } = opts;

  let s = size;
  let lines = [String(text)];

  for (;;) {
    ctx.font = `${weight} ${s}px ${family}`;
    lines = maxLines === 1 ? [String(text)] : wrapLines(ctx, text, maxWidth, maxLines);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxWidth || s <= minSize) break;
    // Step proportionally: a 3x-too-wide name should not take 200 iterations.
    s = Math.max(minSize, Math.min(s - 1, Math.floor(s * (maxWidth / widest))));
  }

  // Shrinking has gone as far as the design allows and one word still does not
  // fit. Now, and only now, break it on characters.
  if (maxLines > 1 && lines.length === 1 && ctx.measureText(lines[0]).width > maxWidth) {
    lines = hardWrap(ctx, lines[0], maxWidth, maxLines);
  }

  ctx.font = `${weight} ${s}px ${family}`;
  return { size: s, lines, lineHeight: s * lineHeight };
}

/** Draw already-laid-out lines centred on (x, y) as the block's middle. */
export function drawLines(ctx, lines, x, y, lineHeight, align = 'center') {
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const total = (lines.length - 1) * lineHeight;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y - total / 2 + i * lineHeight);
  });
}
