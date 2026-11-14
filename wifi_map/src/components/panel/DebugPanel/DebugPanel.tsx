import './DebugPanel.css'

type DebugPanelProps = {
  demoEnabled: boolean
  onDemoToggle: () => void
  onTestContribution: () => void
  onResetDemoPasswordUnlock: () => void
}

export function DebugPanel({
  demoEnabled,
  onDemoToggle,
  onTestContribution,
  onResetDemoPasswordUnlock,
}: DebugPanelProps) {
  return (
    <section className="side-panel-section debug-panel" aria-label="Debug tools">
      <h2 className="side-panel-heading">Debug tools</h2>
      <label className="debug-panel-toggle">
        <input type="checkbox" checked={demoEnabled} onChange={onDemoToggle} /> Show demo data
      </label>
      <button type="button" className="debug-panel-button" onClick={onTestContribution}>
        Test reward
      </button>
      {demoEnabled && (
        <>
          <p className="debug-panel-copy">
            Demo readings are temporary and never saved.
          </p>
          <button
            type="button"
            className="debug-panel-button"
            onClick={onResetDemoPasswordUnlock}
          >
            Reset password unlocks
          </button>
        </>
      )}
    </section>
  )
}
