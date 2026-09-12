---
name: slides
description: "Build or edit a Marp deck in docs/presentations of this repo. EXPLICIT ONLY: use when the message starts with /slides, or says «зроби слайди», «онови презентацію», «render the deck». Never trigger on other doc or markdown work."
---

# Slides

Decks live in `docs/presentations/<deck>/slides.md` and share `docs/presentations/theme.css`.
`fall-2026` is the reference deck: copy its structure before inventing one.

```sh
node docs/presentations/render.mjs fall-2026              # slides.html + slides.pdf with notes
node docs/presentations/render.mjs fall-2026 --png /tmp/d # one image per slide, for review
```

Same command on macOS, Linux and Windows. `render.sh` is a wrapper around it.
Details and gotchas: `references/rendering.md`.

## Slide anatomy

A feature slide is exactly three parts, in this order:

```markdown
## 2. Парсер САЗ

<p class="big">Парсер є, але заливка даних руками це 2-3 години розробника.</p>

<svg class="dg wide" viewBox="0 0 1000 120"> ... </svg>

<p class="doing">Зробимо додавання зі сторінки курсу і автоматичні ліміти.</p>
```

- Hero line: the problem in one sentence, priced in something real (hours of a developer,
  credits counted by hand). Abstractions like «не масштабується» get sent back.
- One visual per slide, centred with `.wide`. Two visuals means two slides.
- Closing line: what we build. No bold label in front of it, an accented one-word label
  reads as an orphan heading.
- Everything else goes to the speaker notes. Budget: under 50 words on a slide, notes
  excluded. Tables and UI mocks may go higher because their words are data.

Deck skeleton, class inventory and the eleven slides that survived review:
`references/deck-structure.md`.

## Writing rules

- Ukrainian, sentence case. No uppercase labels, no middle dots `·`, no em dashes, no emoji.
- A subtitle must parse for someone who does not know the feature. «Куди пішли схожі на
  мене» meant nothing; «Що брали студенти зі схожим набором курсів» does.
- Never claim what the product cannot do: Rate UKMA has no schedule, so notifications are
  not about schedule changes. Qualify metrics: «покриття бекенду 87%».
- Future work is «можливо», never «колись потім» — that reads as an undated promise.
- Units on every number: «4 кр», header «Кредити».
- Do not devalue a track («найменший за обсягом») and do not retype a table the lecturer
  already owns.
- Mock figures imply measurement. If nothing is measured, put `?` in the bars and say so in
  one line; then no «Макет» caption is needed.
- No text hanging under two columns. Fold it into a column as one more item.

## Visuals

Build UI panels in markup from the app's measured computed styles. A screenshot reads as a
screenshot on a slide, and the real course page leaks instructor names under the reviews.
Measured values, panel rules and the review markup: `references/ui-replica.md`.

Diagrams: equal-width boxes in one row, `rx="12"`, arrows ending 4px short of the next box
(the marker eats about 8px), no dangling dashed stub, text inside the `viewBox`, captions in
`<p class="cap">`.

## Speaker notes

Notes are the spoken text and may be long. Lead with why the slide matters, spell numbers
out («п'ятсот шістдесят чотири коміти») because you read them aloud, and avoid written-report
phrasing. Park here everything cut from a slide.

## Before saying it is done

- Render PNGs and look at every slide you touched.
- Count words per slide and `grep` for `·`, uppercase labels, numbers without units.
- Verify every figure against its source (`git rev-list --count`, `gh pr list`, the coverage
  badge, the database) and name the source in the commit.
- Commit `slides.md`, `theme.css`, assets and the rendered `slides.html` / `slides.pdf`: the
  deck gets attached to course tasks by people who will not run the renderer.
- Do not open the browser at the end unless asked.
