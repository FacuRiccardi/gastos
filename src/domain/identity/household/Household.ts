import { HouseholdId } from './HouseholdId.js';
import { UserId } from '../user/UserId.js';

export class Household {
  readonly id: HouseholdId;
  readonly memberIds: UserId[];

  constructor(id: HouseholdId, memberIds: UserId[]) {
    if (!id) throw new Error('HouseholdId is required');
    if (!memberIds || memberIds.length === 0) throw new Error('Household must have at least one member');
    this.id = id;
    this.memberIds = [...memberIds];
  }

  addMember(userId: UserId): Household {
    return new Household(this.id, [...this.memberIds, userId]);
  }
}
