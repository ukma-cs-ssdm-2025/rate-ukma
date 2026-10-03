---
marp: true
theme: rate-ukma
paginate: true
title: UKMA Data, сервіс даних
lang: uk
---

<!-- _class: lead -->
<!-- _paginate: false -->

<div class="wordmark"><img src="assets/logo.png" alt=""><span>Rate <strong>UKMA</strong></span></div>

<p class="muted" style="margin:0 0 12px">Парсер САЗ як окремий сервіс</p>

# UKMA Data: що будуємо і як парсимо

<p class="small muted">Жовтень 2026, data.rateukma.com (робоча назва)</p>

<!--
Сьогодні покажу, як ми бачимо сервіс даних: навіщо він, що вже вирішили, як парсимо САЗ і smart.ukma, яка модель даних і що робимо до першого грудня. Це чернетка: модель майже готова, але відкриті питання є, і їх я покажу в кінці.
-->

---

## Проблема

<p class="big">Записи з САЗ у Rate UKMA востаннє імпортували 5 липня: парсер запускає розробник руками, і це 2-3 години.</p>

<svg class="dg wide" viewBox="0 0 1000 120" role="img" aria-label="Як дані зараз потрапляють у Rate UKMA">
<defs><marker id="a2" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd"/></marker></defs>
<rect class="bd" x="0" y="20" width="220" height="80" rx="12"/>
<text x="20" y="54">my.ukma.edu.ua</text>
<text class="mu" x="20" y="80">каталог і записи</text>
<path class="ln" d="M220 60 H256" marker-end="url(#a2)"/>
<rect class="bd" x="260" y="20" width="220" height="80" rx="12"/>
<text x="280" y="54">7 команд руками</text>
<text class="mu" x="280" y="80">по черзі, без розкладу</text>
<path class="ln" d="M480 60 H516" marker-end="url(#a2)"/>
<rect class="bd" x="520" y="20" width="220" height="80" rx="12"/>
<text x="540" y="54">Файли JSONL</text>
<text class="mu" x="540" y="80">стан між кроками</text>
<path class="ln" d="M740 60 H776" marker-end="url(#a2)"/>
<rect class="bd now" x="780" y="20" width="218" height="80" rx="12"/>
<text class="wh" x="800" y="54">Rate UKMA</text>
<text class="wh" x="800" y="80" font-size="16">дані з 5 липня</text>
</svg>

<p class="doing">Сервіс оновлюватиме дані сам і показуватиме, що змінилося.</p>

<!--
Зараз парсер живе всередині Django Rate UKMA: це сім команд, які розробник запускає по черзі, а між кроками дані лежать у файлах. Останній раз записи студентів імпортували п'ятого липня, тобто осінній запис уже пройшов без оновлення. І ще одне: у базі нуль зв'язків між курсом і викладачем, бо викладачів ми ніде не беремо.
-->

---

## Одні дані, кілька парсерів

<p class="big">Ті самі сторінки САЗ уже парсять два наші проєкти, і ще два хочуть ці дані.</p>

<svg class="dg wide" viewBox="0 0 1000 200" role="img" aria-label="Хто вже парсить САЗ і кому потрібні дані">
<defs><marker id="a3" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd"/></marker></defs>
<rect class="bd ac" x="0" y="60" width="220" height="80" rx="12"/>
<text class="ac" x="20" y="94">САЗ</text>
<text class="mu" x="20" y="120">my.ukma.edu.ua</text>
<path class="ln" d="M220 80 H346" marker-end="url(#a3)"/>
<path class="ln" d="M220 120 H346" marker-end="url(#a3)"/>
<rect class="bd" x="350" y="10" width="300" height="80" rx="12"/>
<text x="370" y="44">Rate UKMA</text>
<text class="mu" x="370" y="70">Python, запуск руками</text>
<rect class="bd" x="350" y="110" width="300" height="80" rx="12"/>
<text x="370" y="144">UKMA Schedule</text>
<text class="mu" x="370" y="170">Effect, щогодини</text>
<rect class="bd new" x="700" y="10" width="298" height="80" rx="12"/>
<text x="720" y="44">Планувальник ІНП</text>
<text class="mu" x="720" y="70">потрібні курси і кредити</text>
<rect class="bd new" x="700" y="110" width="298" height="80" rx="12"/>
<text x="720" y="144">Аналітика</text>
<text class="mu" x="720" y="170">потрібна історія курсів</text>
</svg>

<p class="doing">Один сервіс парсить для всіх, а решта читають його API.</p>

<!--
Ми вже маємо два парсери одного й того самого сайту: Python у Rate UKMA і Effect в UKMA Schedule, який крутиться щогодини. Планувальнику ІНП і аналітиці потрібні ті самі курси, кредити й історія. Якщо кожен парситиме сам, ми чотири рази зробимо одну роботу і чотири рази навантажимо САЗ.
-->

---

## Що вже вирішили

| Тема | Рішення |
|---|---|
| Читачі | Кожен читач рівний, Rate UKMA теж. Нема запитів під одного читача |
| Парсинг | За розкладом. Читач ніколи не запускає парсинг |
| Мова | TypeScript і Effect 4 |
| Репозиторій | Монорепо rate-ukma, своя папка і своя база |
| Інфраструктура | Kubernetes на Hetzner через Terraform, staging і prod окремо (#705) |
| Адреса | Піддомен rateukma.com, робоча назва data.rateukma.com |
| Ключі | На старті створює тільки адмін |
| Курси через роки | Групує сервіс, старт з груп Rate UKMA |

<!--
Ось що вже вирішено. Найважливіше: Rate UKMA тут звичайний читач, як і будь-хто інший, тому API не підганяємо під нього. Мову обрали TypeScript з Effect: одна схема дає і валідацію, і OpenAPI, а парсер САЗ на Effect уже працює в UKMA Schedule. Інфраструктуру описала Анастасія Алексєєнко в специфікації до задачі сімсот п'ять, її вже змерджили. Адреса: піддомен rateukma.com. Не api.rateukma.com, бо rateukma.com/api це вже API самого Rate UKMA.
-->

---

## Як це влаштовано

<svg class="dg" viewBox="0 0 1000 300" role="img" aria-label="Джерела, воркер, база, API, читачі">
<defs><marker id="a5" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd"/></marker><marker id="a5a" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd" x="0" y="20" width="170" height="70" rx="12"/>
<text x="16" y="62">САЗ</text>
<rect class="bd" x="0" y="115" width="170" height="70" rx="12"/>
<text x="16" y="157">smart.ukma</text>
<rect class="bd new" x="0" y="210" width="170" height="70" rx="12"/>
<text class="mu" x="16" y="252">файли розкладу</text>
<path class="ln" d="M170 55 H204" marker-end="url(#a5)"/>
<path class="ln" d="M170 150 H204" marker-end="url(#a5)"/>
<path class="ln dash" d="M170 245 H204" marker-end="url(#a5)"/>
<rect class="bd ac" x="208" y="20" width="190" height="260" rx="12"/>
<text class="ac" x="226" y="56">Воркер</text>
<text class="mu" x="226" y="98">забрати</text>
<text class="mu" x="226" y="128">розібрати</text>
<text class="mu" x="226" y="158">порівняти</text>
<text class="mu" x="226" y="188">перевірити</text>
<text class="mu" x="226" y="218">застосувати</text>
<text class="mu" x="226" y="248">записати зміни</text>
<path class="ln ac" d="M398 150 H432" marker-end="url(#a5a)"/>
<rect class="bd" x="436" y="20" width="190" height="260" rx="12"/>
<text x="454" y="56">База</text>
<text class="mu" x="454" y="98">сирі сторінки</text>
<text class="mu" x="454" y="128">курси, викладачі</text>
<text class="mu" x="454" y="158">записи студентів</text>
<text class="mu" x="454" y="188">журнал змін</text>
<text class="mu" x="454" y="218">проходи</text>
<text class="mu" x="454" y="248">ключі, аудит</text>
<path class="ln" d="M626 150 H660" marker-end="url(#a5)"/>
<rect class="bd" x="664" y="20" width="150" height="260" rx="12"/>
<text x="682" y="56">API /v1</text>
<text class="mu" x="682" y="98">ключ</text>
<text class="mu" x="682" y="128">права</text>
<text class="mu" x="682" y="158">OpenAPI</text>
<text class="mu" x="682" y="188">адмінка</text>
<path class="ln ac" d="M814 55 H846" marker-end="url(#a5a)"/>
<path class="ln dash" d="M814 150 H846" marker-end="url(#a5)"/>
<path class="ln" d="M814 245 H846" marker-end="url(#a5)"/>
<rect class="bd now" x="850" y="20" width="148" height="70" rx="12"/>
<text class="wh" x="866" y="62">Rate UKMA</text>
<rect class="bd new" x="850" y="115" width="148" height="70" rx="12"/>
<text class="mu" x="866" y="157">інші проєкти</text>
<rect class="bd" x="850" y="210" width="148" height="70" rx="12"/>
<text x="866" y="252">адміни</text>
</svg>

<p class="doing">Пише в базу тільки воркер, а читають усі тільки через API.</p>

<!--
Схема проста. Зліва джерела: САЗ, smart.ukma, а пізніше, можливо, файли розкладу. Воркер за розкладом забирає сторінки, спершу зберігає їх як є, потім розбирає, порівнює з тим, що вже є, перевіряє, чи прохід не зламаний, і тільки тоді застосовує зміни та пише їх у журнал. API тільки читає. Rate UKMA, інші проєкти й адміни ходять лише через API з ключем.
-->

---

## Джерела

| Джерело | Що беремо | Вхід | Як часто |
|---|---|---|---|
| САЗ | каталог, картки курсів, списки записаних | Microsoft, далі cookie | щогодини під час запису, щодня поза ним |
| smart.ukma | викладачі, їхні дисципліни | Microsoft, далі токен | щодня |
| Файли розкладу | пари й аудиторії | без входу | можливо, пізніше |

<p class="doing">Нове джерело це нова папка з чотирма частинами: вхід, що забирати, розбір, перетворення в наші записи.</p>

<!--
Джерел поки два. Із САЗ беремо каталог, картки курсів і списки записаних. Зі smart.ukma беремо викладачів і те, які дисципліни вони ведуть. Обидва входять через Microsoft-акаунт. Минулі роки парсимо один раз. Головна вимога: додати нове джерело має бути просто. Тому кожне джерело це окрема папка з чотирма частинами, а все після них спільне. Схему бази для нового джерела міняти не треба.
-->

---

## Як парсимо САЗ

<svg class="dg wide" viewBox="0 0 1000 150" role="img" aria-label="Чотири кроки парсингу САЗ">
<defs><marker id="a7" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd ac" x="0" y="20" width="220" height="110" rx="12"/>
<text class="ac" x="18" y="54">1. Вхід</text>
<text class="mu" x="18" y="84">браузер один раз,</text>
<text class="mu" x="18" y="106">далі тільки cookie</text>
<path class="ln ac" d="M220 75 H256" marker-end="url(#a7)"/>
<rect class="bd" x="260" y="20" width="220" height="110" rx="12"/>
<text x="278" y="54">2. Каталог</text>
<text class="mu" x="278" y="84">/course/catalog</text>
<text class="mu" x="278" y="106">20 курсів на сторінку</text>
<path class="ln ac" d="M480 75 H516" marker-end="url(#a7)"/>
<rect class="bd" x="520" y="20" width="220" height="110" rx="12"/>
<text x="538" y="54">3. Картка</text>
<text class="mu" x="538" y="84">/course/{id}</text>
<text class="mu" x="538" y="106">HTML у поля</text>
<path class="ln ac" d="M740 75 H776" marker-end="url(#a7)"/>
<rect class="bd" x="780" y="20" width="218" height="110" rx="12"/>
<text x="798" y="54">4. Записані</text>
<text class="mu" x="798" y="84">/course/{id}/students</text>
<text class="mu" x="798" y="106">готовий JSON</text>
</svg>

<p class="cap">Далі звичайний HTTP: 4 паралельні запити, 150 мс між ними, повторний вхід, якщо сесія скінчилась</p>

<p class="doing">Беремо парсер UKMA Schedule і додаємо три поля, яких у ньому нема.</p>

<!--
Як саме парсимо САЗ. Браузер потрібен тільки щоб увійти через Microsoft. Далі забираємо cookie і ходимо звичайними HTTP-запитами, це в рази швидше, ніж відкривати браузер на кожну сторінку, як робить старий парсер. Каталог дає список курсів, картка курсу дає всі поля, а список записаних САЗ віддає вже як JSON. Цей парсер уже працює в UKMA Schedule щогодини. Йому бракує трьох полів, які показує Rate UKMA: статусу курсу, викладача текстом і анотації. Їх перенесемо зі старого Python-парсера.
-->

---

## Картка курсу: що забираємо

<div class="cols" style="gap:28px">
<div class="mock">
<div class="row"><span class="muted">Код</span><span>123456</span></div>
<div class="row"><span class="muted">Навчальний рік</span><span>2026-2027</span></div>
<div class="row"><span class="muted">Статус</span><span>можливо</span></div>
<div class="row"><span class="muted">Кафедра</span><span>Кафедра інформатики</span></div>
<div class="row"><span class="muted">Рік навчання</span><span>2</span></div>
<div class="row"><span class="muted">Викладач</span><span>Петренко О. І., доцент</span></div>
<div class="row"><span class="muted">Спеціальності</span><span>ІПЗ, обов'язкова</span></div>
<div class="row"><span class="muted">Осінь</span><span>4 кр, 3 год/тиж, залік</span></div>
<div class="row"><span class="muted">Весна</span><span>4 кр, 3 год/тиж, екзамен</span></div>
<div class="row"><span class="muted">Ліміт</span><span>60 студентів, 3 групи</span></div>
</div>
<div>

```json
{
  "sazCode": "123456",
  "title": "Бази даних",
  "academicYear": 2026,
  "status": "PENDING",
  "level": "BACHELOR",
  "studyYear": 2,
  "teacherText": "Петренко О. І., доцент",
  "limits": { "maxStudents": 60, "maxGroups": 3 },
  "programmes": [
    { "name": "Інженерія програмного забезпечення",
      "kind": "COMPULSORY" }
  ],
  "terms": [
    { "term": "2026-27-FALL", "credits": 4,
      "hoursPerWeek": 3, "assessment": "CREDIT" },
    { "term": "2026-27-SPRING", "credits": 4,
      "hoursPerWeek": 3, "assessment": "EXAM" }
  ]
}
```

</div>
</div>

<p class="cap">Значення вигадані, поля справжні</p>

<!--
Ось як виглядає одна картка і що з неї виходить. Зліва поля, які бачить студент у САЗ, справа запис після розбору. Важливо: семестрів у курсу може бути кілька, і в кожного свої кредити, години і форма контролю. Статус «можливо», «відбувся», «не відбувся» стає PENDING, HELD, NOT_HELD. Значення тут вигадані, а назви полів справжні.
-->

---

## Списки записаних

<p class="big">САЗ віддає список записаних як JSON із 17 полями, і його бачить будь-який студент.</p>

<div class="cols">
<div>

<p class="muted small">САЗ віддає</p>

<p class="small"><s>name</s>, email, <s>cdoc</s>, grade, specName, group, status, statusLabel, isStudentActive, isEnrolled, isUnenrolled, isForced, type, typeLabel, createdAt, updatedAt, statusDescription</p>

</div>
<div>

<p class="muted small">Ми зберігаємо</p>

```json
{
  "email": "s.example@ukma.edu.ua",
  "status": "ENROLLED",
  "studentActive": true,
  "programme": "prg_01k6...",
  "studyYear": 2,
  "group": "1"
}
```

</div>
</div>

<p class="doing">Імена і номери документів відкидаємо одразу при розборі.</p>

<!--
Списки записаних найчутливіші. САЗ віддає сімнадцять полів на кожного студента, включно з іменем, і будь-який студент може відкрити будь-який курс. Ми залишаємо тільки email, статус, чи студент ще навчається, програму, рік і групу. Ім'я викидаємо прямо в парсері, тобто воно навіть не потрапляє в базу. Сирі відповіді зі списками теж не зберігаємо.
-->

---

## Як парсимо smart.ukma

<p class="big">smart.ukma має REST API з описом в OpenAPI, і ПІБ викладачів там уже розділені.</p>

<div class="cols">
<div>

<div class="facts">
<p><b>839</b> викладачів</p>
<p><b>8 195</b> зв'язків викладач і дисципліна</p>
<p><b>11 033</b> дисципліни</p>
<p><b>5,5 с</b> повна вибірка зв'язків</p>
</div>

</div>
<div>

```http
GET /api/teacher/disciplines
    ?restrict={"limit":1000,"offset":0}
Authorization: Bearer <токен зі сторінки>
```

<p class="cap">Вхід такий самий, як у САЗ, токен беремо зі сторінки після входу</p>

</div>
</div>

<p class="doing">Беремо викладачів, їхні ролі і дисципліни щодня.</p>

<!--
smart.ukma зроблений набагато зручніше: це Angular поверх Java API, і весь опис API лежить відкрито в OpenAPI. Входимо так само через Microsoft, з'являється токен, і далі звичайні запити. Повна вибірка зв'язків викладачів з дисциплінами займає п'ять з половиною секунд. Імена вже розділені на прізвище, ім'я і по батькові, тож не треба вгадувати порядок, як зараз із корпоративною поштою.
-->

---

## Як зв'язати викладача з курсом

<p class="big">Спільного ключа між сайтами поки не видно: за назвою пару мають 72% курсів.</p>

<div class="cols3">
<div class="track now">
<h3>1. Код</h3>
<p>optimaCode у smart.ukma, 6 цифр, як код САЗ</p>
<p class="muted">точно, якщо заповнений</p>
</div>
<div class="track">
<h3>2. Назва</h3>
<p>назва, кафедра, семестр, кредити</p>
<p class="muted">57% курсів отримують викладача</p>
</div>
<div class="track">
<h3>3. Вручну</h3>
<p>адмін виправляє в адмінці</p>
<p class="muted">має пріоритет над усім</p>
</div>
</div>

<p class="doing">Кожен зв'язок зберігає, як його знайшли і наскільки ми впевнені.</p>

<!--
Найскладніше: зв'язати дисципліну зі smart.ukma з курсом у САЗ. У контракті smart.ukma є поле optimaCode на шість цифр, як код курсу в САЗ. Якщо воно заповнене і збігається, зв'язок точний. Двадцять четвертого вересня в усіх рядках, які я дивився, воно було порожнє, тому це треба перевірити на всій вибірці. Запасний варіант: назва, кафедра, семестр і кредити. Лише за назвою пару знаходять сімдесят два відсотки курсів двадцять шостого року і пізніше, і п'ятдесят сім відсотків отримують викладача. Ще є текст «Викладач» з картки САЗ. А ручне виправлення в адмінці завжди важливіше за автоматику.
-->

---

## Спочатку сирі сторінки

<p class="big">Без сирих сторінок кожне нове поле означає знову пройти 24 124 картки САЗ.</p>

<svg class="dg wide" viewBox="0 0 1000 210" role="img" aria-label="Три шари даних і що з чого перераховується">
<defs><marker id="a11r" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd ac" x="0" y="20" width="288" height="90" rx="12"/>
<text class="ac" x="20" y="56">1. Сирі сторінки</text>
<text class="mu" x="20" y="86">як віддало джерело</text>
<path class="ln ac" d="M288 65 H351" marker-end="url(#a11r)"/>
<rect class="bd" x="355" y="20" width="288" height="90" rx="12"/>
<text x="375" y="56">2. Записи джерел</text>
<text class="mu" x="375" y="86">поля карток, викладачі</text>
<path class="ln ac" d="M643 65 H706" marker-end="url(#a11r)"/>
<rect class="bd" x="710" y="20" width="288" height="90" rx="12"/>
<text x="730" y="56">3. Похідні дані</text>
<text class="mu" x="730" y="86">групи курсів, хто веде</text>
<text class="mu" x="20" y="164">списки записаних</text>
<text class="al" x="20" y="192">не зберігаємо</text>
<text class="mu" x="375" y="164">змінили парсер</text>
<text x="375" y="192">розбираємо збережене</text>
<text class="mu" x="730" y="164">змінили правило</text>
<text x="730" y="192">перераховуємо з бази</text>
</svg>

<p class="doing">Спершу зберігаємо сторінку, потім розбираємо, тому перерахунок не ходить у САЗ.</p>

<!--
Тепер принцип, який тримає все інше. Модель ще мінятиметься, і парсер теж, тому воркер спершу зберігає сторінку рівно так, як її віддав САЗ чи smart.ukma, і тільки потім розбирає збережену копію. Зберігаємо тільки якщо сторінка змінилась, це видно за хешем. Виходить три шари. Сирі сторінки. Записи джерел, тобто поля кожної картки і кожного викладача з їхніми кодами в джерелі. І похідні дані: групи курсів через роки і хто який курс веде, плюс рішення адміна, які лежать окремими рядками. Що це дає. Знайшли помилку в парсері чи захотіли нове поле: розбираємо збережені сторінки ще раз, у САЗ не ходимо. Змінили правило групування: перераховуємо з бази, а рішення адміна накладаються зверху і не губляться. Новий обхід потрібен тільки для сторінок, яких ми ще ніколи не забирали. Виняток це списки записаних: там імена, тому сирими їх не зберігаємо. Місця треба мало. Картка курсу з тестів UKMA Schedule важить вісімнадцять кілобайт, стиснута п'ять з половиною. Усі двадцять чотири тисячі карток це близько ста тридцяти мегабайт, а далі додаються тільки змінені. Тому тримаємо їх завжди.
-->

---

## Модель даних

<svg class="dg" viewBox="0 0 1000 370" role="img" aria-label="Сутності і зв'язки моделі даних">
<rect class="bd" x="0" y="10" width="180" height="64" rx="12"/>
<text x="16" y="38">Faculty</text>
<text class="mu" x="16" y="60">факультет</text>
<rect class="bd" x="200" y="10" width="180" height="64" rx="12"/>
<text x="216" y="38">Department</text>
<text class="mu" x="216" y="60">кафедра</text>
<rect class="bd" x="400" y="10" width="180" height="64" rx="12"/>
<text x="416" y="38">Course</text>
<text class="mu" x="416" y="60">предмет через роки</text>
<rect class="bd" x="0" y="150" width="180" height="64" rx="12"/>
<text x="16" y="178">Programme</text>
<text class="mu" x="16" y="200">освітня програма</text>
<rect class="bd" x="200" y="150" width="180" height="64" rx="12"/>
<text x="216" y="178" font-size="16">OfferingProgramme</text>
<text class="mu" x="216" y="200">обов'язковий чи ні</text>
<rect class="bd ac" x="400" y="150" width="180" height="64" rx="12"/>
<text class="ac" x="416" y="178">Offering</text>
<text class="mu" x="416" y="200">картка САЗ на рік</text>
<rect class="bd" x="600" y="150" width="180" height="64" rx="12"/>
<text x="616" y="178">OfferingTerm</text>
<text class="mu" x="616" y="200">кредити за семестр</text>
<rect class="bd" x="800" y="150" width="180" height="64" rx="12"/>
<text x="816" y="178">Term</text>
<text class="mu" x="816" y="200">2026-27-FALL</text>
<rect class="bd new" x="200" y="290" width="180" height="64" rx="12"/>
<text x="216" y="318">Enrollment</text>
<text class="mu" x="216" y="340">обмежений доступ</text>
<rect class="bd" x="600" y="290" width="180" height="64" rx="12"/>
<text x="616" y="318" font-size="16">OfferingInstructor</text>
<text class="mu" x="616" y="340">роль, метод, впевн.</text>
<rect class="bd" x="800" y="290" width="180" height="64" rx="12"/>
<text x="816" y="318">Instructor</text>
<text class="mu" x="816" y="340">зі smart.ukma</text>
<path class="ln" d="M180 42 H200"/>
<path class="ln" d="M380 42 H400"/>
<path class="ln ac" d="M490 74 V150"/>
<path class="ln" d="M90 74 V150"/>
<path class="ln" d="M180 182 H200"/>
<path class="ln ac" d="M380 182 H400"/>
<path class="ln ac" d="M580 182 H600"/>
<path class="ln" d="M780 182 H800"/>
<path class="ln ac" d="M450 214 V322 H380"/>
<path class="ln ac" d="M530 214 V322 H600"/>
<path class="ln" d="M780 322 H800"/>
</svg>

<p class="doing">Центр моделі це Offering: одна картка курсу в САЗ на один навчальний рік.</p>

<!--
Модель даних. Центр це Offering, одна картка курсу в САЗ на один навчальний рік. Вона належить до Course, тобто предмета через роки, а той до кафедри і факультету. В Offering є семестри з кредитами й формою контролю, програми, для яких курс обов'язковий чи вибірковий, викладачі зі smart.ukma і записані студенти. Записи мають обмежений доступ. Окремо є Run і Change, сирі сторінки і рішення адміна: це не предметна область, а службові таблиці, про них далі.
-->

---

## Модель: каталог

<style scoped>table { font-size: 19px; } td { padding-top: 7px; padding-bottom: 7px; }</style>

| Сутність | Що це | Основні поля |
|---|---|---|
| Term | семестр | `2026-27-FALL`, academicYear, season |
| Faculty | факультет | name, abbreviation |
| Department | кафедра | faculty, name |
| Programme | освітня програма | name, level: BACHELOR чи MASTER |
| Course | предмет через роки | групу задає правило або адмін, назва з останньої картки |
| Offering | картка САЗ на рік | sazCode, academicYear, title, department, level, status, studyYear, limits, annotation, teacherText |
| OfferingTerm | семестр курсу | term, credits, hoursPerWeek, lectures, practice, assessment |
| OfferingProgramme | роль для програми | programme, kind: COMPULSORY, PROF_ORIENTED, ELECTIVE |

<p class="cap">У кожної сутності свій id і мітки first_seen, last_seen, removed</p>

<!--
Каталог. Term це один семестр навчального року, і в ідентифікаторі є обидва роки, двадцять шостий-двадцять сьомий, бо Rate UKMA і САЗ рахують рік по-різному і на цьому легко помилитися. Offering має код САЗ, рік, власну назву, кафедру і рівень, статус, рік навчання, ліміти, анотацію і викладача текстом з картки. Назва і кафедра лежать саме на картці, а не тільки на курсі: тоді групи можна перерахувати з бази, навіть якщо адмін уже злив два курси з різними назвами. Семестри і програми лежать окремо, бо їх може бути кілька.
-->

---

## Модель: люди, проходи, рішення

| Сутність | Що це | Основні поля |
|---|---|---|
| Instructor | викладач зі smart.ukma | lastName, firstName, middleName, department, email (обмежено) |
| OfferingInstructor | хто веде курс | role: LECTURER, PRACTICE, BOTH; method; confidence |
| Enrollment | студент на курсі, обмежено | email, status: ENROLLED, DROPPED, FORCED; studentActive; programme; group |
| Run | один прохід воркера | source, resource, status: PUBLISHED, HELD, FAILED; лічильники |
| Change | одна зміна в даних | seq, run, entity, op: ADDED, CHANGED, REMOVED; було і стало |
| RawPage | сира сторінка | source, url, sha256, fetchedAt |
| Override | рішення адміна | target, action: MERGE, SPLIT, MOVE, LINK; reason |

<p class="cap">Імен студентів у моделі нема</p>

<!--
Люди й оновлення. Викладач приходить зі smart.ukma з розділеним ПІБ, а email викладача видно тільки з окремим правом. Зв'язок викладача з курсом має роль, метод, яким його знайшли, і впевненість. Запис студента: email, статус, чи студент ще навчається, програма і група. Run це один прохід воркера, Change одна зміна. RawPage це сира сторінка, Override рішення адміна: злити, поділити, перенести картку, прив'язати викладача. Саме з Change будується і стрічка змін для читачів, і сторінка «що нового» в адмінці.
-->

---

## Один курс, два семестри

<p class="big">1 989 з 24 124 карток курсів у САЗ ідуть два або три семестри, а Rate UKMA зберігає тільки останній.</p>

<svg class="dg wide" viewBox="0 0 1000 140" role="img" aria-label="Курс на весь рік і де він лежить у Rate UKMA">
<rect class="bd ac" x="0" y="20" width="300" height="100" rx="12"/>
<text class="ac" x="20" y="54">Картка САЗ</text>
<text class="mu" x="20" y="82">Бази даних, 2026-2027</text>
<text class="mu" x="20" y="106">8 кр на весь рік</text>
<rect class="bd" x="350" y="20" width="300" height="100" rx="12"/>
<text x="370" y="54">Сервіс</text>
<text class="mu" x="370" y="82">осінь: 4 кр, залік</text>
<text class="mu" x="370" y="106">весна: 4 кр, екзамен</text>
<rect class="bd" x="700" y="20" width="298" height="100" rx="12"/>
<text x="720" y="54">Rate UKMA зараз</text>
<text class="al" x="720" y="82">тільки весна 2027</text>
<text class="al" x="720" y="106">і тільки екзамен</text>
</svg>

<p class="doing">Сервіс віддає всі семестри курсу і не вигадує йому один «семестр».</p>

<!--
Приклад, чому семестри окремо. Курс на весь рік, восени залік, навесні екзамен. Rate UKMA зараз кладе його тільки у весну, бо бере останній семестр, і показує тільки екзамен. Тобто восени, коли курс реально йде, у фільтрі за осінь його може не бути. Таких карток майже дві тисячі з двадцяти чотирьох. Сервіс віддає всі семестри, а як показувати, вирішує кожен читач.
-->

---

## Курси через роки

<p class="big">У Rate UKMA курс це однакова назва, кафедра і рівень, тому «Бази даних» склеїли два різні предмети.</p>

<svg class="dg wide" viewBox="0 0 1000 170" role="img" aria-label="Один курс у Rate UKMA і два предмети насправді">
<defs><marker id="a16" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd" x="0" y="20" width="420" height="130" rx="12"/>
<text x="20" y="54">Rate UKMA: один курс</text>
<text class="mu" x="20" y="86">ІПЗ, весь рік, 13 карток з 2019</text>
<text class="mu" x="20" y="112">аналіз вразливостей, тільки осінь</text>
<text class="al" x="20" y="138">11 оцінок усереднені разом</text>
<path class="ln ac" d="M420 85 H526" marker-end="url(#a16)"/>
<text class="mu" x="440" y="74">поділ</text>
<rect class="bd ac" x="530" y="20" width="468" height="60" rx="12"/>
<text x="550" y="56">Бази даних, ІПЗ, весь рік</text>
<rect class="bd ac" x="530" y="90" width="468" height="60" rx="12"/>
<text x="550" y="126">Бази даних, аналіз вразливостей, осінь</text>
</svg>

<p class="doing">Сервіс стартує з груп Rate UKMA і сам нічого не переносить: злиття і поділ робить адмін.</p>

<!--
Групування курсів через роки робить сервіс, бо воно потрібне всім: планувальнику, аналітиці, і щоб проєкти могли посилатися один на одного. Але це найризикованіше місце: від групи залежать сторінки курсів і оцінки в Rate UKMA. Тому правила такі. Стартуємо з поточних груп Rate UKMA, щоб у перший день нічого не змінилося. Нові картки автоматично додаються в групи, а вже розкладені ніколи не переїжджають самі. Злиття і поділ робить адмін, і це видно в журналі змін. Рішення адміна лежать окремо, тому, якщо ми змінимо правило і перерахуємо групи, вони не загубляться, а все, що перерахунок хоче перенести, адмін бачить як пропозицію. Оцінки в Rate UKMA прив'язані до карток, тому при поділі вони просто переходять разом із картками. Адмінка показуватиме підозрілі групи, як оця.
-->

---

## Ідентифікатори

<p class="big">Наш id не змінюється, навіть якщо джерело змінить свій.</p>

<svg class="dg wide" viewBox="0 0 1000 130" role="img" aria-label="Два id джерел ведуть до одного нашого id">
<defs><marker id="a17" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd" x="0" y="0" width="300" height="56" rx="12"/>
<text x="20" y="34">САЗ: факультет 901</text>
<rect class="bd" x="0" y="72" width="300" height="56" rx="12"/>
<text x="20" y="106">smart.ukma: факультет 7</text>
<path class="ln ac" d="M300 28 H420 V58 H496" marker-end="url(#a17)"/>
<path class="ln ac" d="M300 100 H420 V70 H496" marker-end="url(#a17)"/>
<rect class="bd ac" x="500" y="36" width="498" height="56" rx="12"/>
<text class="ac" x="520" y="70">fac_01k6c3f9q2m4w7t5r0v6y1z3bc</text>
</svg>

<p class="doing">Id джерел лишаються ключами для пошуку: /v1/offerings?sazCode=123456.</p>

<!--
Кожна сутність має наш власний id: префікс типу і час-упорядкований UUID, так званий TypeID. Префікс одразу показує, що це: fac факультет, off картка курсу, crs курс. Навіщо свій id: один факультет у САЗ має один номер, у smart.ukma інший, а курс через роки взагалі не має id в джерелі. Id джерел зберігаємо як ключі для пошуку. Номери на слайді вигадані.
-->

---

## Оновлення і журнал змін

<p class="big">Зламаний прохід не має дійти до читачів.</p>

<svg class="dg wide" viewBox="0 0 1000 110" role="img" aria-label="П'ять кроків одного проходу">
<defs><marker id="a18" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd" x="0" y="20" width="168" height="70" rx="12"/>
<text x="16" y="62">Забрати</text>
<path class="ln ac" d="M168 55 H200" marker-end="url(#a18)"/>
<rect class="bd" x="204" y="20" width="168" height="70" rx="12"/>
<text x="220" y="62">Розібрати</text>
<path class="ln ac" d="M372 55 H404" marker-end="url(#a18)"/>
<rect class="bd" x="408" y="20" width="168" height="70" rx="12"/>
<text x="424" y="62">Порівняти</text>
<path class="ln ac" d="M576 55 H608" marker-end="url(#a18)"/>
<rect class="bd ac" x="612" y="20" width="168" height="70" rx="12"/>
<text class="ac" x="628" y="62">Перевірити</text>
<path class="ln ac" d="M780 55 H812" marker-end="url(#a18)"/>
<rect class="bd now" x="816" y="20" width="182" height="70" rx="12"/>
<text class="wh" x="832" y="62">Застосувати</text>
</svg>

<p class="cap">Приклад: прохід бачить набагато менше курсів, ніж минулий, тому чекає на адміна і нічого не змінює</p>

<p class="doing">Кожна зміна йде в журнал, і читачі синхронізуються з нього: GET /v1/changes?after=4810.</p>

<!--
Один прохід воркера це п'ять кроків. Забрати сторінки, розібрати, порівняти з тим, що є в базі, перевірити і тільки тоді застосувати в одній транзакції. Перевірка ловить зламаний прохід: наприклад, САЗ віддав половину курсів, бо щось лягло. Такий прохід чекає на адміна і нічого не видаляє. Усі застосовані зміни йдуть у журнал з номером, і читач просто питає: дай усе після номера такого-то, включно з видаленнями. Перерозбір збережених сторінок іде тим самим шляхом, тільки без першого кроку, тому читачі бачать його як звичайний прохід.
-->

---

## Адмінка

<p class="big">Видно кожен прохід і що саме він змінив.</p>

<div class="mock">
<table>
<tr><th>Прохід</th><th>Джерело</th><th>Що</th><th>Коли</th><th>Стан</th><th>+ / ~ / −</th></tr>
<tr><td>run_01k6…</td><td>САЗ</td><td>картки курсів</td><td>3 жов, 06:00</td><td class="ok">застосовано</td><td>12 / 38 / 1</td></tr>
<tr><td>run_01k6…</td><td>САЗ</td><td>списки записаних</td><td>3 жов, 06:20</td><td class="ok">застосовано</td><td>0 / 410 / 22</td></tr>
<tr><td>run_01k5…</td><td>САЗ</td><td>картки курсів</td><td>2 жов, 06:00</td><td class="bad">чекає</td><td>0 / 3 / 2104</td></tr>
<tr><td>run_01k5…</td><td>smart.ukma</td><td>викладачі</td><td>2 жов, 05:00</td><td class="ok">застосовано</td><td>4 / 9 / 0</td></tr>
</table>
</div>

<p class="cap">Значення вигадані. Клік на прохід показує зміни поле за полем: було і стало</p>

<p class="doing">Проста HTML-сторінка в тому самому сервісі, вхід за ключем адміна.</p>

<!--
Адмінка. Це не окремий фронтенд, а прості HTML-сторінки в тому самому сервісі на Effect. Видно всі проходи: скільки додано, змінено, видалено. Третій рядок це той самий зламаний прохід, який хотів видалити дві тисячі курсів, і він чекає на рішення. Клік на прохід показує кожну зміну. Записи студентів тут тільки кількістю, без email. Ще тут будуть ключі, аудит і підозрілі групи курсів.
-->

---

## API

| Запит | Що віддає | Доступ |
|---|---|---|
| `GET /v1/terms`, `/faculties`, `/departments`, `/programmes` | довідники | відкритий |
| `GET /v1/courses`, `/courses/{id}` | курси з картками за роки | відкритий |
| `GET /v1/offerings?term=&programme=&sazCode=` | картки з семестрами і програмами | відкритий |
| `GET /v1/instructors`, `/offerings/{id}/instructors` | викладачі і хто що веде | відкритий |
| `GET /v1/enrollments?email=` | записи одного студента | обмежений |
| `GET /v1/changes?after=` | журнал змін | за правами ключа |
| `GET /v1/runs` | проходи і свіжість даних | відкритий |

<p class="cap">Тільки читання. OpenAPI генеруємо з коду, зміна, що ламає читачів, йде в /v2</p>

<!--
API тільки на читання. Довідники, курси, картки з фільтрами за семестром, програмою і кодом САЗ, викладачі, записи одного студента за email і журнал змін. Записи віддаємо тільки з окремим правом. Опис API генерується з коду на Effect, тому завжди збігається з реальністю. Якщо колись треба зламати формат, робимо другу версію, а перша живе далі.
-->

---

## Ключі і права

<div class="cols">
<div>

| Рівень | Права |
|---|---|
| Відкритий | каталог, викладачі, проходи |
| Обмежений | записи студентів, email викладачів |
| Адмін | ключі, аудит, ручний прохід |

</div>
<div>

```sh
$ ukma-data keys create \
    --name rate-ukma \
    --scopes catalog:read,enrollments:read \
    --expires 2027-09-01
ukd_k7q2m9xa_...   # показуємо один раз
```

</div>
</div>

<p class="doing">Ключі на старті створює тільки адмін, і кожне читання обмежених даних пишемо в аудит.</p>

<!--
Ключі. На старті їх створює тільки адмін, командою на сервері. Ключ показуємо один раз, зберігаємо тільки хеш, у ключа є термін дії, і його можна відкликати. Права три рівні: відкритий, обмежений і адмін. Rate UKMA отримає каталог і записи студентів. Аудит пише, хто створив чи відкликав ключ і кожне читання обмежених даних, але без самих даних. Ключі для студентів, можливо, пізніше, якщо хтось попросить.
-->

---

## Персональні дані

<p class="big">Сервіс зберігатиме, хто які курси обрав, тому правила потрібні до першого запуску.</p>

- Тільки **email і статус**, без імен
- **Сирі списки** не зберігаємо
- **Справжніх даних** нема у фікстурах, логах і задачах
- Тримаємо лише роки, які **можна оцінювати**
- Дані студента **видаляємо на запит**

<p class="doing">Попросимо в університету сервісний акаунт і згоду на зберігання.</p>

<!--
Персональні дані. У сервісі будуть записи практично всіх студентів, і зібрані вони через акаунт одного студента. Тому правила треба прийняти до першого запуску: тільки email і статус, без імен, сирі списки не зберігаємо, справжніх даних ніде в репозиторії. І через керівника попросимо в університету сервісний акаунт і письмову згоду, бо зараз обидва парсери ходять під особистим акаунтом.
-->

---

## Rate UKMA як читач

<p class="big">Rate UKMA читає записи тільки студента, який увійшов, тому близько 90% записів йому не потрібні.</p>

<svg class="dg wide" viewBox="0 0 1000 110" role="img" aria-label="Як Rate UKMA синхронізується із сервісом">
<defs><marker id="a22" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="hd ac"/></marker></defs>
<rect class="bd" x="0" y="20" width="230" height="70" rx="12"/>
<text x="18" y="52">Журнал змін</text>
<text class="mu" x="18" y="76">щодня</text>
<path class="ln ac" d="M230 55 H252" marker-end="url(#a22)"/>
<rect class="bd" x="256" y="20" width="230" height="70" rx="12"/>
<text x="274" y="52">Знайти картку</text>
<text class="mu" x="274" y="76">за кодом САЗ</text>
<path class="ln ac" d="M486 55 H508" marker-end="url(#a22)"/>
<rect class="bd" x="512" y="20" width="230" height="70" rx="12"/>
<text x="530" y="52">Записи студента</text>
<text class="mu" x="530" y="76">при вході і щоночі</text>
<path class="ln ac" d="M742 55 H764" marker-end="url(#a22)"/>
<rect class="bd now" x="768" y="20" width="230" height="70" rx="12"/>
<text class="wh" x="786" y="52">Старий парсер</text>
<text class="wh" x="786" y="76" font-size="16">видаляємо</text>
</svg>

<p class="doing">Rate UKMA отримує команду синхронізації, а папка scraper/ зникає.</p>

<!--
Як Rate UKMA стає звичайним читачем. Раз на день він бере журнал змін і знаходить свої картки за кодом САЗ. Записи студентів бере тільки для того, хто увійшов: при вході і щоночі для тих, хто вже має акаунт. Я перевірив код: Rate UKMA читає записи тільки для поточного студента, у перевірці оцінки, у перевірці голосу і на сторінці «мої курси». Тобто близько дев'яноста відсотків з п'ятсот сорока шести тисяч записів йому не потрібні. Після переходу старий парсер видаляємо.
-->

---

## План до 1 грудня

<div class="cols">
<div>

<div class="track now" style="margin-bottom:12px">
<h3>1. Каркас</h3>
<p class="muted">Сервер, база, ключі, один запит, OpenAPI у CI, деплой у staging</p>
</div>
<div class="track now">
<h3>2. САЗ</h3>
<p class="muted">Сирі сторінки за всі роки, парсер, журнал змін, перевірка, адмінка</p>
</div>

</div>
<div>

<div class="track" style="margin-bottom:12px">
<h3>3. Rate UKMA читає API</h3>
<p class="muted">Синхронізація, записи за студентом, старий парсер видалено</p>
</div>
<div class="track">
<h3>4. Викладачі</h3>
<p class="muted">smart.ukma, зв'язок з курсами, виправлення в адмінці</p>
</div>

</div>
</div>

<p class="cap">Сервіс: Андрій Валеня. Інфраструктура: Анастасія Алексєєнко (#705)</p>

<!--
План до першого грудня: чотири кроки. Спочатку каркас, щоб один запит з ключем працював у staging. Потім САЗ, і першим ділом сирі сторінки за всі роки: тоді модель і парсер доводимо на справжніх даних, не ходячи в САЗ знову. Далі парсер, журнал змін і адмінка. Потім Rate UKMA переходить на API і ми видаляємо старий парсер. І останнє, викладачі зі smart.ukma. Кожен крок має перевірку: наприклад, після третього дані в Rate UKMA не старші за добу.
-->

---

## Відкриті питання

1. Записи студентів: тільки пошук за email чи ще й повний список?
2. Хто в університеті погоджує зберігання списків і як довго їх тримаємо?
3. Чи увійде воркер без людини: MFA, скільки живуть сесія і токен?
4. Чи можна зв'язати smart.ukma і САЗ за optimaCode?
5. Назва: data.rateukma.com підходить?
6. Хто підтримує сервіс після курсу?

<!--
І відкриті питання. Перше: чи даємо записи тільки пошуком за email, я за це. Друге і шосте організаційні: хто погоджує зберігання даних студентів і хто підтримуватиме сервіс, коли курс закінчиться. Третє і четверте технічні, їх я перевірю на цьому тижні. І п'яте: назва. Пропоную data.rateukma.com.
-->

---

<!-- _class: closing -->
<!-- _paginate: false -->

<div class="wordmark"><img src="assets/logo.png" alt=""><span>Rate <strong>UKMA</strong></span></div>

# Дякую. Питання?

<p class="muted small">data.rateukma.com, робоча назва</p>
<p class="muted small">Ця презентація зроблена з ШІ та вичитана людьми)</p>

<!--
Дякую, готовий відповісти на питання.
-->
