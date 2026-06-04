import type { HouseholdRepository } from '../domain/identity/household/HouseholdRepository.js';
import type { UserRepository } from '../domain/identity/user/UserRepository.js';
import type { GroupRepository } from '../domain/catalogue/group/GroupRepository.js';
import type { CategoryRepository } from '../domain/catalogue/category/CategoryRepository.js';
import type { ExpenseRepository } from '../domain/expense/ExpenseRepository.js';
import type { PaymentInstrumentRepository } from '../domain/expense/payment-instrument/PaymentInstrumentRepository.js';
import type { BudgetLimitRepository } from '../domain/budget/BudgetLimitRepository.js';

export interface Repositories {
  households: HouseholdRepository;
  users: UserRepository;
  groups: GroupRepository;
  categories: CategoryRepository;
  expenses: ExpenseRepository;
  paymentInstruments: PaymentInstrumentRepository;
  budgetLimits: BudgetLimitRepository;
}
