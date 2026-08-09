import { afterEach, describe, expect, it } from 'vitest';

import { InputElementAdapter, TextareaAdapter } from './text-control-adapter.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('text control adapters', () => {
  it('replaces an input selection through the native setter and dispatches one input event', () => {
    const input = document.createElement('input');
    input.value = 'Hello brave world';
    document.body.append(input);
    input.setSelectionRange(6, 11);
    const events: Event[] = [];
    input.addEventListener('input', (event) => events.push(event));

    const adapter = new InputElementAdapter();
    const snapshot = adapter.capture(input);
    const result = adapter.replace(input, snapshot ?? fail('expected a snapshot'), 'kind');

    expect(result).toMatchObject({
      ok: true,
      replacement: {
        originalText: 'brave',
        replacedRange: { start: 6, end: 11 },
        replacementText: 'kind',
        undoRange: { start: 6, end: 10 }
      }
    });
    expect(input.value).toBe('Hello kind world');
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('input');
    expect(events[0]).toMatchObject({ data: 'kind', inputType: 'insertReplacementText' });
  });

  it('treats a collapsed textarea selection as a whole-text replacement', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'First line\nSecond line';
    document.body.append(textarea);
    textarea.setSelectionRange(3, 3);

    const adapter = new TextareaAdapter();
    const snapshot = adapter.capture(textarea);
    const result = adapter.replace(
      textarea,
      snapshot ?? fail('expected a snapshot'),
      'Rewritten text'
    );

    expect(result).toMatchObject({
      ok: true,
      replacement: {
        originalText: 'First line\nSecond line',
        replacedRange: { start: 0, end: 22 },
        undoRange: { start: 0, end: 14 }
      }
    });
    expect(textarea.value).toBe('Rewritten text');
  });

  it('uses the native value setter so a framework-owned value descriptor is not called', () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const nativeGet = descriptor?.get ?? fail('expected the native getter');
    const nativeSet = descriptor?.set ?? fail('expected the native setter');
    let trackerSetterCalls = 0;
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return nativeGet.call(this);
      },
      set(value: string) {
        trackerSetterCalls += 1;
        nativeSet.call(this, value);
      }
    });
    const observedValues: string[] = [];
    input.addEventListener('input', () => observedValues.push(input.value));

    const adapter = new InputElementAdapter();
    const snapshot = adapter.capture(input);
    const result = adapter.replace(input, snapshot ?? fail('expected a snapshot'), 'after');

    expect(result).toMatchObject({ ok: true });
    expect(input.value).toBe('after');
    expect(trackerSetterCalls).toBe(0);
    expect(observedValues).toEqual(['after']);
  });

  it('rejects stale, readonly, and unsupported controls without changing their text', () => {
    const input = document.createElement('input');
    input.value = 'original';
    document.body.append(input);
    const adapter = new InputElementAdapter();
    const snapshot = adapter.capture(input);
    input.value = 'user edit';

    expect(adapter.replace(input, snapshot ?? fail('expected a snapshot'), 'replacement')).toEqual({
      ok: false,
      reason: 'stale'
    });
    expect(input.value).toBe('user edit');

    const readonly = document.createElement('input');
    readonly.readOnly = true;
    readonly.value = 'protected';
    document.body.append(readonly);
    expect(adapter.capture(readonly)).toBeNull();

    const email = document.createElement('input');
    email.type = 'email';
    email.value = 'person@example.test';
    document.body.append(email);
    expect(adapter.capture(email)).toBeNull();
  });

  it('does not report success when a controlled input synchronously reconciles a different value', () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    input.addEventListener('input', () => {
      input.value = 'framework value';
    });
    const adapter = new InputElementAdapter();
    const snapshot = adapter.capture(input);

    expect(
      adapter.replace(input, snapshot ?? fail('expected a snapshot'), 'provider value')
    ).toEqual({
      ok: false,
      reason: 'interrupted'
    });
    expect(input.value).toBe('framework value');
  });
});

function fail(message: string): never {
  throw new Error(message);
}
