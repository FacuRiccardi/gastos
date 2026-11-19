// The spending cap ("Tope de gasto"): the most that should be spent on the cards in a month, in pesos.
// A month without its own cap uses the latest one defined before it.
export type Caps = Record<string, number> // 'YYYY-MM' -> pesos

export interface CapsApi {
  save(month: string, amount: number): Promise<void>
  remove(month: string): Promise<void>
}
