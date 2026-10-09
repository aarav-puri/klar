# Klar brand notes

**Name:** Klar. German and Scandinavian for "clear", which is the product's promise: *Your grades. Finally, clear.* Short, one syllable, easy to say, and unrelated to Bessy or Schoology.

**Symbol:** a disc split vertically, with the right half lifted. It reads as a lens bringing something into focus and as a quiet step up, without arrows, charts, caps or books. Two halves in two blues give it depth; it works as a single color too.

**Wordmark:** custom geometric lowercase `klar` drawn on a 5-unit stroke grid (straight terminals, a perfectly round `a` bowl, an `r` whose terminal echoes the lifted half).

**Signature in the UI:** grade numerals lift their decimal (`94` + raised `.6%` in brand blue), echoing the symbol. It's the one bold move; everything else stays quiet.

## Files (`brand/`)

| File | Use |
| --- | --- |
| `logo-light.svg`, `logo-dark.svg` | Symbol + wordmark lockups for light and dark backgrounds |
| `symbol.svg`, `symbol-dark.svg`, `symbol-mono.svg` | Standalone symbol (mono uses `currentColor`) |
| `wordmark.svg` | Wordmark only (`currentColor`) |
| `favicon.svg` | Browser favicon on a 16px grid with a wider split; adapts to dark mode |
| `icon-small.svg` | 16-32px raster source |
| `build.mjs` | Generates extension PNGs (16, 32, 48, 128) and the web app icons |

Run `node brand/build.mjs` after editing a source.

## Color

| Token | Light | Dark |
| --- | --- | --- |
| Brand | `#0677BA` | `#3D9AD6` |
| Brand deep | `#075B91` | `#2A7FB8` |
| Brand wash | `#EAF5FC` | `#10283B` |
| Background | `#F7F9FC` | `#0B1622` |
| Surface | `#FFFFFF` | `#101E2C` |
| Ink | `#172B3A` | `#E8EEF4` |
| Secondary ink | `#66788A` | `#93A6B8` |
| Border | `#E3E9EF` | `#1D2F41` |
| Success / Warning / Error | `#16A085` / `#C98516` / `#D94D55` | `#3CC4A4` / `#EAB45C` / `#F0737A` |

These are a starting palette chosen to sit alongside Schoology's blue, not official Schoology values. Chart series use a separate, colorblind-validated categorical order (see `apps/web/src/app/globals.css`), so status colors are never reused for data.

**Type:** Cabinet Grotesk for headings, Satoshi for everything else, with tabular figures for every number. Both are self-hosted from Fontshare (ITF Free Font License) in `apps/web/src/app/fonts`.

**Website:** neo-brutalist, built from the palette above. 2px borders and hard, zero-blur shadows (4px for elements, 8px for large containers, 12px for product frames) in `#0B1622`; buttons sink into their shadow on hover. Sections alternate sky `#9FD3F5` (the light half of the dark-mode symbol, with a 32px dot pattern), white, navy `#172B3A` and slate `#CFD9E3`. Tokens are the `--nb-*` variables in `globals.css`, with dark-mode values. The app itself stays quiet: same fonts, minimal text.
