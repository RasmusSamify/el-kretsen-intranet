/**
 * Auto-extraherar lag-/paragrafreferenser ur en chunk-text.
 *
 * Kör vid indexering (ingest-url, ingest-file) och som backfill mot existerande
 * chunks. Möjliggör strukturerade filter i UI: "visa bara chunks från SFS
 * 2022:1276" eller "alla chunks som refererar Artikel 5 i batteriförordningen".
 *
 * Extrahering är best-effort och tappande — när ett mönster inte matchar
 * lagras NULL. Aldrig hitta på referenser som inte står i texten.
 */
export interface ChunkMetadata {
  law_ref: string | null;
  paragraph_ref: string | null;
  section: string | null;
}

interface Pattern {
  re: RegExp;
  format: (m: RegExpMatchArray) => string;
}

const LAW_PATTERNS: Pattern[] = [
  // SFS 2020:614 / SFS nr: 2020:614 / SFS-nr 2020:614
  { re: /\bSFS(?:[\s-]*nr)?[:\s]+(\d{4}:\d+)\b/i, format: (m) => `SFS ${m[1]}` },
  // Författningsformat i parentes: "Avfallsförordning (2020:614)"
  { re: /\((\d{4}:\d+)\)/, format: (m) => `SFS ${m[1]}` },
  // EU-förordning: förordning (EU) 2023/1542 / förordning (EG) nr 1907/2006
  {
    re: /förordning\s*\((?:EU|EG)\)\s*(?:nr\s*)?(\d+\s*\/\s*\d{4})/i,
    format: (m) => `EU-förordning ${m[1].replace(/\s+/g, '')}`,
  },
  // EU-direktiv: direktiv 2008/98/EG / direktiv (EU) 2018/849
  {
    re: /direktiv\s*(?:\(EU\)\s*)?(\d{4}\s*\/\s*\d+(?:\s*\/\s*E[UG])?)/i,
    format: (m) => `Direktiv ${m[1].replace(/\s+/g, '')}`,
  },
];

const PARAGRAPH_PATTERNS: Pattern[] = [
  // 15 kap. 17 § / 15 kap. 17 a §
  {
    re: /(\d+)\s*kap\.\s*(\d+\s*[a-z]?)\s*§/i,
    format: (m) => `${m[1]} kap. ${m[2].replace(/\s+/g, '')} §`,
  },
  // § 12 / §12 / § 12 a
  {
    re: /§\s*(\d+\s*[a-z]?)\b/,
    format: (m) => `§ ${m[1].replace(/\s+/g, '')}`,
  },
  // Artikel 5 / Art. 5 / Artikel 5.2
  {
    re: /\b(?:Artikel|Art\.)\s*(\d+(?:\.\d+)?)\b/i,
    format: (m) => `Art. ${m[1]}`,
  },
];

export function extractMetadata(text: string): ChunkMetadata {
  return {
    law_ref: firstMatch(text, LAW_PATTERNS),
    paragraph_ref: firstMatch(text, PARAGRAPH_PATTERNS),
    section: null,
  };
}

function firstMatch(text: string, patterns: Pattern[]): string | null {
  for (const p of patterns) {
    const m = text.match(p.re);
    if (m) return p.format(m);
  }
  return null;
}
