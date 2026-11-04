export type Expense = {
  id: string
  purchaseDate: Date
  receivedAt: Date
  merchant: string
  amount: number
  currency: string
  cardLast4: string
  cardType: 'credit' | 'debit'
  cardHolder: string
  status?: 'approved' | 'rejected'
  // Id of a document of the `categories` collection; absent when the purchase is uncategorized.
  categoryId?: string | null
}
