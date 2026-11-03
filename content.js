// FarsiFix – content script
(() => {
  'use strict';
  if (window.__farsifixLoaded) return;
  window.__farsifixLoaded = true;

  const { convertLayout, looksLikeMistypedPersian } = FarsiFixLib;

  /* ---------- تنظیمات ---------- */
  const DEFAULTS = { source: 'en', target: 'fa', autoDetect: true };
  const settings = { ...DEFAULTS };
  try {
    chrome.storage.sync.get(DEFAULTS, (s) => Object.assign(settings, s));
    chrome.storage.onChanged.addListener((changes) => {
      for (const k in changes) settings[k] = changes[k].newValue;
    });
  } catch (_) {}

  const RTL_LANGS = new Set(['fa', 'ar', 'ur', 'he']);

  /* ---------- کارت شناور (Shadow DOM تا استایل سایت قاطی نشه) ---------- */
  let host, root, card, cardKind = null;

  const CSS = `
    .card{position:fixed;min-width:220px;max-width:min(380px,calc(100vw - 16px));
      background:#1d2330;color:#eef1f6;border:1px solid rgba(255,255,255,.1);
      border-radius:12px;padding:12px 14px;box-shadow:0 10px 32px rgba(0,0,0,.35);
      font:14px/1.7 Vazirmatn,Tahoma,"Segoe UI",system-ui,sans-serif;}
    .card[hidden]{display:none}
    .title{font-size:12px;opacity:.7;margin-bottom:6px}
    .body{background:rgba(255,255,255,.08);border-radius:8px;padding:8px 10px;margin-bottom:10px;
      white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;font-size:15px}
    .actions{display:flex;gap:8px;flex-wrap:wrap}
    button{cursor:pointer;border:0;border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;
      background:rgba(255,255,255,.14);color:inherit}
    button:hover{background:rgba(255,255,255,.22)}
    button.primary{background:#3d7bf5;color:#fff}
    button.primary:hover{background:#5a91ff}
    button:focus-visible{outline:2px solid #9cc0ff;outline-offset:2px}`;

  function ensureUI() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;z-index:2147483647;';
    root = host.attachShadow({ mode: 'closed' });

    // نکته: innerHTML استفاده نمی‌کنیم؛ سایت‌هایی با Trusted Types / CSP سخت‌گیر
    // (گوگل، یوتیوب، جی‌میل، گیت‌هاب و...) اون رو بلاک می‌کنن و کل UI می‌پره.
    let styled = false;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
      styled = true;
    } catch (_) {}
    if (!styled) {
      const st = document.createElement('style');
      st.textContent = CSS;
      root.appendChild(st);
    }

    card = document.createElement('div');
    card.className = 'card';
    card.dir = 'rtl';
    card.hidden = true;
    root.appendChild(card);

    (document.documentElement || document.body).appendChild(host);
    // کلیک روی کارت فوکوس فیلد متن رو نگیره
    card.addEventListener('mousedown', (e) => e.preventDefault());
  }

  const mk = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function showCard({ kind, rect, title, body, bodyDir = 'rtl', actions = [] }) {
    ensureUI();
    cardKind = kind;
    card.textContent = '';
    card.appendChild(mk('div', 'title', title));
    const b = mk('div', 'body', body);
    b.dir = bodyDir;
    card.appendChild(b);
    const row = mk('div', 'actions');
    for (const a of actions) {
      const btn = mk('button', a.primary ? 'primary' : '', a.label);
      btn.type = 'button';
      btn.addEventListener('click', () => a.onClick(btn));
      row.appendChild(btn);
    }
    card.appendChild(row);
    card.hidden = false;
    place(rect);
  }

  function place(rect) {
    const r = rect && (rect.width || rect.height)
      ? rect
      : { top: innerHeight / 3, bottom: innerHeight / 3, left: innerWidth / 3, width: 0, height: 0 };
    const w = card.offsetWidth, h = card.offsetHeight;
    let top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
    let left = Math.min(Math.max(8, r.left), Math.max(8, innerWidth - w - 8));
    card.style.top = top + 'px';
    card.style.left = left + 'px';
  }

  function hideCard(onlyKind) {
    if (!card || card.hidden) return;
    if (onlyKind && cardKind !== onlyKind) return;
    card.hidden = true;
    cardKind = null;
  }

  document.addEventListener('mousedown', (e) => {
    if (host && e.composedPath().includes(host)) return;
    hideCard();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCard();
  }, true);

  /* ---------- جایگزینی متن ---------- */
  function setFieldText(el, text) {
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const sel = getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      if (!document.execCommand('insertText', false, text)) el.textContent = text;
    }
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
  }

  /* ---------- بخش ۱: تشخیص متن ناخوانا و پیشنهاد تبدیل ---------- */
  let timer = null, dismissedText = '';

  function isCandidate(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
    if (el.tagName === 'INPUT') return ['text', 'search', 'email', 'url', ''].includes(el.type) && !el.readOnly && !el.disabled;
    if (el.isContentEditable) return !el.closest('.monaco-editor,.CodeMirror,.cm-editor,.ace_editor');
    return false;
  }

  const getFieldText = (el) =>
    ('value' in el ? el.value : el.innerText || '').replace(/\u00a0/g, ' ').trim();

  document.addEventListener('input', (e) => {
    if (!settings.autoDetect) return;
    const path = e.composedPath ? e.composedPath() : [];
    const el = path[0] || e.target;
    if (!isCandidate(el)) return;
    clearTimeout(timer);
    hideCard('suggest');
    timer = setTimeout(() => { try { check(el); } catch (err) { console.warn('FarsiFix:', err); } }, 700);
  }, true);

  function check(el) {
    if (!el.isConnected) return;
    const text = getFieldText(el);
    if (!text || text === dismissedText || !looksLikeMistypedPersian(text)) return;
    const converted = convertLayout(text);
    showCard({
      kind: 'suggest',
      rect: el.getBoundingClientRect(),
      title: 'انگار فارسی رو با کیبورد انگلیسی تایپ کردی. تبدیل کنم؟',
      body: converted,
      actions: [
        { label: 'تبدیل به فارسی', primary: true, onClick: () => { setFieldText(el, converted); hideCard(); } },
        { label: 'نه، همینه', onClick: () => { dismissedText = text; hideCard(); } }
      ]
    });
  }

  /* ---------- بخش ۲: ترجمه متن انتخاب‌شده (میانبر) ---------- */
  function getSelectionInfo() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    if (a && (a instanceof HTMLTextAreaElement || a instanceof HTMLInputElement)) {
      try {
        const s = a.selectionStart, e = a.selectionEnd;
        if (s != null && s !== e) {
          return { text: a.value.slice(s, e), field: a, start: s, end: e, rect: a.getBoundingClientRect() };
        }
      } catch (_) {}
    }
    const sel = getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      const range = sel.getRangeAt(0).cloneRange();
      const editable = a && a.isContentEditable ? a : null;
      return { text: sel.toString(), range, editable, rect: range.getBoundingClientRect() };
    }
    return null;
  }

  const mostlyArabicScript = (t) => {
    const letters = t.match(/\p{L}/gu) || [];
    if (!letters.length) return false;
    const ar = letters.filter((c) => /[\u0600-\u06FF\u0750-\u077F]/.test(c)).length;
    return ar / letters.length > 0.5;
  };

  function replaceSelection(info, text) {
    if (info.field) {
      info.field.focus();
      info.field.setRangeText(text, info.start, info.end, 'end');
      info.field.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (info.editable) {
      info.editable.focus();
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(info.range);
      document.execCommand('insertText', false, text);
    }
  }

  function translateSelection() {
    const info = getSelectionInfo();
    if (!info) return;

    // متن انتخاب‌شده فارسیِ غلط‌تایپ‌شده است؟ به‌جای ترجمه، تبدیل کیبورد پیشنهاد بده
    if (looksLikeMistypedPersian(info.text)) {
      const converted = convertLayout(info.text.trim());
      const actions = [];
      if (info.field || info.editable) {
        actions.push({ label: 'جایگزین متن', primary: true, onClick: () => { replaceSelection(info, converted); hideCard(); } });
      }
      actions.push({ label: 'کپی', primary: !actions.length, onClick: async (btn) => { await copyText(converted); btn.textContent = 'کپی شد ✓'; } });
      actions.push({ label: 'بستن', onClick: () => hideCard() });
      showCard({ kind: 'translate', rect: info.rect, title: 'این متن فارسیِ تایپ‌شده با کیبورد انگلیسیه:', body: converted, actions });
      return;
    }

    let sl = settings.source, tl = settings.target;
    // اگر متن انتخاب‌شده خودش فارسی/عربی بود، جهت ترجمه برعکس می‌شود
    if (RTL_LANGS.has(tl) && mostlyArabicScript(info.text)) {
      const back = sl === 'auto' || sl === tl ? 'en' : sl;
      sl = tl; tl = back;
    }

    showCard({ kind: 'translate', rect: info.rect, title: 'در حال ترجمه…', body: '…',
      actions: [{ label: 'بستن', onClick: () => hideCard() }] });

    chrome.runtime.sendMessage({ type: 'TRANSLATE', text: info.text, source: sl, target: tl }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        showCard({ kind: 'translate', rect: info.rect, title: 'ترجمه انجام نشد',
          body: (res && res.error) || 'اتصال اینترنت رو چک کن و دوباره امتحان کن.',
          actions: [{ label: 'بستن', onClick: () => hideCard() }] });
        return;
      }
      const actions = [
        { label: 'کپی', primary: true, onClick: async (btn) => { await copyText(res.text); btn.textContent = 'کپی شد ✓'; } }
      ];
      if (info.field || info.editable) {
        actions.push({ label: 'جایگزین متن', onClick: () => { replaceSelection(info, res.text); hideCard(); } });
      }
      actions.push({ label: 'بستن', onClick: () => hideCard() });
      showCard({
        kind: 'translate', rect: info.rect,
        title: `ترجمه (${res.detected && sl === 'auto' ? res.detected : sl} ← ${tl})`,
        body: res.text,
        bodyDir: RTL_LANGS.has(tl) ? 'rtl' : 'ltr',
        actions
      });
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'TRANSLATE_SELECTION') translateSelection();
  });
})();
