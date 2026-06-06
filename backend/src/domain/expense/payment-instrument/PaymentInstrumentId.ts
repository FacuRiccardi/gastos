declare const __paymentInstrumentId: unique symbol;
export type PaymentInstrumentId = string & { [__paymentInstrumentId]: true };

export const PaymentInstrumentId = {
  generate(): PaymentInstrumentId {
    return crypto.randomUUID() as PaymentInstrumentId;
  },
  from(value: string): PaymentInstrumentId {
    return value as PaymentInstrumentId;
  },
};
