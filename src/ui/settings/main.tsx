import { render } from 'preact';

import { PRODUCT, UI_TEXT } from '../../shared/product';
import '../extension-page.css';

function SettingsApp() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '32px' }}>
      <h1>{PRODUCT.name}</h1>
      <p>{PRODUCT.tagline}</p>
      <p>{UI_TEXT.foundationStatus}</p>
    </main>
  );
}

const root = document.getElementById('app');

if (!root) {
  throw new Error('Tynly settings root is missing.');
}

render(<SettingsApp />, root);
