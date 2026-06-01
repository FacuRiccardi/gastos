import { PaymentInstrument } from './PaymentInstrument.js';
import { PaymentInstrumentId } from './PaymentInstrumentId.js';
import { UserId } from '../../identity/user/UserId.js';

export interface PaymentInstrumentRepository {
  findById(id: PaymentInstrumentId): Promise<PaymentInstrument | null>;
  findActiveByUser(userId: UserId): Promise<PaymentInstrument[]>;
  save(instrument: PaymentInstrument): Promise<void>;
}
