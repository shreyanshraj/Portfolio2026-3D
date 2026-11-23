// Which mood the room is in, from the visitor's local clock.
// Kept free of three.js so the résumé page can import it without the 3D code.
const PHASES = ['morning', 'day', 'evening', 'night'] as const
export type Phase = (typeof PHASES)[number]

const isPhase = (x: string | null): x is Phase => (PHASES as readonly (string | null)[]).includes(x)

export function phaseAt(date = new Date()): Phase {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'evening'
  return 'night'
}

// ?time=night (or morning/day/evening) forces a mood, for testing.
export function initialPhase(): Phase {
  try {
    const forced = new URLSearchParams(window.location.search).get('time')
    if (isPhase(forced)) return forced
  } catch {
    // no usable location: fall back to the clock
  }
  return phaseAt()
}
