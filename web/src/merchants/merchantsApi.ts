// A merchant of the dictionary and the category its next purchases get.
export type MerchantEntry = { key: string; merchant: string; categoryId: string }

export interface MerchantsSource {
  subscribe(onData: (entries: MerchantEntry[]) => void, onError: (error: Error) => void): () => void
}

export interface MerchantsApi {
  // Remembers (or changes) the category of a merchant. It only affects its future purchases.
  remember(merchant: string, categoryId: string): Promise<void>
}
