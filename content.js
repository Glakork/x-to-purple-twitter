(() => {
  const PURPLE = '#8B5CF6';
  const DARK_PURPLE = '#4C1D95';

  // props we sometimes scrub from inline styles
  const PURPLE_PROPS = [
    'color','fill','stroke','-webkit-text-fill-color','border-color','background-color','font-weight','filter','text-shadow'
  ];
  const clearPurpleStyles = (el) => { PURPLE_PROPS.forEach(p => el.style.removeProperty(p)); };

  // ---- observer guards + batching ------------------------------------------
  let OBS_PAUSED = false;
  const withMutationsPaused = (fn) => { OBS_PAUSED = true; try { fn(); } finally { OBS_PAUSED = false; } };

  let pendingNodes = new Set();
  let flushScheduled = false;

  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      const nodes = Array.from(pendingNodes);
      pendingNodes.clear();

      withMutationsPaused(() => {
        for (const n of nodes) {
          if (n && n.nodeType === Node.ELEMENT_NODE) {
            // recolor blues in this subtree
            walkerPaint(n);

            // scrub action-bar stuck purple if this node sits in/near one
            const grp = n.closest?.('article [role="group"]');
            if (grp) clearActionBarPurple(grp);

            // scrub tweet-header overflow/grok buttons
            const headerBtn = n.closest?.('article header [role="button"], article [aria-haspopup="menu"]');
            if (headerBtn) clearHeaderButtonsPurple(headerBtn);

            // logo/favicon swaps if header/nav appeared
            if (
              n.matches?.('header, nav, a[href="/home"]') ||
              n.querySelector?.('header, nav, a[href="/home"]')
            ) {
              replaceTopLeftLogo();
              replaceFavicon();
            }
          }
        }
        updateTitle();
      });
    });
  };

  const clearActionBarPurple = (root = document) => {
    root.querySelectorAll('article [role="group"]').forEach(group => {
      group.querySelectorAll('[data-testid], [data-testid] *, [dir="auto"], span, svg, path').forEach(clearPurpleStyles);
    });
  };

  // ---- utils ----------------------------------------------------------------
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
  const PAINT_SKIP_STATIC = [
    '[data-testid="toolBar"]',
    '[data-testid="tweetButtonInline"]',
    '[role="progressbar"]',
    '[data-testid*="counter" i]',
    '[data-testid*="count" i]',
    '[data-testid*="character" i]',
    '[data-testid*="progress" i]',
    '[aria-label*="reply" i]',
    '[data-testid*="reply" i]',
    // tweet header action buttons (… menu, grok/ai, etc)
    'article header [role="button"]',
    'article [aria-haspopup="menu"]',
    'article [aria-label*="More" i]',
    'article [aria-label*="Grok" i]',
    'article [data-testid*="overflow" i]'
  ].join(', ');
  if (el.closest?.(PAINT_SKIP_STATIC)) return;

  // skip the action bar (reply/retweet/like/views/bookmark/share)
  const grp = el.closest?.('[role="group"]');
  if (grp) {
    const looksLikeActionBar = grp.querySelector(
      '[data-testid="reply"],[data-testid="retweet"],[data-testid="unretweet"],[data-testid="like"],[data-testid="unlike"],[data-testid="share"],[data-testid="bookmark"],[aria-label*="Reply" i],[aria-label*="Retweet" i],[aria-label*="Like" i],[aria-label*="Share" i],[aria-label*="Bookmark" i],[aria-label*="Views" i]'
    );
    if (looksLikeActionBar) return;
  }

  // ⬇️ compute styles BEFORE using them
  const cs = window.getComputedStyle(el);
  const tn = el.tagName;

  // do not paint bg for sidebar/trends/menus (avoids “stuck hover”)
  const skipBgPaint =
    el.closest?.('aside') ||                                // right rail / sidebar
    el.closest?.('[data-testid*="trend" i]') ||             // trending rows
    el.closest?.('[role="menu"], [aria-haspopup="menu"]');  // overflow menus

  if (!['IMG','VIDEO','CANVAS'].includes(tn)) {
    if (isBlueish(cs.color)) setImportant(el, 'color', PURPLE);
    if (!skipBgPaint && isBlueish(cs.backgroundColor)) setImportant(el, 'background-color', PURPLE);
    ['borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'].forEach((p,i)=>{
      if (isBlueish(cs[p])) {
        const map = ['border-top-color','border-right-color','border-bottom-color','border-left-color'];
        setImportant(el, map[i], PURPLE);
      }
    });
    if (isBlueish(cs.outlineColor)) setImportant(el, 'outline-color', PURPLE);
    if (isBlueish(cs.caretColor)) setImportant(el, 'caret-color', PURPLE);
  }

  if ((tn === 'SVG' || el instanceof SVGElement) && !el.closest?.(PAINT_SKIP_STATIC)) {
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
    if (node.nodeType === Node.ELEMENT_NODE) paintIfBlue(node);
    while ((node = walker.nextNode())) paintIfBlue(node);
  };

  // ---- purple bird svg ------------------------------------------------------
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
        withMutationsPaused(() => {
          wrapper.innerHTML = purpleBirdSVG;
          const newSvg = wrapper.querySelector('svg');
          if (newSvg) {
            newSvg.style.width = `${size}px`;
            newSvg.style.height = `${size}px`;
            newSvg.style.display = 'block';
          }
        });
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
      withMutationsPaused(() => {
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
      });
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

  // --- CSS injectors ---------------------------------------------------------
  const injectActiveTabStyles = () => {
    if (document.getElementById('x-purple-active-tabs')) return;
    const style = document.createElement('style');
    style.id = 'x-purple-active-tabs';
    style.textContent = `
      nav a[role="link"][aria-current="page"],
      nav a[role="link"][aria-selected="true"],
      [role="tab"][aria-selected="true"] {
        color: ${PURPLE} !important;
        -webkit-text-fill-color: ${PURPLE} !important;
        font-weight: 700 !important;
        background: transparent !important;
      }
      nav a[role="link"][aria-current="page"] svg,
      nav a[role="link"][aria-selected="true"] svg,
      [role="tab"][aria-selected="true"] svg,
      nav a[role="link"][aria-current="page"] svg *,
      nav a[role="link"][aria-selected="true"] svg *,
      [role="tab"][aria-selected="true"] svg * {
        color: ${PURPLE} !important;
        fill: ${PURPLE} !important;
        stroke: ${PURPLE} !important;
      }
      nav a[role="link"]:not([aria-current="page"]):not([aria-selected="true"]),
      [role="tab"]:not([aria-selected="true"]) {
        -webkit-text-fill-color: inherit !important;
        color: inherit !important;
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);
  };

  const injectPostButtonStyles = () => {
    if (document.getElementById('x-purple-post-btn-styles')) return;
    const style = document.createElement('style');
    style.id = 'x-purple-post-btn-styles';
    style.textContent = `
      [data-testid="tweetButtonInline"]:not([aria-disabled="true"]),
      [data-testid="tweetButton"]:not([aria-disabled="true"]),
      button[data-testid="tweetButtonInline"]:not(:disabled),
      button[data-testid="tweetButton"]:not(:disabled) {
        background: ${PURPLE} !important;
        border-color: ${PURPLE} !important;
        color: #fff !important;
        box-shadow: none !important;
      }
      [data-testid="tweetButtonInline"][aria-disabled="true"],
      [data-testid="tweetButton"][aria-disabled="true"],
      button[data-testid="tweetButtonInline"]:disabled,
      button[data-testid="tweetButton"]:disabled {
        background: ${DARK_PURPLE} !important;
        border-color: ${DARK_PURPLE} !important;
        color: #fff !important;
        opacity: 1 !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  };

  const injectComposerToolbarStyles = () => {
    if (document.getElementById('x-purple-toolbar-styles')) return;
    const style = document.createElement('style');
    style.id = 'x-purple-toolbar-styles';
    style.textContent = `
      [data-testid="toolBar"] button,
      [data-testid="toolBar"] div[role="button"] {
        background-color: transparent !important;
        border-color: transparent !important;
        color: ${PURPLE} !important;
      }
      [data-testid="toolBar"] svg,
      [data-testid="toolBar"] svg * {
        color: ${PURPLE} !important;
        fill: currentColor !important;
        stroke: currentColor !important;
      }
      [data-testid="toolBar"] button:hover,
      [data-testid="toolBar"] div[role="button"]:hover,
      [data-testid="toolBar"] button:focus-visible,
      [data-testid="toolBar"] div[role="button"]:focus-visible,
      [data-testid="toolBar"] button[aria-expanded="true"],
      [data-testid="toolBar"] div[role="button"][aria-expanded="true"] {
        background-color: rgba(139, 92, 246, 0.15) !important;
        border-color: rgba(139, 92, 246, 0.25) !important;
      }
    `;
    document.head.appendChild(style);
  };

  // splash: hide their svg, draw ours via CSS (no DOM churn)
  const injectSplashStyles = () => {
    if (document.getElementById('x-purple-splash-styles')) return;
    const u64 = chrome.runtime.getURL('assets/purple-bird-64.png');
    const style = document.createElement('style');
    style.id = 'x-purple-splash-styles';
    style.textContent = `
      [data-testid="SplashScreen"] svg { display: none !important; }
      [data-testid="SplashScreen"] { position: relative !important; }
      [data-testid="SplashScreen"]::after {
        content: "";
        display: block;
        position: absolute;
        inset: 0;
        margin: auto;
        width: 64px;
        height: 64px;
        background-image: url("${u64}");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  };

  const injectReplyChipStyles = () => {
    if (document.getElementById('x-purple-replychip-styles')) return;
    const style = document.createElement('style');
    style.id = 'x-purple-replychip-styles';
    style.textContent = `
      [aria-label*="reply" i],
      [data-testid*="reply" i] {
        color: ${PURPLE} !important;
        -webkit-text-fill-color: ${PURPLE} !important;
        background-color: transparent !important;
        border-color: transparent !important;
      }
      [aria-label*="reply" i] svg,
      [data-testid*="reply" i] svg,
      [aria-label*="reply" i] svg *,
      [data-testid*="reply" i] svg * {
        color: ${PURPLE} !important;
        fill: currentColor !important;
        stroke: currentColor !important;
      }
    `;
    document.head.appendChild(style);
  };

  const injectTabIndicatorStyles = () => {
    if (document.getElementById('x-purple-tab-underline')) return;
    const style = document.createElement('style');
    style.id = 'x-purple-tab-underline';
    style.textContent = `
      [role="tab"][aria-selected="true"]::after {
        background-color: ${PURPLE} !important;
        border-color: ${PURPLE} !important;
      }
    `;
    document.head.appendChild(style);
  };

  // reset action bar to neutral (then we overlay the white glow)
  // reset action bar to neutral (also catches buttons without data-testid)
const injectTweetActionBarStyles = () => {
  const id = 'x-purple-actionbar-reset';
  document.getElementById(id)?.remove();
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    /* the action bar is the [role="group"] that contains reply/retweet/etc */
    article [role="group"] {
      --x-purple: ${PURPLE};
    }
    /* reset colors for anything inside the action bar */
    article [role="group"] [data-testid],
    article [role="group"] [role="button"],
    article [role="group"] [data-testid] *,
    article [role="group"] [role="button"] * {
      color: inherit !important;
      -webkit-text-fill-color: inherit !important;
      fill: currentColor !important;
      stroke: currentColor !important;
      text-shadow: none !important;
      filter: none !important;
      background: none !important;
      border-color: inherit !important;
    }
  `;
  document.head.appendChild(style);
};

  // *** NEW: white glow for ALL tweet buttons (reply, retweet, like, views, bookmark, share) ***
 // purple glow for tweet buttons (reply, retweet, like, views, bookmark) — NOT share
// purple glow for ALL tweet buttons (reply, retweet, like, views, bookmark, share)
// make all tweet icons purple (reply, retweet, like, views, bookmark, share) — no glow
// make ALL tweet actions purple (no glow), including SHARE even without data-testid
const injectGlowForTweetButtons = () => {
  const id = 'x-glow-all-buttons';
  document.getElementById(id)?.remove();
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    /* explicit matches */
    article [role="group"] [data-testid="reply"],
    article [role="group"] [data-testid="retweet"],
    article [role="group"] [data-testid="unretweet"],
    article [role="group"] [data-testid="like"],
    article [role="group"] [data-testid="unlike"],
    article [role="group"] [data-testid="bookmark"],
    article [role="group"] [aria-label*="Views" i],
    article [role="group"] [data-testid*="view" i],
    article [role="group"] [data-testid*="analytics" i],
    /* FALLBACK: “any remaining action buttons” inside the real action bar.
       we identify the real bar by requiring it to contain a reply + bookmark.
       then target buttons that are NOT one of the known actions → this is SHARE. */
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i]) {
      color: ${PURPLE} !important;
      -webkit-text-fill-color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;
      text-shadow: none !important;
      filter: none !important;
    }

    /* ensure inner icons/counts follow */
    article [role="group"] [data-testid="reply"] *,
    article [role="group"] [data-testid="retweet"] *,
    article [role="group"] [data-testid="unretweet"] *,
    article [role="group"] [data-testid="like"] *,
    article [role="group"] [data-testid="unlike"] *,
    article [role="group"] [data-testid="bookmark"] *,
    article [role="group"] [aria-label*="Views" i] *,
    article [role="group"] [data-testid*="view" i] *,
    article [role="group"] [data-testid*="analytics" i] *,
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i]) * {
      color: ${PURPLE} !important;
      -webkit-text-fill-color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;
    }
  `;
  document.head.appendChild(style);
};



  const injectTweetHeaderButtonsReset = () => {
    if (document.getElementById('x-purple-headerbtn-reset')) return;
    const style = document.createElement('style');
    style.id = 'x-purple-headerbtn-reset';
    style.textContent = `
      article header [role="button"],
      article [aria-haspopup="menu"],
      article [aria-label*="More" i],
      article [aria-label*="Grok" i],
      article [data-testid*="overflow" i] {
        color: inherit !important;
        background: transparent !important;
        border-color: transparent !important;
      }
      article header [role="button"]:hover,
      article [aria-haspopup="menu"]:hover,
      article [aria-label*="More" i]:hover,
      article [aria-label*="Grok" i]:hover,
      article [data-testid*="overflow" i]:hover {
        background: rgba(255,255,255,.08) !important;
      }
    `;
    document.head.appendChild(style);
  };

  const clearHeaderButtonsPurple = (root = document) => {
    root.querySelectorAll('article header [role="button"], article [aria-haspopup="menu"]').forEach(btn => {
      btn.querySelectorAll('*').forEach(clearPurpleStyles);
      clearPurpleStyles(btn);
    });
  };

// force SHARE to be purple with no white glow, covering pseudo-elements too
const injectShareForcePurple = () => {
  const id = 'x-purple-share-force';
  document.getElementById(id)?.remove();

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    /* identify the action bar by reply+bookmark, then the "other" action = SHARE */
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i]) {
      color: ${PURPLE} !important;
      -webkit-text-fill-color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;

      /* kill white glow variants */
      text-shadow: none !important;
      filter: none !important;
      box-shadow: none !important;
    }

    /* make sure inner nodes AND pseudo-elements adopt the same styling */
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i]) *,
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i])::before,
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i])::after,
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i]) *::before,
    article [role="group"]:has([data-testid="reply"]):has([data-testid="bookmark"])
      [role="button"]:not([data-testid="reply"])
                      :not([data-testid="retweet"])
                      :not([data-testid="unretweet"])
                      :not([data-testid="like"])
                      :not([data-testid="unlike"])
                      :not([data-testid="bookmark"])
                      :not([data-testid*="view" i])
                      :not([data-testid*="analytics" i]) *::after {
      color: ${PURPLE} !important;
      -webkit-text-fill-color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;

      /* nuke any white glow applied on pseudo-elements */
      text-shadow: none !important;
      filter: none !important;
      box-shadow: none !important;

      /* if the glyph is drawn via mask/background, this forces purple */
      background-color: ${PURPLE} !important;
    }
  `;
  document.head.appendChild(style);
};

// prevent purple hover circles on sidebar
const fixSidebarButtonHoverLeak = () => {
  const id = 'x-purple-hover-fix';
  document.getElementById(id)?.remove();

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    /* reset purple background on non-tweet buttons */
    body [role="button"]:not(article [role="button"])
                         :not([data-testid="SideNav_NewTweet_Button"])
                         :not([data-testid="tweetButtonInline"])
                         :not([data-testid="tweetButton"])
                         :not([data-testid="toolBar"] *):not(nav *):not(header *):not(footer *):not(section *):not(main *):not([aria-label*="Tweet" i]) {
      background-color: transparent !important;
      border-color: transparent !important;
    }
  `;
  document.head.appendChild(style);
};

// remove purple bg that might get stuck on sidebar/trending buttons after hover
const installHoverLeakScrubber = () => {
  const scrub = (btn) => {
    if (!btn) return;
    withMutationsPaused(() => {
      btn.style.removeProperty('background-color');
      btn.style.removeProperty('border-color');
      // just in case children got styled
      btn.querySelectorAll('*').forEach(n => {
        n.style.removeProperty('background-color');
        n.style.removeProperty('border-color');
      });
    });
  };

  // when pointer leaves a sidebar/trending button, clear any inline bg
  document.addEventListener('pointerleave', (e) => {
    const btn = e.target?.closest?.(
      'aside [role="button"], [data-testid*="trend" i] [role="button"]'
    );
    if (btn) scrub(btn);
  }, true);

  // also clear once per hover “open/close” of overflow menus
  document.addEventListener('pointerup', (e) => {
    const btn = e.target?.closest?.('[aria-haspopup="menu"], [role="menu"] [role="button"]');
    if (btn) scrub(btn);
  }, true);
};

// purple hover for sidebar/trending "..." buttons (no stuck state)
const injectSidebarHoverStyles = () => {
  const id = 'x-purple-sidebar-hover';
  document.getElementById(id)?.remove();

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    /* right rail + trending modules */
    aside [role="button"]:hover,
    aside [role="button"]:focus-visible,
    [data-testid*="trend" i] [role="button"]:hover,
    [data-testid*="trend" i] [role="button"]:focus-visible {
      color: ${PURPLE} !important;
      -webkit-text-fill-color: ${PURPLE} !important;
      fill: currentColor !important;
      stroke: currentColor !important;
      background-color: rgba(139, 92, 246, 0.15) !important;
      border-color: rgba(139, 92, 246, 0.25) !important;
      box-shadow: none !important;
      text-shadow: none !important;
      filter: none !important;
    }

    /* ensure the icon drawn via pseudo-elements picks up purple */
    aside [role="button"]:hover::before,
    aside [role="button"]:hover::after,
    aside [role="button"]:focus-visible::before,
    aside [role="button"]:focus-visible::after,
    [data-testid*="trend" i] [role="button"]:hover::before,
    [data-testid*="trend" i] [role="button"]:hover::after,
    [data-testid*="trend" i] [role="button"]:focus-visible::before,
    [data-testid*="trend" i] [role="button"]:focus-visible::after {
      background-color: ${PURPLE} !important; /* covers mask-image dots */
      color: ${PURPLE} !important;
      fill: ${PURPLE} !important;
      stroke: ${PURPLE} !important;
    }
  `;
  document.head.appendChild(style);
};


  // ---- init -----------------------------------------------------------------
  const init = () => {
    withMutationsPaused(() => {
      injectActiveTabStyles();
      injectTabIndicatorStyles();
      injectComposerToolbarStyles();
      injectTweetActionBarStyles();
      injectPostButtonStyles();
      injectReplyChipStyles();
      injectGlowForTweetButtons();     
      injectShareForcePurple();
      injectSplashStyles();
      injectTweetHeaderButtonsReset();
      injectSidebarHoverStyles();
      fixSidebarButtonHoverLeak();
      installHoverLeakScrubber();

      walkerPaint(document.documentElement);
      replaceTopLeftLogo();
      replaceFavicon();
      updateTitle();

      // first-pass scrubs
      clearActionBarPurple(document);
      clearHeaderButtonsPurple(document);
    });
  };

  // ---- observer -------------------------------------------------------------
  const observer = new MutationObserver((mutations) => {
    if (OBS_PAUSED) return;
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => pendingNodes.add(node));
      } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
        pendingNodes.add(m.target);
      }
    }
    scheduleFlush();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else init();

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'title', 'aria-selected', 'aria-current', 'data-testid']
  });

  // scrub action bars immediately on hover-created subtrees
  document.addEventListener('mouseover', (e) => {
    const grp = e.target?.closest?.('article [role="group"]');
    if (grp) withMutationsPaused(() => clearActionBarPurple(grp));
  }, true);

  // keep title de-X’d as pages update
  setInterval(updateTitle, 1000);
})();
