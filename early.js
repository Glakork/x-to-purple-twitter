// early.js — runs at document_start to set favicon + splash safely.
(() => {
  const u16  = chrome.runtime.getURL('assets/purple-bird-16.png');
  const u32  = chrome.runtime.getURL('assets/purple-bird-32.png');
  const u64  = chrome.runtime.getURL('assets/purple-bird-64.png');
  const u180 = chrome.runtime.getURL('assets/purple-bird-180.png');

  const ensureHead = () => {
    let h = document.head;
    if (!h) {
      h = document.createElement('head');
      const html = document.documentElement || document;
      html.insertBefore(h, document.body || null);
    }
    return h;
  };

  const upsert = ({ rel, href, sizes, type }) => {
    const head = ensureHead();
    let link = [...head.querySelectorAll('link')]
      .find(l => l.rel === rel && (!sizes || l.sizes?.value === sizes));
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      if (sizes) link.sizes = sizes;
      if (type) link.type = type;
      head.appendChild(link);
    }
    link.href = href;
    if (sizes) link.sizes = sizes;
    if (type) link.type = type;
  };

  // favicon ASAP
  upsert({ rel: 'icon', href: u16, sizes: '16x16', type: 'image/png' });
  upsert({ rel: 'icon', href: u32, sizes: '32x32', type: 'image/png' });
  upsert({ rel: 'icon', href: u64, sizes: '64x64', type: 'image/png' });
  upsert({ rel: 'shortcut icon', href: u32, type: 'image/png' });
  upsert({ rel: 'apple-touch-icon', href: u180, sizes: '180x180', type: 'image/png' });

  // purple splash without DOM churn
  const head = ensureHead();
  const style = document.createElement('style');
  style.textContent = `
    [data-testid="SplashScreen"] svg { display: none !important; }
    [data-testid="SplashScreen"] { position: relative !important; }
    [data-testid="SplashScreen"]::after {
      content: "";
      position: absolute; inset: 0; margin: auto;
      width: 64px; height: 64px;
      background: url("${u64}") center / contain no-repeat;
      pointer-events: none;
      display: block;
    }
  `;
  head.appendChild(style);
})();
