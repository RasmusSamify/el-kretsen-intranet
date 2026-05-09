/**
 * Expanderar korta produktkoder i en användarfråga med produktnamnet innan
 * embedding. Hjälper retrieval att hitta rätt KB-avsnitt när användaren
 * skriver "B74" eller "kostar 3.5 något?" — embeddings ensamma matchar
 * sällan koder mot rätt textsstycken eftersom koderna är symboliska.
 *
 * Original-frågan skickas oförändrad till Claude — bara embedding-input
 * berikas. Det betyder att UI/svar fortfarande reflekterar exakt vad
 * användaren skrev.
 */
import { PRODUCT_CODES } from './productCodes';

// Matchar:
//   - Konsumentkoder: 1.1, 3.3.7, 5.5.1
//   - Batterikoder: B74, L71, S3
//   - Professionella: P14, P24.1, P16.1
//   - Gröna varianter: G1.1, G.P14, G.B74 (mappas till basbasen)
const CODE_PATTERN = /\b(?:G\.?)?([BLSP]\d{1,3}(?:\.\d+)?|[1-9]\.\d+(?:\.\d+)?)\b/gi;

export function expandQueryWithCodes(query: string): string {
  const expansions: string[] = [];
  const seen = new Set<string>();

  for (const match of query.matchAll(CODE_PATTERN)) {
    const baseCode = normalizeCode(match[1]);
    if (seen.has(baseCode)) continue;
    const name = PRODUCT_CODES[baseCode];
    if (!name) continue;
    seen.add(baseCode);
    expansions.push(`${baseCode} ${name}`);
  }

  if (expansions.length === 0) return query;
  return `${query}\n\nProduktkoder: ${expansions.join('; ')}`;
}

function normalizeCode(raw: string): string {
  // B-/L-/S-/P-koder: ALWAYS uppercase
  // Numeriska koder: behåll som är (de är redan rena)
  return /^[a-z]/i.test(raw) ? raw.toUpperCase() : raw;
}
