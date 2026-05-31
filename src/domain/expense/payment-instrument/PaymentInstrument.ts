import { PaymentInstrumentId } from './PaymentInstrumentId.js';
import { PaymentInstrumentType } from './PaymentInstrumentType.js';
import { UserId } from '../../identity/user/UserId.js';

export class PaymentInstrument {
  readonly id: PaymentInstrumentId;
  readonly name: string;
  readonly type: PaymentInstrumentType;
  readonly userId: UserId;
  readonly isDeleted: boolean;

  constructor(id: PaymentInstrumentId, name: string, type: PaymentInstrumentType, userId: UserId, isDeleted = false) {
    if (!id) throw new Error('PaymentInstrumentId is required');
    if (!name || name.trim() === '') throw new Error('PaymentInstrument name is required');
    if (!userId) throw new Error('UserId is required');
    this.id = id;
    this.name = name;
    this.type = type;
    this.userId = userId;
    this.isDeleted = isDeleted;
  }

  rename(name: string): PaymentInstrument {
    if (!name || name.trim() === '') throw new Error('PaymentInstrument name is required');
    return new PaymentInstrument(this.id, name, this.type, this.userId, this.isDeleted);
  }

  softDelete(): PaymentInstrument {
    return new PaymentInstrument(this.id, this.name, this.type, this.userId, true);
  }
}
