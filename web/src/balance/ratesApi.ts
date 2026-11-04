// Exchange rate of each month ("TC día de cobro": pesos per dollar), used to turn the dollar incomes into pesos.
export type Rates = Record<string, number> // 'YYYY-MM' -> pesos per dollar

export interface RatesSource {
  subscribe(onData: (rates: Rates) => void, onError: (error: Error) => void): () => void
}

export interface RatesApi {
  save(month: string, rate: number): Promise<void>
}
