// The small surface of web push that the app needs. The hook receives it as a parameter so it can
// be tested with a fake.
export type PushPermission = 'default' | 'granted' | 'denied'

export interface PushApi {
  support(): 'supported' | 'unsupported'
  permission(): PushPermission
  requestPermission(): Promise<PushPermission>
  // The FCM token of this browser, or null when there is none.
  getToken(): Promise<string | null>
  // Upserts `pushTokens/{token}` with { uid, createdAt, updatedAt }, keeping createdAt on update.
  saveToken(uid: string, token: string): Promise<void>
}

// Used where push must do nothing (the local emulators).
export const inertPushApi: PushApi = {
  support: () => 'unsupported',
  permission: () => 'denied',
  requestPermission: async () => 'denied',
  getToken: async () => null,
  saveToken: async () => {},
}
