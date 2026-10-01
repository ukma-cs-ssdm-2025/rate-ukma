---
marp: true
theme: rate-ukma
paginate: true
title: Rate UKMA — план на семестр
lang: uk
---

<!-- _class: lead -->
<!-- _paginate: false -->

<div class="wordmark"><img src="assets/logo.png" alt=""><span>Rate <strong>UKMA</strong></span></div>

<p class="muted" style="margin:0 0 12px">Генеративний ШІ в розробці програмного забезпечення</p>

# План на семестр

<p class="small muted">Вересень 2026, rateukma.com</p>

<!--
Добрий день. Ми плануємо продовжити роботу над Rate UKMA: продукту вже рік, ним реально користуються студенти.
-->

---

## Проблема

<p class="big">Щоб дізнатися, що за курс, доводилося ходити й питати.</p>

<svg class="dg wide" viewBox="0 0 1000 130" role="img" aria-label="Де студенти шукали досвід про курси">
<defs><marker id="p2" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd" x="0" y="20" width="280" height="90" rx="12"/>
<text x="24" y="56">Старшокурсники</text>
<text class="mu" x="24" y="86">хто вже брав</text>
<path class="ln ac" d="M280 65 H336" marker-end="url(#p2)"/>
<rect class="bd" x="340" y="20" width="280" height="90" rx="12"/>
<text x="364" y="56">Друзі й знайомі</text>
<text class="mu" x="364" y="86">хто що чув</text>
<path class="ln ac" d="M620 65 H676" marker-end="url(#p2)"/>
<rect class="bd" x="680" y="20" width="320" height="90" rx="12"/>
<text x="704" y="56">Відповіді по шматочках</text>
<text class="mu" x="704" y="86">ніде не зібрані разом</text>
</svg>

<p class="doing">Тепер це в одному місці: оцінки й відгуки студентів.</p>

<!--
Трохи повернемося в часі. У САЗ ти бачиш назву, кредити й, можливо, анотацію. Кредити показують загальне навантаження, а не реальне. Тому йдеш питати знайомих, друзів, старшокурсників: чи курс реально якісний. Відгуки ніде не лежали разом: усе збирав по шматочках і складав пазл у голові. Rate UKMA закриває цей пробіл: усі відгуки в одному місці.
-->

---

## Як усе почалося

<p class="big">На одному з предметів був вибір тем проєкту, і ми згадали саморобний графік курсів.</p>

<div class="cols" style="gap:24px">
<div>

<img src="assets/handmade-chart.png" alt="Тоді: саморобний графік курсів із чату" style="height:340px;width:auto;display:block;margin:0 auto;border:1px solid var(--line);border-radius:10px">

<p class="cap">Тоді: графік із чату</p>

</div>
<div>

<img src="assets/course-map.png" alt="Зараз: карта курсів у Rate UKMA" style="width:100%;border:1px solid var(--line);border-radius:10px">

<p class="cap">Зараз: карта курсів у продукті</p>

</div>
</div>

<p class="doing">Графік дав ідею, а ми перетворили її в продукт.</p>

<!--
А почалося все з предмета: там був вибір теми проєкту, і згадався графік курсів, який нам раніше кидали в чат. Ми фактично перетворили його в частину функціоналу Rate UKMA: той самий графік зі складністю й корисністю, тільки дані оновлюються в реальному часі, коли хтось додає відгук.
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
Rate UKMA сьогодні це платформа для оцінки курсів Могилянки. Оцінки й текстові відгуки залишають студенти, які ці курси проходять або проходили, а зайти можна тільки з корпоративної пошти.
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
Уже понад тисячу сімсот оцінок, тисяча двісті пʼятдесят користувачів і триста студентів щомісяця.
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
Що до репозиторію й стека, то тут усе зображено: понад пʼятсот комітів, понад триста змерджених PR, тести і сорок чотири тисячі рядків коду.
-->

---

## Команда

| Хто                  | GitHub |
|----------------------|---|
| Анастасія Алексєєнко | @stasiaaleks |
| Катерина Братюк      | @katerynabratiuk |
| Андрій Валеня        | @Fybex |
| Мілана Горалевич     | @miqdok |
| Анастасія Двойленко  | @anastasiaaq |

<p class="muted small">Усі інженери, без окремих аналітиків і тестувальників.</p>

<!--
Наша команда це пʼятеро людей: Настя приєдналася недавно, до цього нас було четверо. Окремих аналітиків чи тестувальників немає, всі пишемо код і ревʼюємо одне одного.
-->

---

## Що робимо цього семестру

<div class="cols">
<div>

### Зараз

<div class="track now" style="margin-bottom:12px">
<h3>1. Планувальник ІНП</h3>
<p class="muted">Катерина Братюк, Анастасія Двойленко</p>
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
У плані шість великих ініціатив, але зараз беремо три: планувальник ІНП, парсер САЗ і аналітику. Решта чекає в беклозі.
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
Дисциплін багато, а кредити рахуєш руками: зібрати курси, додати в корзину й перевірити, чи виходить потрібна кількість, зараз важко. Хочемо це спростити: комбінувати курси й дивитися різні варіанти. У Rate UKMA вже є відгуки, тож логічно збирати ІНП тут. Навесні буде зручніше й швидше.
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
Друге, дані. Ми отримуємо багато даних із САЗ, щоб валідувати, хто що може оцінювати, і поки це мануальний процес. Хочемо підтягнути парсер, щоб він валідував сам, а ми чисто бачили, що саме змінилося в даних.
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
Третє, аналітика, ще одна чорна зона. Ми не бачимо цифр: де люди відвалюються, що і скільки роблять. Не можемо нормально тестувати новий функціонал і розуміти, чому, наприклад, хтось почав писати відгук і передумав.
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

### Куди рухаємось далі

- Покращимо **коментарі й тести агента**
- Синхронізуємо **`AGENTS.md`** з реальним процесом
- Навчимо **CodeRabbit і Greptile** наших правил
- Перенесемо очевидні перевірки в **лінтер**

</div>
</div>

<!--
Тут коротко про те, як ми працюємо з ШІ. До цього можемо повернутися.
-->


---

<!-- _class: closing -->
<!-- _paginate: false -->

<div class="wordmark"><img src="assets/logo.png" alt=""><span>Rate <strong>UKMA</strong></span></div>

# Дякуємо за увагу. Раді відповісти на питання

<p class="muted small">rateukma.com</p>
<p class="muted small">Ця презентація зроблена з ШІ та вичитана людьми)</p>

<!--
І загалом це все, дякую за увагу.
-->
