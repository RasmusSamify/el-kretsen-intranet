/**
 * ELvis Hub · version & changelog
 *
 * Semantic versioning:
 *   MAJOR.MINOR.PATCH
 *   - MAJOR: breaking changes eller stora nya kapitel
 *   - MINOR: nya funktioner bakåt-kompatibla
 *   - PATCH: buggfixar, textjusteringar, finputsning
 */

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  highlights: string[];
}

export const CURRENT_VERSION = '1.0.0';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2026-04-19',
    title: 'Första produktionslanseringen',
    highlights: [
      'ELvis AI-assistent med grounded RAG — svar alltid backade av citations',
      'Mail-assistent på svenska och engelska',
      'Avgifts-kalkylator som hittar rätt produktkod + räknar ut totalen',
      'Insikter-dashboard med KPI, obesvarade frågor och källor-statistik',
      'Kunskapsbas-hantering med URL- och filuppladdning',
      'Kretskampen (AI-genererat quiz) och Avgifts-duellen (prisgissnings-spel)',
      'Email-notifikationer via Resend när en fråga inte kan besvaras',
      'Full El-kretsen-indexering: 138 källor, 1 661 chunks (lagar, el-kretsen.se, interna)',
      'Voyage voyage-3 embeddings + Claude Sonnet 4 (temperature 0) för konsekventa svar',
      'Vertikal sidebar, full-width header, responsiv layout i 1400 px',
    ],
  },
];
