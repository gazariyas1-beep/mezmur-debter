(() => {
'use strict';

/* ---------- store-app hooks (inactive in the browser) ---------- */
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const LN = isNative && Cap.Plugins && Cap.Plugins.LocalNotifications;
const REMOTE = 'https://mezmurdebterapp.gazariyas1.workers.dev/';   // the live site; the store apps read the daily video list from here

/* ---------- new-hymn alerts (OneSignal) ---------- */
const OS_ID = (window.APP_CONFIG && window.APP_CONFIG.oneSignalAppId) || '';
const nativeOS = isNative && window.plugins && window.plugins.OneSignal;     // the store apps use OneSignal's plugin
window.OneSignalDeferred = window.OneSignalDeferred || [];
const pushAvailable = !!OS_ID && (isNative ? !!nativeOS : true);
if (OS_ID && !isNative) {
  const sc = document.createElement('script'); sc.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; sc.defer = true; document.head.append(sc);
  window.OneSignalDeferred.push(async OneSignal => {
    await OneSignal.init({ appId: OS_ID, serviceWorkerPath: new URL('sw.js', location.href).pathname, serviceWorkerParam: { scope: new URL('./', location.href).pathname } });
  });
} else if (OS_ID && nativeOS) { try { nativeOS.initialize(OS_ID); } catch (e) {} }
const push = {
  web() { return new Promise(res => window.OneSignalDeferred.push(os => res(os))); },
  async isOn() {
    try {
      if (nativeOS) return !!(await nativeOS.User.pushSubscription.getOptInAsync());
      const os = await this.web(); return !!os.User.PushSubscription.optedIn;
    } catch (e) { return false; }
  },
  async turnOn() {
    try {
      if (nativeOS) { await nativeOS.Notifications.requestPermission(true); return this.isOn(); }
      const os = await this.web(); await os.Notifications.requestPermission(); await os.User.PushSubscription.optIn(); return !!os.User.PushSubscription.optedIn;
    } catch (e) { return false; }
  },
  async turnOff() {
    try { if (nativeOS) await nativeOS.User.pushSubscription.optOut(); else (await this.web()).User.PushSubscription.optOut(); } catch (e) {}
  }
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const ICON = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  hymns: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  saints: '<path d="M12 2.6v18.8M10.1 5.1h3.8M6.6 8.7h10.8M9 16.4l6 2.4"/>',
  saved: '<path d="M12 20s-7-4.6-9-9.2C1.8 7.4 3.8 4 7.2 4c2 0 3.4 1 4.8 2.8C13.4 5 14.8 4 16.8 4 20.2 4 22.2 7.4 21 10.8 19 15.4 12 20 12 20z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>'
};
const svg = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
let toastTimer;
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); };

/* ---------- data ---------- */
let byId = {}, SAINT_LIST = [];
function prep(s) {
  const p = s.t.split('||').map(x => x.trim()).filter(Boolean);
  s.main = p[0] || ('Hymn ' + s.id.replace(/\D/g, ''));
  s.sub = p.slice(1).join(' · ');
  s.q = s.t.toLowerCase();
  s.topics = Object.keys(TOPICS).filter(k => TOPICS[k][1].test(s.t));
}
const saintCount = k => SONGS.filter(s => s.topics.includes(k)).length;
function rebuild() {
  SONGS.forEach(prep);
  byId = Object.fromEntries(SONGS.map(s => [s.id, s]));
  SAINT_LIST = SAINTS.filter(([k]) => TOPICS[k] && saintCount(k) > 0);
}
rebuild();
const thumb = s => 'https://i.ytimg.com/vi/' + encodeURIComponent(s.v) + '/mqdefault.jpg';
const art = s => s.b ? 'b/' + s.id + '.jpg' : thumb(s);

/* ---------- saved + recent ---------- */
let favs = new Set(store.get('favs', []));
let recent = store.get('recent', []);
const saveFavs = () => store.set('favs', [...favs]);
function setFav(b) {
  const id = b.dataset.id, on = favs.has(id), s = byId[id];
  b.setAttribute('aria-pressed', on);
  b.setAttribute('aria-label', (on ? 'Remove from saved: ' : 'Save: ') + s.main);
  b.innerHTML = svg('saved', on ? 'on' : '') + (b.dataset.text ? `<span>${on ? 'Saved' : 'Save'}</span>` : '');
}
function favBtn(id, text, cls) {
  const b = el('button', cls || 'fav'); b.type = 'button'; b.dataset.id = id; if (text) b.dataset.text = '1'; setFav(b); return b;
}
function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  saveFavs();
  document.querySelectorAll('.fav[data-id="' + id + '"]').forEach(setFav);
  if (route.name === 'saved') views.saved($('#view'));
  toast(favs.has(id) ? 'Saved' : 'Removed from saved');
}

/* ---------- pieces ---------- */
function img(src, fallbackHide, eager) {
  const i = el('img'); i.src = src; i.alt = ''; i.loading = eager ? 'eager' : 'lazy'; i.decoding = 'async';
  if (fallbackHide) i.onerror = () => { i.style.visibility = 'hidden'; };
  return i;
}
// YouTube cover at the best quality it has: full-size first, then the standard one
function ytImg(s, big, eager) {
  const i = el('img'); i.alt = ''; i.loading = eager ? 'eager' : 'lazy'; i.decoding = 'async';
  const urls = [];
  if (big && s.id[0] === 'v') urls.push((isNative ? REMOTE : '') + 'b/' + s.v + '.jpg');            // our own saved copy, if the daily update made one
  (big ? ['maxresdefault', 'sddefault', 'hqdefault'] : ['hqdefault']).forEach(n => urls.push('https://i.ytimg.com/vi/' + encodeURIComponent(s.v) + '/' + n + '.jpg'));
  let k = 0;
  const load = () => { i.src = urls[k]; };
  i.onerror = () => { if (++k < urls.length) load(); else i.style.visibility = 'hidden'; };
  i.onload = () => { if (i.naturalWidth < 200 && k + 1 < urls.length) { k++; load(); } };   // YouTube's tiny "no picture" placeholder
  load(); return i;
}
function thumbBox(s, big, eager) {
  const w = el('span', 'thumb'); w.append(s.b ? img(art(s), true, eager) : ytImg(s, big, eager));
  if (s.d) w.append(el('em', 'dur', s.d));
  return w;
}
function row(s) {
  const r = el('div', 'row'), a = el('a', 'rl'); a.href = '#/play/' + s.id;
  const t = el('span', 'rt'); t.append(el('b', '', s.main)); if (s.sub) t.append(el('small', '', s.sub)); if (s.c) t.append(el('i', 'tag', 'Collection'));
  a.append(thumbBox(s), t); r.append(a, favBtn(s.id)); return r;
}
function card(s, eager) {
  const a = el('a', 'card'); a.href = '#/play/' + s.id;
  a.append(thumbBox(s, true, eager), el('b', '', s.main)); if (s.sub) a.append(el('small', '', s.sub)); return a;
}
function listInto(box, songs, emptyText) {
  box._ids = songs.map(s => s.id); box.classList.add('ctxlist'); box.replaceChildren();
  if (!songs.length) { box.append(el('p', 'empty', emptyText)); return; }
  const f = document.createDocumentFragment(); songs.forEach(s => f.append(row(s))); box.append(f);
}
function scroller(songs) {
  const b = el('div', 'scroller ctxlist'); b._ids = songs.map(s => s.id); songs.forEach((s, i) => b.append(card(s, i < 4))); return b;
}
function section(title, node, moreHref, moreText) {
  const h = el('h2', 'sec'); h.append(el('span', '', title));
  if (moreHref) { const a = el('a', '', moreText || 'See all'); a.href = moreHref; h.append(a); }
  const f = document.createDocumentFragment(); f.append(h, node); return f;
}
function empty(icon, text) {
  const d = el('div', 'empty'); d.innerHTML = svg(icon); d.append(el('p', '', text)); return d;
}

/* ---------- install ---------- */
const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInApp = /FBAN|FBAV|Instagram|TikTok|Snapchat|Line\/|Telegram|Twitter|LinkedInApp|MicroMessenger|; wv\)/i.test(ua);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; fillSlots(); });
addEventListener('appinstalled', () => { deferred = null; fillSlots(); toast('Installed'); });
function installCard(force) {
  if (standalone) return null;
  if (!force && store.get('installDismissed', false)) return null;
  let msg, action;
  if (deferred) { msg = 'Install Mezmur Debter on your phone for quick access.'; action = 'Install'; }
  else if (isInApp) { msg = isIOS ? 'To install, open this page in Safari, then tap Share and Add to Home Screen.' : 'To install, open this page in Chrome, then tap Install app.'; }
  else if (isIOS) { msg = 'To install, tap the Share button, then Add to Home Screen.'; }
  else return null;
  const c = el('div', 'install'); c.append(el('p', '', msg));
  if (action) { const b = el('button', 'go', action); b.type = 'button'; b.onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; fillSlots(); }; c.append(b); }
  if (!force) { const x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.onclick = () => { store.set('installDismissed', true); fillSlots(); }; c.append(x); }
  return c;
}
function slot(force) { const s = el('div', 'install-slot'); s.dataset.force = force ? '1' : ''; fill(s); return s; }
function fill(s) { s.replaceChildren(); const c = installCard(!!s.dataset.force); if (c) s.append(c); }
function fillSlots() { document.querySelectorAll('.install-slot').forEach(fill); }

/* ---------- theme ---------- */
function applyTheme() {
  const m = store.get('theme', 'system'), r = document.documentElement;
  m === 'system' ? r.removeAttribute('data-theme') : (r.dataset.theme = m);
  const dark = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').content = dark ? '#070B1D' : '#1B2644';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------- screens ---------- */
const views = {};
let ctx = null, syncing = true;
function hymnOfDay(d = new Date()) {
  const pool = SONGS.filter(s => LYRICS[s.id] && !s.c);
  if (!pool.length) return null;
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return pool[((day % pool.length) + pool.length) % pool.length];
}
let hq = '', hf = 'all';

views.home = v => {
  const verse = el('div', 'verse'); verse.append(el('p', '', 'ይህችን መዝሙር ለእናንተ ጻፉ'), el('small', '', 'Deuteronomy 31:19'));
  v.append(verse, slot(false));
  const hd = hymnOfDay();
  if (hd) { const box = el('div', 'list ctxlist'); box._ids = [hd.id]; box.append(row(hd)); v.append(section('Hymn of the day', box)); }
  v.append(section('New hymns', scroller(SONGS.slice(0, 10)), '#/hymns'));
  const av = el('div', 'scroller');
  SAINT_LIST.forEach(([k, label]) => {
    const a = el('a', 'av'); a.href = '#/saint/' + k; a.append(img('s/' + k + '.jpg', false, true), el('span', '', label), el('small', '', saintCount(k) + ' hymn' + (saintCount(k) === 1 ? '' : 's'))); av.append(a);
  });
  v.append(section('Browse by saint and feast', av, '#/saints'));
  const rec = recent.slice(0, 10).map(id => byId[id]).filter(Boolean);
  if (rec.length) v.append(section('Recently played', scroller(rec)));
  const cols = SONGS.filter(s => s.c).slice(0, 10);
  if (cols.length) v.append(section('Collections', scroller(cols), '#/hymns'));
  const all = el('a', 'btn', 'See all ' + SONGS.length + ' hymns'); all.href = '#/hymns'; all.style.marginTop = '18px'; v.append(all);
};

views.hymns = v => {
  const tools = el('div', 'tools');
  const q = el('input', 'search'); q.type = 'search'; q.placeholder = 'Search hymns'; q.value = hq; q.setAttribute('aria-label', 'Search hymns'); q.enterKeyHint = 'search'; q.autocomplete = 'off';
  const chips = el('div', 'chips');
  [['all', 'All'], ['lyr', 'With lyrics'], ['col', 'Collections'], ['one', 'Single hymns']].forEach(([k, label]) => {
    const b = el('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', hf === k);
    b.onclick = () => { hf = k; chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); };
    chips.append(b);
  });
  tools.append(q, chips);
  const count = el('p', 'count'), list = el('div', 'list');
  v.append(tools, count, list);
  function draw() {
    const term = hq.trim().toLowerCase();
    const hits = SONGS.filter(s => (hf === 'all' || (hf === 'col' && s.c) || (hf === 'one' && !s.c) || (hf === 'lyr' && LYRICS[s.id])) && s.q.includes(term));
    count.textContent = hits.length + ' hymn' + (hits.length === 1 ? '' : 's');
    listInto(list, hits, 'No hymns match that search. Try a different word.');
  }
  q.oninput = () => { hq = q.value; draw(); };
  draw();
};

views.saints = v => {
  const p = el('p', 'muted', 'Tap a painting to see every hymn for it.'); p.style.marginTop = '0';
  const g = el('div', 'tiles');
  SAINT_LIST.forEach(([k, label]) => {
    const a = el('a', 'tile'); a.href = '#/saint/' + k;
    const n = saintCount(k);
    a.append(img('s/' + k + '.jpg'), el('span', '', label), el('small', '', n + ' hymn' + (n === 1 ? '' : 's'))); g.append(a);
  });
  v.append(p, g);
};

views.saint = v => {
  const k = route.arg, entry = SAINT_LIST.find(x => x[0] === k);
  if (!entry) { v.append(empty('saints', 'That topic was not found.')); return; }
  const hits = SONGS.filter(s => s.topics.includes(k));
  const h = el('div', 'shead'); const box = el('div');
  box.append(el('h2', '', entry[1]), el('p', 'muted', hits.length + ' hymn' + (hits.length === 1 ? '' : 's')));
  h.append(img('s/' + k + '.jpg'), box);
  const list = el('div', 'list'); v.append(h, list); listInto(list, hits, 'No hymns yet.');
};

views.saved = v => {
  v.replaceChildren();
  const ids = [...favs].reverse().map(id => byId[id]).filter(Boolean);
  if (!ids.length) { v.append(empty('saved', 'Tap the heart on any hymn to save it here.')); return; }
  v.append(el('p', 'count', ids.length + ' saved'));
  const list = el('div', 'list'); v.append(list); listInto(list, ids, '');
};

views.more = v => {
  const mode = store.get('theme', 'system');
  const g1 = el('div', 'group'); g1.append(el('h3', '', 'Appearance'));
  const seg = el('div', 'seg');
  [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].forEach(([k, label]) => {
    const b = el('button', '', label); b.type = 'button'; b.setAttribute('aria-pressed', mode === k);
    b.onclick = () => { store.set('theme', k); applyTheme(); seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
    seg.append(b);
  });
  g1.append(seg);
  v.append(g1, slot(true));
  const g2 = el('div', 'group'); g2.append(el('h3', '', 'About'), el('p', '', 'Mezmur Debter Tewahedo shares Ethiopian and Eritrean Orthodox Tewahedo hymns. Every hymn here plays its video inside the app, and the words are written out so you can sing along.'));
  const g4 = el('div', 'group'); g4.append(el('h3', '', 'Share the app'), el('p', '', 'Send the app to family and friends.'));
  const sb = el('button', 'btn'); sb.type = 'button'; sb.innerHTML = svg('share') + '<span>Share the app</span>';
  sb.onclick = () => sendShare({ title: 'Mezmur Debter Tewahedo', text: 'Hymns with lyrics · Mezmur Debter Tewahedo', url: appUrl() }); g4.append(sb);
  v.append(g2, g4);
  const g3 = el('div', 'group'); g3.append(el('h3', '', 'Contact'), el('p', '', 'Questions or corrections to a hymn’s words? Send a message through the YouTube channel.'));
  const a = el('a', 'link', 'Open the YouTube channel'); a.href = 'https://www.youtube.com/@mezmurdebterzetewahedo'; a.target = '_blank'; a.rel = 'noopener'; g3.append(a);
  if (LN) {
    const cfg = store.get('remind', { on: false, time: '08:00' });
    const g5 = el('div', 'group'); g5.append(el('h3', '', 'Daily hymn reminder'), el('p', '', 'A gentle reminder each day with the hymn of the day.'));
    const r = el('div', 'row2');
    const sg = el('div', 'seg'); sg.style.flex = '1';
    [[false, 'Off'], [true, 'On']].forEach(([val, label]) => {
      const b = el('button', '', label); b.type = 'button'; b.setAttribute('aria-pressed', cfg.on === val);
      b.onclick = async () => {
        if (val) { try { const p = await LN.requestPermissions(); if (p.display !== 'granted') { toast('Turn on notifications for this app in your phone settings'); return; } } catch (e) { return; } }
        cfg.on = val; store.set('remind', cfg); sg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); scheduleReminders();
      };
      sg.append(b);
    });
    const tm = el('input', 'time'); tm.type = 'time'; tm.value = cfg.time; tm.setAttribute('aria-label', 'Reminder time');
    tm.onchange = () => { cfg.time = tm.value || '08:00'; store.set('remind', cfg); scheduleReminders(); };
    r.append(sg, tm); g5.append(r); v.append(g5);
  }
  if (pushAvailable) {
    const g7 = el('div', 'group'); g7.append(el('h3', '', 'New hymn alerts'), el('p', '', 'Get a notification when a new hymn is added.'));
    const sg2 = el('div', 'seg');
    const bOff = el('button', '', 'Off'), bOn = el('button', '', 'On'); bOff.type = bOn.type = 'button';
    const show = on => { bOn.setAttribute('aria-pressed', on); bOff.setAttribute('aria-pressed', !on); };
    show(false); push.isOn().then(show);
    bOn.onclick = async () => {
      const ok = await push.turnOn(); show(ok);
      toast(ok ? 'You will get new hymn alerts' : (isIOS && !standalone ? 'On iPhone, add the app to your Home Screen first' : 'Allow notifications for this app in your settings'));
    };
    bOff.onclick = async () => { await push.turnOff(); show(false); toast('New hymn alerts are off'); };
    sg2.append(bOff, bOn); g7.append(sg2); v.append(g7);
  }
  const g6 = el('div', 'group'); g6.append(el('h3', '', 'Privacy'), el('p', '', 'This app has no accounts and collects no personal information.'));
  const pa = el('a', 'link', 'Read the privacy policy'); pa.href = 'privacy.html'; pa.target = '_blank'; pa.rel = 'noopener'; g6.append(pa);
  v.append(g3, g6, el('p', 'foot', 'ይህችን መዝሙር ለእናንተ ጻፉ'));
};

views.play = v => {
  const s = byId[route.arg];
  if (!s) { v.append(empty('hymns', syncing ? 'Loading this hymn…' : 'That hymn was not found.')); return; }
  recent = [s.id, ...recent.filter(x => x !== s.id)].slice(0, 12); store.set('recent', recent);
  if (!ctx || !ctx.includes(s.id)) ctx = SONGS.map(x => x.id);

  const frame = el('div', 'frame');
  if (navigator.onLine) {
    const f = el('iframe'); f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(s.v) + '?playsinline=1&rel=0';
    f.title = s.main; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.append(f);
  } else frame.append(el('p', '', 'Connect to the internet to play this video.'));
  v.append(frame, el('h1', 'ptitle', s.main));
  if (s.sub) v.append(el('p', 'psub', s.sub));
  if (s.d) v.append(el('p', 'psub', s.d + (s.c ? ' · Collection' : '')));

  const acts = el('div', 'acts');
  const sh = el('button', 'btn'); sh.type = 'button'; sh.innerHTML = svg('share') + '<span>Share</span>'; sh.onclick = () => share(s);
  acts.append(favBtn(s.id, true, 'btn fav'), sh); v.append(acts);

  const i = ctx.indexOf(s.id), pv = byId[ctx[i - 1]], nx = byId[ctx[i + 1]];
  const pn = el('div', 'pn');
  const mk = (cls, x, label, icon, first) => {
    const a = el('a', cls + (x ? '' : ' off')); if (x) a.href = '#/play/' + x.id;
    const t = el('span'); t.append(el('small', '', label), el('b', '', x ? x.main : '—'));
    a.innerHTML = first ? svg(icon) : ''; a.append(t); if (!first) a.insertAdjacentHTML('beforeend', svg(icon)); return a;
  };
  pn.append(mk('prev', pv, 'Previous', 'prev', true), mk('next', nx, 'Next', 'next', false)); v.append(pn);

  const lines = LYRICS[s.id];
  const head = el('div', 'lyhead'); head.append(el('h2', '', 'Lyrics'));
  if (lines && lines.length) {
    const sz = el('div', 'sz');
    [['A−', -.1], ['A+', .1]].forEach(([l, d]) => { const b = el('button', '', l); b.type = 'button'; b.setAttribute('aria-label', d < 0 ? 'Smaller text' : 'Larger text'); b.onclick = () => { const n = Math.min(2, Math.max(.9, (store.get('lyr', 1.2)) + d)); store.set('lyr', n); document.documentElement.style.setProperty('--lyr', n + 'rem'); }; sz.append(b); });
    const rb = el('button', 'rdbtn', 'Reading mode'); rb.type = 'button'; rb.onclick = () => openReader(s, lines);
    head.append(rb, sz);
  }
  v.append(head);
  const ly = el('div', 'lyrics');
  if (lines && lines.length) lines.forEach(t => { const c = t.startsWith('*'); ly.append(el('p', c ? 'ch' : '', c ? t.slice(1) : t)); });
  else ly.append(el('p', 'muted', 'Lyrics coming soon.'));
  v.append(ly);
};

let wake = null;
async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
    else if (wake) { await wake.release(); wake = null; }
  } catch (e) {}
}
function closeReader() {
  const r = $('#reader'); if (r) r.remove();
  document.body.style.overflow = ''; keepAwake(false);
}
function openReader(s, lines) {
  closeReader();
  const o = el('div', 'reader'); o.id = 'reader'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Reading mode');
  const top = el('div', 'rtop');
  const x = el('button', 'iconbtn'); x.type = 'button'; x.setAttribute('aria-label', 'Close reading mode'); x.innerHTML = svg('back'); x.onclick = closeReader;
  const t = el('div', 'rt1', s.main);
  const sz = el('div', 'sz');
  [['A−', -.1], ['A+', .1]].forEach(([l, d]) => { const b = el('button', '', l); b.type = 'button'; b.setAttribute('aria-label', d < 0 ? 'Smaller text' : 'Larger text'); b.onclick = () => { const n = Math.min(2, Math.max(.9, store.get('lyr', 1.2) + d)); store.set('lyr', n); document.documentElement.style.setProperty('--lyr', n + 'rem'); }; sz.append(b); });
  top.append(x, t, sz);
  const body = el('div', 'rbody'), ly = el('div', 'lyrics');
  lines.forEach(l => { const c = l.startsWith('*'); ly.append(el('p', c ? 'ch' : '', c ? l.slice(1) : l)); });
  body.append(ly); o.append(top, body); document.body.append(o);
  document.body.style.overflow = 'hidden'; keepAwake(true);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('#reader')) keepAwake(true); });

async function scheduleReminders() {
  if (!LN) return;
  const cfg = store.get('remind', { on: false, time: '08:00' });
  try {
    const pend = await LN.getPending();
    if (pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    if (!cfg.on) return;
    const [hh, mm] = cfg.time.split(':').map(Number), now = new Date(), items = [];
    for (let i = 0; i < 30; i++) {          // the next 30 days, each with that day's hymn
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hh, mm, 0);
      if (d <= now) continue;
      const s = hymnOfDay(d); if (!s) break;
      items.push({ id: 100 + i, title: 'Hymn of the day', body: s.main, schedule: { at: d, allowWhileIdle: true } });
    }
    if (items.length) await LN.schedule({ notifications: items });
  } catch (e) {}
}

async function sendShare(data) {
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }      // closed the share sheet on purpose
  }
  try { await navigator.clipboard.writeText(data.url); toast('Link copied'); }
  catch (e) { prompt('Copy this link', data.url); }
}
const appUrl = () => location.origin + location.pathname;
const share = s => sendShare({ title: s.main, text: s.main + ' · Mezmur Debter Tewahedo', url: appUrl() + '#/play/' + s.id });

/* ---------- router + chrome ---------- */
const TABS = [['home', 'Home'], ['hymns', 'Hymns'], ['saints', 'Saints'], ['saved', 'Saved'], ['more', 'More']];
const TAB_OF = { home: 'home', hymns: 'hymns', play: 'hymns', saints: 'saints', saint: 'saints', saved: 'saved', more: 'more' };
const TITLE = { hymns: 'Hymns', saints: 'Saints and feasts', saved: 'Saved', more: 'More', play: 'Now playing' };
const PARENT = { play: '#/hymns', saint: '#/saints' };
let route = { name: 'home', arg: null }, navCount = 0, curKey = location.hash, scrolls = {};

function parse() {
  const h = location.hash.replace(/^#\/?/, ''), [name, arg] = h.split('/');
  return { name: views[name] ? name : 'home', arg: arg ? decodeURIComponent(arg) : null };
}
function drawTabs() {
  const n = $('#tabs'); n.replaceChildren();
  TABS.forEach(([k, label]) => {
    const a = el('a'); a.href = '#/' + k; a.innerHTML = `<span class="pill">${svg(k)}</span><span>${label}</span>`;
    if (TAB_OF[route.name] === k) a.setAttribute('aria-current', 'page'); n.append(a);
  });
}
function drawBar() {
  const bar = $('#bar'); bar.replaceChildren();
  const inner = el('div', 'barin'), h = el('h1');
  if (route.name === 'home') {
    const m = el('img', 'mark'); m.src = 'icons/icon-192.png'; m.alt = '';
    h.innerHTML = 'Mezmur Debter<small>Tewahedo</small>'; inner.append(m, h);
  } else {
    const hasBack = PARENT[route.name];
    if (hasBack) {
      const b = el('button', 'iconbtn'); b.type = 'button'; b.setAttribute('aria-label', 'Back'); b.innerHTML = svg('back');
      b.onclick = () => navCount > 0 ? history.back() : (location.hash = PARENT[route.name]); inner.append(b);
    } else h.style.paddingLeft = '8px';
    let t = TITLE[route.name] || '';
    if (route.name === 'saint') { const e = SAINT_LIST.find(x => x[0] === route.arg); t = e ? e[1] : 'Saints and feasts'; }
    h.textContent = t; inner.append(h);
    if (route.name === 'play' && byId[route.arg]) {
      const sb = el('button', 'iconbtn'); sb.type = 'button'; sb.setAttribute('aria-label', 'Share'); sb.innerHTML = svg('share'); sb.onclick = () => share(byId[route.arg]); inner.append(sb);
    }
  }
  bar.append(inner);
}
function render() {
  route = parse();
  const v = $('#view'); v.replaceChildren();
  document.title = route.name === 'play' && byId[route.arg] ? byId[route.arg].main + ' · Mezmur Debter' : 'Mezmur Debter Tewahedo';
  drawBar(); drawTabs(); views[route.name](v);
  const y = route.name === 'play' ? 0 : (scrolls[location.hash] || 0);
  requestAnimationFrame(() => window.scrollTo(0, y));
}
addEventListener('hashchange', () => { closeReader(); scrolls[curKey] = window.scrollY; curKey = location.hash; navCount++; render(); });

document.addEventListener('click', e => {
  const fb = e.target.closest('.fav'); if (fb) { e.preventDefault(); toggleFav(fb.dataset.id); return; }
  const pl = e.target.closest('a[href^="#/play/"]');
  if (pl) { const box = pl.closest('.ctxlist'); ctx = box ? box._ids : null; }
  const tab = e.target.closest('#tabs a');
  if (tab && tab.getAttribute('href') === location.hash) window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.documentElement.style.setProperty('--lyr', store.get('lyr', 1.2) + 'rem');
applyTheme();
// Offline notice
const offBar = $('#offline'), updOff = () => { if (offBar) offBar.hidden = navigator.onLine; };
addEventListener('online', updOff); addEventListener('offline', updOff); updOff();
scheduleReminders();
// Hymns found last time show up instantly, before the network answers
const cachedList = store.get('videosCache', null);
if (Array.isArray(cachedList)) { const r0 = mergeVideos(cachedList); if (r0.added || r0.filled) rebuild(); }
render();

/* ---------- daily video list (videos.json is kept up to date by the GitHub Action) ---------- */
function mergeVideos(list) {
  const have = new Map(SONGS.map(s => [s.v, s]));
  const fresh = []; let filled = false;
  list.forEach(x => {
    if (!x || !x.id || !x.title) return;
    const s = have.get(x.id);
    if (s) { if (!s.t.trim()) { s.t = x.title; filled = true; } }
    else if (!fresh.some(f => f.v === x.id)) fresh.push({ id: 'v' + x.id, v: x.id, t: x.title, d: x.dur || '', c: /ስብስብ|collection/i.test(x.title) ? 1 : 0 });
  });
  if (fresh.length) SONGS.unshift(...fresh);
  return { added: fresh.length, filled };
}
async function syncVideos() {
  try {
    const r = await fetch((isNative ? REMOTE : '') + 'videos.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const list = await r.json();
    if (!Array.isArray(list)) return;
    const wasMissing = route.name === 'play' && !byId[route.arg];
    store.set('videosCache', list);
    const res = mergeVideos(list);
    if (!res.added && !res.filled) return;
    rebuild();
    if (route.name !== 'play' || wasMissing) { render(); if (res.added && route.name !== 'play') toast(res.added + ' new hymn' + (res.added === 1 ? '' : 's')); }
  } catch (e) {
  } finally {
    syncing = false;
    if (route.name === 'play' && !byId[route.arg]) render();
  }
}
syncVideos();
// Also check again when the app comes back to the screen (at most every 6 hours)
let lastSync = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastSync > 6 * 3600 * 1000) { lastSync = Date.now(); syncVideos(); }
});
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
