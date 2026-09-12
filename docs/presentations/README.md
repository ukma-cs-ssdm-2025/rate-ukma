# Presentations

Marp decks. Source is `<deck>/slides.md`, layout comes from the shared `theme.css`,
assets live in `<deck>/assets/`.

```sh
node docs/presentations/render.mjs fall-2026     # macOS, Linux, Windows
docs/presentations/render.sh fall-2026          # POSIX wrapper around the same script
```

That writes `slides.html` and `slides.pdf` (the PDF keeps speaker notes). `marp-cli` is
pulled by `npx` on first run; set `MARP_BIN` to use a local binary. The rendered files are
committed so the deck can be attached to course tasks without running anything.

| Deck | About |
|---|---|
| `fall-2026` | План на семестр для курсу «Генеративний ШІ»: три напрями, беклог, як ми працюємо з ШІ |

Conventions and layout classes: `.agents/skills/slides/SKILL.md`.
