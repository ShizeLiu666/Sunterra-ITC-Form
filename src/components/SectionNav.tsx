import { useState, useEffect, useCallback } from 'react'
import './SectionNav.css'

const SECTIONS = [
  { id: 'section-1', label: 'Project Information' },
  { id: 'section-2', label: 'Visual Inspection' },
  { id: 'section-3', label: 'Inspection and Test' },
  { id: 'section-4', label: 'Additional Testing' },
  { id: 'section-5', label: 'Test Results' },
  { id: 'section-6', label: 'Equipment' },
  { id: 'section-7', label: 'Comments' },
  { id: 'section-8', label: 'Defects' },
  { id: 'section-9', label: 'Sign-off' },
]

export default function SectionNav() {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(1)

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setOpen(false)
  }, [])

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const root = document.querySelector('.form-container')
    if (!root) return

    SECTIONS.forEach(({ id }, index) => {
      const el = document.getElementById(id)
      if (!el) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(index + 1)
            }
          })
        },
        {
          root: null,
          rootMargin: '-20% 0px -60% 0px',
          threshold: 0,
        },
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  return (
    <>
      <button
        type="button"
        className="section-nav-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open section navigator"
      >
        <span className="section-nav-progress">{activeSection}/9</span>
        <svg className="section-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <>
          <div className="section-nav-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="section-nav-popup">
            <div className="section-nav-popup-title">Jump to section</div>
            <ul className="section-nav-list">
              {SECTIONS.map(({ id, label }, index) => (
                <li key={id}>
                  <button
                    type="button"
                    className={`section-nav-item ${index + 1 === activeSection ? 'section-nav-active' : ''}`}
                    onClick={() => scrollToSection(id)}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  )
}
