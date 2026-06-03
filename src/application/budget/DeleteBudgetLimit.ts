import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';

export interface DeleteBudgetLimitInput {
  id: BudgetLimitId;
}

export class DeleteBudgetLimit {
  constructor(private readonly limits: BudgetLimitRepository) {}

  async execute(input: DeleteBudgetLimitInput): Promise<void> {
    const limit = await this.limits.findById(input.id);
    if (!limit) throw new Error('BudgetLimit not found');

    await this.limits.delete(input.id);
  }
}
