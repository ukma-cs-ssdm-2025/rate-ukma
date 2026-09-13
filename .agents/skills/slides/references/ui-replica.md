# UI replicas

A screenshot on a slide reads as a screenshot, and the real Rate UKMA course page shows
instructor names under the reviews, which must never ship in a repo. Build the panel in
markup instead and take the numbers from the running app:

```js
getComputedStyle(el).fontSize   // and .color, .borderRadius, .padding
el.getBoundingClientRect()      // widths, heights, gaps
```

## Measured Rate UKMA values

| Element | Value |
|---|---|
| Viewport / container | 1440 / 1280 |
| Header | 65px tall, 24px side padding |
| Course title | 36px / 700 / letter-spacing -0.9px / line-height 40px |
| Meta line | 14px zinc-500, «Бакалавр» a grey chip with 6px radius, no border |
| Pills | 12px / 500, padding 2px 10px, radius 999; violet `#7c3aed` on `#f3e8ff`, blue `#0369a1` on `#e0f2fe`, amber `#b45309` on `#fef3c7` |
| Annotation | 15px, line-height 24px, zinc-500 |
| Rating card | 608x158, padding 20, radius 14, border `#e4e4e7`, grid gap 16 |
| Rating number | 48px / 700; difficulty `#f59e0b`, usefulness `#71717a` |
| Segments | five, 6px tall, gap 6, track `#f4f4f5` |

`.app` is declared at real pixel width (640 inside a half panel) and scaled as a whole with
`transform: scale(...)`, so every proportion stays 1:1 instead of being re-guessed.

## Panel rules

- Two panels: `<div class="cols" style="gap:24px">` with two `appframe half`.
- Both frames need the same fixed height. The height must exceed the scaled content by a few
  pixels, otherwise `overflow: hidden` clips the card's 1px bottom border and the panel looks
  unfinished.
- Drop chrome that carries no information. The theme toggle, bell and avatar rendered as grey
  squares and read as loading skeletons.
- A panel with one third empty looks broken: fill it with what the real page has (annotation,
  both ratings) or move content in from the other side.
- Entry points belong on the title row: `.head` holds the `h4` and the `.btn` pushed right.

## Markup skeleton

```html
<div class="appframe half"><div class="app">
  <div class="bar"><span class="mark"><i></i>Rate <b>UKMA</b></span></div>
  <div class="body">
    <div class="head"><h4>Курс</h4><span class="btn">Додати в ІНП</span></div>
    <div class="meta"><b>Бакалавр</b><span>Факультет</span></div>
    <div class="pills"><span class="pill v">ІПЗ</span><span class="pill b">4 ECTS</span><span class="pill a">Осінь</span></div>
    <p class="lead">Анотація курсу.</p>
    <div class="rates">
      <div class="rate hard"><div class="n">3.4</div><div class="k">Складність</div>
        <div class="segs"><span class="on"></span><span></span></div><div class="h">Підпис</div></div>
      <div class="rate use">…</div>
    </div>
  </div>
</div></div>
```

Reviews panel: `.revhead` with a count `<b>` and right-aligned `.sort`, then one `.rev` per
review with `.top`, `u`, `.who`, `.when`, `.sc` and a `<p>`. The plan nests `.plan` inside
`.body`. `.appframe` without `half` is a full-width panel; `.addinp` is a button row for a
fragment without a title.

## Data in a replica

- Course names, credits, ratings and enrolment counts are course data and may be real.
- Reviews stay anonymous and their text is written for the slide.
- Never a student or instructor name, never a real avatar.
