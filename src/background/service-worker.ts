import { SettingsStore } from '../core/settings/settings-store.ts';
import {
  getChromeRuntime,
  registerAsyncRuntimeMessageHandler
} from '../shared/browser/runtime-messenger.ts';
import { BackgroundMessageRouter } from './message-router.ts';

const settingsStore = new SettingsStore();
const runtime = getChromeRuntime();
const router = new BackgroundMessageRouter(settingsStore);

void settingsStore.initialize().catch(() => undefined);

registerAsyncRuntimeMessageHandler(runtime, async (message, sender) =>
  router.handle(message, sender, runtime.id)
);
