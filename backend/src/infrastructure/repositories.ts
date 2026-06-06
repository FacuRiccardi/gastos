import { db } from './db/client.js';
import { DrizzleHouseholdRepository } from './identity/DrizzleHouseholdRepository.js';
import { DrizzleUserRepository } from './identity/DrizzleUserRepository.js';
import { DrizzleGroupRepository } from './catalogue/DrizzleGroupRepository.js';
import { DrizzleCategoryRepository } from './catalogue/DrizzleCategoryRepository.js';
import { DrizzleExpenseRepository } from './expense/DrizzleExpenseRepository.js';
import { DrizzlePaymentInstrumentRepository } from './expense/DrizzlePaymentInstrumentRepository.js';
import { DrizzleBudgetLimitRepository } from './budget/DrizzleBudgetLimitRepository.js';

export function makeRepos() {
  return {
    households: new DrizzleHouseholdRepository(db),
    users: new DrizzleUserRepository(db),
    groups: new DrizzleGroupRepository(db),
    categories: new DrizzleCategoryRepository(db),
    expenses: new DrizzleExpenseRepository(db),
    paymentInstruments: new DrizzlePaymentInstrumentRepository(db),
    budgetLimits: new DrizzleBudgetLimitRepository(db),
  };
}
