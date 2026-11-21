import { useEffect, useRef, useState } from 'react'
import { CONTACT, CONTACT_FORM } from '../content'

const EMAIL = CONTACT.find((c) => c.href.startsWith('mailto:'))?.label

// A small "get in touch" panel: a message form, the email address with a copy
// button, and links. If CONTACT_FORM.endpoint is set (e.g. a Formspree form),
// messages are posted there; otherwise Send opens the visitor's email app with
// the message filled in.
export function ContactPanel({ onClose }) {
  const first = useRef()
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    first.current?.focus()
  }, [])

  async function submit(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    if (!CONTACT_FORM.endpoint) {
      const subject = encodeURIComponent(`Hello from ${data.name || 'your website'}`)
      const body = encodeURIComponent(`${data.message}\n\n${data.name}\n${data.email}`)
      window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`
      return
    }
    setStatus('sending')
    try {
      const res = await fetch(CONTACT_FORM.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, _subject: `Website message from ${data.name}` }),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="contact-scrim" onClick={onClose}>
      <section className="contact-panel" role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={(e) => e.stopPropagation()}>
        <button className="bubble-close" aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id="contact-title">Get in touch</h2>
        <p className="contact-intro">{CONTACT_FORM.intro}</p>

        {status === 'sent' ? (
          <p className="contact-status" role="status">
            Message sent. I'll get back to you soon.
          </p>
        ) : (
          <form onSubmit={submit} className="contact-form">
            <label>
              Your name
              <input ref={first} name="name" required autoComplete="name" />
            </label>
            <label>
              Your email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Message
              <textarea name="message" rows={4} required />
            </label>
            {status === 'error' && (
              <p className="contact-status error" role="alert">
                The message didn't go through. Try again, or email me directly at {EMAIL}.
              </p>
            )}
            <button className="btn btn-solid" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending' : 'Send message'}
            </button>
          </form>
        )}

        <div className="contact-direct">
          <p>
            Or email me at <strong>{EMAIL}</strong>{' '}
            <button type="button" className="link-button" onClick={copyEmail}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </p>
          <p className="contact-links">
            {CONTACT.filter((c) => !c.href.startsWith('mailto:')).map((c) => (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </p>
        </div>
      </section>
    </div>
  )
}
