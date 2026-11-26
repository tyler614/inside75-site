// 75golf.com static storefront generator.
// Run from website/:  node one/build.mjs [--strict] [--local]  ->  one/dist/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkProblems, pageProblems } from './checks.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(DIR, 'assets');
const OUT = path.join(DIR, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const strict = process.argv.includes('--strict');
const local = process.argv.includes('--local');
const SITE = (cfg.siteUrl || 'https://75golf.com').replace(/\/$/, '');
const MAIL = cfg.contactEmail || 'hello@75golf.com';
const missing = [];
const has = f => fs.existsSync(path.join(A, f));
const need = f => { if (!has(f)) missing.push(f); return has(f); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const page = p => local ? (p === '/' ? 'index.html' : `${p.slice(1)}.html`) : p;
const home = hash => `${page('/')}${hash || ''}`;

// ---------- media helpers ----------
function dims(f) {
  const b = fs.readFileSync(path.join(A, f));
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 4) === 'RIFF') {
    const k = b.toString('ascii', 12, 16);
    if (k === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (k === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
  }
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return [1200, 800];
}
const ASSET_V = 'v2e';
const file = name => ['jpg', 'png'].map(e => `${name}.${e}`).find(has);
function pic(name, alt, { cls = '', eager = false, root = false } = {}) {
  const f = file(name);
  if (!f) { missing.push(`${name}.jpg`); return ''; }
  const [w, h] = dims(f);
  const pre = root ? '/assets/' : 'assets/';
  const im = `<img${cls ? ` class="${cls}"` : ''} src="${pre}${f}?v=${ASSET_V}" alt="${esc(alt)}" width="${w}" height="${h}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>`;
  return has(`${name}.webp`) ? `<picture><source srcset="${pre}${name}.webp?v=${ASSET_V}" type="image/webp">${im}</picture>` : im;
}

// Inline brand lockup using solid navy Inside 75 grid mark + crisp wordmark (footer gets subtle pin-square accent on dark navy)
const BRAND_SVG = `<svg class="brand-svg" viewBox="0 0 132 28" role="img" aria-label="Inside 75">
  <g class="brand-mark" fill="#0B1A33">
    <rect x="0" y="2" width="6.5" height="6.5" rx="1.6"/>
    <rect x="8.5" y="2" width="6.5" height="6.5" rx="1.6"/>
    <rect x="17" y="2" width="6.5" height="6.5" rx="1.6"/>
    <rect x="0" y="10.5" width="6.5" height="6.5" rx="1.6"/>
    <rect class="pin-sq" x="8.5" y="10.5" width="6.5" height="6.5" rx="1.6"/>
    <rect x="17" y="10.5" width="6.5" height="6.5" rx="1.6"/>
    <rect x="0" y="19" width="6.5" height="6.5" rx="1.6"/>
    <rect x="8.5" y="19" width="6.5" height="6.5" rx="1.6"/>
    <rect x="17" y="19" width="6.5" height="6.5" rx="1.6"/>
  </g>
  <text class="brand-text" x="32" y="20.5" font-family="Archivo,system-ui,sans-serif" font-weight="700" font-size="19.5" letter-spacing="-0.03em" fill="#0B1A33">Inside 75</text>
</svg>`;

const APPLE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.96 6.33c.67-.81 1.12-1.94 1-3.08-.96.04-2.13.64-2.82 1.45-.61.7-.115 1.85-1.01 2.96 1.08.08 2.17-.52 2.83-1.33z"/></svg>`;
const GPLAY_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M3.6 2.3c-.3.3-.5.8-.5 1.4v16.6c0 .6.2 1.1.5 1.4l.1.1 9.3-9.3v-.2L3.7 2.2l-.1.1z"/><path fill="#34A853" d="M16.1 15.6l-3.1-3.1v-.2l3.1-3.1.1.1 3.7 2.1c1.1.6 1.1 1.6 0 2.2l-3.7 2.1-.1-.1z"/><path fill="#FBBC05" d="M16.2 15.5L13 12.3 3.6 21.7c.3.4.9.4 1.6 0l11-6.2z"/><path fill="#EA4335" d="M16.2 9.1L5.2 2.9c-.7-.4-1.3-.3-1.6 0L13 12.3l3.2-3.2z"/></svg>`;
const storeBadge = (store, url) => {
  const isApple = store === 'apple';
  const inner = `${isApple ? APPLE_SVG : GPLAY_SVG}<span class="store-btn-txt"><small>${isApple ? 'Download on the' : 'GET IT ON'}</small><strong>${isApple ? 'App Store' : 'Google Play'}</strong></span>`;
  return url
    ? `<a class="store-btn" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<span class="store-btn" aria-label="${isApple ? 'Download on the App Store' : 'Get it on Google Play'}">${inner}</span>`;
};

const ic = d => `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  check: ic('<path d="M4 10.5 8 14.5 16 5.5"/>'),
  x: ic('<path d="M5 5l10 10M15 5 5 15"/>'),
  cart: ic('<circle cx="8" cy="17" r="1.4"/><circle cx="15.5" cy="17" r="1.4"/><path d="M2 3h2.5l2 10h9.5l1.8-7H5.2"/>'),
  menu: ic('<path d="M3 5.5h14M3 10h14M3 14.5h14"/>'),
  club: ic('<path d="M7 2v11.5l-3 3.5h8"/><rect x="8.5" y="5" width="5" height="4.5" rx="1"/>'),
  wifi: ic('<path d="M3 8a10 10 0 0 1 14 0M6 11a6 6 0 0 1 8 0M9 14a2 2 0 0 1 2 0"/>'),
  bolt: ic('<path d="M11 2 5 11h5l-1 7 6-9h-5z"/>'),
  tablet: ic('<rect x="4" y="2" width="12" height="16" rx="2"/><path d="M9 15h2"/>'),
  shield: ic('<path d="M10 2.5 4 5v4.5c0 4 2.5 7 6 8.5 3.5-1.5 6-4.5 6-8.5V5l-6-2.5z"/><path d="M7.5 10.2 9.3 12l3.5-3.6"/>'),
  truck: ic('<path d="M2 5h10v9H2zM12 8h3.5l2.5 3v3h-6z"/><circle cx="5.5" cy="15.5" r="1.5"/><circle cx="14.5" cy="15.5" r="1.5"/>'),
  wave: ic('<path d="M2 10h3l2-5 3 10 2.5-6 1.5 1h4"/>'),
};

// ---------- canonical product & content data ----------
const P = {
  two: {
    sku: 'I75-KIT-2',
    name: 'Two-Clip Full Short-Game Kit',
    short: 'Two Clips (Putter + Wedge)',
    price: 229,
    compareAt: 238,
    img: 'kit-two',
    alt: 'Two Inside 75 V2 sensor clips in their white presentation tray with the 2 mm hex key',
    sub: 'Keep one clip on your putter and one on your wedge so you play full 18-hole Short Game rounds without ever swapping clubs.',
    opt: 'Putter + Wedge · Zero swapping',
    plays: 'All 4 games, including full Short Game rounds',
    shipping: 'Free US shipping',
    bullets: [
      '2 Inside 75 V2 wireless shaft sensors (assembled with clamp bolts)',
      'Custom 2 mm hex key in molded presentation tray',
      'Free Inside 75 tablet app with 1 full 18-hole course & all 4 modes',
      'Free US ground shipping, 30-day home trial, and 1-year warranty',
    ],
    box: 'Two Inside 75 V2 clips (each pre-assembled with two clamp screws) and one 2 mm hex key in the presentation tray. USB-C cable not included.',
  },
  one: {
    sku: 'I75-KIT-1',
    name: 'One-Clip Starter Kit',
    short: 'One Clip (Putter or Wedge)',
    price: 119,
    compareAt: null,
    img: 'kit-one',
    alt: 'One Inside 75 V2 sensor clip in its white presentation tray with the 2 mm hex key',
    sub: 'Start with your putter or your wedge. Play Putting, Closest to the Pin, and Practice, or move the clip between clubs in about 20 seconds.',
    opt: 'Putter or Wedge · Easy to move',
    plays: 'Putting, Closest to the Pin, and Practice',
    shipping: '$9 US flat shipping',
    bullets: [
      '1 Inside 75 V2 wireless shaft sensor (assembled with clamp bolts)',
      'Custom 2 mm hex key in molded presentation tray',
      'Free Inside 75 tablet app with 1 full 18-hole course & all 4 modes',
      '30-day home trial and 1-year hardware warranty',
    ],
    box: 'One Inside 75 V2 clip (pre-assembled with two clamp screws) and one 2 mm hex key in the presentation tray. USB-C cable not included.',
  },
};

const TABLETS_SIMPLE = 'most modern iPads (2019 or newer) and recent Android tablets';
const TABLETS_TECH = 'iPads with an A12 chip or newer (iPadOS 16.3+) and recent 64-bit Android tablets (Vulkan 1.1)';
const EA = cfg.earlyAccess || { enabled: false, batchLabel: 'Batch 2', founderCodes: ['TYLER', 'OHIO75', 'SCRATCH', 'EARLY75'] };
const EA_ON = Boolean(EA.enabled);

const FACTS = [
  ['Hardware', 'Inside 75 V2 wireless club-shaft sensor'],
  ['Sensing Rate', '1,920 Hz motion sensing right above the clubhead'],
  ['What It Reads', 'Clubhead speed, face angle, and swing path through impact'],
  ['Club Compatibility', 'Fits your own right-handed steel-shaft putter or wedge (mounted right above the ferrule)'],
  ['Connectivity', 'Direct 2.4 GHz home Wi-Fi to your tablet (Bluetooth used for 2-minute initial setup only)'],
  ['Power & Sleep', 'USB-C rechargeable (cable not included). No power button: auto-sleeps when still, wakes when picked up.'],
  ['Updates', 'Free wireless firmware updates directly from the Inside 75 app'],
  ['Supported Tablets', `${TABLETS_TECH}. Phones are not supported yet.`],
  ['Company', '75 Golf LLC, Columbus, Ohio'],
];

const QA = [
  ['What exactly is Inside 75?', 'Inside 75 is an at-home short-game golf system built around a tiny wireless sensor that clamps onto your own putter and wedge. Take a real stroke on your living room rug or into a practice net, and the free tablet app plays your putt, chip, or pitch right away across real elevation-mapped greens.'],
  ['How does Early Access work?', 'We build Inside 75 in controlled small batches in Ohio so every kit ships on time and gets real support. Join the Early Access waitlist to claim a spot in the next batch, or use a link from anyone who already owns Inside 75 to skip the waitlist and order today. Every buyer receives 5 Early Access links to share with friends.'],
  ['How is Inside 75 different from a golf simulator or launch monitor?', 'Launch monitors cost $2,000 to $15,000+, track a flying golf ball with cameras or radar, and usually require a dedicated room, hitting bay, and screen. Inside 75 reads your club instead of the ball, so you get accurate, instant shot feedback for putts, chips, and pitches inside 75 yards right in your living room for $119 to $229, with or without a real golf ball.'],
  ['Do I need to hit a real golf ball?', 'No, either way works naturally. Putt real golf balls across your rug, chip real balls into a net, or take practice swings with no ball at all without changing a single setting.'],
  ['Do I use my own real putter and wedge?', 'Yes. Unlike toy swing sticks, Inside 75 clamps directly onto the steel shaft of the putter or wedge already in your bag, just above the clubhead. Putting and chipping with your own clubs builds real feel that transfers straight to the course.'],
  ['Should I buy the One-Clip Kit or the Two-Clip Kit?', 'Choose the Two-Clip Kit ($229, with free US shipping) if you want to play full 18-hole Short Game rounds seamlessly. You leave one clip on your putter and one on your wedge with zero swapping. Choose the One-Clip Kit ($119) if you mainly want Putting on your putter, Closest to the Pin on your wedge, or Practice with one club at a time.'],
  ['What tablets are supported?', `Inside 75 works with ${TABLETS_SIMPLE}. Phones are not supported yet because reading slopes and green contours is much better on a tablet screen. Full hardware requirements are listed in Tech Specs on the Kit page.`],
  ['Are the greens real or randomly generated?', 'The greens and surrounding terrain are mapped from real elevation surveys and aerial scans of real golf courses. Every putt has true slope and break, and you can switch between Soft (9.5), Standard (10.5), and Tour (12.0) green speeds.'],
  ['Is a subscription required to play?', 'No. The Inside 75 tablet app is free to download and includes one complete 18-hole course and all four game modes (Short Game, Putting, Closest to the Pin, and Practice) with no subscription. Optional Inside 75 Plus ($49.99/year) unlocks every course and long-term swing history.'],
  ['Can I play multiplayer with friends or family?', 'Yes. One to four players can share a single tablet and take turns over 3, 9, or 18 holes.'],
  ['Does Inside 75 work for left-handed golfers?', 'Not yet. Inside 75 currently supports right-handed putters and wedges only. Left-handed support is on our roadmap.'],
  ['How long does setup take?', 'First-time setup takes about five minutes total: two minutes to connect the clip to your home Wi-Fi in the app, and two minutes to tighten the clamp with the included hex key and run the quick club fit. After that, just pick up your club and play.'],
  ['How does the clip charge and turn on?', 'Charge it with any standard USB-C cable (not included in the box). A subtle LED shows charging status. There is no power switch: the clip goes to sleep automatically when resting and wakes the moment you pick up your club.'],
  ['What Wi-Fi network does it require?', 'Your clip and tablet talk directly over your home Wi-Fi so shots show up with practically zero lag. Both devices just need to be on the same home Wi-Fi network (avoid guest networks).'],
  ['What is your shipping and return policy?', 'Orders include a 30-day home trial and a 1-year hardware warranty. Two-Clip Kits ship free anywhere in the continental United States; One-Clip Kits ship for a flat $9. If you are not impressed at home, email hello@75golf.com within 30 days of delivery for a straightforward return.'],
];

const COURSES = [
  { img: 'course-benttree', name: '18-Hole Parkland Layouts', meta: 'Real-world green contours, guarded pins, and sloped tiers' },
  { img: 'course-foxfire3', name: 'Greenside Chip & Pitch Approaches', meta: 'Fringe, fairway, and rough lies from 10 to 75 yards' },
  { img: 'course-range', name: 'Dialed-In Wedge Practice', meta: 'Pick any exact yardage from 5 to 75 yards and track your dispersion' },
  { img: 'course-royal', name: 'Championship Putting Greens', meta: 'Soft 9.5, Standard 10.5, and Tour 12.0 green speeds' },
];

// ---------- shared chrome ----------
const analyticsSnippet = () => {
  const a = cfg.analytics || {};
  const chunks = [];
  if (a.ga4 || a.googleAdsId) {
    const id = a.ga4 || a.googleAdsId;
    chunks.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${a.ga4 ? `gtag('config',${JSON.stringify(a.ga4)});` : ''}${a.googleAdsId ? `gtag('config',${JSON.stringify(a.googleAdsId)});` : ''}</script>`);
  }
  if (a.metaPixel) {
    chunks.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(a.metaPixel)});fbq('track','PageView');</script>`);
  }
  return chunks.join('\n');
};

const promoBar = EA_ON
  ? `<div class="promo" id="promoBar"><span id="promoText"><strong>Early Access · Small-Batch Release:</strong> ${esc(cfg.shippingNote || 'Free US shipping on Two-Clip Kits.')}</span><button type="button" class="promo-link" data-ea-open="code" id="promoBtn">Have an Early Access code?</button></div>`
  : `<div class="promo"><strong>Now Open:</strong> ${esc(cfg.shippingNote || 'Free US shipping on the Two-Clip Kit.')} <a href="${page('/kit')}">Shop Kits</a></div>`;

const header = (here) => `${promoBar}
<header class="bar"><div class="in bar-in">
  <a class="brand-link" href="${page('/')}" aria-label="Inside 75 Home">${BRAND_SVG}</a>
  <nav class="nav-links" aria-label="Main navigation">
    <a href="${page('/how-it-works')}"${here === 'how' ? ' aria-current="page"' : ''}>How It Works</a>
    <a href="${home('#gameplay')}">See It Play</a>
    <a href="${page('/compare')}"${here === 'compare' ? ' aria-current="page"' : ''}>Compare</a>
    <a href="${page('/kit')}"${here === 'kit' ? ' aria-current="page"' : ''}>Clip Kits</a>
    <a href="${home('#faq')}">FAQ</a>
  </nav>
  <div class="nav-actions">
    <button type="button" class="cartbtn" data-cart-open aria-label="Open shopping cart">${I.cart}<span>Cart</span><i data-cart-count>0</i></button>
    <a class="btn primary sm" href="${page('/kit')}" data-ea-cta>${EA_ON ? 'Early Access' : 'Order Now'}</a>
    <button type="button" class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="mobNav" aria-label="Toggle navigation menu">${I.menu}</button>
  </div>
</div>
<nav class="mob-nav" id="mobNav" hidden aria-label="Mobile navigation">
  <a href="${page('/how-it-works')}">How It Works</a>
  <a href="${home('#gameplay')}">See It Play</a>
  <a href="${page('/compare')}">Compare</a>
  <a href="${page('/kit')}">Clip Kits</a>
  <a href="${home('#faq')}">FAQ</a>
  <a class="btn primary" href="${page('/kit')}" data-ea-cta>${EA_ON ? 'Early Access, From $' + P.one.price : 'Order Now, From $' + P.one.price}</a>
</nav>
</header>`;

const footer = `<footer class="foot"><div class="in">
  <div class="fgrid">
    <div>
      ${BRAND_SVG}
      <p style="margin-top:14px;max-width:26em">Real short-game golf at home with your own putter and wedge. Designed and built in Ohio.</p>
      <p style="margin-top:12px"><a href="mailto:${MAIL}" style="color:#fff;font-weight:600">${MAIL}</a></p>
    </div>
    <div>
      <h4>Product</h4>
      <nav aria-label="Product links">
        <a href="${page('/kit')}#two">Two-Clip Kit ($${P.two.price})</a>
        <a href="${page('/kit')}#one">One-Clip Kit ($${P.one.price})</a>
        <a href="${page('/how-it-works')}">How It Works</a>
        <a href="${page('/compare')}">Inside 75 vs Launch Monitors</a>
      </nav>
    </div>
    <div>
      <h4>Support</h4>
      <nav aria-label="Support links">
        <a href="${home('#faq')}">Frequently Asked Questions</a>
        <a href="${page('/how-it-works')}#troubleshoot">Wi-Fi &amp; Setup Help</a>
        <a href="${page('/shipping-returns')}">Shipping &amp; 30-Day Returns</a>
        <a href="mailto:${MAIL}">Contact Support</a>
      </nav>
    </div>
    <div>
      <h4>Legal</h4>
      <nav aria-label="Legal links">
        <a href="${page('/privacy')}">Privacy Policy</a>
        <a href="${page('/terms')}">Terms of Sale &amp; Service</a>
        <a href="${page('/shipping-returns')}">Warranty &amp; Returns</a>
      </nav>
    </div>
  </div>
  <div class="foot-bot">
    <span>&copy; 2026 75 Golf LLC · Ohio, USA. All rights reserved.</span>
    <span>Right-handed steel shafts · iPad &amp; Android tablets</span>
  </div>
</div></footer>`;

const eaModal = EA_ON ? `<div class="ea-modal-bg" id="eaModal" hidden role="dialog" aria-modal="true" aria-labelledby="eaModalTitle">
  <div class="ea-modal">
    <button type="button" class="x" data-ea-close aria-label="Close Early Access dialog">&times;</button>
    <div class="eyebrow">Early Access · ${esc(EA.batchLabel || 'Batch 2')}</div>
    <h3 id="eaModalTitle">Join Early Access</h3>
    <p class="ea-sub" id="eaModalSub">We ship Inside 75 in small batches from Ohio. Join the waitlist for the next drop, or enter a friend's Early Access code to order today.</p>
    <div class="ea-tabs" role="group" aria-label="Early Access options">
      <button type="button" id="eaTabWait" aria-pressed="true">Join Waitlist</button>
      <button type="button" id="eaTabCode" aria-pressed="false">Have a Code</button>
    </div>
    <form id="eaWaitForm">
      <div class="field"><label for="eaEmail">Email address</label><input id="eaEmail" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
      <div class="field"><label for="eaKit">Which kit are you eyeing?</label>
        <select id="eaKit" name="kit">
          <option value="two">Two-Clip Kit ($229 · Free US shipping)</option>
          <option value="one">One-Clip Starter Kit ($119)</option>
        </select>
      </div>
      <button type="submit" class="btn primary" style="width:100%">Request Early Access</button>
      <p class="msg" id="eaWaitMsg" role="status" hidden></p>
    </form>
    <form id="eaCodeForm" hidden>
      <div class="field"><label for="eaCodeIn">Early Access code</label><input id="eaCodeIn" name="code" type="text" required autocomplete="off" placeholder="Enter your code" style="text-transform:uppercase;letter-spacing:0.04em;font-weight:600"></div>
      <button type="submit" class="btn primary" style="width:100%">Unlock Ordering</button>
      <p class="msg" id="eaCodeMsg" role="status" hidden></p>
      <p style="font-size:13px;color:var(--ink-3);margin:12px 0 0">Every Inside 75 owner receives 5 Early Access links to share with friends so they can skip the waitlist.</p>
    </form>
  </div>
</div>` : '';

const cartDrawer = `<div class="scrim" data-cart-close hidden></div>
<aside class="drawer" id="drawer" hidden aria-label="Shopping cart">
  <header><h3 style="margin:0">Your Cart</h3><button type="button" class="x" data-cart-close aria-label="Close cart">&times;</button></header>
  <div class="ship-meter" id="shipMeter">Free US shipping on orders $${cfg.freeShippingThreshold}+</div>
  <div class="lines" id="lines"></div>
  <div class="tot">
    <div class="sum"><span>Subtotal</span><b id="csub">$0</b></div>
    <div class="sum"><span>US Shipping</span><b id="cship">Free</b></div>
    <div class="sum big"><span>Estimated Total</span><b id="ctot">$0</b></div>
    <a class="btn primary" id="goCheckout" href="${page('/checkout')}">Proceed to Checkout</a>
    <button type="button" class="btn line sm" data-cart-close>Continue Shopping</button>
  </div>
</aside>${eaModal}`;

// ---------- client-side runtime (cart, Early Access, UTM/ecommerce events, video switcher, 360 viewer, telemetry, checkout) ----------
const clientConfig = {
  products: {
    two: { sku: P.two.sku, name: P.two.name, short: P.two.short, price: P.two.price, img: `assets/${file(P.two.img)}` },
    one: { sku: P.one.sku, name: P.one.name, short: P.one.short, price: P.one.price, img: `assets/${file(P.one.img)}` },
  },
  freeShip: cfg.freeShippingThreshold || 150,
  flatShip: cfg.flatShipping || 9,
  earlyAccess: {
    enabled: EA_ON,
    batchLabel: EA.batchLabel || 'Batch 2',
    founderCodes: (EA.founderCodes || []).map(c => String(c).toUpperCase()),
  },
  stripeLinks: cfg.stripePaymentLinks || {},
  checkoutApi: cfg.checkoutApi || '',
  checkoutPage: page('/checkout'),
  signupEndpoint: cfg.signupEndpoint || '',
  signupKey: cfg.signupKey || '',
};

const coreJs = `(function(){
var C=${JSON.stringify(clientConfig)};
// Capture ad UTMs / click IDs into sessionStorage
try{
  var qp=new URLSearchParams(location.search);
  var utm={};['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid'].forEach(function(k){var v=qp.get(k);if(v)utm[k]=v;});
  if(Object.keys(utm).length)sessionStorage.setItem('i75utm',JSON.stringify(utm));
}catch(e){}
function getUtm(){try{return JSON.parse(sessionStorage.getItem('i75utm')||'{}')||{};}catch(e){return {};}}
window.i75track=function(ev,data){
  try{
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push(Object.assign({event:ev},data||{},getUtm()));
    if(typeof window.gtag==='function')window.gtag('event',ev,data||{});
    if(typeof window.fbq==='function'){
      var map={add_to_cart:'AddToCart',begin_checkout:'InitiateCheckout',purchase:'Purchase',generate_lead:'Lead',view_item:'ViewContent'};
      if(map[ev])window.fbq('track',map[ev],data||{});
    }
  }catch(e){}
};

// Mobile menu toggle
var mb=document.getElementById('menuBtn'),mn=document.getElementById('mobNav');
if(mb&&mn){
  mb.addEventListener('click',function(){var o=mn.hidden;mn.hidden=!o;mb.setAttribute('aria-expanded',String(o));});
  mn.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){mn.hidden=true;mb.setAttribute('aria-expanded','false');});});
}

// Cart state
function loadCart(){try{return JSON.parse(localStorage.getItem('i75cart')||'{}')||{};}catch(e){return {};}}
function saveCart(c){try{localStorage.setItem('i75cart',JSON.stringify(c));}catch(e){}}
function fmt(n){return '$'+Number(n).toLocaleString('en-US');}
function $(id){return document.getElementById(id);}
function el(t,c,tx){var e=document.createElement(t);if(c)e.className=c;if(tx!=null)e.textContent=tx;return e;}

var cart=loadCart();
function cartSummary(){
  var sub=0,cnt=0,items=[];
  Object.keys(cart).forEach(function(k){
    var n=Number(cart[k])||0;
    if(!C.products[k]||n<=0)return;
    sub+=n*C.products[k].price;cnt+=n;items.push({sku:k,qty:n,product:C.products[k]});
  });
  var ship=cnt===0?0:(sub>=C.freeShip?0:C.flatShip);
  return {sub:sub,ship:ship,tot:sub+ship,cnt:cnt,items:items};
}
window.i75summary=cartSummary;
window.i75clearCart=function(){cart={};saveCart(cart);renderCart();};

function renderCart(){
  var s=cartSummary();
  document.querySelectorAll('[data-cart-count]').forEach(function(n){n.textContent=s.cnt;});
  var L=$('lines');if(!L)return;
  L.textContent='';
  if(!s.cnt){
    L.appendChild(el('p','msg','Your cart is empty. Pick a One-Clip or Two-Clip Kit to get started.'));
  }else{
    s.items.forEach(function(it){
      var r=el('div','cline'),im=el('img');im.src=it.product.img;im.alt=it.product.name;
      var m=el('div');m.appendChild(el('b',null,it.product.name));m.appendChild(el('span','csub',it.product.short));
      var ctrl=el('div');
      var qbox=el('span','cqty');
      var qm=el('button',null,'-');qm.type='button';qm.setAttribute('aria-label','Decrease quantity');
      qm.onclick=function(){if(cart[it.sku]>1)cart[it.sku]--;else delete cart[it.sku];saveCart(cart);renderCart();};
      var qv=el('span',null,String(it.qty));
      var qp=el('button',null,'+');qp.type='button';qp.setAttribute('aria-label','Increase quantity');
      qp.onclick=function(){cart[it.sku]=Math.min(9,(cart[it.sku]||0)+1);saveCart(cart);renderCart();};
      qbox.appendChild(qm);qbox.appendChild(qv);qbox.appendChild(qp);
      var rm=el('button','rm','Remove');rm.type='button';rm.onclick=function(){delete cart[it.sku];saveCart(cart);renderCart();};
      ctrl.appendChild(qbox);ctrl.appendChild(rm);m.appendChild(ctrl);
      r.appendChild(im);r.appendChild(m);r.appendChild(el('em',null,fmt(it.qty*it.product.price)));
      L.appendChild(r);
    });
  }
  var sm=$('shipMeter');
  if(sm){
    if(s.cnt===0)sm.textContent='Free US shipping on the Two-Clip Kit ($'+C.freeShip+'+)';
    else if(s.ship===0)sm.textContent='Unlocked: Free US Ground Shipping included!';
    else sm.textContent='Add '+fmt(C.freeShip-s.sub)+' more to unlock Free US Shipping (or upgrade to 2 clips)';
  }
  if($('csub'))$('csub').textContent=fmt(s.sub);
  if($('cship'))$('cship').textContent=s.cnt===0?'$0':(s.ship===0?'FREE':fmt(s.ship));
  if($('ctot'))$('ctot').textContent=fmt(s.tot);
  if($('goCheckout'))$('goCheckout').hidden=!s.cnt;
}

function openDrawer(o){
  var d=$('drawer');if(!d)return;
  d.hidden=!o;
  document.querySelectorAll('.scrim').forEach(function(s){s.hidden=!o;});
  if(o){var x=d.querySelector('.x');if(x)x.focus();}
}
window.i75add=function(k,n,btn,goNow){
  if(!C.products[k])return;
  cart[k]=Math.min(9,(cart[k]||0)+(n||1));
  saveCart(cart);renderCart();
  i75track('add_to_cart',{currency:'USD',value:C.products[k].price*(n||1),items:[{item_id:C.products[k].sku,item_name:C.products[k].name,price:C.products[k].price,quantity:n||1}]});
  if(goNow){location.href=C.checkoutPage;return;}
  if(btn){var t=btn.textContent;btn.classList.add('done');btn.textContent='Added to Cart';setTimeout(function(){btn.classList.remove('done');btn.textContent=t;},1100);}
  openDrawer(true);
};
document.querySelectorAll('[data-add]').forEach(function(b){b.addEventListener('click',function(){i75add(b.getAttribute('data-add'),1,b,false);});});
document.querySelectorAll('[data-buy]').forEach(function(b){b.addEventListener('click',function(){i75add(b.getAttribute('data-buy'),1,b,true);});});
document.querySelectorAll('[data-cart-open]').forEach(function(b){b.addEventListener('click',function(){openDrawer(true);});});
document.querySelectorAll('[data-cart-close]').forEach(function(b){b.addEventListener('click',function(){openDrawer(false);});});
document.addEventListener('keydown',function(e){if(e.key==='Escape')openDrawer(false);});
renderCart();

// Email signup forms -> Supabase site_signups
document.querySelectorAll('form[data-signup]').forEach(function(f){
  var m=$(f.id+'m');
  function say(t,ok){if(!m)return;m.textContent=t;m.className='msg'+(ok?' ok':' bad');m.hidden=false;}
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var v=f.email.value.trim();if(!v)return;
    var b=f.querySelector('button');if(b)b.disabled=true;
    var u=getUtm();var src=(f.getAttribute('data-signup')||'75golf.com')+(u.utm_source?':'+u.utm_source:'');
    src=src.slice(0,64);
    function win(){f.hidden=true;say('You are on the list. We will send updates when new batches and app drops go live.',true);i75track('generate_lead',{source:src});}
    function lose(){if(b)b.disabled=false;say('Could not save your email right now. Please try again or email ${MAIL}.',false);}
    if(!C.signupEndpoint){win();return;}
    fetch(C.signupEndpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:C.signupKey,Prefer:'return=minimal'},body:JSON.stringify({email:v,source:src})})
      .then(function(r){if(r.ok||r.status===409)win();else lose();}).catch(lose);
  });
});

// Autoplay helper for muted inline videos
function playVid(v){if(!v)return;v.muted=true;v.defaultMuted=true;v.playsInline=true;var p;try{p=v.play();}catch(e){return;}if(p&&p.catch)p.catch(function(){});}
document.querySelectorAll('video[data-auto]').forEach(function(v){
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)playVid(v);else v.pause();});},{threshold:0.25}).observe(v);
  }else{playVid(v);}
});
window.i75playVid=playVid;
window.i75cfg=C;

// Early Access (Waitlist + Skip-the-Line Member Codes)
var EA_ALPHA='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function eaChecksum(body){
  var h=2166136261,s=body+':i75-ea-v2';
  for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return EA_ALPHA[h%EA_ALPHA.length]+EA_ALPHA[(h>>>5)%EA_ALPHA.length];
}
function eaDigitCheck(num4){
  var h=2166136261,s=num4+':i75-ea-v2';
  for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return String(h%97).padStart(2,'0');
}
function eaLocalVerify(raw){
  var c=String(raw||'').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
  if(!c)return null;
  if(C.earlyAccess&&C.earlyAccess.founderCodes&&C.earlyAccess.founderCodes.indexOf(c)>=0)return c;
  var m=/^75-([0-9]{4})([0-9]{2})$/.exec(c);
  if(m&&eaDigitCheck(m[1])===m[2])return c;
  var m2=/^I75-([2-9A-HJ-NP-Z]{4})([2-9A-HJ-NP-Z]{2})$/.exec(c);
  if(m2&&eaChecksum(m2[1])===m2[2])return c;
  return null;
}
function eaLocalMint(seed){
  var out=[];
  for(var k=0;k<5;k++){
    var h=2166136261,s=String(seed)+':pass:'+k+':i75-ea-v2';
    for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    var num4=String(1000+(h%9000));
    out.push('75-'+num4+eaDigitCheck(num4));
  }
  return out;
}
function eaGetCode(){try{return localStorage.getItem('i75ea')||'';}catch(e){return '';}}
function eaSetCode(c){try{if(c)localStorage.setItem('i75ea',c);else localStorage.removeItem('i75ea');}catch(e){}}
function eaIsUnlocked(){return !(C.earlyAccess&&C.earlyAccess.enabled)||Boolean(eaGetCode());}
window.i75eaUnlocked=eaIsUnlocked;
window.i75eaCode=eaGetCode;

window.i75verifyCode=function(raw){
  var clean=String(raw||'').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
  if(!clean)return Promise.resolve(null);
  return fetch('/api/invite/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:clean})})
    .then(function(r){return r.ok?r.json().then(function(d){return d&&d.valid?d.code:null;}):null;})
    .catch(function(){return eaLocalVerify(clean);})
    .then(function(ok){return ok||eaLocalVerify(clean);});
};
window.i75mintPasses=function(ref,meta){
  var payload=Object.assign({ref:ref},meta||{});
  return fetch('/api/invite/mint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.ok?r.json().then(function(d){return d&&d.codes&&d.codes.length?d.codes:eaLocalMint(ref);}):eaLocalMint(ref);})
    .catch(function(){return eaLocalMint(ref);});
};

function syncEarlyAccessUI(){
  var unlocked=eaIsUnlocked(),code=eaGetCode();
  document.documentElement.setAttribute('data-ea',unlocked?'unlocked':'locked');
  document.querySelectorAll('[data-ea-locked]').forEach(function(n){n.hidden=unlocked;});
  document.querySelectorAll('[data-ea-unlocked]').forEach(function(n){n.hidden=!unlocked;});
  document.querySelectorAll('[data-ea-code-label]').forEach(function(n){n.textContent=code;});
  var pt=$('promoText'),pb=$('promoBtn');
  if(pt&&pb&&C.earlyAccess&&C.earlyAccess.enabled){
    if(unlocked){
      pt.innerHTML='<strong>Early Access Unlocked ('+code+'):</strong> Your spot in '+C.earlyAccess.batchLabel+' is ready.';
      pb.textContent='Order Your Kit';
      pb.setAttribute('data-ea-go-kit','1');
    }else{
      pt.innerHTML='<strong>Early Access · Small-Batch Release:</strong> Limited Ohio batches · Free US shipping on Two-Clip Kits.';
      pb.textContent='Have an Early Access code?';
      pb.removeAttribute('data-ea-go-kit');
    }
  }
  document.querySelectorAll('[data-ea-cta]').forEach(function(a){
    if(unlocked){
      a.textContent=a.textContent.indexOf('From')>=0?'Order Now, From $119':'Order Now';
    }
  });
  document.dispatchEvent(new CustomEvent('i75ea:change',{detail:{unlocked:unlocked,code:code}}));
}
window.i75syncEA=syncEarlyAccessUI;

// Early Access Modal wiring
var eaM=$('eaModal'),eaTW=$('eaTabWait'),eaTC=$('eaTabCode'),eaWF=$('eaWaitForm'),eaCF=$('eaCodeForm'),eaMT=$('eaModalTitle'),eaMS=$('eaModalSub');
function setEaTab(tab){
  if(!eaTW||!eaTC||!eaWF||!eaCF)return;
  var isCode=(tab==='code');
  eaTW.setAttribute('aria-pressed',String(!isCode));
  eaTC.setAttribute('aria-pressed',String(isCode));
  eaWF.hidden=isCode;
  eaCF.hidden=!isCode;
  if(eaMT)eaMT.textContent=isCode?'Enter Early Access Code':'Join Early Access';
  if(eaMS)eaMS.textContent=isCode
    ?'Enter a code from a friend who owns Inside 75 (or your batch invite) to unlock ordering right now.'
    :'We ship Inside 75 in small batches from Ohio. Join the list for the next drop, or ask any owner for one of their 5 Early Access links to skip the line.';
}
function openEaModal(tab,kit){
  if(!eaM)return;
  setEaTab(tab||'wait');
  var sel=$('eaKit');if(sel&&kit&&(kit==='one'||kit==='two'))sel.value=kit;
  eaM.hidden=false;
  var inp=tab==='code'?$('eaCodeIn'):$('eaEmail');
  if(inp)setTimeout(function(){inp.focus();},40);
}
function closeEaModal(){if(eaM)eaM.hidden=true;}
window.i75openEA=openEaModal;
if(eaTW)eaTW.onclick=function(){setEaTab('wait');};
if(eaTC)eaTC.onclick=function(){setEaTab('code');};
document.querySelectorAll('[data-ea-open]').forEach(function(b){
  b.addEventListener('click',function(){
    if(b.getAttribute('data-ea-go-kit')==='1'){location.href='${page('/kit')}';return;}
    openEaModal(b.getAttribute('data-ea-open'),b.getAttribute('data-ea-kit'));
  });
});
document.querySelectorAll('[data-ea-close]').forEach(function(b){b.addEventListener('click',closeEaModal);});
if(eaM)eaM.addEventListener('click',function(e){if(e.target===eaM)closeEaModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeEaModal();});

if(eaWF){
  eaWF.addEventListener('submit',function(e){
    e.preventDefault();
    var em=$('eaEmail').value.trim(),kt=$('eaKit').value||'two',msg=$('eaWaitMsg'),btn=eaWF.querySelector('button[type=submit]');
    if(!em)return;
    if(btn)btn.disabled=true;
    var src=('ea-waitlist:'+kt).slice(0,64);
    function ok(){
      if(msg){msg.textContent='You are on the Early Access list. Know someone who owns Inside 75? Ask them for one of their 5 Early Access links to skip the waitlist today.';msg.className='msg ok';msg.hidden=false;}
      if(btn)btn.textContent='On the List';
      i75track('generate_lead',{source:src});
    }
    function fail(){
      if(btn)btn.disabled=false;
      if(msg){msg.textContent='Could not save right now. Please try again or email ${MAIL}.';msg.className='msg bad';msg.hidden=false;}
    }
    if(!C.signupEndpoint){ok();return;}
    fetch(C.signupEndpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:C.signupKey,Prefer:'return=minimal'},body:JSON.stringify({email:em,source:src})})
      .then(function(r){if(r.ok||r.status===409)ok();else fail();}).catch(fail);
  });
}

function handleCodeSubmit(inputEl,msgEl,btnEl,onUnlock){
  var raw=(inputEl&&inputEl.value||'').trim();
  if(!raw)return;
  if(btnEl)btnEl.disabled=true;
  if(msgEl)msgEl.hidden=true;
  window.i75verifyCode(raw).then(function(valid){
    if(btnEl)btnEl.disabled=false;
    if(valid){
      eaSetCode(valid);
      syncEarlyAccessUI();
      if(msgEl){msgEl.textContent='Early Access unlocked! Ordering is now open.';msgEl.className='msg ok';msgEl.hidden=false;}
      if(onUnlock)onUnlock(valid);
    }else{
      if(msgEl){msgEl.textContent='We did not recognize that code. Double-check with your friend or join the waitlist.';msgEl.className='msg bad';msgEl.hidden=false;}
    }
  });
}
window.i75handleCodeSubmit=handleCodeSubmit;
if(eaCF){
  eaCF.addEventListener('submit',function(e){
    e.preventDefault();
    handleCodeSubmit($('eaCodeIn'),$('eaCodeMsg'),eaCF.querySelector('button[type=submit]'),function(){
      setTimeout(closeEaModal,550);
    });
  });
}

// Inline code forms anywhere on the page
document.querySelectorAll('form[data-ea-inline]').forEach(function(f){
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var inp=f.querySelector('input'),btn=f.querySelector('button[type=submit]'),msg=document.getElementById(f.getAttribute('data-msg')||'');
    handleCodeSubmit(inp,msg,btn);
  });
});

// Auto-unlock if arriving with ?invite=CODE or ?code=CODE
try{
  var uq=new URLSearchParams(location.search);
  var urlCode=uq.get('invite')||uq.get('code');
  if(urlCode){
    window.i75verifyCode(urlCode).then(function(valid){
      if(valid){
        eaSetCode(valid);
        syncEarlyAccessUI();
        try{
          uq.delete('invite');uq.delete('code');
          var qstr=uq.toString();
          history.replaceState(null,'',location.pathname+(qstr?'?'+qstr:'')+location.hash);
        }catch(e){}
      }
    });
  }
}catch(e){}
syncEarlyAccessUI();
})();`;

// ---------- HOME PAGE ----------
const homeBody = `
${header('home', true)}
<main>
<section class="hero" id="top"><div class="in hero-grid">
  <div>
    <div class="eyebrow">Real clubs · Real greens · At home</div>
    <h1>Play real golf at home with your own putter and wedge.</h1>
    <p class="sub">Clamp a tiny wireless sensor onto the shaft of the clubs already in your bag. Honest enough that scratch golfers respect the feel, simple enough to get 15 minutes of real reps on your living room rug.</p>
    <div class="hero-ctas">
      <a class="btn light" href="#kits" data-ea-cta>${EA_ON ? 'Get Early Access, From $' + P.one.price : 'Shop the Clip Kit, From $' + P.one.price}</a>
      <a class="btn ghost" href="#gameplay">Watch It Play</a>
    </div>
    <ul class="hero-checks">
      <li>${I.check}<span>Uses your own putter &amp; wedge</span></li>
      <li>${I.check}<span>No launch monitor, mat, or VR</span></li>
      <li>${I.check}<span>Hit real balls or swing air</span></li>
      <li>${I.check}<span>Free tablet app · 30-day trial</span></li>
    </ul>
  </div>
  <div class="hero-media">
    <div class="hero-frame">
      ${pic('hero-living', 'Golfer putting on a living room rug with their own blade putter wearing the sleek Inside 75 V2 clip, with an iPad ahead showing a sunlit 3D golf green', { eager: true })}
      <div class="hero-hud" aria-hidden="true">
        <div class="hero-hud-title">Inside 75 V2 Clip + Tablet App</div>
        <div class="hero-hud-stats"><span>Instant Response</span><span>3 to 75 yd</span><strong>Real-Slope Greens</strong></div>
      </div>
    </div>
  </div>
</div></section>

<div class="proof-strip"><div class="in proof-grid">
  <div class="proof-item"><div class="proof-icon">${I.club}</div><div><b>Your Real Clubs</b><span>Clamps cleanly right above the clubhead on steel-shaft putters and wedges. Zero toy sticks.</span></div></div>
  <div class="proof-item"><div class="proof-icon">${I.wave}</div><div><b>Accurate &amp; Instant</b><span>Catches subtle speed and face-angle changes with practically zero lag, ball or no ball.</span></div></div>
  <div class="proof-item"><div class="proof-icon">${I.tablet}</div><div><b>Real-World Greens</b><span>Mapped from real course terrain with Soft, Standard, and Tour green speeds.</span></div></div>
  <div class="proof-item"><div class="proof-icon">${I.shield}</div><div><b>Free App &amp; 30-Day Trial</b><span>Includes 1 full 18-hole course and all 4 games. No required subscription.</span></div></div>
</div></div>

<section class="sec" id="steps"><div class="in">
  <div class="sec-head">
    <div class="eyebrow">How Inside 75 works</div>
    <h2>Clamps on in 2 minutes. Plays every shot inside 75 yards.</h2>
    <p class="lead">No room buildout, no projector, and no calibration rig. Just your putter, your wedge, and the tablet you already own.</p>
  </div>
  <div class="steps-grid">
    <article class="step-card">
      <div class="step-img">${pic('mount-hands', 'Hands tightening the Inside 75 V2 sensor clip onto a chrome putter shaft with the included hex key')}</div>
      <div class="step-body">
        <h3>Clip it onto your club</h3>
        <p>Clamp the sleek sensor right above the clubhead with the included hex key. Connect to your home Wi-Fi once and you are ready to play in under five minutes.</p>
      </div>
    </article>
    <article class="step-card">
      <div class="step-img">${pic('lifestyle-wedge', 'Golfer in a sunlit garage studio chipping a golf ball into a net with a steel wedge fitted with the Inside 75 V2 clip, and an iPad resting safely across from the golfer stance')}</div>
      <div class="step-body">
        <h3>Swing your own clubs, ball or no ball</h3>
        <p>Putt on your living room rug or chip into a garage net. Hit real golf balls when you have a net, or take practice swings anytime when you don't.</p>
      </div>
    </article>
    <article class="step-card">
      <div class="step-img">${pic('course-benttree', 'Real 3D golf green and flagstick in the Inside 75 tablet app built from real elevation scans')}</div>
      <div class="step-body">
        <h3>Watch the shot react right off your face</h3>
        <p>The ball launches on screen the moment you swing, with practically zero lag. Pull a 10-footer slightly left or leave a chip short and you will see it honestly, just like outdoors.</p>
      </div>
    </article>
  </div>
</div></section>

<section class="sec white" id="gameplay"><div class="in play-grid">
  <div>
    <div class="eyebrow">Inside the app</div>
    <h2>Impressive enough for scratch golfers. Ready in two minutes.</h2>
    <p class="lead">Most indoor golf gear feels like an arcade toy. Inside 75 responds right off your clubface with real green speeds and breaks, so even low-handicap and scratch golfers actually trust it between tee times.</p>
    <div class="clip-tabs" role="group" aria-label="Explore Inside 75 game modes">
      <button type="button" class="clip-tab" data-clip="reel-putting" data-meta="Real 4 ft, 10 ft &amp; 25 ft putts · Soft 9.5 / Standard 10.5 / Tour 12.0" data-tag="Actual Gameplay" aria-pressed="true">
        <div><b>Putting &amp; Green Reading</b><span>First-person stroke, real slope &amp; break, pace control from 3 to 40 ft</span></div><em>3 to 40 ft</em>
      </button>
      <button type="button" class="clip-tab" data-clip="reel-chipping" data-meta="Real greenside chips &amp; approach pitches · Natural bounce, check &amp; rollout" data-tag="Actual Gameplay" aria-pressed="false">
        <div><b>Chipping &amp; Pitching</b><span>Hit your own wedges over bunkers and tight lies out to 75 yards</span></div><em>Up to 75 yd</em>
      </button>
      <button type="button" class="clip-tab" data-clip="reel-practice" data-meta="Dial in any yardage (5 to 75 yd) · Fairway, rough &amp; bunker lies · Live dispersion" data-tag="Actual Gameplay" aria-pressed="false">
        <div><b>Dialed-In Practice Mode</b><span>Lock in specific wedge numbers and putting distances in 15 minutes</span></div><em>Any Yardage</em>
      </button>
      <button type="button" class="clip-tab" data-clip="reel-courses" data-meta="Real elevation-mapped courses · Chip onto the green, then putt it in the cup" data-tag="Actual Gameplay" aria-pressed="false">
        <div><b>18-Hole Short Game Courses</b><span>Scramble up-and-down across real contoured courses at home</span></div><em>18 Holes</em>
      </button>
    </div>
    <p style="font-size:14.5px;color:var(--ink-2)">Pull a 10-footer half a degree left and it burns the left edge. Every session tracks <strong>clubhead speed, face angle, swing path, and Strokes Gained</strong> so 15 minutes on a Tuesday night actually shows up on your Saturday scorecard.</p>
  </div>
  <div>
    <div class="ipad-shell">
      <div class="ipad-screen">
        <video id="gameVid" src="assets/reel-putting.mp4" poster="assets/reel-putting.jpg" data-auto muted loop playsinline preload="metadata" aria-label="Real gameplay inside the Inside 75 tablet app"></video>
      </div>
      <div class="ipad-bar">
        <span id="gameMeta">Real 4 ft, 10 ft &amp; 25 ft putts · Soft 9.5 / Standard 10.5 / Tour 12.0</span>
        <strong id="gameTag">Actual Gameplay</strong>
      </div>
    </div>
  </div>
</div></section>

<section class="sec stone" id="hardware"><div class="in hw-grid">
  <div class="stage-card">
    <div class="stage-view">
      <model-viewer id="v2Model" src="assets/v2-clip.glb?v=${ASSET_V}" poster="assets/clip-360.jpg?v=${ASSET_V}" alt="Interactive 3D model of the Inside 75 V2 clip sensor" camera-controls auto-rotate auto-rotate-delay="1200" rotation-per-second="26deg" shadow-intensity="0.85" shadow-softness="0.9" exposure="1.08" environment-image="neutral" camera-orbit="32deg 74deg 112%" min-camera-orbit="auto auto 72%" max-camera-orbit="auto auto 185%" touch-action="pan-y" interaction-prompt="none"></model-viewer>
      <img id="v2Img" src="assets/v2-putter.jpg?v=${ASSET_V}" alt="Inside 75 V2 clip mounted on a golf club" hidden>
      <span class="stage-badge" id="stageBadge">V2 Hardware · Interactive 3D</span>
      <span class="stage-hint" id="stageHint">Drag or touch to rotate in 3D</span>
    </div>
    <div class="angle-pills" role="group" aria-label="Inspect V2 hardware views">
      <button type="button" data-stage="3d" data-label="V2 Hardware · Interactive 3D" aria-pressed="true">3D View</button>
      <button type="button" data-stage="clubs-pair" data-label="V2 Clips · Putter + Wedge" aria-pressed="false">Putter + Wedge</button>
      <button type="button" data-stage="v2-putter" data-label="V2 Clip · On Putter Shaft" aria-pressed="false">On Putter</button>
      <button type="button" data-stage="v2-wedge" data-label="V2 Clip · On Wedge Shaft" aria-pressed="false">On Wedge</button>
      <button type="button" data-stage="v2-back34" data-label="V2 Clip · Two-Bolt Shaft Clamp" aria-pressed="false">Back Clamp</button>
      <button type="button" data-stage="clip-charge" data-label="V2 Clip · USB-C Charging" aria-pressed="false">USB-C Charge</button>
    </div>
  </div>
  <div>
    <div class="eyebrow">Meet the V2 Clip</div>
    <h2>Compact, rounded, and built to stay on your clubs.</h2>
    <p class="lead">Redesigned from the ground up with a smooth, low-profile shell that sits cleanly above the hosel and disappears once you stand over the ball.</p>
    <ul class="feat-list">
      <li><div class="fi">${I.wave}</div><div><b>Pinpoint stroke accuracy</b><span>Captures tiny differences in speed, face angle, and swing path right near the clubhead, from touchy 3-footers to 75-yard pitches.</span></div></li>
      <li><div class="fi">${I.wifi}</div><div><b>Instant, lag-free response</b><span>Streams straight to your tablet over home Wi-Fi so the ball reacts the moment you swing, with free wireless updates built in.</span></div></li>
      <li><div class="fi">${I.bolt}</div><div><b>No power button to remember</b><span>Sleeps automatically when your club rests in the bag and wakes the second you pick it up. Recharges with any USB-C cable.</span></div></li>
    </ul>
  </div>
</div></section>

<section class="sec" id="telemetry"><div class="in">
  <div class="sec-head">
    <div class="eyebrow">Real feel, zero flattery</div>
    <h2>Why even scratch golfers trust the feedback.</h2>
    <p class="lead">Weighted swing toys flatter every stroke, and indoor ball radars struggle on soft chips and short putts. Because Inside 75 sits right on your club, tiny changes in speed, face angle, and path show up on screen immediately.</p>
  </div>
  <div class="tel-stage">
    <img id="telBg" class="tel-bg" src="assets/course-benttree.jpg?v=${ASSET_V}" alt="Sunlit breaking golf green inside the Inside 75 app" loading="lazy" decoding="async">
    <div class="tel-scrim" aria-hidden="true"></div>
    <div class="tel-top">
      <div class="tel-tabs" role="group" aria-label="Select shot type">
        <button type="button" data-shot="putt" aria-pressed="true">Putt (3 to 40 ft)</button>
        <button type="button" data-shot="chip" aria-pressed="false">Chip (Fringe &amp; Rough)</button>
        <button type="button" data-shot="pitch" aria-pressed="false">Pitch (Up to 75 yd)</button>
      </div>
    </div>
    <div class="tel-hud">
      <div class="tel-cols">
        <div class="tel-panel">
          <div class="tel-label">Read off your clubhead</div>
          <div class="tel-metrics">
            <div class="tel-m"><span>Club Speed</span><strong id="tm1">5.8 mph</strong></div>
            <div class="tel-m"><span>Face Angle</span><strong id="tm2">0.4° Open</strong></div>
            <div class="tel-m"><span>Swing Path</span><strong id="tm3">0.6° In-Out</strong></div>
          </div>
        </div>
        <div class="tel-arrow" aria-hidden="true">&#8594;</div>
        <div class="tel-panel out">
          <div class="tel-label">Live on your tablet</div>
          <div class="tel-metrics">
            <div class="tel-m"><span id="tl4">Start Line</span><strong id="tm4">1.2° Right</strong></div>
            <div class="tel-m"><span id="tl5">Green Speed</span><strong id="tm5">10.5 Stimp</strong></div>
            <div class="tel-m"><span id="tl6">Result</span><strong id="tm6">Holed · 10 ft</strong></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <p class="tel-note" id="telNote"><strong>Why it feels immediate:</strong> Inside 75 reads your club through impact instead of waiting to track a flying ball across a room. The shot launches on screen right away and reads honestly whether you hit a real ball or take a practice swing.</p>
</div></section>

<section class="sec white" id="courses"><div class="in">
  <div class="sec-head split">
    <div>
      <div class="eyebrow">Real-world greens</div>
      <h2>Greens built from real course terrain.</h2>
    </div>
    <p class="lead" style="margin:0">Every mound, tier, bunker lip, and breaking putt comes from high-resolution elevation mapping of real courses. Switch between Soft, Standard, and Tour green speeds anytime.</p>
  </div>
  <div class="courses-grid">
    ${COURSES.map(c => `<figure class="course-card">${pic(c.img, c.name)}<figcaption><b>${c.name}</b><span>${c.meta}</span></figcaption></figure>`).join('')}
  </div>
  <div class="banner-split">
    ${pic('lifestyle-friends', 'Two friends enjoying an Inside 75 putting match in a sunlit living room with a real putter, V2 clip, and iPad showing a golf green')}
    <div class="banner-copy">
      <div class="eyebrow">Stay sharp between tee times</div>
      <h3>15 minutes on a weeknight. 18 holes with your foursome on Friday.</h3>
      <p>Whether you are trying to break 80 or stay sharp as a scratch golfer with a packed week, groove your 35-yard wedge and 10-foot start line after work, then pass the putter around with up to four friends on one tablet.</p>
      <div class="pill-row">
        <span>Short Game (18 Holes)</span>
        <span>Putting</span>
        <span>Closest to the Pin</span>
        <span>Exact-Yardage Practice</span>
      </div>
    </div>
  </div>
</div></section>

<section class="sec" id="compare-preview"><div class="in">
  <div class="sec-head split">
    <div>
      <div class="eyebrow">Honest comparison</div>
      <h2>Real clubs. Real greens. A fraction of the cost.</h2>
    </div>
    <a class="btn line" href="${page('/compare')}">Full Comparison Guide &#8594;</a>
  </div>
  <div class="cmp-wrap">
    <table class="cmp">
      <thead>
        <tr>
          <th>Feature</th>
          <th class="hi">Inside 75</th>
          <th>Launch Monitors</th>
          <th>Toy Swing Sticks</th>
          <th>Putting Mats</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Typical Price</td><td class="hi">$119 to $229</td><td>$2,000 to $15,000+</td><td>$250 to $330</td><td>$100 to $500</td></tr>
        <tr><td>Uses your real putter &amp; wedge</td><td class="hi"><span class="ok">&#10003; Yes</span></td><td>Yes</td><td><span class="no">No (short weighted stick)</span></td><td>Putter only</td></tr>
        <tr><td>Putts, chips &amp; pitches (0 to 75 yd)</td><td class="hi"><span class="ok">&#10003; All three</span></td><td>Limited on short putts</td><td>Simulated swings</td><td><span class="no">Putts only</span></td></tr>
        <tr><td>Works in a normal living room</td><td class="hi"><span class="ok">&#10003; Yes</span></td><td><span class="no">Needs tall room + bay</span></td><td>Yes</td><td>Flat mat only</td></tr>
        <tr><td>Works with real balls OR no ball</td><td class="hi"><span class="ok">&#10003; Both</span></td><td><span class="no">Real balls only</span></td><td>No ball only</td><td>Real balls only</td></tr>
        <tr><td>Mandatory subscription</td><td class="hi"><span class="ok">None (Free app)</span></td><td>Often $200 to $500/yr</td><td>Often paid courses</td><td>None</td></tr>
      </tbody>
    </table>
  </div>
</div></section>

<section class="sec stone" id="kits"><div class="in">
  <div class="sec-head center">
    <div class="eyebrow">${EA_ON ? 'Early Access · ' + esc(EA.batchLabel || 'Batch 2') : 'Choose your kit'}</div>
    <h2>Ready to play 18 in your living room?</h2>
    <p class="lead">Every kit includes assembled V2 hardware, the hex key, free tablet app access, and a 30-day home trial. Every buyer also gets 5 Early Access links to share with friends.</p>
  </div>
  ${EA_ON ? `<div class="ea-strip" data-ea-locked>
    <div class="ea-strip-copy"><b>Small-Batch Early Access</b><span>Join the waitlist for our next Ohio batch, or enter an owner's code to skip the line and order today.</span></div>
    <form class="ea-code-form" data-ea-inline data-msg="homeEaMsg">
      <label for="homeEaIn" class="sr">Early Access code</label>
      <input id="homeEaIn" type="text" placeholder="Access code" autocomplete="off">
      <button type="submit" class="btn sm">Unlock</button>
    </form>
  </div>
  <p class="msg" id="homeEaMsg" role="status" hidden style="text-align:center;margin:-14px auto 22px"></p>
  <div class="ea-strip unlocked" data-ea-unlocked hidden>
    <div class="ea-strip-copy"><b>Early Access Unlocked (<span data-ea-code-label></span>)</b><span>Your spot in ${esc(EA.batchLabel || 'Batch 2')} is open. Pick your kit below to order now.</span></div>
  </div>` : ''}
  <div class="kits-grid">
    <article class="kit-card featured">
      <span class="kit-ribbon">Most Popular · Free US Shipping</span>
      <a class="kit-photo" href="${page('/kit')}#two" aria-label="View Two-Clip Kit details">${pic('kit-two', P.two.alt)}</a>
      <div class="kit-body">
        <div class="kit-top">
          <h3>${P.two.name}</h3>
          <div class="kit-price"><small>$${P.two.compareAt}</small>$${P.two.price}</div>
        </div>
        <p class="kit-desc">${P.two.sub}</p>
        <ul class="kit-bullets">${P.two.bullets.map(b => `<li>${I.check}<span>${b}</span></li>`).join('')}</ul>
        <div class="kit-acts" data-ea-unlocked${EA_ON ? ' hidden' : ''}>
          <button type="button" class="btn primary" data-buy="two">Order Now, $${P.two.price}</button>
          <button type="button" class="btn line" data-add="two">Add to Cart</button>
        </div>
        ${EA_ON ? `<div class="kit-acts" data-ea-locked>
          <button type="button" class="btn primary" data-ea-open="wait" data-ea-kit="two">Join Early Access</button>
          <button type="button" class="btn line" data-ea-open="code" data-ea-kit="two">Have a Code?</button>
        </div>` : ''}
      </div>
    </article>
    <article class="kit-card">
      <a class="kit-photo" href="${page('/kit')}#one" aria-label="View One-Clip Kit details">${pic('kit-one', P.one.alt)}</a>
      <div class="kit-body">
        <div class="kit-top">
          <h3>${P.one.name}</h3>
          <div class="kit-price">$${P.one.price}</div>
        </div>
        <p class="kit-desc">${P.one.sub}</p>
        <ul class="kit-bullets">${P.one.bullets.map(b => `<li>${I.check}<span>${b}</span></li>`).join('')}</ul>
        <div class="kit-acts" data-ea-unlocked${EA_ON ? ' hidden' : ''}>
          <button type="button" class="btn" data-buy="one">Order Now, $${P.one.price}</button>
          <button type="button" class="btn line" data-add="one">Add to Cart</button>
        </div>
        ${EA_ON ? `<div class="kit-acts" data-ea-locked>
          <button type="button" class="btn" data-ea-open="wait" data-ea-kit="one">Join Early Access</button>
          <button type="button" class="btn line" data-ea-open="code" data-ea-kit="one">Have a Code?</button>
        </div>` : ''}
      </div>
    </article>
  </div>
  <div class="guarantee-bar">
    <div>${I.truck}<span>Free US shipping on 2-Clip Kits</span></div>
    <div>${I.shield}<span>30-day home trial &amp; easy returns</span></div>
    <div>${I.bolt}<span>1-year hardware warranty</span></div>
    <div>${I.tablet}<span>Free iPad &amp; Android app included</span></div>
  </div>
</div></section>

<section class="sec" id="requirements"><div class="in">
  <div class="sec-head">
    <div class="eyebrow">No surprises before you order</div>
    <h2>What you need, and what you can skip.</h2>
  </div>
  <div class="needs-grid">
    <div class="skip-card">
      <div class="skip-media">${pic('mount-hands', 'Tightening the compact Inside 75 V2 clip onto a putter shaft above a living room putting mat')}</div>
      <div class="skip-body">
        <div class="skip-kicker">What you can skip</div>
        <div class="skip-tags">
          <span>${I.x}No launch monitor</span>
          <span>${I.x}No putting mat</span>
          <span>${I.x}No VR or toy stick</span>
          <span>${I.x}No required subscription</span>
        </div>
      </div>
    </div>
    <ul class="need-rows">
      <li><div class="need-ico">${I.club}</div><div><b>Your own steel-shaft putter or wedge</b><span>Right-handed clubs only for now. Clamps right above the clubhead in two minutes.</span></div></li>
      <li><div class="need-ico">${I.tablet}</div><div><b>A supported tablet</b><span>Works with ${TABLETS_SIMPLE}. Phones are not supported yet.</span></div></li>
      <li><div class="need-ico">${I.wifi}</div><div><b>Home Wi-Fi</b><span>Connects once during setup so your tablet and clip pair automatically every time.</span></div></li>
      <li><div class="need-ico">${I.bolt}</div><div><b>Any USB-C cable &amp; safe swing room</b><span>Recharges with any USB-C cable (not in the box). Add a net if hitting real balls with a wedge.</span></div></li>
    </ul>
  </div>
</div></section>

<section class="sec navy" id="app"><div class="in app-grid">
  <div>
    <div class="eyebrow">The Inside 75 Tablet App</div>
    <h2>Free to play. Upgrade only if you want more courses.</h2>
    <p class="lead">Download Inside 75 on your iPad or Android tablet. Every hardware kit unlocks a full 18-hole course and all four game modes with zero monthly fees.</p>
    <div class="store-badges">
      ${storeBadge('apple', cfg.appStore)}
      ${storeBadge('play', cfg.googlePlay)}
    </div>
  </div>
  <div class="tier-cards">
    <div class="tier">
      <div class="tier-row"><b>Included Free</b><em>Included ($0)</em></div>
      <p>1 complete 18-hole course, all 4 game modes (Short Game, Putting, Closest to the Pin, Practice), 1 to 4 players, Soft / Standard / Tour green speeds, and free clip firmware updates.</p>
    </div>
    <div class="tier">
      <div class="tier-row"><b>Inside 75 Plus</b><em>$49.99 / yr (optional)</em></div>
      <p>Unlocks the full growing library of real elevation-mapped courses plus long-term swing and short-game history across every session.</p>
    </div>
  </div>
</div></section>

<section class="sec white" id="faq"><div class="in faq-wrap">
  <div class="sec-head center">
    <div class="eyebrow">FAQ</div>
    <h2>Frequently asked questions.</h2>
  </div>
  <div class="faq-list">
    ${QA.map(([q, a], idx) => `<details${idx < 2 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('\n    ')}
  </div>
</div></section>

<section class="sec" id="updates"><div class="in">
  <div class="notify-card">
    <div>
      <div class="eyebrow">${EA_ON ? 'Early Access · ' + esc(EA.batchLabel || 'Batch 2') : 'Course &amp; drop updates'}</div>
      <h2 style="font-size:clamp(26px,3.2vw,38px)">${EA_ON ? 'Want in on the next Ohio batch?' : 'Get new course &amp; drop updates.'}</h2>
      <p style="color:var(--ink-2);margin:0">${EA_ON ? 'Join the waitlist for upcoming shipping batches, new course releases, and left-handed club announcements. No spam, unsubscribe anytime.' : 'Drop your email for new course releases, batch dates, and left-handed club announcements. No spam, unsubscribe anytime.'}</p>
    </div>
    <div>
      <form class="form" id="homeNotify" data-signup="75golf.com">
        <label for="homeNotifyE" class="sr">Email address</label>
        <input id="homeNotifyE" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
        <button type="submit" class="btn primary">${EA_ON ? 'Join Waitlist' : 'Join List'}</button>
      </form>
      <p class="msg" id="homeNotifym" role="status" hidden></p>
    </div>
  </div>
</div></section>
</main>
${footer}
${cartDrawer}
<script>
${coreJs}
(function(){
  // Gameplay video switcher
  var gv=document.getElementById('gameVid'),gm=document.getElementById('gameMeta'),gt=document.getElementById('gameTag');
  document.querySelectorAll('[data-clip]').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('[data-clip]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});
      var c=b.getAttribute('data-clip');
      if(gv){gv.poster='assets/'+c+'.jpg';gv.src='assets/'+c+'.mp4';gv.load();i75playVid(gv);}
      if(gm)gm.textContent=b.getAttribute('data-meta')||'';
      if(gt)gt.textContent=b.getAttribute('data-tag')||'';
    });
  });

  // V2 interactive 3D & angle showcase switcher
  var mv=document.getElementById('v2Model'),im=document.getElementById('v2Img'),sb=document.getElementById('stageBadge'),sh=document.getElementById('stageHint');
  if(mv&&sh){mv.addEventListener('pointerdown',function(){sh.hidden=true;},{once:true});}
  document.querySelectorAll('[data-stage]').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('[data-stage]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});
      var k=b.getAttribute('data-stage');
      if(sb)sb.textContent=b.getAttribute('data-label')||'';
      if(k==='3d'){if(mv)mv.hidden=false;if(im)im.hidden=true;if(sh)sh.hidden=false;}
      else{if(mv)mv.hidden=true;if(sh)sh.hidden=true;if(im){im.src='assets/'+k+'.jpg?v=${ASSET_V}';im.hidden=false;}}
    });
  });

  // Interactive telemetry shot switcher (updates broadcast stats + real course backdrop)
  var SHOTS={
    putt:['5.8 mph','0.4\u00b0 Open','0.6\u00b0 In-Out','Start Line','1.2\u00b0 Right','Green Speed','10.5 Stimp','Result','Holed · 10 ft','course-benttree'],
    chip:['24.5 mph','1.1\u00b0 Open','1.8\u00b0 Out-In','Carry','9 yd','Rollout','6 yd','Result','2 ft 4 in','course-foxfire3'],
    pitch:['52.0 mph','0.5\u00b0 Closed','0.8\u00b0 In-Out','Carry','58 yd','Apex','44 ft','Result','6 ft 2 in','reel-chipping']
  };
  var tbg=document.getElementById('telBg');
  document.querySelectorAll('[data-shot]').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('[data-shot]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});
      var s=SHOTS[b.getAttribute('data-shot')];if(!s)return;
      document.getElementById('tm1').textContent=s[0];
      document.getElementById('tm2').textContent=s[1];
      document.getElementById('tm3').textContent=s[2];
      document.getElementById('tl4').textContent=s[3];document.getElementById('tm4').textContent=s[4];
      document.getElementById('tl5').textContent=s[5];document.getElementById('tm5').textContent=s[6];
      document.getElementById('tl6').textContent=s[7];document.getElementById('tm6').textContent=s[8];
      if(tbg&&s[9])tbg.src='assets/'+s[9]+'.jpg?v=${ASSET_V}';
    });
  });
})();
</script>`;

// ---------- KIT PDP PAGE (/kit) ----------
const pdpGallery = [
  { id: 'kit-two', type: 'img', label: 'Two-Clip Kit', alt: P.two.alt },
  { id: 'clip-360', type: '3d', label: 'Interactive 3D', alt: 'Interactive 3D model of the Inside 75 V2 clip' },
  { id: 'clubs-pair', type: 'img', label: 'Putter & Wedge', alt: 'Inside 75 V2 clips mounted on both a putter and a sand wedge' },
  { id: 'hero-living', type: 'img', label: 'At Home', alt: 'Putting at home with the Inside 75 V2 clip and iPad' },
  { id: 'kit-one', type: 'img', label: 'One-Clip Kit', alt: P.one.alt },
  { id: 'mount-hands', type: 'img', label: '2-Min Install', alt: 'Tightening the Inside 75 V2 clip onto a putter shaft with a hex key' },
  { id: 'clip-charge', type: 'img', label: 'USB-C Charge', alt: 'Inside 75 V2 clip charging with a USB-C cable' },
  { id: 'v2-back34', type: 'img', label: 'Back Clamp', alt: 'Close-up of the Inside 75 V2 two-bolt shaft clamp' },
];

const kitBody = `
${header('kit', false)}
<main>
<section class="pdp"><div class="in pdp-grid">
  <div class="gal">
    <div class="thumbs" role="group" aria-label="Product gallery">
      ${pdpGallery.map((g, i) => `<button type="button" aria-pressed="${i === 0}" data-gtype="${g.type}" data-gid="${g.id}" data-galt="${esc(g.alt)}" aria-label="${esc(g.label)}"><img src="assets/${g.id}.jpg?v=${ASSET_V}" alt="" loading="lazy">${g.type === '3d' ? '<span class="tag360">3D</span>' : ''}</button>`).join('')}
    </div>
    <figure class="gmain">
      <img id="gimg" src="assets/kit-two.jpg?v=${ASSET_V}" alt="${esc(P.two.alt)}" fetchpriority="high">
      <model-viewer id="gmodel" src="assets/v2-clip.glb?v=${ASSET_V}" poster="assets/clip-360.jpg?v=${ASSET_V}" alt="Interactive 3D model of the Inside 75 V2 clip" camera-controls auto-rotate auto-rotate-delay="1200" rotation-per-second="26deg" shadow-intensity="0.85" shadow-softness="0.9" exposure="1.08" environment-image="neutral" camera-orbit="32deg 74deg 112%" min-camera-orbit="auto auto 72%" max-camera-orbit="auto auto 185%" touch-action="pan-y" interaction-prompt="none" hidden></model-viewer>
    </figure>
  </div>
  <div>
    <p class="crumb"><a href="${page('/')}">Home</a> / Inside 75 Clip Kit (V2)</p>
    <h1 style="font-size:clamp(32px,3.6vw,44px);line-height:1.05">Inside 75 Clip Kit</h1>
    <p style="color:var(--ink-2);margin:10px 0 0">Compact wireless sensors for your own putter and wedge. Accurate, instant on-screen shot feedback across real breaking greens on your iPad or Android tablet.</p>
    <div class="pdp-price" id="bp">$${P.two.price}</div>
    <div class="pdp-ship" id="bship">${P.two.shipping} · 30-day home trial · 1-year warranty</div>

    <fieldset class="opts">
      <legend>Select Your Kit</legend>
      <label class="opt">
        <input type="radio" name="v" value="two" checked>
        <span><b>Two-Clip Kit (Most Popular)</b><span>${P.two.opt} · Free US shipping</span></span>
        <em>$${P.two.price}</em>
      </label>
      <label class="opt">
        <input type="radio" name="v" value="one">
        <span><b>One-Clip Starter Kit</b><span>${P.one.opt}</span></span>
        <em>$${P.one.price}</em>
      </label>
    </fieldset>

    <div class="qrow" data-ea-unlocked${EA_ON ? ' hidden' : ''}>
      <div class="qty"><button type="button" id="qm" aria-label="Decrease quantity">&minus;</button><output id="qv">1</output><button type="button" id="qp" aria-label="Increase quantity">+</button></div>
      <button type="button" class="btn primary" id="padd">Add to Cart, $${P.two.price}</button>
    </div>
    <div class="buy-now-row" data-ea-unlocked${EA_ON ? ' hidden' : ''}>
      <button type="button" class="btn" id="pbuy">Express Order Now</button>
    </div>
    ${EA_ON ? `<div class="ea-pdp-box" data-ea-locked>
      <b>Early Access · ${esc(EA.batchLabel || 'Batch 2')}</b>
      <p>We ship in small batches from Ohio. Join the waitlist for the next drop, or enter a friend's Early Access code to skip the line and order today.</p>
      <button type="button" class="btn primary" id="pWait" style="width:100%;margin-bottom:12px">Join Early Access Waitlist</button>
      <form class="ea-code-form" data-ea-inline data-msg="pdpEaMsg" style="width:100%">
        <label for="pdpEaIn" class="sr">Early Access code</label>
        <input id="pdpEaIn" type="text" placeholder="Have a friend's code?" autocomplete="off" style="flex:1">
        <button type="submit" class="btn sm">Unlock</button>
      </form>
      <p class="msg" id="pdpEaMsg" role="status" hidden></p>
    </div>
    <div class="ea-pdp-box unlocked" data-ea-unlocked hidden>
      <b>Early Access Unlocked (<span data-ea-code-label></span>)</b>
      <p style="margin:0">Your spot in ${esc(EA.batchLabel || 'Batch 2')} is ready. Every order also includes 5 Early Access links to share with friends.</p>
    </div>` : ''}

    <div class="faq-list" style="margin-top:18px">
      <details open><summary>What is in the box?</summary><p id="kbox">${P.two.box}</p></details>
      <details><summary>One clip or two?</summary><p>A full round of Short Game uses both your wedge and your putter. Two clips let you keep one on each club with zero swapping. One clip plays Putting, Closest to the Pin, and Practice, and moves between clubs in about 20 seconds.</p></details>
      <details><summary>Supported clubs &amp; tablets</summary><p>Fits right-handed steel-shaft putters and wedges. Works with ${TABLETS_SIMPLE}. Phones are not supported yet. See Tech Specs below for exact hardware requirements.</p></details>
      <details><summary>Shipping, 30-day trial &amp; warranty</summary><p>Two-Clip Kits ship free in the US ($9 flat shipping on One-Clip Kits). Every kit includes a 30-day home trial and 1-year limited hardware warranty. <a href="${page('/shipping-returns')}">Full policy</a>.</p></details>
    </div>
  </div>
</div></section>

<section class="sec"><div class="in hw-grid">
  <div>
    <div class="eyebrow">Technical Specifications</div>
    <h2>Built for feel, speed, and zero friction.</h2>
    <p class="lead">Every detail of the V2 clip is built to disappear on your club while delivering fast, responsive, pinpoint short-game feedback.</p>
    <p><a class="btn line" href="${page('/how-it-works')}">See Setup Guide &#8594;</a></p>
  </div>
  <dl class="spec-table">
    <div><dt>In the Box</dt><dd id="kbox2">${P.two.box}</dd></div>
    ${FACTS.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n    ')}
  </dl>
</div></section>
</main>
${footer}
${cartDrawer}
<script>
${coreJs}
(function(){
  var P={two:{p:${P.two.price},img:'kit-two',box:${JSON.stringify(P.two.box)},ship:${JSON.stringify(P.two.shipping + ' · 30-day home trial · 1-year warranty')}},one:{p:${P.one.price},img:'kit-one',box:${JSON.stringify(P.one.box)},ship:${JSON.stringify(P.one.shipping + ' · 30-day home trial · 1-year warranty')}}};
  var cur='two',q=1;
  var gi=document.getElementById('gimg'),gm=document.getElementById('gmodel');
  var th=[].slice.call(document.querySelectorAll('.thumbs button'));
  function showMedia(type,id,alt){
    th.forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-gid')===id?'true':'false');});
    if(type==='3d'){if(gi)gi.hidden=true;if(gm)gm.hidden=false;}
    else{if(gm)gm.hidden=true;if(gi){gi.src='assets/'+id+'.jpg?v=${ASSET_V}';gi.alt=alt||'Inside 75 Clip Kit';gi.hidden=false;}}
  }
  th.forEach(function(b){b.addEventListener('click',function(){showMedia(b.getAttribute('data-gtype'),b.getAttribute('data-gid'),b.getAttribute('data-galt'));});});
  function sync(){
    var v=P[cur];
    document.getElementById('bp').textContent='$'+(v.p*q).toLocaleString('en-US');
    document.getElementById('bship').textContent=v.ship;
    document.getElementById('kbox').textContent=v.box;
    document.getElementById('kbox2').textContent=v.box;
    document.getElementById('qv').textContent=q;
    document.getElementById('padd').textContent='Add to Cart, $'+(v.p*q).toLocaleString('en-US');
  }
  function pick(k){
    if(!P[k])return;cur=k;
    var r=document.querySelector('input[name=v][value='+k+']');if(r)r.checked=true;
    showMedia('img',P[k].img);sync();
    try{history.replaceState(null,'','#'+k);}catch(e){}
  }
  document.querySelectorAll('input[name=v]').forEach(function(r){r.addEventListener('change',function(){pick(r.value);});});
  document.getElementById('qm').onclick=function(){if(q>1){q--;sync();}};
  document.getElementById('qp').onclick=function(){if(q<9){q++;sync();}};
  document.getElementById('padd').onclick=function(){i75add(cur,q,this,false);};
  document.getElementById('pbuy').onclick=function(){i75add(cur,q,this,true);};
  var pw=document.getElementById('pWait');if(pw)pw.onclick=function(){if(window.i75openEA)window.i75openEA('wait',cur);};
  var h=(location.hash||'').slice(1);if(h==='one'||h==='two')pick(h);else sync();
  i75track('view_item',{currency:'USD',value:P[cur].p,items:[{item_id:cur==='two'?'I75-KIT-2':'I75-KIT-1',item_name:'Inside 75 Clip Kit'}]});
})();
</script>`;

// ---------- HOW IT WORKS PAGE (/how-it-works) ----------
const howBody = `
${header('how', true)}
<main>
<section class="page-hero"><div class="in">
  <div class="eyebrow">Setup guide</div>
  <h1>From the box to your first putt in 5 minutes.</h1>
  <p class="lead">Everything you need to know about clamping the V2 clip to your club, connecting to Wi-Fi once, charging, and playing real greens at home.</p>
</div></section>

<section class="sec"><div class="in hw-row">
  <div>
    <div class="eyebrow">First time · 2 minutes</div>
    <h2>Connect to your home Wi-Fi once.</h2>
    <p>Open the free Inside 75 app on your iPad or Android tablet, tap <strong>Set up my clip</strong>, and plug the clip into USB-C power. Your tablet finds it automatically in about 20 seconds.</p>
    <p>Pick your home Wi-Fi network and enter its password once. From then on, the clip connects automatically every time you pick up your club.</p>
  </div>
  <div class="hw-pic">${pic('clip-charge', 'Inside 75 V2 clip plugged into a USB-C cable with charging LED lit')}</div>
</div></section>

<section class="sec white"><div class="in hw-row flip">
  <div>
    <div class="eyebrow">On your club · 2 minutes</div>
    <h2>Clamp onto your club and run the quick fit.</h2>
    <p>Unplug the clip and place the two halves around your steel putter or wedge shaft just above the clubhead, with the two bolts facing the target. Snug both screws evenly with the included hex key until the clip cannot twist.</p>
    <p>The app then guides you through a quick three-step fit (a shaft roll, your normal address, and squaring the face on a flat edge) so it learns your exact club. Moving a clip to a different club later takes about 20 seconds.</p>
  </div>
  <div class="hw-pic">${pic('mount-hands', 'Golfer tightening the Inside 75 V2 clip onto a chrome putter shaft with the included hex key')}</div>
</div></section>

<section class="sec"><div class="in hw-row">
  <div>
    <div class="eyebrow">Play anywhere</div>
    <h2>Set your tablet in front of you and swing.</h2>
    <p>Place your tablet across from your stance, well clear of your swing path, so you can glance straight ahead to watch each shot. Putt across your living room rug, chip real golf balls into a net, or take practice swings without a ball.</p>
    <p>Because the V2 sensor reads your clubhead speed, face angle, and swing path right through impact, the ball reacts immediately on screen whether you strike a real ball or take a practice swing.</p>
  </div>
  <figure class="hw-fig"><div class="hw-pic">${pic('lifestyle-wedge', 'Golfer chipping with a steel wedge wearing the Inside 75 V2 clip into a hitting net with an iPad resting safely across from the golfer stance')}</div><figcaption>Always set your tablet across from your stance out of the swing arc, check ceiling clearance, and use a hitting net when striking real balls with a wedge.</figcaption></figure>
</div></section>

<section class="sec white" id="troubleshoot"><div class="in">
  <div class="sec-head">
    <div class="eyebrow">Quick troubleshooting</div>
    <h2>Wi-Fi, charging, and wake checklist.</h2>
  </div>
  <dl class="spec-table" style="max-width:860px">
    <div><dt>Same Wi-Fi</dt><dd>Keep your tablet and clip on the same home Wi-Fi network (avoid guest networks). Most home routers work automatically; if yours lists separate 2.4 GHz and 5 GHz names, pick the 2.4 GHz one.</dd></div>
    <div><dt>iPad Local Network</dt><dd>On iPad, open Settings &gt; Inside 75 and confirm Local Network permission is enabled.</dd></div>
    <div><dt>Auto Sleep &amp; Wake</dt><dd>Unplugged, the clip rests after a few minutes of stillness. Pick up your club to wake it automatically. While plugged into USB-C, it stays awake.</dd></div>
    <div><dt>Firmware Updates</dt><dd>The app delivers free wireless clip updates under Settings &gt; Clip software.</dd></div>
    <div><dt>Still Stuck?</dt><dd>Email <a href="mailto:${MAIL}">${MAIL}</a> and our team in Ohio will help get you rolling.</dd></div>
  </dl>
  <p style="margin-top:28px"><a class="btn primary" href="${page('/kit')}" data-ea-cta>${EA_ON ? 'Get Early Access &#8594;' : 'Shop the Clip Kit &#8594;'}</a></p>
</div></section>
</main>
${footer}
${cartDrawer}
<script>${coreJs}</script>`;

// ---------- COMPARE PAGE (/compare) ----------
const compareBody = `
${header('compare', true)}
<main>
<section class="page-hero"><div class="in">
  <div class="eyebrow">Buyer's Guide</div>
  <h1>Inside 75 vs Launch Monitors, Swing Sticks &amp; Putting Mats.</h1>
  <p class="lead">An honest breakdown of where Inside 75 shines, where a full-swing launch monitor still wins, and how to pick the right indoor setup for your game.</p>
</div></section>

<section class="sec"><div class="in">
  <div class="cmp-wrap" style="margin-bottom:44px">
    <table class="cmp">
      <thead>
        <tr>
          <th>Criteria</th>
          <th class="hi">Inside 75 ($119 to $229)</th>
          <th>Launch Monitors ($2,000+)</th>
          <th>Weighted Swing Sticks (~$300)</th>
          <th>Putting Mats ($100 to $500)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Primary job</td><td class="hi">Short game (putts, chips, pitches 0 to 75 yd)</td><td>Full-bag driver &amp; iron bays</td><td>Casual living-room swing game</td><td>Straight indoor putting reps</td></tr>
        <tr><td>Uses your own real clubs</td><td class="hi"><span class="ok">&#10003; Your own putter &amp; wedge</span></td><td>Yes (full bag)</td><td><span class="no">No (short weighted wand)</span></td><td>Putter only</td></tr>
        <tr><td>Works without hitting balls</td><td class="hi"><span class="ok">&#10003; Real balls OR air swings</span></td><td><span class="no">No (must track ball flight)</span></td><td>Air swings only</td><td>Real balls only</td></tr>
        <tr><td>Room required</td><td class="hi"><span class="ok">Any living room, office, or garage</span></td><td>High ceiling + screen/net + hitting strip</td><td>Living room</td><td>Flat floor strip</td></tr>
        <tr><td>Sloped breaking greens</td><td class="hi"><span class="ok">&#10003; Real elevation-mapped greens</span></td><td>Yes (via paid sim software)</td><td>Basic arcade greens</td><td>Flat or manual wedges</td></tr>
        <tr><td>Ongoing subscription</td><td class="hi"><span class="ok">$0 required</span> (optional $49.99/yr Plus)</td><td>Usually $200 to $500/yr</td><td>Often $20+/yr for courses</td><td>None</td></tr>
      </tbody>
    </table>
  </div>

  <div class="verdict-grid">
    <article class="verdict-card primary">
      <div class="verdict-media">${pic('clubs-pair', 'Inside 75 V2 clips mounted on a stainless blade putter and forged sand wedge')}</div>
      <div class="verdict-body">
        <div class="verdict-kicker">Inside 75 · $119 to $229</div>
        <h3>Built for golfers who care about real feel</h3>
        <ul class="verdict-list">
          <li>${I.check}<span>Honest, lag-free short-game feedback that even scratch golfers respect, from 3-foot putts to 75-yard pitches.</span></li>
          <li>${I.check}<span>Practice with your own real putter and wedge instead of a short weighted stick.</span></li>
          <li>${I.check}<span>Play real breaking greens in any living room with instant shot response, ball or no ball.</span></li>
          <li>${I.check}<span>Pass clubs around with up to four friends on one tablet, with zero subscription required.</span></li>
        </ul>
        <div class="verdict-cta"><a class="btn light" href="${page('/kit')}">Shop Clip Kits, From $${P.one.price}</a></div>
      </div>
    </article>
    <article class="verdict-card secondary">
      <div class="verdict-body">
        <div class="verdict-kicker">Full Launch Monitor · $2,000 to $15,000+</div>
        <h3>When a full hitting bay fits better</h3>
        <p style="color:var(--ink-2);margin:10px 0 18px">Inside 75 is purpose-built for short game. A full-bay launch monitor is still the right tool if your priority is hitting drivers and long irons.</p>
        <ul class="verdict-list">
          <li>${I.check}<span>Your main goal is hitting full drivers and long irons and measuring exact ball spin axis off the face.</span></li>
          <li>${I.check}<span>You already have a 9+ foot ceiling, hitting enclosure, impact screen, and a $2,500+ hardware budget.</span></li>
          <li>${I.check}<span>You only want to hit real golf balls and do not mind annual simulator software fees.</span></li>
        </ul>
      </div>
    </article>
  </div>
</div></section>
</main>
${footer}
${cartDrawer}
<script>${coreJs}</script>`;

// ---------- CHECKOUT PAGE (/checkout) ----------
const checkoutBody = `
${header('checkout', false)}
<main>
<section class="sec" style="padding-top:42px"><div class="in">
  <p class="crumb"><a href="${page('/kit')}">&larr; Back to Clip Kit</a></p>
  <h1 style="font-size:clamp(30px,3.6vw,44px);margin-bottom:26px">Checkout</h1>

  <div id="chkGate" class="chk-card" hidden style="text-align:center;padding:48px 24px;max-width:560px;margin:0 auto">
    <div class="eyebrow" style="margin-bottom:8px">Early Access · ${esc(EA.batchLabel || 'Batch 2')}</div>
    <h2 style="margin-bottom:10px">Enter your Early Access code to order</h2>
    <p style="color:var(--ink-2);margin:0 auto 22px;max-width:34em">We ship Inside 75 in small batches from Ohio. Enter an Early Access code from a friend to unlock checkout right away, or join the waitlist for our next drop.</p>
    <form class="ea-code-form" data-ea-inline data-msg="chkGateMsg" style="justify-content:center;margin-bottom:14px">
      <label for="chkGateIn" class="sr">Early Access code</label>
      <input id="chkGateIn" type="text" placeholder="Enter code" autocomplete="off">
      <button type="submit" class="btn primary">Unlock Checkout</button>
    </form>
    <p class="msg" id="chkGateMsg" role="status" hidden></p>
    <p style="margin:18px 0 0;font-size:14.5px;color:var(--ink-2)">No code yet? <button type="button" class="btn line sm" data-ea-open="wait" style="margin-left:8px">Join the Waitlist</button></p>
  </div>

  <div id="chkEmpty" class="chk-card" hidden style="text-align:center;padding:48px 24px">
    <h2 style="margin-bottom:10px">Your cart is empty</h2>
    <p style="color:var(--ink-2);margin-bottom:22px">Add a One-Clip or Two-Clip Kit to continue to checkout.</p>
    <a class="btn primary" href="${page('/kit')}">View Clip Kits</a>
  </div>

  <div id="chkSuccess" class="chk-card chk-done" hidden>
    <div class="ok-badge">${I.check}</div>
    <h2 id="doneTitle">You're in! Order Reserved.</h2>
    <p id="doneSub" style="color:var(--ink-2);max-width:36em;margin:0 auto 14px">Thank you for your Inside 75 order. Your reservation reference is <strong class="mono" id="doneRef">I75-0000</strong>.</p>
    <p style="font-size:14.5px;color:var(--ink-2);max-width:38em;margin:0 auto 18px">We have recorded your kit selection and shipping details. We will email your confirmation and secure payment &amp; tracking link to <strong id="doneEmail"></strong> as soon as your ${esc(EA.batchLabel || 'Batch 2')} kit is ready to pack. Questions? Write <a href="mailto:${MAIL}">${MAIL}</a>.</p>
    <div class="ea-share-box" id="eaShareBox" hidden>
      <h3>Share Early Access with 5 friends</h3>
      <p>Every kit comes with 5 Early Access links so your golf buddies can skip the waitlist and order right away. These links also stay tied to your Inside 75 account.</p>
      <div id="eaShareList"></div>
    </div>
    <div class="ea-share-box" style="background:var(--navy);color:#F6F5F0;border-color:rgba(255,255,255,0.12)">
      <h3 style="color:#fff">Download the Inside 75 Tablet App</h3>
      <p style="color:rgba(246,245,240,0.82)">Grab the app on your iPad or Android tablet now and sign in with <strong id="doneAppEmail" style="color:#fff">your order email</strong> so your account and Early Access links are ready the moment your kit arrives.</p>
      <div class="store-badges" style="margin-top:12px">
        ${storeBadge('apple', cfg.appStore)}
        ${storeBadge('play', cfg.googlePlay)}
      </div>
    </div>
    <a class="btn primary" href="${page('/')}">Return to 75golf.com</a>
  </div>

  <div id="chkMain" class="chk-grid">
    <div class="chk-card">
      <h2>Contact &amp; Shipping</h2>
      <div class="chk-note" id="modeBanner">
        <strong>Batch 2 Direct Order:</strong> Reserve your Inside 75 V2 Kit today with <strong>$0 charged right now</strong>. You will receive your secure Stripe payment link by email the day your kit is packed to ship. 30-day home trial &amp; 1-year warranty included.
      </div>
      <form id="chkForm">
        <div class="field-grid">
          <div class="field full"><label for="cEmail">Email address (for order confirmation &amp; tracking)</label><input id="cEmail" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
          <div class="field"><label for="cFirst">First name</label><input id="cFirst" name="first" type="text" required autocomplete="given-name" placeholder="Alex"></div>
          <div class="field"><label for="cLast">Last name</label><input id="cLast" name="last" type="text" required autocomplete="family-name" placeholder="Morgan"></div>
          <div class="field full"><label for="cAddr">Street address</label><input id="cAddr" name="address" type="text" required autocomplete="street-address" placeholder="123 Fairway Dr"></div>
          <div class="field"><label for="cCity">City</label><input id="cCity" name="city" type="text" required autocomplete="address-level2" placeholder="Columbus"></div>
          <div class="field"><label for="cState">State</label><input id="cState" name="state" type="text" required autocomplete="address-level1" placeholder="OH" maxlength="24"></div>
          <div class="field"><label for="cZip">ZIP code</label><input id="cZip" name="zip" type="text" required autocomplete="postal-code" placeholder="43221"></div>
          <div class="field"><label for="cTablet">Which tablet will you play on?</label>
            <select id="cTablet" name="tablet">
              <option value="ipad">iPad (2019 or newer)</option>
              <option value="android">Android Tablet</option>
              <option value="both">Both / Not sure yet</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn primary" id="chkSubmit" style="width:100%;margin-top:8px">Complete Order</button>
        <p class="msg" id="chkMsg" role="status" hidden></p>
        <p style="font-size:13px;color:var(--ink-3);margin:14px 0 0;text-align:center">By ordering, you agree to our <a href="${page('/terms')}">Terms of Sale</a> and <a href="${page('/shipping-returns')}">30-Day Return Policy</a>.</p>
      </form>
    </div>

    <div class="chk-card">
      <h2>Order Summary</h2>
      <div id="chkLines"></div>
      <div class="chk-totals">
        <div><span>Subtotal</span><strong class="mono" id="oSub">$0</strong></div>
        <div><span>US Shipping</span><strong class="mono" id="oShip">FREE</strong></div>
        <div class="grand"><span>Total</span><strong class="mono" id="oTot">$0</strong></div>
      </div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line);display:grid;gap:10px;font-size:14px;color:var(--ink-2)">
        <div style="display:flex;gap:8px;align-items:center">${I.shield}<span>30-day home trial &amp; hassle-free returns</span></div>
        <div style="display:flex;gap:8px;align-items:center">${I.bolt}<span>1-year limited hardware warranty</span></div>
        <div style="display:flex;gap:8px;align-items:center">${I.tablet}<span>Free tablet app included</span></div>
      </div>
    </div>
  </div>
</div></section>
</main>
${footer}
${cartDrawer}
<script>
${coreJs}
(function(){
  var q=new URLSearchParams(location.search);
  var main=document.getElementById('chkMain'),empty=document.getElementById('chkEmpty'),done=document.getElementById('chkSuccess'),gate=document.getElementById('chkGate');
  function showShareLinks(ref,meta){
    var box=document.getElementById('eaShareBox'),list=document.getElementById('eaShareList');
    if(!box||!list||!window.i75mintPasses)return;
    window.i75mintPasses(ref,meta).then(function(codes){
      if(!codes||!codes.length)return;
      list.textContent='';
      codes.forEach(function(cd){
        var url='https://75golf.com/?invite='+cd;
        var row=document.createElement('div');row.className='ea-link-row';
        var codeEl=document.createElement('code');codeEl.textContent=url;
        var btn=document.createElement('button');btn.type='button';btn.textContent='Copy Link';
        btn.onclick=function(){
          try{navigator.clipboard.writeText(url);}catch(e){}
          btn.textContent='Copied!';btn.classList.add('copied');
          setTimeout(function(){btn.textContent='Copy Link';btn.classList.remove('copied');},1500);
        };
        row.appendChild(codeEl);row.appendChild(btn);list.appendChild(row);
      });
      box.hidden=false;
    });
  }
  if(q.get('status')==='success'){
    var refId=(q.get('session_id')||'STRIPE').slice(-10).toUpperCase();
    i75clearCart();main.hidden=true;empty.hidden=true;if(gate)gate.hidden=true;done.hidden=false;
    document.getElementById('doneTitle').textContent="You're in! Order Confirmed.";
    document.getElementById('doneRef').textContent=refId;
    showShareLinks(refId);
    return;
  }
  function updateGate(){
    var s0=i75summary();
    if(window.i75eaUnlocked&&!window.i75eaUnlocked()){
      main.hidden=true;empty.hidden=true;if(gate)gate.hidden=false;
      return false;
    }
    if(gate)gate.hidden=true;
    if(!s0.cnt){main.hidden=true;empty.hidden=false;return false;}
    main.hidden=false;empty.hidden=true;
    return true;
  }
  document.addEventListener('i75ea:change',function(){if(done.hidden)updateGate();});
  if(!updateGate())return;
  var s=i75summary();
  i75track('begin_checkout',{currency:'USD',value:s.tot});
  var L=document.getElementById('chkLines');
  s.items.forEach(function(it){
    var d=document.createElement('div');d.className='chk-line';
    var im=document.createElement('img');im.src=it.product.img;im.alt=it.product.name;
    var info=document.createElement('div');
    var b=document.createElement('b');b.textContent=it.product.name;
    var sp=document.createElement('span');sp.style.cssText='font-size:13px;color:var(--ink-2)';sp.textContent='Qty '+it.qty;
    info.appendChild(b);info.appendChild(sp);
    var pr=document.createElement('strong');pr.className='mono';pr.textContent='$'+(it.qty*it.product.price).toLocaleString('en-US');
    d.appendChild(im);d.appendChild(info);d.appendChild(pr);
    L.appendChild(d);
  });
  document.getElementById('oSub').textContent='$'+s.sub.toLocaleString('en-US');
  document.getElementById('oShip').textContent=s.ship===0?'FREE':'$'+s.ship;
  document.getElementById('oTot').textContent='$'+s.tot.toLocaleString('en-US');

  var C=window.i75cfg;
  var hasLiveStripe=!!(C.checkoutApi||(s.items.length===1&&C.stripeLinks&&C.stripeLinks[s.items[0].sku]));
  if(hasLiveStripe){
    document.getElementById('modeBanner').innerHTML='<strong>Secure Stripe Checkout:</strong> Apple Pay, Google Pay, and major cards accepted. Free US shipping on the Two-Clip Kit.';
    document.getElementById('chkSubmit').textContent='Continue to Secure Payment ($'+s.tot.toLocaleString('en-US')+')';
  }else{
    document.getElementById('chkSubmit').textContent='Reserve Batch 2 Order ($0 Due Today)';
  }

  document.getElementById('chkForm').addEventListener('submit',function(e){
    e.preventDefault();
    var btn=document.getElementById('chkSubmit'),msg=document.getElementById('chkMsg');
    var email=document.getElementById('cEmail').value.trim();
    btn.disabled=true;msg.hidden=true;

    // Path 1: Worker Stripe Checkout API
    if(C.checkoutApi){
      fetch(C.checkoutApi,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,items:s.items.map(function(i){return {sku:i.sku,qty:i.qty};})})})
        .then(function(r){return r.json();})
        .then(function(d){if(d.url){location.href=d.url;}else throw new Error(d.error||'error');})
        .catch(function(){btn.disabled=false;msg.textContent='Could not start Stripe checkout. Please try again.';msg.className='msg bad';msg.hidden=false;});
      return;
    }

    // Path 2: Direct Stripe Payment Link for single-SKU cart
    if(s.items.length===1&&C.stripeLinks&&C.stripeLinks[s.items[0].sku]){
      var link=C.stripeLinks[s.items[0].sku];
      var sep=link.indexOf('?')>=0?'&':'?';
      location.href=link+sep+'prefilled_email='+encodeURIComponent(email);
      return;
    }

    // Path 3: Direct Batch 2 Order Reservation saved to Supabase site_signups
    var skuTag='order:'+s.items.map(function(i){return i.sku+'x'+i.qty;}).join('+');
    skuTag=(skuTag+':'+document.getElementById('cState').value.trim().toUpperCase()).slice(0,64);
    var ref='I75-'+Math.random().toString(36).slice(2,7).toUpperCase();
    function finish(){
      i75track('purchase',{transaction_id:ref,currency:'USD',value:s.tot});
      i75clearCart();
      main.hidden=true;done.hidden=false;
      document.getElementById('doneRef').textContent=ref;
      document.getElementById('doneEmail').textContent=email;
      var dae=document.getElementById('doneAppEmail');if(dae&&email)dae.textContent=email;
      var kitStr=s.items.map(function(i){return i.sku+'x'+i.qty;}).join('+');
      var stStr=document.getElementById('cState')?document.getElementById('cState').value.trim().toUpperCase():'';
      showShareLinks(ref,{email:email,usedCode:window.i75eaCode?window.i75eaCode():'',kit:kitStr,state:stStr});
    }
    if(!C.signupEndpoint){finish();return;}
    fetch(C.signupEndpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:C.signupKey,Prefer:'return=minimal'},body:JSON.stringify({email:email,source:skuTag})})
      .then(function(r){if(r.ok||r.status===409)finish();else throw new Error('err');})
      .catch(function(){btn.disabled=false;msg.textContent='Could not submit right now. Please try again or email ${MAIL}.';msg.className='msg bad';msg.hidden=false;});
  });
})();
</script>`;

// ---------- LEGAL & POLICY PAGES (Google Merchant Center / Meta Ads compliant) ----------
const legalPage = (here, eyebrow, title, subtitle, contentHtml) => `
${header(here, true)}
<main>
<section class="page-hero"><div class="in">
  <div class="eyebrow">${eyebrow}</div>
  <h1>${title}</h1>
  <p class="lead">${subtitle}</p>
</div></section>
<section class="sec"><div class="in doc-body">${contentHtml}</div></section>
</main>
${footer}
${cartDrawer}
<script>${coreJs}</script>`;

const privacyHtml = `
<p><strong>Effective Date:</strong> November 26, 2026</p>
<p>This Privacy Policy explains how 75 Golf LLC ("Inside 75", "we", "us") collects, uses, and protects information when you visit <strong>75golf.com</strong> or place an order for an Inside 75 Clip Kit. The Inside 75 tablet app has its own separate in-app privacy policy.</p>
<h2>1. Information We Collect</h2>
<ul>
  <li><strong>Email &amp; Order Details:</strong> When you reserve or order a Clip Kit or join our email list, we collect the email address and shipping details you submit so we can fulfill your order or notify you about shipping batches.</li>
  <li><strong>Basic Site Analytics:</strong> 75golf.com is delivered through Cloudflare. When optional marketing pixels or analytics are active, we measure aggregate visits, ad attribution (UTM parameters), and cart events to understand which products golfers are looking for.</li>
  <li><strong>Payment Processing:</strong> When Stripe checkout is enabled, payment card numbers are processed directly by Stripe and are never stored on 75golf.com servers.</li>
</ul>
<h2>2. How We Use Information</h2>
<ul>
  <li>To process, confirm, ship, and support hardware kit orders.</li>
  <li>To send product launch, shipping batch, and new-course announcements when you opt in.</li>
  <li>To prevent fraud and maintain site reliability.</li>
</ul>
<p>We never sell your personal information or email address to third parties.</p>
<h2>3. Data Storage &amp; Deletion</h2>
<p>Website sign-ups and order reservations are stored securely with Supabase (United States). To request access to or deletion of your information at any time, email <a href="mailto:${MAIL}">${MAIL}</a> from the email address you used and we will delete it promptly.</p>
<h2>4. Contact</h2>
<p>75 Golf LLC · Ohio, United States · <a href="mailto:${MAIL}">${MAIL}</a></p>`;

const termsHtml = `
<p><strong>Effective Date:</strong> November 26, 2026</p>
<p>These Terms of Sale and Service govern your use of <strong>75golf.com</strong> and purchases of Inside 75 hardware from 75 Golf LLC ("Inside 75").</p>
<h2>1. Orders &amp; Pricing</h2>
<p>All prices are listed in U.S. dollars. The Two-Clip Kit is $229 (free US ground shipping) and the One-Clip Kit is $119 ($9 flat US shipping). Batch 2 reservations hold your place in line with $0 charged until you complete payment via your Stripe checkout link.</p>
<h2>2. Indoor Golf Safety</h2>
<p>Inside 75 is used with your own real golf clubs. You are solely responsible for ensuring adequate ceiling height, swing clearance, and safe surroundings before swinging any club indoors. Keep people, pets, fragile objects, and your tablet safely outside your swing arc. Use a proper golf hitting net if striking real golf balls with a wedge. 75 Golf LLC is not liable for property damage or personal injury resulting from indoor club swings.</p>
<h2>3. Entertainment &amp; Compatibility</h2>
<p>Inside 75 measures club motion and simulates ball flight and green roll for at-home golf play and practice. Right-handed steel-shaft putters and wedges are supported; compatible tablets are ${TABLETS_TECH}.</p>
<h2>4. Limited Hardware Warranty</h2>
<p>Every Inside 75 Clip Kit carries a 1-year limited warranty against defects in materials and workmanship under normal home golf use. Contact <a href="mailto:${MAIL}">${MAIL}</a> for replacement or repair support.</p>
<h2>5. Governing Law</h2>
<p>These terms are governed by the laws of the State of Ohio, United States.</p>`;

const shippingHtml = `
<p><strong>Effective Date:</strong> November 26, 2026</p>
<h2>US Shipping Rates &amp; Delivery</h2>
<ul>
  <li><strong>Two-Clip Kit ($229):</strong> Free US Ground Shipping (continental United States).</li>
  <li><strong>One-Clip Kit ($119):</strong> Flat $9 US Ground Shipping (free on any order of $150 or more).</li>
  <li><strong>Tracking:</strong> Every order receives tracking by email the moment it leaves Ohio.</li>
  <li><strong>International Shipping:</strong> Currently shipping within the United States only. Email <a href="mailto:${MAIL}">${MAIL}</a> to request international availability.</li>
</ul>
<h2>30-Day Home Trial &amp; Returns</h2>
<p>Try Inside 75 on your own clubs in your own living room for 30 days. If it is not a fit for your game, email <a href="mailto:${MAIL}">${MAIL}</a> within 30 days of delivery with your order number to start a return.</p>
<ul>
  <li>Return the clip(s), screws, and 2 mm hex key in good condition in the original box.</li>
  <li>Refunds are issued to your original payment method within 5 business days of receiving the return.</li>
  <li>No restocking fees.</li>
</ul>
<h2>1-Year Hardware Warranty</h2>
<p>If a clip fails due to a hardware or manufacturing defect within one year of delivery, email <a href="mailto:${MAIL}">${MAIL}</a> and we will repair or replace it at no charge.</p>`;

const lostBody = `
${header('lost', false)}
<main>
<section class="sec" style="text-align:center;padding:clamp(72px,10vw,140px) 0"><div class="in">
  <div class="eyebrow">404 · Out of Bounds</div>
  <h1 style="font-size:clamp(36px,5vw,58px);margin:14px 0 14px">That page is not on the course.</h1>
  <p class="lead" style="margin-inline:auto">Head back to the homepage or jump straight to the Clip Kit.</p>
  <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
    <a class="btn primary" href="/">Back to Home</a>
    <a class="btn line" href="/kit">Shop Clip Kits</a>
  </div>
</div></section>
</main>
${footer}
${cartDrawer}
<script>${coreJs}</script>`;

// ---------- SEO / AEO Structured Data ----------
const css = fs.readFileSync(path.join(DIR, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n');
const ld = o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

const orgLd = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: 'Inside 75',
  legalName: '75 Golf LLC',
  alternateName: ['Inside 75 Golf', '75 Golf', '75golf.com'],
  url: `${SITE}/`,
  logo: `${SITE}/assets/icon-512.png`,
  email: MAIL,
  address: { '@type': 'PostalAddress', addressRegion: 'OH', addressCountry: 'US' },
};
const siteLd = {
  '@type': 'WebSite',
  '@id': `${SITE}/#site`,
  url: `${SITE}/`,
  name: 'Inside 75',
  description: 'Play real short-game golf at home with your own putter and wedge using the Inside 75 wireless club sensor and tablet app.',
  publisher: { '@id': `${SITE}/#org` },
};
const returnPolicyLd = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 30,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/FreeReturn',
};
const shipLd = free => ({
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: free ? '0.00' : '9.00', currency: 'USD' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
});
const availUrl = `https://schema.org/${cfg.availability || 'PreOrder'}`;
const productLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  '@id': `${SITE}/kit#product`,
  name: 'Inside 75 Clip Kit (V2)',
  description: 'Wireless 1,920 Hz golf club shaft sensor that clips to your own putter or wedge and plays real putts, chips, and pitches up to 75 yards on your iPad or Android tablet.',
  image: [`${SITE}/assets/kit-two.jpg`, `${SITE}/assets/clubs-pair.jpg`, `${SITE}/assets/hero-living.jpg`, `${SITE}/assets/kit-one.jpg`],
  brand: { '@type': 'Brand', name: 'Inside 75' },
  category: 'Sporting Goods > Golf > Golf Training Aids',
  offers: [
    { '@type': 'Offer', sku: P.two.sku, name: P.two.name, price: '229.00', priceCurrency: 'USD', url: `${SITE}/kit#two`, availability: availUrl, itemCondition: 'https://schema.org/NewCondition', hasMerchantReturnPolicy: returnPolicyLd, shippingDetails: shipLd(true) },
    { '@type': 'Offer', sku: P.one.sku, name: P.one.name, price: '119.00', priceCurrency: 'USD', url: `${SITE}/kit#one`, availability: availUrl, itemCondition: 'https://schema.org/NewCondition', hasMerchantReturnPolicy: returnPolicyLd, shippingDetails: shipLd(false) },
  ],
};
const appLd = {
  '@type': 'SoftwareApplication',
  name: 'Inside 75 Golf',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'iPadOS 16.3+, Android (64-bit Vulkan 1.1 tablets)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': `${SITE}/#org` },
};
const videoLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: 'Inside 75 Gameplay: Real Short Game Chip & Putt on Contoured Greens',
  description: 'Real gameplay recorded in the Inside 75 tablet app showing chipping onto an elevation-mapped green and holing putts across real slopes.',
  thumbnailUrl: `${SITE}/assets/reel-putting.jpg`,
  contentUrl: `${SITE}/assets/reel-putting.mp4`,
  uploadDate: '2026-11-26',
};
const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QA.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};
const howToLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Set Up and Play Inside 75 at Home',
  description: 'Connect your Inside 75 V2 clip to home Wi-Fi, clamp it onto your putter or wedge shaft, and play real golf greens on your tablet in five minutes.',
  totalTime: 'PT5M',
  step: [
    { '@type': 'HowToStep', name: 'Connect to home Wi-Fi', text: 'Plug the clip into USB-C, tap Set up my clip in the Inside 75 tablet app, and enter your home Wi-Fi password once.' },
    { '@type': 'HowToStep', name: 'Clamp onto your putter or wedge', text: 'Secure the clip right above the clubhead on your steel shaft using the included hex key and complete the 2-minute in-app fit.' },
    { '@type': 'HowToStep', name: 'Make your real stroke', text: 'Putt on your rug or chip into a net with real balls or practice swings and watch your shot play out live on your tablet.' },
  ],
};
const crumbs = (name, p) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inside 75', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name, item: SITE + p },
  ],
});

function head({ title, desc, p, ogTitle, lds = [], root = false, noindex = false, lead = '', modelViewer = false }) {
  const a = root ? '/assets/' : 'assets/';
  const fonts = `@font-face{font-family:Archivo;src:url(${a}fonts/archivo.woff2) format("woff2");font-weight:500 700;font-style:normal;font-display:swap}@font-face{font-family:"Public Sans";src:url(${a}fonts/public-sans.woff2) format("woff2");font-weight:400 700;font-style:normal;font-display:swap}`;
  return `<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : `<link rel="canonical" href="${SITE}${p}">`}
<meta name="theme-color" content="#0B1A33">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Inside 75">
<meta property="og:url" content="${SITE}${p}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/assets/share.jpg?v=${ASSET_V}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Golfer putting at home with their own putter fitted with the Inside 75 V2 clip and an iPad displaying a sunlit 3D golf green">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/assets/share.jpg?v=${ASSET_V}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="96x96" href="${a}icon-96.png">
<link rel="icon" type="image/svg+xml" href="${a}icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${lead && has(lead) ? `<link rel="preload" as="image" href="${a}${lead}?v=${ASSET_V}" fetchpriority="high">\n` : ''}<link rel="preload" as="font" type="font/woff2" href="${a}fonts/archivo.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="${a}fonts/public-sans.woff2" crossorigin>
${modelViewer ? '<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>\n' : ''}<style>${fonts}${css}</style>
${analyticsSnippet()}
${lds.map(ld).join('\n')}`;
}
const doc = (h, body) => `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n${h}\n</head><body>${body}</body></html>\n`;

// ---------- build dist ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(A, path.join(OUT, 'assets'), { recursive: true });
// Remove any stale unused hero.jpg if present
if (fs.existsSync(path.join(OUT, 'assets', 'hero.jpg'))) fs.unlinkSync(path.join(OUT, 'assets', 'hero.jpg'));
for (const f of ['favicon.ico', 'apple-touch-icon.png']) {
  if (need(f)) fs.renameSync(path.join(OUT, 'assets', f), path.join(OUT, f));
}

const pages = {
  'index.html': doc(head({
    title: 'Inside 75 | Play Real Short-Game Golf at Home With Your Own Putter & Wedge',
    ogTitle: 'Play real golf at home with your own putter and wedge',
    desc: 'Clamp the sleek Inside 75 V2 wireless sensor onto your own putter and wedge. Accurate, instant short-game golf inside 75 yards on real breaking greens on your iPad or Android tablet.',
    p: '/',
    lead: has('hero-living.webp') ? 'hero-living.webp' : 'hero-living.jpg',
    modelViewer: true,
    lds: [{ '@context': 'https://schema.org', '@graph': [orgLd, siteLd, appLd] }, productLd, videoLd, faqLd],
  }), homeBody),
  'kit.html': doc(head({
    title: 'Inside 75 Clip Kit (V2) | Early Access From $119',
    desc: 'Join Early Access or enter an owner code for the Inside 75 V2 Clip Kit: One Clip ($119) or Two Clips for putter and wedge ($229, free US shipping). Includes free tablet app, 30-day home trial, and 1-year warranty.',
    p: '/kit',
    lead: 'kit-two.jpg',
    modelViewer: true,
    lds: [productLd, crumbs('Clip Kit', '/kit')],
  }), kitBody),
  'how-it-works.html': doc(head({
    title: 'How Inside 75 Works | 5-Minute Setup for At-Home Putting & Chipping',
    desc: 'Clamp the Inside 75 V2 sensor onto your steel-shaft putter or wedge, join your home Wi-Fi once, and play real breaking greens on your tablet with real balls or practice swings.',
    p: '/how-it-works',
    lds: [howToLd, crumbs('How It Works', '/how-it-works')],
  }), howBody),
  'compare.html': doc(head({
    title: 'Inside 75 vs Launch Monitors, Swing Sticks & Putting Mats',
    desc: 'Compare Inside 75 ($119 to $229) against $3,000+ launch monitors, toy swing sticks, and flat putting mats. Real clubs, real breaking greens, and no room buildout required.',
    p: '/compare',
    lds: [crumbs('Compare', '/compare'), faqLd],
  }), compareBody),
  'checkout.html': doc(head({
    title: 'Checkout | Inside 75 Clip Kit',
    desc: 'Complete your Inside 75 Clip Kit order. Free US shipping on the Two-Clip Kit, 30-day home trial, and 1-year warranty.',
    p: '/checkout',
    noindex: true,
  }), checkoutBody),
  'privacy.html': doc(head({
    title: 'Privacy Policy | Inside 75 (75golf.com)',
    desc: 'How 75 Golf LLC collects, uses, and protects your information on 75golf.com.',
    p: '/privacy',
    lds: [crumbs('Privacy Policy', '/privacy')],
  }), legalPage('privacy', 'Legal', 'Privacy Policy', 'Plain-English privacy details for 75golf.com and Inside 75 hardware orders.', privacyHtml)),
  'terms.html': doc(head({
    title: 'Terms of Sale & Service | Inside 75',
    desc: 'Terms of sale, indoor golf safety notice, compatibility, and 1-year limited warranty for Inside 75 Clip Kits.',
    p: '/terms',
    lds: [crumbs('Terms of Sale', '/terms')],
  }), legalPage('terms', 'Legal', 'Terms of Sale & Service', 'Order terms, indoor swing safety notice, and limited hardware warranty for 75 Golf LLC.', termsHtml)),
  'shipping-returns.html': doc(head({
    title: 'Shipping, 30-Day Home Trial & Returns | Inside 75',
    desc: 'Free US shipping on Two-Clip Kits, $9 flat shipping on One-Clip Kits, 30-day home trial with hassle-free returns, and 1-year hardware warranty.',
    p: '/shipping-returns',
    lds: [crumbs('Shipping & Returns', '/shipping-returns')],
  }), legalPage('shipping', 'Orders & Warranty', 'Shipping & 30-Day Returns', 'Try Inside 75 at home with your own clubs for 30 days, backed by our 1-year warranty.', shippingHtml)),
  '404.html': doc(head({
    title: 'Page Not Found | Inside 75',
    desc: 'The page you looked for is not at this address.',
    p: '/404',
    root: true,
    noindex: true,
  }), lostBody),
};

for (const [name, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(OUT, name), html);
}

// ---------- SEO & AEO discovery files ----------
const today = '2026-11-26';
const indexable = ['/', '/kit', '/how-it-works', '/compare', '/shipping-returns', '/privacy', '/terms'];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);

const robots = `User-agent: *\nAllow: /\nDisallow: /checkout\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
fs.writeFileSync(path.join(OUT, 'robots.txt'), robots);

const llmsTxt = `# Inside 75 (75golf.com)

> Inside 75 is an at-home short-game golf system by 75 Golf LLC (Ohio, USA). A compact wireless sensor clips onto a golfer's own right-handed steel-shaft putter or wedge, measures club motion at 1,920 Hz, and plays every putt, chip, and pitch (up to 75 yards) live on an iPad or Android tablet across real greens mapped from USGS 3DEP LiDAR elevation data.

## Key Facts
- Company: 75 Golf LLC (Ohio, USA), contact hello@75golf.com
- Website: ${SITE}
- Hardware: Inside 75 V2 wireless shaft sensor (1,920 Hz IMU, 2.4 GHz Wi-Fi, Bluetooth for initial setup only, USB-C rechargeable, automatic sleep/wake with no power button, free OTA firmware updates)
- Pricing:
  - Two-Clip Full Short-Game Kit: $229 USD (free US ground shipping) - one clip for putter + one for wedge, zero swapping during full 18-hole Short Game rounds
  - One-Clip Starter Kit: $119 USD ($9 flat US shipping) - plays Putting, Closest to the Pin, and Practice; swaps between clubs in ~20 seconds
- App Pricing: Free iPad & Android tablet app included with every kit (1 full 18-hole course + all 4 game modes: Short Game, Putting, Closest to the Pin, Practice; 1 to 4 players; Soft/Standard/Tour green speeds). Optional Inside 75 Plus subscription ($49.99/yr) unlocks all courses and swing history.
- Ball Requirement: Reads your club, not the ball. Works with real golf balls on carpet or into a net, or with dry swings (no ball at all).
- Requirements: Right-handed steel-shaft putter or wedge, iPad with A12 chip or newer (iPadOS 16.3+) or recent 64-bit Android tablet (Vulkan 1.1), main 2.4 GHz home Wi-Fi, standard USB-C cable (not included). Phones and left-handed clubs are not supported yet.
- Guarantee: 30-day home trial and returns, 1-year limited hardware warranty.

## Primary Pages
- Home: ${SITE}/
- Shop Clip Kits: ${SITE}/kit
- How It Works & Setup: ${SITE}/how-it-works
- Inside 75 vs Launch Monitors, Swing Sticks & Putting Mats: ${SITE}/compare
- Shipping & 30-Day Returns: ${SITE}/shipping-returns
- Privacy Policy: ${SITE}/privacy
- Terms of Sale: ${SITE}/terms
`;
fs.writeFileSync(path.join(OUT, 'llms.txt'), llmsTxt);

// ---------- QA checks ----------
const probs = [...missing.map(m => `missing asset: ${m}`), ...linkProblems(OUT), ...pageProblems(OUT)];
if (probs.length) {
  console.error('Build check problems:\n - ' + probs.join('\n - '));
  if (strict) process.exit(1);
}
console.log(`Built ${Object.keys(pages).length} HTML pages + sitemap.xml + robots.txt + llms.txt into ${OUT} (${probs.length} issues)`);
