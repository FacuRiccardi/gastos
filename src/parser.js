import * as cheerio from 'cheerio';

export class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
  }
}

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const MONEY = /^([A-Z]{3})\s+(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/;

// The sentence under the title, e.g.
//   "JUAN PABLO, se realizó un pago con tu tarjeta de crédito Visa terminada en 1234."
//   "JUAN PABLO, se realizó un pago con la tarjeta de crédito Visa terminada en 5678, a nombre de PEREZ/MARIA L."
// ("terminada en" = "ending in", "a nombre de" = "in the name of")
const CARD_SENTENCE = /terminada\s+en\s+(\d{4})/;

// Holder first name: for additional cards the bank writes "a nombre de SURNAME/NAME X."; otherwise
// the card belongs to the person named at the start of the sentence ("NAME SURNAME, se realizó ...").
function cardHolder(sentence) {
  const named = /a\s+nombre\s+de\s+([^.,]+)/i.exec(sentence)?.[1];
  if (named) {
    const afterSlash = named.includes('/') ? named.split('/')[1] : named;
    return afterSlash.trim().split(/\s+/)[0];
  }
  const leading = /^([^,]+),/.exec(sentence)?.[1];
  return leading?.trim().split(/\s+/)[0];
}

// Parses the bank's "Compra aprobada" ("approved purchase") email HTML. The bank also sends
// rejected purchases with the same subject; those are marked with status 'rejected'.
// The details appear as three consecutive paragraphs: date, merchant, amount. The bank has used
// different icon files for them across template variants, so the parser relies on the order and
// shape of the texts instead of on the icons.
export function parsePurchaseApproved(html) {
  const $ = cheerio.load(html);
  const texts = $('p')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get();

  const dateIndex = texts.findIndex((t) => DATE.test(t));
  if (dateIndex === -1) throw new ParseError('Purchase date not found');
  const date = DATE.exec(texts[dateIndex]);

  const moneyIndex = texts.findIndex((t, i) => i > dateIndex && MONEY.test(t));
  if (moneyIndex === -1) throw new ParseError('Amount not found');
  const money = MONEY.exec(texts[moneyIndex]);

  const merchant = texts.slice(dateIndex + 1, moneyIndex).filter(Boolean).join(' ');
  if (!merchant) throw new ParseError('Merchant not found');

  const sentence = texts.find((t) => CARD_SENTENCE.test(t));
  if (!sentence) throw new ParseError('Card sentence not found');
  const cardLast4 = CARD_SENTENCE.exec(sentence)[1];

  const type = /tarjeta\s+de\s+(cr[eé]dito|d[eé]bito)/i.exec(sentence)?.[1];
  if (!type) throw new ParseError('Card type not found');

  const holder = cardHolder(sentence);
  if (!holder) throw new ParseError('Card holder not found');

  // "Rechazamos la compra" = "We rejected the purchase" (hidden preheader of rejected-purchase emails)
  const rejected = /Rechazamos\s+la\s+compra/i.test($('body').text());

  return {
    purchaseDate: `${date[3]}-${date[2]}-${date[1]}`,
    merchant,
    amount: Number(`${money[2].replaceAll('.', '')}.${money[3]}`),
    currency: money[1],
    cardLast4,
    cardType: /^cr/i.test(type) ? 'credit' : 'debit',
    cardHolder: holder,
    status: rejected ? 'rejected' : 'approved',
  };
}
