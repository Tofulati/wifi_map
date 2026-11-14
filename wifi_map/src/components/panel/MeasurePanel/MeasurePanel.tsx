import { useEffect, useState, type ChangeEvent } from 'react'
import { formatCoordinates, type Coordinates } from '../../../lib/coordinates'
import { networkPasswordExists } from '../../../lib/measurementRepository'
import { cleanNetworkName, networkNameError, resolveNetworkName } from '../../../lib/networkName'
import { formatRecordedAt, takeNetworkReading, type NetworkReading } from '../../../lib/networkReading'
import { loadLastNetworkName, saveLastNetworkName } from '../../../lib/readingStore'
import { PASSWORD_UNLOCK_COST } from '../../../lib/contributionRewards'
import { SpeedFigures } from '../../network/SpeedFigures/SpeedFigures'
import './MeasurePanel.css'

type MeasureState =
  | { status: 'idle' }
  | { status: 'measuring' }
  | { status: 'done'; reading: NetworkReading }
  | { status: 'error'; message: string }

type MeasurePanelProps = {
  knownNetworkNames: string[]
  location: Coordinates | null
  signalBalance: number
  onUnlockPassword: () => boolean
  onReading: (reading: NetworkReading, password?: string) => void | Promise<void>
}

export function MeasurePanel({
  knownNetworkNames,
  location,
  signalBalance,
  onUnlockPassword,
  onReading,
}: MeasurePanelProps) {
  const [state, setState] = useState<MeasureState>({ status: 'idle' })
  const [networkInput, setNetworkInput] = useState(loadLastNetworkName)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordUnlocked, setPasswordUnlocked] = useState(false)
  const [passwordAvailability, setPasswordAvailability] = useState<
    'checking' | 'available' | 'exists' | 'error'
  >('checking')

  const nameError = networkNameError(networkInput)
  const resolvedName = resolveNetworkName(networkInput, knownNetworkNames)
  const matchesExistingSpelling = !nameError && resolvedName !== cleanNetworkName(networkInput)
  const canSharePassword = passwordUnlocked && passwordAvailability === 'available'

  useEffect(() => {
    if (nameError || !location) {
      return
    }
    let active = true
    void networkPasswordExists({
      networkName: resolvedName,
      latitude: location.latitude,
      longitude: location.longitude,
    })
      .then((exists) => {
        if (active) setPasswordAvailability(exists ? 'exists' : 'available')
      })
      .catch(() => {
        if (active) setPasswordAvailability('error')
      })
    return () => {
      active = false
    }
  }, [location, nameError, resolvedName])

  function handleNetworkInputChange(event: ChangeEvent<HTMLInputElement>) {
    setNetworkInput(event.target.value)
    setPasswordUnlocked(false)
    setPasswordInput('')
    setPasswordAvailability('checking')
  }

  function handleUnlockPassword() {
    if (onUnlockPassword()) setPasswordUnlocked(true)
  }

  async function handleMeasure() {
    if (nameError) return
    setState({ status: 'measuring' })
    try {
      const reading = await takeNetworkReading(resolvedName)
      if (canSharePassword && passwordInput.length === 0) {
        setState({ status: 'error', message: 'Enter the network password or leave sharing locked.' })
        return
      }
      setState({ status: 'done', reading })
      setNetworkInput(resolvedName)
      saveLastNetworkName(resolvedName)
      await onReading(reading, canSharePassword ? passwordInput : undefined)
      setPasswordUnlocked(false)
      setPasswordInput('')
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className="measure-panel">
      <label className="measure-panel-field">
        Network name (SSID)
        <input
          value={networkInput}
          onChange={handleNetworkInputChange}
          placeholder="Enter the name shown in Wi-Fi settings"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <div className="measure-panel-warning">
        Browsers cannot read the current Wi-Fi name. Enter the SSID shown in your device’s Wi-Fi
        settings; it controls how readings are grouped.
      </div>
      {networkInput !== '' && nameError && <div className="measure-panel-error">{nameError}</div>}
      {matchesExistingSpelling && (
        <div className="measure-panel-detail">Matches existing network “{resolvedName}”</div>
      )}

      {passwordAvailability === 'available' && !passwordUnlocked && (
        <div className="measure-panel-password">
          <div className="measure-panel-password-copy">
            <strong>Know the Wi-Fi password?</strong>
            <span>Unlock sharing for {PASSWORD_UNLOCK_COST} Signal. It stays private.</span>
          </div>
          <button
            type="button"
            className="measure-panel-secondary-button"
            onClick={handleUnlockPassword}
            disabled={signalBalance < PASSWORD_UNLOCK_COST}
          >
            {signalBalance < PASSWORD_UNLOCK_COST
              ? `Need ${PASSWORD_UNLOCK_COST} Signal`
              : 'Unlock password sharing'}
          </button>
        </div>
      )}
      {passwordAvailability === 'exists' && (
        <div className="measure-panel-detail">A password is already saved for this spot.</div>
      )}
      {passwordAvailability === 'error' && (
        <div className="measure-panel-detail">Password sharing is unavailable right now.</div>
      )}
      {canSharePassword && (
        <label className="measure-panel-field">
          Network password
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Enter password"
            autoComplete="new-password"
          />
          <span className="measure-panel-warning">
            Only a one-way hash is stored. The password can never be displayed from this app.
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={handleMeasure}
        disabled={
          state.status === 'measuring' ||
          nameError !== null ||
          (canSharePassword && passwordInput.length === 0)
        }
      >
        {state.status === 'measuring' ? 'Measuring…' : 'Measure this network'}
      </button>

      {state.status === 'done' && (
        <div>
          <SpeedFigures speeds={state.reading} /> on {state.reading.networkName}
          <div className="measure-panel-detail">{formatCoordinates(state.reading)}</div>
          {state.reading.recordedAt && (
            <div className="measure-panel-detail">
              Measured {formatRecordedAt(state.reading.recordedAt)}
            </div>
          )}
        </div>
      )}
      {state.status === 'error' && <div className="measure-panel-error">{state.message}</div>}
    </div>
  )
}
