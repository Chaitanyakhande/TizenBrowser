/* TizenBrowser - optimized TizenBrew browser helper with remote cursor and blocker. */
(function () {
  'use strict';

  if (window.__tizenBrowserLoaded) return;
  window.__tizenBrowserLoaded = true;

  var STYLE_ID = 'tb-style';
  var BAR_ID = 'tb-bar';
  var CURSOR_ID = 'tb-cursor';
  var state = {
    enabled: true,
    blocked: 0,
    hidden: 0,
    cleaned: 0,
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2),
    step: 42,
    raf: 0,
    queue: [],
    processing: false
  };

  var blockedHosts = [
    '2mdn.net', 'adform.net', 'adnxs.com', 'adsafeprotected.com', 'adsrvr.org',
    'advertising.com', 'amazon-adsystem.com', 'analytics.google.com',
    'app-measurement.com', 'appsflyer.com', 'bluekai.com', 'chartbeat.com',
    'criteo.com', 'doubleclick.net', 'facebook.com/tr', 'facebook.net',
    'flashtalking.com', 'google-analytics.com', 'googlesyndication.com',
    'googletagmanager.com', 'googletagservices.com', 'hotjar.com',
    'imasdk.googleapis.com', 'moatads.com', 'newrelic.com', 'outbrain.com',
    'pubmatic.com', 'quantserve.com', 'scorecardresearch.com', 'segment.io',
    'taboola.com', 'zedo.com'
  ];

  var blockedWords = [
    '/ad/', '/ads/', '/ads?', '/adserver', '/advert', '/analytics', '/beacon',
    '/banners/', '/pagead/', '/pixel', '/prebid', '/sponsor', '/telemetry',
    '/track', '/vpaid', '/vmap', '/vast', 'adunit', 'preroll', 'midroll'
  ];

  var trackingParams = [
    'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid', 'msclkid', 'spm',
    'twclid', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source',
    'utm_term'
  ];

  var adSelector = [
    '[id*="ad"]', '[class*="ad-"]', '[class*="ad_"]', '[class*="ads-"]',
    '[class*="ads_"]', '[class*="advert"]', '[class*="sponsor"]',
    '[class*="promoted"]', '[class*="taboola"]', '[class*="outbrain"]',
    '[aria-label*="advertisement"]', '[data-testid*="ad"]',
    'iframe'
  ].join(',');

  function lower(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.toLowerCase();
    return String(value.url || value).toLowerCase();
  }

  function shouldBlock(value) {
    var url = lower(value);
    var i;

    if (!state.enabled || !url) return false;

    for (i = 0; i < blockedHosts.length; i += 1) {
      if (url.indexOf(blockedHosts[i]) !== -1) return true;
    }

    for (i = 0; i < blockedWords.length; i += 1) {
      if (url.indexOf(blockedWords[i]) !== -1) return true;
    }

    return false;
  }

  function markBlocked() {
    state.blocked += 1;
    updateStats();
  }

  function emptyFetchResponse() {
    if (window.Response) return new Response('', { status: 204, statusText: 'Blocked' });
    return '';
  }

  function patchNetwork() {
    if (window.fetch && !window.fetch.__tb) {
      var oldFetch = window.fetch;
      window.fetch = function (input) {
        if (shouldBlock(input)) {
          markBlocked();
          return Promise.resolve(emptyFetchResponse());
        }
        return oldFetch.apply(this, arguments);
      };
      window.fetch.__tb = true;
    }

    if (window.XMLHttpRequest && !XMLHttpRequest.prototype.open.__tb) {
      var oldOpen = XMLHttpRequest.prototype.open;
      var oldSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (method, url) {
        this.__tbBlocked = shouldBlock(url);
        if (this.__tbBlocked) {
          markBlocked();
          return oldOpen.call(this, method, 'data:text/plain,', true);
        }
        return oldOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function () {
        if (this.__tbBlocked) return oldSend.call(this, null);
        return oldSend.apply(this, arguments);
      };

      XMLHttpRequest.prototype.open.__tb = true;
    }

    if (navigator.sendBeacon && !navigator.sendBeacon.__tb) {
      var oldBeacon = navigator.sendBeacon;
      navigator.sendBeacon = function (url) {
        if (shouldBlock(url)) {
          markBlocked();
          return false;
        }
        return oldBeacon.apply(this, arguments);
      };
      navigator.sendBeacon.__tb = true;
    }
  }

  function cleanUrl() {
    if (!window.URL || !history.replaceState) return;

    try {
      var url = new URL(location.href);
      var changed = false;
      var i;

      for (i = 0; i < trackingParams.length; i += 1) {
        if (url.searchParams.has(trackingParams[i])) {
          url.searchParams.delete(trackingParams[i]);
          changed = true;
        }
      }

      if (changed) {
        state.cleaned += 1;
        history.replaceState(history.state, document.title, url.toString());
      }
    } catch (error) {}
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#tb-bar{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2147483646!important;height:58px!important;display:grid!important;grid-template-columns:auto auto 1fr auto auto!important;gap:8px!important;align-items:center!important;padding:8px 10px!important;background:rgba(7,13,20,.96)!important;color:#fff!important;font:18px Arial,sans-serif!important;box-shadow:0 4px 14px rgba(0,0,0,.42)!important}',
      '#tb-bar button,#tb-bar input{height:40px!important;border:2px solid #34475d!important;border-radius:6px!important;background:#132031!important;color:#fff!important;font:18px Arial,sans-serif!important}',
      '#tb-bar button{min-width:56px!important;padding:0 12px!important}',
      '#tb-bar input{width:100%!important;padding:0 12px!important}',
      '#tb-stats{color:#aec0d1!important;white-space:nowrap!important}',
      '#tb-cursor{position:fixed!important;left:0!important;top:0!important;z-index:2147483647!important;width:34px!important;height:34px!important;pointer-events:none!important;will-change:transform!important;filter:drop-shadow(0 2px 5px rgba(0,0,0,.85))!important}',
      '#tb-cursor svg{display:block!important;width:34px!important;height:34px!important}',
      '#tb-cursor.click{transform:scale(.86)!important}',
      '.tb-hidden{display:none!important;visibility:hidden!important;opacity:0!important}',
      'body{padding-top:58px!important}'
    ].join('\n');

    (document.head || document.documentElement).appendChild(style);
  }

  function normalizeAddress(value) {
    var text = String(value || '').trim();
    if (!text) return 'https://www.google.com/';
    if (/^[a-z]+:\/\//i.test(text)) return text;
    if (text.indexOf('.') !== -1 && text.indexOf(' ') === -1) return 'https://' + text;
    return 'https://www.google.com/search?q=' + encodeURIComponent(text);
  }

  function createBar() {
    if (!document.body || document.getElementById(BAR_ID)) return;

    var bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.innerHTML =
      '<button data-a="back">Back</button>' +
      '<button data-a="home">Home</button>' +
      '<input data-a="url" value="">' +
      '<button data-a="go">Go</button>' +
      '<button data-a="shield">Shield</button>' +
      '<span id="tb-stats"></span>';
    document.body.appendChild(bar);

    bar.querySelector('input').value = location.href;
    bar.addEventListener('click', function (event) {
      runAction(event.target.getAttribute('data-a'));
    }, true);

    updateStats();
  }

  function createCursor() {
    if (!document.body || document.getElementById(CURSOR_ID)) return;

    var node = document.createElement('div');
    node.id = CURSOR_ID;
    node.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 3 L31 23 L19 26 L14 37 L5 3 Z" fill="#fff"/><path d="M9 9 L25 21 L16 23 L13 30 L9 9 Z" fill="#00a8e1"/></svg>';
    document.body.appendChild(node);
    renderCursor();
  }

  function renderCursor() {
    var node = document.getElementById(CURSOR_ID);
    if (!node) return;

    state.x = Math.max(0, Math.min(window.innerWidth - 8, state.x));
    state.y = Math.max(0, Math.min(window.innerHeight - 8, state.y));
    node.style.transform = 'translate3d(' + state.x + 'px,' + state.y + 'px,0)';
  }

  function scheduleCursor() {
    if (state.raf) return;
    state.raf = window.requestAnimationFrame ? window.requestAnimationFrame(function () {
      state.raf = 0;
      renderCursor();
    }) : window.setTimeout(function () {
      state.raf = 0;
      renderCursor();
    }, 16);
  }

  function elementAtCursor() {
    var cursorNode = document.getElementById(CURSOR_ID);
    var oldDisplay;
    var element;

    if (!document.elementFromPoint) return null;

    oldDisplay = cursorNode ? cursorNode.style.display : '';
    if (cursorNode) cursorNode.style.display = 'none';
    element = document.elementFromPoint(state.x + 6, state.y + 6);
    if (cursorNode) cursorNode.style.display = oldDisplay;
    return element;
  }

  function mouseEvent(element, type) {
    var event;
    if (!element) return;

    try {
      event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: state.x + 6,
        clientY: state.y + 6
      });
      element.dispatchEvent(event);
    } catch (error) {
      event = document.createEvent('MouseEvents');
      event.initMouseEvent(type, true, true, window, 1, 0, 0, state.x + 6, state.y + 6, false, false, false, false, 0, null);
      element.dispatchEvent(event);
    }
  }

  function clickCursor() {
    var cursorNode = document.getElementById(CURSOR_ID);
    var element = elementAtCursor();

    if (cursorNode) {
      cursorNode.classList.add('click');
      window.setTimeout(function () { cursorNode.classList.remove('click'); }, 110);
    }

    if (!element) return;

    mouseEvent(element, 'mouseover');
    mouseEvent(element, 'mousemove');
    mouseEvent(element, 'mousedown');
    mouseEvent(element, 'mouseup');
    mouseEvent(element, 'click');
    if (element.click) element.click();
  }

  function runAction(action) {
    var input = document.querySelector('#' + BAR_ID + ' input');

    if (action === 'back') history.back();
    else if (action === 'home') location.href = 'https://www.google.com/';
    else if (action === 'go' || action === 'url') location.href = normalizeAddress(input ? input.value : '');
    else if (action === 'shield') {
      state.enabled = !state.enabled;
      updateStats();
    }
  }

  function keyHandler(event) {
    if (event.keyCode === 37) state.x -= state.step;
    else if (event.keyCode === 38) state.y -= state.step;
    else if (event.keyCode === 39) state.x += state.step;
    else if (event.keyCode === 40) state.y += state.step;
    else if (event.keyCode === 13) clickCursor();
    else if (event.keyCode === 10009) history.back();
    else return;

    scheduleCursor();
    event.preventDefault();
    event.stopPropagation();
  }

  function installKeys() {
    window.addEventListener('keydown', keyHandler, true);
    document.addEventListener('keydown', keyHandler, true);
  }

  function isAdNode(node) {
    var text;
    var src;

    if (!node || node.nodeType !== 1 || node.id === BAR_ID || node.id === CURSOR_ID) return false;

    src = node.src || '';
    if (src && shouldBlock(src)) return true;

    text = [
      node.id || '',
      node.className || '',
      node.getAttribute && node.getAttribute('aria-label') || '',
      node.getAttribute && node.getAttribute('data-testid') || ''
    ].join(' ').toLowerCase();

    return text.indexOf('advert') !== -1 ||
      text.indexOf('ad-banner') !== -1 ||
      text.indexOf('sponsor') !== -1 ||
      text.indexOf('promoted') !== -1 ||
      text.indexOf('taboola') !== -1 ||
      text.indexOf('outbrain') !== -1;
  }

  function hideNode(node) {
    if (!node || !node.classList || node.classList.contains('tb-hidden')) return;
    node.classList.add('tb-hidden');
    state.hidden += 1;
  }

  function scan(root, limit) {
    var nodes;
    var i;
    var max = limit || 80;

    if (!root || !root.querySelectorAll) return;

    if (isAdNode(root)) hideNode(root);
    nodes = root.querySelectorAll(adSelector);

    for (i = 0; i < nodes.length && i < max; i += 1) {
      if (isAdNode(nodes[i])) hideNode(nodes[i]);
    }

    updateStats();
  }

  function processQueue() {
    var count = 0;
    var node;

    state.processing = false;

    while (state.queue.length && count < 20) {
      node = state.queue.shift();
      scan(node, 24);
      count += 1;
    }

    if (state.queue.length) scheduleQueue();
  }

  function scheduleQueue() {
    if (state.processing) return;
    state.processing = true;
    window.setTimeout(processQueue, 80);
  }

  function observe() {
    if (!window.MutationObserver || !document.body) return;

    new MutationObserver(function (mutations) {
      var i;
      var j;

      for (i = 0; i < mutations.length; i += 1) {
        for (j = 0; j < mutations[i].addedNodes.length; j += 1) {
          if (mutations[i].addedNodes[j].nodeType === 1) {
            state.queue.push(mutations[i].addedNodes[j]);
          }
        }
      }

      if (state.queue.length > 200) state.queue = state.queue.slice(-200);
      scheduleQueue();
    }).observe(document.body, { childList: true, subtree: true });
  }

  function updateStats() {
    var node = document.getElementById('tb-stats');
    if (!node) return;
    node.textContent = (state.enabled ? 'Shield on' : 'Shield off') +
      ' | Blocked ' + state.blocked +
      ' | Hidden ' + state.hidden +
      ' | Cleaned ' + state.cleaned;
  }

  function startUi() {
    injectStyle();
    createBar();
    createCursor();
    installKeys();
    scan(document.body, 160);
    observe();
    updateStats();
  }

  patchNetwork();
  cleanUrl();
  window.TizenBrowser = { shouldBlock: shouldBlock, status: function () { return state; } };

  if (document.body) startUi();
  else document.addEventListener('DOMContentLoaded', startUi);

  window.setInterval(cleanUrl, 5000);
}());
