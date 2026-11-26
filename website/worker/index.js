// Cloudflare Worker for 75golf.com:
// 1. Serves static site assets from one/dist (with clean URLs & 404.html)
// 2. Exposes POST /api/invite/verify and POST /api/invite/mint for Early Access codes
// 3. Exposes POST /api/checkout to create a live Stripe Checkout Session once STRIPE_SECRET_KEY is configured.
const CATALOG = {
  two: {
    name: 'Inside 75 Clip Kit (Two Clips)',
    description: 'Two V2 shaft sensors for your putter and wedge, hex key, and the free tablet app.',
    unit_amount: 22900,
    image: 'https://75golf.com/assets/kit-two.jpg',
  },
  one: {
    name: 'Inside 75 Clip Kit (One Clip)',
    description: 'One V2 shaft sensor for your putter or wedge, hex key, and the free tablet app.',
    unit_amount: 11900,
    image: 'https://75golf.com/assets/kit-one.jpg',
  },
};

const DEFAULT_FOUNDER_CODES = ['TYLER', 'OHIO75', 'SCRATCH', 'EARLY75'];
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function codeChecksum(body, salt) {
  let h = 2166136261;
  const s = `${body}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ALPHA[h % ALPHA.length] + ALPHA[(h >>> 5) % ALPHA.length];
}

function verifyCode(raw, env) {
  const clean = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!clean) return { valid: false };
  const founders = (env.EARLY_ACCESS_CODES ? String(env.EARLY_ACCESS_CODES).split(',') : DEFAULT_FOUNDER_CODES)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean);
  if (founders.includes(clean)) return { valid: true, code: clean, kind: 'founder' };
  const m = /^I75-([2-9A-HJ-NP-Z]{4})([2-9A-HJ-NP-Z]{2})$/.exec(clean);
  if (m) {
    const salt = env.EARLY_ACCESS_SALT || 'i75-ea-v2';
    if (codeChecksum(m[1], salt) === m[2]) {
      return { valid: true, code: clean, kind: 'member' };
    }
  }
  return { valid: false };
}

function mintCodes(seed, count, env) {
  const salt = env.EARLY_ACCESS_SALT || 'i75-ea-v2';
  const out = [];
  for (let k = 0; k < count; k++) {
    let h = 2166136261;
    const s = `${seed}:pass:${k}:${salt}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    let body = '';
    for (let j = 0; j < 4; j++) {
      h = Math.imul(h ^ (j + 17), 16777619) >>> 0;
      body += ALPHA[h % ALPHA.length];
    }
    out.push(`I75-${body}${codeChecksum(body, salt)}`);
  }
  return out;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function encodeForm(obj, prefix = '') {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (typeof item === 'object') parts.push(encodeForm(item, `${key}[${idx}]`));
        else parts.push(`${encodeURIComponent(`${key}[${idx}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === 'object') {
      parts.push(encodeForm(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonical 301 redirect www.75golf.com -> 75golf.com for clean SEO
    if (url.hostname === 'www.75golf.com') {
      url.hostname = '75golf.com';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/api/invite/verify' && request.method === 'POST') {
      try {
        const body = await request.json();
        const res = verifyCode(body?.code, env);
        return json(res, res.valid ? 200 : 404);
      } catch {
        return json({ valid: false }, 400);
      }
    }

    if (url.pathname === '/api/invite/mint' && request.method === 'POST') {
      try {
        const body = await request.json();
        const seed = String(body?.ref || Date.now()).slice(0, 64);
        const codes = mintCodes(seed, 5, env);
        return json({ codes });
      } catch {
        return json({ codes: [] }, 400);
      }
    }

    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      if (!env.STRIPE_SECRET_KEY) {
        return json({ error: 'stripe_not_configured' }, 501);
      }
      try {
        const body = await request.json();
        const items = Array.isArray(body.items) ? body.items : [];
        const line_items = [];
        let subtotal = 0;

        for (const item of items) {
          const sku = CATALOG[item.sku];
          const qty = Math.max(1, Math.min(9, Number(item.qty) || 0));
          if (!sku || !qty) continue;
          subtotal += sku.unit_amount * qty;
          line_items.push({
            price_data: {
              currency: 'usd',
              unit_amount: sku.unit_amount,
              product_data: {
                name: sku.name,
                description: sku.description,
                images: [sku.image],
              },
            },
            quantity: qty,
          });
        }

        if (!line_items.length) {
          return json({ error: 'empty_cart' }, 400);
        }

        const freeShipping = subtotal >= 15000;
        const payload = {
          mode: 'payment',
          success_url: `${url.origin}/checkout?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${url.origin}/checkout?status=cancelled`,
          shipping_address_collection: { allowed_countries: ['US'] },
          billing_address_collection: 'auto',
          allow_promotion_codes: 'true',
          shipping_options: [
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: freeShipping ? 0 : 900, currency: 'usd' },
                display_name: freeShipping ? 'Free US Ground Shipping' : 'US Ground Shipping',
              },
            },
          ],
          line_items,
          ...(body.email ? { customer_email: String(body.email).slice(0, 200) } : {}),
        };

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: encodeForm(payload),
        });
        const data = await stripeRes.json();
        if (!stripeRes.ok || !data.url) {
          return json({ error: data?.error?.message || 'stripe_error' }, 502);
        }
        return json({ url: data.url, id: data.id });
      } catch {
        return json({ error: 'invalid_request' }, 400);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
