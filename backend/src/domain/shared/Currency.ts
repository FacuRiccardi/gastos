import { DomainError } from './DomainError.js';

const SUPPORTED = new Set(['ARS']);

export class Currency {
  private constructor(readonly code: string) {}

  static from(code: string): Currency {
    if (!SUPPORTED.has(code)) throw new DomainError(`Unsupported currency: ${code}`);
    return new Currency(code);
  }

  static readonly ARS = new Currency('ARS');

  equals(other: Currency): boolean {
    return this.code === other.code;
  }
}
