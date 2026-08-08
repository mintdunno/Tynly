import { defineManifest } from '@crxjs/vite-plugin';

import { PRODUCT } from './shared/product.ts';

export default defineManifest({
  manifest_version: 3,
  name: PRODUCT.storeName,
  short_name: PRODUCT.name,
  description: PRODUCT.description,
  version: '0.1.0',
  minimum_chrome_version: '102',
  permissions: ['storage', 'clipboardWrite'],
  host_permissions: ['http://*/*', 'https://*/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module'
  },
  action: {
    default_title: PRODUCT.name,
    default_popup: 'src/ui/popup/index.html'
  },
  options_ui: {
    page: 'src/ui/settings/index.html',
    open_in_tab: true
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/bootstrap.ts'],
      all_frames: true,
      run_at: 'document_idle'
    }
  ]
});
