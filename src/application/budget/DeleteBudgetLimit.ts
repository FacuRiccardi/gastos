import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface DeleteBudgetLimitInput {
  id: BudgetLimitId;
}

export class DeleteBudgetLimit {
  constructor(private readonly limits: BudgetLimitRepository) {}

  async execute(input: DeleteBudgetLimitInput): Promise<void> {
    const limit = await this.limits.findById(input.id);
    if (!limit) throw new ApplicationError('BudgetLimit not found');

    await this.limits.delete(input.id);
  }
}
