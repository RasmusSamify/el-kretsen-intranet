/**
 * Delad logik för att gruppera och visa kunskapsbas-källor.
 * Används av både Kunskapsbas-sidan (full vy) och Källor-panelen i ELvis-chatten
 * (kompakt vy) så att grupperingen alltid ser likadan ut på båda ställena.
 */

export interface SourceRow {
  filename: string;
  chunk_count: number;
  department?: string | null;
}

/** Föreslagna avdelningar/ämnen för interna dokument. Fri text i databasen —
 *  listan är bara snabbval; be om fler så lägger vi till dem. */
export const DEPARTMENTS = ['Ekonomi', 'Marknad', 'Information', 'Transport', 'Övrigt'] as const;
export const UNCATEGORIZED = 'Ej kategoriserad';

/** Gruppera interna dokument per avdelning i en bestämd ordning:
 *  kända avdelningar först, ev. egna därefter, "Ej kategoriserad" sist. */
export function groupByDepartment(
  items: SourceRow[],
): Array<{ dept: string; key: string; items: SourceRow[] }> {
  const map = new Map<string, SourceRow[]>();
  for (const s of items) {
    const key = s.department?.trim() || UNCATEGORIZED;
    (map.get(key) ?? map.set(key, []).get(key)!).push(s);
  }
  const known = DEPARTMENTS.filter((d) => map.has(d));
  const custom = [...map.keys()]
    .filter((k) => k !== UNCATEGORIZED && !DEPARTMENTS.includes(k as (typeof DEPARTMENTS)[number]))
    .sort((a, b) => a.localeCompare(b, 'sv'));
  const order = [...known, ...custom, ...(map.has(UNCATEGORIZED) ? [UNCATEGORIZED] : [])];
  return order.map((dept) => ({ dept, key: dept, items: map.get(dept)! }));
}

/** Internt dokument = saknar "/" och domän-markör (annars en webbkälla). */
export function isInternalSource(filename: string): boolean {
  return (
    !filename.includes('/') &&
    !filename.includes('.se') &&
    !filename.includes('.eu') &&
    !filename.includes('.com') &&
    !filename.includes('.org') &&
    !filename.includes('.net')
  );
}

/** Värd-delen av ett webb-filnamn ("www.naturvardsverket.se/...") → "www.naturvardsverket.se". */
export function hostOf(filename: string): string {
  return filename.split('/')[0];
}

/** Snyggare etikett för en domän — strippar "www.". */
export function hostLabel(host: string): string {
  return host.replace(/^www\./, '');
}

/** Kända lag/myndighets-domäner får en våg-/lag-ikon istället för glob. */
export function isLawDomain(host: string): boolean {
  return /riksdagen\.se|eur-lex|europa\.eu|lagrummet|notisum|svenskforfattningssamling/i.test(host);
}

/** Snyggt visningsnamn — interna dok strippar filändelse, webbkällor visar sökvägen. */
export function displayName(src: SourceRow): string {
  if (isInternalSource(src.filename)) return src.filename.replace(/\.[^/.]+$/, '');
  return src.filename.split('/').slice(1).join('/').replace(/[-_]/g, ' ').trim() || src.filename;
}

/** Gruppera ett källurval i webbkällor (per domän) + interna dokument.
 *  Domänordning: el-kretsen.se först, sedan störst först, sedan alfabetiskt. */
export function groupSources(sources: SourceRow[]): {
  internal: SourceRow[];
  domains: Array<{ host: string; label: string; items: SourceRow[] }>;
} {
  const internal = sources.filter((s) => isInternalSource(s.filename));
  const web = sources.filter((s) => !isInternalSource(s.filename));

  const byHost = new Map<string, SourceRow[]>();
  for (const s of web) {
    const h = hostOf(s.filename);
    (byHost.get(h) ?? byHost.set(h, []).get(h)!).push(s);
  }
  const domains = [...byHost.entries()]
    .map(([host, items]) => ({ host, label: hostLabel(host), items }))
    .sort((a, b) => {
      const aEl = a.host.includes('el-kretsen.se') ? 0 : 1;
      const bEl = b.host.includes('el-kretsen.se') ? 0 : 1;
      if (aEl !== bEl) return aEl - bEl;
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.label.localeCompare(b.label, 'sv');
    });

  return { internal, domains };
}
