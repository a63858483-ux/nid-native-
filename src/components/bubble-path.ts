// One continuous outline for body + tail, so a fill, blur or mask never shows a seam.
// The tail sits outside the body box by TAIL_W on the tail side.
export const TAIL_W = 7;
const R = 18;

export function bubblePath(w: number, h: number, tail: 'left' | 'right' | null): string {
  const r = Math.min(R, h / 2, w / 2);
  const x0 = tail === 'left' ? TAIL_W : 0;
  const x1 = x0 + w;
  if (!tail) {
    return [
      `M${x0 + r} 0H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${r}V${h - r}A${r} ${r} 0 0 1 ${x1 - r} ${h}`,
      `H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${h - r}V${r}A${r} ${r} 0 0 1 ${x0 + r} 0Z`,
    ].join('');
  }
  const t = Math.min(r, 16);
  if (tail === 'right') {
    return [
      `M${x0 + r} 0H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${r}`,
      `V${h - t * 0.85}`,
      `C${x1} ${h - t * 0.25} ${x1 + TAIL_W * 0.45} ${h - 0.4} ${x1 + TAIL_W} ${h}`,
      `C${x1 + TAIL_W * 0.2} ${h + 0.35} ${x1 - TAIL_W * 0.35} ${h - 0.4} ${x1 - TAIL_W * 1.05} ${h - 1.9}`,
      `C${x1 - TAIL_W * 1.6} ${h - 0.3} ${x1 - TAIL_W * 2.4} ${h} ${x1 - t * 1.05} ${h}`,
      `H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${h - r}V${r}A${r} ${r} 0 0 1 ${x0 + r} 0Z`,
    ].join('');
  }
  return [
    `M${x1 - r} 0H${x0 + r}A${r} ${r} 0 0 0 ${x0} ${r}`,
    `V${h - t * 0.85}`,
    `C${x0} ${h - t * 0.25} ${x0 - TAIL_W * 0.45} ${h - 0.4} ${x0 - TAIL_W} ${h}`,
    `C${x0 - TAIL_W * 0.2} ${h + 0.35} ${x0 + TAIL_W * 0.35} ${h - 0.4} ${x0 + TAIL_W * 1.05} ${h - 1.9}`,
    `C${x0 + TAIL_W * 1.6} ${h - 0.3} ${x0 + TAIL_W * 2.4} ${h} ${x0 + t * 1.05} ${h}`,
    `H${x1 - r}A${r} ${r} 0 0 0 ${x1} ${h - r}V${r}A${r} ${r} 0 0 0 ${x1 - r} 0Z`,
  ].join('');
}
