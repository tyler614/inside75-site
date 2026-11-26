// Cloudflare Worker for 75golf.com:
// 1. Serves static site assets from one/dist (with clean URLs & 404.html)
// 2. Exposes POST /api/invite/verify and POST /api/invite/mint (Supabase-backed via RPCs with deterministic fallback)
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
const DEFAULT_SB_URL = 'https://fmyjsfixxmobdrhefuzl.supabase.co';
const DEFAULT_SB_KEY = 'sb_publishable_k5FHWqVaVCwED6W7FDxMxA_I4YvqQx5';
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

function digitChecksum(num4, salt) {
  let h = 2166136261;
  const s = `${num4}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return String(h % 97).padStart(2, '0');
}

function verifyCodeFallback(raw, env) {
  const clean = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!clean) return { valid: false };
  const founders = (env.EARLY_ACCESS_CODES ? String(env.EARLY_ACCESS_CODES).split(',') : DEFAULT_FOUNDER_CODES)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean);
  if (founders.includes(clean)) return { valid: true, code: clean, kind: 'founder' };
  const salt = env.EARLY_ACCESS_SALT || 'i75-ea-v2';
  const mNum = /^75-([0-9]{4})([0-9]{2})$/.exec(clean);
  if (mNum && digitChecksum(mNum[1], salt) === mNum[2]) {
    return { valid: true, code: clean, kind: 'member' };
  }
  const m = /^I75-([2-9A-HJ-NP-Z]{4})([2-9A-HJ-NP-Z]{2})$/.exec(clean);
  if (m && codeChecksum(m[1], salt) === m[2]) {
    return { valid: true, code: clean, kind: 'member' };
  }
  return { valid: false };
}

function mintCodesFallback(seed, count, env) {
  const salt = env.EARLY_ACCESS_SALT || 'i75-ea-v2';
  const out = [];
  for (let k = 0; k < count; k++) {
    let h = 2166136261;
    const s = `${seed}:pass:${k}:${salt}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const num4 = String(1000 + (h % 9000));
    out.push(`75-${num4}${digitChecksum(num4, salt)}`);
  }
  return out;
}

const DEFAULT_NOTIFY_TO = 'helveytr@gmail.com';
const DEFAULT_NOTIFY_FROM = 'Inside 75 <alerts@75golf.com>';
const SB_DASH_BASE = 'https://supabase.com/dashboard/project/fmyjsfixxmobdrhefuzl/editor';

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendAlertEmail({ subject, html, text, replyTo }, env) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'no_key' };
  const to = (env.NOTIFY_EMAIL || DEFAULT_NOTIFY_TO).split(',').map(s => s.trim()).filter(Boolean);
  const from = env.NOTIFY_FROM || DEFAULT_NOTIFY_FROM;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    return { sent: res.ok, status: res.status };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
}

async function sbInsertSignup(email, source, env) {
  const base = (env.SUPABASE_URL || DEFAULT_SB_URL).replace(/\/$/, '');
  const key = env.SUPABASE_KEY || DEFAULT_SB_KEY;
  const res = await fetch(`${base}/rest/v1/site_signups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ email, source }),
  });
  return { ok: res.ok || res.status === 409, duplicate: res.status === 409, status: res.status };
}

async function sbRpc(fnName, payload, env) {
  const base = (env.SUPABASE_URL || DEFAULT_SB_URL).replace(/\/$/, '');
  const key = env.SUPABASE_KEY || DEFAULT_SB_KEY;
  const res = await fetch(`${base}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Canonical 301 redirect www.75golf.com -> 75golf.com for clean SEO
    if (url.hostname === 'www.75golf.com') {
      url.hostname = '75golf.com';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/api/signup' && request.method === 'POST') {
      try {
        const body = await request.json();
        const email = String(body?.email || '').trim().toLowerCase();
        const source = String(body?.source || '75golf.com').trim().slice(0, 64);
        const kit = String(body?.kit || '').trim().slice(0, 32);
        if (!email || !email.includes('@')) {
          return json({ ok: false, error: 'invalid_email' }, 400);
        }
        const db = await sbInsertSignup(email, source, env);
        if (!db.ok) {
          return json({ ok: false, error: 'db_error' }, 502);
        }
        const kitLabel = kit === 'two' ? 'Two-Clip Kit ($229)' : kit === 'one' ? 'One-Clip Kit ($119)' : (source.includes(':two') ? 'Two-Clip Kit ($229)' : source.includes(':one') ? 'One-Clip Kit ($119)' : 'General updates / waitlist');
        const subject = `[Inside 75] New waitlist signup: ${email}`;
        const text = `New Inside 75 waitlist signup on 75golf.com\n\nEmail: ${email}\nInterest: ${kitLabel}\nSource: ${source}${db.duplicate ? ' (already on list)' : ''}\n\nView all signups in Supabase:\n${SB_DASH_BASE}`;
        const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#0B1A33">
          <h2 style="margin:0 0 12px">New Inside 75 Waitlist Signup</h2>
          <table style="border-collapse:collapse;width:100%;font-size:15px">
            <tr><td style="padding:6px 0;color:#5A6475;width:110px">Email</td><td style="padding:6px 0"><strong>${escHtml(email)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#5A6475">Kit interest</td><td style="padding:6px 0">${escHtml(kitLabel)}</td></tr>
            <tr><td style="padding:6px 0;color:#5A6475">Source</td><td style="padding:6px 0">${escHtml(source)}${db.duplicate ? ' (repeat signup)' : ''}</td></tr>
          </table>
          <p style="margin:18px 0 0"><a href="${SB_DASH_BASE}" style="display:inline-block;background:#0B1A33;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open Supabase Signups Table</a></p>
        </div>`;
        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(sendAlertEmail({ subject, html, text, replyTo: email }, env));
        } else {
          await sendAlertEmail({ subject, html, text, replyTo: email }, env);
        }
        return json({ ok: true, duplicate: db.duplicate });
      } catch {
        return json({ ok: false, error: 'invalid_request' }, 400);
      }
    }

    if (url.pathname === '/api/invite/verify' && request.method === 'POST') {
      try {
        const body = await request.json();
        const raw = body?.code;
        // Prefer Supabase single-use RPC once early_access_invites migration is applied
        const dbRes = await sbRpc('verify_early_access_code', { p_code: String(raw || '') }, env).catch(() => null);
        if (dbRes && typeof dbRes.valid === 'boolean') {
          return json({ ...dbRes, source: 'supabase' }, dbRes.valid ? 200 : 404);
        }
        const res = verifyCodeFallback(raw, env);
        return json({ ...res, source: 'edge' }, res.valid ? 200 : 404);
      } catch {
        return json({ valid: false }, 400);
      }
    }

    if (url.pathname === '/api/invite/mint' && request.method === 'POST') {
      try {
        const body = await request.json();
        const ref = String(body?.ref || Date.now()).slice(0, 64);
        const email = String(body?.email || '').trim().toLowerCase();
        const usedCode = String(body?.usedCode || '').trim().toUpperCase();
        const kit = String(body?.kit || '').slice(0, 120);
        const state = String(body?.state || '').slice(0, 24);
        const name = String(body?.name || '').trim().slice(0, 120);
        const address = String(body?.address || '').trim().slice(0, 200);
        const city = String(body?.city || '').trim().slice(0, 80);
        const zip = String(body?.zip || '').trim().slice(0, 20);
        const tablet = String(body?.tablet || '').trim().slice(0, 40);

        let codes = [];
        let source = 'edge';
        if (email && usedCode) {
          const dbRes = await sbRpc('complete_early_access_order', {
            p_used_code: usedCode,
            p_buyer_email: email,
            p_order_ref: ref,
            p_kit_summary: kit,
            p_shipping_state: state,
          }, env).catch(() => null);
          if (dbRes && dbRes.ok && Array.isArray(dbRes.codes)) {
            codes = dbRes.codes;
            source = 'supabase';
          } else if (dbRes && dbRes.error === 'invalid_or_used_code') {
            return json({ error: 'invalid_or_used_code', codes: [] }, 409);
          }
        }
        if (!codes.length) {
          codes = mintCodesFallback(ref, 5, env);
        }

        if (email) {
          const shipLine = [address, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' · ');
          const linksList = codes.map(c => `https://75golf.com/?invite=${c}`).join('\n');
          const subject = `[Inside 75] New Early Access Order ${ref}: ${name || email}`;
          const text = `New Inside 75 Early Access order reserved!\n\nOrder Ref: ${ref}\nBuyer: ${name || '(not provided)'}\nEmail: ${email}\nKit: ${kit || '(see details)'}\nCode Used: ${usedCode || '(none)'}\nTablet: ${tablet || '(unspecified)'}\nShipping: ${shipLine || state || '(unspecified)'}\n\n5 Share Links Minted:\n${linksList}\n\nView orders in Supabase:\n${SB_DASH_BASE}`;
          const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:580px;color:#0B1A33">
            <h2 style="margin:0 0 12px">New Early Access Order: ${escHtml(ref)}</h2>
            <table style="border-collapse:collapse;width:100%;font-size:15px">
              <tr><td style="padding:6px 0;color:#5A6475;width:120px">Buyer</td><td style="padding:6px 0"><strong>${escHtml(name || email)}</strong> (${escHtml(email)})</td></tr>
              <tr><td style="padding:6px 0;color:#5A6475">Kit</td><td style="padding:6px 0"><strong>${escHtml(kit)}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#5A6475">Code Used</td><td style="padding:6px 0"><code>${escHtml(usedCode)}</code></td></tr>
              <tr><td style="padding:6px 0;color:#5A6475">Tablet</td><td style="padding:6px 0">${escHtml(tablet || 'Unspecified')}</td></tr>
              <tr><td style="padding:6px 0;color:#5A6475">Shipping</td><td style="padding:6px 0">${escHtml(shipLine || state || 'Unspecified')}</td></tr>
            </table>
            <p style="margin:16px 0 6px;font-weight:600">5 Early Access links minted for this buyer:</p>
            <pre style="background:#F5F5F2;padding:12px;border-radius:8px;font-size:13px;margin:0">${escHtml(linksList)}</pre>
            <p style="margin:18px 0 0"><a href="${SB_DASH_BASE}" style="display:inline-block;background:#0B1A33;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open Supabase Orders Table</a></p>
          </div>`;
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(sendAlertEmail({ subject, html, text, replyTo: email }, env));
          } else {
            await sendAlertEmail({ subject, html, text, replyTo: email }, env);
          }
        }

        return json({ codes, source });
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
