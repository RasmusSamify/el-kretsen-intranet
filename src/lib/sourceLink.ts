/**
 * Bygger en klickbar djuplänk från en citation till själva källan.
 *
 * Webbkällor (filnamnet är en URL, t.ex. "www.naturvardsverket.se/...") öppnas
 * med ett Text Fragment (#:~:text=...) byggt från den mest relevanta meningen,
 * så Chromium-browsers scrollar direkt till och markerar rätt avsnitt på sidan.
 * Browsers utan stöd (Firefox/Safari) ignorerar fragmentet och öppnar sidans topp.
 *
 * Interna dokument har ingen publik URL — där returneras null och popovern
 * visar stället i texten istället.
 */

/** Samma klassning som i Kunskapsbasen: intern = inget "/" och ingen domän-markör. */
export function isUrlSource(filename: string): boolean {
  return (
    filename.includes('/') ||
    filename.includes('.se') ||
    filename.includes('.eu') ||
    filename.includes('.com') ||
    filename.includes('.org') ||
    filename.includes('.net')
  );
}

/** Bygger ett Text Fragment-direktiv (utan inledande #:~:) från en mening. */
function textFragment(snippet: string | null | undefined): string | null {
  if (!snippet) return null;
  const clean = snippet
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '') // strippa inledande skiljetecken/bullets
    .replace(/[.,;:]+$/u, ''); // och avslutande
  if (clean.length < 6) return null;

  const enc = (s: string) => encodeURIComponent(s);
  const words = clean.split(' ').filter(Boolean);

  // Korta meningar: matcha hela. Längre: matcha start- + slutfras (robust mot
  // små skillnader i mitten mellan vår sparade text och sidans synliga text).
  if (words.length <= 6) {
    return `text=${enc(clean)}`;
  }
  const start = words.slice(0, 4).join(' ');
  const end = words.slice(-4).join(' ');
  return `text=${enc(start)},${enc(end)}`;
}

/**
 * Returnerar en absolut URL till källan (med ev. text-fragment) eller null
 * om källan är ett internt dokument utan publik adress.
 */
export function buildSourceUrl(filename: string, snippet?: string | null): string | null {
  if (!isUrlSource(filename)) return null;

  const clean = filename.trim();
  const truncated = clean.includes('...'); // canonicalFilename kapar mycket långa URL:er
  const host = clean.split('/')[0];

  let base: URL;
  try {
    base = new URL('https://' + (truncated ? host : clean));
  } catch {
    return null;
  }

  // Kapade filnamn saknar exakt path → hoppa text-fragmentet (sidan finns ändå inte exakt).
  const frag = truncated ? null : textFragment(snippet);
  return frag ? `${base.toString()}#:~:${frag}` : base.toString();
}
