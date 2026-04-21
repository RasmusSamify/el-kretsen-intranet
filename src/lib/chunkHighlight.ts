/**
 * Utilities för att matcha en mening från ELvis-svaret mot rätt del av en
 * källchunk, så användaren ser VAR i texten citationen kommer ifrån istället
 * för en vägg av 1200 tecken.
 */

const SWEDISH_STOPWORDS = new Set([
  'och', 'att', 'det', 'är', 'en', 'ett', 'på', 'i', 'för', 'av', 'med', 'som',
  'har', 'inte', 'men', 'om', 'eller', 'när', 'denna', 'detta', 'dem', 'dessa',
  'den', 'de', 'ni', 'vi', 'du', 'jag', 'han', 'hon', 'kan', 'ska', 'vara', 'blir',
  'bli', 'får', 'fått', 'gav', 'ger', 'går', 'gå', 'kom', 'kommer', 'också', 'bara',
  'mer', 'mest', 'man', 'mig', 'min', 'mina', 'dess', 'sig', 'sitt', 'sin',
  'samma', 'alla', 'andra', 'hos', 'utan', 'upp', 'ner', 'hit', 'dit', 'där',
  'här', 'ut', 'in', 'samt', 'dock', 'dessutom', 'eftersom', 'medan', 'dvs',
  'osv', 'via', 'över', 'under', 'samt', 'skall', 'bör', 'efter', 'innan', 'till',
  'från', 'mellan', 'samtidigt',
]);

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !SWEDISH_STOPWORDS.has(t));
}

export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const regex = /[^.!?\n]+[.!?]?(?:\s|$)|[^.!?\n]+$/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[0];
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const leadingWhitespace = raw.length - raw.trimStart().length;
    const trailingWhitespace = raw.length - raw.trimEnd().length;
    sentences.push({
      text: trimmed,
      start: m.index + leadingWhitespace,
      end: m.index + raw.length - trailingWhitespace,
    });
  }
  return sentences;
}

/**
 * Hittar meningen i chunken med störst lexikalt överlapp mot claimText.
 * Returnerar null om bästa matchen är för svag (< 0.15 normaliserad score).
 */
export function findBestMatchSentence(
  chunkText: string,
  claimText: string,
): Sentence | null {
  const claimTokens = new Set(tokenize(claimText));
  if (claimTokens.size === 0) return null;

  const sentences = splitSentences(chunkText);
  let best: Sentence | null = null;
  let bestScore = 0;

  for (const sentence of sentences) {
    const senTokens = tokenize(sentence.text);
    if (senTokens.length === 0) continue;
    let overlap = 0;
    for (const tok of senTokens) if (claimTokens.has(tok)) overlap++;
    const score = overlap / Math.sqrt(senTokens.length * claimTokens.size);
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }

  return bestScore >= 0.15 ? best : null;
}

/**
 * Extraherar meningen i fullText som innehåller positionen `pos`
 * (där citationsmarkören sitter).
 */
export function extractClaimSentence(fullText: string, pos: number): string {
  const before = fullText.slice(0, pos);
  const after = fullText.slice(pos);

  let startIdx = 0;
  for (const m of ['. ', '! ', '? ', '.\n', '!\n', '?\n', '\n\n']) {
    const i = before.lastIndexOf(m);
    if (i !== -1 && i + m.length > startIdx) startIdx = i + m.length;
  }

  let endOff = after.length;
  for (const m of ['. ', '! ', '? ', '.\n', '!\n', '?\n', '\n\n']) {
    const i = after.indexOf(m);
    if (i !== -1 && i < endOff) endOff = i + 1;
  }

  return fullText.slice(startIdx, pos + endOff).trim();
}

/**
 * Returnerar en snippet med `contextChars` tecken före och efter highlighten,
 * trimmad till närmsta ordgränser.
 */
export function snippetAround(
  chunkText: string,
  highlight: Sentence,
  contextChars = 120,
): {
  before: string;
  highlight: string;
  after: string;
  trimmedStart: boolean;
  trimmedEnd: boolean;
} {
  const start = Math.max(0, highlight.start - contextChars);
  const end = Math.min(chunkText.length, highlight.end + contextChars);

  let beforeText = chunkText.slice(start, highlight.start);
  const highlightText = chunkText.slice(highlight.start, highlight.end);
  let afterText = chunkText.slice(highlight.end, end);

  const trimmedStart = start > 0;
  const trimmedEnd = end < chunkText.length;

  if (trimmedStart) {
    const firstSpace = beforeText.indexOf(' ');
    if (firstSpace !== -1 && firstSpace < 40) {
      beforeText = beforeText.slice(firstSpace + 1);
    }
  }
  if (trimmedEnd) {
    const lastSpace = afterText.lastIndexOf(' ');
    if (lastSpace !== -1 && afterText.length - lastSpace < 40) {
      afterText = afterText.slice(0, lastSpace);
    }
  }

  return {
    before: beforeText,
    highlight: highlightText,
    after: afterText,
    trimmedStart,
    trimmedEnd,
  };
}
