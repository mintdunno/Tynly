import { describe, expect, it, vi } from 'vitest';

import { createChromeLocalStorage } from './local-storage';

describe('createChromeLocalStorage', () => {
  it('maps safe wrapper operations to Chrome local storage', async () => {
    const local = {
      get: vi.fn().mockResolvedValue({ settings: { version: 1 } }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      setAccessLevel: vi.fn().mockResolvedValue(undefined)
    };

    vi.stubGlobal('chrome', { storage: { local } });

    const storage = createChromeLocalStorage();

    await expect(storage.get('settings')).resolves.toEqual({ version: 1 });
    await storage.set('settings', { version: 2 });
    await storage.remove('settings');
    await storage.restrictToTrustedContexts();

    expect(local.get).toHaveBeenCalledWith('settings');
    expect(local.set).toHaveBeenCalledWith({ settings: { version: 2 } });
    expect(local.remove).toHaveBeenCalledWith('settings');
    expect(local.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_CONTEXTS'
    });
  });
});
