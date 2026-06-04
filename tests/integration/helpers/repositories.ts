import { testDb } from './testDb.js';
import { DrizzleHouseholdRepository } from '../../../src/infrastructure/identity/DrizzleHouseholdRepository.js';
import { DrizzleUserRepository } from '../../../src/infrastructure/identity/DrizzleUserRepository.js';
import { DrizzleGroupRepository } from '../../../src/infrastructure/catalogue/DrizzleGroupRepository.js';
import { DrizzleCategoryRepository } from '../../../src/infrastructure/catalogue/DrizzleCategoryRepository.js';
import { DrizzleExpenseRepository } from '../../../src/infrastructure/expense/DrizzleExpenseRepository.js';
import { DrizzlePaymentInstrumentRepository } from '../../../src/infrastructure/expense/DrizzlePaymentInstrumentRepository.js';
import { DrizzleBudgetLimitRepository } from '../../../src/infrastructure/budget/DrizzleBudgetLimitRepository.js';

export function makeRepos() {
  return {
    households: new DrizzleHouseholdRepository(testDb),
    users: new DrizzleUserRepository(testDb),
    groups: new DrizzleGroupRepository(testDb),
    categories: new DrizzleCategoryRepository(testDb),
    expenses: new DrizzleExpenseRepository(testDb),
    paymentInstruments: new DrizzlePaymentInstrumentRepository(testDb),
    budgetLimits: new DrizzleBudgetLimitRepository(testDb),
  };
}
