(function () {
    'use strict';

    if (window.top !== window.self) return;

    const MAX_QUEUE = 30;

    const ICON = {
        download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
        video:    'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
        audio:    'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
        image:    'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
        start:    'M9 4H5v16h4v-2H7V6h2V4zm2 8l7-5v10l-7-5z',
        end:      'M15 4h4v16h-4v-2h2V6h-2V4zm-2 8L6 7v10l7-5z',
        add:      'M14 10H3v2h11v-2zm0-4H3v2h11V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM3 16h7v-2H3v2z',
        list:     'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z'
    };

    const MODE_DEF = {
        video: { label: 'Video',  icon: 'video' },
        audio: { label: 'Audio',  icon: 'audio' },
        image: { label: 'Imagen', icon: 'image' }
    };

    const PLATFORMS = {
        youtube:   { modes: ['video', 'audio'],           clip: true  },
        instagram: { modes: ['video', 'audio', 'image'],  clip: false },
        tiktok:    { modes: ['video', 'audio'],           clip: false },
        x:         { modes: ['video', 'audio', 'image'],  clip: false },
        pinterest: { modes: ['image', 'video'],           clip: false },
        other:     { modes: ['video', 'audio', 'image'],  clip: false }
    };

    function detectPlatform() {
        const h = location.hostname;
        if (h.includes('youtube.com')) return 'youtube';
        if (h.includes('instagram.com')) return 'instagram';
        if (h.includes('tiktok.com')) return 'tiktok';
        if (h.includes('x.com') || h.includes('twitter.com')) return 'x';
        if (h.includes('pinterest.')) return 'pinterest';
        return 'other';
    }

    function isShortForm() {
        const { hostname: h, pathname: p } = window.location;
        if (h.includes('tiktok.com')) return true;
        if (h.includes('instagram.com') && (p.includes('/reel/') || p.includes('/reels/'))) return true;
        if (h.includes('youtube.com') && p.startsWith('/shorts/')) return true;
        return false;
    }

    function isInstagramModalOpen() {
        if (platform !== 'instagram') return false;
        const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], [role="dialog"]'));
        return dialogs.some(d => {
            if (!d || !d.isConnected) return false;
            const r = d.getBoundingClientRect();
            if (r.width < 200 || r.height < 200) return false;
            // un modal de post contiene article o media
            return !!d.querySelector('article, video, img[src*="cdninstagram"], a[href*="/p/"]');
        });
    }

    function isInstagramGridOrFeed() {
        if (platform !== 'instagram') return false;
        const p = window.location.pathname;
        // Home feed
        if (p === '/' || p === '') return true;
        // Perfil de usuario: /[username]/ (sin /p/, /reel/, /reels/, /explore/, /direct/)
        if (/^\/[A-Za-z0-9._]+\/?$/.test(p)) return true;
        // Explore / otros feeds
        if (p.startsWith('/explore') || p.startsWith('/reels') || p.startsWith('/direct')) return true;
        return false;
    }

    let platform     = detectPlatform();
    let currentModes = PLATFORMS[platform].modes.slice();
    let clipAllowed  = PLATFORMS[platform].clip;
    let currentMode  = currentModes[0];
    let autoImageModeUrl = null;

    let inT = null, outT = null, curUrl = null;

    let lastCopied = { url: null, ts: 0 };
    const COPIED_TTL_MS = 120000;

    function captureCopied(text) {
        try {
            if (!text) return;
            const s = String(text).trim();
            let m = s.match(/https?:\/\/(?:www\.)?tiktok\.com\/@[^/?#\s]+\/video\/\d+/i);
            if (!m) m = s.match(/https?:\/\/(?:vm|vt)\.tiktok\.com\/[\w-]+\/?/i);
            if (!m) m = s.match(/https?:\/\/(?:www\.)?tiktok\.com\/t\/[\w-]+\/?/i);
            if (m) lastCopied = { url: m[0].replace(/\/$/, ''), ts: Date.now() };
        } catch (_) {}
    }
    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data || event.data.source !== 'indiedl-clipboard') return;
        captureCopied(event.data.text);
    });
    function getRecentCopied() {
        return (lastCopied.url && Date.now() - lastCopied.ts < COPIED_TTL_MS) ? lastCopied.url : null;
    }

    if (platform === 'tiktok') {
        document.addEventListener('copy', () => {
            try {
                const sel = String(window.getSelection && window.getSelection());
                captureCopied(sel);
                const ae = document.activeElement;
                if (ae && typeof ae.value === 'string' && typeof ae.selectionStart === 'number') {
                    captureCopied(ae.value.slice(ae.selectionStart, ae.selectionEnd) || ae.value);
                }
            } catch (_) {}
        }, true);
    }

    /* ─────────────────────────── COLA UNIFICADA ─────────────────────────── */
    let queueCache = [];
    let queueLoaded = false;
    const queueReady = chrome.storage.local.get('indiedl_queue').then((saved) => {
        queueCache = Array.isArray(saved.indiedl_queue) ? saved.indiedl_queue : [];
        queueLoaded = true;
    }).catch(() => { queueCache = []; queueLoaded = true; });

    const loadQueue = () => queueCache.slice();

    async function saveQueue(q) {
        queueCache = Array.isArray(q) ? q.slice() : [];
        try { await chrome.storage.local.set({ indiedl_queue: queueCache }); } catch (_) {}
    }
    async function readQueueFresh() {
        try {
            const saved = await chrome.storage.local.get('indiedl_queue');
            const q = Array.isArray(saved.indiedl_queue) ? saved.indiedl_queue.slice() : [];
            queueCache = q;
            return q;
        } catch (_) { return queueCache.slice(); }
    }

    /* ─────────────────────────── UTILIDADES DOM ─────────────────────────── */
    function el(tag, props = {}, ...kids) {
        const n = document.createElement(tag);
        for (const [k, v] of Object.entries(props)) {
            if (k === 'className') n.className = v;
            else if (k === 'text') n.textContent = v;
            else if (k === 'style' && typeof v === 'string') n.setAttribute('style', v);
            else if (k === 'style' && v && typeof v === 'object') Object.assign(n.style, v);
            else n[k] = v;
        }
        for (const c of kids) {
            if (c == null || c === false) continue;
            if (typeof c === 'string') n.appendChild(document.createTextNode(c));
            else if (c instanceof Node) n.appendChild(c);
        }
        return n;
    }
    function svgIcon(d) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
        return svg;
    }
    const fmt = (sec) => {
        sec = Math.max(0, Math.floor(sec));
        const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
        const p = (x) => String(x).padStart(2, '0');
        return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
    };

    /* ─────────────────────────── ESTILOS ─────────────────────────── */
    const style = document.createElement('style');
    style.textContent = `
        #indiedl-bar {
            display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; flex-wrap: wrap;
            font-family: 'Roboto', 'Segoe UI', Arial, sans-serif; vertical-align: middle;
            visibility: hidden; z-index: 10;
        }
        #indiedl-bar.ready { visibility: visible; }

        #indiedl-bar.floating {
            position: fixed; bottom: 80px; right: 24px; z-index: 2147483646; margin: 0;
            background: #151B21; border: 2px solid #FFF333; border-radius: 16px;
            padding: 8px; max-width: 420px; box-shadow: 0 8px 24px rgba(0,0,0,.6);
        }
        #indiedl-bar.hidden { display: none !important; }

        #indiedl-bar.tt-floating,
        #indiedl-bar.yt-shorts-floating,
        #indiedl-bar.ig-floating,
        #indiedl-bar.pin-floating {
            position: fixed !important;
            right: auto !important; bottom: auto !important;
            left: 0 !important; top: 0 !important;
            z-index: 2147483647 !important;
            display: flex !important; flex-direction: column !important;
            flex-wrap: nowrap !important; align-items: center !important;
            justify-content: center !important; gap: 8px !important;
            width: 42px !important; min-width: 42px !important; max-width: 42px !important;
            margin: 0 !important; padding: 8px !important;
            border: 1.5px solid #FFF333 !important; border-radius: 24px !important;
            background: rgba(21, 27, 33, .96) !important;
            box-shadow: 0 8px 24px rgba(0,0,0,.55) !important;
            visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;
            transform: translate3d(-9999px, -9999px, 0) !important;
            will-change: transform; transition: opacity .12s ease-out !important;
        }
        #indiedl-bar.tt-floating.positioned,
        #indiedl-bar.yt-shorts-floating.positioned,
        #indiedl-bar.ig-floating.positioned,
        #indiedl-bar.pin-floating.positioned {
            visibility: visible !important; opacity: 1 !important; pointer-events: auto !important;
        }
        #indiedl-bar.positioned.smooth {
            transition: opacity .12s ease-out, transform .22s cubic-bezier(.2, .8, .2, 1) !important;
        }
        #indiedl-bar.compact button {
            all: unset !important; box-sizing: border-box !important;
            display: inline-flex !important; align-items: center !important;
            justify-content: center !important; flex: 0 0 36px !important;
            width: 36px !important; min-width: 36px !important; max-width: 36px !important;
            height: 36px !important; min-height: 36px !important; max-height: 36px !important;
            margin: 0 !important; padding: 0 !important;
            border: 1.5px solid #FFF333 !important; border-radius: 50% !important;
            background: #0D1116 !important; color: #FFF333 !important; cursor: pointer !important;
        }
        #indiedl-bar.compact button span { display: none !important; }
        #indiedl-bar.compact button svg {
            display: block !important; width: 18px !important; height: 18px !important;
            flex: 0 0 18px !important; fill: currentColor !important; pointer-events: none !important;
        }
        #indiedl-bar.compact button.dl { background: #FFF333 !important; color: #0D1116 !important; }
        #indiedl-bar.compact button:hover,
        #indiedl-bar.compact button:focus-visible {
            background: #FFF333 !important; color: #0D1116 !important;
        }
        #indiedl-bar.ig-floating.ig-post,
        #indiedl-bar.pin-floating {
            flex-direction: row !important;
            justify-content: flex-start !important;
            width: auto !important; min-width: 0 !important; max-width: calc(100vw - 16px) !important;
            height: auto !important; padding: 5px !important; gap: 5px !important;
            border-radius: 22px !important;
        }
        #indiedl-bar.ig-floating.ig-post button,
        #indiedl-bar.pin-floating button {
            flex-basis: 32px !important; width: 32px !important;
            min-width: 32px !important; max-width: 32px !important;
            height: 32px !important; min-height: 32px !important; max-height: 32px !important;
        }
        #indiedl-bar.ig-floating.ig-post button svg,
        #indiedl-bar.pin-floating button svg {
            width: 16px !important; height: 16px !important; flex-basis: 16px !important;
        }

        #indiedl-bar.no-clip-platform .clip-control {
            display: none !important; visibility: hidden !important; pointer-events: none !important;
        }

        #indiedl-bar.ig-icons {
            flex-wrap: nowrap !important; align-items: center !important; gap: 6px !important;
            margin-left: 0 !important; padding: 0 !important; transform: none !important;
            vertical-align: middle !important;
        }
        #indiedl-bar.ig-inline { display: inline-flex !important; flex-direction: row !important; margin-left: 8px !important; }
        #indiedl-bar.ig-reel {
            display: flex !important; flex-direction: column !important;
            align-items: center !important; justify-content: flex-start !important;
            gap: 8px !important; width: 36px !important; min-width: 36px !important;
            max-width: 36px !important; margin: 0 0 14px 0 !important; padding: 0 !important;
        }
        #indiedl-bar.ig-icons button {
            all: unset !important; box-sizing: border-box !important;
            display: inline-flex !important; align-items: center !important;
            justify-content: center !important; flex: 0 0 36px !important;
            width: 36px !important; min-width: 36px !important; max-width: 36px !important;
            height: 36px !important; min-height: 36px !important; max-height: 36px !important;
            margin: 0 !important; padding: 0 !important;
            border: 1.5px solid #FFF333 !important; border-radius: 50% !important;
            background: #0D1116 !important; color: #FFF333 !important;
            box-shadow: 0 2px 6px rgba(0,0,0,.35) !important; cursor: pointer !important;
            transition: background .15s, color .15s, transform .1s !important;
        }
        #indiedl-bar.ig-icons button span { display: none !important; }
        #indiedl-bar.ig-icons button svg {
            display: block !important; width: 18px !important; height: 18px !important;
            flex: 0 0 18px !important; fill: currentColor !important; pointer-events: none !important;
        }
        #indiedl-bar.ig-icons button.dl { background: #FFF333 !important; color: #0D1116 !important; }
        #indiedl-bar.ig-icons button.set { background: rgba(255,243,51,.20) !important; }
        #indiedl-bar.ig-icons button:hover,
        #indiedl-bar.ig-icons button:focus-visible { background: #FFF333 !important; color: #0D1116 !important; }
        #indiedl-bar.ig-icons button:active { transform: scale(.94) !important; }
        #indiedl-bar.ig-icons button:focus-visible { outline: 2px solid #FFF333 !important; outline-offset: 2px !important; }

        #indiedl-bar button {
            display: inline-flex; align-items: center; gap: 6px;
            height: 36px; padding: 0 14px 0 10px; border-radius: 18px; cursor: pointer;
            border: 1.5px solid #FFF333; background: #0D1116; color: #FFF333;
            font-size: 13px; font-weight: 700; white-space: nowrap; line-height: 1;
            transition: background .15s, color .15s, transform .1s;
        }
        #indiedl-bar button svg { width: 20px; height: 20px; fill: currentColor; flex: none; }
        #indiedl-bar button:hover { background: #FFF333; color: #0D1116; }
        #indiedl-bar button:disabled { opacity: .55; cursor: wait; }
        #indiedl-bar button:active { transform: scale(.96); }
        #indiedl-bar button.dl { background: #FFF333; color: #0D1116; }
        #indiedl-bar button.dl:hover { background: #FFE600; border-color: #FFE600; }
        #indiedl-bar button.set { background: rgba(255,243,51,.20); }
        #indiedl-bar button.set:hover { background: #FFF333; }

        #indiedl-pop {
            position: fixed; z-index: 2147483647; width: 340px; max-height: 60vh; overflow: auto;
            background: #151B21; border: 2px solid #FFF333; border-radius: 12px; padding: 12px;
            font-family: 'Segoe UI', Arial, sans-serif; color: #F4F6F8; font-size: 13px;
            box-shadow: 0 10px 30px rgba(0,0,0,.8); display: none;
        }
        #indiedl-pop.show { display: block; }
        #indiedl-pop .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; color: #FFF333; font-weight: 800; text-transform: uppercase; }
        #indiedl-pop .head button { background: #0D1116; color: #FFF333; border: 1px solid #FFF333; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; font-weight: 700; }
        #indiedl-pop .head button:hover { background: #FFF333; color: #0D1116; }
        #indiedl-pop .row { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 0 12px; border-top: 1px solid #2a323a; }
        #indiedl-pop .row .t { flex: 1; min-width: 0; }
        #indiedl-pop .row .t b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
        #indiedl-pop .row .t small { color: #AAB4BE; }
        #indiedl-pop .row .x { cursor: pointer; color: #AAB4BE; background: none; border: none; font-size: 16px; padding: 4px 6px; flex: none; }
        #indiedl-pop .row .x:hover { color: #FF5B65; }
        #indiedl-pop .row .state {
            font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700;
            text-transform: uppercase; letter-spacing: .5px; flex: none; white-space: nowrap;
        }
        #indiedl-pop .row .state.downloading { background: #FFF333; color: #0D1116; }
        #indiedl-pop .row .state.done { background: #4ADE80; color: #0D1116; }
        #indiedl-pop .row .state.error { background: #FF5B65; color: #fff; }
        #indiedl-pop .row .progress {
            position: absolute; left: 0; right: 0; bottom: 4px; height: 3px;
            background: rgba(255,243,51,.15); border-radius: 2px; overflow: hidden;
        }
        #indiedl-pop .row .progress .fill {
            position: absolute; top: 0; bottom: 0; background: #FFF333;
            border-radius: 2px; animation: indiedl-indeterminate 1.4s ease-in-out infinite;
        }
        @keyframes indiedl-indeterminate {
            0%   { left: -40%; width: 40%; }
            50%  { left: 30%;  width: 60%; }
            100% { left: 100%; width: 40%; }
        }
        #indiedl-pop .empty { color: #AAB4BE; padding: 10px 0; text-align: center; }

        #indiedl-toast {
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 2147483647;
            background: #0D1116; color: #FFF333; border: 1px solid #FFF333; padding: 10px 16px; border-radius: 8px;
            font: 13px 'Segoe UI', Arial, sans-serif; opacity: 0; transition: opacity .25s; pointer-events: none;
            max-width: 90vw; text-align: center;
        }
        #indiedl-toast.show { opacity: 1; }
    `;

    function injectStyle() {
        if (style.isConnected) return;
        const root = document.head || document.documentElement;
        if (root) root.appendChild(style);
    }
    injectStyle();
    if (!style.isConnected) {
        document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
    }

    function makeBtn(cls, onclick) {
        const b = el('button', { type: 'button', className: cls, onclick });
        const lbl = el('span');
        b.append(svgIcon(ICON.download), lbl);
        b._lbl = lbl;
        return b;
    }
    function setBtn(b, iconD, text, title) {
        b.replaceChild(svgIcon(iconD), b.firstChild);
        b._lbl.textContent = text;
        b.setAttribute('aria-label', text);
        if (title) b.title = title;
    }

    const bDl    = makeBtn('dl', () => download());
    const bMode  = makeBtn('',   () => cycleMode());
    const bIn    = makeBtn('clip-control',  () => markIn());
    const bOut   = makeBtn('clip-control', () => markOut());
    const bQ     = makeBtn('',   () => addToQueue());
    const bList  = makeBtn('',   (e) => { e.stopPropagation(); togglePop(); });

    bIn.addEventListener('contextmenu',  (e) => { e.preventDefault(); inT = null;  refresh(); });
    bOut.addEventListener('contextmenu', (e) => { e.preventDefault(); outT = null; refresh(); });

    const bar     = el('div', { id: 'indiedl-bar' }, bDl, bMode, bIn, bOut, bQ, bList);
    const pop     = el('div', { id: 'indiedl-pop' });
    const toastEl = el('div', { id: 'indiedl-toast' });

    let barIntersecting = true;
    let barIO = null;
    try {
        barIO = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                barIntersecting = entry.isIntersecting;
                if (!entry.isIntersecting &&
                    bar.classList.contains('ready') &&
                    platform === 'youtube' &&
                    location.pathname === '/watch') {
                    curUrl = null;
                    scheduleMount();
                }
            }
        }, { threshold: 0 });
    } catch (_) { barIO = null; }

    function observeBar() {
        if (!barIO) return;
        try {
            barIO.disconnect();
            if (bar.isConnected) barIO.observe(bar);
        } catch (_) {}
    }

    function barLikelyVisible() {
        return bar.isConnected && barIntersecting && !bar.closest('[hidden]');
    }

    /* ─── SINCRONIZACIÓN ENTRE PESTAÑAS ─── */
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.indiedl_queue) return;
        const incoming = Array.isArray(changes.indiedl_queue.newValue) ? changes.indiedl_queue.newValue : [];
        if (JSON.stringify(incoming) === JSON.stringify(queueCache)) return;
        queueCache = incoming;
        queueLoaded = true;
        refresh();
        if (pop.classList.contains('show')) renderPop();
    });

    let autoCompleteTimer = 0;
    function scheduleAutoComplete() {
        if (autoCompleteTimer) return;
        autoCompleteTimer = setTimeout(async () => {
            autoCompleteTimer = 0;
            if (!queueCache.some(it => it.state === 'downloading')) return;
            const q = await readQueueFresh();
            const now = Date.now();
            let changed = false;
            const updated = q.map(item => {
                if (item.state === 'downloading' && item.estimatedDoneAt && now >= item.estimatedDoneAt) {
                    changed = true;
                    return { ...item, state: 'done' };
                }
                return item;
            });
            if (changed) saveQueue(updated);
            if (queueCache.some(it => it.state === 'downloading')) scheduleAutoComplete();
        }, 3000);
    }

    function refresh() {
        if (!currentModes.includes(currentMode)) currentMode = currentModes[0];
        const mode = currentMode;
        const def  = MODE_DEF[mode];
        const n    = loadQueue().length;
        for (const actionButton of [bDl, bQ, bList]) actionButton.disabled = !queueLoaded;

        setBtn(bDl, ICON.download, n ? `Descargar +${n}` : 'Descargar', n ? `Descarga este video y los ${n} de la cola` : 'Descarga este contenido');

        const nextMode = currentModes[(currentModes.indexOf(mode) + 1) % currentModes.length];
        setBtn(bMode, ICON[def.icon], def.label, `Tipo de descarga: ${def.label}. Clic para pasar a ${MODE_DEF[nextMode].label}.`);

        const isShort = isShortForm();
        const isRegularYouTubeVideo = platform === 'youtube' && window.location.pathname === '/watch' && !isShort;
        const showClip = isRegularYouTubeVideo && clipAllowed && mode === 'video';

        bar.classList.toggle('no-clip-platform', !showClip);

        for (const clipButton of [bIn, bOut]) {
            const hideClipButton = !showClip;
            clipButton.hidden = hideClipButton;
            if (hideClipButton) {
                clipButton.style.setProperty('display', 'none', 'important');
            } else {
                clipButton.style.removeProperty('display');
                clipButton.style.display = 'inline-flex';
            }
            clipButton.setAttribute('aria-hidden', String(hideClipButton));
        }

        setBtn(bIn,  ICON.start, inT  != null ? `Inicio ${fmt(inT)}`  : 'Inicio', 'Marca el inicio del recorte');
        setBtn(bOut, ICON.end,   outT != null ? `Fin ${fmt(outT)}`    : 'Fin', 'Marca el final del recorte');
        bIn.classList.toggle('set',  inT  != null);
        bOut.classList.toggle('set', outT != null);

        setBtn(bQ,    ICON.add,  'A la cola', 'Guarda este contenido en la cola');
        setBtn(bList, ICON.list, `Cola (${n})`, 'Ver y editar la cola');
    }

    function cycleMode() {
        const i = currentModes.indexOf(currentMode);
        currentMode = currentModes[(i + 1) % currentModes.length];
        refresh();
    }

    let toastTimer = null;
    function toast(msg) {
        if (!document.body.contains(toastEl)) document.body.appendChild(toastEl);
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4500);
    }

    function getVideo() {
        return document.querySelector('video.html5-main-video')
            || Array.from(document.querySelectorAll('video')).find(v => !v.paused)
            || document.querySelector('video');
    }
    function getTitle() {
        const h1 = document.querySelector('ytd-watch-metadata h1');
        const t = (h1 && h1.textContent.trim()) || document.title;
        return t.replace(/^\(\d+\)\s*/, '').replace(/\s*[-|]\s*YouTube$/i, '').trim().slice(0, 120);
    }
    function getCleanUrl() {
        const href = window.location.href;
        const host = window.location.hostname.toLowerCase();

        const cleanMatch = (value, pattern) => {
            if (!value) return null;
            try {
                const u = new URL(value, location.origin);
                const m = u.href.match(pattern);
                return m ? m[1].replace(/\/$/, '') : null;
            } catch (_) { return null; }
        };

        if (host.endsWith('tiktok.com')) {
            const ttPattern = /(https?:\/\/(?:www\.)?tiktok\.com\/@[^/?#]+\/video\/\d+)/i;
            const direct = cleanMatch(href, ttPattern);
            if (direct) return direct;

            const isOnScreen = (node) => {
                if (!node || !node.getBoundingClientRect) return false;
                const r = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
                    r.right > 0 && r.left < innerWidth &&
                    style.display !== 'none' && style.visibility !== 'hidden';
            };
            const areaOf = (node) => {
                const r = node.getBoundingClientRect();
                return Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) *
                    Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
            };
            const centerDistance = (node) => {
                const r = node.getBoundingClientRect();
                return Math.hypot(
                    (r.left + r.width / 2 - innerWidth / 2) / Math.max(innerWidth, 1),
                    (r.top + r.height / 2 - innerHeight / 2) / Math.max(innerHeight, 1)
                );
            };
            const normalizeTikTokUrl = (value) => cleanMatch(value, ttPattern);

            const urlFromPlayerId = (video) => {
                let id = null, box = null;
                for (let n = video, d = 0; n && d < 25; n = n.parentElement, d++) {
                    const m = (n.id || '').match(/xgwrapper-\d+-(\d{15,22})/);
                    if (m) { id = m[1]; box = n; break; }
                }
                if (!id) return null;
                let user = '_';
                for (let n = box, d = 0; n && d < 8; n = n.parentElement, d++) {
                    const a = n.querySelector && n.querySelector('[data-e2e="video-author-uniqueid"], a[href^="/@"]');
                    if (a) {
                        const m = ((a.textContent || '') + ' ' + (a.getAttribute('href') || '')).match(/@?([\w.-]{2,64})/);
                        if (m && m[1] !== 'video') { user = m[1].replace(/^@/, ''); break; }
                    }
                }
                return `https://www.tiktok.com/@${user}/video/${id}`;
            };

            const reactKeys = (node) => {
                if (!node) return [];
                try {
                    return Object.keys(node).filter(key =>
                        key.startsWith('__reactProps$') ||
                        key.startsWith('__reactFiber$') ||
                        key.startsWith('__reactContainer$')
                    );
                } catch (_) { return []; }
            };
            const extractItemsFromReact = (root) => {
                const candidates = [];
                const seen = new Set();
                const candidateSeen = new Set();
                const addCandidate = (obj) => {
                    if (!obj || typeof obj !== 'object' || candidateSeen.has(obj)) return;
                    candidateSeen.add(obj);
                    const id = String(
                        obj.id ?? obj.itemId ?? obj.item_id ?? obj.awemeId ??
                        obj.aweme_id ?? obj.videoId ?? obj.video_id ?? ''
                    );
                    const authorObj = obj.author || obj.authorInfo || obj.author_info ||
                        obj.user || obj.userInfo || obj.user_info || {};
                    const username = String(
                        authorObj.uniqueId ?? authorObj.unique_id ?? authorObj.unique_id_str ??
                        authorObj.username ?? obj.uniqueId ?? obj.unique_id ??
                        obj.authorName ?? obj.author_name ?? ''
                    ).replace(/^@/, '');
                    const videoObj = obj.video && typeof obj.video === 'object' ? obj.video : null;
                    const videoId = String(
                        videoObj?.id ?? videoObj?.videoId ?? videoObj?.video_id ?? id
                    );
                    if (/^\d{15,22}$/.test(videoId) && /^[\w.-]{2,64}$/.test(username)) {
                        candidates.push(`https://www.tiktok.com/@${username}/video/${videoId}`);
                    }
                };
                const walk = (value, depth) => {
                    if (!value || typeof value !== 'object' || depth > 7 || seen.has(value)) return;
                    seen.add(value);
                    if (Array.isArray(value)) {
                        for (const item of value.slice(0, 80)) walk(item, depth + 1);
                        return;
                    }
                    addCandidate(value);
                    for (const key of Object.keys(value).slice(0, 100)) {
                        if (key === 'stateNode' || key === 'memoizedProps' ||
                            key === 'pendingProps' || key === 'return' ||
                            key === 'child' || key === 'sibling' ||
                            key === 'children' || key === 'item' || key === 'itemInfo' ||
                            key === 'itemStruct' || key === 'video' || key === 'author' ||
                            key === 'authorInfo' || key === 'user') {
                            try { walk(value[key], depth + 1); } catch (_) {}
                        } else if (depth < 3 && value[key] && typeof value[key] === 'object') {
                            try { walk(value[key], depth + 1); } catch (_) {}
                        }
                    }
                };

                let node = root;
                for (let depth = 0; depth < 12 && node; depth++, node = node.parentElement) {
                    const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
                    if (videos.length > 1) continue;
                    for (const key of reactKeys(node)) {
                        try {
                            const attached = node[key];
                            if (key.startsWith('__reactProps$')) walk(attached, 0);
                            else if (key.startsWith('__reactFiber$')) {
                                let fiber = attached;
                                for (let n = 0; fiber && n < 8; n++, fiber = fiber.return) {
                                    walk(fiber.memoizedProps, 0);
                                    walk(fiber.pendingProps, 0);
                                    if (fiber.stateNode && fiber.stateNode !== node) {
                                        for (const propKey of reactKeys(fiber.stateNode)) {
                                            if (propKey.startsWith('__reactProps$')) {
                                                walk(fiber.stateNode[propKey], 0);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                    const unique = [...new Set(candidates)];
                    if (unique.length === 1) return unique[0];
                    if (unique.length > 1) return null;
                }
                return null;
            };

            const getPermalink = (root) => {
                if (!root) return [];
                const links = [];
                if (root.matches && root.matches('a[href]')) links.push(root);
                if (root.querySelectorAll) {
                    links.push(...root.querySelectorAll('a[href*="/video/"], a[href*="/@"]'));
                }
                return [...new Set(links)]
                    .filter(a => isOnScreen(a) || /copy link|copiar enlace/i.test(a.getAttribute('aria-label') || a.textContent || ''))
                    .map(a => normalizeTikTokUrl(a.href))
                    .filter(Boolean);
            };

            const videos = Array.from(document.querySelectorAll('video')).filter(isOnScreen);
            const rankedVideos = videos.map(video => ({
                video,
                score: (video.paused ? 0 : 1e9) + areaOf(video) - centerDistance(video) * 2e5
            })).sort((a, b) => b.score - a.score);

            for (const { video } of rankedVideos) {
                const playerUrl = urlFromPlayerId(video);
                if (playerUrl) return playerUrl;

                const reactUrl = extractItemsFromReact(video);
                if (reactUrl) return reactUrl;

                let node = video;
                for (let depth = 0; depth < 16 && node; depth++, node = node.parentElement) {
                    const videosInNode = node.querySelectorAll ? node.querySelectorAll('video') : [];
                    if (videosInNode.length > 1) continue;
                    const links = getPermalink(node);
                    const uniqueLinks = [...new Set(links)];
                    if (uniqueLinks.length === 1) return uniqueLinks[0];

                    const wrapper = node.closest && node.closest(
                        '[data-e2e*="video"], [data-e2e*="modal"], [role="dialog"], article, ' +
                        '[class*="DivVideo"], [class*="VideoDetail"], [class*="Modal"]'
                    );
                    if (wrapper && wrapper.querySelectorAll('video').length === 1) {
                        const wrapperLinks = [...new Set(getPermalink(wrapper))];
                        if (wrapperLinks.length === 1) return wrapperLinks[0];
                    }
                }
            }

            const copyControls = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .filter(el => {
                    const label = [
                        el.getAttribute('aria-label'), el.getAttribute('title'),
                        el.innerText, el.textContent
                    ].filter(Boolean).join(' ');
                    return /copy link|copiar enlace|copy video link|copiar vínculo/i.test(label) &&
                        el.getBoundingClientRect().width > 0;
                });
            for (const control of copyControls) {
                let node = control;
                for (let depth = 0; depth < 7 && node; depth++, node = node.parentElement) {
                    const vids = node.querySelectorAll ? node.querySelectorAll('video') : [];
                    if (vids.length > 1) continue;
                    const links = [...new Set(getPermalink(node))];
                    if (links.length === 1) return links[0];
                }
            }

            const visiblePermalinks = [...new Set(
                Array.from(document.querySelectorAll('a[href*="/@"][href*="/video/"]'))
                    .filter(isOnScreen)
                    .map(a => normalizeTikTokUrl(a.href))
                    .filter(Boolean)
            )];
            if (visiblePermalinks.length === 1) return visiblePermalinks[0];

            const copied = getRecentCopied();
            if (copied) return copied;

            return null;
        }

        if (host.endsWith('instagram.com')) {
            const igPattern = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/[^/?#]+)/i;
            const videos = Array.from(document.querySelectorAll('video'));
            const ranked = videos.map(video => {
                const r = video.getBoundingClientRect();
                const area = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) *
                    Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
                const dist = Math.hypot(
                    (r.left + r.width / 2 - innerWidth / 2) / Math.max(innerWidth, 1),
                    (r.top + r.height / 2 - innerHeight / 2) / Math.max(innerHeight, 1)
                );
                return { video, score: (video.paused ? 0 : 1e9) + area - dist * 2e5 };
            }).sort((a, b) => b.score - a.score);

            for (const { video } of ranked) {
                let node = video;
                for (let depth = 0; depth < 12 && node; depth++, node = node.parentElement) {
                    const links = [];
                    if (node.matches && node.matches('a[href]')) links.push(node);
                    if (node.querySelectorAll) links.push(...node.querySelectorAll('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"], a[href*="/tv/"]'));
                    for (const link of links) {
                        const result = cleanMatch(link.href, igPattern);
                        if (result) return result;
                    }
                }
            }
            const direct = cleanMatch(href, igPattern);
            if (direct) return direct;
            const postLinks = Array.from(document.querySelectorAll(
                'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]'
            )).filter((link) => !link.closest('#indiedl-bar, #indiedl-pop'))
                .map((link) => {
                    const result = cleanMatch(link.href, igPattern);
                    if (!result) return null;
                    const r = link.getBoundingClientRect();
                    if (r.width < 80 || r.height < 80 || r.bottom <= 0 || r.top >= innerHeight ||
                        r.right <= 0 || r.left >= innerWidth) return null;
                    const dist = Math.hypot(
                        r.left + r.width / 2 - innerWidth / 2,
                        r.top + r.height / 2 - innerHeight / 2
                    );
                    return { url: result, score: r.width * r.height - dist * 2000 };
                })
                .filter(Boolean)
                .sort((a, b) => b.score - a.score);
            return postLinks.length ? postLinks[0].url : null;
        }

        if (host.endsWith('youtube.com')) {
            if (href.includes('/watch')) {
                const id = new URL(href).searchParams.get('v');
                if (id) return `https://www.youtube.com/watch?v=${id}`;
            }
            const m = href.match(/https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^/?#]+)/i);
            if (m) return `https://www.youtube.com/shorts/${m[1]}`;
        }
        if (host.endsWith('x.com') || host.endsWith('twitter.com')) {
            const m = href.match(/(https?:\/\/(?:www\.)?(?:x|twitter)\.com\/\w+\/status\/\d+)/i);
            if (m) return m[1];
        }
        if (host.includes('pinterest.')) {
            const direct = href.match(/pinterest\.[a-z.]+\/pin\/(\d+)/i);
            if (direct) return `https://${host}/pin/${direct[1]}/`;
            const candidates = Array.from(document.querySelectorAll('a[href*="/pin/"]')).map((link) => {
                const m = link.href.match(/pinterest\.[a-z.]+\/pin\/(\d+)/i);
                if (!m) return null;
                const r = link.getBoundingClientRect();
                if (r.width < 60 || r.height < 60 || r.bottom <= 0 || r.top >= innerHeight) return null;
                const dist = Math.hypot(
                    r.left + r.width / 2 - innerWidth / 2,
                    r.top + r.height / 2 - innerHeight / 2
                );
                return { url: `https://${host}/pin/${m[1]}/`, score: r.width * r.height - dist * 2000 };
            }).filter(Boolean).sort((a, b) => b.score - a.score);
            if (candidates.length) return candidates[0].url;
        }
        return href.split('?')[0];
    }

    function markIn() {
        const v = getVideo();
        if (!v) return toast('No encontré el video.');
        const t = Math.floor(v.currentTime);
        if (outT != null && t >= outT) return toast('El inicio tiene que ser antes del fin.');
        inT = t; refresh();
    }
    function markOut() {
        const v = getVideo();
        if (!v) return toast('No encontré el video.');
        const t = Math.floor(v.currentTime);
        if (inT != null && t <= inT) return toast('El fin tiene que ser después del inicio.');
        outT = t; refresh();
    }

    function getClip() {
        if (!clipAllowed || isShortForm()) return null;
        if (currentMode !== 'video') return null;
        if (inT == null && outT == null) return null;
        const v = getVideo();
        const dur = v && isFinite(v.duration) ? Math.floor(v.duration) : null;
        const s = inT != null ? inT : 0;
        const e = outT != null ? outT : dur;
        return (e != null && e > s) ? { s, e } : null;
    }
    function resetClip() { inT = outT = null; refresh(); }

    async function addToQueue() {
        const url = getCleanUrl();
        if (!url) return toast(platform === 'tiktok' ? 'No pude detectar el TikTok visible.' : platform === 'instagram' ? 'No pude detectar el Reel visible.' : 'No se pudo detectar el enlace.');
        const q = await readQueueFresh();
        if (q.length >= MAX_QUEUE) return toast(`La cola está llena (${MAX_QUEUE}).`);
        const clip = getClip();
        if (q.some(i => i.url === url && i.s === (clip ? clip.s : undefined) && i.e === (clip ? clip.e : undefined))) {
            return toast('Ese contenido ya está en la cola.');
        }
        q.push({
            url,
            title: getTitle(),
            s: clip ? clip.s : undefined,
            e: clip ? clip.e : undefined,
            state: 'pending'
        });
        await saveQueue(q);
        toast(`Añadido a la cola (${q.length})` + (clip ? ` · ${fmt(clip.s)} → ${fmt(clip.e)}` : ''));
        resetClip();
        if (pop.classList.contains('show')) renderPop();
    }

    function launch(uri) {
        const a = document.createElement('a');
        a.href = uri;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
        toast('Abriendo IndieDL...');
    }

    async function download() {
        const url  = getCleanUrl();
        if (!url) return toast(platform === 'tiktok' ? 'No pude vincular este video de TikTok. Tocá «Copiar enlace» y reintentá.' : 'No pude detectar el enlace.');
        const mode = currentMode;
        const clip = getClip();
        const q    = await readQueueFresh();

        // Si es un solo video
        if (!q.length) {
            let uri = `ytdl://${mode}/?u=${encodeURIComponent(url)}`;
            if (clip) uri += `&s=${clip.s}&e=${clip.e}`;
            launch(uri);
            resetClip();
            return;
        }

        // Si es un lote (cola) - AHORA CON SOPORTE PARA RECORTES
        let items = q.slice();
        if (!items.some(i => i.url === url)) {
            items.push({ url, title: getTitle(), s: clip ? clip.s : undefined, e: clip ? clip.e : undefined, state: 'pending' });
        }
        const now = Date.now();
        items = items.slice(0, MAX_QUEUE).map((item, idx) => ({
            ...item,
            state: 'downloading',
            startedAt: now,
            estimatedDoneAt: now + (idx + 1) * 90000 // 90 segundos por elemento (pausa anti-bot)
        }));

        // Formato de URL con recortes: ytdl://batch/?u=URL1&t=T1&s=10&e=20...
        const uri = 'ytdl://batch/?' + items.map(i => {
            let param = `u=${encodeURIComponent(i.url)}&t=${encodeURIComponent(i.title || '')}`;
            if (i.s != null && i.e != null) {
                param += `&s=${i.s}&e=${i.e}`;
            }
            return param;
        }).join('&');
        
        launch(uri);
        await saveQueue(items);
        scheduleAutoComplete();
        resetClip();
        if (pop.classList.contains('show')) renderPop();
    }

    function closePop() {
        pop.classList.remove('show');
    }

    function renderPop() {
        const q = loadQueue();
        const clearBtn = el('button', { type: 'button', text: 'Vaciar', onclick: () => { saveQueue([]); renderPop(); refresh(); } });
        const doneBtn  = el('button', {
            type: 'button', text: 'Limpiar completados', style: 'margin-right:6px',
            onclick: () => {
                const cur = loadQueue().filter(i => i.state !== 'done');
                saveQueue(cur); renderPop(); refresh();
            }
        });
        const head = el('div', { className: 'head' }, el('span', { text: `Cola (${q.length})` }), el('div', {}, doneBtn, clearBtn));
        pop.replaceChildren(head);
        if (!q.length) { pop.appendChild(el('div', { className: 'empty', text: 'La cola está vacía.' })); return; }

        q.forEach((it, idx) => {
            const range = it.s != null ? `✂ ${fmt(it.s)} → ${fmt(it.e)}` : 'completo';
            const state = it.state || 'pending';
            const stateLabel = state === 'downloading' ? 'Descargando' : state === 'done' ? 'Listo' : state === 'error' ? 'Error' : null;
            const badge = stateLabel ? el('span', { className: `state ${state}`, text: stateLabel }) : null;
            const progress = state === 'downloading'
                ? el('div', { className: 'progress' }, el('div', { className: 'fill' }))
                : null;
            const x = el('button', {
                type: 'button', className: 'x', text: '✕', title: 'Quitar de la cola',
                onclick: async () => {
                    const cur = await readQueueFresh();
                    const found = cur.findIndex(c =>
                        c.url === it.url && c.s === it.s && c.e === it.e && (c.startedAt || 0) === (it.startedAt || 0));
                    if (found >= 0) cur.splice(found, 1); else cur.splice(idx, 1);
                    await saveQueue(cur); renderPop(); refresh();
                }
            });
            const row = el('div', { className: 'row' },
                el('div', { className: 't' }, el('b', { text: it.title || it.url }), el('small', { text: range })),
                badge, x
            );
            if (progress) row.appendChild(progress);
            pop.appendChild(row);
        });
    }

    function togglePop() {
        if (pop.classList.contains('show')) { closePop(); return; }
        
        renderPop();
        if (!document.body.contains(pop)) document.body.appendChild(pop);
        
        pop.classList.add('show');
        const popRect = pop.getBoundingClientRect();
        const r = bList.getBoundingClientRect();
        
        let top = r.bottom + 8;
        if (top + popRect.height > window.innerHeight - 8) {
            top = r.top - popRect.height - 8;
        }
        
        let left = r.left;
        if (left + popRect.width > window.innerWidth - 8) {
            left = window.innerWidth - popRect.width - 8;
        }
        
        pop.style.top = Math.max(8, top) + 'px';
        pop.style.left = Math.max(8, left) + 'px';
    }
    document.addEventListener('click', (e) => {
        if (!pop.contains(e.target) && !bar.contains(e.target)) pop.classList.remove('show');
    });
    window.addEventListener('scroll', closePop, { capture: true, passive: true });
    window.addEventListener('resize', closePop, { passive: true });

    function isVideoPage() {
        const { hostname: h, pathname: p } = window.location;
        if (h.includes('youtube.com'))   return p === '/watch' || p.startsWith('/shorts/');
        if (h.includes('instagram.com')) {
            return !/^\/(accounts|direct|challenge|emails|session)\//.test(p || '/');
        }
        if (h.includes('tiktok.com')) {
            if (p.startsWith('/search') || p.startsWith('/tag') || p.startsWith('/explore')) {
                return Array.from(document.querySelectorAll('video')).some(v => {
                    const r = v.getBoundingClientRect();
                    return r.width > 350 && r.height > 350 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
                });
            }
            return true;
        }
        return true;
    }

    function isImageOnlyInstagramPost() {
        if (platform !== 'instagram' || !location.pathname.startsWith('/p/')) return false;
        const postPath = location.pathname.replace(/\/$/, '');
        const postLink = Array.from(document.querySelectorAll('article a[href]')).find((link) => {
            try { return new URL(link.href).pathname.replace(/\/$/, '') === postPath; }
            catch (_) { return false; }
        });
        const post = postLink?.closest('article') || document.querySelector('article');
        if (!post) return false;
        const visible = (node) => {
            const r = node.getBoundingClientRect();
            return r.width > 150 && r.height > 150 && r.bottom > 0 && r.top < innerHeight &&
                r.right > 0 && r.left < innerWidth;
        };
        const hasVideo = Array.from(post.querySelectorAll('video')).some(visible);
        const hasImage = Array.from(post.querySelectorAll('img')).some((img) =>
            img.naturalWidth > 150 && visible(img)
        );
        return hasImage && !hasVideo;
    }

    let positionFrame = 0;
    let positionDebounce = 0;
    let shortsFrozen = false;
    let shortsFreezeTimer = 0;
    let lastShortsLeft = null;

    function isShortsPage() {
        return platform === 'youtube' && location.pathname.startsWith('/shorts/');
    }

    function shortsVideoRect() {
        let best = null, bestArea = 0;
        document.querySelectorAll('ytd-reel-video-renderer video, #shorts-container video').forEach((v) => {
            const r = v.getBoundingClientRect();
            if (r.width < 100 || r.height < 100 || r.bottom <= 0 || r.top >= innerHeight) return;
            const area = (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * r.width;
            if (area > bestArea) { bestArea = area; best = r; }
        });
        return best;
    }

    function tiktokActionsHorizontal(likeNode, lr) {
        if (likeNode && /^browse-/.test(likeNode.getAttribute('data-e2e') || '')) return true;
        const comment = Array.from(document.querySelectorAll(
            '[data-e2e="comment-icon"], [data-e2e="browse-comment-icon"], [data-e2e="video-comment-icon"]'
        )).find((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; });
        if (!comment) return false;
        const cr = comment.getBoundingClientRect();
        return Math.abs(cr.top - lr.top) < 24 && Math.abs(cr.left - lr.left) > 30;
    }
    function tiktokMediaRect(maxRight) {
        let best = null, bestArea = 0;
        document.querySelectorAll('video, img').forEach((n) => {
            if (n.closest('#indiedl-bar, #indiedl-pop')) return;
            const r = n.getBoundingClientRect();
            if (r.width < 200 || r.height < 200 || r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) return;
            if (r.right > maxRight + 4) return;
            const area = (Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
            if (area > bestArea) { bestArea = area; best = r; }
        });
        return best;
    }

    function freezeShorts(ms) {
        if (!isShortsPage()) return;
        shortsFrozen = true;
        clearTimeout(shortsFreezeTimer);
        shortsFreezeTimer = setTimeout(() => {
            shortsFrozen = false;
            scheduleShortBarPosition();
        }, ms || 450);
    }

    function positionShortBar() {
        if (!bar.classList.contains('tt-floating') && !bar.classList.contains('yt-shorts-floating') &&
            !bar.classList.contains('ig-floating') && !bar.classList.contains('pin-floating')) return;

        const isShorts = isShortsPage();
        const brd = bar.getBoundingClientRect();
        const w = brd.width || 42;
        const h = brd.height || 200;

        const placeAt = (left, top) => {
            if (isShorts) {
                const vr = shortsVideoRect();
                if (vr && left < vr.right - 2 && left + w > vr.left + 2) {
                    if (vr.right + 10 + w <= innerWidth - 8) left = vr.right + 10;
                    else if (vr.left - 10 - w >= 8) left = vr.left - 10 - w;
                    else if (lastShortsLeft !== null) left = lastShortsLeft;
                }
            }
            left = Math.max(8, Math.min(innerWidth - w - 8, left));
            top = Math.max(8, Math.min(innerHeight - h - 8, top));
            if (isShorts) lastShortsLeft = left;
            const first = !bar.classList.contains('positioned');
            if (first) bar.classList.remove('smooth');
            bar.style.setProperty('left', '0px', 'important');
            bar.style.setProperty('top', '0px', 'important');
            bar.style.setProperty('right', 'auto', 'important');
            bar.style.setProperty('bottom', 'auto', 'important');
            bar.style.setProperty(
                'transform',
                `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`,
                'important');
            bar.classList.add('positioned');
            if (first) {
                void bar.offsetWidth;
                requestAnimationFrame(() => bar.classList.add('smooth'));
            }
        };

        const isVisible = (node) => {
            if (!node || !node.getBoundingClientRect) return false;
            const r = node.getBoundingClientRect();
            const s = getComputedStyle(node);
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
                r.right > 0 && r.left < innerWidth && s.display !== 'none' && s.visibility !== 'hidden';
        };
        const controlOf = (node) => node.closest('button, [role="button"], a') || node;
        const unionRect = (nodes) => {
            let box = null;
            nodes.forEach((node) => {
                if (!node || !isVisible(node)) return;
                const r = node.getBoundingClientRect();
                if (!box) {
                    box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
                } else {
                    box.left = Math.min(box.left, r.left);
                    box.top = Math.min(box.top, r.top);
                    box.right = Math.max(box.right, r.right);
                    box.bottom = Math.max(box.bottom, r.bottom);
                }
            });
            return box;
        };
        const placeAboveGroup = (group, preferRight) => {
            if (!group) return false;
            const maxLeft = innerWidth - w - 8;
            let left = group.left;
            if (left > maxLeft) left = Math.max(8, group.right - w);
            left = Math.max(8, Math.min(maxLeft, left));
            const above = group.top - h - 8;
            if (above >= 8) { placeAt(left, above); return true; }
            const below = group.bottom + 8;
            if (below + h <= innerHeight - 8) { placeAt(left, below); return true; }
            const mid = group.top + (group.bottom - group.top - h) / 2;
            placeAt(preferRight ? group.right + 12 : group.left - w - 12, mid);
            return true;
        };

        if (platform === 'instagram') {
            let scope = document;
            if (location.pathname.startsWith('/p/')) {
                const postPath = location.pathname.replace(/\/$/, '');
                const postLink = Array.from(document.querySelectorAll('article a[href]')).find((link) => {
                    try { return new URL(link.href).pathname.replace(/\/$/, '') === postPath; }
                    catch (_) { return false; }
                });
                scope = postLink?.closest('article') || document.querySelector('article') || document;
            } else {
                const video = Array.from(document.querySelectorAll('video'))
                    .filter(isVisible)
                    .sort((a, b) => {
                        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
                        return rb.width * rb.height - ra.width * ra.height;
                    })[0];
                if (video) scope = video.closest('article') || video.parentElement || document;
            }

            const likeSelector = 'svg[aria-label="Like"], svg[aria-label="Me gusta"], ' +
                'svg[aria-label="Unlike"], svg[aria-label="Ya no me gusta"]';
            const actionRe = /^(like|me gusta|unlike|ya no me gusta|comment|comentar|share|compartir|save|guardar)/i;
            const actionInfo = (() => {
                const likes = Array.from(scope.querySelectorAll(likeSelector)).filter(isVisible);
                for (const like of likes) {
                    let node = like;
                    for (let depth = 0; node && node !== scope && depth < 8; depth++, node = node.parentElement) {
                        const share = Array.from(node.querySelectorAll('svg[aria-label]'))
                            .find((svg) => /^(share|compartir|save|guardar)/i.test(svg.getAttribute('aria-label') || ''));
                        if (!share) continue;
                        const controls = new Set([controlOf(like)]);
                        node.querySelectorAll('svg[aria-label]').forEach((svg) => {
                            if (actionRe.test(svg.getAttribute('aria-label') || '')) controls.add(controlOf(svg));
                        });
                        return { like: controlOf(like), group: unionRect([...controls]) };
                    }
                }
                const like = likes[0];
                if (!like) return null;
                return { like: controlOf(like), group: unionRect([controlOf(like)]) };
            })();

            if (actionInfo) {
                console.info('[IndieDL] IG actionInfo ok');
                const { like, group } = actionInfo;
                if (group && group.right - group.left > (group.bottom - group.top) * 1.4) {
                    // Fila horizontal (post): justo encima de like/comentar/compartir/guardar.
                    if (placeAboveGroup(group, true)) return;
                } else if (like) {
                    // Columna vertical (reel): al costado (izquierda) de la barra de acciones nativa.
                    const lr = like.getBoundingClientRect();
                    console.info('[IndieDL] IG reel like rect', lr);
                    const left = lr.left - w - 10;
                    if (left >= 8) {
                        placeAt(left, lr.top);
                        return;
                    }
                    const rightLeft = lr.right + 10;
                    if (rightLeft + w <= innerWidth - 8) { placeAt(rightLeft, lr.top); return; }
                    if (placeAboveGroup(group || { left: lr.left, top: lr.top, right: lr.right, bottom: lr.bottom }, true)) return;
                }
            }
        }

        if (platform === 'pinterest') {
            const pinImage = Array.from(document.querySelectorAll('img'))
                .filter((img) => !img.closest('#indiedl-bar, #indiedl-pop') && isVisible(img))
                .map((img) => ({ img, r: img.getBoundingClientRect() }))
                .filter(({ r }) => r.width > 200 && r.height > 200)
                .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
            const pinActionRe = /save|guardar|share|compartir|react|reaccion|like|me gusta|more|más|download|descargar/i;
            const controls = Array.from(document.querySelectorAll('button, [role="button"]'))
                .filter((node) => !node.closest('#indiedl-bar, #indiedl-pop') && isVisible(node) &&
                    pinActionRe.test((node.getAttribute('aria-label') || '') + ' ' + (node.getAttribute('title') || '')))
                .filter((node) => {
                    if (!pinImage) return false;
                    const r = node.getBoundingClientRect();
                    return r.left >= pinImage.r.left - 120 && r.left <= pinImage.r.right + 420 &&
                        r.top >= pinImage.r.top - 40 && r.top <= pinImage.r.bottom + 280;
                });
            const group = unionRect(controls);
            if (group && placeAboveGroup(group, true)) return;
            if (pinImage) {
                const ir = pinImage.r;
                const left = ir.right + 14 + w <= innerWidth - 8 ? ir.right + 14 : ir.left - w - 14;
                placeAt(left, Math.max(8, ir.top + 24));
                return;
            }
        }

        let likeBtn = null;
        let tiktokLikeNode = null;
        if (platform === 'youtube') {
            const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]') ||
                document.querySelector('ytd-reel-video-renderer') || document;
            const youtubeLikes = Array.from(activeReel.querySelectorAll(
                '#like-button, ytd-reel-player-overlay-renderer [aria-label*="Me gusta"], ' +
                'ytd-reel-player-overlay-renderer [aria-label*="Like"], ' +
                'ytd-reel-player-overlay-renderer button[aria-label*="like" i], ' +
                'ytd-reel-player-overlay-renderer [role="button"][aria-label*="like" i]'
            ));
            likeBtn = youtubeLikes.find(node => {
                const r = node.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
                    r.right > innerWidth * 0.55;
            }) || Array.from(document.querySelectorAll(
                '#like-button, [aria-label*="Me gusta"], [aria-label*="Like"]'
            )).find(node => {
                const r = node.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
                    r.right > innerWidth * 0.55;
            });
            if (likeBtn && likeBtn.tagName !== 'BUTTON') {
                likeBtn = likeBtn.querySelector('button') || likeBtn;
            }
            if (!likeBtn) {
                const fb = Array.from(document.querySelectorAll('button, [role="button"], [aria-label]'))
                    .map(n => ({ n, r: n.getBoundingClientRect() }))
                    .filter(x => x.r.width > 0 && x.r.height > 0 && x.r.bottom > 0 && x.r.top < innerHeight &&
                                 x.r.right > innerWidth * 0.55 &&
                                 /like|me gusta/i.test((x.n.getAttribute('aria-label') || x.n.textContent || '')))
                    .sort((a, b) => a.r.top - b.r.top)[0];
                if (fb) { likeBtn = fb.n; console.warn('[IndieDL] YT Shorts: usando fallback de Like'); }
                else { console.warn('[IndieDL] YT Shorts: no se encontro boton Like; candidatos=', document.querySelectorAll('[aria-label*="ike"]').length); }
            } else {
                console.info('[IndieDL] YT Shorts: like encontrado');
            }

        } else if (platform === 'tiktok') {
            const likeCandidates = Array.from(document.querySelectorAll(
                '[data-e2e="like-icon"], [data-e2e="browse-like-icon"], [data-e2e="video-like-icon"]'
            ));
            const likeIcon = likeCandidates.find(node => {
                const r = node.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
                    r.right > innerWidth * 0.55;
            });
            if (likeIcon) { tiktokLikeNode = likeIcon; likeBtn = likeIcon.closest('button, div[role="button"]') || likeIcon; }
            if (!likeBtn) {
                const fb = Array.from(document.querySelectorAll('button, [role="button"], [aria-label], div[data-e2e]'))
                    .map(n => ({ n, r: n.getBoundingClientRect() }))
                    .filter(x => x.r.width > 0 && x.r.height > 0 && x.r.bottom > 0 && x.r.top < innerHeight &&
                                 x.r.right > innerWidth * 0.55 &&
                                 /like|me gusta/i.test((x.n.getAttribute('aria-label') || x.n.getAttribute('data-e2e') || x.n.textContent || '')))
                    .sort((a, b) => a.r.top - b.r.top)[0];
                if (fb) { likeBtn = fb.n; tiktokLikeNode = fb.n; console.warn('[IndieDL] TikTok: usando fallback de Like'); }
                else { console.warn('[IndieDL] TikTok: no se encontro boton Like; like-icon candidates=', likeCandidates.length); }
            } else {
                console.info('[IndieDL] TikTok: like encontrado');
            }
        }

        if (likeBtn) {
            const lr = likeBtn.getBoundingClientRect();
            if (lr.width > 0 && lr.height > 0) {
                let left, top;
                if (platform === 'instagram') {
                    left = lr.left - w - 10;
                    top = lr.top + (lr.height - h) / 2;
                } else if (platform === 'youtube' && location.pathname.startsWith('/shorts/')) {
                    console.info('[IndieDL] YT Shorts like rect', lr);
                    left = lr.left - w - 10;
                    if (left < 8) { left = lr.right + 10; }
                    top = lr.top;
                } else if (platform === 'tiktok' && tiktokActionsHorizontal(tiktokLikeNode, lr)) {
                    const media = tiktokMediaRect(lr.left);
                    left = media ? media.left - w - 14 : 12;
                    if (media && left < 8 && lr.left - media.right >= w + 40) left = media.right + 14;
                    top = innerHeight / 2 - h / 2;
                } else if (platform === 'tiktok') {
                    console.info('[IndieDL] TikTok like rect', lr);
                    left = lr.left - w - 10;
                    if (left < 8) { left = lr.right + 10; }
                    top = lr.top;
                } else {
                    left = lr.left + (lr.width - w) / 2;
                    top = lr.top - h - 8;
                }
                placeAt(left, top);
                return;
            }
        }

        const activeShort = platform === 'youtube'
            ? (document.querySelector('ytd-reel-video-renderer[is-active]') || document.querySelector('ytd-reel-video-renderer'))
            : null;
        let video = activeShort?.querySelector('video') || document.querySelector('video');
        if (video) {
            const vr = video.getBoundingClientRect();
            if (vr.width > 100 && vr.height > 100) {
                let left = vr.right - w - 10;
                let top = vr.top + (vr.height - h) / 2;
                if (platform === 'youtube' && location.pathname.startsWith('/shorts/')) {
                    const actionsTop = vr.top + vr.height * 0.50;
                    left = innerWidth - vr.right >= w + 8 ? vr.right + 5 : vr.right - w - 5;
                    top = actionsTop - h - 8;
                } else if (platform === 'tiktok') {
                    left = vr.right - w - 5;
                    top = vr.top + vr.height * 0.50 - h - 8;
                }
                placeAt(left, top);
                return;
            }
        }

        if (platform === 'tiktok') {
            const media = tiktokMediaRect(innerWidth * 0.75);
            placeAt(media ? media.left - w - 14 : 12, innerHeight / 2 - h / 2);
            return;
        }

        if (platform === 'youtube' && location.pathname.startsWith('/shorts/')) {
            const renderer = activeShort?.getBoundingClientRect();
            if (renderer && renderer.width > 100 && renderer.height > 100) {
                const actionsTop = renderer.top + renderer.height * 0.50;
                const left = innerWidth - renderer.right >= w + 8 ? renderer.right + 5 : renderer.right - w - 5;
                placeAt(left, actionsTop - h - 8);
            } else {
                placeAt(innerWidth * 0.72, innerHeight * 0.50 - h - 8);
            }
        }
    }

    function scheduleShortBarPosition(debounceMs) {
        if (!bar.classList.contains('tt-floating') && !bar.classList.contains('yt-shorts-floating') &&
            !bar.classList.contains('ig-floating') && !bar.classList.contains('pin-floating')) return;
        if (positionFrame) return;

        if (debounceMs && debounceMs > 0) {
            clearTimeout(positionDebounce);
            positionDebounce = setTimeout(() => {
                positionDebounce = 0;
                positionFrame = requestAnimationFrame(() => {
                    positionFrame = 0;
                    positionShortBar();
                });
            }, debounceMs);
            return;
        }

        positionFrame = requestAnimationFrame(() => {
            positionFrame = 0;
            positionShortBar();
        });
    }

    let mountFrame = 0;
    function scheduleMount() {
        if (mountFrame) return;
        mountFrame = requestAnimationFrame(() => {
            mountFrame = 0;
            mount();
        });
    }

    let ytHostCache = null;
    function getYtHost() {
        if (ytHostCache && ytHostCache.isConnected && bar.parentElement === ytHostCache) {
            return ytHostCache;
        }
        if (ytHostCache && ytHostCache.isConnected) return ytHostCache;
        ytHostCache = pickVisibleHost(YT_HOSTS);
        return ytHostCache;
    }

    function pickVisibleHost(selectors) {
        for (const sel of selectors) {
            for (const n of document.querySelectorAll(sel)) {
                if (isUsableHost(n)) return n;
            }
        }
        return null;
    }
    function isUsableHost(n) {
        if (!n || !n.isConnected || n.closest('[hidden]')) return false;
        if (n.getClientRects().length > 0) return true;
        return !!(n.parentElement && n.parentElement.getClientRects().length > 0);
    }

    if (typeof MutationObserver !== 'undefined') {
        let ytMutationPending = false;
        const pageObserver = new MutationObserver((records) => {
            if (platform === 'youtube') {
                const ytUrlChanged = (curUrl !== window.location.href);
                if (location.pathname === '/watch' && (!bar.isConnected || ytUrlChanged)) {
                    if (!ytMutationPending) {
                        ytMutationPending = true;
                        curUrl = null;
                        scheduleMount();
                        setTimeout(() => { ytMutationPending = false; }, 100);
                    }
                }
                return;
            }
            const pageChanged = records.some(record => {
                const target = record.target;
                if (target === bar || (target.nodeType === 1 && bar.contains(target))) return false;
                const changedNodes = [...record.addedNodes, ...record.removedNodes];
                return changedNodes.some(node =>
                    node !== bar && !(node.nodeType === 1 && (node.id === 'indiedl-bar' || node.id === 'indiedl-pop' || node.id === 'indiedl-toast'))
                );
            });
            if (!pageChanged) return;

            if (platform === 'instagram' || platform === 'tiktok' || platform === 'pinterest') {
                scheduleMount();
                scheduleShortBarPosition(200);
            }
        });
        const observeRoot = document.documentElement;
        if (observeRoot) pageObserver.observe(observeRoot, { childList: true, subtree: true });
    }

    let remountTimers = [];
    function remountSoon() {
        ytWaitSince = 0;
        remountTimers.forEach(clearTimeout);
        remountTimers = [0, 150, 400, 900, 1800, 3000].map((ms) => setTimeout(() => {
            if (document.hidden) return;
            if (bar.isConnected && bar.classList.contains('ready') && curUrl === window.location.href) return;
            curUrl = null;
            mount();
        }, ms));
    }

    const YT_HOSTS = [
        'ytd-watch-metadata #top-level-buttons-computed',
        'ytd-watch-metadata #actions',
        '#actions #top-level-buttons-computed',
        '#actions',
        '#menu-container'
    ];

    let ytWaitSince = 0;
    function ytGiveUp() {
        if (barLikelyVisible()) { ytWaitSince = 0; return false; }
        if (!ytWaitSince) ytWaitSince = Date.now();
        return Date.now() - ytWaitSince > 300;
    }

    function floatBar(currentUrl) {
        if (bar.parentElement !== document.body) document.body.appendChild(bar);
        bar.classList.remove('hidden', 'ig-reel', 'ig-inline', 'ig-icons', 'ig-post', 'compact', 'tt-floating', 'yt-shorts-floating', 'ig-floating', 'pin-floating');
        bar.classList.add('floating', 'ready');
        resetBarTransform();
        curUrl = currentUrl;
        refresh();
        observeBar();
    }

    function resetBarTransform() {
        for (const prop of ['transform', 'left', 'top', 'right', 'bottom']) {
            bar.style.removeProperty(prop);
        }
    }

    function mount() {
        if (document.hidden || !document.body) return;

        const currentUrl = window.location.href;
        const videoPage = isVideoPage();
        bar.classList.toggle('hidden', !videoPage);

        if (!videoPage) {
            bar.classList.remove(
                'ready', 'positioned', 'floating', 'ig-floating', 'ig-icons', 'ig-reel', 'ig-post',
                'ig-inline', 'compact', 'pin-floating', 'tt-floating', 'yt-shorts-floating'
            );
            resetBarTransform();
            bar.classList.add('hidden');
            curUrl = currentUrl;
            return;
        }

        if (platform === 'instagram' && location.pathname.startsWith('/p/') &&
            autoImageModeUrl !== currentUrl && isImageOnlyInstagramPost()) {
            currentMode = 'image';
            autoImageModeUrl = currentUrl;
            refresh();
        }

        const needsVisibleHost = platform === 'youtube' && location.pathname === '/watch';
        if (curUrl === currentUrl && bar.classList.contains('ready') && bar.isConnected) {
            if (!needsVisibleHost) return;
            // Si estamos flotando pero ya apareció el host nativo, re-montar para anclar.
            if (bar.classList.contains('floating') && getYtHost()) {
                // continuar (no return) para anclar al host
            } else if (barLikelyVisible() && !bar.classList.contains('floating')) {
                return;
            }
        }

        let host = null;
        let isIG = false;
        let igIsReel = false;

        if (platform === 'youtube' && location.pathname.startsWith('/shorts/')) {
            if (bar.parentElement !== document.body) document.body.appendChild(bar);
            bar.classList.remove('hidden');
            bar.classList.remove('floating', 'ig-reel', 'ig-inline', 'ig-icons', 'ig-post', 'pin-floating', 'tt-floating', 'ig-floating');
            bar.classList.add('yt-shorts-floating', 'compact', 'ready');
            curUrl = currentUrl;
            refresh();
            scheduleShortBarPosition();
            observeBar();
            return;
        } else if (platform === 'youtube' && location.pathname === '/watch') {
            host = getYtHost();
        } else if (platform === 'instagram') {
            igIsReel = location.pathname.includes('/reel/') || location.pathname.includes('/reels/');
            const modalOpen = isInstagramModalOpen();
            // Vista de cuadrícula/feed/perfil sin modal: ocultar por completo.
            if (isInstagramGridOrFeed() && !modalOpen && !igIsReel && !location.pathname.includes('/p/')) {
                bar.classList.add('hidden');
                bar.classList.remove('ready', 'positioned', 'floating', 'ig-floating', 'ig-icons', 'ig-reel', 'ig-inline', 'ig-post', 'compact', 'tt-floating', 'yt-shorts-floating', 'pin-floating');
                resetBarTransform();
                curUrl = currentUrl;
                return;
            }
            if (igIsReel || location.pathname.includes('/p/') || modalOpen) {
                if (bar.parentElement !== document.body) document.body.appendChild(bar);
                bar.classList.remove('hidden');
                bar.classList.remove('floating', 'tt-floating', 'yt-shorts-floating', 'pin-floating', 'ig-reel', 'ig-inline');
                bar.classList.add('ig-floating', 'ig-icons', 'compact', 'ready');
                if (igIsReel || location.pathname.includes('/p/')) bar.classList.remove('ig-post');
                else bar.classList.add('ig-post');
                curUrl = currentUrl;
                refresh();
                scheduleShortBarPosition();
                observeBar();
                return;
            }
        }

        if (host) {
            if (bar.parentElement !== host) {
                if (isIG && igIsReel) host.insertBefore(bar, host.firstChild);
                else host.appendChild(bar);
            }
            bar.classList.remove('floating');
            resetBarTransform();
            bar.classList.add('ready');
            if (isIG) {
                bar.classList.add('ig-icons');
                if (igIsReel) { bar.classList.add('ig-reel'); bar.classList.remove('ig-inline'); }
                else          { bar.classList.add('ig-inline'); bar.classList.remove('ig-reel'); }
            } else {
                bar.classList.remove('ig-reel', 'ig-inline', 'ig-icons', 'ig-post', 'compact', 'pin-floating', 'tt-floating', 'yt-shorts-floating', 'ig-floating');
            }
            curUrl = currentUrl;
            refresh();
            observeBar();
        } else {
            if (platform === 'youtube' && location.pathname === '/watch') {
                if (ytGiveUp()) floatBar(currentUrl); else bar.classList.remove('ready');
            } else {
                if (bar.parentElement !== document.body) document.body.appendChild(bar);
                bar.classList.remove('ig-reel', 'ig-inline', 'ig-icons', 'ig-post', 'compact', 'pin-floating');
                if (platform === 'tiktok') {
                    bar.classList.remove('hidden');
                    bar.classList.remove('floating', 'yt-shorts-floating');
                    bar.classList.add('tt-floating', 'compact');
                } else if (platform === 'pinterest' && location.pathname.startsWith('/pin/')) {
                    bar.classList.remove('hidden', 'floating', 'tt-floating', 'yt-shorts-floating');
                    bar.classList.add('pin-floating', 'compact');
                } else {
                    bar.classList.remove('tt-floating', 'yt-shorts-floating');
                    bar.classList.add('floating');
                    resetBarTransform();
                }
                bar.classList.add('ready');
                curUrl = currentUrl;
                refresh();
                if (platform === 'tiktok' || bar.classList.contains('pin-floating')) scheduleShortBarPosition();
                observeBar();
            }
        }
    }

    let initialRetryActive = false;
    function startInitialRetry(maxAttempts = 20) {
        if (initialRetryActive) return;
        initialRetryActive = true;
        let attempts = 0;
        const tick = () => {
            if (document.hidden) { initialRetryActive = false; return; }
            if (bar.isConnected && bar.classList.contains('ready') && curUrl === window.location.href) {
                initialRetryActive = false;
                return;
            }
            if (++attempts >= maxAttempts) { initialRetryActive = false; return; }
            curUrl = null;
            mount();
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(tick, { timeout: 250 });
            } else {
                setTimeout(tick, 150);
            }
        };
        tick();
    }

    function bootMounted() {
        if (!document.body) { setTimeout(bootMounted, 50); return; }
        mount();
        startInitialRetry();
    }

    queueReady.then(() => {
        refresh();
        bootMounted();
    });

    setInterval(() => {
        if (document.hidden) return;
        if (bar.isConnected && bar.classList.contains('ready') && curUrl === window.location.href) return;
        mount();
    }, 1500);

    window.addEventListener('resize', scheduleShortBarPosition, { passive: true });
    window.addEventListener('scroll', scheduleShortBarPosition, { passive: true, capture: true });
    document.addEventListener('visibilitychange', scheduleShortBarPosition);

    window.addEventListener('scroll', () => {
        if (platform === 'instagram' || platform === 'pinterest') {
            scheduleMount();
            scheduleShortBarPosition(150);
        }
    }, { passive: true, capture: true });

    window.addEventListener('yt-navigate-start', () => { bar.classList.remove('ready'); curUrl = null; freezeShorts(600); });
    window.addEventListener('yt-navigate-finish', () => { curUrl = null; mount(); remountSoon(); freezeShorts(450); });
    window.addEventListener('yt-page-data-updated', () => { curUrl = null; mount(); remountSoon(); });
    window.addEventListener('pageshow', () => { curUrl = null; remountSoon(); scheduleShortBarPosition(); });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { curUrl = null; remountSoon(); }
    });

    window.addEventListener('wheel', () => freezeShorts(450), { passive: true, capture: true });
    window.addEventListener('touchmove', () => freezeShorts(450), { passive: true, capture: true });
    window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) freezeShorts(450);
    }, true);
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('#navigation-button-up, #navigation-button-down')) freezeShorts(650);
    }, true);

    try {
        if (window.navigation && window.navigation.addEventListener) {
            window.navigation.addEventListener('navigatesuccess', () => { curUrl = null; scheduleMount(); remountSoon(); });
        }
    } catch (_) {}

    const pushState = history.pushState;
    history.pushState = function() {
        pushState.apply(history, arguments);
        curUrl = null;
        freezeShorts(450);
        setTimeout(() => { mount(); scheduleShortBarPosition(); }, 100);
        remountSoon();
    };
    const replaceState = history.replaceState;
    history.replaceState = function() {
        replaceState.apply(history, arguments);
        curUrl = null;
        setTimeout(() => { mount(); scheduleShortBarPosition(); }, 100);
    };
    window.addEventListener('popstate', () => { curUrl = null; freezeShorts(450); setTimeout(() => { mount(); scheduleShortBarPosition(); }, 100); remountSoon(); });

    if (platform === 'youtube') {
        window.addEventListener('yt-navigate-finish', () => {
            console.info('[IndieDL] yt-navigate-finish');
            curUrl = null;
            ytHostCache = null;
            setTimeout(() => { mount(); scheduleShortBarPosition(); }, 50);
            remountSoon();
        });
        window.addEventListener('yt-navigate-start', () => {
            curUrl = null;
        });
    }

    window.__indiedlDebug = function () {
        try {
            const bar = document.querySelector('#indiedl-bar');
            const br = bar ? bar.getBoundingClientRect() : null;
            let anchor = null;
            if (location.hostname.includes('instagram')) {
                anchor = document.querySelector('svg[aria-label="Like"], svg[aria-label="Me gusta"]');
            } else if (location.hostname.includes('tiktok')) {
                anchor = document.querySelector('[data-e2e="like-icon"]');
            } else if (location.pathname.startsWith('/shorts/')) {
                anchor = document.querySelector('#like-button, [aria-label*="Like"], [aria-label*="Me gusta"]');
            }
            const ar = anchor ? (anchor.closest('button,[role="button"]') || anchor).getBoundingClientRect() : null;
            console.table({ bar: br, anchor: ar });
            if (br && ar) {
                console.log('dx (bar.left - anchor.right):', Math.round(br.left - ar.right));
                console.log('dy (bar.top - anchor.top):', Math.round(br.top - ar.top));
                console.log('positioned:', bar.classList.contains('positioned'));
            }
            return { bar: br, anchor: ar };
        } catch (e) { console.error(e); }
    };
    console.info('[IndieDL] Debug disponible: ejecutá __indiedlDebug() en la consola.');

    bootMounted();
})();