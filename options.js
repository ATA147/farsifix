const DEFAULTS = { source: 'en', target: 'fa', autoDetect: true };
const LANGS = [
  ['en', 'English – انگلیسی'], ['fa', 'فارسی'], ['ar', 'العربية – عربی'], ['tr', 'Türkçe – ترکی'],
  ['de', 'Deutsch – آلمانی'], ['fr', 'Français – فرانسوی'], ['es', 'Español – اسپانیایی'],
  ['it', 'Italiano – ایتالیایی'], ['ru', 'Русский – روسی'], ['pt', 'Português – پرتغالی'],
  ['nl', 'Nederlands – هلندی'], ['zh-CN', '中文 – چینی'], ['ja', '日本語 – ژاپنی'], ['ko', '한국어 – کره‌ای'],
  ['hi', 'हिन्दी – هندی'], ['ur', 'اردو'], ['he', 'עברית – عبری']
];

const $ = (id) => document.getElementById(id);
const src = $('source'), tgt = $('target'), auto = $('autoDetect'), saved = $('saved');

function fill(select, withAuto) {
  select.textContent = '';
  const list = withAuto ? [['auto', 'تشخیص خودکار']].concat(LANGS) : LANGS;
  for (const [v, t] of list) select.add(new Option(t, v));
}
fill(src, true); fill(tgt, false);

chrome.storage.sync.get(DEFAULTS, (s) => {
  src.value = s.source; tgt.value = s.target; auto.checked = s.autoDetect;
});

let t;
function save() {
  chrome.storage.sync.set({ source: src.value, target: tgt.value, autoDetect: auto.checked }, () => {
    saved.classList.add('on'); clearTimeout(t); t = setTimeout(() => saved.classList.remove('on'), 1200);
  });
}
[src, tgt, auto].forEach((el) => el.addEventListener('change', save));

$('swap').addEventListener('click', () => {
  if (src.value === 'auto') return;
  [src.value, tgt.value] = [tgt.value, src.value];
  save();
});
$('shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

// نمایش میانبر فعلی (کاربر ممکنه عوضش کرده باشه)
chrome.commands.getAll((cmds) => {
  const c = (cmds || []).find((x) => x.name === 'translate-selection');
  const box = $('keys');
  box.textContent = '';
  const keys = c && c.shortcut ? c.shortcut.split(/\+|(?<=[⌘⌥⇧⌃])/).filter(Boolean) : [];
  if (!keys.length) { box.textContent = '(تنظیم نشده)'; return; }
  keys.forEach((k, i) => {
    if (i) box.append(' + ');
    const kb = document.createElement('kbd'); kb.textContent = k; box.append(kb);
  });
});
