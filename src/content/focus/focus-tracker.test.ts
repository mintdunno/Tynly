import { afterEach, describe, expect, it } from 'vitest';

import { InputAdapterRegistry } from '../input/input-adapter-registry.ts';

import { FocusTracker } from './focus-tracker.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('FocusTracker', () => {
  it('tracks only supported safe editable targets and clears on stop', async () => {
    const input = document.createElement('input');
    const password = document.createElement('input');
    password.type = 'password';
    document.body.append(input, password);
    const changes: Array<Element | null> = [];
    const tracker = new FocusTracker(document, new InputAdapterRegistry(), (resolved) => {
      changes.push(resolved?.target ?? null);
    });

    tracker.start();
    input.focus();
    await settle();

    expect(tracker.current?.target).toBe(input);
    expect(changes).toContain(input);

    password.focus();
    await settle();

    expect(tracker.current).toBeNull();
    tracker.stop();
    expect(changes.at(-1)).toBeNull();
  });
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
