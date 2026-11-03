// FarsiFix – service worker

// پیام ترجمه رو به تب می‌فرسته؛ اگر اسکریپت هنوز توی تب نبود (تب‌های بازِ قبل از نصب،
// یا بعد از ریلود افزونه) خودش تزریقش می‌کنه و دوباره می‌فرسته.
async function triggerTranslate(tab) {
  if (!tab || tab.id == null) {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  }
  if (!tab || tab.id == null) return;
  const msg = { type: 'TRANSLATE_SELECTION' };
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch (_) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['lib.js', 'content.js']
      });
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch (e) {
      console.warn('FarsiFix: این صفحه اجازه‌ی اجرای افزونه رو نمی‌ده', e);
    }
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'translate-selection') triggerTranslate(tab);
});

// راه جایگزین شورتکات: راست‌کلیک روی متن انتخاب‌شده
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'farsifix-translate',
      title: 'ترجمه با FarsiFix',
      contexts: ['selection']
    });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'farsifix-translate') triggerTranslate(tab);
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'TRANSLATE') {
    translate(msg.text, msg.source, msg.target)
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true; // async response
  }
});

async function translate(text, sl, tl) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t' +
    `&sl=${encodeURIComponent(sl || 'auto')}&tl=${encodeURIComponent(tl || 'fa')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'q=' + encodeURIComponent(text)
  });
  if (!res.ok) throw new Error('خطای سرویس ترجمه (' + res.status + ')');
  const data = await res.json();
  const translated = (data[0] || []).map((part) => part[0] || '').join('');
  return { text: translated, detected: data[2] || sl };
}
