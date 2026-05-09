/**
 * Lookup-tabell för produktkoder → produktnamn, härledd från
 * `Prislista_2026_RAG.txt` i Supabase-bucketen `Linneas AI-losning`.
 *
 * Används av `queryExpansion.ts` för att berika korta frågor som "B74" eller
 * "kod 3.5" innan embedding skickas till Voyage. Embeddings blir då
 * dramatiskt bättre på att hitta rätt avsnitt i kunskapsbasen.
 *
 * Regenerera när prislistan uppdateras genom att köra denna SQL mot
 * Supabase och klistra in resultatet:
 *
 *   WITH lines AS (
 *     SELECT regexp_split_to_table(text, E'\n') AS line
 *     FROM kb_chunks WHERE filename = 'Prislista_2026_RAG.txt'
 *   ), codes AS (
 *     SELECT DISTINCT
 *       (regexp_match(line, '^### Kod ([A-Z]?[\d.]+(?:\.\d+)?[a-z]?|B\d+|G[\d.]+|G\.[A-Z]\d+|P\d+|G\.P\d+)\s+—\s+(.+)$'))[1] AS code,
 *       (regexp_match(line, '^### Kod ([A-Z]?[\d.]+(?:\.\d+)?[a-z]?|B\d+|G[\d.]+|G\.[A-Z]\d+|P\d+|G\.P\d+)\s+—\s+(.+)$'))[2] AS name
 *     FROM lines WHERE line LIKE '### Kod %'
 *   )
 *   SELECT code, name FROM codes WHERE code IS NOT NULL ORDER BY code;
 *
 * Senast genererad: 2026-05-08 (Prislista 2026)
 */
export const PRODUCT_CODES: Record<string, string> = {
  '1.1': 'Kyl och frys',
  '1.2': 'Övriga vitvaror och stora hushållsapparater >50 cm',
  '1.3': 'Värmepumpar, luftkonditionering och andra liknande produkter med enheter under 40 kg',
  '1.3.1': 'Värmepumpar, luftkonditionering och andra liknande produkter med enheter över 40 kg',
  '1.4': 'Värmeelement med annan vätska än vatten',
  '2.1': 'Hushållsapparater <50 cm (inklusive dammsugare)',
  '2.2': 'Övriga tillbehör <50 cm (samt alla typer av kablar och sladdar)',
  '3.1': 'IT-produkter >50 cm',
  '3.2': 'Stationära datorer',
  '3.2.1': 'Laptops',
  '3.3.1': 'Monitorer 6–18 tum (läsplattor, surfplattor, digitala fotoramar mm)',
  '3.3.2': 'Monitorer 19–25 tum',
  '3.3.3': 'Monitorer 26–31 tum',
  '3.3.4': 'Monitorer 32–36 tum',
  '3.3.5': 'Monitorer 37–47 tum',
  '3.3.6': 'Monitorer 48–54 tum',
  '3.3.7': 'Monitorer 55 tum och större',
  '3.4': 'IT-produkter <50 cm',
  '3.5': 'Mobiltelefoner',
  '4.1.1': 'TV-apparater 6–18 tum',
  '4.1.2': 'TV-apparater 19–25 tum',
  '4.1.3': 'TV-apparater 26–31 tum',
  '4.1.4': 'TV-apparater 32–36 tum',
  '4.1.5': 'TV-apparater 37–47 tum',
  '4.1.6': 'TV-apparater 48–54 tum',
  '4.1.7': 'TV-apparater 55 tum och större',
  '4.2': 'Ljud- och bildutrustning, musikinstrument samt solceller <50 cm',
  '4.3': 'Ljud- och bildutrustning samt musikinstrument >50 cm',
  '4.4': 'Solcellspaneler >50 cm',
  '5.2': 'Ljuskällor >7 cm (inkl. sockel)',
  '5.3': 'Ljuskällor <7 cm (inkl. sockel)',
  '5.5': 'Belysningsarmaturer, solcellsbelysning samt belysningsprodukter med integrerad belysning <50 cm',
  '5.5.1': 'Belysningsarmaturer samt andra belysningsprodukter med integrerad belysning >50 cm',
  '6.1': 'Verktyg och reglerutrustning <50 cm',
  '6.2': 'Verktyg och reglerutrustning >50 cm',
  '7.1': 'Leksaker, sport- och fritidsutrustning, kläder och skor <50 cm',
  '7.2': 'Leksaker, sport- och fritidsutrustning samt möbler >50 cm',
  '8.1': 'Medicinteknisk utrustning <50 cm',
  '9.2': 'Brandvarnare, optiska',
  '9.3': 'Brandvarnare, joniserande',
  // Batterier — konsument
  B2: 'Knappceller',
  B4: 'NiMH',
  B5: 'Alkaliska',
  B6: 'Li primär – ej uppladdningsbart',
  B71: 'Li-jon LCO – Litium-Koboltoxid (LiCoO₂), uppladdningsbart',
  B72: 'Li-jon NMC – Litium-Nickel-Mangan-Koboltoxid, uppladdningsbart',
  B73: 'Li-jon NCA – Litium-Nickel-Kobolt-Aluminiumoxid, uppladdningsbart',
  B74: 'Li-jon LFP – Litium-järnfosfat (LiFePO₄), uppladdningsbart',
  B75: 'Li-jon LMO – Litium-Manganoxid, uppladdningsbart',
  B76: 'Li-jon LTO – Litium-Titanatoxid, uppladdningsbart',
  B77: 'Li-jon, ospecificerad, uppladdningsbart (temporär samlingskod 2026)',
  // Industri-/lättransport
  L1: 'Nicd',
  L3: 'Bly',
  L4: 'NiMH',
  L71: 'Li-jon LCO – Litium-Koboltoxid, uppladdningsbart',
  L72: 'Li-jon NMC – Litium-Nickel-Mangan-Koboltoxid, uppladdningsbart',
  L73: 'Li-jon NCA – Litium-Nickel-Kobolt-Aluminiumoxid, uppladdningsbart',
  L74: 'Li-jon LFP – Litium-järnfosfat (LiFePO₄), uppladdningsbart',
  L75: 'Li-jon LMO – Litium-Manganoxid, uppladdningsbart',
  L76: 'Li-jon LTO – Litium-Titanatoxid, uppladdningsbart',
  // Startbatterier
  S1: 'Nicd',
  S3: 'Bly',
  S4: 'NiMH',
  S71: 'Li-jon LCO – Litium-Koboltoxid, uppladdningsbart',
  S72: 'Li-jon NMC – Litium-Nickel-Mangan-Koboltoxid, uppladdningsbart',
  S73: 'Li-jon NCA – Litium-Nickel-Kobolt-Aluminiumoxid, uppladdningsbart',
  S74: 'Li-jon LFP – Litium-järnfosfat (LiFePO₄), uppladdningsbart',
  S75: 'Li-jon LMO – Litium-Manganoxid, uppladdningsbart',
  S76: 'Li-jon LTO – Litium-Titanatoxid, uppladdningsbart',
  // Professionella koder
  P14: 'Kyl och frys',
  P15: 'Övriga vitvaror och stora köksapparater >50 cm',
  P16: 'Värmepumpar, luftkonditionering och liknande produkter med enheter under 40 kg',
  'P16.1': 'Värmepumpar, luftkonditionering och liknande produkter med enheter över 40 kg',
  P17: 'IT-, mobil- och telekomutrustning >50 cm (basstationer, antenner mm)',
  P18: 'IT-, mobil- och telekomutrustning <50 cm',
  P19: 'Monitorer 55 tum och större',
  P20: 'TV-apparater 55 tum och större',
  P21: 'Solcellspaneler >50 cm',
  P22: 'Armaturer för professionellt bruk >50 cm (inkl. armaturer med integrerad belysning)',
  P23: 'Armaturer för professionellt bruk <50 cm (inkl. armaturer med integrerad belysning)',
  P24: 'Övriga produkter <50 cm',
  'P24.1': 'Övriga tillbehör <50 cm',
  P25: 'Övriga produkter >50 cm',
  P26: 'Varuautomater för kalla produkter',
  P27: 'Värmeelement med annan vätska än vatten',
  P28: 'Automater för spel, produkter, pengar mm',
};
