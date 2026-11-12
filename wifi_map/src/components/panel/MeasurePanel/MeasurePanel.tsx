import { useState, type ChangeEvent } from 'react'
import { formatCoordinates } from '../../../lib/coordinates'
import { cleanNetworkName, networkNameError, resolveNetworkName } from '../../../lib/networkName'
import { takeNetworkReading, type NetworkReading } from '../../../lib/networkReading'
import { loadLastNetworkName, saveLastNetworkName } from '../../../lib/readingStore'
import { SpeedFigures } from '../../network/SpeedFigures/SpeedFigures'
import './MeasurePanel.css'

const KNOWN_NETWORKS_LIST_ID = 'known-networks'

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

  function handleNetworkInputChange(event: ChangeEvent<HTMLInputElement>) {
    setNetworkInput(event.target.value)
  }

  async function handleMeasure() {
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
          list={KNOWN_NETWORKS_LIST_ID}
          value={networkInput}
          onChange={handleNetworkInputChange}
          placeholder="e.g. CafeNet"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <datalist id={KNOWN_NETWORKS_LIST_ID}>
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
          <div className="measure-panel-detail">{formatCoordinates(state.reading)}</div>
        </div>
      )}
      {state.status === 'error' && <div className="measure-panel-error">{state.message}</div>}
    </div>
  )
}
