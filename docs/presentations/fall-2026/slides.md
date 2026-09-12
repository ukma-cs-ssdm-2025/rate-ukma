---
marp: true
theme: rate-ukma
paginate: true
title: Rate UKMA — план на семестр
---

<!-- _class: lead -->
<!-- _paginate: false -->

<div class="wordmark"><img src="assets/logo.png" alt=""><span>Rate <strong>UKMA</strong></span></div>

<p class="muted" style="margin:0 0 12px">Генеративний ШІ в розробці програмного забезпечення</p>

# План на семестр

<p class="small muted">Вересень 2026, rateukma.com</p>

<!--
Привіт. Почну з того, що ми не з нуля починаємо. Rate UKMA працює вже рік, ним реально користуються студенти. Цього семестру ми беремо три напрями: планувальник ІНП, сервіс даних із САЗ і аналітику. Зараз покажу продукт, цифри, репозиторій, а далі по слайду на кожен напрям.
-->

---

## Rate UKMA сьогодні

<div class="cols" style="gap:24px">
<div class="appframe half">
<div class="app">
<div class="bar">
<span class="mark"><i></i>Rate <b>UKMA</b></span>
</div>
<div class="body">
<h4>Функціональне програмування</h4>
<div class="meta"><b>Бакалавр</b><span>Факультет інформатики</span></div>
<div class="pills"><span class="pill v">ІПЗ</span><span class="pill v">КН</span><span class="pill b">4 ECTS</span><span class="pill a">Осінь</span><span class="pill b">Записи в САЗ 19</span></div>
<div class="rates">
<div class="rate hard">
<div class="n">3.4</div>
<div class="k">Складність</div>
<div class="segs"><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
<div class="h">Стандартне навантаження</div>
</div>
<div class="rate use">
<div class="n">2.5</div>
<div class="k">Корисність</div>
<div class="segs"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
<div class="h">Знання застосовні</div>
</div>
</div>
</div>
</div>
</div>
<div class="appframe half">
<div class="app">
<div class="body">
<div class="revhead">Відгуки студентів <b>15</b><span class="sort">Найпопулярніші</span></div>
<div class="rev">
<div class="top"><u></u><span class="who">Анонімний відгук</span><span class="when">Осінь 2025</span><span class="sc">Складність <b class="h">4.0</b> Корисність <b class="u">1.0</b></span></div>
<p>Багато теорії й щотижневі лаби, але без Haskell далі важко розуміти інші мови.</p>
</div>
<div class="rev">
<div class="top"><u></u><span class="who">Анонімний відгук</span><span class="when">Осінь 2025</span><span class="sc">Складність <b class="h">3.0</b> Корисність <b class="u">3.0</b></span></div>
<p>Лектор відповідає на питання, головне не накопичувати завдання до кінця семестру.</p>
</div>
<div class="rev">
<div class="top"><u></u><span class="who">Анонімний відгук</span><span class="when">Осінь 2024</span><span class="sc">Складність <b class="h">4.0</b> Корисність <b class="u">2.0</b></span></div>
<p>Проєкт замість екзамену, захист наживо.</p>
</div>
</div>
</div>
</div>
</div>

<p class="cap">Рік у проді, вхід лише з поштою ukma.edu.ua</p>

<!--
Це наш продукт, сторінка курсу. Навіщо він узагалі: коли ти обираєш дисципліни, у САЗ є тільки назва, кредити й анотація. Ти не знаєш ні наскільки курс складний, ні чи буде з нього користь, поки не запишешся. Ми показуємо дві оцінки від тих, хто курс уже пройшов, і текстові відгуки. Зайти можна лише з поштою ukma.edu.ua, тому це закрита студентська спільнота.
-->

---

## Де ми зараз

<div class="cols">
<div>

- **~300 студентів** щомісяця
- **1 700 оцінок**, 830 текстових
- **520 курсів** з оцінками

</div>
<div>

<svg class="dg" viewBox="0 0 480 230" role="img" aria-label="Оцінки по місяцях">
<rect class="bar lite" x="0" y="196" width="34" height="4"/>
<rect class="bar lite" x="44" y="146" width="34" height="54"/>
<rect class="bar lite" x="88" y="199" width="34" height="1"/>
<rect class="bar" x="132" y="30" width="34" height="170"/>
<rect class="bar lite" x="176" y="122" width="34" height="78"/>
<rect class="bar lite" x="220" y="177" width="34" height="23"/>
<rect class="bar lite" x="264" y="180" width="34" height="20"/>
<rect class="bar lite" x="308" y="187" width="34" height="13"/>
<rect class="bar lite" x="352" y="191" width="34" height="9"/>
<rect class="bar lite" x="396" y="197" width="34" height="3"/>
<text class="mu" x="0" y="222" font-size="13">лис</text>
<text class="mu" x="44" y="222" font-size="13">гру</text>
<text class="mu" x="88" y="222" font-size="13">лют</text>
<text class="ac" x="126" y="222" font-size="13">бер</text>
<text class="mu" x="176" y="222" font-size="13">кві</text>
<text class="mu" x="220" y="222" font-size="13">тра</text>
<text class="mu" x="264" y="222" font-size="13">чер</text>
<text class="mu" x="308" y="222" font-size="13">лип</text>
<text class="mu" x="352" y="222" font-size="13">сер</text>
<text class="mu" x="396" y="222" font-size="13">вер</text>
<text class="ac" x="132" y="22" font-size="14">794</text>
</svg>
<p class="cap">Оцінки по місяцях</p>

</div>
</div>

<!--
Далі цифри, вони з нашої бази, на сьогодні. Близько трьохсот студентів щомісяця. Тисяча сімсот оцінок, з них вісімсот тридцять з текстом. І графік: у березні прийшло майже вдвічі більше оцінок, ніж у будь-який інший місяць. Тоді ми активно розганяли продукт, і паралельно був місяць реєстрації на курси. Що саме дало ефект, ми зараз не знаємо, і це якраз одна з причин, чому аналітика в нас окремий напрям.
-->


---

## Репозиторій

<div class="cols">
<div>

<div class="facts">
<p><b>564</b> коміти з вересня 2025</p>
<p><b>368</b> змерджених PR</p>
<p><b>44 000</b> рядків коду</p>
<p><b>844</b> тести, покриття бекенду 87%</p>
<p><b>10</b> ADR</p>
</div>

<p class="repolink"><img src="assets/icon-github.svg" alt=""><a href="https://github.com/ukma-cs-ssdm-2025/rate-ukma">github.com/ukma-cs-ssdm-2025/rate-ukma</a></p>

</div>
<div>

<p class="muted small">Стек</p>

<div class="stack">
<span class="tech"><img src="assets/icon-python.svg" alt="">Python</span>
<span class="tech"><img src="assets/icon-django.svg" alt="">Django</span>
<span class="tech"><img src="assets/icon-typescript.svg" alt="">TypeScript</span>
<span class="tech"><img src="assets/icon-react.svg" alt="">React</span>
<span class="tech"><img src="assets/icon-tanstack.svg" alt="">TanStack</span>
<span class="tech"><img src="assets/icon-tailwindcss.svg" alt="">Tailwind</span>
<span class="tech"><img src="assets/icon-postgresql.svg" alt="">Postgres</span>
<span class="tech"><img src="assets/icon-redis.svg" alt="">Redis</span>
<span class="tech"><img src="assets/icon-docker.svg" alt="">Docker</span>
<span class="tech"><img src="assets/icon-hetzner.svg" alt="">Hetzner</span>
<span class="tech"><img src="assets/icon-sentry.svg" alt="">Sentry</span>
<span class="tech"><img src="assets/icon-githubactions.svg" alt="">Actions</span>
</div>

<p class="muted small">CI на кожен PR: лінт, типи, тести, e2e на Playwright, DORA-метрики.</p>

</div>
</div>

<!--
Трохи про сам репозиторій, бо курс оцінює процес. П'ятсот шістдесят чотири коміти, триста шістдесят вісім змерджених пул-реквестів: у мейн напряму не пушимо, все через рев'ю. Сорок чотири тисячі рядків коду, вісімсот сорок чотири тести, покриття бекенду вісімдесят сім відсотків. Десять ADR, тобто архітектурні рішення в нас записані, а не тільки в чаті. Стек звичайний: Django з DRF, React, Postgres, Redis, Docker, Hetzner. CI на кожен PR гоняє лінт, типи, тести й e2e на Playwright, і сам збирає DORA-метрики.
-->

---

## Команда

| Хто | GitHub |
|---|---|
| Анастасія Алексєєнко | @stasiaaleks |
| Катерина Братюк | @katerynabratiuk |
| Андрій Валеня | @Fybex |
| Мілана Горалевич | @miqdok |
| Настя Двойленко | @anastasiaaq |

<p class="muted small">Усі інженери, без окремих аналітиків і тестувальників.</p>

<!--
Нас пʼятеро. Окремих аналітиків, дизайнерів чи тестувальників немає, ми всі пишемо код і рев'юємо одне одного. У таблиці просто хто з чого починає: двоє на парсер, двоє на планувальник, Мілана піднімає аналітику. Настя ще взяла на себе комунікацію з вами. Далі між ітераціями можемо міняти напрями.
-->

---

## Що робимо цього семестру

<div class="cols">
<div>

### Зараз

<div class="track now" style="margin-bottom:12px">
<h3>1. Планувальник ІНП</h3>
<p class="muted">Катерина Братюк, Настя Двойленко</p>
</div>
<div class="track now" style="margin-bottom:12px">
<h3>2. Парсер САЗ</h3>
<p class="muted">Андрій Валеня, Анастасія Алексєєнко</p>
</div>
<div class="track now">
<h3>3. Аналітика</h3>
<p class="muted">Мілана Горалевич</p>
</div>

</div>
<div>

### Беклог

<div class="track" style="margin-bottom:12px">
<h3>4. Рекомендації</h3>
<p class="muted">Що брали студенти зі схожим набором курсів</p>
</div>
<div class="track" style="margin-bottom:12px">
<h3>5. Сповіщення</h3>
<p class="muted">Нагадати оцінити курс, відповіли на коментар</p>
</div>
<div class="track">
<h3>6. Мітки з відгуків</h3>
<p class="muted">ШІ зводить відгуки до ярликів для фільтра</p>
</div>

</div>
</div>

<!--
Ось план на семестр. Ліворуч те, що починаємо одразу, воно не залежить одне від одного, тому йде паралельно. Праворуч беклог, у порядку пріоритету. Рекомендації це «куди пішли схожі на мене»: показуємо, що далі брали студенти зі схожим набором курсів, тільки агрегати, не менше двадцяти людей у групі. Сповіщення це дзвіночок і email, щоб про нас згадували частіше, ніж раз на семестр. Мітки це коли модель зводить наші текстові відгуки до кількох ярликів, і до кожного дає цитату. Що з беклогу візьмемо, вирішимо за цифрами з аналітики.
-->

---

## 1. Планувальник ІНП

<p class="big">Дисциплін багато, а кредити рахуєш руками.</p>

<div class="cols" style="gap:24px">
<div class="appframe half">
<div class="app">
<div class="body">
<div class="head">
<h4>Теорія ігор</h4>
<span class="btn">Додати в ІНП</span>
</div>
<div class="meta"><b>Бакалавр</b><span>Факультет інформатики</span></div>
<div class="pills"><span class="pill v">КН</span><span class="pill b">3 ECTS</span><span class="pill a">Осінь</span><span class="pill b">вільний вибір</span></div>
<p class="lead">Класичні й сучасні моделі теорії ігор, рівноваги, аукціони, кооперативні ігри та задачі на стратегічну поведінку.</p>
<div class="rates">
<div class="rate hard">
<div class="n">2.8</div>
<div class="k">Складність</div>
<div class="segs"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
<div class="h">Помірне навантаження</div>
</div>
<div class="rate use">
<div class="n">4.1</div>
<div class="k">Корисність</div>
<div class="segs"><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
<div class="h">Знання застосовні</div>
</div>
</div>
</div>
</div>
</div>
<div class="appframe half">
<div class="app">
<div class="body">
<div class="revhead">ІНП на 4 курс <span class="sort">Варіант A</span></div>
<div class="plan">
<div class="stats">
<div class="stat"><b>60 / 60</b> кредитів</div>
<div class="stat"><b>25 / 25</b> вільного вибору</div>
</div>
<table>
<tr><th>Семестр</th><th>Курси</th><th>Кредити</th></tr>
<tr><td>Осінь</td><td><span class="c">Паралельне програмування, 4 кр</span><span class="c">Генеративний ШІ, 3 кр</span><span class="c free">Теорія ігор, 3 кр</span></td><td>24</td></tr>
<tr><td>Весна</td><td><span class="c">Комп'ютерна графіка, 4 кр</span><span class="c">Блокчейн, 4 кр</span><span class="c add">+ 3 кредити</span></td><td>24</td></tr>
<tr><td>Літо</td><td><span class="c">Кваліфікаційна робота, 12 кр</span></td><td>12</td></tr>
</table>
</div>
</div>
</div>
</div>
</div>

<p class="doing">Зробимо додавання зі сторінки курсу, автоматичні ліміти і кілька варіантів ІНП.</p>

<!--
Перший напрям, планувальник ІНП. Зараз ІНП у САЗ це таблиця на один рік. Дисциплін багато, і всі кредити ти рахуєш руками: загальні, окремо кредити вільного вибору, окремо години на тиждень. Понад ліміт САЗ не пустить, але й не підкаже, скільки вільного вибору лишиться на четвертий курс і чи влізе курс на три з половиною кредита. А головне, у кожного в голові чи в нотатках лежать два-три варіанти набору, і порівняти їх нормально ніде. Ми хочемо, щоб ці варіанти жили в продукті: збираєш набір із курсів, які в нас уже оцінені, усі ліміти рахуються самі, перемикаєшся між варіантами і обираєш. Це найбільша продуктова фіча семестру.
-->

---

## 2. Парсер САЗ

<p class="big">Парсер є, але заливка даних руками це 2-3 години розробника.</p>

<svg class="dg wide" viewBox="0 0 1000 120" role="img" aria-label="Сервіс даних між САЗ і Rate UKMA">
<defs><marker id="p1" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd" x="0" y="20" width="280" height="80" rx="12"/>
<text x="22" y="52">my.ukma.edu.ua</text>
<text class="mu" x="22" y="78">каталог, місця, викладачі</text>
<path class="ln ac" d="M280 60 H356" marker-end="url(#p1)"/>
<rect class="bd ac" x="360" y="20" width="280" height="80" rx="12"/>
<text class="ac" x="382" y="48">Сервіс даних</text>
<text class="mu" x="382" y="72" font-size="16">оновлює дані сам,</text>
<text class="mu" x="382" y="90" font-size="16">бачить, що змінилося</text>
<path class="ln ac" d="M640 60 H716" marker-end="url(#p1)"/>
<rect class="bd now" x="720" y="20" width="280" height="80" rx="12"/>
<text class="wh" x="742" y="52">Rate UKMA</text>
<text class="wh" x="742" y="78" font-size="16">курси, оцінки, план</text>
</svg>

<!--
Другий напрям, парсер. Сам парсер у нас уже є і працює, руками робиться саме заливка: хтось запускає скрипт і вливає результат у базу. Дані в САЗ змінюються самі собою: хтось перезаписався і звільнив місце, групу перенесли, курс скасували перед семестром. У нас ці дані оновлюються тільки тоді, коли розробник сідає і закидає їх руками: запускає скрипт, чекає обхід каталогу, дивиться, що зібралося, і вливає в базу. Це щоразу дві-три години, тому робити так щодня і по всіх курсах ніхто не буде. Тому сервіс має ходити сам і з пріоритетами: те, що часто змінюється і те, на що зараз дивляться студенти, оновлювати першим. Далі він порівнює з попереднім знімком і віддає готовий список змін, тобто рішення «що встигло змінитися» приймає код. Можливо, з цього виросте публічне API з ключами, бо студенти хочуть будувати свої штуки поверх цих даних, але це не обіцянка на цей семестр. І окремо ми питаємо університет, чи можна отримати офіційний доступ до даних замість парсингу.
-->

---

## 3. Аналітика

<p class="big">Не бачимо, як студенти користуються продуктом. Приклад: почав писати відгук і кинув.</p>

<svg class="dg wide" viewBox="0 0 1000 240" role="img" aria-label="Воронка від входу до оцінки, яку ми не вимірюємо">
<rect class="bar" x="0" y="0" width="1000" height="46" rx="8"/>
<text class="wh" x="18" y="30">Зайшли на сайт</text>
<text class="wh" x="982" y="30" text-anchor="end">?</text>
<rect class="bar" x="0" y="62" width="760" height="46" rx="8" opacity="0.78"/>
<text class="wh" x="18" y="92">Відкрили сторінку курсу</text>
<text class="wh" x="742" y="92" text-anchor="end">?</text>
<rect class="bar" x="0" y="124" width="520" height="46" rx="8" opacity="0.56"/>
<text class="wh" x="18" y="154">Почали писати відгук</text>
<text class="wh" x="502" y="154" text-anchor="end">?</text>
<rect class="bar" x="0" y="186" width="280" height="46" rx="8" opacity="0.34"/>
<text class="wh" x="18" y="216">Відправили оцінку</text>
<text class="wh" x="262" y="216" text-anchor="end">?</text>
</svg>

<p class="doing">Зробимо події у кілька рядків, щоб на кожній новій фічі бачити, чи нею користуються.</p>

<!--
Третій напрям, аналітика. Без цифр ми в кінці семестру не скажемо, чи планувальник комусь узагалі потрібен. Ось проста воронка, якої ми зараз не бачимо: скільком зайшло, скільки відкрили сторінку курсу, скільки почали писати відгук і скільки його таки відправили. Найцікавіше саме на третьому кроці: студент відкрив форму, почав заповнювати і кинув, а ми навіть не знаємо, чи це сталося. Так само хочемо воронку самого планувальника і список курсів, які дивляться, але не оцінюють. І далі на кожну нову фічу ми одразу вішаємо подію, щоб бачити, чи нею взагалі користуються, а не вгадувати. Вимога в нас не до конкретного інструмента, а до процесу: додати нову подію з фронта або бека має бути справою кількох рядків, новий дашборд не має вимагати окремої людини, і агент мусить уміти і подію надіслати, і цифри прочитати. Metabase один з варіантів, але ми ще не обрали, тому вибір інструмента це окремий крок.
-->

---

## Як працюємо з ШІ

<div class="cols">
<div>

### Що вже є

- Агент пише **код і доки**, відкриває PR, стежить за CI
- **CodeRabbit і Greptile** перед людським рев'ю
- Правила для агентів: **`AGENTS.md`** на бек і фронт

</div>
<div>

### Що ще можна зробити

- Агент пише **зайві коментарі й тести**
- Інструкції та доки **відстають**
- **CodeRabbit і Greptile** не читають наші правила
- Що можна перевірити лінтером, **тримати в лінтері**

</div>
</div>

<!--
Курс про процес, тому окремо про те, як ми працюємо з ШІ. Інструменти в кожного свої: хтось у Claude Code, хтось у Codex чи OpenCode, і ми це не уніфікуємо. Уніфіковані правила: у репо лежать AGENTS.md для бекенду і для фронтенду, будь-який агент читає їх однаково, тому домен і конвенції не треба переказувати щоразу. Агент у нас не тільки пише код: він оновлює документацію, відкриває пул-реквест, дивиться, чи пройшов CI, і сам доганяє падіння. Кожна задача при цьому в окремому worktree, тому агенти не топчуться одне по одному. Далі CodeRabbit і Greptile проходять PR до того, як його дивиться людина. Що не працює: агент пише зайві коментарі й зайві тести, і ми їх чистимо руками; інструкції та доки відстають від коду, їх треба регулярно оновлювати. І висновок цього тижня: те, що взагалі можна перевірити лінтером, має жити в лінтері, бо інструкцію агент може проігнорувати, а лінтер ні. Зрозуміло, що лінтером перевіряється не все, решта лишається в інструкціях і на рев'ю. Найближче, що хочемо зробити, це підтюнити CodeRabbit і Greptile, щоб вони читали наші правила з репо, а не радили загальні речі.
-->


---

<!-- _class: closing -->
<!-- _paginate: false -->

<div class="wordmark"><img src="assets/logo.png" alt=""><span>Rate <strong>UKMA</strong></span></div>

# Питання?

<p class="muted small">rateukma.com</p>
<p class="muted small">Ця презентація зроблена з ШІ та вичитана людьми)</p>

<!--
На цьому все, питайте. Три речі, які самі хочемо з вами звірити: у якому форматі подавати опис ідеї, коли беремо слот на консультації, і чи варто спробувати отримати офіційний доступ до даних САЗ замість парсингу.
-->
