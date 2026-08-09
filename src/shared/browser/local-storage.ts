export const SETTINGS_STORAGE_KEY = 'tynly.settings';

/**
 * Change notifications deliberately expose keys only: listeners never need
 * access to a private setting's old or new value to invalidate a cache.
 */
export type LocalStorageChangeListener = (changedKeys: readonly string[]) => void;

export interface ExtensionLocalStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  restrictToTrustedContexts(): Promise<void>;
  subscribeToChanges?(listener: LocalStorageChangeListener): void;
}

export function createChromeLocalStorage(): ExtensionLocalStorage {
  return {
    async get(key) {
      const values = (await chrome.storage.local.get(key)) as Record<string, unknown>;
      return values[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
    async restrictToTrustedContexts() {
      await chrome.storage.local.setAccessLevel({
        accessLevel: 'TRUSTED_CONTEXTS'
      });
    },
    subscribeToChanges(listener) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          listener(Object.keys(changes));
        }
      });
    }
  };
}
