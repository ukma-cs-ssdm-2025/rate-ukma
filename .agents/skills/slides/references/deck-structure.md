# Deck structure

Eleven slides that survived review:

1. Lead: course line in normal case, title, date and domain
2. Product as it is: two `appframe half` panels, ratings left, reviews right
3. Traction: three or four accented figures plus one chart
4. Repository: measured figures, `.stack` chips, clickable `.repolink`
5. Team: name and GitHub handle, alphabetical by surname, no role column
6. Plan: active tracks with owners left, backlog right
7-9. One slide per track, three parts each
10. AI process: «Що вже є» / «Що ще можна зробити»
11. Closing: wordmark, short question, domain

Cut on sight: a slide retyping the course checkpoints, a second backlog slide, a slide whose
only content is a list of metric names.

## Classes beyond the obvious

| Group | Classes |
|---|---|
| Section | `lead`, `closing`, `shot` |
| Layout | `.cols`, `.cols3`, `.wide`, `.big`, `.doing` |
| Blocks | `.card`, `.track`, `.track.now`, `.box`, `.mock`, `.mock .row` |
| Repository | `.facts`, `.stack` + `.tech`, `.repolink` |
| Plan mock | `.plan` with `.vars`, `.stats`, `.stat`, `.c`, `.c.free`, `.c.add` |
| Diagrams | `svg.dg`: `bd`, `bd.now`, `bd.new`, `bd.ac`, `ln`, `ln.ac`, `ln.dash`, `bar`, `bar.lite`, `ac`, `mu`, `wh` |
| Text | `.muted`, `.small`, `.cap`, `.tag`, `.chips span`, `.code-h` |

`.tag` is uppercase by design, so it is unused: put a `.muted` line above the title instead.

A Markdown table with an empty header row still draws the theme's header rule, which looks
like a stray blue line. Give the table real headers or use `.facts` lines.
