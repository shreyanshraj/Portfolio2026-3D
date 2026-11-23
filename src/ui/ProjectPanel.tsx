import { PROJECTS } from '../content'
import { PROJECT_ART } from './ProjectArt'

// Sits beside the zoomed-in laptop.
interface ProjectPanelProps {
  current: string
  onChoose: (id: string) => void
  onBack: () => void
}

export function ProjectPanel({ current, onChoose, onBack }: ProjectPanelProps) {
  const p = PROJECTS.find((x) => x.id === current) ?? PROJECTS[0]
  const Art = PROJECT_ART[p.id]
  return (
    <section className="project-panel" aria-labelledby="project-name">
      <button className="btn" onClick={onBack}>
        Back to the room
      </button>
      {Art && (
        <div className="project-screen">
          <Art />
        </div>
      )}
      <h1 id="project-name">{p.name}</h1>
      <p className="project-summary">{p.summary}</p>
      <p className="project-stack">Built with {p.stack}</p>
      {p.status && <p className="project-stack">{p.status}</p>}
      {p.link && (
        <p className="project-stack">
          <a href={p.link} target="_blank" rel="noreferrer">
            View the code on GitHub
          </a>
        </p>
      )}
      <nav aria-label="Projects" className="project-list">
        {PROJECTS.map((x) => (
          <button key={x.id} className="proj-row" aria-pressed={x.id === p.id} onClick={() => onChoose(x.id)}>
            {x.name}
          </button>
        ))}
      </nav>
    </section>
  )
}
