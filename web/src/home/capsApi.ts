// The spending cap ("Tope de gasto"): the most that should be spent on the cards in a month, in pesos.
// Each month has its own cap; a new month starts with a copy of the latest earlier one.
export type Caps = Record<string, number> // 'YYYY-MM' -> pesos

export interface CapsApi {
  save(month: string, amount: number): Promise<void>
}
