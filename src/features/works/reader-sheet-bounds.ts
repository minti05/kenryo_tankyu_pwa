export function sheetBounds() {
  const min = Math.min(180, Math.max(100, window.innerHeight * 0.3));
  return { min, max: Math.max(min, window.innerHeight - (window.innerHeight < 600 ? 220 : 280)) };
}
