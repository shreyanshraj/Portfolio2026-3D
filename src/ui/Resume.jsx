import { useEffect } from 'react'
import { CONTACT, RESUME } from '../content'

// The PDF lives in public/resume/. The inline preview build can't ship a PDF,
// so it leaves the button out.
const PDF_URL = import.meta.env.MODE === 'inline' ? null : `${import.meta.env.BASE_URL}resume/Shreyansh_Raj_Resume.pdf`

// The plain recruiter view: no 3D, loads instantly, prints cleanly.
// All of its text lives in RESUME in src/content.js.
// The app shows it at #resume; scripts/prerender-resume.mjs also renders it to a
// static resume.html (no JavaScript) for search engines, with roomHref './'.
export function Resume({ roomHref = '#room' }) {
  useEffect(() => {
    document.title = `${RESUME.name}, résumé`
    window.scrollTo(0, 0)
  }, [])
  return (
    <main className="resume">
      <p className="no-print resume-actions">
        <a href={roomHref}>Back to the room</a>
        {PDF_URL && (
          <a className="btn btn-solid" href={PDF_URL} download="Shreyansh_Raj_Resume.pdf">
            Download PDF
          </a>
        )}
      </p>
      <h1>{RESUME.name}</h1>
      <p className="meta contact-row">
        {CONTACT.map((c) => (
          <a key={c.href} href={c.href}>
            {c.label}
          </a>
        ))}
      </p>
      <p className="lede">{RESUME.summary}</p>

      <h2>Experience</h2>
      {RESUME.experience.map((job) => (
        <div className="job" key={job.company}>
          <div className="row">
            <h3>
              {job.title}, {job.company}
            </h3>
            <p className="meta">{job.dates}</p>
          </div>
          <p className="meta tech">{job.tech}</p>
          <ul>
            {job.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ))}

      <h2>Projects</h2>
      {RESUME.projects.map((p) => (
        <div className="job" key={p.name}>
          <div className="row">
            <h3>{p.name}</h3>
            <p className="meta">{p.note}</p>
          </div>
          <p className="meta tech">
            {p.tech}
            {p.link && (
              <>
                {', '}
                <a href={p.link} target="_blank" rel="noreferrer">
                  code on GitHub
                </a>
              </>
            )}
          </p>
          <p>{p.text}</p>
        </div>
      ))}

      <h2>Education</h2>
      {RESUME.education.map((e) => (
        <div className="row" key={e.degree}>
          <p>
            <strong>{e.degree}</strong>, {e.school}
          </p>
          <p className="meta">{e.dates}</p>
        </div>
      ))}

      <h2>Skills and certification</h2>
      <dl className="skills">
        {RESUME.skills.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </main>
  )
}
