// منطق خالص: تبدیل چیدمان کیبورد + تشخیص متن ناخوانا (قابل تست بدون مرورگر)
var FarsiFixLib = (function () {
  // چیدمان استاندارد کیبورد فارسی (ویندوز) روی کلیدهای QWERTY
  const MAP = {
    q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح',
    '[': 'ج', ']': 'چ', '\\': 'پ',
    a: 'ش', s: 'س', d: 'ی', f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م',
    ';': 'ک', "'": 'گ',
    z: 'ظ', x: 'ط', c: 'ز', v: 'ر', b: 'ذ', n: 'د', m: 'ئ',
    ',': 'و', '.': '.', '/': '/', '?': '؟', '`': '\u200c'
  };

  function convertLayout(text) {
    return Array.from(text)
      .map((c) => MAP[c] ?? MAP[c.toLowerCase()] ?? c)
      .join('');
  }

  // معکوس نقشه: حرف فارسی → کلید انگلیسی (برای ساخت دیکشنری و تست)
  const REV = {};
  for (const k in MAP) if (!(MAP[k] in REV)) REV[MAP[k]] = k;

  /* ---------- دیکشنری کلمات رایج ---------- */
  const EN_WORDS = new Set((
    'a i am an as at be by do go he hi if in is it me my no of oh ok on or so to up us we ' +
    'the and you that was for are with his they this have from one had but not what all were when your can said ' +
    'there use each which she how their will other about out many then them these some her would make like him into ' +
    'time has look two more write see number way could people than first water been call who its now find long down ' +
    'day did get come made may part over new sound take only little work know place year live back give most very ' +
    'after thing our just name good sentence man think say great where help through much before line right too mean ' +
    'old any same tell boy follow came want show also around form three small set put end does another well large ' +
    'must big even such because turn here why ask went men read need land different home move try kind hand picture ' +
    'again change off play spell air away animal house point page letter mother answer found study still learn ' +
    'should world high every near add food between own below country plant last school father keep tree never ' +
    'start city earth eye light thought head under story saw left dont few while along might close something seem ' +
    'next hard open example begin life always those both paper together got group often run important until ' +
    'children side feet car mile night walk white sea began grow took river four carry state once book hear stop ' +
    'without second later miss idea enough eat face watch far real almost let above girl sometimes mountain cut ' +
    'young talk soon list song being leave family hello hey thanks thank please yes okay sorry love friend today ' +
    'tomorrow yesterday morning evening really maybe going doing having being cant wont didnt doesnt isnt ' +
    'wasnt arent youre theyre were ive ill im hes shes lets btw thx idk lol omg pls plz brb imo fyi asap wtf ' +
    'email password login google github twitter chrome python javascript code test text file message send ' +
    'online free best new news video photo music game app web site link click download search'
  ).split(/\s+/));

  const FA_RAW = (
    'سلام من تو او ما شما آنها اونها این اون آن که را رو به از در با برای تا یا اما ولی هم همه چه چی کی کجا چرا ' +
    'چطور چطوری چرا خوبی خوب بد بله نه آره نیست هست هستم هستی هستیم هستید هستند است بود بودم بودی شد شده شدم کرد ' +
    'کردم کردی کردن کن کنم کنی کنید کنیم کنند دارم داری داره دارد داریم دارید دارن میشه میشود میخوام میخوای میخواد ' +
    'میره میاد میرم میری میریم میدونم میدونی میکنم میکنی میکنه میگم میگی میگه بگو بگم بگی گفت گفتم گفتی رفت رفتم ' +
    'رفتی بیا بیاید برو برم بریم ببین ببینم ببینی بابا مامان داداش آبجی عزیز عزیزم جان جانم دوست دوستان حاجی آقا ' +
    'خانم خبر خب خبری حالا الان امروز فردا دیروز شب روز صبح ظهر عصر هفته ماه سال چند چقدر همین همون همچین خیلی کم ' +
    'زیاد بیشتر کمتر فقط هیچ هر یه یک دو سه چهار پنج شش هفت هشت نه ده صد هزار اسم اسمم عطا علی محمد حسین رضا مهدی ' +
    'سارا مریم زهرا فاطمه حال حالت احوال احوالت چطورید خوشحال ممنون مرسی متشکر لطفا لطفاً ببخشید معذرت ساعت وقت ' +
    'کار کارم کارت کارها شغل زندگی خونه خانه مدرسه دانشگاه شهر کشور ایران تهران اینجا اونجا آنجا اینجوری اونجوری ' +
    'همیشه هیچوقت گاهی بعضی بعد قبل پیش پس بین روی زیر کنار داخل بیرون تو توی توضیح سوال جواب پاسخ پرسش مشکل ' +
    'حل راه کمک کمکم میتونم میتونی میتونه میتونیم نمیتونم نمیدونم نمیشه نمیخوام نمیخواد نمیدونی نمیاد نمیره ' +
    'باید بشه بشم بشی بشید بدم بدی بده بدید بخوام بخوای بخواد بخوریم بخور بخوره بخورم بخواب بخوابم بنویس بنویسم ' +
    'نوشتن نوشت خواندن خوندن خوند دیدن دید دیدم دیدی شنیدم شنیدن گرفتن گرفت گرفتم دادن داد دادم آمدن آمد اومد ' +
    'اومدم اومدی اومدن آوردن آورد آوردم خوردن خورد خوردم خوابیدن خوابید غذا ناهار شام صبحانه چای قهوه آب نون نان ' +
    'پول قیمت ارزون گرون خرید خریدن فروش فروشگاه بازار ماشین موبایل گوشی کامپیوتر لپتاپ اینترنت سایت برنامه ' +
    'فایل متن پیام ترجمه فارسی انگلیسی عربی زبان کلمه جمله حرف کتاب فیلم سریال بازی موسیقی آهنگ عکس تصویر ' +
    'دختر پسر بچه بچه‌ها بزرگ کوچک جدید قدیمی قشنگ زیبا خوشگل زشت سخت آسان راحت سریع آهسته دیر زود ' +
    'درست غلط اشتباه حتما حتماً شاید ممکن لازم مهم عالی خوبه بده بهتر بهترین بدترین مثل مثلا مثلاً مانند ' +
    'همراه بدون باهم باهات باهاش بهت بهش بهم برات براش برام ازت ازش ازم برای اینم اونم منم توام تویی تویی ' +
    'چیه کیه کجاست کجایی کجام چیکار چیکارا چیزی کسی جایی همچنین همچنان ولی اگه اگر وگرنه چون چونکه زیرا ' +
    'اینکه آنکه تا اینکه وقتی هنگامی بعدش قبلش اولش آخرش اول آخر وسط شروع تموم تمام کامل نیمه ' +
    'هم‌چنین سپاس درود خدا خدایا الهی انشالله ان‌شاءالله ماشالله بسیار بسیارخوب خداحافظ خدانگهدار شبخوش ' +
    'عید مبارک تبریک تولد سلامتی سلامت صحت مریض بیمار دکتر بیمارستان دارو درد سردرد ' +
    'امیدوارم میخواستم میخواستی میخواست خواستم خواستی خواست دوستت دوستم دارم عاشق عشق قلب ' +
    'مرد زن آدم مردم همکار همسر پدر مادر برادر خواهر عمو خاله دایی عمه پسرعمو ' +
    'فکر فکرکنم فهمیدم فهمیدی فهمیدن بفهمم یادم یادت یاد ' +
    'نگاه کن کنین کنید بکن بکنم بکنی بکنیم نکن نکنم نکنی نکنید ' +
    'چیز چیزا چیزها همون‌طور همونطور اونطور اینطور اینطوری اونطوری همینطور همینجا همونجا ' +
    'دیگه دیگر دیگری دیگران بقیه خودم خودت خودش خودمون خودتون خودشون ' +
    'کدوم کدام کدومش چندتا چندین هرکی هرکس هرچی هرجا هرگز ' +
    'اره ایشالا انقدر اینقدر اونقدر آنقدر ' +
    'باشه باش باشم باشی باشید باشیم باشن بودن بوده بودیم بودید بودند ' +
    'نبود نیستم نیستی نیستیم نیستید نیستند نبودم نبودی ' +
    'ندارم نداری نداره ندارد نداریم ندارید ندارن ' +
    'ببخشید اجازه بفرمایید بفرما بفرمایید سلامی علیکم علیک ' +
    'ایول عالیه باحاله خفنه جالبه جالب جدی شوخی ' +
    'منتظر منتظرم منتظرتم صبر صبرکن بمون بمونم بمونی نمونه ' +
    'مطمئن مطمئنم مطمئنی کافی کافیه کم‌کم ' +
    'دانستن دونستن دونم دونی دونه نیم ' +
    'برسه برسم برسی ' +
    'تماس تماس‌بگیر بگیر بگیرم بگیری بگیرید ' +
    'سر سرم سرت سرش دست دستم دستت چشم چشمم چشمت پا پام پات'
  ).split(/\s+/).filter(Boolean);

  const normFa = (w) => w.replace(/[آأإ]/g, 'ا').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, '').replace(/[ًٌٍَُِّْ]/g, '');
  const FA_WORDS = new Set(FA_RAW.map(normFa));

  const FA_PREFIX = ['می', 'نمی', 'ب', 'ن'];
  const FA_SUFFIX = ['ها', 'های', 'ام', 'ات', 'اش', 'مون', 'تون', 'شون', 'ان', 'تر', 'ترین', 'ید', 'یم', 'ند', 'ی', 'ه', 'م', 'ت', 'ش', 'ن', 'ا'];

  function isPersianWord(p) {
    p = normFa(p.replace(/^[.؟!?]+|[.؟!?،]+$/g, ''));
    if (p.length < 2) return false;
    if (FA_WORDS.has(p)) return true;
    for (const suf of FA_SUFFIX) {
      if (p.length > suf.length + 1 && p.endsWith(suf) && FA_WORDS.has(p.slice(0, -suf.length))) return true;
    }
    for (const pre of FA_PREFIX) {
      if (p.length > pre.length + 2 && p.startsWith(pre) && FA_WORDS.has(p.slice(pre.length))) return true;
    }
    return false;
  }

  const isEnglishWord = (w) => {
    w = w.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
    if (EN_WORDS.has(w)) return true;
    // حالت‌های مثل don't / it's / running / words
    const base = w.replace(/('s|'re|'ve|'ll|'d|'m|n't|s|ed|ing|es|ly)$/, '');
    return base.length > 2 && EN_WORDS.has(base);
  };

  const BIGRAMS = new Set((
    'th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me ' +
    'de hi ri ro ic ne ea ra ce li ch ll be ma si om ur ca el ta la ns di fo ho pe ec pr no ct us ac ot ' +
    'il tr ly nc et ut ss so rs un lo wa ge ie wh ee wi em ad ol rt po we na ul ni ts mo ow pa im mi ai ' +
    'sh ir su id os iv ia am fi ci vi pl ig tu ev ld ry mp fe bl ab gh ty op wo sa ay ex ke fr oo av ag ' +
    'if ap gr od bo sp rd do uc bu ei ov by rm ep tt nu ik ib ok ew ck up ak ue yo ob ub ug gu ua rn ft ' +
    'ey ys lt ff ru rc ps ye ze rl nk ks rk sk lk lf lp lm lv ph oa oi ox ui yp ym yn ba bi br ' +
    'cl cr cu dr du dy ga gi gl go gy hu hy ja ju ki kn lu mu my nn ny oc oy pi pu qu rg rh ' +
    'rr sc sm sn sw sy tw ud uf um uy va vo wn wr xp xt za zo'
  ).split(' '));

  // 'skip' | 'persian' (احتمالاً فارسیِ تایپ‌شده) | 'english' | 'neutral'
  function analyzeToken(tok) {
    const core = tok.replace(/^[?!.]+|[?!.]+$/g, '');
    if (core.length < 2) return 'skip';
    if (/[0-9@:_#]|\/\/|\//.test(core.replace(/[a-z]\/[a-z]/gi, 'x'))) return 'skip';
    const letters = core.toLowerCase().replace(/[^a-z]/g, '');
    // علامت‌های وسط کلمه (h[d ، oo,fd ، k;n) در انگلیسی تقریباً وجود ندارن
    if (/[a-z][\[\];\\`,][a-z]/i.test(core)) return 'persian';
    const en = isEnglishWord(core);
    if (isPersianWord(convertLayout(core))) return en ? 'neutral' : 'persian';
    if (en) return 'english';
    if (letters.length < 2) return 'skip';
    if (/^[A-Z]{2,5}$/.test(core)) return 'skip';              // اختصار: USA, HTML
    if (letters.length === 2) return 'persian';
    if (!/[aeiouy]/.test(letters)) return 'persian';
    if (/[^aeiouy]{6,}/.test(letters)) return 'persian';
    let hit = 0;
    for (let i = 0; i < letters.length - 1; i++) if (BIGRAMS.has(letters.slice(i, i + 2))) hit++;
    return hit / (letters.length - 1) < 0.5 ? 'persian' : 'neutral';
  }

  // آیا این متن احتمالاً فارسی است که با کیبورد انگلیسی تایپ شده؟
  function looksLikeMistypedPersian(text) {
    const t = (text || '').trim();
    if (t.length < 4 || t.length > 2000) return false;
    if (/[^\x00-\x7F]/.test(t)) return false;            // حروف غیر ASCII → عادی است
    if (/https?:\/\/|www\.|@/.test(t)) return false;     // لینک / ایمیل
    let total = 0, fa = 0, en = 0, letters = 0;
    for (const tok of t.split(/\s+/)) {
      const r = analyzeToken(tok);
      if (r === 'skip') continue;
      total++;
      letters += tok.replace(/[^A-Za-z]/g, '').length;
      if (r === 'persian') fa++;
      else if (r === 'english') en++;
    }
    return total > 0 && fa >= 1 && letters >= 4 && fa / total >= 0.5 && en / total <= 0.34;
  }

  // برای تست: متن فارسی → همون چیزی که با کیبورد انگلیسی تایپ می‌شد
  const toKeys = (fa) => Array.from(fa).map((c) => REV[c] ?? c).join('');

  const api = { convertLayout, looksLikeMistypedPersian, toKeys, MAP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
