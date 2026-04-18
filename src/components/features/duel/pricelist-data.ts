/**
 * Hårdkodad urval av El-kretsens prislista 2026 för Avgifts-duellen.
 * Representativ bredd över konsument, annan elutrustning och batterier
 * så spelet känns omväxlande. Priser är ordagranna från Prislista_2026.html.
 */

export type FeeUnit = 'kr/st' | 'kr/kg';
export type Category = 'Konsument' | 'Annan Elutrustning' | 'Batterier';

export interface PricedProduct {
  code: string;
  name: string;
  fee: number;
  unit: FeeUnit;
  category: Category;
}

export const PRICELIST: PricedProduct[] = [
  // KONSUMENT — vitvaror & värmepumpar
  { code: '1.1', name: 'Kyl och frys', fee: 80, unit: 'kr/st', category: 'Konsument' },
  { code: '1.2', name: 'Övriga vitvaror >50 cm', fee: 5, unit: 'kr/st', category: 'Konsument' },
  { code: '1.3', name: 'Värmepumpar <40 kg', fee: 2, unit: 'kr/kg', category: 'Konsument' },
  { code: '1.3.1', name: 'Värmepumpar >40 kg', fee: 80, unit: 'kr/st', category: 'Konsument' },
  { code: '1.4', name: 'Värmeelement med annan vätska', fee: 5, unit: 'kr/st', category: 'Konsument' },

  // KONSUMENT — hushåll & tillbehör
  { code: '2.1', name: 'Hushållsapparater <50 cm', fee: 1.2, unit: 'kr/st', category: 'Konsument' },
  { code: '2.2', name: 'Övriga tillbehör <50 cm (kablar)', fee: 0.15, unit: 'kr/kg', category: 'Konsument' },

  // KONSUMENT — IT
  { code: '3.1', name: 'IT-produkter >50 cm', fee: 0.3, unit: 'kr/kg', category: 'Konsument' },
  { code: '3.2', name: 'Stationära datorer', fee: 0, unit: 'kr/kg', category: 'Konsument' },
  { code: '3.2.1', name: 'Laptops', fee: 0, unit: 'kr/kg', category: 'Konsument' },
  { code: '3.3.1', name: 'Monitorer 6–18 tum', fee: 1, unit: 'kr/st', category: 'Konsument' },
  { code: '3.3.2', name: 'Monitorer 19–25 tum', fee: 5, unit: 'kr/st', category: 'Konsument' },
  { code: '3.3.4', name: 'Monitorer 32–36 tum', fee: 40, unit: 'kr/st', category: 'Konsument' },
  { code: '3.3.6', name: 'Monitorer 48–54 tum', fee: 80, unit: 'kr/st', category: 'Konsument' },
  { code: '3.3.7', name: 'Monitorer 55+ tum', fee: 105, unit: 'kr/st', category: 'Konsument' },
  { code: '3.4', name: 'IT-produkter <50 cm', fee: 0.15, unit: 'kr/kg', category: 'Konsument' },
  { code: '3.5', name: 'Mobiltelefoner', fee: 0, unit: 'kr/kg', category: 'Konsument' },

  // KONSUMENT — TV / ljud
  { code: '4.1.4', name: 'TV 32–36 tum', fee: 40, unit: 'kr/st', category: 'Konsument' },
  { code: '4.1.6', name: 'TV 48–54 tum', fee: 80, unit: 'kr/st', category: 'Konsument' },
  { code: '4.1.7', name: 'TV 55+ tum', fee: 105, unit: 'kr/st', category: 'Konsument' },
  { code: '4.2', name: 'Ljud- och bildutrustning <50 cm', fee: 1.2, unit: 'kr/st', category: 'Konsument' },
  { code: '4.4', name: 'Solcellspaneler >50 cm', fee: 0.5, unit: 'kr/kg', category: 'Konsument' },

  // KONSUMENT — belysning
  { code: '5.2', name: 'Ljuskällor >7 cm', fee: 0.35, unit: 'kr/st', category: 'Konsument' },
  { code: '5.3', name: 'Ljuskällor <7 cm', fee: 0.1, unit: 'kr/st', category: 'Konsument' },
  { code: '5.5', name: 'Belysningsarmaturer <50 cm', fee: 0.5, unit: 'kr/st', category: 'Konsument' },

  // KONSUMENT — verktyg & leksaker
  { code: '6.1', name: 'Verktyg <50 cm', fee: 1, unit: 'kr/st', category: 'Konsument' },
  { code: '7.1', name: 'Leksaker & sport <50 cm', fee: 0.5, unit: 'kr/st', category: 'Konsument' },
  { code: '8.1', name: 'Medicinteknisk utrustning <50 cm', fee: 0.9, unit: 'kr/st', category: 'Konsument' },
  { code: '9.2', name: 'Brandvarnare, optiska', fee: 3, unit: 'kr/st', category: 'Konsument' },
  { code: '9.3', name: 'Brandvarnare, joniserande', fee: 25, unit: 'kr/st', category: 'Konsument' },

  // ANNAN ELUTRUSTNING
  { code: 'P14', name: 'Kyl och frys (professionell)', fee: 80, unit: 'kr/st', category: 'Annan Elutrustning' },
  { code: 'P24', name: 'Övriga produkter <50 cm', fee: 1, unit: 'kr/st', category: 'Annan Elutrustning' },
  { code: 'P25', name: 'Övriga produkter >50 cm', fee: 1, unit: 'kr/st', category: 'Annan Elutrustning' },
  { code: 'P26', name: 'Varuautomater för kalla produkter', fee: 80, unit: 'kr/st', category: 'Annan Elutrustning' },
  { code: 'P28', name: 'Automater för spel/produkter/pengar', fee: 5, unit: 'kr/st', category: 'Annan Elutrustning' },

  // BATTERIER — bärbara
  { code: 'B2', name: 'Knappceller', fee: 42.8, unit: 'kr/kg', category: 'Batterier' },
  { code: 'B4', name: 'NiMH (bärbart)', fee: 1, unit: 'kr/kg', category: 'Batterier' },
  { code: 'B5', name: 'Alkaliska (bärbart)', fee: 14, unit: 'kr/kg', category: 'Batterier' },
  { code: 'B6', name: 'Li primär – ej uppladdningsbart', fee: 50, unit: 'kr/kg', category: 'Batterier' },
  { code: 'B74', name: 'Li-jon LFP – järnfosfat (bärbart)', fee: 10, unit: 'kr/kg', category: 'Batterier' },
  { code: 'B77', name: 'Li-jon ospecificerad (temporär 2026)', fee: 10.5, unit: 'kr/kg', category: 'Batterier' },

  // INDUSTRI ≤5 kg
  { code: 'I1(A)', name: 'Industri Nicd ≤5 kg', fee: 11, unit: 'kr/kg', category: 'Batterier' },
  { code: 'I6(A)', name: 'Industri Li primär ≤5 kg', fee: 50, unit: 'kr/kg', category: 'Batterier' },
  { code: 'I71(A)', name: 'Industri Li-jon LCO ≤5 kg', fee: 10, unit: 'kr/kg', category: 'Batterier' },

  // INDUSTRI 25–100 kg
  { code: 'I71(C)', name: 'Industri Li-jon LCO 25–100 kg', fee: 25, unit: 'kr/kg', category: 'Batterier' },

  // STARTBATTERIER
  { code: 'S1', name: 'Startbatteri Nicd', fee: 20, unit: 'kr/kg', category: 'Batterier' },
  { code: 'S3', name: 'Startbatteri Bly', fee: 0.5, unit: 'kr/kg', category: 'Batterier' },
  { code: 'S71', name: 'Startbatteri Li-jon LCO', fee: 10, unit: 'kr/kg', category: 'Batterier' },

  // ELBILSBATTERIER
  { code: 'E71(C)', name: 'Elbil Li-jon LCO 25–100 kg', fee: 15, unit: 'kr/kg', category: 'Batterier' },
  { code: 'E74(D)', name: 'Elbil Li-jon LFP >100 kg', fee: 15, unit: 'kr/kg', category: 'Batterier' },
];

export function randomPair(): [PricedProduct, PricedProduct] {
  for (let i = 0; i < 50; i++) {
    const a = PRICELIST[Math.floor(Math.random() * PRICELIST.length)];
    const b = PRICELIST[Math.floor(Math.random() * PRICELIST.length)];
    if (a.code !== b.code && a.fee !== b.fee) return [a, b];
  }
  return [PRICELIST[0], PRICELIST[1]];
}

export function streakMultiplier(streak: number): number {
  if (streak >= 8) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}
