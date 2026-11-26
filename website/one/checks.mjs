// Automated quality, SEO, AEO, link, and brand checks run by build.mjs (--strict fails on any problem).
import fs from 'node:fs';
import path from 'node:path';

export function linkProblems(out) {
  const files = fs.readdirSync(out).filter(f => f.endsWith('.html'));
  const html = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(out, f), 'utf8')]));
  const ids = Object.fromEntries(files.map(f => [f, new Set([...html[f].matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))]));
  const scripted = new Set(['one', 'two']);
  const bad = [];
  for (const f of files) {
    for (const m of html[f].matchAll(/\s(?:href|src|poster|srcset)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|data:|tel:)/.test(u)) continue;
      const [p, hash] = u.split('#');
      let file = f;
      if (p) {
        const clean = p.replace(/^\.\//, '').replace(/^\//, '') || 'index.html';
        const direct = path.join(out, clean);
        if (fs.existsSync(direct) && !fs.statSync(direct).isDirectory()) file = clean;
        else if (fs.existsSync(`${direct}.html`)) file = `${clean}.html`;
        else { bad.push(`${f}: missing local target ${u}`); continue; }
      }
      if (hash && file.endsWith('.html') && !ids[file].has(hash) && !scripted.has(hash)) {
        bad.push(`${f}: missing anchor ${u}`);
      }
    }
  }
  return bad;
}

export function pageProblems(out) {
  const bad = [];
  const textFiles = fs.readdirSync(out).filter(x => /\.(html|xml|txt)$/.test(x));
  for (const f of textFiles) {
    const raw = fs.readFileSync(path.join(out, f), 'utf8');
    if (/[\u2013\u2014]/.test(raw)) bad.push(`${f}: contains em dash or en dash`);
    if (/\b(gridfront|ninebox|lorem ipsum|draft for review)\b/i.test(raw)) bad.push(`${f}: contains banned internal or draft term`);
    if (/\u00b1\s*\d/.test(raw)) bad.push(`${f}: contains unverified plus/minus accuracy figure`);
    if (!f.endsWith('.html')) continue;
    for (const m of raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch { bad.push(`${f}: invalid JSON-LD structured data`); }
    }
    const h1 = (raw.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) bad.push(`${f}: expected 1 h1, found ${h1}`);
    if (!/<title>[^<]{12,}<\/title>/.test(raw)) bad.push(`${f}: missing or short title`);
    if (!/<meta name="description" content="[^"]{30,}"/.test(raw)) bad.push(`${f}: missing or short meta description`);
    for (const m of raw.matchAll(/<img\b[^>]*>/g)) {
      if (!/\salt="/.test(m[0])) bad.push(`${f}: image missing alt attribute`);
    }
  }
  return bad;
}
