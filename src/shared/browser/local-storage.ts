export const SETTINGS_STORAGE_KEY = 'tynly.settings';

export interface ExtensionLocalStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  restrictToTrustedContexts(): Promise<void>;
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
    }
  };
}
