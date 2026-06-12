/* TizenBrowser - lightweight TizenBrew browser helper with built-in blocking. */
(function () {
  'use strict';

  if (window.__tizenBrowserLoaded) return;
  window.__tizenBrowserLoaded = true;

  var BAR_ID = 'tizenbrowser-bar';
  var STYLE_ID = 'tizenbrowser-style';
  var CURSOR_ID = 'tizenbrowser-cursor';
  var state = { enabled: true, blocked: 0, hidden: 0, cleaned: 0, focus: 2, controls: [] };
  var cursor = { x: 0, y: 0, step: 34 };

  var blocked = [
    '2mdn.net', 'adform.net', 'adnxs.com', 'adsafeprotected.com', 'adsrvr.org',
    'advertising.com', 'amazon-adsystem.com', 'analytics.google.com',
    'appsflyer.com', 'bluekai.com', 'chartbeat.com', 'criteo.com',
    'doubleclick.net', 'facebook.com/tr', 'facebook.net', 'flashtalking.com',
    'google-analytics.com', 'googlesyndication.com', 'googletagmanager.com',
    'googletagservices.com', 'hotjar.com', 'imasdk.googleapis.com',
    'moatads.com', 'newrelic.com', 'outbrain.com', 'pubmatic.com',
    'quantserve.com', 'scorecardresearch.com', 'segment.io', 'taboola.com',
    'zedo.com'
  ];

  var blockedPatterns = [
    /(^|[/?&._-])adserver([/?&._-]|$)/i,
    /(^|[/?&._-])advertising([/?&._-]|$)/i,
    /(^|[/?&._-])analytics([/?&._-]|$)/i,
    /(^|[/?&._-])beacon([/?&._-]|$)/i,
    /(^|[/?&._-])pixel([/?&._-]|$)/i,
    /(^|[/?&._-])telemetry([/?&._-]|$)/i,
    /(^|[/?&._-])track([/?&._-]|$)/i,
    /\/ads?\//i,
    /\/pagead\//i,
    /\/prebid/i,
    /\/vmap/i,
    /\/vast/i
  ];

  var trackingParams = [
    'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid', 'msclkid', 'spm',
    'twclid', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source',
    'utm_term'
  ];

  function urlOf(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.url || String(value);
  }

  function shouldBlock(value) {
    var url = urlOf(value).toLowerCase();
    var i;

    if (!state.enabled || !url) return false;

    for (i = 0; i < blocked.length; i += 1) {
      if (url.indexOf(blocked[i]) !== -1) return true;
    }

    for (i = 0; i < blockedPatterns.length; i += 1) {
      if (blockedPatterns[i].test(url)) return true;
    }

    return false;
  }

  function countBlock() {
    state.blocked += 1;
    updateStats();
  }

  function patchFetch() {
    if (!window.fetch || window.fetch.__tizenBrowser) return;
    var original = window.fetch;

    window.fetch = function (input) {
      if (shouldBlock(input)) {
        countBlock();
        return Promise.resolve(new Response('', { status: 204 }));
      }
      return original.apply(this, arguments);
    };

    window.fetch.__tizenBrowser = true;
  }

  function patchXhr() {
    if (!window.XMLHttpRequest || XMLHttpRequest.prototype.open.__tizenBrowser) return;
    var open = XMLHttpRequest.prototype.open;
    var send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__tizenBrowserBlocked = shouldBlock(url);
      if (this.__tizenBrowserBlocked) {
        countBlock();
        return open.call(this, method, 'data:text/plain,', true);
      }
      return open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      if (this.__tizenBrowserBlocked) return send.call(this, null);
      return send.apply(this, arguments);
    };

    XMLHttpRequest.prototype.open.__tizenBrowser = true;
  }

  function patchBeacon() {
    if (!navigator.sendBeacon || navigator.sendBeacon.__tizenBrowser) return;
    var original = navigator.sendBeacon;

    navigator.sendBeacon = function (url) {
      if (shouldBlock(url)) {
        countBlock();
        return false;
      }
      return original.apply(this, arguments);
    };

    navigator.sendBeacon.__tizenBrowser = true;
  }

  function cleanUrl() {
    if (!window.URL || !history.replaceState) return;

    try {
      var next = new URL(location.href);
      var changed = false;
      var i;

      for (i = 0; i < trackingParams.length; i += 1) {
        if (next.searchParams.has(trackingParams[i])) {
          next.searchParams.delete(trackingParams[i]);
          changed = true;
        }
      }

      if (changed) {
        state.cleaned += 1;
        history.replaceState(history.state, document.title, next.toString());
      }
    } catch (error) {}
  }

  function normalizeAddress(value) {
    var text = String(value || '').trim();
    if (!text) return 'https://www.google.com/';
    if (/^[a-z]+:\/\//i.test(text)) return text;
    if (text.indexOf('.') !== -1 && text.indexOf(' ') === -1) return 'https://' + text;
    return 'https://www.google.com/search?q=' + encodeURIComponent(text);
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#tizenbrowser-bar{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2147483647!important;display:grid!important;grid-template-columns:auto auto 1fr auto auto auto!important;gap:8px!important;align-items:center!important;padding:10px 12px!important;background:rgba(8,12,17,.97)!important;color:#fff!important;font:18px Arial,sans-serif!important;box-shadow:0 4px 16px rgba(0,0,0,.45)!important}',
      '#tizenbrowser-bar button,#tizenbrowser-bar input{height:42px!important;border:2px solid #34475d!important;border-radius:6px!important;background:#111820!important;color:#fff!important;font:18px Arial,sans-serif!important}',
      '#tizenbrowser-bar button{min-width:54px!important;padding:0 12px!important}',
      '#tizenbrowser-bar input{width:100%!important;padding:0 14px!important}',
      '#tizenbrowser-bar .focus{border-color:#00a8e1!important;box-shadow:0 0 0 4px rgba(0,168,225,.35)!important}',
      '#tizenbrowser-stats{color:#aeb8c6!important;white-space:nowrap!important}',
      '.tizenbrowser-hidden{display:none!important;visibility:hidden!important;opacity:0!important}',
      '#tizenbrowser-cursor{position:fixed!important;left:50%!important;top:50%!important;z-index:2147483647!important;width:28px!important;height:28px!important;pointer-events:none!important;transform:translate(-4px,-4px)!important;filter:drop-shadow(0 2px 5px rgba(0,0,0,.75))!important}',
      '#tizenbrowser-cursor:before{content:""!important;position:absolute!important;left:0!important;top:0!important;width:0!important;height:0!important;border-left:0 solid transparent!important;border-right:19px solid transparent!important;border-bottom:28px solid #fff!important;transform:rotate(-38deg)!important;transform-origin:4px 4px!important}',
      '#tizenbrowser-cursor:after{content:""!important;position:absolute!important;left:5px!important;top:6px!important;width:0!important;height:0!important;border-left:0 solid transparent!important;border-right:12px solid transparent!important;border-bottom:18px solid #00a8e1!important;transform:rotate(-38deg)!important;transform-origin:4px 4px!important}',
      '#tizenbrowser-cursor.clicking{transform:translate(-4px,-4px) scale(.82)!important}',
      'body{padding-top:64px!important}'
    ].join('\n');
    document.documentElement.appendChild(style);
  }

  function createBar() {
    if (!document.body || document.getElementById(BAR_ID)) return;

    var bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.innerHTML = [
      '<button data-action="back">Back</button>',
      '<button data-action="home">Home</button>',
      '<input data-action="url" value="">',
      '<button data-action="go">Go</button>',
      '<button data-action="shield">Shield</button>',
      '<span id="tizenbrowser-stats"></span>'
    ].join('');

    document.body.appendChild(bar);
    state.controls = Array.prototype.slice.call(bar.querySelectorAll('button,input'));
    bar.querySelector('input').value = location.href;
    bar.onclick = function (event) { runAction(event.target.getAttribute('data-action')); };
    setFocus(2);
    updateStats();
  }

  function createCursor() {
    if (!document.body || document.getElementById(CURSOR_ID)) return;

    var node = document.createElement('div');
    node.id = CURSOR_ID;
    document.body.appendChild(node);

    cursor.x = Math.round(window.innerWidth / 2);
    cursor.y = Math.round(window.innerHeight / 2);
    updateCursor();
  }

  function updateCursor() {
    var node = document.getElementById(CURSOR_ID);
    if (!node) return;

    cursor.x = Math.max(0, Math.min(window.innerWidth - 4, cursor.x));
    cursor.y = Math.max(0, Math.min(window.innerHeight - 4, cursor.y));
    node.style.left = cursor.x + 'px';
    node.style.top = cursor.y + 'px';
  }

  function elementAtCursor() {
    var node = document.getElementById(CURSOR_ID);
    var display;
    var element;

    if (!node || !document.elementFromPoint) return null;

    display = node.style.display;
    node.style.display = 'none';
    element = document.elementFromPoint(cursor.x, cursor.y);
    node.style.display = display;

    return element;
  }

  function dispatchMouse(element, type) {
    var event;

    if (!element) return;

    try {
      event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: cursor.x,
        clientY: cursor.y
      });
      element.dispatchEvent(event);
    } catch (error) {
      event = document.createEvent('MouseEvents');
      event.initMouseEvent(type, true, true, window, 1, 0, 0, cursor.x, cursor.y, false, false, false, false, 0, null);
      element.dispatchEvent(event);
    }
  }

  function clickCursor() {
    var node = document.getElementById(CURSOR_ID);
    var element = elementAtCursor();

    if (node) {
      node.classList.add('clicking');
      window.setTimeout(function () { node.classList.remove('clicking'); }, 120);
    }

    if (!element) return;

    dispatchMouse(element, 'mouseover');
    dispatchMouse(element, 'mousemove');
    dispatchMouse(element, 'mousedown');
    dispatchMouse(element, 'mouseup');
    dispatchMouse(element, 'click');

    if (element.click) element.click();
  }

  function setFocus(index) {
    var i;
    if (!state.controls.length) return;

    state.focus = Math.max(0, Math.min(state.controls.length - 1, index));

    for (i = 0; i < state.controls.length; i += 1) {
      state.controls[i].classList.remove('focus');
    }

    state.controls[state.focus].classList.add('focus');
    state.controls[state.focus].focus();
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

  function installKeys() {
    document.addEventListener('keydown', function (event) {
      if (!state.controls.length) return;

      if (event.keyCode === 37) cursor.x -= cursor.step;
      else if (event.keyCode === 38) cursor.y -= cursor.step;
      else if (event.keyCode === 39) cursor.x += cursor.step;
      else if (event.keyCode === 40) cursor.y += cursor.step;
      else if (event.keyCode === 13) clickCursor();
      else if (event.keyCode === 10009) history.back();
      else return;

      updateCursor();
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  function looksLikeAd(element) {
    if (!element || element.id === BAR_ID || !element.getAttribute) return false;

    var value = [
      element.id || '',
      element.className || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('data-testid') || ''
    ].join(' ').toLowerCase();

    return value.indexOf('advert') !== -1 ||
      value.indexOf('ad-banner') !== -1 ||
      value.indexOf('sponsor') !== -1 ||
      value.indexOf('promoted') !== -1 ||
      value.indexOf('taboola') !== -1 ||
      value.indexOf('outbrain') !== -1;
  }

  function hideAds(root) {
    var scope = root || document.body;
    if (!scope || !scope.querySelectorAll) return;

    var nodes = scope.querySelectorAll('[id],[class],[aria-label],[data-testid],iframe');
    var i;

    for (i = 0; i < nodes.length; i += 1) {
      if (looksLikeAd(nodes[i]) || shouldBlock(nodes[i].src || '')) {
        if (!nodes[i].classList.contains('tizenbrowser-hidden')) state.hidden += 1;
        nodes[i].classList.add('tizenbrowser-hidden');
      }
    }

    updateStats();
  }

  function observe() {
    if (!window.MutationObserver || !document.body) return;

    new MutationObserver(function (mutations) {
      var i;
      var j;
      for (i = 0; i < mutations.length; i += 1) {
        for (j = 0; j < mutations[i].addedNodes.length; j += 1) {
          if (mutations[i].addedNodes[j].nodeType === 1) hideAds(mutations[i].addedNodes[j]);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function updateStats() {
    var node = document.getElementById('tizenbrowser-stats');
    if (!node) return;
    node.textContent = (state.enabled ? 'Shield on' : 'Shield off') +
      ' | Blocked ' + state.blocked +
      ' | Hidden ' + state.hidden +
      ' | Cleaned ' + state.cleaned;
  }

  window.TizenBrowser = {
    status: function () {
      return {
        enabled: state.enabled,
        blocked: state.blocked,
        hidden: state.hidden,
        cleaned: state.cleaned
      };
    },
    setEnabled: function (enabled) {
      state.enabled = !!enabled;
      updateStats();
    },
    shouldBlock: shouldBlock
  };

  function start() {
    patchFetch();
    patchXhr();
    patchBeacon();
    cleanUrl();

    if (document.body) {
      installStyle();
      createBar();
      createCursor();
      hideAds(document.body);
      observe();
      installKeys();
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        installStyle();
        createBar();
        createCursor();
        hideAds(document.body);
        observe();
        installKeys();
      });
    }

    window.setInterval(function () {
      cleanUrl();
      hideAds(document.body);
    }, 2500);
  }

  start();
}());
