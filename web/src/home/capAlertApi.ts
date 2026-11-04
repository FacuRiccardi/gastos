// The in-app alert for a spending-cap threshold. The backend announces the level reached for a month
// (capAlerts/{month}); each member dismisses it for themselves (capAlerts/{month}/dismissals/{uid}).
export type CapAlert = { month: string; lastLevel: number; total: number; cap: number }

export type CapAlertData = { alert: CapAlert | null; dismissedLevel: number | null }

export interface CapAlertSource {
  subscribe(month: string, onData: (data: CapAlertData) => void, onError: (error: Error) => void): () => void
}

export interface CapAlertApi {
  dismiss(month: string, level: number): Promise<void>
}

// The alert is shown unless this person already dismissed that level (or a higher one).
export function visibleCapAlert(alert: CapAlert | null, dismissedLevel: number | null): CapAlert | null {
  if (!alert) return null
  return dismissedLevel === null || alert.lastLevel > dismissedLevel ? alert : null
}
