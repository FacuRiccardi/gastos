import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePurchaseApproved, ParseError } from '../src/parser.js';

// The fixtures are real bank emails with every personal detail (names, card digits, merchants,
// amounts, dates, addresses, tracking links) replaced by made-up values.
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const html = fixture('approved-purchase.html');

describe('parsePurchaseApproved', () => {
  it('parses the sample email (credit card, main holder)', () => {
    expect(parsePurchaseApproved(html)).toEqual({
      purchaseDate: '2026-03-15',
      merchant: 'RECARGAS EJEMPLO',
      amount: 12500,
      currency: 'ARS',
      cardLast4: '1234',
      cardType: 'credit',
      cardHolder: 'JUAN',
      status: 'approved',
    });
  });

  it('parses another credit card purchase', () => {
    expect(parsePurchaseApproved(fixture('approved-purchase-credit-2.html'))).toEqual({
      purchaseDate: '2026-03-05',
      merchant: 'MERPAGO*SUPER',
      amount: 9876.54,
      currency: 'ARS',
      cardLast4: '1234',
      cardType: 'credit',
      cardHolder: 'JUAN',
      status: 'approved',
    });
  });

  it('parses a debit card purchase', () => {
    expect(parsePurchaseApproved(fixture('approved-purchase-debit.html'))).toEqual({
      purchaseDate: '2026-03-10',
      merchant: 'MERPAGO*TIENDA',
      amount: 50000,
      currency: 'ARS',
      cardLast4: '4321',
      cardType: 'debit',
      cardHolder: 'JUAN',
      status: 'approved',
    });
  });

  it('takes the holder of an additional card from the "a nombre de" part (SURNAME/NAME format)', () => {
    expect(parsePurchaseApproved(fixture('approved-purchase-additional-card.html'))).toEqual({
      purchaseDate: '2026-03-12',
      merchant: 'PEAJE EJEMPLO',
      amount: 4321.09,
      currency: 'ARS',
      cardLast4: '5678',
      cardType: 'credit',
      cardHolder: 'MARIA',
      status: 'approved',
    });
  });

  it('does not hardcode the main holder name: it is the first word of the text after the title', () => {
    const r = parsePurchaseApproved(html.replace('JUAN PABLO,', 'LUCIA BEATRIZ,'));
    expect(r.cardHolder).toBe('LUCIA');
  });

  it('marks a rejected purchase (template variant with different icons and a zero amount)', () => {
    expect(parsePurchaseApproved(fixture('approved-purchase-zero-amount.html'))).toEqual({
      purchaseDate: '2026-03-14',
      merchant: 'SEGUROS EJEMPLO',
      amount: 0,
      currency: 'ARS',
      cardLast4: '1234',
      cardType: 'credit',
      cardHolder: 'JUAN',
      status: 'rejected',
    });
  });

  it('does not depend on the icon file names', () => {
    const renamed = html.replaceAll('Shop.png', 'other_a.png').replaceAll('Receipt.png', 'other_b.png');
    expect(parsePurchaseApproved(renamed).merchant).toBe('RECARGAS EJEMPLO');
  });

  it.each([
    ['ARS 950,00', 'ARS', 950],
    ['ARS 1.234.567,89', 'ARS', 1234567.89],
    ['USD 25,50', 'USD', 25.5],
  ])('parses the amount %s', (text, currency, amount) => {
    const r = parsePurchaseApproved(html.replace('ARS 12.500,00', text));
    expect(r.currency).toBe(currency);
    expect(r.amount).toBe(amount);
  });

  it('decodes HTML entities in the merchant name', () => {
    const r = parsePurchaseApproved(html.replace('RECARGAS EJEMPLO', 'CAF&Eacute; &amp; CIA'));
    expect(r.merchant).toBe('CAFÉ & CIA');
  });

  it('throws ParseError when the amount is missing', () => {
    expect(() => parsePurchaseApproved(html.replace('ARS 12.500,00', ''))).toThrow(ParseError);
  });

  it('throws ParseError when the card type is not credit or debit', () => {
    expect(() => parsePurchaseApproved(html.replace('tarjeta de crédito Visa', 'tarjeta Visa'))).toThrow(ParseError);
  });

  it('throws ParseError when the HTML is not a purchase email', () => {
    expect(() => parsePurchaseApproved('<html><body><p>Hello</p></body></html>')).toThrow(ParseError);
  });
});
