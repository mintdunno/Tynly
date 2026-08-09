import { afterEach, describe, expect, it } from 'vitest';

import { InputAdapterRegistry } from './input-adapter-registry.ts';
import { isSensitiveTarget } from './sensitive-target.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('InputAdapterRegistry', () => {
  it('resolves text inputs, textareas, and a nested contenteditable host', () => {
    const registry = new InputAdapterRegistry();
    const input = document.createElement('input');
    input.type = 'search';
    const textarea = document.createElement('textarea');
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    const nested = document.createElement('span');
    editor.append(nested);
    document.body.append(input, textarea, editor);

    expect(registry.resolve(input)).toMatchObject({ adapter: { kind: 'input' }, target: input });
    expect(registry.resolve(textarea)).toMatchObject({
      adapter: { kind: 'textarea' },
      target: textarea
    });
    expect(registry.resolve(nested)).toMatchObject({
      adapter: { kind: 'contenteditable' },
      target: editor
    });
  });

  it('excludes password, one-time-code, card, seed phrase, and private-key targets', () => {
    const registry = new InputAdapterRegistry();
    const password = document.createElement('input');
    password.type = 'password';
    password.value = 'not sent';

    const otp = document.createElement('input');
    otp.setAttribute('autocomplete', 'one-time-code');
    otp.value = '123456';

    const securityCode = document.createElement('input');
    securityCode.name = 'securityCode';
    securityCode.value = '654321';

    const card = document.createElement('input');
    card.value = '4111 1111 1111 1111';

    const cardAutocomplete = document.createElement('input');
    cardAutocomplete.setAttribute('autocomplete', 'cc-name');
    cardAutocomplete.value = 'Card holder';

    const seedPhrase = document.createElement('textarea');
    seedPhrase.name = 'wallet-seed-phrase';
    seedPhrase.value = 'word list that must stay local';

    const privateKey = document.createElement('textarea');
    privateKey.value = '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----';

    document.body.append(
      password,
      otp,
      securityCode,
      card,
      cardAutocomplete,
      seedPhrase,
      privateKey
    );

    for (const target of [
      password,
      otp,
      securityCode,
      card,
      cardAutocomplete,
      seedPhrase,
      privateKey
    ]) {
      expect(isSensitiveTarget(target)).toBe(true);
      expect(registry.resolve(target)).toBeNull();
    }
  });

  it('does not resolve readonly, disabled, non-text, or ordinary non-editable elements', () => {
    const registry = new InputAdapterRegistry();
    const readonly = document.createElement('input');
    readonly.readOnly = true;
    const disabled = document.createElement('textarea');
    disabled.disabled = true;
    const email = document.createElement('input');
    email.type = 'email';
    const paragraph = document.createElement('p');
    document.body.append(readonly, disabled, email, paragraph);

    expect(registry.resolve(readonly)).toBeNull();
    expect(registry.resolve(disabled)).toBeNull();
    expect(registry.resolve(email)).toBeNull();
    expect(registry.resolve(paragraph)).toBeNull();
  });
});
