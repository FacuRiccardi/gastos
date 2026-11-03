import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractMessage, extractHeaders } from '../src/message.js';
import { ParseError } from '../src/parser.js';

const load = () => JSON.parse(readFileSync(new URL('./fixtures/gmail-message.json', import.meta.url), 'utf8'));

describe('extractMessage', () => {
  it('extracts sender, subject and received date', () => {
    const m = extractMessage(load());
    expect(m.id).toBe('19a193c138ef0001');
    expect(m.sender).toBe('avisos-bbva-ar@bbva.com');
    expect(m.subject).toBe('Compra aprobada');
    expect(m.receivedAt.toISOString()).toBe('2026-03-15T18:30:00.000Z');
  });

  it('finds the HTML in nested multipart parts and decodes base64url', () => {
    const m = extractMessage(load());
    expect(m.html).toContain('RECARGAS EJEMPLO');
    expect(m.html).toContain('crédito');
  });

  it('extracts the address when From includes a display name', () => {
    const msg = load();
    msg.payload.headers.find((h) => h.name === 'From').value = 'BBVA Avisos <avisos-bbva-ar@bbva.com>';
    expect(extractMessage(msg).sender).toBe('avisos-bbva-ar@bbva.com');
  });

  it('throws ParseError when there is no text/html part', () => {
    const msg = load();
    msg.payload.parts = [{ mimeType: 'text/plain', body: { data: Buffer.from('hello').toString('base64url') } }];
    expect(() => extractMessage(msg)).toThrow(ParseError);
  });

  it('uses internalDate when the Date header is invalid', () => {
    const msg = load();
    msg.payload.headers.find((h) => h.name === 'Date').value = 'garbage';
    msg.internalDate = '1773599400000';
    expect(extractMessage(msg).receivedAt.toISOString()).toBe('2026-03-15T18:30:00.000Z');
  });

  it('throws ParseError when there is no valid date anywhere', () => {
    const msg = load();
    msg.payload.headers = msg.payload.headers.filter((h) => h.name !== 'Date');
    expect(() => extractMessage(msg)).toThrow(ParseError);
  });

  it('extractHeaders does not require a text/html part', () => {
    const msg = load();
    msg.payload.parts = [];
    expect(extractHeaders(msg)).toEqual({ id: '19a193c138ef0001', sender: 'avisos-bbva-ar@bbva.com', subject: 'Compra aprobada' });
  });
});
