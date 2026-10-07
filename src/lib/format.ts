/** Round half away from zero (what people expect), tolerant of binary floating-point error. */
export function roundHalfUp(x: number, d: number): number {
  const m = 10 ** d
  const r = (Math.sign(x) * Math.round(Math.abs(x) * m + 1e-9)) / m
  return r === 0 ? 0 : r
}
export function fmt(x: number, d = 2): string {
  return roundHalfUp(x, d).toFixed(d)
}
export function signed(x: number, d = 2): string {
  const s = fmt(x, d)
  return roundHalfUp(x, d) > 0 ? `+${s}` : s
}
export function pct(x: number, d = 1): string {
  return `${fmt(x, d)}%`
}
