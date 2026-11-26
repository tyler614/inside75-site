# 75golf.com website

The Inside 75 marketing site and store: home page, kit page with cart, and the brand sample.

## Build

```
cd website
npm install
node one/build.mjs
```

Output goes to `one/dist/` (index.html, kit.html, assets). `--strict` fails the build if media is missing or the copy has a dash or a banned word.

## What's here

- `one/build.mjs`: generates the pages. Prices and product copy live in the `P` object.
- `one/style.css`: brand styles. Matte white and navy, green only on the flag and the green. Archivo, Public Sans and IBM Plex Mono.
- `one/plate.svg`: the yardage book drawing.
- `one/config.json`: checkout, store and signup settings. Empty checkout or store links show a waitlist or "Soon".
- `one/assets/`: photos and the hero clip used on the site. `one/_orig_photos/` holds the untouched originals.
- `brand-sample/`: the one-page brand sample.

## Deploying

75golf.com runs on the Cloudflare worker `inside75`. Upload a zip of `one/dist` as a new deployment. Only deploy when Tyler says so.

The privacy page at the root of this repo is separate and is not touched by this folder.
