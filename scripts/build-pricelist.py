"""
Bygger en RAG-optimerad El-kretsen-prislista genom att kombinera:
- Prislista_2026.html (koder, priser, sektioner) — källan för avgifter
- Produktlista_Zapier_2026_korrigerad.txt (synonymer/sökord per kod)

Output: Prislista_2026_RAG.txt med en sektion per kod som innehåller
kod, pris, grön-pris, kategori och alla synonymer. Varje kod-block är
självständigt så embedding-sökning kan matcha på fritextsynonym,
kod eller priskrona.
"""

import re
import html as html_module
from pathlib import Path
from collections import defaultdict

BASE = Path(r"C:\Users\rasmu\Desktop\Samify\Elkretsen\El-kretsen Bot")
HTML_FILE = BASE / "Prislista_2026.html"
TXT_FILE = BASE / "Produktlista_Zapier_2026_korrigerad.txt"
OUT_FILE = BASE / "Prislista_2026_RAG.txt"

# ---------- Parse HTML ----------
html = HTML_FILE.read_text(encoding="utf-8")

# Extract main section headers with their data-section attribute
section_re = re.compile(
    r'<div class="section-header"[^>]*data-section="([^"]+)"[^>]*>([^<]+)</div>',
    re.IGNORECASE,
)
# Extract subsection markers
sub_re = re.compile(
    r'<tr class="subsection-row"[^>]*>\s*<td[^>]*class="subsection"[^>]*>(.+?)</td>',
    re.DOTALL,
)
# Data rows — three columns
row_re = re.compile(
    r'<tr class="([^"]*(?:data-row|note-row)[^"]*)"[^>]*>\s*'
    r'(?:<td[^>]*colspan="3"[^>]*><em>(.+?)</em></td>'
    r'|<td class="code">(.+?)</td>\s*<td[^>]*>(.+?)</td>\s*<td[^>]*class="price"[^>]*>(.+?)</td>)\s*</tr>',
    re.DOTALL,
)


def clean_html(text):
    """Strip tags and decode entities, collapse whitespace."""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html_module.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# Build tuples (section, subsection, kind, code, product, price, note)
entries = []
# Find section boundaries by character offset
sections = [(m.start(), m.group(1), m.group(2).strip()) for m in section_re.finditer(html)]
sections.append((len(html), None, None))


def section_at(offset):
    for i in range(len(sections) - 1):
        if sections[i][0] <= offset < sections[i + 1][0]:
            return sections[i][2]
    return None


# Iterate through rows and subsections by offset so we can assign a
# subsection to every row.
tokens = []
for m in sub_re.finditer(html):
    tokens.append((m.start(), 'sub', clean_html(m.group(1))))
for m in row_re.finditer(html):
    tokens.append((m.start(), 'row', m))
tokens.sort(key=lambda t: t[0])

current_sub = None
for offset, kind, payload in tokens:
    if kind == 'sub':
        current_sub = payload
        continue
    m = payload
    classes = m.group(1)
    section = section_at(offset) or 'Okänd'
    if 'note-row' in classes:
        note = clean_html(m.group(2) or '')
        if entries and note:
            # attach note to previous entry
            entries[-1]['note'] = note
        continue
    code = clean_html(m.group(3) or '')
    product = clean_html(m.group(4) or '')
    price = clean_html(m.group(5) or '')
    if not code:
        continue
    entries.append({
        'section': section,
        'subsection': current_sub or '',
        'code': code,
        'product': product,
        'price': price,
        'note': None,
    })

# ---------- Parse TXT (synonyms per code) ----------
synonyms = defaultdict(list)
for raw in TXT_FILE.read_text(encoding='utf-8').splitlines()[2:]:  # skip 2 header rows
    parts = raw.split(';')
    if len(parts) < 3:
        continue
    word = parts[0].strip()
    code = parts[1].strip()
    if word and code and word not in synonyms[code]:
        synonyms[code].append(word)

# ---------- Group normal vs green pairs ----------
pair_map = defaultdict(dict)  # base_code -> {'normal': entry, 'green': entry}
green_prefixes = ('G', 'G.')


def base_of(code):
    if code.startswith('G.'):
        return code[2:]
    if code.startswith('G') and len(code) > 1 and code[1].isdigit():
        return code[1:]
    return code


for entry in entries:
    c = entry['code']
    base = base_of(c)
    if c.startswith(green_prefixes) and base != c:
        pair_map[base]['green'] = entry
    else:
        pair_map[base]['normal'] = entry

# ---------- Build output ----------
lines = []
lines.append('El-kretsen Prislista 2026 — RAG-optimerad')
lines.append('Gäller från 2026-01-01. Moms tillkommer på samtliga avgifter.')
lines.append('')
lines.append('GRÖN AVGIFT: Koder med prefix G (t.ex. G1.1, G.P14) ger 10% lägre '
             'avgift och ska styrkas med dokument som visar att produkten uppfyller '
             'kraven. Läs mer i "Lathund Gröna avgifter" i Mina sidor.')
lines.append('')
lines.append('ÅTERBETALNING: Avgifterna är preliminära. Vissa produktkoder får en '
             'årlig återbetalning om de vid årets slut genererat ett positivt '
             'värde (intäkter från miljöavgifter och materialintäkter minus '
             'kostnader för insamling och återvinning).')
lines.append('')
lines.append('=' * 70)
lines.append('')


# Group entries by section for output ordering
by_section = defaultdict(list)
for base, bundle in pair_map.items():
    e = bundle.get('normal') or bundle.get('green')
    if e:
        by_section[e['section']].append((base, bundle))

for section, items in by_section.items():
    lines.append(f'## Sektion: {section}')
    lines.append('')
    for base, bundle in items:
        normal = bundle.get('normal')
        green = bundle.get('green')
        e = normal or green
        syns = synonyms.get(base, [])

        lines.append(f'### Kod {base} — {e["product"]}')
        if e.get('subsection'):
            lines.append(f'Undersektion: {e["subsection"]}')
        if normal:
            lines.append(f'Avgift 2026: {normal["price"]}')
        if green:
            lines.append(f'Grön avgift (kod {green["code"]}): {green["price"]} '
                         '(10% lägre, kräver grön dokumentation)')
        if e.get('note'):
            lines.append(f'Anmärkning: {e["note"]}')
        if syns:
            lines.append('Produkter och synonymer som deklareras på denna kod:')
            # break synonym list into readable lines
            chunk_size = 8
            for i in range(0, len(syns), chunk_size):
                lines.append('  ' + ', '.join(syns[i:i + chunk_size]))
        lines.append('')

# Append allmänna villkor
lines.append('=' * 70)
lines.append('')
lines.append('## Allmänna villkor och fasta avgifter')
lines.append('')
lines.append('Fasta avgifter:')
lines.append('- 500 kr/år — elutrustning')
lines.append('- 15 000 kr/år — batterier')
lines.append('- 1 000 kr — inträdesavgift')
lines.append('- 7 500 kr/år — Producentombud (AR), utländska bolag')
lines.append('- 6 000 kr/år — förmedling av förpackningsdeklarationer')
lines.append('')
lines.append('Deklarationsintervall:')
lines.append('- Månadsvis: Redovisning senast den 10:e i efterföljande månad.')
lines.append('- Kvartalsvis: Möjligt men ränta om 2 % per månad tillkommer.')
lines.append('- OBS: Deklaration ska ske även om vikten/antalet/avgiften är 0.')
lines.append('- Förseningsavgift: 300 kr per missad deklaration. Förseningsränta '
             '2 % efter två påminnelser.')
lines.append('')
lines.append('Förtydligande — Batterier:')
lines.append('Lösa batterier i förpackning: deklarera med antal och total vikt. '
             'Inbyggda/medföljande batterier: redovisa produktens totalvikt på '
             'produktraden och enbart batteriets vikt på batteriraden.')
lines.append('')
lines.append('Förtydligande — Belysning:')
lines.append('Armaturer med integrerad belysning deklareras på armaturkod. '
             'Utbytbara ljuskällor som säljs separat deklareras på ljuskällekod '
             '(5.2 eller 5.3). Professionella armaturer: utbytbara ljuskällor '
             'deklareras alltid som konsumentprodukt.')
lines.append('')
lines.append('Kontakt: www.el-kretsen.se · info@el-kretsen.se')
lines.append('El-Kretsen är certifierade enligt SS-EN ISO 9001:2015 och SS-EN '
             'ISO 14001:2015.')

OUT_FILE.write_text('\n'.join(lines), encoding='utf-8')

# ---------- Report ----------
print(f'Kodbaser (unika produktavgifter): {len(pair_map)}')
print(f'Raderade HTML-rader totalt: {len(entries)}')
print(f'Sektioner: {", ".join(by_section.keys())}')
print(f'Koder med synonymer: {sum(1 for b in pair_map if b in synonyms)}')
print(f'Totalt antal synonymer: {sum(len(v) for v in synonyms.values())}')
print(f'Utfil: {OUT_FILE}')
print(f'Utfil-storlek: {OUT_FILE.stat().st_size} tecken')
