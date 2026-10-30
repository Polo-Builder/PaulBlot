(() => {
  'use strict';
  // Local diagnostics only: published pages never contact a local service.
  const local = location.protocol === 'file:' ||
    (location.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
  if (!local) return;
  const endpoint = location.protocol === 'file:' ? 'http://127.0.0.1:8777' : location.origin;
  const session = 'page-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
  let config = { enabled: false }, initialised = false, count = 0;
  const early = [];
  const players = new WeakSet();
  const context = () => ({
    url: location.href, protocol: location.protocol, origin: location.origin,
    referrer: document.referrer, referrerPolicy: document.referrerPolicy,
    framed: window !== window.top, online: navigator.onLine,
    language: document.documentElement.lang, userAgent: navigator.userAgent
  });
  const post = (event, details) => {
    if (!config.enabled || ++count > 1500) return;
    fetch(endpoint + '/api/debug/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, event, details }), keepalive: true
    }).catch(() => {});
  };
  function record(event, details = {}) {
    if (!initialised) {
      if (early.length < 40) early.push([event, details]);
      return;
    }
    post(event, details);
  }
  let apiPromise;
  function youtubeAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timeout = setTimeout(() => reject(Error('YouTube API timed out')), 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        try { previous?.(); } finally { resolve(window.YT); }
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { clearTimeout(timeout); reject(Error('YouTube API failed to load')); };
      document.head.append(script);
    });
    return apiPromise;
  }
  async function youtube(iframe) {
    if (!initialised) await ready;
    if (!config.enabled || players.has(iframe)) return;
    players.add(iframe);
    record('youtube.created', { ...context(), src: iframe.src, allow: iframe.allow, referrerPolicy: iframe.referrerPolicy });
    iframe.addEventListener('load', () => record('youtube.iframe_loaded', { src: iframe.src }));
    let responded = false;
    setTimeout(() => {
      if (!responded && iframe.isConnected) record('youtube.no_player_response', { waitedMs: 20000, ...context() });
    }, 20000);
    try {
      const YT = await youtubeAPI();
      if (!iframe.isConnected) return;
      new YT.Player(iframe, { events: {
        onReady: () => { responded = true; record('youtube.ready'); },
        onStateChange: event => { responded = true; record('youtube.state', { state: event.data }); },
        onAutoplayBlocked: () => record('youtube.autoplay_blocked'),
        onError: event => {
          responded = true;
          const reasons = { 2: 'Invalid parameter', 5: 'HTML5 playback error', 100: 'Video missing or private', 101: 'Embedding disabled', 150: 'Embedding disabled', 153: 'Missing HTTP Referer or API client identification' };
          record('youtube.error', { code: event.data, reason: reasons[event.data] || 'Unknown', ...context() });
        }
      } });
    } catch (error) { record('youtube.api_error', { message: error.message }); }
  }
  async function refresh() {
    try {
      const response = await fetch(endpoint + '/api/debug/config', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw Error('Debug collector unavailable');
      const next = await response.json();
      const starting = next.enabled === true && !config.enabled;
      config = next;
      initialised = true;
      if (starting) {
        post('page.start', context());
        early.splice(0).forEach(([event, details]) => post(event, details));
        document.querySelectorAll('[data-youtube] iframe').forEach(youtube);
      } else early.length = 0;
    } catch {
      config = { enabled: false };
      initialised = true;
      early.length = 0;
    }
  }
  window.portfolioDebug = { record, youtube };
  const ready = refresh();
  setInterval(refresh, 5000);
  addEventListener('error', event => record('page.error', {
    message: event.message || 'Resource failed to load',
    file: event.filename || event.target?.src || event.target?.href,
    line: event.lineno, stack: event.error?.stack
  }), true);
  addEventListener('unhandledrejection', event => record('page.unhandledrejection', { message: String(event.reason), stack: event.reason?.stack }));
  addEventListener('DOMContentLoaded', () => record('page.dom_ready', { title: document.title }));
  addEventListener('pagehide', () => record('page.closed'));
})();
