import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { paymentInstruments } from '../db/schema/expense.js';
import { PaymentInstrument } from '../../domain/expense/payment-instrument/PaymentInstrument.js';
import type { PaymentInstrumentRepository } from '../../domain/expense/payment-instrument/PaymentInstrumentRepository.js';
import { PaymentInstrumentId } from '../../domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentType } from '../../domain/expense/payment-instrument/PaymentInstrumentType.js';
import { UserId } from '../../domain/identity/user/UserId.js';

export class DrizzlePaymentInstrumentRepository implements PaymentInstrumentRepository {
  constructor(private readonly db: Db) {}

  async findById(id: PaymentInstrumentId): Promise<PaymentInstrument | null> {
    const rows = await this.db.select().from(paymentInstruments).where(eq(paymentInstruments.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findActiveByUser(userId: UserId): Promise<PaymentInstrument[]> {
    const rows = await this.db
      .select()
      .from(paymentInstruments)
      .where(and(eq(paymentInstruments.userId, userId), isNull(paymentInstruments.deletedAt)));
    return rows.map((r) => this.toDomain(r));
  }

  async save(instrument: PaymentInstrument): Promise<void> {
    const row = this.toRow(instrument);
    const now = new Date();
    await this.db
      .insert(paymentInstruments)
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: paymentInstruments.id,
        set: { name: row.name, deletedAt: row.deletedAt, updatedAt: now },
      });
  }

  private toDomain(row: typeof paymentInstruments.$inferSelect): PaymentInstrument {
    return new PaymentInstrument(
      PaymentInstrumentId.from(row.id),
      UserId.from(row.userId),
      row.type as PaymentInstrumentType,
      row.name,
      row.deletedAt ?? undefined,
    );
  }

  private toRow(instrument: PaymentInstrument): typeof paymentInstruments.$inferInsert {
    return {
      id: instrument.id,
      userId: instrument.userId,
      type: instrument.type,
      name: instrument.name,
      deletedAt: instrument.deletedAt ?? null,
    };
  }
}
