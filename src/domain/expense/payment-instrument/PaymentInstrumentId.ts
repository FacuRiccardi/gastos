declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type PaymentInstrumentId = Brand<string, 'PaymentInstrumentId'>;

export const PaymentInstrumentId = {
  generate(): PaymentInstrumentId {
    return crypto.randomUUID() as PaymentInstrumentId;
  },
  from(value: string): PaymentInstrumentId {
    return value as PaymentInstrumentId;
  },
};
