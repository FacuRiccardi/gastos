import { PaymentInstrumentId } from './PaymentInstrumentId.js';
import { PaymentInstrumentType } from './PaymentInstrumentType.js';
import { UserId } from '../../identity/user/UserId.js';
import { DomainError } from '../../shared/DomainError.js';

export class PaymentInstrument {
  constructor(
    readonly id: PaymentInstrumentId,
    readonly userId: UserId,
    readonly type: PaymentInstrumentType,
    readonly name: string,
    readonly deletedAt?: Date,
  ) {
    if (!name.trim()) throw new DomainError('PaymentInstrument name must not be empty');
  }

  get isDeleted(): boolean {
    return this.deletedAt !== undefined;
  }

  rename(newName: string): PaymentInstrument {
    if (this.isDeleted) throw new DomainError('Cannot rename a deleted PaymentInstrument');
    return new PaymentInstrument(this.id, this.userId, this.type, newName, this.deletedAt);
  }

  softDelete(): PaymentInstrument {
    if (this.isDeleted) throw new DomainError('PaymentInstrument is already deleted');
    return new PaymentInstrument(this.id, this.userId, this.type, this.name, new Date());
  }
}
