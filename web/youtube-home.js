/* Minimal native-app launcher. ES5 for Tizen 3; no feeds, network requests or refresh timers. */
var YouTubeHome = (function () {
  'use strict';
  function text(value) { return I18N.tr(value, value); }
  function start() {
    I18N.set(Prefs.language());
    var appId = Prefs.youtubeApp(), pending = false;
    if (typeof appId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(appId)) appId = '';
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#101014;color:#fff;overflow:hidden;font-family:Sarabun,sans-serif';
    var main = document.createElement('main'); main.id = 'youtube-home';
    main.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;text-align:center';
    var button = document.createElement('button'); button.type = 'button';
    button.setAttribute('aria-label', 'YouTube');
    button.style.cssText = 'position:absolute;left:50%;top:42%;width:360px;height:210px;margin-left:-180px;margin-top:-105px;background:#202024;border:3px solid #fff;border-radius:18px;outline:none;cursor:pointer';
    var icon = document.createElement('img'); icon.src = 'icons/youtube.png'; icon.alt = 'YouTube';
    icon.style.cssText = 'width:280px;height:158px;object-fit:contain'; button.appendChild(icon);
    var status = document.createElement('p'); status.id = 'youtube-status';
    status.style.cssText = 'position:absolute;top:60%;left:5%;width:90%;font-size:24px;margin:0';
    var help = document.createElement('p');
    help.textContent = text('Blue button: full home screen');
    help.style.cssText = 'position:absolute;bottom:30px;left:5%;width:90%;font-size:18px;color:#aaa;margin:0';
    main.appendChild(button); main.appendChild(status); main.appendChild(help); document.body.appendChild(main);
    function ready() { pending = false; status.textContent = text(appId ? 'Press OK to open YouTube' : 'YouTube is not installed on this TV.'); }
    function open() {
      if (pending || !appId) return;
      pending = true; status.textContent = text('Opening YouTube…');
      TV.launch(appId, null, function (ok) {
        pending = false;
        status.textContent = text(ok ? 'Press OK to open YouTube' : 'Could not open YouTube.');
      });
    }
    button.onclick = open;
    document.addEventListener('keydown', function (event) {
      var key = event.keyCode;
      if (key === TV.keys.ok) { event.preventDefault(); open(); }
      else if (key === TV.keys.back) { event.preventDefault(); TV.back(); }
      else if (key === 406) { event.preventDefault(); Prefs.set('youtubeOnly', false); window.location.reload(); }
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { ready(); button.focus(); } });
    if (appId) ready();
    else {
      status.textContent = text('Finding YouTube…');
      TV.apps(function (apps) {
        for (var i = 0; i < apps.length; i++) if (/^YouTube$/i.test(apps[i].title || '') || /TizenYouTube$|youtube\.leanback\.v4$/i.test(apps[i].id || '')) {
          appId = apps[i].id; Prefs.set('youtubeApp', appId); break;
        }
        ready();
      });
    }
    button.focus();
  }
  return {start: start};
})();
