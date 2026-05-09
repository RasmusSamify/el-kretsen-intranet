import { reconstructSource, splitHierarchical } from './hierarchical-chunker';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const filename = process.argv[2] ?? 'NFS_2022_12_Avgifter.txt';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data } = await sb
  .from('kb_chunks')
  .select('chunk_index, text')
  .eq('filename', filename)
  .order('chunk_index', { ascending: true });

if (!data) {
  console.error('no data');
  process.exit(1);
}

const orig = reconstructSource((data as Array<{ text: string }>).map((r) => r.text));
console.log(`Reconstructed: ${orig.length} chars from ${data.length} v1-chunks`);
const hier = splitHierarchical(orig);
const smallSizes = hier.flatMap((h) => h.smalls.map((s) => s.text.length));
const largeSizes = hier.map((h) => h.text.length);
console.log(`Large: ${hier.length} chunks, sizes ${largeSizes.slice(0, 5).join(',')}... avg ${Math.round(largeSizes.reduce((a, b) => a + b, 0) / hier.length)}`);
console.log(`Small: ${smallSizes.length} chunks, sizes ${smallSizes.slice(0, 5).join(',')}... avg ${Math.round(smallSizes.reduce((a, b) => a + b, 0) / smallSizes.length)}`);
console.log(`Smalls per large: avg ${(smallSizes.length / hier.length).toFixed(1)}`);
