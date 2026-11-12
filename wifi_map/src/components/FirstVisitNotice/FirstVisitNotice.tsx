import { useEffect, useState } from 'react'
import './FirstVisitNotice.css'

const DISMISSED_STORAGE_KEY = 'wifi-map:first-visit-notice-dismissed'

function hasDismissedNotice() {
  try {
    return localStorage.getItem(DISMISSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function FirstVisitNotice() {
  const [isOpen, setIsOpen] = useState(() => !hasDismissedNotice())

  useEffect(
    function handleEscape() {
      if (!isOpen) return

      function closeOnEscape(event: KeyboardEvent) {
        if (event.key === 'Escape') dismiss()
      }

      document.addEventListener('keydown', closeOnEscape)
      return () => document.removeEventListener('keydown', closeOnEscape)
    },
    [isOpen],
  )

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, 'true')
    } catch {
      // The notice can still be dismissed when storage is unavailable.
    }
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="first-visit-notice-backdrop">
      <section
        className="first-visit-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-visit-notice-title"
        aria-describedby="first-visit-notice-description"
      >
        <div className="first-visit-notice-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 3.25 20 7.5v9L12 20.75 4 16.5v-9l8-4.25Z" />
            <path d="M8.25 12h7.5M12 8.25v7.5" />
          </svg>
        </div>
        <div className="first-visit-notice-copy">
          <h1 id="first-visit-notice-title">A quick note about privacy</h1>
          <p id="first-visit-notice-description">
            Wi-Fi Map uses your device&apos;s location and network speed to build a shared map.
            A reading can show your current location to people viewing the map. It does not show
            personal information such as your name or email.
          </p>
          <div className="first-visit-notice-instructions">
            <h2>How to contribute</h2>
            <p>
              Allow location access, enter your network label, then choose{' '}
              <strong>Measure this network</strong>. Your reading will be added to the map.
            </p>
          </div>
        </div>
        <button type="button" className="first-visit-notice-dismiss" onClick={dismiss} autoFocus>
          Continue to the map
        </button>
      </section>
    </div>
  )
}
