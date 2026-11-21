import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bubble } from './ui/Bubble'
import { ProjectPanel } from './ui/ProjectPanel'
import { Resume } from './ui/Resume'
import { ContactPanel } from './ui/ContactPanel'
import { OBJECTS, ROLES } from './content'
import { initialPhase, phaseAt } from './clock'

// Which side of the object its speech bubble opens on.
const BUBBLE_SIDE = { raj: 'right', laptop: 'right', coffee: 'right', books: 'right', medals: 'right', tv: 'left', door: 'left', showPoster: 'left', gamePoster: 'right' }

// The 3D scene is split out so the résumé view never downloads three.js.
const Experience = lazy(() => import('./scene/Experience'))

// Checked before the 3D code is downloaded: some locked-down or older machines
// have WebGL turned off, and three.js can't draw anything without it.
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// If the room can't be shown (no WebGL, a model that failed to load, a crash
// in the scene), visitors get a short note and the résumé instead of a blank page.
function RoomFallback({ onContact }) {
  return (
    <div className="room-fallback" role="alert">
      <h1>The room didn't load on this device.</h1>
      <p>Everything in it is also on the résumé page.</p>
      <p className="room-fallback-actions">
        <a className="btn btn-solid" href="#resume">
          Read the résumé
        </a>
        <button className="btn" onClick={onContact}>
          Get in touch
        </button>
      </p>
    </div>
  )
}

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.error('The 3D room failed to load:', error)
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash === '#resume' ? 'resume' : 'room'
}

// The room's mood follows the visitor's clock, re-checked every minute.
function usePhase() {
  const [phase, setPhase] = useState(initialPhase)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('time')) return // forced for testing
    const id = setInterval(() => setPhase(phaseAt()), 60_000)
    return () => clearInterval(id)
  }, [])
  return phase
}

function useNarrow() {
  const q = '(max-width: 760px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

// "Open to ___ roles", typing each role out, pausing, then erasing it for the
// next. Screen readers get the full list once; reduced motion shows all three.
function RoleTicker() {
  const reduce = useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  }, [])
  const [i, setI] = useState(0)
  const [n, setN] = useState(0) // characters shown
  const [erasing, setErasing] = useState(false)
  const word = ROLES[i]
  useEffect(() => {
    if (reduce) return
    let t
    if (!erasing && n < word.length) t = setTimeout(() => setN(n + 1), 70)
    else if (!erasing) t = setTimeout(() => setErasing(true), 1900)
    else if (n > 0) t = setTimeout(() => setN(n - 1), 35)
    else
      t = setTimeout(() => {
        setErasing(false)
        setI((i + 1) % ROLES.length)
      }, 250)
    return () => clearTimeout(t)
  }, [n, erasing, word, i, reduce])

  const all = ROLES.join(', ').replace(/, ([^,]*)$/, ' and $1')
  if (reduce) return <p className="roles">Open to {all} roles</p>
  return (
    <p className="roles">
      <span className="sr-only">Open to {all} roles</span>
      <span aria-hidden="true">
        Open to <span className="role-word">{word.slice(0, n)}</span>
        <span className="caret" /> roles
      </span>
    </p>
  )
}

export default function App() {
  const route = useHashRoute()
  return route === 'resume' ? <Resume /> : <Home />
}

function Home() {
  const narrow = useNarrow()
  const backdrop = useRef()
  const overlay = useRef()
  const [picked, setPicked] = useState(null)
  const [view, setView] = useState('room')
  const [project, setProject] = useState('pantry')
  const [contactOpen, setContactOpen] = useState(false)
  const [failed, setFailed] = useState(() => !hasWebGL())
  const onSceneError = useCallback(() => setFailed(true), [])
  const phase = usePhase()
  // ?start=now skips the opening light-up (handy while developing)
  const instant = new URLSearchParams(window.location.search).get('start') === 'now'

  useEffect(() => {
    document.title = 'Shreyansh Raj'
  }, [])

  // hotspot buttons always open; clicking the object itself again closes it
  // The window has no bubble: a click opens or closes it. That choice holds
  // until the time of day next changes, then the window follows the clock again.
  const [windowOpen, setWindowOpen] = useState(null)
  useEffect(() => setWindowOpen(null), [phase])
  const pick = useCallback(
    (id, open) => {
      if (OBJECTS[id]?.toggle) {
        setWindowOpen((w) => !(w ?? phase !== 'night'))
        return
      }
      setPicked((p) => (p === id && !open ? null : id))
    },
    [phase]
  )
  const close = useCallback(() => setPicked(null), [])
  const action = useCallback((a) => {
    if (a.kind === 'message') {
      setPicked(null)
      setContactOpen(true)
    }
    if (a.kind === 'projects') {
      if (a.project) setProject(a.project)
      setPicked(null)
      setView('projects')
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (contactOpen) setContactOpen(false)
      else if (picked) setPicked(null)
      else if (view === 'projects') setView('room')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, view, contactOpen])

  return (
    <div ref={backdrop} className={`home${view === 'projects' ? ' in-projects' : ''}`} data-phase={phase}>
      <header className="top">
        <div className="identity">
          <a className="name" href="#room">
            Shreyansh Raj
          </a>
          <RoleTicker />
        </div>
        <span className="top-actions">
          <button className="btn top-link" onClick={() => setContactOpen(true)}>
            Get in touch
          </button>
          <a className="btn top-link" href="#resume">
            Just the résumé
          </a>
        </span>
      </header>

      <div className="stage">
        {failed ? (
          <RoomFallback onContact={() => setContactOpen(true)} />
        ) : (
          <SceneBoundary onError={onSceneError}>
            <Suspense fallback={<p className="loading">Setting up the room</p>}>
              <Experience
                view={view}
                picked={picked}
                onPick={pick}
                onClose={close}
                backdropRef={backdrop}
                overlayRef={overlay}
                narrow={narrow}
                phase={phase}
                instant={instant}
                windowOpen={windowOpen}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>

      <div ref={overlay} className="overlay">
        {view === 'room' &&
          !failed &&
          Object.keys(OBJECTS).map((id) => (
            <div key={id} className="anchor" data-anchor={id}>
              <button
                className={`spot${picked === id ? ' is-lit' : ''}`}
                aria-label={OBJECTS[id].label}
                aria-pressed={OBJECTS[id].toggle ? (windowOpen ?? phase !== 'night') : picked === id}
                onClick={() => pick(id, true)}
              />
            </div>
          ))}
        {view === 'room' && picked && !narrow && !failed && (
          <div className="anchor" data-anchor={picked}>
            <div className={`bubble-anchor side-${BUBBLE_SIDE[picked]}`}>
              <Bubble id={picked} phase={phase} onAction={action} onClose={close} />
            </div>
          </div>
        )}
      </div>

      {view === 'room' && !picked && !failed && <p className="hint">Click anything in the room.</p>}

      {view === 'room' && picked && narrow && (
        <div className="sheet">
          <Bubble id={picked} phase={phase} onAction={action} onClose={close} />
        </div>
      )}

      {view === 'projects' && <ProjectPanel current={project} onChoose={setProject} onBack={() => setView('room')} />}

      {contactOpen && <ContactPanel onClose={() => setContactOpen(false)} />}

      <p className="sr-only" aria-live="polite">
        {picked ? `${OBJECTS[picked].label} selected` : ''}
      </p>
    </div>
  )
}
