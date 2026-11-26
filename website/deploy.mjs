// Deploys 75golf.com (Cloudflare Worker "inside75" + static assets in one/dist)
// using a scoped personal Cloudflare API token without touching the global GridFront wrangler login.
// Reads CLOUDFLARE_API_TOKEN (and optional CLOUDFLARE_ACCOUNT_ID) from env or .env.cloudflare.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.join(DIR, '.env.cloudflare'),
  path.join(DIR, '..', '.env.cloudflare'),
  path.join(process.env.USERPROFILE || '', '.inside75-cloudflare.env'),
];

const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
for (const f of candidates) {
  if (!f || !fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

if (!env.CLOUDFLARE_API_TOKEN) {
  console.error(
    'Missing CLOUDFLARE_API_TOKEN.\n' +
    'Create a scoped "Edit Cloudflare Workers" token in your personal Cloudflare account at:\n' +
    '  https://dash.cloudflare.com/profile/api-tokens\n' +
    'Save it to C:\\Users\\helve\\.inside75-cloudflare.env as:\n' +
    '  CLOUDFLARE_API_TOKEN=your_token_here\n' +
    '  CLOUDFLARE_ACCOUNT_ID=your_account_id_here\n' +
    'Then re-run: npm run deploy'
  );
  process.exit(1);
}

const cmd = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args = process.platform === 'win32'
  ? ['/c', 'npx', '--yes', 'wrangler@latest', 'deploy']
  : ['--yes', 'wrangler@latest', 'deploy'];

const r = spawnSync(cmd, args, { cwd: DIR, env, stdio: 'inherit' });
process.exit(r.status ?? 1);
