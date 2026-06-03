import { ExpenseDate } from './ExpenseDate.js';
import { CategoryId } from '../catalogue/category/CategoryId.js';
import { PaymentInstrumentId } from './payment-instrument/PaymentInstrumentId.js';

export class ExpenseFilters {
  constructor(
    readonly from?: ExpenseDate,
    readonly to?: ExpenseDate,
    readonly categoryIds?: CategoryId[],
    readonly paymentInstrumentId?: PaymentInstrumentId,
  ) {}
}
