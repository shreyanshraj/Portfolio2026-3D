import { useEffect, useRef, useState } from 'react'
import { OBJECTS, HOME_TIME } from '../content'

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

// "It's 9:14 pm in Tempe, so ..." in the visitor's language, using your time zone.
function homeTimeLine(now) {
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: HOME_TIME.timeZone })
  const hour = Number(now.toLocaleString('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: HOME_TIME.timeZone }))
  const awake = hour >= HOME_TIME.awakeFrom && hour < HOME_TIME.awakeUntil
  return awake
    ? `It's ${time} in ${HOME_TIME.city}, so I'll likely see your message today.`
    : `It's ${time} in ${HOME_TIME.city}, so I'm probably offline. Leave a note and I'll reply to you in the morning.`
}

// The time line, updated on each new minute while the bubble is open.
function HomeTime() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id
    const untilNextMinute = () => 60_000 - (Date.now() % 60_000)
    const tick = () => {
      setNow(new Date())
      id = setTimeout(tick, untilNextMinute())
    }
    id = setTimeout(tick, untilNextMinute())
    return () => clearTimeout(id)
  }, [])
  return <p className="bubble-time">{homeTimeLine(now)}</p>
}

// The speech bubble that opens next to a clicked object.
export function Bubble({ id, phase, onAction, onClose }) {
  const o = { ...OBJECTS[id], ...OBJECTS[id].byPhase?.[phase] }
  const title = useRef()
  useEffect(() => {
    title.current?.focus({ preventScroll: true })
  }, [id])
  return (
    <div className="bubble" role="dialog" aria-labelledby={`bubble-${id}`}>
      <button className="bubble-close" aria-label="Close" onClick={onClose}>
        <CloseIcon />
      </button>
      <h2 id={`bubble-${id}`} ref={title} tabIndex={-1}>
        {o.title}
      </h2>
      <p>{o.body}</p>
      {o.action?.kind === 'projects' && (
        <button className="btn btn-solid" onClick={() => onAction(o.action)}>
          {o.action.label}
        </button>
      )}
      {o.action?.kind === 'resume' && (
        <a className="btn btn-solid" href="#resume">
          {o.action.label}
        </a>
      )}
      {o.localTime && <HomeTime />}
      {o.action?.kind === 'message' && (
        <button className="btn btn-solid" onClick={() => onAction({ kind: 'message' })}>
          {o.action.label}
        </button>
      )}
    </div>
  )
}
