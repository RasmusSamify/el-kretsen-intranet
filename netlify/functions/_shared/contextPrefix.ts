/**
 * Prefixar en chunk-text med dokumentkontext innan embedding.
 *
 * Embedding görs på "{kontext} · {text}", men bara {text} sparas i
 * kb_chunks.text — så UI/citations visar det rena innehållet.
 *
 * Syfte: embedding "vet" vilket dokument chunken tillhör, vilket ger
 * bättre separation mellan liknande texter från olika källor (t.ex.
 * producentansvar i SFS 2022:1276 vs SFS 2025:813).
 */
export function contextPrefix(filename: string, chunkIndex: number): string {
  const base = filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
  // URL-baserade källor: ta bort www-prefixet för renare prefix
  const clean = base.replace(/^www\./, '');
  return `${clean} · stycke ${chunkIndex + 1}`;
}

/**
 * Bygger texten som skickas till Voyage för embedding.
 */
export function embeddingInput(filename: string, chunkIndex: number, text: string): string {
  return `${contextPrefix(filename, chunkIndex)}\n\n${text}`;
}
