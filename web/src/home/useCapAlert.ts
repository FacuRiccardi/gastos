import { useEffect, useState } from 'react'
import { visibleCapAlert, type CapAlert, type CapAlertSource } from './capAlertApi'

type CapAlertState = { status: 'loading' | 'ready' | 'error'; alert: CapAlert | null }

const idle: CapAlertState = { status: 'ready', alert: null }
const loading: CapAlertState = { status: 'loading', alert: null }

// Subscribes to the alert of the month (and this person's dismissal of it) while mounted.
export function useCapAlert(source: CapAlertSource, month: string | null): CapAlertState {
  const [state, setState] = useState<{ month: string | null; value: CapAlertState }>({ month, value: month === null ? idle : loading })
  useEffect(() => {
    if (month === null) return
    return source.subscribe(
      month,
      ({ alert, dismissedLevel }) => setState({ month, value: { status: 'ready', alert: visibleCapAlert(alert, dismissedLevel) } }),
      () => setState({ month, value: { status: 'error', alert: null } }),
    )
  }, [source, month])
  // A state kept for another month is stale: derive loading instead of resetting state in the effect.
  if (month === null) return idle
  return state.month === month ? state.value : loading
}
