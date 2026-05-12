/**
 * Snabba sanity-tester för hierarchical-chunker. Inte ett fullt test-suite —
 * verifierar bara att bygget av Fas B inte är trasigt innan vi startar
 * re-embed (~400 kr Voyage). Kör:
 *
 *   npx tsx scripts/_lib/hierarchical-chunker.test.ts
 */

import { reconstructSource, splitHierarchical } from '../../netlify/functions/_shared/hierarchicalChunker';

let failures = 0;
function expect(label: string, cond: boolean, detail?: string) {
  const status = cond ? 'OK ' : 'FAIL';
  console.log(`  ${status}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

// 1) Reconstruct: två chunks med 200-tecken overlap
{
  console.log('\n[reconstructSource] basic overlap');
  const a = 'A'.repeat(800) + 'XYZ_OVERLAP_MARKER_OF_50_CHARS_aaaaaaaaaaaaaaaaaaa';
  const overlap = a.slice(-200);
  const b = overlap + 'B'.repeat(600);
  const reconstructed = reconstructSource([a, b]);
  expect('reconstructed length matches expected', reconstructed.length === a.length + b.length - 200);
  expect('starts with first chunk content', reconstructed.startsWith(a.slice(0, 100)));
  expect('ends with second chunk tail', reconstructed.endsWith(b.slice(-100)));
}

// 2) Reconstruct: noll overlap
{
  console.log('\n[reconstructSource] no overlap');
  const a = 'AAA';
  const b = 'BBB';
  expect('concatenated when no overlap', reconstructSource([a, b]) === 'AAABBB');
}

// 3) Split: kort text → ett enda chunk
{
  console.log('\n[splitHierarchical] short text');
  const result = splitHierarchical('Detta är en kort text. Bara två meningar.');
  expect('single large chunk', result.length === 1);
  expect('large contains all text', result[0].text.includes('kort text'));
  expect('at least one small', result[0].smalls.length >= 1);
}

// 4) Split: lång text spänner över flera large chunks
{
  console.log('\n[splitHierarchical] long text → multiple chunks');
  const para = 'Producenter ska registrera sig hos Naturvårdsverket enligt förordning SFS 2025:813. ';
  const longText = para.repeat(200); // ~16 000 tecken
  const result = splitHierarchical(longText);
  expect('multiple large chunks', result.length >= 5);
  expect('all large chunks within reasonable size', result.every((l) => l.text.length <= 3500));
  expect('all small chunks within reasonable size', result.flatMap((l) => l.smalls).every((s) => s.text.length <= 600));
  expect('parent indices match large indices', result.every((l) => l.smalls.every((s) => s.parentIndex === l.index)));
}

// 5) Split: respekterar paragrafgränser så långt det går
{
  console.log('\n[splitHierarchical] paragraphs preserved');
  const text = [
    'Första stycket handlar om producentansvar för batterier enligt EU-förordning 1542/2023.',
    'Andra stycket nämner att producenter måste registrera sig hos Naturvårdsverket.',
    'Tredje stycket berör avgifter och tröskelvärden.',
  ].join('\n\n');
  const result = splitHierarchical(text, { largeTarget: 100, smallTarget: 60, largeOverlap: 30, smallOverlap: 15 });
  expect('produced multiple large chunks', result.length >= 2);
  expect('overlap is sentence-aware (not mid-word)', !result.some((l) => /[a-zåäö]\s*$/i.test(l.text) && /^[a-zåäö]/i.test(result[result.indexOf(l) + 1]?.text ?? '')));
}

// 6) End-to-end: chunked → reconstructed bör matcha originalen rätt nära
{
  console.log('\n[round-trip]');
  const original =
    'Det här är ett dokument om producentansvar. Producenter måste registrera sig hos Naturvårdsverket. ' +
    'EU-förordning 1542/2023 ersätter direktiv 2006/66/EG från 2026. Avgifter regleras i SFS 2022:1276. ' +
    'Den temporära samlingskoden B77 gäller hela 2026. ';
  const repeated = original.repeat(20);
  const result = splitHierarchical(repeated);
  const allLargeTexts = result.map((l) => l.text);
  const reconstructed = reconstructSource(allLargeTexts);
  // Med overlap dedup borde vi vara nära originalet (±10%)
  const ratio = reconstructed.length / repeated.length;
  expect(`reconstructed ratio reasonable (got ${ratio.toFixed(2)})`, ratio > 0.85 && ratio < 1.15);
  expect('reconstructed contains key phrases', reconstructed.includes('SFS 2022:1276') && reconstructed.includes('B77'));
}

console.log(`\n${failures === 0 ? 'Alla tester gick igenom.' : `${failures} test(er) misslyckades.`}`);
process.exit(failures === 0 ? 0 : 1);
