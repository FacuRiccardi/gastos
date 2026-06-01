import { ExpenseDate } from './ExpenseDate.js';
import { CategoryId } from '../catalogue/category/CategoryId.js';
import { GroupId } from '../catalogue/group/GroupId.js';
import { PaymentInstrumentId } from './payment-instrument/PaymentInstrumentId.js';

export class ExpenseFilters {
  constructor(
    readonly from?: ExpenseDate,
    readonly to?: ExpenseDate,
    readonly categoryId?: CategoryId,
    readonly groupId?: GroupId,
    readonly paymentInstrumentId?: PaymentInstrumentId,
  ) {}
}
