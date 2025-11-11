(() => {
  const PURPLE = '#8B5CF6';

  const toRGB = (s) => {
    if (!s) return null;
    if (s.startsWith('rgb')) {
      const m = s.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    }
    if (s.startsWith('#')) {
      let hex = s.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    }
    return null;
  };

  const rgbToHsv = ({ r, g, b }) => {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      switch (max) {
        case rn: h = ((gn - bn) / d) % 6; break;
        case gn: h = (bn - rn) / d + 2; break;
        case bn: h = (rn - gn) / d + 4; break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return { h, s, v };
  };

  const isBlueish = (cssColor) => {
    const rgb = toRGB(cssColor);
    if (!rgb) return false;
    const { h, s, v } = rgbToHsv(rgb);
    return (h >= 190 && h <= 225) && (s >= 0.25) && (v >= 0.35);
  };

  const setImportant = (el, prop, val) => el.style.setProperty(prop, val, 'important');

  const paintIfBlue = (el) => {
    const cs = window.getComputedStyle(el);
    const tn = el.tagName;
    if (!['IMG', 'VIDEO', 'CANVAS'].includes(tn)) {
      if (isBlueish(cs.color)) setImportant(el, 'color', PURPLE);
      if (isBlueish(cs.backgroundColor)) setImportant(el, 'background-color', PURPLE);
      ['borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'].forEach((p,i)=>{
        if (isBlueish(cs[p])) {
          const map = ['border-top-color','border-right-color','border-bottom-color','border-left-color'];
          setImportant(el, map[i], PURPLE);
        }
      });
      if (isBlueish(cs.outlineColor)) setImportant(el, 'outline-color', PURPLE);
      if (isBlueish(cs.caretColor)) setImportant(el, 'caret-color', PURPLE);
    }
    if (tn === 'SVG' || el instanceof SVGElement) {
      const targets = (tn === 'SVG') ? el.querySelectorAll('*') : [el];
      targets.forEach(node => {
        const fill = node.getAttribute && node.getAttribute('fill');
        const stroke = node.getAttribute && node.getAttribute('stroke');
        const cs2 = window.getComputedStyle(node);
        const fillColor = fill || cs2.fill;
        const strokeColor = stroke || cs2.stroke;
        if (fillColor && isBlueish(fillColor)) node.setAttribute('fill', PURPLE);
        if (strokeColor && isBlueish(strokeColor)) node.setAttribute('stroke', PURPLE);
      });
    }
  };

  const walkerPaint = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    let node = root;
    paintIfBlue(node);
    while ((node = walker.nextNode())) paintIfBlue(node);
  };

  // purple twitter bird svg
  const purpleBirdSVG = `
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-label="Twitter logo (purple)">
      <path fill="${PURPLE}" d="M95.7,40.4c0.03,0.73,0.03,1.47,0.03,2.2c0,22.49-17.11,48.42-48.42,48.42
      c-9.62,0-18.58-2.82-26.12-7.66c1.34,0.16,2.7,0.24,4.08,0.24c7.98,0,15.33-2.72,21.18-7.29c-7.45-0.14-13.73-5.07-15.9-11.85
      c1.04,0.2,2.12,0.31,3.23,0.31c1.56,0,3.07-0.2,4.5-0.6c-7.79-1.57-13.67-8.44-13.67-16.68v-0.21c2.3,1.28,4.94,2.06,7.74,2.15
      c-4.59-3.06-7.61-8.29-7.61-14.21c0-3.13,0.84-6.06,2.31-8.58c8.41,10.31,21,17.09,35.17,17.81c-0.29-1.25-0.44-2.55-0.44-3.89
      c0-9.41,7.63-17.05,17.05-17.05c4.9,0,9.33,2.07,12.44,5.39c3.88-0.76,7.53-2.18,10.82-4.14c-1.27,3.97-3.97,7.3-7.49,9.4
      c3.44-0.41,6.71-1.32,9.76-2.67C101.85,35.2,98.99,38.1,95.7,40.4z"/>
    </svg>
  `.trim();

  const replaceTopLeftLogo = () => {
    const selectors = [
      'a[aria-label="X"] svg',
      '[data-testid="AppTabBar_Logo"] svg',
      'header a[href="/home"] svg',
      'a[href="/home"][role="link"] svg'
    ];
    for (const sel of selectors) {
      const svg = document.querySelector(sel);
      if (svg && svg.parentElement) {
        const size = Math.max(svg.clientWidth || 24, svg.clientHeight || 24);
        const wrapper = svg.parentElement;
        wrapper.innerHTML = purpleBirdSVG;
        const newSvg = wrapper.querySelector('svg');
        if (newSvg) {
          newSvg.style.width = `${size}px`;
          newSvg.style.height = `${size}px`;
          newSvg.style.display = 'block';
        }
        break;
      }
    }
  };

  const replaceFavicon = () => {
  const u16  = chrome.runtime.getURL('assets/purple-bird-16.png');
  const u32  = chrome.runtime.getURL('assets/purple-bird-32.png');
  const u64  = chrome.runtime.getURL('assets/purple-bird-64.png');
  const u180 = chrome.runtime.getURL('assets/purple-bird-180.png');

  const upsert = ({ rel, href, sizes, type }) => {
    let link = [...document.head.querySelectorAll('link')]
      .find(l => l.rel === rel && (!sizes || l.sizes?.value === sizes));
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      if (sizes) link.sizes = sizes;
      if (type) link.type = type;
      document.head.appendChild(link);
    }
    link.href = href;
    if (sizes) link.sizes = sizes;
    if (type) link.type = type;
  };

  upsert({ rel: 'icon', href: u16, sizes: '16x16', type: 'image/png' });
  upsert({ rel: 'icon', href: u32, sizes: '32x32', type: 'image/png' });
  upsert({ rel: 'icon', href: u64, sizes: '64x64', type: 'image/png' });

  upsert({ rel: 'shortcut icon', href: u32, type: 'image/png' });

  upsert({ rel: 'apple-touch-icon', href: u180, sizes: '180x180', type: 'image/png' });
};

  const updateTitle = () => {
    if (!document.title) return;
    const newTitle = document.title
      .replace(/\s*\/\s*X\b/i, ' / Twitter')
      .replace(/\bX\b/i, 'Twitter');
    if (newTitle !== document.title) document.title = newTitle;
  };

  const injectActiveStyles = () => {
  if (document.getElementById('x-purple-active-styles')) return;
  const style = document.createElement('style');
  style.id = 'x-purple-active-styles';
  style.textContent = `
    /* left sidebar: active item = purple (text + icon) */
    a[role="link"][aria-current="page"],
    a[role="link"][aria-selected="true"],
    div[role="tab"][aria-selected="true"] {
      color: ${PURPLE} !important;
      font-weight: 700 !important; /* keep the bold look */
    }
    /* label text inside the active item */
    a[role="link"][aria-current="page"] span,
    a[role="link"][aria-selected="true"] span,
    div[role="tab"][aria-selected="true"] span {
      color: ${PURPLE} !important;
      font-weight: 700 !important;
    }
    /* icons inside the active item */
    a[role="link"][aria-current="page"] svg,
    a[role="link"][aria-selected="true"] svg,
    div[role="tab"][aria-selected="true"] svg {
      color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;
    }
    a[role="link"][aria-current="page"] svg *,
    a[role="link"][aria-selected="true"] svg *,
    div[role="tab"][aria-selected="true"] svg * {
      color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;
    }
  `;
  document.head.appendChild(style);
};

const injectActiveStylesHard = () => {
  if (document.getElementById('x-purple-active-styles-hard')) return;
  const style = document.createElement('style');
  style.id = 'x-purple-active-styles-hard';
  style.textContent = `
    /* smash active states to purple via attribute selectors with high specificity */
    nav a[role="link"][aria-current="page"],
    nav a[role="link"][aria-selected="true"],
    nav [data-testid^="AppTabBar_"][aria-current="page"],
    nav [data-testid^="AppTabBar_"][aria-selected="true"],
    [role="tab"][aria-selected="true"],
    [data-selected="true"] {
      color: ${PURPLE} !important;
      -webkit-text-fill-color: ${PURPLE} !important;
      font-weight: 700 !important;
    }
    nav a[role="link"][aria-current="page"] *,
    nav a[role="link"][aria-selected="true"] *,
    nav [data-testid^="AppTabBar_"][aria-current="page"] *,
    nav [data-testid^="AppTabBar_"][aria-selected="true"] *,
    [role="tab"][aria-selected="true"] *,
    [data-selected="true"] * {
      color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;
      -webkit-text-fill-color: ${PURPLE} !important;
      border-color: ${PURPLE} !important;
    }
  `;
  document.head.appendChild(style);
};

const isWhiteish = (cssColor) => {
  const rgb = toRGB(cssColor);
  if (!rgb) return false;
  const { r, g, b } = rgb;
  return r >= 245 && g >= 245 && b >= 245; 
};

const paintActiveTabs = () => {
  const sel = [
    'nav a[role="link"][aria-current="page"]',
    'nav a[role="link"][aria-selected="true"]',
    'nav [data-testid^="AppTabBar_"][aria-current="page"]',
    'nav [data-testid^="AppTabBar_"][aria-selected="true"]',
    '[role="tab"][aria-selected="true"]',
    '[data-selected="true"]'
  ].join(',');

  const actives = document.querySelectorAll(sel);
  actives.forEach(el => {
    el.style.setProperty('color', PURPLE, 'important');
    el.style.setProperty('font-weight', '700', 'important');
    el.style.setProperty('-webkit-text-fill-color', PURPLE, 'important');

    el.style.setProperty('background-color', 'transparent', 'important');

    el.querySelectorAll('*').forEach(n => {
      n.style.setProperty('color', PURPLE, 'important');
      n.style.setProperty('fill', PURPLE, 'important');
      n.style.setProperty('stroke', PURPLE, 'important');
      n.style.setProperty('-webkit-text-fill-color', PURPLE, 'important');

      n.style.setProperty('background-color', 'transparent', 'important');
      n.style.setProperty('border-color', PURPLE, 'important');

      if (n.style.filter && /brightness|invert|grayscale|contrast/.test(n.style.filter)) {
        n.style.setProperty('filter', 'none', 'important');
      }
    });
  });
};


  const init = () => {
    injectActiveStyles();
    walkerPaint(document.documentElement);
    replaceTopLeftLogo();
    replaceFavicon();
    updateTitle();
    paintActiveTabs();
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            walkerPaint(node);
            if (node.matches?.('header, nav, a[href="/home"]') || node.querySelector?.('header, nav, a[href="/home"]')) {
              replaceTopLeftLogo();
              replaceFavicon();
            }
          }
        });
      } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
        paintIfBlue(m.target);
      }
    }
    updateTitle();
    paintActiveTabs();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else init();

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'title']
  });

  document.addEventListener('click', () => setTimeout(paintActiveTabs, 0), true);
  window.addEventListener('popstate', () => setTimeout(paintActiveTabs, 0));


  // update title sometimes to change title swaps
  setInterval(paintActiveTabs, 1000);
  setInterval(updateTitle, 1000);
})();
