export const RESULT_SANITIZER_WRAPPERS = ['label', 'code-fence', 'quotes'] as const;

export type ResultSanitizerWrapper = (typeof RESULT_SANITIZER_WRAPPERS)[number];
export type ResultSanitizerFailureReason = 'empty' | 'not-text';

export type ResultSanitizationResult =
  | {
      readonly ok: true;
      readonly text: string;
      readonly removedWrappers: readonly ResultSanitizerWrapper[];
    }
  | {
      readonly ok: false;
      readonly reason: ResultSanitizerFailureReason;
    };

const fullOutputLabelPattern = /^(?:translation|output)\s*:(?:[ \t]*\r?\n|[ \t]+)([\s\S]+)$/iu;
const labelOnlyPattern = /^(?:translation|output)\s*:\s*$/iu;
const singleEnclosingFencePattern = /^```[^\r\n`]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/u;
const innerFencePattern = /(?:^|\r?\n)```/u;

/**
 * Removes only full-output wrappers that providers commonly add despite being
 * asked for plain text. It deliberately does not try to rewrite prose, remove
 * commentary, or interpret Markdown beyond one enclosing code fence.
 */
export function sanitizeTransformResult(value: unknown): ResultSanitizationResult {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'not-text' };
  }

  let text = value.trim();
  if (text.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  const removedWrappers: ResultSanitizerWrapper[] = [];
  const withoutLabel = stripFullOutputLabel(text);
  if (withoutLabel !== undefined) {
    text = withoutLabel.trim();
    removedWrappers.push('label');
  }

  const withoutFence = stripSingleEnclosingFence(text);
  if (withoutFence !== undefined) {
    text = withoutFence.trim();
    removedWrappers.push('code-fence');
  }

  const withoutQuotes = stripSimpleEnclosingQuotes(text);
  if (withoutQuotes !== undefined) {
    text = withoutQuotes.trim();
    removedWrappers.push('quotes');
  }

  return text.length > 0 ? { ok: true, text, removedWrappers } : { ok: false, reason: 'empty' };
}

function stripFullOutputLabel(value: string): string | undefined {
  const match = value.match(fullOutputLabelPattern);
  return match?.[1] ?? (labelOnlyPattern.test(value) ? '' : undefined);
}

function stripSingleEnclosingFence(value: string): string | undefined {
  const match = value.match(singleEnclosingFencePattern);
  const innerText = match?.[1];
  if (innerText === undefined || innerFencePattern.test(innerText)) {
    return undefined;
  }
  return innerText;
}

function stripSimpleEnclosingQuotes(value: string): string | undefined {
  if (value.length < 2) {
    return undefined;
  }

  const first = value.at(0);
  const last = value.at(-1);
  const closingQuote = first ? matchingClosingQuote(first) : undefined;
  if (!first || !closingQuote || last !== closingQuote) {
    return undefined;
  }

  const innerText = value.slice(1, -1);
  return innerText.includes(first) || innerText.includes(closingQuote) ? undefined : innerText;
}

function matchingClosingQuote(value: string): string | undefined {
  switch (value) {
    case '"':
      return '"';
    case "'":
      return "'";
    case '“':
      return '”';
    case '‘':
      return '’';
    default:
      return undefined;
  }
}
