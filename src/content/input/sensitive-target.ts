/**
 * Conservative local-only detection for fields whose contents must never be
 * captured for a provider request. A false positive is preferable to sending
 * a password, payment card, recovery phrase, or private key off the page.
 */

const MAX_METADATA_CHARACTERS = 8_192;
const MAX_VALUE_INSPECTION_CHARACTERS = 100_000;

const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set([
  'cc-csc',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-number',
  'current-password',
  'new-password',
  'one-time-code',
  'webauthn'
]);

const SENSITIVE_METADATA_PATTERN =
  /(?:\bpass(?:word|code|phrase)?\b|\bpwd\b|\bpin\b|\botp\b|\bone[-\s]?time(?:[-\s]?code)?\b|\b(?:2fa|mfa)\b|\bauth(?:entication|enticator)?\b|\b(?:security|verification)[-\s]?(?:code|token)\b|\b(?:credit|debit)[-\s]?card\b|\bcc[-\s]?(?:number|num|cvc|cvv)\b|\b(?:cvv|cvc)\b|\bcard[-\s]?(?:number|no)\b|\bprivate[-\s]?key\b|\bsecret[-\s]?key\b|\bseed[-\s]?phrase\b|\brecovery[-\s]?phrase\b|\bmnemonic\b)/iu;

const PRIVATE_KEY_PATTERN = /-----BEGIN(?: [A-Z0-9]+){0,4} PRIVATE KEY-----/iu;
const POTENTIAL_CARD_NUMBER_PATTERN = /(?:\d[ -]?){13,19}/gu;

/** Returns true when an editable target is clearly not safe to transform. */
export function isSensitiveTarget(target: Element): boolean {
  if (target instanceof HTMLInputElement && target.type.toLowerCase() === 'password') {
    return true;
  }

  const autocomplete = target.getAttribute('autocomplete')?.trim().toLowerCase();
  if (
    autocomplete !== undefined &&
    autocomplete
      .split(/\s+/u)
      .some((token) => token.startsWith('cc-') || SENSITIVE_AUTOCOMPLETE_TOKENS.has(token))
  ) {
    return true;
  }

  if (SENSITIVE_METADATA_PATTERN.test(readTargetMetadata(target))) {
    return true;
  }

  const value = readTargetText(target);
  return looksLikePrivateKey(value) || looksLikePaymentCard(value);
}

function readTargetMetadata(target: Element): string {
  const values: string[] = [];
  for (const name of ['aria-label', 'autocomplete', 'id', 'name', 'placeholder', 'title']) {
    const value = target.getAttribute(name);
    if (value !== null) {
      values.push(value);
    }
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    for (const label of Array.from(target.labels ?? [])) {
      values.push(label.textContent ?? '');
    }
  }

  const labelledBy = target.getAttribute('aria-labelledby');
  if (labelledBy !== null) {
    for (const id of labelledBy.trim().split(/\s+/u)) {
      if (id.length === 0) {
        continue;
      }
      values.push(target.ownerDocument.getElementById(id)?.textContent ?? '');
    }
  }

  return normalizeMetadata(values.join(' ')).slice(0, MAX_METADATA_CHARACTERS);
}

function normalizeMetadata(value: string): string {
  return value
    .replace(/([A-Z])([A-Z][a-z])/gu, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_./:]+/gu, ' ');
}

function readTargetText(target: Element): string {
  const value =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.value
      : (target.textContent ?? '');
  return value.slice(0, MAX_VALUE_INSPECTION_CHARACTERS);
}

function looksLikePrivateKey(value: string): boolean {
  return PRIVATE_KEY_PATTERN.test(value);
}

function looksLikePaymentCard(value: string): boolean {
  for (const match of value.matchAll(POTENTIAL_CARD_NUMBER_PATTERN)) {
    const digits = match[0].replace(/\D/gu, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhnCheck(digits)) {
      return true;
    }
  }
  return false;
}

function passesLuhnCheck(value: string): boolean {
  let total = 0;
  let doubleNext = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const digit = Number(value[index]);
    if (!Number.isInteger(digit)) {
      return false;
    }

    let contribution = digit;
    if (doubleNext) {
      contribution *= 2;
      if (contribution > 9) {
        contribution -= 9;
      }
    }
    total += contribution;
    doubleNext = !doubleNext;
  }

  return total % 10 === 0;
}
