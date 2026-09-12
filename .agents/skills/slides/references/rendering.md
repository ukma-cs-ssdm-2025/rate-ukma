# Rendering

```sh
node docs/presentations/render.mjs <deck>                 # slides.html + slides.pdf
node docs/presentations/render.mjs <deck> --png /tmp/deck # one PNG per slide
MARP_BIN=/path/to/marp node docs/presentations/render.mjs <deck>
```

`render.sh` execs `render.mjs`, so both entry points behave identically. The script resolves
its own directory, so it can be called from anywhere in the repo.

## Platform notes

- Windows: run the same `node docs/presentations/render.mjs <deck>` from PowerShell or cmd.
  The script picks `npx.cmd` there and never shells out through `sh`, so nothing in the
  pipeline needs Git Bash or WSL.
- macOS: the Homebrew `marp` build fails on Node 26 with `require is not defined`. The
  default path through `npx @marp-team/marp-cli@4` avoids it; `MARP_BIN` is for a binary you
  trust.
- PDF export needs a Chromium; marp-cli downloads one on first run. On a locked-down machine
  set `CHROME_PATH` to an installed browser.

## marp-cli gotchas

- `--theme-set` takes a list and swallows the next positional argument. The input path must
  come first: `marp fall-2026/slides.md --theme-set theme.css -o out.html`. Get it wrong and
  marp prints its help text and exits 0, so the render looks like it worked.
- `--html` is required: the slides use inline layout markup and SVG.
- `--allow-local-files` is required for the logo and brand icons, and prints a warning every
  run. That warning is expected.
- `--pdf-notes` puts the speaker notes into the PDF. The HTML keeps them as comments only.

## Word budget check

```sh
cd docs/presentations
python3 - <<'EOF'
import re, pathlib
s = pathlib.Path('fall-2026/slides.md').read_text()
for i, sl in enumerate(s.split('\n---\n')[1:], 1):
    text = re.sub(r'<[^>]+>', '', re.sub(r'<!--[\s\S]*?-->', '', sl))
    print(i, len(text.split()), 'words')
EOF
```

## Brand icons

`https://cdn.simpleicons.org/<slug>` gives the official colour; append `/111318` when that
colour is near-white (TanStack ships `#ECE8D1` and disappears on white). Playwright has no
simple-icons entry, so it stays a word. Icons live in `<deck>/assets/icon-<slug>.svg`.
