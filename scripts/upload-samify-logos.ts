/**
 * Engångsskript: ladda upp Samifys svart/vit-loggor till Supabase storage
 * (bucket "Logotyper") och skriv ut publika signed URLs som branding.ts
 * kan peka på.
 *
 * Kör:
 *   npx tsx scripts/upload-samify-logos.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = 'Logotyper';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FILES = [
  { local: 'C:/Users/rasmu/Desktop/SAmify1.png', remote: 'samify/samify-black.png', label: 'svart' },
  { local: 'C:/Users/rasmu/Desktop/SAmify2.png', remote: 'samify/samify-white.png', label: 'vit' },
];

async function main() {
  for (const f of FILES) {
    const buffer = readFileSync(f.local);
    console.log(`Laddar upp ${f.label} (${buffer.length} bytes) → ${BUCKET}/${f.remote}`);
    const { error: upErr } = await sb.storage.from(BUCKET).upload(f.remote, buffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (upErr) {
      console.error(`  FEL: ${upErr.message}`);
      continue;
    }

    // Skapa signed URL med extremt lång giltighet (samma mönster som
    // El-kretsen-loggan använder)
    const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(f.remote, TEN_YEARS);
    if (signErr) {
      console.error(`  Kunde inte skapa signed URL: ${signErr.message}`);
      continue;
    }
    console.log(`  ✓ ${signed.signedUrl}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
