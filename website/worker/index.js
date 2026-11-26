// Cloudflare Worker for 75golf.com:
// 1. Serves static site assets from one/dist (with clean URLs & 404.html)
// 2. Exposes POST /api/checkout to create a live Stripe Checkout Session once STRIPE_SECRET_KEY is configured.
const CATALOG = {
  two: {
    name: 'Inside 75 Clip Kit (Two Clips)',
    description: 'Two V2 shaft sensors for your putter and wedge, 3 mm hex key, and the free tablet app.',
    unit_amount: 22900,
    image: 'https://75golf.com/assets/kit-two.jpg',
  },
  one: {
    name: 'Inside 75 Clip Kit (One Clip)',
    description: 'One V2 shaft sensor for your putter or wedge, 3 mm hex key, and the free tablet app.',
    unit_amount: 11900,
    image: 'https://75golf.com/assets/kit-one.jpg',
  },
};

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

    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      if (!env.STRIPE_SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'stripe_not_configured' }), {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        });
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
          return new Response(JSON.stringify({ error: 'empty_cart' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
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
          return new Response(JSON.stringify({ error: data?.error?.message || 'stripe_error' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ url: data.url }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'invalid_request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
