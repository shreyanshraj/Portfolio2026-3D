import * as THREE from 'three'

// The visitor's local clock picks one of four moods for the room.
// Every mood uses the same lights and models; only these numbers change, so
// switching costs nothing to download and never recompiles a shader.

const v = (x, y, z) => new THREE.Vector3(x, y, z)

// Where every mood starts on page load: a dim room before the light arrives.
export const DIM = {
  bg: '#2A3150', sky: '#4E5A80', ground: '#1D2238', hemi: 0.45, fill: 0.12,
  sun: '#F0A65A', sunInt: 0, target: v(0.75, 0, 1.35), beam: 0, beamColor: '#F2C14E',
  outside: '#4E5A80', lamp: 0, screen: 0.15, tv: 0, desk: 0, bias: 0, shelf: 0,
}

export const PRESETS = {
  morning: {
    bg: '#CFDCE3', sky: '#E9EEF2', ground: '#B9A385', hemi: 2.6, fill: 1.3,
    sun: '#FFE2A8', sunInt: 4.2, target: v(0.75, 0, 1.35), beam: 0.07, beamColor: '#F2C14E',
    outside: '#FFFFFF', lamp: 0, screen: 0.6, tv: 0.35, desk: 1.6, bias: 0.08, shelf: 0,
  },
  day: {
    bg: '#D6E2E8', sky: '#F4F6F8', ground: '#C2AE90', hemi: 3.0, fill: 1.6,
    sun: '#FFF3D6', sunInt: 4.8, target: v(1.35, 0, 0.8), beam: 0.045, beamColor: '#FFE7A8',
    outside: '#FFFFFF', lamp: 0, screen: 0.6, tv: 0.35, desk: 1.1, bias: 0.06, shelf: 0,
  },
  evening: {
    bg: '#D3C4C6', sky: '#E7C9B0', ground: '#8E7356', hemi: 1.7, fill: 0.8,
    sun: '#F59E5B', sunInt: 4.4, target: v(0.3, 0, 1.9), beam: 0.1, beamColor: '#F2A65A',
    outside: '#FFFFFF', lamp: 1.4, screen: 0.9, tv: 0.6, desk: 4.5, bias: 0.2, shelf: 0.25,
  },
  night: {
    bg: '#1F2540', sky: '#4E5A80', ground: '#2A3150', hemi: 0.8, fill: 0.28,
    sun: '#A9BCE0', sunInt: 1.5, target: v(0.95, 0, 1.15), beam: 0.04, beamColor: '#A9BCE0',
    outside: '#FFFFFF', lamp: 3.2, screen: 1.8, tv: 1.0, desk: 7.5, bias: 0.35, shelf: 0.75,
  },
}

// What the window and glass door look out on, painted once per mood.
const OUTSIDE = {
  morning: { sky: ['#9EC0D6', '#E7E2CF', '#F2D79A'], ridge: '#B99C86', ground: '#A9B48F' },
  day: { sky: ['#7FAED0', '#BFD7E6', '#E4ECEF'], ridge: '#B99C86', ground: '#A9B48F' },
  evening: { sky: ['#6E7FB0', '#E8A27A', '#F2C14E'], ridge: '#8A6A70', ground: '#8D8F70' },
  night: { sky: ['#11162C', '#1F2747', '#2E3550'], ridge: '#262B45', ground: '#20263A', stars: true, moon: true },
}

export function paintOutside(phase, canvas) {
  const o = OUTSIDE[phase]
  const g = canvas.getContext('2d')
  const sky = g.createLinearGradient(0, 0, 0, 256)
  sky.addColorStop(0, o.sky[0])
  sky.addColorStop(0.55, o.sky[1])
  sky.addColorStop(0.68, o.sky[2])
  g.fillStyle = sky
  g.fillRect(0, 0, 256, 256)
  if (o.stars) {
    g.fillStyle = '#F7F8F5'
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 70; i++) g.fillRect(rnd() * 256, rnd() * 150, rnd() < 0.2 ? 2 : 1, rnd() < 0.2 ? 2 : 1)
  }
  if (o.moon) {
    g.fillStyle = '#E9EEF2'
    g.beginPath()
    g.arc(70, 60, 11, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = o.ridge
  g.beginPath()
  g.moveTo(0, 176)
  ;[[30, 160], [64, 168], [96, 146], [132, 164], [170, 150], [210, 166], [256, 154], [256, 256], [0, 256]].forEach(([x, y]) => g.lineTo(x, y))
  g.fill()
  g.fillStyle = o.ground
  g.fillRect(0, 190, 256, 66)
}

// Materials that glow on their own (lamp shade, laptop screen, TV screen).
// Model registers them here; Lighting sets their brightness each frame.
export const GLOW = { lamp: new Set(), screen: new Set(), tv: new Set(), desk: new Set() }
// Lights placed by the scene (the desk spots) that Lighting dims and brightens.
export const LIGHTS = { desk: new Set() }

// What the glass door opens onto: a small walled garden with a lawn, a stone
// path, a planter of flowers, bougainvillea on the wall, a citrus tree and
// round shrubs, deliberately unlike the open ridge seen from the window.
// The garden is painted once in daylight colours, then tinted for the mood.
const GARDEN = {
  morning: { sky: ['#9EC0D6', '#DCE3DA', '#F2D79A'], tint: 'rgba(242,193,78,0.10)' },
  day: { sky: ['#7FAED0', '#BFD7E6', '#E4ECEF'], tint: null },
  evening: { sky: ['#6E7FB0', '#E8A27A', '#F2C14E'], tint: 'rgba(181,104,75,0.32)' },
  night: { sky: ['#11162C', '#1A2140', '#262E4C'], tint: 'rgba(14,18,38,0.66)', stars: true, stringLights: true },
}
const G = {
  wall: '#E8D8BA', cap: '#D2BC97', grassFar: '#8FB26A', grassNear: '#7AA05A', stone: '#DDD3C2', stoneEdge: '#C4B8A4',
  leaf: '#5E7A5A', leafLight: '#7E9C64', leafDark: '#4A6648', trunk: '#7A5A44', wood: '#8E6B4F', woodDark: '#6E513C',
  pot: '#C07A5E', bloom: '#D9628C', orange: '#F2A03D',
  flowers: ['#B58CC9', '#F2A65A', '#F7F8F5', '#E26D7A', '#F2C14E'],
}

// Canvas is 256 x 416 to match the door's proportions.
export function paintDoorView(phase, canvas) {
  const o = GARDEN[phase]
  const W = 256, H = 416
  const WALL_TOP = 230, WALL_BOTTOM = 280
  const g = canvas.getContext('2d')

  // sky
  const sky = g.createLinearGradient(0, 0, 0, WALL_TOP)
  sky.addColorStop(0, o.sky[0])
  sky.addColorStop(0.7, o.sky[1])
  sky.addColorStop(1, o.sky[2])
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  if (o.stars) {
    g.fillStyle = '#F7F8F5'
    let seed = 31
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 55; i++) g.fillRect(rnd() * W, rnd() * 170, rnd() < 0.2 ? 2 : 1, rnd() < 0.2 ? 2 : 1)
  }

  // the garden goes on its own layer so the mood tint doesn't touch the sky
  const layer = document.createElement('canvas')
  layer.width = W
  layer.height = H
  const d = layer.getContext('2d')
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const circle = (x, y, r, c) => {
    d.fillStyle = c
    d.beginPath()
    d.arc(x, y, r, 0, Math.PI * 2)
    d.fill()
  }
  const flowersOn = (cx, cy, rx, ry, n, size = 2.6) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd())
      circle(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, size * (0.7 + rnd() * 0.6), G.flowers[Math.floor(rnd() * G.flowers.length)])
    }
  }

  // citrus tree behind the wall, right side, with oranges
  d.fillStyle = G.trunk
  d.fillRect(184, 170, 9, 70)
  ;[[188, 128, 40, G.leafDark], [160, 146, 28, G.leaf], [214, 150, 28, G.leaf], [188, 112, 30, G.leafLight], [176, 160, 22, G.leafLight]].forEach(([x, y, r, c]) => circle(x, y, r, c))
  ;[[170, 120], [200, 104], [212, 140], [180, 150], [196, 162], [156, 140], [226, 126]].forEach(([x, y]) => circle(x, y, 4, G.orange))

  // stucco garden wall with a cap
  d.fillStyle = G.wall
  d.fillRect(0, WALL_TOP, W, WALL_BOTTOM - WALL_TOP)
  d.fillStyle = G.cap
  d.fillRect(0, WALL_TOP - 6, W, 8)

  // bougainvillea spilling over the left of the wall
  for (let i = 0; i < 26; i++) circle(10 + rnd() * 120, WALL_TOP - 10 + rnd() * 46, 7 + rnd() * 8, rnd() < 0.5 ? G.leaf : G.leafLight)
  for (let i = 0; i < 46; i++) circle(10 + rnd() * 120, WALL_TOP - 14 + rnd() * 50, 2.5 + rnd() * 2.5, G.bloom)

  // lawn, lighter towards the back
  const lawn = d.createLinearGradient(0, WALL_BOTTOM, 0, H)
  lawn.addColorStop(0, G.grassFar)
  lawn.addColorStop(1, G.grassNear)
  d.fillStyle = lawn
  d.fillRect(0, WALL_BOTTOM, W, H - WALL_BOTTOM)
  d.strokeStyle = 'rgba(74,102,72,0.35)'
  d.lineWidth = 1
  for (let i = 0; i < 160; i++) {
    const x = rnd() * W, y = WALL_BOTTOM + 4 + rnd() * (H - WALL_BOTTOM)
    d.beginPath()
    d.moveTo(x, y)
    d.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 3)
    d.stroke()
  }

  // stepping-stone path winding back from the door
  ;[[118, 404, 26, 9], [134, 378, 23, 8], [122, 354, 20, 7], [138, 332, 17, 6], [128, 312, 14, 5], [138, 296, 11, 4]].forEach(([x, y, rx, ry]) => {
    d.fillStyle = G.stoneEdge
    d.beginPath()
    d.ellipse(x, y + 1.5, rx, ry, 0, 0, Math.PI * 2)
    d.fill()
    d.fillStyle = G.stone
    d.beginPath()
    d.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    d.fill()
  })

  // raised wooden planter along the wall, full of flowers
  d.fillStyle = G.woodDark
  d.fillRect(150, 286, 104, 22)
  d.fillStyle = G.wood
  d.fillRect(150, 282, 104, 8)
  ;[[166, 278, 16], [190, 274, 18], [216, 277, 16], [240, 276, 14]].forEach(([x, y, r]) => circle(x, y, r, G.leafLight))
  flowersOn(202, 272, 50, 12, 34)

  // round shrubs and a flowering bed on the left foreground
  ;[[22, 332, 26, G.leaf], [52, 344, 20, G.leafLight], [8, 360, 18, G.leafDark]].forEach(([x, y, r, c]) => circle(x, y, r, c))
  flowersOn(36, 338, 34, 16, 22, 2.4)

  // terracotta pot of lavender by the step, right side
  d.fillStyle = G.pot
  d.beginPath()
  d.moveTo(200, 372)
  d.lineTo(238, 372)
  d.lineTo(232, 408)
  d.lineTo(206, 408)
  d.fill()
  d.fillStyle = G.leafLight
  for (let i = 0; i < 9; i++) {
    const x = 204 + i * 3.8
    d.fillRect(x, 340 + (i % 3) * 4, 2, 32 - (i % 3) * 4)
    circle(x + 1, 338 + (i % 3) * 4, 3, G.flowers[0])
  }

  // mood tint over the garden only
  if (o.tint) {
    d.globalCompositeOperation = 'source-atop'
    d.fillStyle = o.tint
    d.fillRect(0, 0, W, H)
    d.globalCompositeOperation = 'source-over'
  }
  g.drawImage(layer, 0, 0)

  // string lights over the garden at night
  if (o.stringLights) {
    const y = (x) => 116 - 0.0016 * (x - 128) ** 2
    g.strokeStyle = '#4A5170'
    g.lineWidth = 1.5
    g.beginPath()
    for (let x = 0; x <= W; x += 4) (x ? g.lineTo : g.moveTo).call(g, x, y(x))
    g.stroke()
    for (let x = 10; x < W; x += 22) {
      const glow = g.createRadialGradient(x, y(x) + 5, 0, x, y(x) + 5, 12)
      glow.addColorStop(0, 'rgba(246,201,120,0.85)')
      glow.addColorStop(1, 'rgba(246,201,120,0)')
      g.fillStyle = glow
      g.fillRect(x - 12, y(x) - 7, 24, 24)
      g.fillStyle = '#FFE2A8'
      g.beginPath()
      g.arc(x, y(x) + 5, 2.6, 0, Math.PI * 2)
      g.fill()
    }
  }
}
