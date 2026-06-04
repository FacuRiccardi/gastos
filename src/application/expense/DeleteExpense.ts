import { ExpenseId } from '../../domain/expense/ExpenseId.js';
import { ExpenseRepository } from '../../domain/expense/ExpenseRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface DeleteExpenseInput {
  id: ExpenseId;
}

export class DeleteExpense {
  constructor(private readonly expenses: ExpenseRepository) {}

  async execute(input: DeleteExpenseInput): Promise<void> {
    const expense = await this.expenses.findById(input.id);
    if (!expense) throw new ApplicationError('Expense not found');

    await this.expenses.delete(input.id);
  }
}
