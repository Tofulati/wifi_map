import './DebugPanel.css'

type DebugPanelProps = {
  demoEnabled: boolean
  onDemoToggle: () => void
  onTestContribution: () => void
  selectedNetworkName?: string
  unlockedDemoNetworks: string[]
  signalBalance: number
  onUnlockDemoPassword: (networkName: string) => boolean
  onResetDemoPasswordUnlock: () => void
}

const DEMO_NETWORK_PASSWORD = 'cafe-demo-2026'
const PASSWORD_UNLOCK_COST = 25

export function DebugPanel({
  demoEnabled,
  onDemoToggle,
  onTestContribution,
  selectedNetworkName,
  unlockedDemoNetworks,
  signalBalance,
  onUnlockDemoPassword,
  onResetDemoPasswordUnlock,
}: DebugPanelProps) {
  const isSelectedNetworkUnlocked =
    selectedNetworkName !== undefined && unlockedDemoNetworks.includes(selectedNetworkName)

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
            Demo readings are temporary and never saved. Select a demo network to test password
            unlocking.
          </p>
          {selectedNetworkName && (
            <div className="debug-panel-password">
              <strong>{selectedNetworkName}</strong>
              {isSelectedNetworkUnlocked ? (
                <>
                  <code>{DEMO_NETWORK_PASSWORD}</code>
                  <span>Password unlocked for this session.</span>
                </>
              ) : (
                <button
                  type="button"
                  className="debug-panel-button"
                  onClick={() => onUnlockDemoPassword(selectedNetworkName)}
                  disabled={signalBalance < PASSWORD_UNLOCK_COST}
                >
                  {signalBalance < PASSWORD_UNLOCK_COST
                    ? `Need ${PASSWORD_UNLOCK_COST} Signal`
                    : `Unlock demo password for ${PASSWORD_UNLOCK_COST} Signal`}
                </button>
              )}
            </div>
          )}
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
