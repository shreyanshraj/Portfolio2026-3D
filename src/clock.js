// Which mood the room is in, from the visitor's local clock.
// Kept free of three.js so the résumé page can import it without the 3D code.
const PHASES = ['morning', 'day', 'evening', 'night']

export function phaseAt(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'evening'
  return 'night'
}

// ?time=night (or morning/day/evening) forces a mood, for testing.
export function initialPhase() {
  try {
    const forced = new URLSearchParams(window.location.search).get('time')
    if (PHASES.includes(forced)) return forced
  } catch {
    // no usable location: fall back to the clock
  }
  return phaseAt()
}
