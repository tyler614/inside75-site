# 75golf.com Website

Consumer storefront, interactive product showcase, checkout, and SEO/AEO site for Inside 75 (75 Golf LLC).

## Build & Local Preview

```bash
cd website
node one/build.mjs --strict   # builds one/dist and runs link, schema, copy, and asset checks
node serve.mjs                # previews one/dist at http://127.0.0.1:4175
```

## Activating Live Stripe Card Payments (Two Options)

Out of the box, `/checkout` runs in Batch 2 Direct Order mode (capturing reservations into Supabase `site_signups` with $0 charged today). Flip on live credit card, Apple Pay, and Google Pay checkout in 60 seconds with either option:

1. **Zero-backend Stripe Payment Links (fastest):** Create two Stripe Payment Links (Two-Clip Kit $229 with free shipping, One-Clip Kit $119 with $9 shipping) and paste their URLs into `one/config.json` under `stripePaymentLinks.two` and `stripePaymentLinks.one`, then rebuild.
2. **Full multi-item Stripe Checkout via Cloudflare Worker (`worker/index.js`):** Set `"checkoutApi": "/api/checkout"` in `one/config.json`, rebuild, deploy via Wrangler (`wrangler deploy`), and run `wrangler secret put STRIPE_SECRET_KEY`.

## Ad Pixels & Analytics

Paste your IDs into `one/config.json` under `analytics` (`ga4`, `metaPixel`, `tiktokPixel`, `googleAdsId`). UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `gclid`, `fbclid`, `ttclid`) and ecommerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `generate_lead`) fire automatically.

## Deploying to 75golf.com (Cloudflare Worker `inside75`)

- **Option A (Wrangler):** `cd website && npx wrangler deploy` (using `wrangler.jsonc`, serving `one/dist` + `/api/checkout`).
- **Option B (Dashboard static upload):** Upload `one/dist` (zipped) to the `inside75` Worker with `not_found_handling` set to `404-page`.

Note: The root `index.html` in this repository serves the separate app privacy policy for GitHub Pages and is intentionally untouched.
