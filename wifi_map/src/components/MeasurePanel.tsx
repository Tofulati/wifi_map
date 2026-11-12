import { useState } from 'react'
import { cleanNetworkName, networkNameError, resolveNetworkName } from '../lib/networkName'
import { takeNetworkReading, type NetworkReading } from '../lib/networkReading'
import { loadLastNetworkName, saveLastNetworkName } from '../lib/readingStore'
import './MeasurePanel.css'
import { SpeedFigures } from './NetworkSummary'

type MeasureState =
  | { status: 'idle' }
  | { status: 'measuring' }
  | { status: 'done'; reading: NetworkReading }
  | { status: 'error'; message: string }

type MeasurePanelProps = {
  knownNetworkNames: string[]
  onReading: (reading: NetworkReading) => void
}

export function MeasurePanel({ knownNetworkNames, onReading }: MeasurePanelProps) {
  const [state, setState] = useState<MeasureState>({ status: 'idle' })
  const [networkInput, setNetworkInput] = useState(loadLastNetworkName)

  const nameError = networkNameError(networkInput)
  const resolvedName = resolveNetworkName(networkInput, knownNetworkNames)
  const matchesExistingSpelling = !nameError && resolvedName !== cleanNetworkName(networkInput)

  const handleMeasure = async () => {
    if (nameError) return
    setState({ status: 'measuring' })
    try {
      const reading = await takeNetworkReading(resolvedName)
      setState({ status: 'done', reading })
      setNetworkInput(resolvedName)
      saveLastNetworkName(resolvedName)
      onReading(reading)
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className="measure-panel">
      <label className="measure-panel-field">
        Network name
        <input
          list="known-networks"
          value={networkInput}
          onChange={(event) => setNetworkInput(event.target.value)}
          placeholder="e.g. CafeNet"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <datalist id="known-networks">
        {knownNetworkNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {networkInput !== '' && nameError && <div className="measure-panel-error">{nameError}</div>}
      {matchesExistingSpelling && (
        <div className="measure-panel-detail">Matches existing network “{resolvedName}”</div>
      )}

      <button
        type="button"
        onClick={handleMeasure}
        disabled={state.status === 'measuring' || nameError !== null}
      >
        {state.status === 'measuring' ? 'Measuring…' : 'Measure this network'}
      </button>

      {state.status === 'done' && (
        <div>
          <SpeedFigures speeds={state.reading} /> on {state.reading.networkName}
          <div className="measure-panel-detail">
            {state.reading.latitude.toFixed(5)}, {state.reading.longitude.toFixed(5)}
          </div>
        </div>
      )}
      {state.status === 'error' && <div className="measure-panel-error">{state.message}</div>}
    </div>
  )
}
