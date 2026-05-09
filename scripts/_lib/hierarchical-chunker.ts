/**
 * Hierarchical chunker — splittar reconstructed source-text i två nivåer:
 *
 *   • LARGE (~2500 tecken) — sänds till Claude för kontext
 *   • SMALL (~400 tecken)  — embeddas + söks; pekar via parent_id på large
 *
 * Strategi: tokenisera till "sentence units" (där en unit är en mening eller
 * en kort rad/bullet), sedan greedy-pack i chunks. Vid flush bakåtspola N
 * units så de blir overlap för nästa chunk. Sentence-aware = korrekt
 * meningsgräns (#3 från improvements.md).
 */

export interface SmallChunk {
  text: string;
  index: number;
  parentIndex: number;
}

export interface LargeChunk {
  text: string;
  index: number;
  smalls: SmallChunk[];
}

export interface ChunkerOptions {
  largeTarget: number;
  smallTarget: number;
  largeOverlap: number;
  smallOverlap: number;
}

const DEFAULTS: ChunkerOptions = {
  largeTarget: 2500,
  smallTarget: 400,
  largeOverlap: 250,
  smallOverlap: 80,
};

export function splitHierarchical(source: string, opts?: Partial<ChunkerOptions>): LargeChunk[] {
  const o = { ...DEFAULTS, ...opts };
  const cleaned = source.replace(/\r\n/g, '\n').replace(/ /g, ' ').trim();
  if (!cleaned) return [];

  const units = tokenizeUnits(cleaned);
  const largeTexts = packUnits(units, o.largeTarget, o.largeOverlap);

  return largeTexts.map((largeText, li) => {
    const subUnits = tokenizeUnits(largeText);
    const smallTexts = packUnits(subUnits, o.smallTarget, o.smallOverlap);
    const smalls: SmallChunk[] = smallTexts.map((smallText, si) => ({
      text: smallText,
      index: si,
      parentIndex: li,
    }));
    return { text: largeText, index: li, smalls };
  });
}

/**
 * Tokenisera text till "units": korta strängar som vi kan paketera utan att
 * splittra mitt i en mening. En unit är en mening, en bullet, en
 * paragraf-break, eller (om en mening är för lång) en hård word-split.
 */
function tokenizeUnits(text: string): string[] {
  const out: string[] = [];
  // Behåll paragraf-strukturen via tomma units som markerar gräns
  const paragraphs = text.split(/\n\s*\n/);
  paragraphs.forEach((p, idx) => {
    const trimmed = p.trim();
    if (!trimmed) return;
    // Splitta på meningsgränser
    const sentences = trimmed.split(/(?<=[.!?…])\s+(?=[A-ZÅÄÖ"„«0-9])/g);
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      // Hård split om en "mening" är absurt lång (typ tabellrad utan punkt)
      if (s.length > 600) {
        out.push(...hardSplitWords(s, 500));
      } else {
        out.push(s);
      }
    }
    if (idx < paragraphs.length - 1) out.push('\n\n'); // paragraf-marker
  });
  return out;
}

function hardSplitWords(text: string, target: number): string[] {
  const out: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + target, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > pos + target * 0.6) end = space;
    }
    out.push(text.slice(pos, end).trim());
    pos = end;
  }
  return out.filter(Boolean);
}

/**
 * Packa units i chunks med target-storlek. Vid flush, bakåtspola units så
 * att summa overlap-tecken är ungefär `overlap`. Det ger sentence-aware
 * overlap utan att duplicera mer än nödvändigt.
 */
function packUnits(units: string[], target: number, overlap: number): string[] {
  if (units.length === 0) return [];

  const chunks: string[] = [];
  let buf: string[] = [];
  let bufLen = 0;

  const join = (us: string[]) =>
    us.reduce((acc, u, i) => {
      if (u === '\n\n') return acc.endsWith('\n\n') ? acc : `${acc}${acc ? '\n\n' : ''}`;
      if (i === 0 || acc.endsWith('\n\n')) return `${acc}${u}`;
      return `${acc} ${u}`;
    }, '').trim();

  const flush = () => {
    if (bufLen === 0) return;
    chunks.push(join(buf));
    // Bakåtspola enheter som tillsammans fyller ~overlap tecken
    let keepLen = 0;
    let keepFrom = buf.length;
    while (keepFrom > 0 && keepLen + buf[keepFrom - 1].length + 1 <= overlap) {
      keepFrom--;
      keepLen += buf[keepFrom].length + 1;
    }
    buf = buf.slice(keepFrom);
    bufLen = keepLen;
  };

  for (const unit of units) {
    const unitLen = unit === '\n\n' ? 2 : unit.length + 1;
    if (bufLen > 0 && bufLen + unitLen > target) {
      flush();
    }
    buf.push(unit);
    bufLen += unitLen;
  }
  if (bufLen > 0) chunks.push(join(buf));

  // Filtrera bort eventuella tomma eller bara-paragraph-marker chunks
  return chunks.map((c) => c.replace(/\s+/g, ' ').trim()).filter((c) => c.length > 30);
}

/**
 * Reconstruct original source-text från ordnade v1-chunks som suttit
 * sammanbundna med en fast overlap-strategi (CHUNK_OVERLAP=200 i v1).
 * Robust mot småskillnader genom att söka största suffix-prefix-överlapp
 * inom ett rimligt fönster.
 */
export function reconstructSource(orderedChunks: string[]): string {
  if (orderedChunks.length === 0) return '';
  let text = orderedChunks[0];
  for (let i = 1; i < orderedChunks.length; i++) {
    const next = orderedChunks[i];
    const overlap = findOverlap(text, next);
    text += next.slice(overlap);
  }
  return text;
}

function findOverlap(prev: string, next: string): number {
  const maxWindow = Math.min(prev.length, next.length, 500);
  for (let n = maxWindow; n > 20; n--) {
    if (prev.slice(-n) === next.slice(0, n)) return n;
  }
  return 0;
}
