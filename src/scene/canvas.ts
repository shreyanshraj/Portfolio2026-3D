// getContext('2d') is typed as possibly null; every browser that runs the room
// has a 2D canvas, so fail loudly instead of checking at each call site.
export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d')
  if (!g) throw new Error('2D canvas not available')
  return g
}
