(() => {
  'use strict';
  const english = document.documentElement.lang === 'en';
  const webPage = location.protocol === 'http:' || location.protocol === 'https:';
  const playerDocument = document.body?.hasAttribute('data-youtube-player');

  function createPlayer(id, title, localFile = false) {
    const iframe = document.createElement('iframe');
    const url = new URL(localFile
      ? 'http://127.0.0.1:8777/assets/youtube-player.html'
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`);
    url.search = new URLSearchParams(localFile ? { v: id } : {
      autoplay: '0', rel: '0', enablejsapi: '1', playsinline: '1', origin: location.origin
    });
    iframe.src = url.href;
    iframe.title = `${title} — YouTube`;
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    return iframe;
  }

  function mount(container, id, title) {
    if (!/^[\w-]{11}$/.test(id || '')) return;
    const iframe = createPlayer(id, title, !webPage);
    container.replaceChildren(iframe);
    // The native YouTube player owns its Play button; no click interception.
    if (webPage) window.portfolioDebug?.youtube(iframe);
  }

  if (playerDocument) {
    mount(document.body, new URLSearchParams(location.search).get('v'), 'YouTube');
    return;
  }

  document.querySelectorAll('[data-youtube]').forEach(container => {
    const title = (english ? container.dataset.videoTitleEn : container.dataset.videoTitle)
      || document.querySelector('h1')?.textContent || 'YouTube';
    mount(container, container.dataset.youtube, title);
    if (!webPage) {
      const message = document.createElement('p');
      message.className = 'project-video-notice';
      message.textContent = english
        ? 'For local video playback, open the portfolio with Debug/Launch-Debug.cmd.'
        : 'Pour la lecture des vidéos en local, ouvre le portfolio avec Debug/Launch-Debug.cmd.';
      container.after(message);
    }
  });
})();
