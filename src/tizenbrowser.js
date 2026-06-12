/* TizenBrowser - browser helper and built-in blocker for TizenBrew. */
(function () {
  'use strict';

  var MARKER = '__tizenBrowserLoaded';
  var STYLE_ID = 'tizenbrowser-style';
  var BAR_ID = 'tizenbrowser-bar';

  if (window[MARKER]) {
    return;
  }

  window[MARKER] = true;

  var state = {
    blocked: 0,
    hidden: 0,
    cleaned: 0,
    enabled: true,
    focusedIndex: 0,
    controls: []
  };

  var blockedHosts = [
    '2mdn.net',
    'adform.net',
    'adnxs.com',
    'adsafeprotected.com',
    'adsrvr.org',
    'advertising.com',
    'amazon-adsystem.com',
    'analytics.google.com',
    'appsflyer.com',
    'bluekai.com',
    'chartbeat.com',
    'criteo.com',
    'doubleclick.net',
    'facebook.com/tr',
    'facebook.net',
    'flashtalking.com',
    'googlesyndication.com',
    'googletagmanager.com',
    'googletagservices.com',
    'google-analytics.com',
    'hotjar.com',
    'imasdk.googleapis.com',
    'moatads.com',
    'newrelic.com',
    'outbrain.com',
    'pubmatic.com',
    'quantserve.com',
    'scorecardresearch.com',
    'segment.io',
    'taboola.com',
    'tracking',
    'zedo.com'
  ];

  var blockedPathPatterns = [
    /(^|[/?&._-])adserver([/?&._-]|$)/i,
    /(^|[/?&._-])advertising([/?&._-]|$)/i,
    /(^|[/?&._-])analytics([/?&._-]|$)/i,
    /(^|[/?&._-])banner([/?&._-]|$)/i,
    /(^|[/?&._-])beacon([/?&._-]|$)/i,
    /(^|[/?&._-])pixel([/?&._-]|$)/i,
    /(^|[/?&._-])sponsor([/?&._-]|$)/i,
    /(^|[/?&._-])telemetry([/?&._-]|$)/i,
    /(^|[/?&._-])track([/?&._-]|$)/i,
    /\/ads?\//i,
    /\/adsdk\//i,
    /\/pagead\//i,
    /\/prebid/i,
    /\/vpaid/i,
    /\/vmap/i,
    /\/vast/i
  ];

  var removableParams = [
    'fbclid',
    'gclid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'msclkid',
    'oly_anon_id',
    'oly_enc_id',
    'pk_campaign',
    'pk_kwd',
    'spm',
    'twclid',
    'utm_campaign',
    'utm_content',
    'utm_medium',
    'utm_source',
    'utm_term'
  ];

  function toUrl(input) {
    if (!input) {
      return '';
    }

    if (typeof input === 'string') {
      return input;
    }

    if (input.url) {
      return input.url;
    }

    return String(input);
  }

  function normalizeUrl(value) {
    var text = String(value || '').trim();

    if (!text) {
      return 'https://www.google.com/';
    }

    if (/^[a-z]+:\/\//i.test(text)) {
      return text;
    }

    if (text.indexOf('.') !== -1 && text.indexOf(' ') === -1) {
      return 'https://' + text;
    }

    return 'https://www.google.com/search?q=' + encodeURIComponent(text);
  }

  function shouldBlock(url) {
    var lower = String(url || '').toLowerCase();

    if (!state.enabled || !lower || lower.indexOf('tizenbrowser') !== -1) {
      return false;
    }

    for (var i = 0; i < blockedHosts.length; i += 1) {
      if (lower.indexOf(blockedHosts[i]) !== -1) {
        return true;
      }
    }

    for (var j = 0; j < blockedPathPatterns.length; j += 1) {
      if (blockedPathPatterns[j].test(lower)) {
        return true;
      }
    }

    return false;
  }

  function emptyResponse() {
    if (window.Response) {
      return new Response('', {
        status: 204,
        statusText: 'TizenBrowser blocked'
      });
    }

    return '';
  }

  function block(url) {
    state.blocked += 1;
    updateStats();
    return url;
  }

  function patchFetch() {
    if (!window.fetch || window.fetch.__tizenBrowserPatched) {
      return;
    }

    var originalFetch = window.fetch;

    window.fetch = function (input) {
      var url = toUrl(input);

      if (shouldBlock(url)) {
        block(url);
        return Promise.resolve(emptyResponse());
      }

      return originalFetch.apply(this, arguments);
    };

    window.fetch.__tizenBrowserPatched = true;
  }

  function patchXhr() {
    if (!window.XMLHttpRequest || XMLHttpRequest.prototype.open.__tizenBrowserPatched) {
      return;
    }

    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__tizenBrowserUrl = toUrl(url);
      this.__tizenBrowserBlocked = shouldBlock(this.__tizenBrowserUrl);

      if (this.__tizenBrowserBlocked) {
        block(this.__tizenBrowserUrl);
        return originalOpen.call(this, method, 'data:text/plain,', true);
      }

      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      if (this.__tizenBrowserBlocked) {
        return originalSend.call(this, null);
      }

      return originalSend.apply(this, arguments);
    };

    XMLHttpRequest.prototype.open.__tizenBrowserPatched = true;
  }

  function patchBeacon() {
    if (!navigator.sendBeacon || navigator.sendBeacon.__tizenBrowserPatched) {
      return;
    }

    var originalSendBeacon = navigator.sendBeacon;

    navigator.sendBeacon = function (url) {
      if (shouldBlock(toUrl(url))) {
        block(url);
        return false;
      }

      return originalSendBeacon.apply(this, arguments);
    };

    navigator.sendBeacon.__tizenBrowserPatched = true;
  }

  function patchElementUrls() {
    var tags = [
      ['HTMLImageElement', 'src'],
      ['HTMLScriptElement', 'src'],
      ['HTMLIFrameElement', 'src']
    ];

    for (var i = 0; i < tags.length; i += 1) {
      var ctor = window[tags[i][0]];
      var prop = tags[i][1];

      if (!ctor || !ctor.prototype) {
        continue;
      }

      var descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, prop);

      if (!descriptor || !descriptor.set || descriptor.set.__tizenBrowserPatched) {
        continue;
      }

      (function (setter, getter, property) {
        var patched = function (value) {
          if (shouldBlock(value)) {
            block(value);
            return;
          }

          return setter.call(this, value);
        };

        patched.__tizenBrowserPatched = true;

        Object.defineProperty(ctor.prototype, property, {
          get: getter,
          set: patched
        });
      }(descriptor.set, descriptor.get, prop));
    }
  }

  function cleanTrackingParams() {
    if (!window.URL || !history.replaceState) {
      return;
    }

    try {
      var url = new URL(location.href);
      var changed = false;

      for (var i = 0; i < removableParams.length; i += 1) {
        if (url.searchParams.has(removableParams[i])) {
          url.searchParams.delete(removableParams[i]);
          changed = true;
        }
      }

      if (changed) {
        state.cleaned += 1;
        history.replaceState(history.state, document.title, url.toString());
      }
    } catch (error) {
      return;
    }
  }

  function installPrivacyHints() {
    try {
      Object.defineProperty(navigator, 'doNotTrack', {
        configurable: true,
        get: function () {
          return '1';
        }
      });
    } catch (error) {
      return;
    }
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#tizenbrowser-bar {',
      '  position: fixed !important;',
      '  top: 0 !important;',
      '  left: 0 !important;',
      '  right: 0 !important;',
      '  z-index: 2147483647 !important;',
      '  display: grid !important;',
      '  grid-template-columns: auto auto 1fr auto auto !important;',
      '  gap: 8px !important;',
      '  align-items: center !important;',
      '  padding: 10px 12px !important;',
      '  background: rgba(8, 12, 17, 0.96) !important;',
      '  color: #fff !important;',
      '  font: 18px Arial, sans-serif !important;',
      '  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45) !important;',
      '}',
      '#tizenbrowser-bar button, #tizenbrowser-bar input {',
      '  height: 42px !important;',
      '  border: 2px solid #34475d !important;',
      '  border-radius: 6px !important;',
      '  background: #111820 !important;',
      '  color: #fff !important;',
      '  font: 18px Arial, sans-serif !important;',
      '}',
      '#tizenbrowser-bar button {',
      '  min-width: 54px !important;',
      '  padding: 0 12px !important;',
      '}',
      '#tizenbrowser-bar input {',
      '  width: 100% !important;',
      '  padding: 0 14px !important;',
      '}',
      '#tizenbrowser-bar .tizenbrowser-focus {',
      '  border-color: #00a8e1 !important;',
      '  box-shadow: 0 0 0 4px rgba(0, 168, 225, 0.35) !important;',
      '}',
      '#tizenbrowser-stats {',
      '  color: #aeb8c6 !important;',
      '  white-space: nowrap !important;',
      '}',
      '.tizenbrowser-hidden {',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  opacity: 0 !important;',
      '}',
      'body {',
      '  padding-top: 64px !important;',
      '}'
    ].join('\n');

    document.documentElement.appendChild(style);
  }

  function createBar() {
    if (document.getElementById(BAR_ID) || !document.body) {
      return;
    }

    var bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.innerHTML = [
      '<button type="button" data-browser-action="back">Back</button>',
      '<button type="button" data-browser-action="home">Home</button>',
      '<input type="text" data-browser-action="url" value="">',
      '<button type="button" data-browser-action="go">Go</button>',
      '<button type="button" data-browser-action="shield">Shield</button>',
      '<span id="tizenbrowser-stats"></span>'
    ].join('');

    document.body.appendChild(bar);
    state.controls = Array.prototype.slice.call(bar.querySelectorAll('button,input'));
    bar.querySelector('input').value = location.href;

    bar.addEventListener('click', function (event) {
      runAction(event.target.getAttribute('data-browser-action'));
    });

    setFocus(2);
    updateStats();
  }

  function setFocus(index) {
    var controls = state.controls;

    if (!controls.length) {
      return;
    }

    state.focusedIndex = Math.max(0, Math.min(controls.length - 1, index));

    for (var i = 0; i < controls.length; i += 1) {
      controls[i].classList.remove('tizenbrowser-focus');
    }

    controls[state.focusedIndex].classList.add('tizenbrowser-focus');
    controls[state.focusedIndex].focus();
  }

  function runAction(action) {
    var input = document.querySelector('#' + BAR_ID + ' input');

    if (action === 'back') {
      history.back();
    } else if (action === 'home') {
      location.href = 'https://www.google.com/';
    } else if (action === 'go' || action === 'url') {
      location.href = normalizeUrl(input ? input.value : '');
    } else if (action === 'shield') {
      state.enabled = !state.enabled;
      updateStats();
    }
  }

  function installRemoteKeys() {
    document.addEventListener('keydown', function (event) {
      if (!state.controls.length) {
        return;
      }

      if (event.keyCode === 37) {
        setFocus(state.focusedIndex - 1);
      } else if (event.keyCode === 39) {
        setFocus(state.focusedIndex + 1);
      } else if (event.keyCode === 13) {
        runAction(state.controls[state.focusedIndex].getAttribute('data-browser-action'));
      } else if (event.keyCode === 10009) {
        history.back();
      } else {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  function looksLikeAdElement(element) {
    if (!element || element.id === BAR_ID || !element.getAttribute) {
      return false;
    }

    var value = [
      element.id || '',
      element.className || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('data-testid') || ''
    ].join(' ').toLowerCase();

    return value.indexOf('advert') !== -1 ||
      value.indexOf('ad-banner') !== -1 ||
      value.indexOf('ad_container') !== -1 ||
      value.indexOf('sponsor') !== -1 ||
      value.indexOf('promoted') !== -1 ||
      value.indexOf('taboola') !== -1 ||
      value.indexOf('outbrain') !== -1;
  }

  function hideAds(root) {
    var scope = root || document.body;

    if (!scope || !scope.querySelectorAll) {
      return;
    }

    var nodes = scope.querySelectorAll('[id], [class], [aria-label], [data-testid], iframe');

    for (var i = 0; i < nodes.length; i += 1) {
      var src = nodes[i].src || '';

      if (looksLikeAdElement(nodes[i]) || shouldBlock(src)) {
        nodes[i].classList.add('tizenbrowser-hidden');
        state.hidden += 1;
      }
    }

    updateStats();
  }

  function observeDom() {
    if (!window.MutationObserver || !document.body) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        for (var j = 0; j < mutations[i].addedNodes.length; j += 1) {
          if (mutations[i].addedNodes[j].nodeType === 1) {
            hideAds(mutations[i].addedNodes[j]);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function updateStats() {
    var node = document.getElementById('tizenbrowser-stats');

    if (!node) {
      return;
    }

    node.textContent = [
      state.enabled ? 'Shield on' : 'Shield off',
      'Blocked ' + state.blocked,
      'Hidden ' + state.hidden,
      'Cleaned ' + state.cleaned
    ].join(' | ');
  }

  function exposeApi() {
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
  }

  function start() {
    patchFetch();
    patchXhr();
    patchBeacon();
    patchElementUrls();
    installPrivacyHints();
    cleanTrackingParams();
    exposeApi();

    if (document.body) {
      installStyle();
      createBar();
      hideAds(document.body);
      observeDom();
      installRemoteKeys();
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        installStyle();
        createBar();
        hideAds(document.body);
        observeDom();
        installRemoteKeys();
      });
    }

    window.setInterval(function () {
      cleanTrackingParams();
      hideAds(document.body);
    }, 2500);
  }

  start();
}());
