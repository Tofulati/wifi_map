import { useState, type ReactNode } from 'react'
import './SidePanel.css'

type SidePanelProps = {
  children: ReactNode
}

export function SidePanel({ children }: SidePanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  function handleToggle() {
    setIsOpen((wasOpen) => !wasOpen)
  }

  return (
    <aside className="side-panel" data-open={isOpen}>
      {/* inert keeps keyboard focus out of the panel while it's slid off-screen. */}
      <div className="side-panel-content" inert={!isOpen}>
        {children}
      </div>
      <button
        type="button"
        className="side-panel-toggle"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse side panel' : 'Expand side panel'}
      >
        <span aria-hidden="true">{isOpen ? '‹' : '›'}</span>
      </button>
    </aside>
  )
}
