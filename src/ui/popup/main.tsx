import { render } from 'preact';

import { PRODUCT, UI_TEXT } from '../../shared/product';
import '../extension-page.css';

function PopupApp() {
  const openSettings = () => {
    void chrome.runtime.openOptionsPage();
  };

  return (
    <main style={{ padding: '18px' }}>
      <strong>{PRODUCT.name}</strong>
      <p>{PRODUCT.tagline}</p>
      <p>{UI_TEXT.foundationStatus}</p>
      <button type="button" onClick={openSettings}>
        {UI_TEXT.openSettings}
      </button>
    </main>
  );
}

const root = document.getElementById('app');

if (!root) {
  throw new Error('Tynly popup root is missing.');
}

render(<PopupApp />, root);
