import { ParseError } from './parser.js';

function findHtml(part) {
  if (part.mimeType === 'text/html' && part.body?.data) return part.body.data;
  for (const child of part.parts ?? []) {
    const data = findHtml(child);
    if (data) return data;
  }
  return null;
}

function header(message, name) {
  const h = message.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

function address(from) {
  return (/<([^>]+)>/.exec(from)?.[1] ?? from).trim();
}

export function extractHeaders(message) {
  return {
    id: message.id,
    sender: address(header(message, 'From')),
    subject: header(message, 'Subject'),
  };
}

function receivedAt(message) {
  const fromHeader = new Date(header(message, 'Date'));
  if (!Number.isNaN(fromHeader.getTime())) return fromHeader;
  const internal = new Date(Number(message.internalDate));
  if (message.internalDate && !Number.isNaN(internal.getTime())) return internal;
  throw new ParseError(`Message ${message.id} has no valid received date`);
}

export function extractMessage(message) {
  const data = findHtml(message.payload ?? {});
  if (!data) throw new ParseError(`Message ${message.id} has no text/html part`);
  return {
    ...extractHeaders(message),
    receivedAt: receivedAt(message),
    html: Buffer.from(data, 'base64url').toString('utf8'),
  };
}
