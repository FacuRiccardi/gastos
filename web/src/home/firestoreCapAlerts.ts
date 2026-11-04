// Firestore implementation of the in-app cap alert (collection `capAlerts`, one document per month,
// with each person's dismissal in its `dismissals` subcollection).
import { doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import type { CapAlert, CapAlertApi, CapAlertSource } from './capAlertApi'

export function createFirestoreCapAlertSource(db: Firestore, uid: string): CapAlertSource {
  return {
    subscribe(month, onData, onError) {
      let alert: CapAlert | null = null
      let dismissedLevel: number | null = null
      let alertAnswered = false
      let dismissalAnswered = false
      let failed = false
      const emit = () => {
        if (alertAnswered && dismissalAnswered && !failed) onData({ alert, dismissedLevel })
      }
      const fail = (error: Error) => {
        if (failed) return
        failed = true
        onError(error)
      }
      const stopAlert = onSnapshot(
        doc(db, 'capAlerts', month),
        (snapshot) => {
          const data = snapshot.data()
          alert = data ? { month, lastLevel: data.lastLevel as number, total: data.total as number, cap: data.cap as number } : null
          alertAnswered = true
          emit()
        },
        fail,
      )
      const stopDismissal = onSnapshot(
        doc(db, 'capAlerts', month, 'dismissals', uid),
        (snapshot) => {
          const level = snapshot.data()?.level
          dismissedLevel = typeof level === 'number' ? level : null
          dismissalAnswered = true
          emit()
        },
        fail,
      )
      return () => {
        stopAlert()
        stopDismissal()
      }
    },
  }
}

export function createFirestoreCapAlertApi(db: Firestore, uid: string): CapAlertApi {
  return {
    async dismiss(month, level) {
      await setDoc(doc(db, 'capAlerts', month, 'dismissals', uid), { level })
    },
  }
}
