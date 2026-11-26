// One-page 75golf.com. Run: node one/build.mjs  ->  one/dist/
// Media comes only from one/assets (real files from Tyler). Missing media is listed and fails the build with --strict.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(DIR, 'assets');
const OUT = path.join(DIR, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const strict = process.argv.includes('--strict');
const missing = [];
const has = f => fs.existsSync(path.join(A, f));
const need = f => { if (!has(f)) missing.push(f); return has(f); };

// Logo: real source as SVG, flattened to one solid colour (currentColor). Falls back to the wordmark alone.
function logo() {
  if (!has('logo.svg')) { missing.push('logo.svg'); return ''; }
  let s = fs.readFileSync(path.join(A, 'logo.svg'), 'utf8');
  s = s.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(linearGradient|radialGradient|filter|mask)[\s\S]*?<\/\1>/g, '')
    .replace(/\s(fill|stroke)="(?!none)[^"]*"/g, ' $1="currentColor"')
    .replace(/(fill|stroke):\s*(?!none)[^;"]+/g, '$1:currentColor')
    .replace(/\s(opacity|fill-opacity|stroke-opacity|filter|mask)="[^"]*"/g, '')
    .replace(/<svg /, '<svg class="mark" aria-hidden="true" ');
  return s;
}

const vid = (f, poster, cls = '', loop = true) => need(f)
  ? `<video class="${cls}" src="assets/${f}"${has(poster) ? ` poster="assets/${poster}"` : ''} autoplay muted${loop ? ' loop' : ''} playsinline webkit-playsinline disablepictureinpicture disableremoteplayback x-webkit-airplay="deny" preload="auto" tabindex="-1" aria-hidden="true"></video>`
  : `<div class="${cls} hole" aria-hidden="true"></div>`;
const img = (f, alt, cls = '') => need(f) ? `<img class="${cls}" src="assets/${f}" alt="${alt}" loading="lazy">` : `<div class="${cls} hole" aria-hidden="true"></div>`;
const buy = (url, label) => url ? `<a class="btn" href="${url}">${label}</a>` : `<a class="btn" href="#notify">${label}</a>`;
const store = (url, name) => url ? `<a class="storeb" href="${url}">${name}</a>` : `<span class="storeb soon">${name}<em>Soon</em></span>`;

const heroStill = () => need('hero.jpg') ? `<picture>${has('hero-tall.jpg') ? '<source media="(max-width: 640px)" srcset="assets/hero-tall.jpg">' : ''}<img class="reel still" src="assets/hero.jpg" alt="The Inside 75 clip on a wedge shaft" fetchpriority="high"></picture>` : '<div class="reel hole" aria-hidden="true"></div>';
// Mode clips show only when all three real clips are present; otherwise the modes read as a clean list, never empty boxes.
// Mode clips show only when all three real clips are present; until then the modes read as a list beside the yardage plate.
const MODES = [['approach', 'Approach', 'Wedges from 30 to 75 yards.'], ['chip', 'Chip', 'Just off the green.'], ['putt', 'Putt', 'Real break, three speeds.']];
function modeClips() {
  const all = MODES.every(([k]) => has(`${k}.mp4`));
  if (!all) { missing.push('approach.mp4, chip.mp4, putt.mp4 (optional mode clips)'); return ''; }
  return `<div class="modeclips">${MODES.map(([k, n, t]) => `<figure>${vid(`${k}.mp4`, `${k}.jpg`, 'm')}<figcaption><b>${n}</b>${t}</figcaption></figure>`).join('')}</div>`;
}
const plate = fs.readFileSync(path.join(DIR, 'plate.svg'), 'utf8');
const ic = d => `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#14295A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  club: ic('<path d="M7 2v11.5l-3 3.5h8"/><rect x="8.5" y="5" width="5" height="4.5" rx="1"/>'),
  wifi: ic('<path d="M3 8a10 10 0 0 1 14 0M6 11a6 6 0 0 1 8 0M9 14a2 2 0 0 1 2 0"/>'),
  bolt: ic('<path d="M11 2 5 11h5l-1 7 6-9h-5z"/>'),
  app: ic('<rect x="5" y="2" width="10" height="16" rx="2"/><path d="M9 15h2"/>'),
  box: ic('<path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z M3 6.5l7 3.5 7-3.5M10 10v7"/>'),
};
// Products. Prices live here only.
const P = {
  two: { name: 'Clip Kit, two pack', short: 'Two pack', price: 229, was: 238, img: 'kit-two-tile.jpg', alt: 'Two Inside 75 clips in their tray', sub: 'One for your putter, one for your wedge.', opt: 'Putter and wedge', note: 'Approach, chip and putt', box: 'Two Inside 75 clips, with the small screws and the key to fit each one.' },
  one: { name: 'Clip Kit, single', short: 'Single clip', price: 119, img: 'kit-one-tile.jpg', alt: 'One Inside 75 clip in its tray', sub: 'One clip you can move between clubs.', opt: 'Move it between clubs', note: 'Putter or wedge', box: 'One Inside 75 clip, with the small screws and the key to fit it.' },
};
const card = (k, h) => { const p = P[k]; return `<article class="card">
      <a class="ph" href="${h}kit.html#${k}">${p.was ? `<span class="tag">Save $${p.was - p.price}</span>` : ''}${img(p.img, p.alt)}</a>
      <div class="bd">
        <h3>${p.name}</h3><p class="sub">${p.sub}</p>
        <div class="row"><span class="pr">$${p.price}${p.was ? `<s>$${p.was}</s>` : ''}</span><span class="note">${p.note}</span></div>
        <div class="acts"><button type="button" class="btn add" data-add="${k}">Add to cart</button><a class="btn line" href="${h}kit.html#${k}">Details</a></div>
      </div>
    </article>`; };
const drawer = `<div class="scrim" data-cart-close hidden></div>
<aside class="drawer" id="drawer" hidden aria-label="Cart">
  <header><h3>Your cart</h3><button type="button" class="x" data-cart-close aria-label="Close cart">&times;</button></header>
  <div class="lines" id="lines"></div>
  <div class="tot">
    <div class="sum"><span>Subtotal</span><b id="csub">$0</b></div>
    <a class="btn" id="checkout" href="${cfg.checkout || '#'}">Check out</a>
    <div class="wait" id="cwait" hidden><p>Kits aren't on sale yet. Leave your email and we'll write the day they are. Your cart stays here.</p>
      <form id="cf" class="form"><label for="cemail" class="sr">Email</label><input id="cemail" name="email" type="email" required autocomplete="email" placeholder="you@example.com"><button type="submit" class="btn">Notify me</button></form>
      <p id="cok" class="ok" role="status" hidden></p></div>
  </div>
</aside>`;
// Cart: kept in this browser only, so a cart started on the home page is still there on the kit page.
const cartJs = `(function(){
var P=${JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, p]) => [k, { n: p.name, d: p.opt, p: p.price, img: 'assets/' + p.img }])))},CO=${JSON.stringify(cfg.checkout || '')};
var cart={};try{cart=JSON.parse(localStorage.getItem('i75cart')||'{}')||{};}catch(e){cart={};}
function save(){try{localStorage.setItem('i75cart',JSON.stringify(cart));}catch(e){}}
function $(i){return document.getElementById(i);}
function fmt(n){return '$'+n.toLocaleString('en-US');}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
function render(){var L=$('lines'),t=0,c=0;L.textContent='';Object.keys(cart).forEach(function(k){var n=cart[k];if(!P[k]||!n)return;t+=n*P[k].p;c+=n;var r=el('div','line'),im=el('img');im.src=P[k].img;im.alt='';var m=el('div'),s=el('span',null,P[k].d+', qty '+n),x=el('button',null,'Remove');x.type='button';x.onclick=function(){delete cart[k];save();render();};s.appendChild(x);m.appendChild(el('b',null,P[k].n));m.appendChild(s);r.appendChild(im);r.appendChild(m);r.appendChild(el('em',null,fmt(n*P[k].p)));L.appendChild(r);});
 if(!c)L.appendChild(el('p','empty','Your cart is empty.'));$('csub').textContent=fmt(t);[].forEach.call(document.querySelectorAll('[data-cart-count]'),function(i){i.textContent=c;});$('checkout').hidden=!c;}
function open(o){$('drawer').hidden=!o;[].forEach.call(document.querySelectorAll('.scrim'),function(s){s.hidden=!o;});if(o)$('drawer').querySelector('.x').focus();}
window.i75add=function(k,n,btn){if(!P[k])return;cart[k]=Math.min(9,(cart[k]||0)+n);save();render();if(btn){var t=btn.textContent;btn.classList.add('done');btn.textContent='Added';setTimeout(function(){btn.classList.remove('done');btn.textContent=t;},1200);}open(true);};
[].forEach.call(document.querySelectorAll('[data-add]'),function(b){b.addEventListener('click',function(){i75add(b.getAttribute('data-add'),1,b);});});
[].forEach.call(document.querySelectorAll('[data-cart-open]'),function(b){b.addEventListener('click',function(){open(true);});});
[].forEach.call(document.querySelectorAll('[data-cart-close]'),function(b){b.addEventListener('click',function(){open(false);});});
document.addEventListener('keydown',function(e){if(e.key==='Escape')open(false);});
$('checkout').addEventListener('click',function(e){if(!CO){e.preventDefault();$('cwait').hidden=false;$('cemail').focus();}});
render();})();`;
const privPath = path.join(DIR, '..', 'content/legal/privacy.md');
const mdRaw = fs.existsSync(privPath) ? fs.readFileSync(privPath, 'utf8') : 'Draft for review';
const privacyReady = !/Draft for review|\[to be|\[To /i.test(mdRaw); // a draft privacy page is never published
const mark = logo();
const brand = `<span class="brand">${mark}<span class="word">Inside 75</span></span>`;
const bar = page => {
  const h = page === 'home' ? '' : './';
  return `<header class="bar${page === 'home' ? '' : ' solid'}"><div class="in">
  <a href="${page === 'home' ? '#top' : './'}" aria-label="Inside 75, home">${brand}</a>
  <nav><a href="${h}#play">Play</a><a href="${h}#shop">Shop</a><a href="${h}#app">App</a><button type="button" class="btn cartbtn" data-cart-open aria-label="Open cart">Cart <i data-cart-count>0</i></button></nav>
</div></header>`;
};
const signupJs = (formId, okId, source) => `(function(){var f=document.getElementById('${formId}'),ok=document.getElementById('${okId}');if(!f)return;var E=${JSON.stringify(cfg.signupEndpoint)},K=${JSON.stringify(cfg.signupKey)};
f.addEventListener('submit',function(e){e.preventDefault();var v=f.email.value.trim();if(!v)return;
 var done=function(m){ok.textContent=m;ok.hidden=false;f.hidden=true;};
 if(!E){done('Thanks. You are on the list.');return;}
 fetch(E,{method:'POST',headers:{'Content-Type':'application/json',apikey:K,Prefer:'return=minimal'},body:JSON.stringify({email:v,source:'${source}'})})
  .then(function(r){done(r.ok||r.status===409?'Thanks. You are on the list.':'That did not go through. Please try again.');if(!r.ok&&r.status!==409){f.hidden=false;}})
  .catch(function(){ok.textContent='That did not go through. Please try again.';ok.hidden=false;});});})();`;

const foot = `<footer class="foot"><div class="in">
  ${brand}
  <p>Questions? Write to hello@75golf.com.</p>
  <p class="small">&copy; 2026 75 Golf LLC, Ohio.${privacyReady ? ' <a href="privacy.html">Privacy</a>' : ''}</p>
</div></footer>`;
const body = `
${bar('home')}

<section class="hero" id="top">
  <div class="media">${has('hero.mp4') ? vid('hero.mp4', 'hero-poster.jpg', 'reel', false) : heroStill()}</div>
  <div class="shade"></div>
  <div class="copy"><div class="in">
    <div class="eyebrow">Inside 75 yards</div>
    <h1>The short game, <span>at home.</span></h1>
    <p class="sub">Clip Inside 75 to the putter or wedge you already own and play real greens, with real break, on your tablet after the kids are down.</p>
    <div class="ctas"><a class="btn light" href="#shop">Shop the kit, from $119</a><a class="btn ghost" href="#play">How it plays</a></div>
    <div class="yard"><span><b>75<i> yd</i></b>approach</span><span><b>CHIP</b>just off the green</span><span><b>40<i> ft</i></b>putt</span></div>
  </div></div>
</section>

<section class="zone" id="play"><div class="in">
  <div class="zone-in">
  <div>
    <div class="eyebrow">The scoring zone</div>
    <h2>Where rounds are won, in your living room.</h2>
    <p class="lead">Your real club, your real stroke, a real green on the screen. Every shot from 75 yards in, in minutes, not rounds.</p>
    <dl class="modes">
      <div><dt>Approach</dt><dd>Hit wedges onto the green from <span class="mono">30 to 75 yd</span>.</dd></div>
      <div><dt>Chip</dt><dd>Chip from just off the green to the nearest hole.</dd></div>
      <div><dt>Putt</dt><dd>Read the break and putt from <span class="mono">3 to 40 ft</span> on three green speeds.</dd></div>
    </dl>
    <p class="note">Play a full 18 alone or with up to four players, or work on one shot on the practice range.</p>
  </div>
  <figure class="plate">${plate}<figcaption class="cap"><span>Hole 1, the practice green</span><span>Yards to the pin</span></figcaption></figure>
  </div>
  ${modeClips()}
</div></section>

<section class="store" id="shop"><div class="in">
  <div class="shead">
    <div><div class="eyebrow">Shop</div><h2>Your own putter and wedge, inside 75 yards.</h2></div>
    <p>No yearly fee to play. Every kit comes with the free app.</p>
  </div>
  <div class="cards">
    ${card('two', '')}
    ${card('one', '')}
    <article class="card plus">
      <div class="ph"><span class="tag g">Optional</span><img src="assets/icon.svg" alt=""></div>
      <div class="bd">
        <h3>Inside 75 Plus</h3><p class="sub">The free app has one full course and every mode. Plus opens every course and keeps your swing history.</p>
        <div class="row"><span class="pr">$49.99</span><span class="note">per year</span></div>
        <div class="acts"><a class="btn line" href="#app">Add it in the app</a></div>
      </div>
    </article>
  </div>
  <div class="perks">
    <div>${I.club}<span><b>Fits your club</b>Screws and key in the box</span></div>
    <div>${I.wifi}<span><b>Connects on its own</b>Wi-Fi to your tablet</span></div>
    <div>${I.bolt}<span><b>USB-C charging</b>A light shows when it charges</span></div>
    <div>${I.app}<span><b>Free updates</b>New clip software over the air</span></div>
  </div>
</div></section>

<section class="app" id="app"><div class="in app-in">
  <div>
    <div class="eyebrow">The app</div>
    <h2>Free to play. No yearly fee.</h2>
    <p>Inside 75 plays on iPad (A12 chip or newer, iPadOS 16.3 or later) and Android tablets. iPhone and left-handed play are coming.</p>
    <div class="stores">${store(cfg.appStore, 'App Store')}${store(cfg.googlePlay, 'Google Play')}</div>
  </div>
  <div class="tiers">
    <div><b>Free with every kit</b><em>$0</em><span>One full 18-hole course and every game mode.</span></div>
    <div><b>Plus</b><em>$49.99 / yr</em><span>Every course, and your swing history kept over time.</span></div>
  </div>
</div></section>

<section class="notify" id="notify"><div class="in notify-in">
  <div><div class="eyebrow">Be first in line</div><h2>Get word the day kits ship.</h2><p>Leave your email and we'll write when kits ship and the app is in the stores. Nothing else.</p></div>
  <div><form id="f" class="form"><label for="email" class="sr">Email</label><input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"><button type="submit" class="btn">Notify me</button></form>
  <p id="ok" class="ok" role="status" hidden></p></div>
</div></section>

<section class="faq"><div class="in">
  <h2>Questions</h2>
  <details><summary>Do I need a special club?</summary><p>No. The clip goes on the club you already use, putter or wedge.</p></details>
  <details><summary>Do the greens break?</summary><p>Yes. Every green has real break to read, on three green speeds.</p></details>
  <details><summary>What do I play on?</summary><p>An iPad or an Android tablet. The game shows each shot on screen as you hit it.</p></details>
  <details><summary>Is there a subscription?</summary><p>No. Every kit plays one full course and every mode for free. Plus is optional, at $49.99 a year.</p></details>
  <details><summary>Do clip updates cost anything?</summary><p>No. Updates to the clip are free and install on their own.</p></details>
</div></section>

${foot}
${drawer}
<script>
${signupJs('f','ok','75golf.com')}
${signupJs('cf','cok','75golf.com/cart')}
${cartJs}
(function(){
var vs=[].slice.call(document.querySelectorAll('video'));
function still(v){if(v._still||!v.poster)return;var i=document.createElement('img');i.src=v.poster;i.alt='';i.className=v.className+' still';i.setAttribute('aria-hidden','true');v.parentNode.insertBefore(i,v);v.style.visibility='hidden';v._still=i;}
function live(v){if(v._still){v._still.remove();v._still=null;}v.style.visibility='';}
function blob(v){if(v._blob||!window.fetch||!window.URL)return;v._blob=1;fetch(v.currentSrc||v.src).then(function(r){return r.blob();}).then(function(b){v.src=URL.createObjectURL(new Blob([b],{type:'video/mp4'}));v.load();go(v);}).catch(function(){});}
function go(v){if(v._done)return;v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute('muted','');v.removeAttribute('controls');
 var p;try{p=v.play();}catch(e){return;}
 if(p&&p.then)p.then(function(){live(v);},function(e){
  if(e&&e.name==='NotAllowedError'){still(v);}
  else if(e&&e.name!=='AbortError'){blob(v);}
 });}
vs.forEach(function(v){
 ['loadedmetadata','loadeddata','canplay'].forEach(function(e){v.addEventListener(e,function(){if(v.paused)go(v);});});
 v.addEventListener('playing',function(){live(v);});
 v.addEventListener('ended',function(){v._done=1;live(v);});
 v.addEventListener('error',function(){blob(v);});
 go(v);
 setTimeout(function(){if(v.paused&&v.readyState<2)blob(v);},2500);
});
function kick(){vs.forEach(function(v){if(v.paused)go(v);});}
['touchstart','touchend','click','pointerdown','scroll','keydown'].forEach(function(e){window.addEventListener(e,kick,{passive:true});});
document.addEventListener('visibilitychange',function(){if(!document.hidden)kick();});
})();
</script>`;

const thumbs = [['kit-two-tile.jpg', 'Two clips in the tray'], ['product.jpg', 'The clip on a club shaft'], ['closeup.jpg', 'The clip close up'], ['hero.jpg', 'The clip on a wedge'], ['kit-one-tile.jpg', 'Single clip in its tray']].filter(([f]) => has(f));
const kitBody = `
${bar('kit')}
<main class="pdp"><div class="in pdp-in">
  <div class="gal">
    <div class="thumbs" role="group" aria-label="Product photos">${thumbs.map(([f, a], i) => `<button type="button" aria-pressed="${i === 0}" data-img="assets/${f}" aria-label="${a}"><img src="assets/${f}" alt=""></button>`).join('')}</div>
    <figure class="gmain"><img id="gimg" src="assets/kit-two-tile.jpg" alt="The Inside 75 Clip Kit" fetchpriority="high"></figure>
  </div>
  <div class="buy">
    <p class="crumb"><a href="./#shop">Shop</a> / Clip Kit</p>
    <h1>Inside 75 Clip Kit</h1>
    <p class="blurb">Clip it to the putter or wedge you already own and play real greens with real break on your tablet, in minutes, not rounds.</p>
    <p class="bigp"><span id="bp">$229</span><small id="bsave">You save $9</small></p>
    <fieldset class="opts"><legend>Choose your kit</legend>
      ${Object.entries(P).map(([k, p]) => `<label class="opt"><input type="radio" name="v" value="${k}"${k === 'two' ? ' checked' : ''}><span><b>${p.short}</b><span>${p.opt}</span></span><em>$${p.price}</em></label>`).join('\n      ')}
    </fieldset>
    <div class="qrow">
      <div class="qty"><button type="button" id="qm" aria-label="One fewer">&minus;</button><output id="qv">1</output><button type="button" id="qp" aria-label="One more">+</button></div>
      <button type="button" class="btn" id="padd">Add to cart, $229</button>
    </div>
    <div class="assure">
      <div>${I.app}<span>Free app with one full course and every mode. No yearly fee to play.</span></div>
      <div>${I.box}<span id="kbox">${P.two.box}</span></div>
    </div>
    <details open><summary>Plays on</summary><p>iPad with an A12 chip or newer on iPadOS 16.3 or later, and Android tablets. iPhone and left-handed play are coming.</p></details>
    <details><summary>How it fits</summary><p>The clip rides low on the shaft. Two small screws and the key are in the box, and no special putter is needed.</p></details>
    <details><summary>Connects and charges</summary><p>Wi-Fi to your tablet. Set it up once and it connects on its own. USB-C charging, with a light that shows when it's charging, and free updates over the air.</p></details>
  </div>
</div></main>

<section class="about"><div class="in about-in">
  <div>
    <div class="eyebrow">About the kit</div>
    <h2>Your club becomes the controller.</h2>
    <p class="lead">The clip rides low on the shaft and reads every stroke, and your tablet shows the ball rolling across real greens with real break.</p>
    <p class="lead">Putt from 3 to 40 feet on three green speeds, chip from just off the green, and hit approaches from 30 to 75 yards. Play a full 18 alone or with up to four players, or work on one shot on the practice range.</p>
  </div>
  <dl class="spec">
    <div><dt>In the box</dt><dd id="kbox2">${P.two.box}</dd></div>
    <div><dt>Fits</dt><dd>The putter or wedge you already use. No special club needed.</dd></div>
    <div><dt>Plays on</dt><dd>iPad with an A12 chip or newer on iPadOS 16.3 or later, and Android tablets. iPhone and left-handed play are coming.</dd></div>
    <div><dt>Connects</dt><dd>Wi-Fi to your tablet. Set it up once and it connects on its own.</dd></div>
    <div><dt>Charging</dt><dd>USB-C, with a light that shows when it's charging.</dd></div>
    <div><dt>Plans</dt><dd>Free with every kit: one full course and every mode. Plus, $49.99 a year: every course and your swing history over time.</dd></div>
  </dl>
</div></section>

${foot}
${drawer}
<script>
${signupJs('cf', 'cok', '75golf.com/kit')}
${cartJs}
(function(){var P=${JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, p]) => [k, { p: p.price, was: p.was || 0, img: 'assets/' + p.img, box: p.box }])))};
var q=1,cur='two';function $(i){return document.getElementById(i);}function fmt(n){return '$'+n.toLocaleString('en-US');}
var th=[].slice.call(document.querySelectorAll('.thumbs button'));
function show(src){$('gimg').src=src;th.forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-img')===src?'true':'false');});}
th.forEach(function(b){b.addEventListener('click',function(){show(b.getAttribute('data-img'));});});
function sync(){var v=P[cur];$('bp').textContent=fmt(v.p*q);$('bsave').hidden=!v.was;if(v.was)$('bsave').textContent='You save '+fmt((v.was-v.p)*q);$('padd').textContent='Add to cart, '+fmt(v.p*q);$('qv').textContent=q;$('kbox').textContent=v.box;$('kbox2').textContent=v.box;}
function pick(k){if(!P[k])return;cur=k;var r=document.querySelector('input[name=v][value='+k+']');if(r)r.checked=true;show(P[k].img);sync();try{history.replaceState(null,'','#'+k);}catch(e){}}
[].forEach.call(document.querySelectorAll('input[name=v]'),function(r){r.addEventListener('change',function(){pick(r.value);});});
$('qm').onclick=function(){if(q>1){q--;sync();}};$('qp').onclick=function(){if(q<9){q++;sync();}};
$('padd').onclick=function(){i75add(cur,q,$('padd'));};
var h=(location.hash||'').slice(1);pick(h==='one'?'one':'two');
})();
</script>`;

const css = fs.readFileSync(path.join(DIR, 'style.css'), 'utf8');
const head = `<title>Inside 75, the short game at home with your own putter and wedge</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Your own putter and wedge, inside 75 yards. Clip Inside 75 to your club and play real greens with real break on your tablet. No yearly fee to play. From $119.">
<meta name="theme-color" content="#0B1A33">\n<link rel="icon" type="image/svg+xml" href="assets/icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>${css}</style>`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(A)) fs.cpSync(A, path.join(OUT, 'assets'), { recursive: true });
const full = h => `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n${head}\n</head><body>${h}</body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), full(body));
fs.writeFileSync(path.join(OUT, 'preview.html'), `${head}\n${body}`); // for the private Artifact preview (no doctype)
const kitHead = head.replace(/<title>[^<]*<\/title>/, '<title>Inside 75 Clip Kit</title>').replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content="The Inside 75 Clip Kit for your own putter and wedge. Two pack $229, single clip $119. Free app, no yearly fee to play."');
fs.writeFileSync(path.join(OUT, 'kit.html'), `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n${kitHead}\n</head><body class="kitpage">${kitBody}</body></html>`);

// privacy page from the draft
const md = mdRaw.replace(/^---[\s\S]*?---\n/, '');
if (privacyReady) fs.writeFileSync(path.join(OUT, 'privacy.html'), full(`<header class="bar solid"><div class="in"><a href="index.html">${brand}</a></div></header><main class="doc"><div class="in">${marked.parse(md)}</div></main>`));

const text = ['index.html', 'kit.html'].map(f => fs.readFileSync(path.join(OUT, f), 'utf8')).join(' ').replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>|<[^>]+>/g, ' ');
const bad = [];
if (/[–—]/.test(text)) bad.push('dash');
if (/simulator|gridfront/i.test(text)) bad.push('banned word');
console.log('built', OUT, missing.length ? `\nMISSING MEDIA: ${missing.join(', ')}` : '\nall media present', bad.length ? `\nTEXT PROBLEMS: ${bad}` : '');
if (strict && (missing.length || bad.length)) process.exit(1);
